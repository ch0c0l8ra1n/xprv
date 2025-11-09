import { JsonRouteNode } from "./json-route-node";
import express from "express";
import { HttpMethod } from "./types/http";
import { JsonRouteHandler } from "./json-route-handler";
import { JsonResponse } from "./json-response";
import { ErrorHandlers } from "./types/error-handlers";

export function attachHandlerToRouter(
	method: HttpMethod,
	router: express.Router,
	handler: JsonRouteHandler<any, any, any>,
	errorHandlers: ErrorHandlers
) {
	router[method]("/", async (req, res) => {
		// parse the headers, query, params, and body

		const headersResult = handler.schemas.headers.safeParse(req.headers || {});
		const queryResult = handler.schemas.query.safeParse(req.query || {});
		const paramsResult = handler.schemas.params.safeParse(req.params || {});
		const bodyResult = handler.schemas.body.safeParse(req.body || {});


		if (!headersResult.success) {
			const response = errorHandlers.onValidationError(
				"headers",
				headersResult.error,
				req,
				res
			);
			res.status(response.status)
				.setHeaders(new Map(Object.entries(response.headers)))
				.json(response.body);
			return;
		}
		if (!queryResult.success) {
			const response = errorHandlers.onValidationError(
				"query",
				queryResult.error,
				req,
				res
			);
			res.status(response.status)
				.setHeaders(new Map(Object.entries(response.headers)))
				.json(response.body);
			return;
		}
		if (!paramsResult.success) {
			const response = errorHandlers.onValidationError(
				"params",
				paramsResult.error,
				req,
				res
			);
			res.status(response.status)
				.setHeaders(new Map(Object.entries(response.headers)))
				.json(response.body);
			return;
		}
		if (!bodyResult.success) {
			const response = errorHandlers.onValidationError(
				"body",
				bodyResult.error,
				req,
				res
			);
			res.status(response.status)
				.setHeaders(new Map(Object.entries(response.headers)))
				.json(response.body);
			return;
		}

		const headers = headersResult.data;
		const query = queryResult.data;
		const params = paramsResult.data;
		const body = bodyResult.data;
		const context = handler.contextProvider(req, res);

		try {
			const response = await handler.method(
				{ headers, query, params, body },
				context
			);

			const {
				status,
				body: responseBody,
				headers: responseHeaders,
			} = response;
			res.status(status)
				.setHeaders(new Map(Object.entries(responseHeaders)))
				.json(responseBody);
		} catch (error) {
			const response = errorHandlers.onInternalServerError(
				error,
				req,
				res
			);
			res.status(response.status)
				.setHeaders(new Map(Object.entries(response.headers)))
				.json(response.body);

			return;
		}
	});
}

export interface BuildRouterOptions {
	errorHandlers: ErrorHandlers;
	rootNode: JsonRouteNode<any, any, any>;
}

export function buildRouter({ rootNode, errorHandlers }: BuildRouterOptions) {
	const router = express.Router();
	for (const method of Object.keys(rootNode.handlers) as HttpMethod[]) {
		attachHandlerToRouter(
			method as HttpMethod,
			router,
			rootNode.handlers[method as HttpMethod],
			errorHandlers
		);
	}

	// If there is at least one handler, rest should be method not allowed
	// The 404 handler will catch it otherwise
	if (Object.keys(rootNode.handlers).length > 0) {
		router.all("/", (req, res) => {
			const response = errorHandlers.onMethodNotAllowed(req, res);
			res.status(response.status)
				.setHeaders(new Map(Object.entries(response.headers)))
				.json(response.body);

			return;
		});
	}

	for (const child of rootNode.children) {
		router.use(child.path, buildRouter({ rootNode: child, errorHandlers }));
	}

	return router;
}
