import {handler} from "./core/json-route-handler-builder";
import {json, JsonResponse, JsonOptions} from './core/json-response'
import {node, JsonRouteNode, JsonRouteHandlers, JsonRouteNodeOptions} from './core/json-route-node'
import {JsonRouteHandler} from './core/json-route-handler'
import {JsonRequest} from './core/types/input'
import type { FlattenRouteTree, FlattenRouteTreeToArray } from './client/flatten-route-tree';
import { app } from "./core/xprv-app";

const xprv = {
    handler,
    json,
    node,
    app,
}

export default xprv;


export type {
    FlattenRouteTree,
    FlattenRouteTreeToArray,
    JsonResponse,
    JsonOptions,
    JsonRequest,
    JsonRouteHandler,
    JsonRouteNode,
    JsonRouteHandlers,
    JsonRouteNodeOptions,
}