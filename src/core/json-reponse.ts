export interface JsonResponseOptions<S,B,H extends {}>{
    status: S;
    body?: B;
    headers?: H;
}

export class JsonResponse<S extends number, B, H extends {}>{
    status: S;
    body: B | null;
    headers: H;

    
    constructor(options: JsonResponseOptions<S,B,H>){
        this.status = options.status;
        this.body = "body" in options ? options.body : null;
        this.headers = "headers" in options ? options.headers : {} as H;
    }
}

const j1 = new JsonResponse({ status: 200, body: { hello: "world" } , headers: { "X-Rate-Limit-Limit": "100" }});
const j2 = new JsonResponse({ status: 204 });
const j3 = new JsonResponse({ status: 404, body: { error: "not found" } });
const j4 = new JsonResponse({ status: 204, headers: { "X-Rate-Limit-Limit": "100" } });