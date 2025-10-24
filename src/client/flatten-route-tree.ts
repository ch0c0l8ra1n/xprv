import { JsonRouteNode, JsonRouteHandlers } from "../core/json-route-node";

/**
 * Utility type to join two path segments
 * Handles edge cases like root path "/" and empty base path, ensures proper path formatting
 */
type JoinPaths<TParent extends string, TChild extends string> = 
    TParent extends ""
        ? TChild
        : TParent extends "/" 
            ? TChild
            : TChild extends "/"
                ? TParent
                : `${TParent}${TChild}`;

/**
 * Check if a handlers object is empty (has no methods defined)
 */
type IsEmptyHandlers<THandlers> = [keyof THandlers] extends [never] ? true : false;

/**
 * Helper to distribute over array elements
 * Converts an array type to a union of its elements
 */
type ArrayToUnion<T extends readonly any[]> = T[number];

/**
 * Flatten all children in an array by distributing over the union
 * This uses distributive conditional types to process each child separately
 */
type FlattenChildren<
    TChildren extends readonly JsonRouteNode<any, any, any>[],
    TBasePath extends string
> = TChildren[number] extends JsonRouteNode<any, any, any>
    ? UnionToIntersection<
        TChildren[number] extends infer TChild
            ? TChild extends JsonRouteNode<any, any, any>
                ? FlattenNodeWithHandlers<TChild, TBasePath>
                : never
            : never
      >
    : {};

/**
 * Convert a union type to an intersection type
 * This is needed to merge multiple flattened route records into one
 */
type UnionToIntersection<U> = 
    (U extends any ? (x: U) => void : never) extends (x: infer I) => void 
        ? I 
        : never;

/**
 * Extract all leaf nodes (nodes with handlers) from a JsonRouteNode tree
 * Returns a record mapping full paths to their respective node types
 */
type FlattenNodeWithHandlers<
    TNode extends JsonRouteNode<any, any, any>,
    TBasePath extends string = ""
> = TNode extends JsonRouteNode<infer TPath, infer THandlers, infer TChildren>
    ? (
        // Compute the full path for this node
        JoinPaths<TBasePath, TPath> extends infer TFullPath extends string
            ? (
                // If this node has handlers, include it in the result
                (IsEmptyHandlers<THandlers> extends true
                    ? {} 
                    : { [K in TFullPath]: JsonRouteNode<TFullPath, THandlers, []> }
                ) &
                // Recursively flatten all children
                FlattenChildren<TChildren, TFullPath>
            )
            : never
    )
    : never;

/**
 * Main utility type to flatten a JsonRouteNode tree
 * Returns a record of all paths to their node types
 * 
 * @example
 * ```typescript
 * const rootNode = xprv.node({
 *     path: "/",
 *     children: [
 *         xprv.node({
 *             path: "/utils",
 *             children: [
 *                 xprv.node({ path: "/ping", handlers: { get: ... } }),
 *                 xprv.node({ path: "/sum", handlers: { post: ... } })
 *             ]
 *         })
 *     ]
 * });
 * 
 * type Flattened = FlattenRouteTree<typeof rootNode>;
 * // Result: {
 * //     "/utils/ping": JsonRouteNode<"/utils/ping", { get: ... }, []>,
 * //     "/utils/sum": JsonRouteNode<"/utils/sum", { post: ... }, []>
 * // }
 * ```
 */
export type FlattenRouteTree<TNode extends JsonRouteNode<any, any, any>> = 
    FlattenNodeWithHandlers<TNode>;

// ============================================================
// Array/Tuple version of FlattenRouteTree
// ============================================================

/**
 * Collect all nodes with handlers into a union type
 */
type CollectNodesAsUnion<
    TNode extends JsonRouteNode<any, any, any>,
    TBasePath extends string = ""
> = TNode extends JsonRouteNode<infer TPath, infer THandlers, infer TChildren>
    ? (
        JoinPaths<TBasePath, TPath> extends infer TFullPath extends string
            ? (
                // This node if it has handlers
                (IsEmptyHandlers<THandlers> extends true
                    ? never
                    : JsonRouteNode<TFullPath, THandlers, []>
                ) |
                // Union of all children
                (TChildren[number] extends JsonRouteNode<any, any, any>
                    ? CollectNodesAsUnion<TChildren[number], TFullPath>
                    : never
                )
            )
            : never
    )
    : never;

/**
 * Convert a union type to a tuple type
 * Uses a trick with function overloading to preserve all union members
 */
type UnionToTuple<T> = UnionToIntersection<
    T extends any ? (t: T) => T : never
