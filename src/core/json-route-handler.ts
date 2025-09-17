import { z } from "zod";
import { JsonResponse } from "./json-reponse";



export interface JsonIncomingSchemas<H, P, Q, B> {
    headers: z.ZodType<H>;
    params: z.ZodType<P>;
    query: z.ZodType<Q>;
    body: z.ZodType<B>;
}

export interface JsonRouteHandlerOptions<JR extends JsonResponse<any, any, any>, H, P, Q, B> {
    schemas: Partial<JsonIncomingSchemas<H, P, Q, B>>;
    method: (incoming: {
        headers: H;
        params: P;
        query: Q;
        body: B;
    }) => Promise<JR>;
}

export class JsonRouteHandler<JR extends JsonResponse<any, any, any>, H, P, Q, B> {
    schemas: Partial<JsonIncomingSchemas<H, P, Q, B>>;
    method: (incoming: {
        headers: H;
        params: P;
        query: Q;
        body: B;
    }) => Promise<JR>;

    constructor(options: JsonRouteHandlerOptions<JR, H, P, Q, B>) {
        this.schemas = options.schemas;
        this.method = options.method;
    }
}


const jrh = new JsonRouteHandler({
    schemas: {
        headers: z.object({
            dummyHeader: z.string().optional()
        }),
    },
    method: async ({headers, params, query, body}) => {
        if (headers.dummyHeader) {
            return new JsonResponse({ status: 200, body: { message: "Dummy" } })
        }
        return new JsonResponse({ status: 400, body: { error: "Bad Request" } })
    }
});

const jrh2 = new JsonRouteHandler({
    schemas: {
        headers: z.object({
            dummyHeader: z.string().optional()
        }),
    },
    method: async ({headers, params, query, body}) => {
        const j = new JsonResponse({ status: 200, body: { message: "Dummy" } })
        return j;
    }
});