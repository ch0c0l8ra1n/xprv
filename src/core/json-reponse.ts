export interface JsonResponseOptions<S extends number = number, B = unknown, H extends {} = {}> {
    status: S;
    body?: B;
    headers?: H;
}

export class JsonResponse<const S extends number = number, B = unknown, H extends {} = {}> {
    status: S;
    body: B | undefined;
    headers: H;

    constructor(options: JsonResponseOptions<S, B, H>) {
        this.status = options.status;
        this.body = options.body;
        this.headers = options.headers || ({} as H);
    }
}

const j1 = new JsonResponse({ status: 200, body: { message: "Dummy" } });
const j2 = new JsonResponse({ status: 204 });
const j3 = new JsonResponse({ status: 404, body: { error: "not found" } });
const j4 = new JsonResponse({ status: 204, headers: { "X-Rate-Limit-Limit": "100" } });
