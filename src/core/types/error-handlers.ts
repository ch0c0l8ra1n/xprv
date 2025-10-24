import { JsonResponse } from "../json-response";
import express from "express";
import { ZodError } from "zod";


export type InternalServerErrorHandler<TResponse extends JsonResponse<any, any, any>> = (
    error: unknown,
    req: express.Request,
    res: express.Response
) => TResponse;

export type NotFoundHandler<TResponse extends JsonResponse<any, any, any>> = (
    req: express.Request,
    res: express.Response
) => TResponse;

export type MethodNotAllowedHandler<TResponse extends JsonResponse<any, any, any>> = (
    req: express.Request,
    res: express.Response
) => TResponse;

export type ValidationErrorHandler<TResponse extends JsonResponse<any, any, any>> = (
    where: "headers" | "query" | "params" | "body",
    error: ZodError,
    req: express.Request,
    res: express.Response
) => TResponse;


// a collection of error handlers with typed responses
// for each
export type ErrorHandlers<
    TInternal extends JsonResponse<any, any, any> = JsonResponse<any, any, any>, 
    TNotFound extends JsonResponse<any, any, any> = JsonResponse<any, any, any>, 
    TMethodNotAllowed extends JsonResponse<any, any, any> = JsonResponse<any, any, any>, 
    TValidationError extends JsonResponse<any, any, any> = JsonResponse<any, any, any>
> = {
    onInternalServerError: InternalServerErrorHandler<TInternal>;
    onNotFound: NotFoundHandler<TNotFound>;
    onMethodNotAllowed: MethodNotAllowedHandler<TMethodNotAllowed>;
    onValidationError: ValidationErrorHandler<TValidationError>;
}