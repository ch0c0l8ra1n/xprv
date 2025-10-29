// src/demo/client.ts

import { xprvAppType } from "./server";

import {Client} from "xprv/client";

const client = new Client<xprvAppType>({   
    baseUrl: "http://localhost:3000",
    fetchMethod: fetch,
    defaultHeaders: {
        "X-API-Key": "my-api-key"
    }
});


(async () => {
    const resp = await client.get("/utils/ping");
    // const resp: JsonResponse<200, {
    //     readonly message: "pong!";
    // }, {}> | JsonResponse<500, {
    //     readonly error: "Internal Server Error";
    // }, {}>
    if (resp.status === 200) {
        console.log(resp.body.message);
    } else {
        console.error(resp.body.message);
    }

    const calcResp = await client.post("/utils/calculator", {
        body: {
            a: 10,
            b: 20,
            operation: "add"
        }
    });
    /*
    const calcResp: JsonResponse<200, {
        readonly result: number;
    }, {}> | JsonResponse<400, {
        readonly error: "Validation Error";
        readonly details: readonly {
            readonly path: string;
            readonly message: string;
        }[];
    }, {}> | JsonResponse<500, {
        readonly error: "Internal Server Error";
    }, {}>*/
    if (calcResp.status === 200) {
        console.log(calcResp.body.result);
    } else {
        console.error(calcResp.body);
    }
})();
