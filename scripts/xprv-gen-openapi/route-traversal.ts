import { Type } from "ts-morph";
import { SchemaGenerator } from "./schema-generator.js";
import { OpenApiBuilder, cloneResponse } from "./openapi-builder.js";
import { cleanSymbolName, joinPaths, getLiteralString, createOperationId } from "./utils.js";
import { splitUndefined, isTrivialRequestComponent, hasRequestValidation } from "./type-utils.js";
import type { 
	RouteNodeInfo, 
	ResponseRepresentation, 
	RequestRepresentation,
	ParameterRepresentation 
} from "./types.js";

export function headersFromType(
	type: Type, 
	generator: SchemaGenerator
): ResponseRepresentation["headers"] {
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

export function extractResponses(type: Type, generator: SchemaGenerator): ResponseRepresentation[] {
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

export function buildParameters(
	type: Type | undefined, 
	location: "query" | "header" | "path", 
	generator: SchemaGenerator
): ParameterRepresentation[] {
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

export function addPathParameters(
	pathValue: string, 
	parameters: ParameterRepresentation[]
): ParameterRepresentation[] {
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

export function extractRequest(
	type: Type | undefined, 
	generator: SchemaGenerator, 
	pathValue: string
): RequestRepresentation {
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

export function collectNodeInfo(nodeType: Type): RouteNodeInfo {
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

export function traverseRoutes(
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

