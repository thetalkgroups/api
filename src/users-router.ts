import { Router, Response, RequestHandler } from "express";
import * as bodyParser from "body-parser";

import { Request } from "./types/request";
import { users } from "./users";

const wrap: (listener: (req: Request, res: Response, next?: () => void) => Promise<void>) => RequestHandler = require("express-async-wrap");

export const userRouterFactory = (users: users) => {
    const router = Router();

    router.use(bodyParser.json());

    router.get("/list", wrap(async (req, res) => {
        const userId = req.header("Authorization");

        if (!users.isAdmin(userId)) {
            res.status(403).send("you are not authorized");

            return;
        }

        const userList = await users.getUsers();

        res.setHeader("Content-Type", "application/json");

        res.send(userList);
    }))  

    router.put("/kick/:kickTime", wrap(async (req, res) => {
        const userId = req.header("Authorization");
        const kickTime = parseInt(req.params["kickTime"], 10) || 0;
        const { prefix, itemId } = req.body as { prefix: string, itemId: string };

        if (!users.isAdmin(userId))
            return res.status(403).send("you are not authorized");

        await users.kickUser(prefix, itemId, kickTime);

        res.send("OK");        
    }));

    router.post("/kick/:id/:kickTime", wrap(async (req, res) => {
        const userId = req.header("Authorization");
        const kickTime = parseInt(req.params["kickTime"], 10) || 0;
        const { id } = req.params;

        if (!users.isAdmin(userId))
            return res.status(403).send("you are not authorized");

        await users.updateKick(id, kickTime);

        res.send("OK");
    }))

    router.put("/ban", wrap(async (req, res) => {
        const userId = req.header("Authorization");
        const { prefix, itemId } = req.body as { prefix: string, itemId: string };

        if (!users.isAdmin(userId))
            return res.status(403).send("you are not authorized");

        await users.banUser(prefix, itemId);

        res.send("OK");
    }))

    router.post("/remove/:id", wrap(async (req, res) => {
        const userId = req.header("Authorization");
        const { id } = req.params;

        if (!users.isAdmin(userId))
            return res.status(403).send("you are not authorized");

        await users.removePermission(id)

        res.send("OK");
    }))
    
    return router;
};