> extends (_: any) => infer W
    ? [...UnionToTuple<Exclude<T, W>>, W]
    : [];

/**
 * Flatten a JsonRouteNode tree into a tuple/array of all routes
 * Returns an array type containing all route nodes with their full paths
 * 
 * @example
 * ```typescript
 * const rootNode = xprv.node({
 *     path: "/",
 *     children: [
 *         xprv.node({
 *             path: "/utils",
 *             children: [
 *                 xprv.node({ path: "/ping", handlers: { get: ... } }),
 *                 xprv.node({ path: "/sum", handlers: { post: ... } })
 *             ]
 *         })
 *     ]
 * });
 * 
 * type FlattenedArray = FlattenRouteTreeToArray<typeof rootNode>;
 * // Result: [
 * //     JsonRouteNode<"/utils/ping", { get: ... }, []>,
 * //     JsonRouteNode<"/utils/sum", { post: ... }, []>
 * // ]
 * ```
 */
export type FlattenRouteTreeToArray<TNode extends JsonRouteNode<any, any, any>> = 
    UnionToTuple<CollectNodesAsUnion<TNode>>;

// ============================================================
// Organize routes by HTTP method
// ============================================================

/**
 * Extract routes for a specific HTTP method from flattened routes array
 */
type RoutesForMethod<
    TRoutes extends readonly JsonRouteNode<any, any, any>[],
    TMethod extends string
> = {
    [K in keyof TRoutes]: TRoutes[K] extends JsonRouteNode<infer TPath, infer THandlers, any>
        ? TMethod extends keyof THandlers
            ? { path: TPath; handler: THandlers[TMethod] }
            : never
        : never
}[number];

/**
 * Filter out never types from array
 */
type FilterNever<T extends readonly any[]> = T extends readonly [infer First, ...infer Rest]
    ? First extends never
        ? FilterNever<Rest>
        : [First, ...FilterNever<Rest>]
    : [];

/**
 * Organize flattened routes by HTTP method
 * Returns an object with arrays of routes for each method
 * 
 * @example
 * ```typescript
 * type Organized = OrganizeRoutesByMethod<FlattenRouteTreeToArray<typeof rootNode>>;
 * // Result: {
 * //     get: [{ path: "/utils/ping", handler: ... }],
 * //     post: [{ path: "/utils/sum", handler: ... }],
 * //     put: [],
 * //     delete: [],
 * //     patch: []
 * // }
 * ```
 */
export type OrganizeRoutesByMethod<TRoutes> = TRoutes extends readonly JsonRouteNode<any, any, any>[]
    ? {
        get: RoutesForMethod<TRoutes, 'get'> extends never ? [] : RoutesForMethod<TRoutes, 'get'>[];
        post: RoutesForMethod<TRoutes, 'post'> extends never ? [] : RoutesForMethod<TRoutes, 'post'>[];
        put: RoutesForMethod<TRoutes, 'put'> extends never ? [] : RoutesForMethod<TRoutes, 'put'>[];
        delete: RoutesForMethod<TRoutes, 'delete'> extends never ? [] : RoutesForMethod<TRoutes, 'delete'>[];
        patch: RoutesForMethod<TRoutes, 'patch'> extends never ? [] : RoutesForMethod<TRoutes, 'patch'>[];
        options: RoutesForMethod<TRoutes, 'options'> extends never ? [] : RoutesForMethod<TRoutes, 'options'>[];
        head: RoutesForMethod<TRoutes, 'head'> extends never ? [] : RoutesForMethod<TRoutes, 'head'>[];
    }
    : never;

/**
 * Extract a specific route from a flattened route tree
 * Note: TPath should be a string that exists as a key in TFlattened
 */
export type GetRoute<
    TFlattened,
    TPath extends string
> = TPath extends keyof TFlattened ? TFlattened[TPath] : never;

/**
 * Get all available paths from a flattened route tree
 */
export type GetAllPaths<TFlattened> = keyof TFlattened;

/**
 * Extract handlers from a specific route
 */
export type GetHandlers<
    TFlattened,
    TPath extends string
> = GetRoute<TFlattened, TPath> extends JsonRouteNode<any, infer THandlers, any> 
    ? THandlers 
    : never;

/**
 * Extract a specific handler from a specific route and method
 */
export type GetHandler<
    TFlattened,
    TPath extends string,
    TMethod extends string
> = GetHandlers<TFlattened, TPath> extends infer H
    ? (TMethod extends keyof H ? H[TMethod] : never)
    : never;

