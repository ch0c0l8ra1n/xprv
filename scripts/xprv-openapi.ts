#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Node, Project, Symbol as MorphSymbol, Type } from "ts-morph";

interface CliArgs {
	sourcePath: string;
	variableName: string;
	outputPath?: string;
}

interface ParameterRepresentation {
	name: string;
	in: "query" | "header" | "path";
	required: boolean;
	schema: unknown;
}

interface ResponseRepresentation {
	status: string;
	description: string;
	schema?: unknown;
	headers?: Record<string, { required?: boolean; schema: unknown }>;
}

interface RequestRepresentation {
	parameters: ParameterRepresentation[];
	requestBody?: {
		required: boolean;
		schema: unknown;
	};
}

interface OperationRepresentation {
	method: string;
	path: string;
	operationId: string;
	request: RequestRepresentation;
	responses: ResponseRepresentation[];
}

interface RouteNodeInfo {
	path: string;
	handlers: MorphSymbol[];
	children: Type[];
}

function parseArgs(argv: string[]): CliArgs {
	const [, , sourcePath, variableName, outputPath] = argv;

	if (!sourcePath || !variableName) {
		console.error("Usage: xprv-openapi <source-path> <variable-name> [output-path]");
		process.exitCode = 1;
		throw new Error("Invalid arguments");
	}

	const args: CliArgs = { sourcePath, variableName };
	if (outputPath) {
		args.outputPath = outputPath;
	}
	return args;
}

function joinPaths(base: string, segment: string): string {
	const cleanBase = base === "/" ? "" : base.replace(/\/$/, "");
	const cleanSegment = segment.startsWith("/") ? segment.slice(1) : segment;
	const combined = [cleanBase, cleanSegment].filter(Boolean).join("/");
	return `/${combined}`.replace(/\/+/g, "/") || "/";
}

function getLiteralString(type: Type): string | undefined {
	if (type.isStringLiteral()) {
		return type.getLiteralValue() as string;
	}
	const text = type.getText();
	if (/^".*"$/.test(text)) {
		return text.slice(1, -1);
	}
	return undefined;
}

function splitUndefined(type: Type): { types: Type[]; optional: boolean } {
	if (type.isUnion()) {
		const all = type.getUnionTypes();
		const filtered = all.filter((t) => !t.isUndefined());
		return {
			types: filtered,
			optional: filtered.length !== all.length,
		};
	}
	return { types: [type], optional: false };
}

function isTrivialRequestComponent(type: Type | undefined): boolean {
	if (!type) {
		return true;
	}
	if (type.isUndefined() || type.isUnknown() || type.isAny() || type.isVoid() || type.isNever()) {
		return true;
	}
	if (type.isUnion()) {
		return type.getUnionTypes().every((unionMember) => isTrivialRequestComponent(unionMember));
	}
	if (type.isObject()) {
		const properties = type.getProperties();
		if (properties.length === 0 && !type.getStringIndexType()) {
			return true;
		}
	}
	return false;
}

function hasRequestValidation(requestType: Type | undefined): boolean {
	if (!requestType) {
		return false;
	}
	const args = requestType.getTypeArguments();
	if (args.length < 4) {
		return false;
	}
	return args.some((arg) => !isTrivialRequestComponent(arg));
}

function cleanSymbolName(symbol: MorphSymbol): string {
	const name = symbol.getName();
	return name.startsWith("__") ? name.slice(2) : name;
}

function createOperationId(method: string, pathValue: string): string {
	const sanitized = pathValue.replace(/[^A-Za-z0-9]+/g, "_");
	const trimmed = sanitized.replace(/^_+|_+$/g, "");
	return `${method.toLowerCase()}_${trimmed || "root"}`;
}

function cloneResponse(response: ResponseRepresentation): ResponseRepresentation {
	const clone: ResponseRepresentation = {
		status: response.status,
		description: response.description,
		schema: response.schema,
	};
	if (response.headers) {
		clone.headers = { ...response.headers };
	}
	return clone;
}

function findResponseByStatus(
	responses: ResponseRepresentation[],
	status: string,
	description?: string
): ResponseRepresentation | undefined {
	const match = responses.find((response) => response.status === status);
	if (!match) {
		return undefined;
	}
	const cloned = cloneResponse(match);
	if (description) {
		cloned.description = description;
	}
	return cloned;
}

function responseRepresentationToObject(response: ResponseRepresentation): Record<string, unknown> {
	const content = response.schema
		? {
			"application/json": {
				schema: response.schema,
			},
		}
		: undefined;

	return {
		description: response.description,
		...(response.headers ? { headers: response.headers } : {}),
		...(content ? { content } : {}),
	};
}

