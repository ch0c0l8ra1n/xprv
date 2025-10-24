import { JsonRouteNode } from "./json-route-node";
import { JsonResponse } from "./json-response";
import { buildRouter } from "./xprv-express";
import {
	defaultOnInternalServerError,
	defaultOnNotFound,
	defaultOnMethodNotAllowed,
	defaultOnValidationError,
} from "./xprv-default-error-handlers";
import express from "express";
import {
	ErrorHandlers,
	InternalServerErrorHandler,
	MethodNotAllowedHandler,
	NotFoundHandler,
	ValidationErrorHandler,
} from "./types/error-handlers";

// The default types for the error handlers should be derived from the default error handlers


export interface XPRVAppOptions<
	TRootNode extends JsonRouteNode<any, any, any> = JsonRouteNode<
		any,
		any,
		any
	>,
	TInternal extends JsonResponse<any, any, any> = ReturnType<typeof defaultOnInternalServerError>,
	TNotFound extends JsonResponse<any, any, any> = ReturnType<typeof defaultOnNotFound>,
	TMethodNotAllowed extends JsonResponse<any, any, any> = ReturnType<typeof defaultOnMethodNotAllowed>,
	TValidationError extends JsonResponse<any, any, any> = ReturnType<typeof defaultOnValidationError>,
	> {
	rootNode: TRootNode;
	errorHandlers?: Partial<
		ErrorHandlers<TInternal, TNotFound, TMethodNotAllowed, TValidationError>
	>;
}

export class XPRVApp<
	TRootNode extends JsonRouteNode<any, any, any> = JsonRouteNode<any, any, any>,
	TInternal extends JsonResponse<any, any, any> = ReturnType<typeof defaultOnInternalServerError>,
	TNotFound extends JsonResponse<any, any, any> = ReturnType<typeof defaultOnNotFound>,
	TMethodNotAllowed extends JsonResponse<any, any, any> = ReturnType<typeof defaultOnMethodNotAllowed>,
	TValidationError extends JsonResponse<any, any, any> = ReturnType<typeof defaultOnValidationError>,
> {
	rootNode: TRootNode;
	errorHandlers: ErrorHandlers<
		TInternal,
		TNotFound,
		TMethodNotAllowed,
		TValidationError
	>;

	constructor(
		options: XPRVAppOptions<
			TRootNode,
			TInternal,
			TNotFound,
			TMethodNotAllowed,
			TValidationError
		>
	) {
		this.rootNode = options.rootNode;
		this.errorHandlers = {
			onInternalServerError:
				options.errorHandlers?.onInternalServerError ??
				defaultOnInternalServerError as InternalServerErrorHandler<TInternal>,
			onNotFound: options.errorHandlers?.onNotFound ?? defaultOnNotFound as NotFoundHandler<TNotFound>,
			onMethodNotAllowed:
				options.errorHandlers?.onMethodNotAllowed ??
				defaultOnMethodNotAllowed as MethodNotAllowedHandler<TMethodNotAllowed>,
			onValidationError:
				options.errorHandlers?.onValidationError ??
				defaultOnValidationError as ValidationErrorHandler<TValidationError>,
		};
	}

  buildRouter(){
    const router = express.Router();
    router.use(express.json());
    router.use(buildRouter({
      rootNode: this.rootNode,
      errorHandlers: this.errorHandlers,
    }));
    router.use((req, res, next) => {
			res.status(404).json(this.errorHandlers.onNotFound(req, res).body);
		});
    return router;
  }
}

export function app<
	TRootNode extends JsonRouteNode<any, any, any> = JsonRouteNode<any, any, any>,
	TInternal extends JsonResponse<any, any, any> = ReturnType<typeof defaultOnInternalServerError>,
	TNotFound extends JsonResponse<any, any, any> = ReturnType<typeof defaultOnNotFound>,
	TMethodNotAllowed extends JsonResponse<any, any, any> = ReturnType<typeof defaultOnMethodNotAllowed>,
	TValidationError extends JsonResponse<any, any, any> = ReturnType<typeof defaultOnValidationError>,
>(options: XPRVAppOptions<TRootNode, TInternal, TNotFound, TMethodNotAllowed, TValidationError>) {
	return new XPRVApp<TRootNode, TInternal, TNotFound, TMethodNotAllowed, TValidationError>(options);
}