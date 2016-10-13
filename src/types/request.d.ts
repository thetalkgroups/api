import { Request as ExpressRequest } from "express"

export interface Request extends ExpressRequest {
    body: { [key: string]: any }
    files: any
}