class SchemaGenerator {
	private readonly components = new Map<string, unknown>();
	private readonly processing = new Set<string>();

	getComponents(): Record<string, unknown> {
		return Object.fromEntries(this.components);
	}

	getSchemaFor(typeList: Type[]): unknown {
		if (typeList.length === 0) {
			return {};
		}
		const [first, ...rest] = typeList;
		if (!first) {
			return {};
		}
		if (rest.length === 0) {
			return this.getSchema(first);
		}
		return {
			oneOf: [this.getSchema(first), ...rest.map((type) => this.getSchema(type))],
		};
	}

	getSchema(type: Type): unknown {
		if (type.isAny() || type.isUnknown()) {
			return {};
		}

		if (type.isNull()) {
			return { type: "null" };
		}

		if (type.isUndefined()) {
			return {};
		}

		if (type.isStringLiteral()) {
			return { type: "string", enum: [type.getLiteralValue()] };
		}

		if (type.isNumberLiteral()) {
			return { type: "number", enum: [type.getLiteralValue()] };
		}

		if (type.isBooleanLiteral()) {
			return { type: "boolean", enum: [type.getLiteralValue()] };
		}

		if (type.isBoolean()) {
			return { type: "boolean" };
		}

		if (type.isNumber()) {
			return { type: "number" };
		}

		if (type.isString()) {
			return { type: "string" };
		}

		if (type.isTuple()) {
			const tupleElements = type.getTupleElements();
			if (tupleElements.length === 0) {
				return { type: "array", items: {} };
			}
			return {
				type: "array",
				prefixItems: tupleElements.map((item) => this.getSchema(item)),
				minItems: tupleElements.length,
			};
		}

		if (type.isArray()) {
			const element = type.getArrayElementType();
			return {
				type: "array",
				items: element ? this.getSchema(element) : {},
			};
		}

		if (type.isUnion()) {
			const parts = type.getUnionTypes();
			const stringLiterals = parts.every((p) => p.isStringLiteral());
			if (stringLiterals) {
				return {
					type: "string",
					enum: parts.map((p) => p.getLiteralValue()),
				};
			}

			const numberLiterals = parts.every((p) => p.isNumberLiteral());
			if (numberLiterals) {
				return {
					type: "number",
					enum: parts.map((p) => p.getLiteralValue()),
				};
			}

			const booleanLiterals = parts.every((p) => p.isBooleanLiteral());
			if (booleanLiterals) {
				return { type: "boolean" };
			}

			const filtered = parts.filter((p) => !p.isUndefined());
			const schema = this.getSchemaFor(filtered);
			if (schema && typeof schema === "object" && filtered.length !== parts.length) {
				return { ...(schema as Record<string, unknown>), nullable: true };
			}
			return schema;
		}

		if (type.isObject()) {
			const symbol = type.getSymbol();
			if (symbol) {
				const name = symbol.getName();
				const declarations = symbol.getDeclarations() ?? [];
				const isNamed = declarations.some((decl) =>
					Node.isInterfaceDeclaration(decl) ||
					Node.isClassDeclaration(decl) ||
					Node.isTypeAliasDeclaration(decl)
				);

				if (isNamed && name && !name.startsWith("__")) {
					if (this.processing.has(name)) {
						return { $ref: `#/components/schemas/${name}` };
					}
					if (this.components.has(name)) {
						return { $ref: `#/components/schemas/${name}` };
					}

					this.processing.add(name);
					const schema = this.buildObjectSchema(type);
					this.processing.delete(name);
					this.components.set(name, schema);
					return { $ref: `#/components/schemas/${name}` };
				}
			}
			return this.buildObjectSchema(type);
		}

		return {};
	}

	private buildObjectSchema(type: Type): unknown {
		const properties = type.getProperties();
		const schema: Record<string, unknown> = { type: "object" };
		const propSchemas: Record<string, unknown> = {};
		const required: string[] = [];

		for (const property of properties) {
			const name = cleanSymbolName(property);
			if (!name) {
				continue;
			}
			const declaration = property.getValueDeclaration() ?? property.getDeclarations()[0];
			const propertyType = declaration
				? property.getTypeAtLocation(declaration)
				: property.getDeclaredType();
			const { types, optional } = splitUndefined(propertyType);
			const schemaValue = this.getSchemaFor(types);
			propSchemas[name] = schemaValue;
			if (!optional && !property.isOptional()) {
				required.push(name);
			}
		}

		if (Object.keys(propSchemas).length > 0) {
			schema.properties = propSchemas;
		}

		if (required.length > 0) {
			schema.required = required;
		}

		const indexType = type.getStringIndexType();
		if (indexType) {
			schema.additionalProperties = this.getSchema(indexType);
		}

		return schema;
	}
}

