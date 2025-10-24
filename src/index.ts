import {handler} from "./core/json-route-handler-builder";
import {json} from './core/json-response'
import {node} from './core/json-route-node'
import z from "zod";
import {Client} from './client/client'
import type { FlattenRouteTree, FlattenRouteTreeToArray } from './client/flatten-route-tree';
import { app } from "./core/xprv-app";

const xprv = {
    handler,
    json,
    node,
    z,
    app,
    Client
}

export default xprv;


export type {
    FlattenRouteTree,
    FlattenRouteTreeToArray,
}