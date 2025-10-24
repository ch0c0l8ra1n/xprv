import { AssertValidJson } from "./types/json";


export interface JsonOptions<
    TStatus extends number = number,
    TBody extends AssertValidJson<any> | undefined = undefined,
    THeaders = {}
> {
    status: TStatus;
    body?: TBody;
    headers?: THeaders;
}

export interface JsonResponse<
    TStatus extends number = number,
    TBody = undefined,
    THeaders = {}
> {
    readonly status: TStatus;
    readonly body: TBody;
    readonly headers: THeaders;
}

export function json<
    const TStatus extends number = number,
    const TBody =  undefined,
    const THeaders = {}
>(options: JsonOptions<TStatus, AssertValidJson<TBody>, THeaders>): JsonResponse<TStatus, TBody, THeaders> {
    // types when not present: TBody = undefined, THeaders = {}
    
    return {
        status: options.status,
        headers: options.headers == undefined ? {} as THeaders : options.headers,
        body: options.body as TBody
    }
}

const j1 = json({
    status: 200,
});

const j2 = json({
    status: 200,
    body: {
        a: 1,
        b: "2",
        c: true,
        d: null,
    },
});

// this should not work
const invalidBody= {
    a: 1,
    b: "2",
    c: true,
    d: new Date(),
};

// @ts-expect-error
const j3 = json({status: 200, body: invalidBody});