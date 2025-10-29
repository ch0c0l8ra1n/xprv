import type { XPRVApp } from "../core/xprv-app";
import { JsonRouteNode } from "../core/json-route-node";
import { JsonResponse } from "../core/json-response";
import { JsonRouteHandler } from "../core/json-route-handler";
import { FlattenRouteTreeToArray, OrganizeRoutesByMethod } from "./flatten-route-tree";
import { HttpMethod } from "../core/types/http";
import { JsonRequest } from "../core/types/input";

// ============================================================
// Helper types for extracting routes by HTTP method
// ============================================================

/**
 * Extract the response type from a JsonRouteHandler
 */
type ExtractResponse<T> = T extends JsonRouteHandler<infer TResponse, any, any>
    ? TResponse
    : never;

/**
 * Extract the input type from a JsonRouteHandler
 */
type ExtractInput<T> = T extends JsonRouteHandler<any, infer TInput, any>
    ? TInput
    : never;

/**
 * Get all paths for a specific HTTP method as a union type
 */
type PathsForMethod<
    TOrganized,
    TMethod extends HttpMethod
> = TMethod extends keyof TOrganized
    ? TOrganized[TMethod] extends Array<infer R>
        ? R extends { path: infer P }
            ? P
            : never
        : never
    : never;

/**
 * Get the handler for a specific path and method
 */
type HandlerForPath<
    TOrganized,
    TMethod extends HttpMethod,
    TPath extends string
> = TMethod extends keyof TOrganized
    ? TOrganized[TMethod] extends Array<infer R>
        ? R extends { path: TPath; handler: infer H }
            ? H
            : never
        : never
    : never;

/**
 * Get the input type for a specific path and method
 */
type InputForPath<
    TOrganized,
    TMethod extends HttpMethod,
    TPath extends string
> = ExtractInput<HandlerForPath<TOrganized, TMethod, TPath>>;

// Tie client typing to the app configuration for richer error awareness.
type AppRootNode<TApp extends XPRVApp<any, any, any, any, any>> =
    TApp extends XPRVApp<infer TRootNode extends JsonRouteNode<any, any, any>, any, any, any, any>
        ? TRootNode
        : never;

type AppOrganizedRoutes<TApp extends XPRVApp<any, any, any, any, any>> =
    OrganizeRoutesByMethod<FlattenRouteTreeToArray<AppRootNode<TApp>>>;

type AppInternalServerErrorResponse<TApp extends XPRVApp<any, any, any, any, any>> =
    TApp extends XPRVApp<any, infer TInternal, any, any, any>
        ? TInternal
        : never;

type AppValidationErrorResponse<TApp extends XPRVApp<any, any, any, any, any>> =
    TApp extends XPRVApp<any, any, any, any, infer TValidation>
        ? TValidation
        : never;

type IsUnknown<T> = unknown extends T ? ([T] extends [unknown] ? true : false) : false;

type HasKnownInput<TInput> =
    [TInput] extends [never]
        ? false
        : TInput extends JsonRequest<infer H, infer P, infer Q, infer B>
            ? IsUnknown<H> extends false
                ? true
                : IsUnknown<P> extends false
                    ? true
                    : IsUnknown<Q> extends false
                        ? true
                        : IsUnknown<B> extends false
                            ? true
                            : false
            : false;

type ResponseForPathWithErrors<
    TApp extends XPRVApp<any, any, any, any, any>,
    TOrganized,
    TMethod extends HttpMethod,
    TPath extends string
> =
    HandlerForPath<TOrganized, TMethod, TPath> extends infer THandler
        ? THandler extends JsonRouteHandler<any, any, any>
            ? ExtractResponse<THandler>
                | AppInternalServerErrorResponse<TApp>
                | (HasKnownInput<ExtractInput<THandler>> extends true
                    ? AppValidationErrorResponse<TApp>
                    : never)
            : never
        : never;

/**
 * Extract specific property from input
 * Returns the property type if it exists and is not unknown, otherwise never
 */
type ExtractInputProperty<TInput, TKey extends keyof JsonRequest<any, any, any, any>> =
    TInput extends JsonRequest<any, any, any, any>
        ? unknown extends TInput[TKey]
            ? never
            : TInput[TKey]
        : never;

/**
 * Build the request options type for a specific route
 * Only includes properties that are defined in the input type
 */
type RequestOptions<TInput> = 
    {
        [K in 'headers' | 'params' | 'query' | 'body']?: ExtractInputProperty<TInput, K> extends never 
            ? any 
            : ExtractInputProperty<TInput, K>
    } & Omit<RequestInit, 'method' | 'body' | 'headers'>;

// ============================================================
// Client configuration and implementation
// ============================================================

/**
 * Fetch method signature compatible with the Fetch API
 */
export type FetchMethod = (
    input: RequestInfo | URL,
    init?: RequestInit
) => Promise<Response>;

/**
 * Client configuration options
 */
export interface ClientConfig {
    baseUrl: string;
    fetchMethod?: FetchMethod;
    defaultHeaders?: HeadersInit;
}

