import { ZodError } from "zod";
import { json, JsonResponse } from "./json-response";
import { Request, Response } from "express";


const defaultOnInternalServerError= (
    error: unknown,
    req: Request,
    res: Response
) => {
    return json({
        status: 500,
        body: {
            error: "Internal Server Error"
        }
    })
}

const defaultOnNotFound= (
    req: Request,
    res: Response
) => {
    return json({
        status: 404,
        body: {
            error: "Not Found"
        }
    })
}

const defaultOnMethodNotAllowed = (
    req: Request,
    res: Response
) => {
    return json({
        status: 405,
        body: {
            error: "Method Not Allowed"
        }
    })
}

const defaultOnValidationError = (
    where: "headers" | "query" | "params" | "body",
    error: ZodError,
    req: Request,
    res: Response
) => {
    return json({
        status: 400,
        body: {
            error: "Validation Error",
            details: error.issues.map(e => ({
                path: e.path.join("."),
                message: e.message
            }))
        }
    })
}

export {
    defaultOnInternalServerError,
    defaultOnNotFound,
    defaultOnMethodNotAllowed,
    defaultOnValidationError
}