class OpenApiBuilder {
	private readonly paths = new Map<string, Record<string, unknown>>();

	addOperation(operation: OperationRepresentation) {
		const methodKey = operation.method.toLowerCase();
		const pathItem = this.paths.get(operation.path) ?? {};

		const parameters = operation.request.parameters.map((param) => ({
			name: param.name,
			in: param.in,
			required: param.required,
			schema: param.schema,
		}));

		const responses = this.buildResponses(operation.responses);

		const op: Record<string, unknown> = {
			operationId: operation.operationId,
			responses,
		};

		if (parameters.length > 0) {
			op.parameters = parameters;
		}

		if (operation.request.requestBody) {
			op.requestBody = {
				required: operation.request.requestBody.required,
				content: {
					"application/json": {
						schema: operation.request.requestBody.schema,
					},
				},
			};
		}

		pathItem[methodKey] = op;
		this.paths.set(operation.path, pathItem);
	}

	getPaths(): Record<string, unknown> {
		return Object.fromEntries(this.paths);
	}

	private buildResponses(responses: ResponseRepresentation[]): Record<string, unknown> {
		const merged = new Map<string, ResponseRepresentation>();

		const merge = (incoming: ResponseRepresentation) => {
			const existing = merged.get(incoming.status);
			if (!existing) {
				merged.set(incoming.status, incoming);
				return;
			}

			const combinedHeaders = {
				...(existing.headers ?? {}),
				...(incoming.headers ?? {}),
			};

			let schema: unknown;
			if (existing.schema && incoming.schema) {
				schema = {
					oneOf: [existing.schema, incoming.schema],
				};
			} else {
				schema = existing.schema ?? incoming.schema;
			}

			const descriptionBase = existing.description;
			const effectiveDescription =
				descriptionBase && descriptionBase !== `HTTP ${incoming.status}`
					? descriptionBase
					: incoming.description ?? descriptionBase;

			const mergedResponse: ResponseRepresentation = {
				status: incoming.status,
				description: effectiveDescription ?? `HTTP ${incoming.status}`,
			};

			if (schema) {
				mergedResponse.schema = schema;
			}

			if (Object.keys(combinedHeaders).length > 0) {
				mergedResponse.headers = combinedHeaders;
			}

			merged.set(incoming.status, mergedResponse);
		};

		responses.forEach(merge);

		const result: Record<string, unknown> = {};
		for (const [status, response] of merged.entries()) {
			result[status] = responseRepresentationToObject(response);
		}

		return result;
	}
}

function headersFromType(type: Type, generator: SchemaGenerator): ResponseRepresentation["headers"] {
	if (type.isAny() || type.isUnknown()) {
		return undefined;
	}

	const properties = type.getProperties();
	if (properties.length === 0 && !type.getStringIndexType()) {
		return undefined;
	}

	const headers: Record<string, { required?: boolean; schema: unknown }> = {};

	for (const property of properties) {
		const name = cleanSymbolName(property);
		if (!name) {
			continue;
		}
		const declaration = property.getValueDeclaration() ?? property.getDeclarations()[0];
		const propertyType = declaration
			? property.getTypeAtLocation(declaration)
				: property.getDeclaredType();
		const { types, optional } = splitUndefined(propertyType);
		headers[name] = {
			required: !optional && !property.isOptional(),
			schema: generator.getSchemaFor(types),
		};
	}

	return Object.keys(headers).length > 0 ? headers : undefined;
}

function extractResponses(type: Type, generator: SchemaGenerator): ResponseRepresentation[] {
	const queue: Type[] = [type];
	const results: ResponseRepresentation[] = [];

	while (queue.length > 0) {
		const current = queue.pop();
		if (!current) {
			continue;
		}

		if (current.isUnion()) {
			queue.push(...current.getUnionTypes());
			continue;
		}

			const symbol = current.getSymbol();
			if (symbol?.getName() === "Promise") {
				const args = current.getTypeArguments();
				const promiseInner = args[0];
				if (promiseInner) {
					queue.push(promiseInner);
				}
				continue;
			}

		if (symbol?.getName() === "JsonResponse") {
			const [statusArg, bodyArg, headersArg] = current.getTypeArguments();
			const status = statusArg?.isNumberLiteral()
				? String(statusArg.getLiteralValue())
				: "default";
			const bodySplit = bodyArg ? splitUndefined(bodyArg) : { types: [], optional: false };
			const hasBody = bodySplit.types.length > 0 && !bodySplit.types.every((t) => t.isUndefined());
			const response: ResponseRepresentation = {
				status,
				description: `HTTP ${status}`,
			};
			if (hasBody) {
				response.schema = generator.getSchemaFor(bodySplit.types);
			}
			const headers = headersArg ? headersFromType(headersArg, generator) : undefined;
			if (headers) {
				response.headers = headers;
			}
			results.push(response);
			continue;
		}
	}

	return results;
}

