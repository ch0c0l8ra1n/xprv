import z from "zod";

export interface JsonRequest<THeaders, TParams, TQuery, TBody> {
    headers: THeaders;
    params: TParams;
    query: TQuery;
    body: TBody;
}

export interface JsonSchemas<THeaders, TParams, TQuery, TBody> {
    headers: z.ZodSchema<THeaders,THeaders>;
    params: z.ZodSchema<TParams,TParams>;
    query: z.ZodSchema<TQuery,TQuery>;
    body: z.ZodSchema<TBody,TBody>;
}