/**
 * Type-safe HTTP client for JsonRouteNode trees
 * 
 * @example
 * ```typescript
 * const client = new Client<typeof xprvApp>({
 *     baseUrl: "http://localhost:3000",
 *     fetchMethod: fetch
 * });
 * 
 * const resp = await client.get("/utils/ping", {
 *     headers: { ... },
 *     query: { ... }
 * });
 * // resp is typed as JsonResponse<200, { message: "pong!" }, {}> |
 * //                     JsonResponse<500, { error: "Internal Server Error" }, {}>
 * ```
 */
export class Client<TApp extends XPRVApp<any, any, any, any, any>> {
    private baseUrl: string;
    private fetchMethod: FetchMethod;
    private defaultHeaders: HeadersInit;
    private organizedRoutes: AppOrganizedRoutes<TApp>;

    constructor(config: ClientConfig) {
        this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
        this.fetchMethod = config.fetchMethod || fetch.bind(globalThis);
        this.defaultHeaders = config.defaultHeaders || {};
        this.organizedRoutes = {} as AppOrganizedRoutes<TApp>; // Type-level only, not used at runtime
    }

    /**
     * Perform a GET request
     */
    async get<
        TPath extends PathsForMethod<AppOrganizedRoutes<TApp>, 'get'> & string
    >(
        path: TPath,
        options?: RequestOptions<InputForPath<AppOrganizedRoutes<TApp>, 'get', TPath>>
    ): Promise<ResponseForPathWithErrors<TApp, AppOrganizedRoutes<TApp>, 'get', TPath>> {
        return this.request('GET', path, options);
    }

    /**
     * Perform a POST request
     */
    async post<
        TPath extends PathsForMethod<AppOrganizedRoutes<TApp>, 'post'> & string
    >(
        path: TPath,
        options?: RequestOptions<InputForPath<AppOrganizedRoutes<TApp>, 'post', TPath>>
    ): Promise<ResponseForPathWithErrors<TApp, AppOrganizedRoutes<TApp>, 'post', TPath>> {
        return this.request('POST', path, options);
    }

    /**
     * Perform a PUT request
     */
    async put<
        TPath extends PathsForMethod<AppOrganizedRoutes<TApp>, 'put'> & string
    >(
        path: TPath,
        options?: RequestOptions<InputForPath<AppOrganizedRoutes<TApp>, 'put', TPath>>
    ): Promise<ResponseForPathWithErrors<TApp, AppOrganizedRoutes<TApp>, 'put', TPath>> {
        return this.request('PUT', path, options);
    }

    /**
     * Perform a PATCH request
     */
    async patch<
        TPath extends PathsForMethod<AppOrganizedRoutes<TApp>, 'patch'> & string
    >(
        path: TPath,
        options?: RequestOptions<InputForPath<AppOrganizedRoutes<TApp>, 'patch', TPath>>
    ): Promise<ResponseForPathWithErrors<TApp, AppOrganizedRoutes<TApp>, 'patch', TPath>> {
        return this.request('PATCH', path, options);
    }

    /**
     * Perform a DELETE request
     */
    async delete<
        TPath extends PathsForMethod<AppOrganizedRoutes<TApp>, 'delete'> & string
    >(
        path: TPath,
        options?: RequestOptions<InputForPath<AppOrganizedRoutes<TApp>, 'delete', TPath>>
    ): Promise<ResponseForPathWithErrors<TApp, AppOrganizedRoutes<TApp>, 'delete', TPath>> {
        return this.request('DELETE', path, options);
    }

    /**
     * Internal request method
     */
    private async request(
        method: string,
        path: string,
        options?: RequestOptions<any>
    ): Promise<any> {
        // Build URL with path params
        let url = `${this.baseUrl}${path}`;
        
        // Replace path params (e.g., /users/:id -> /users/123)
        if (options?.params) {
            for (const [key, value] of Object.entries(options.params)) {
                url = url.replace(`:${key}`, String(value));
            }
        }

        // Add query string
        if (options?.query) {
            const queryString = new URLSearchParams(
                Object.entries(options.query).reduce((acc, [key, value]) => {
                    acc[key] = String(value);
                    return acc;
                }, {} as Record<string, string>)
            ).toString();
            if (queryString) {
                url += `?${queryString}`;
            }
        }

        // Build headers
        const headers = new Headers(this.defaultHeaders);
        
        // Merge in any headers from options
        if (options?.headers) {
            const optionHeaders = new Headers(options.headers as HeadersInit);
            optionHeaders.forEach((value, key) => headers.set(key, value));
        }

        // Add Content-Type for JSON bodies
        if (options?.body !== undefined) {
            headers.set('Content-Type', 'application/json');
        }

        // Extract standard fetch options
        const { headers: _, body, params, query, ...fetchOptions } = options || {};

        const response = await this.fetchMethod(url, {
            ...fetchOptions,
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : null,
        });

        // Parse response
        const responseBody = await response.json().catch(() => undefined);

        return {
            status: response.status,
            body: responseBody,
            headers: Object.fromEntries(response.headers.entries()),
        } as JsonResponse<any, any, any>;
    }
}
