import { Request as ExpressRequest } from "express"

export interface Request extends ExpressRequest {
    body: any
    files: any
}