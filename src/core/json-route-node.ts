import { JsonRouteHandler, JsonRouteHandlers } from "./json-route-handler";
import {z} from "zod";
import { JsonResponse } from "./json-reponse";

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

    headers.dummyHeader;
    return new JsonResponse({ status: 200, body: { message: "Dummy" } });
});