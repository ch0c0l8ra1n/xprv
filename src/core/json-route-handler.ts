import { JsonResponse } from "./json-reponse";
import { Request } from "express";
import { z } from "zod";

interface JsonIncomingSchemas<H, P, Q, B>{
    headers: z.ZodType<H>;
    params: z.ZodType<P>;
    query: z.ZodType<Q>;
    body: z.ZodType<B>;
}

export type JsonHandlerMethod<JR extends JsonResponse<number, any, any>, H, P, Q, B> = (incoming: {
    headers: H;
    params: P;
    query: Q;
    body: B;
}) => Promise<JR>;

export interface JsonRouteHandlerOptions<JR extends JsonResponse<number, any, any>, H, P, Q, B>{
    schemas: Partial<JsonIncomingSchemas<H, P, Q, B>>;
    method: JsonHandlerMethod<JR, H, P, Q, B>;
    onValidationError?: (error: z.ZodError) => JR;
}

export class JsonRouteHandler<JR extends JsonResponse<any, any, any>, H, P, Q, B>{
    public schemas: JsonIncomingSchemas<H, P, Q, B>;
    public method: JsonHandlerMethod<JR, H, P, Q, B>;
    public onValidationError?: (error: z.ZodError) => JsonResponse<any, any, any>;

    constructor(options: JsonRouteHandlerOptions<JR, H, P, Q, B>){
        this.schemas = {
            headers: options.schemas.headers || z.any(),
            params: options.schemas.params || z.any(),
            query: options.schemas.query || z.any(),
            body: options.schemas.body || z.any(),
        };
        this.method = options.method;
        if (options.onValidationError) {
            this.onValidationError = options.onValidationError;
        }
    }

    public handleValidationError(error: z.ZodError): JsonResponse<any, any, any> {
        return new JsonResponse({ status: 400, body: { error: error.message } });
    }

    public validateRequest(req: Request): {
        headers: H;
        params: P;
        query: Q;
        body: B;
    } {
        return {
            headers: this.schemas.headers.parse(req.headers),
            params: this.schemas.params.parse(req.params),
            query: this.schemas.query.parse(req.query),
            body: this.schemas.body.parse(req.body),
        };
    }

    static create<H, P, Q, B>(schemas: JsonIncomingSchemas<H, P, Q, B>){
        return <JR extends JsonResponse<any, any, any>>(method: JsonHandlerMethod<JR, H, P, Q, B>) => {
            return new JsonRouteHandler<JR, H, P, Q, B>({ schemas, method: method });
        }
    }
}

export type RouteMethod = "get" | "post" | "put" | "delete" | "patch" | "options" | "head";


export type JsonRouteHandlers = {
    [key in RouteMethod]?: JsonRouteHandler<JsonResponse<number, any,any>, any, any, any, any>;
}

const jrh = JsonRouteHandler.create({
    headers: z.object({
        dummyHeader: z.string().optional()
    }),
    params: z.object({
        dummyParam: z.string().optional()
    }),
    query: z.object({
        dummyQuery: z.string().optional()
    }),
    body: z.object({
        dummyBody: z.string().optional()
    })
})(async ({headers, params, query, body}) => {
    if (headers.dummyHeader) {
        return new JsonResponse({ status: 200, body: { message: "Dummy" } });
    } else {
        return new JsonResponse({ status: 400, body: { error: "Dummy" } });
    }
});