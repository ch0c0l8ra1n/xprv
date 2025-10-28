import type { OperationRepresentation, ResponseRepresentation } from "./types.js";

export function responseRepresentationToObject(response: ResponseRepresentation): Record<string, unknown> {
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

export function cloneResponse(response: ResponseRepresentation): ResponseRepresentation {
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

export function findResponseByStatus(
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

export class OpenApiBuilder {
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

