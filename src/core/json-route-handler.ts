import { JsonResponse } from "./json-response";
import { JsonRequest, JsonSchemas } from "./types/input";
import { Request, Response } from "express";


export interface JsonRouteHandlerOptions<
    TResponse extends JsonResponse<any, any, any>,
    TInput extends JsonRequest<any, any, any, any>,
    TContext = {}
> {
    contextProvider: (request: Request, response: Response) => TContext;
    schemas: JsonSchemas<TInput['headers'], TInput['params'], TInput['query'], TInput['body']>;
    method: (input: TInput, context: TContext) => Promise<TResponse>;
}


export interface JsonRouteHandler<
    TResponse extends JsonResponse<any, any, any>,
    TInput extends JsonRequest<any, any, any, any>,
    TContext = {}
> {
    contextProvider: (request: Request, response: Response) => TContext;
    schemas: JsonSchemas<TInput['headers'], TInput['params'], TInput['query'], TInput['body']>;
    method: (input: TInput, context: TContext) => Promise<TResponse>;
}