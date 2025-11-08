import z from "zod";
import { json } from "./json-response";
import { JsonRouteHandler } from "./json-route-handler";
import { handler } from "./json-route-handler-builder";
import { HttpMethod } from "./types/http";

export type JsonRouteHandlers = Partial<{
    [key in HttpMethod]: JsonRouteHandler<any, any, any>;
}>

export interface JsonRouteNode<
    TPath extends string,
    THandlers extends JsonRouteHandlers,
    TChildren extends JsonRouteNode<any, any, any>[],
> {
    path: TPath;
    handlers: THandlers;
    children: TChildren;
}


export interface JsonRouteNodeOptions<
    TPath extends string,
    THandlers extends JsonRouteHandlers,
    TChildren extends JsonRouteNode<any, any, any>[],
> {
    path: TPath;
    handlers?: THandlers;
    children?: TChildren;
}


export function node<
    TPath extends string,
    THandlers extends JsonRouteHandlers = {},
    TChildren extends JsonRouteNode<any, any, any>[] = [],
>(options: JsonRouteNodeOptions<TPath, THandlers, TChildren>)
    : JsonRouteNode<TPath, THandlers, TChildren> {
    return {
        path: options.path,
        handlers: options.handlers ?? {} as THandlers,
        children: options.children ?? [] as JsonRouteNode<any, any, any>[] as TChildren,
    }
}


const pingNode = node({
    path: "/ping",
    handlers: {
        get: handler.handle(async (input, context) => {
            return json({
                status: 200,
                body: {
                    message: "Pong"
                }
            })
        })
    }
});

const sumNode = node({
    path: "/sum",
    handlers: {
        post: handler
            .withInput({
                body: z.object({
                    a: z.number(),
                    b: z.number()
                })
            })
            .handle(async (input, context) => {
                return json({
                    status: 200,
                    body: {
                        message: "Sum",
                        result: input.body.a + input.body.b
                    }
                })
            })
    }
});


const utilsNode = node({
    path: "/utils",
    children: [pingNode, sumNode]
});


const rootNode = node({
    path: "/",
    children: [utilsNode]
});