function buildParameters(type: Type | undefined, location: "query" | "header" | "path", generator: SchemaGenerator): ParameterRepresentation[] {
	if (!type || type.isAny() || type.isUnknown()) {
		return [];
	}

	const properties = type.getProperties();
	if (properties.length === 0 && !type.getStringIndexType()) {
		return [];
	}

	const parameters: ParameterRepresentation[] = [];

	for (const property of properties) {
		const name = cleanSymbolName(property);
		if (!name) {
			continue;
		}
		const declaration = property.getValueDeclaration() ?? property.getDeclarations()[0];
		const propertyType = declaration
			? property.getTypeAtLocation(declaration)
			: property.getDeclaredType();
		const { types, optional } = splitUndefined(propertyType);
		parameters.push({
			name,
			in: location,
			required: location === "path" ? true : !optional && !property.isOptional(),
			schema: generator.getSchemaFor(types),
		});
	}

	return parameters;
}

function addPathParameters(pathValue: string, parameters: ParameterRepresentation[]): ParameterRepresentation[] {
	const pathParams = new Set(parameters.filter((param) => param.in === "path").map((param) => param.name));
	const matches = pathValue.match(/:([A-Za-z0-9_]+)/g) ?? [];

	for (const match of matches) {
		const name = match.slice(1);
		if (!pathParams.has(name)) {
			parameters.push({
				name,
				in: "path",
				required: true,
				schema: { type: "string" },
			});
		}
	}

	return parameters;
}

function extractRequest(type: Type | undefined, generator: SchemaGenerator, pathValue: string): RequestRepresentation {
	if (!type) {
		return { parameters: [] };
	}

	const args = type.getTypeArguments();
	const [headerType, paramsType, queryType, bodyType] = args;

	let parameters: ParameterRepresentation[] = [];
	parameters = parameters.concat(buildParameters(headerType, "header", generator));
	parameters = parameters.concat(buildParameters(paramsType, "path", generator));
	parameters = parameters.concat(buildParameters(queryType, "query", generator));
	parameters = addPathParameters(pathValue, parameters);

	let requestBody: RequestRepresentation["requestBody"];
	if (bodyType) {
		const { types, optional } = splitUndefined(bodyType);
		const meaningful = types.filter((t) => !isTrivialRequestComponent(t));
		if (meaningful.length > 0) {
			requestBody = {
				required: !optional,
				schema: generator.getSchemaFor(meaningful),
			};
		}
	}

	const request: RequestRepresentation = { parameters };
	if (requestBody) {
		request.requestBody = requestBody;
	}
	return request;
}

function collectNodeInfo(nodeType: Type): RouteNodeInfo {
	const args = nodeType.getTypeArguments();
	if (args.length < 3) {
		throw new Error("Invalid JsonRouteNode type encountered while building OpenAPI document");
	}
	const [pathArg, handlersArg, childrenArg] = args as [Type, Type, Type];
	const pathValue = getLiteralString(pathArg) ?? "/";
	const handlers = handlersArg.getProperties();

	let children: Type[] = [];
	if (childrenArg) {
		const element = childrenArg.getArrayElementType();
		if (element) {
			children = element.isUnion() ? element.getUnionTypes() : [element];
		}
	}

	return {
		path: pathValue,
		handlers,
		children,
	};
}

