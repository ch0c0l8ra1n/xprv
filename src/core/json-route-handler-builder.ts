import { json, JsonResponse } from "./json-response";
import { JsonRouteHandler, JsonRouteHandlerOptions } from "./json-route-handler";
import { JsonRequest, JsonSchemas } from "./types/input";
import { Request, Response } from "express";
import z from "zod";

export interface JsonRouteHandlerBuilderOptions<
    TInput extends JsonRequest<unknown, unknown, unknown, unknown>,
    TContext = {}
> {
    contextProvider?: (request: Request, response: Response) => TContext;
    schemas?: JsonSchemas<TInput['headers'], TInput['params'], TInput['query'], TInput['body']>;    
}

export class JsonRouteHandlerBuilder<
    const TResponse extends JsonResponse<any, any, any>,
    TInput extends JsonRequest<unknown, unknown, unknown, unknown>,
    TContext = {}
> {

    contextProvider: (request: Request, response: Response) => TContext;
    schemas: JsonSchemas<TInput['headers'], TInput['params'], TInput['query'], TInput['body']>;

    constructor(options: JsonRouteHandlerBuilderOptions<TInput, TContext>) {
        this.contextProvider = options.contextProvider ?? (() => ({} as TContext));
        this.schemas = {
            headers: options.schemas?.headers ?? z.unknown(),
            params: options.schemas?.params ?? z.unknown(),
            query: options.schemas?.query ?? z.unknown(),
            body: options.schemas?.body ?? z.unknown()
        }
    }

    withContextProvider<TNewContext>(
        contextProvider: (request: Request, response: Response) => TNewContext
    ):JsonRouteHandlerBuilder<TResponse, TInput, TNewContext> {
        return new JsonRouteHandlerBuilder<TResponse, TInput, TNewContext>({
            schemas: this.schemas,
            contextProvider: contextProvider
        });
    }

    withInput<H,P,Q,B>(
        schemas: Partial<JsonSchemas<H,P,Q,B>>
    ):JsonRouteHandlerBuilder<TResponse, JsonRequest<H,P,Q,B>, TContext> {
        return new JsonRouteHandlerBuilder<TResponse, JsonRequest<H,P,Q,B>, TContext>({
            contextProvider: this.contextProvider,
            schemas: {
                headers: schemas.headers ?? z.unknown() as z.ZodType<H, H>,
                params: schemas.params ?? z.unknown() as z.ZodType<P, P>,
                query: schemas.query ?? z.unknown() as z.ZodType<Q, Q>,
                body: schemas.body ?? z.unknown() as z.ZodType<B, B>
            }
        });
    }
    
    handle<JRes extends JsonResponse<any,any,any>>(
        method: (input: TInput, context: TContext) => JRes
    ):JsonRouteHandler<JRes, TInput, TContext> {
        return {
            contextProvider: this.contextProvider,
            schemas: this.schemas,
            method
        }
    }


    static withContextProvider<TNewContext>(
        contextProvider: (request: Request, response: Response) => TNewContext
    ) {
        return new JsonRouteHandlerBuilder({})
            .withContextProvider(contextProvider);
    }
    
    static withInput<H,P,Q,B>(schemas: Partial<JsonSchemas<H,P,Q,B>>) {
        return new JsonRouteHandlerBuilder({})
            .withInput(schemas);
    }

    static handle<
    const TResponse extends JsonResponse<any,any,any>
    >(method: (input: JsonRequest<unknown, unknown, unknown, unknown>, context: {}) => TResponse) {
        const builder = new JsonRouteHandlerBuilder({});
        return builder.handle(method)
    }
}

const builder = new JsonRouteHandlerBuilder({})
    .withInput({
        headers: z.object({
            authorization: z.string()
        }),
        params: z.unknown(),
        query: z.unknown(),
        body: z.unknown()
    })
    .handle((input, context) => {
        return json({
            status: 200,
            body: {
                message: "Hello, world!"
            }
        })
    })

export const handler = {
    withContextProvider: JsonRouteHandlerBuilder.withContextProvider,
    withInput: JsonRouteHandlerBuilder.withInput,
    handle: JsonRouteHandlerBuilder.handle
}