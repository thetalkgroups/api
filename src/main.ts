import { createServer } from "https";
import { MongoClient } from "mongodb";
import * as express from "express";
import { Request } from "./types/request";
import * as cors from "cors";
import * as fs from "fs";

import { itemRouterFactory } from "./item-router";
import fileRouter from "./file-router";
import { userRouterFactory } from "./users-router"

import { usersFactory, UserStatus } from "./users";


const wrap: (listener: (req: Request, res: express.Response, next?: () => void) => Promise<void>) => express.RequestHandler = require("express-async-wrap");

new MongoClient().connect("mongodb://db:27017/ttg").then(async db => {
    const userCollection = db.collection("users");
    const users = await usersFactory(db);
    const itemRouter = await itemRouterFactory("questions", "thc", users, db);
    const usersRouter = userRouterFactory(users);

    const app = express();

    app.use((req: Request, res: express.Response, next: () => void) => {
        const origin = req.headers["origin"];
        
        if (origin === "http://localhost:4000") {
            res.setHeader("Access-Control-Allow-Origin", "http://localhost:4000");
        }
        else if (origin === "https://thetalkgroups.github.io") {
            res.setHeader("Access-Control-Allow-Origin", "https://thetalkgroups.github.io");
        }

        next();
    });

    app.use(wrap(async (req, res, next) => {
        const userId = req.header("Authorization");

        if (userId === "UNSET") return next();

        switch (await users.checkUserStatus(userId)) {
            case UserStatus.kicked:
                return res.status(403).send("you have been kicked");
            case UserStatus.banned:
                return res.status(403).send("you have been kicked");
            case UserStatus.error:
                return res.status(403).send("no authorization header provided");
            case UserStatus.ok:
                return next();
        }
    }));

    app.use("/thc/questions", itemRouter);

    app.use("/files", fileRouter);

    app.use("/users", usersRouter);

    app.use((error: any, _: Request, res: express.Response, next: () => void) => {
        console.log("ERR", error);

        res.status(500).send(error.constructor.name.endsWith("Error") ? error.message : error.toString());

        next; 
    });

    app.use((_:Request, res: express.Response) => {
        res.status(500).send("error");
    })

    createServer({
        key: fs.readFileSync(__dirname + "/../keys/server.key"),
        cert: fs.readFileSync(__dirname + "/../keys/server.crt")
    }, app as any)
        .listen(8000, () => console.log("listening"));
})