#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Project, Type } from "ts-morph";
import { parseArgs } from "./cli.js";
import { findTsConfig } from "./utils.js";
import { SchemaGenerator } from "./schema-generator.js";
import { OpenApiBuilder, findResponseByStatus, responseRepresentationToObject, cloneResponse } from "./openapi-builder.js";
import { extractResponses, traverseRoutes } from "./route-traversal.js";

async function main() {
	const args = parseArgs(process.argv);
	const cwd = process.cwd();
	const sourcePath = path.resolve(cwd, args.sourcePath);
	const outputPath = args.outputPath
		? path.resolve(cwd, args.outputPath)
		: path.join(cwd, `${args.variableName}.openapi.json`);

	// Determine tsconfig path
	let tsconfigPath: string | undefined;
	if (args.tsconfigPath) {
		tsconfigPath = path.resolve(cwd, args.tsconfigPath);
	} else {
		const sourceDir = path.dirname(sourcePath);
		tsconfigPath = findTsConfig(sourceDir);
	}

	if (!tsconfigPath) {
		throw new Error(
			`Unable to find tsconfig.json. Searched from ${path.dirname(sourcePath)} upwards. ` +
			`Specify one explicitly with --tsconfig <path>`
		);
	}

	// Load TypeScript project
	const project = new Project({
		tsConfigFilePath: tsconfigPath,
	});

	const sourceFile = project.getSourceFile(sourcePath);
	if (!sourceFile) {
		throw new Error(`Unable to find source file: ${sourcePath}`);
	}

	const variableDeclaration = sourceFile.getVariableDeclaration(args.variableName);
	if (!variableDeclaration) {
		throw new Error(`Variable '${args.variableName}' not found in ${sourcePath}`);
	}

	// Extract XPRVApp type arguments
	const xprvAppType = variableDeclaration.getType();
	const typeArguments = xprvAppType.getTypeArguments();
	if (typeArguments.length < 5) {
		throw new Error(`Variable '${args.variableName}' does not appear to be an XPRVApp instance.`);
	}

	const [rootNodeType, internalErrorType, notFoundType, methodNotAllowedType, validationErrorType] =
		typeArguments as [Type, Type, Type, Type, Type];

	// Initialize generators
	const schemaGenerator = new SchemaGenerator(tsconfigPath, sourcePath);

	// Extract error responses
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

	// Build OpenAPI document
	const builder = new OpenApiBuilder();

	traverseRoutes(
		rootNodeType,
		"",
		builder,
		schemaGenerator,
		internalServerErrorResponse,
		validationErrorResponse
	);

	// Build components
	const responseComponents: Record<string, unknown> = {};
	if (notFoundResponse) {
		responseComponents.NotFound = responseRepresentationToObject(notFoundResponse);
	}
	if (methodNotAllowedResponse) {
		responseComponents.MethodNotAllowed = responseRepresentationToObject(methodNotAllowedResponse);
	}
	if (validationErrorResponse) {
		responseComponents.ValidationError = responseRepresentationToObject(validationErrorResponse);
	}

	const components: Record<string, unknown> = {
		schemas: schemaGenerator.getComponents(),
	};
	if (Object.keys(responseComponents).length > 0) {
		components.responses = responseComponents;
	}

	// Generate final OpenAPI document
	const openApiDocument = {
		openapi: "3.1.0",
		info: {
			title: args.variableName,
			version: "1.0.0",
		},
		paths: builder.getPaths(),
		components,
	};

	// Write to file
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