function traverseRoutes(
	nodeType: Type,
	basePath: string,
	builder: OpenApiBuilder,
	schemaGenerator: SchemaGenerator,
	internalServerErrorResponse?: ResponseRepresentation,
	validationErrorResponse?: ResponseRepresentation
) {
	const info = collectNodeInfo(nodeType);
	const currentPath = joinPaths(basePath, info.path);

	for (const handler of info.handlers) {
		const method = handler.getName();
		const declaration = handler.getValueDeclaration() ?? handler.getDeclarations()[0];
		const handlerType = declaration
			? handler.getTypeAtLocation(declaration)
			: handler.getDeclaredType();
		const [responseType, requestType] = handlerType.getTypeArguments();

		const responses = responseType ? extractResponses(responseType, schemaGenerator) : [];
		if (internalServerErrorResponse) {
			responses.push(cloneResponse(internalServerErrorResponse));
		}
		if (validationErrorResponse && hasRequestValidation(requestType)) {
			responses.push(cloneResponse(validationErrorResponse));
		}
		const request = extractRequest(requestType, schemaGenerator, currentPath);

		builder.addOperation({
			method,
			path: currentPath,
			operationId: createOperationId(method, currentPath),
			request,
			responses,
		});
	}

	for (const child of info.children) {
		traverseRoutes(
			child,
			currentPath,
			builder,
			schemaGenerator,
			internalServerErrorResponse,
			validationErrorResponse
		);
	}
}

async function main() {
	const args = parseArgs(process.argv);
	const cwd = process.cwd();
	const repoRoot = path.resolve(__dirname, "..");
	const sourcePath = path.resolve(cwd, args.sourcePath);
	const outputPath = args.outputPath
		? path.resolve(cwd, args.outputPath)
		: path.join(path.dirname(sourcePath), `${args.variableName}.openapi.json`);

	const project = new Project({
		tsConfigFilePath: path.resolve(repoRoot, "tsconfig.json"),
	});

	const sourceFile = project.getSourceFile(sourcePath);
	if (!sourceFile) {
		throw new Error(`Unable to find source file: ${sourcePath}`);
	}

	const variableDeclaration = sourceFile.getVariableDeclaration(args.variableName);
	if (!variableDeclaration) {
		throw new Error(`Variable '${args.variableName}' not found in ${sourcePath}`);
	}

	const xprvAppType = variableDeclaration.getType();
	const typeArguments = xprvAppType.getTypeArguments();
	if (typeArguments.length < 5) {
		throw new Error(`Variable '${args.variableName}' does not appear to be an XPRVApp instance.`);
	}

	const [rootNodeType, internalErrorType, notFoundType, methodNotAllowedType, validationErrorType] =
		typeArguments as [Type, Type, Type, Type, Type];

	const schemaGenerator = new SchemaGenerator();

	const internalResponses = extractResponses(internalErrorType, schemaGenerator);
	const validationResponses = extractResponses(validationErrorType, schemaGenerator);
	const notFoundResponses = extractResponses(notFoundType, schemaGenerator);
	const methodNotAllowedResponses = extractResponses(methodNotAllowedType, schemaGenerator);

	const internalServerErrorResponse =
		findResponseByStatus(internalResponses, "500", "Internal Server Error") ??
		(internalResponses[0] ? cloneResponse(internalResponses[0]) : undefined);
	const validationErrorResponse = findResponseByStatus(
		validationResponses,
		"400",
		"Validation Error"
	);
	const notFoundResponse = findResponseByStatus(notFoundResponses, "404", "Not Found");
	const methodNotAllowedResponse = findResponseByStatus(
		methodNotAllowedResponses,
		"405",
		"Method Not Allowed"
	);

	const builder = new OpenApiBuilder();

	traverseRoutes(
		rootNodeType,
		"",
		builder,
		schemaGenerator,
		internalServerErrorResponse,
		validationErrorResponse
	);

	const responseComponents: Record<string, unknown> = {};
	if (notFoundResponse) {
		responseComponents.NotFound = responseRepresentationToObject(notFoundResponse);
	}
	if (methodNotAllowedResponse) {
		responseComponents.MethodNotAllowed = responseRepresentationToObject(methodNotAllowedResponse);
	}
	const components: Record<string, unknown> = {
		schemas: schemaGenerator.getComponents(),
	};
	if (validationErrorResponse) {
		responseComponents.ValidationError = responseRepresentationToObject(validationErrorResponse);
	}
	if (Object.keys(responseComponents).length > 0) {
		components.responses = responseComponents;
	}

	const openApiDocument = {
		openapi: "3.1.0",
		info: {
			title: args.variableName,
			version: "1.0.0",
		},
		paths: builder.getPaths(),
		components,
	};

	await fs.mkdir(path.dirname(outputPath), { recursive: true });
	await fs.writeFile(outputPath, `${JSON.stringify(openApiDocument, null, 2)}\n`, "utf8");

	const relativeOutput = path.relative(cwd, outputPath);
	console.log(`Wrote OpenAPI document to ${relativeOutput}`);
}

main().catch((error) => {
	if (!process.exitCode) {
		process.exitCode = 1;
	}
	console.error(error instanceof Error ? error.message : error);
});
