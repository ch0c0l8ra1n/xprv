// src/core/json-route-node.ts

import { JsonRouteHandler } from "./json-route-handler";
import {z} from "zod";
import { JsonResponse } from "./json-reponse";

export type RouteHandlerMethod = "get" | "post" | "put" | "delete" | "patch" | "options" | "head";

export type JsonRouteHandlers = {
    [key in RouteHandlerMethod]: JsonRouteHandler<JsonResponse<any, any, any>, any, any, any, any>;
}

interface JsonRouteNodeOptions{
    children: JsonRouteNode[];
    handlers: Partial<JsonRouteHandlers>;
}

class JsonRouteNode{
    children: JsonRouteNode[];
    handlers: Partial<JsonRouteHandlers>;

    constructor(options: JsonRouteNodeOptions){
        this.children = options.children;
        this.handlers = options.handlers;
    }
}


const jrh = new JsonRouteHandler({
    schemas: {
        headers: z.object({
            dummyHeader: z.string().optional()
        }),
    },
    method: async ({headers, params, query, body}) => {
        return new JsonResponse({ status: 200, body: { message: "Dummy" } });
    }
});

const jrn = new JsonRouteNode({
    children: [],
    handlers: {
        get: new JsonRouteHandler({
            schemas: {
                headers: z.object({
                    dummyHeader: z.string().optional()
                }),
            },
            method: async ({headers, params, query, body}) => {
                return new JsonResponse({ status: 200, body: { message: "Dummy" } });
            }
        }),
        post: jrh
    }
});