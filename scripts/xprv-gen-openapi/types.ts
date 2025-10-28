import type { Symbol as MorphSymbol, Type } from "ts-morph";

export interface CliArgs {
	sourcePath: string;
	variableName: string;
	outputPath?: string;
	tsconfigPath?: string;
}

export interface ParameterRepresentation {
	name: string;
	in: "query" | "header" | "path";
	required: boolean;
	schema: unknown;
}

export interface ResponseRepresentation {
	status: string;
	description: string;
	schema?: unknown;
	headers?: Record<string, { required?: boolean; schema: unknown }>;
}

export interface RequestRepresentation {
	parameters: ParameterRepresentation[];
	requestBody?: {
		required: boolean;
		schema: unknown;
	};
}

export interface OperationRepresentation {
	method: string;
	path: string;
	operationId: string;
	request: RequestRepresentation;
	responses: ResponseRepresentation[];
}

export interface RouteNodeInfo {
	path: string;
	handlers: MorphSymbol[];
	children: Type[];
}

