import { createServer } from "http";
import { MongoClient } from "mongodb";
import * as express from "express";
import { Request } from "./types/request";
import * as cors from "cors";

import { itemRouterFactory } from "./item-router"
import fileRouter from "./file-router"

const wrap: (listener: (req: Request, res: express.Response, next?: () => void) => Promise<void>) => express.RequestHandler = require("express-async-wrap");

new MongoClient().connect("mongodb://localhost:27017/ttg").then(async db => {
    const userCollection = db.collection("users");
    const itemRouter = await itemRouterFactory("questions", "thc", db);

    const app = express();

    app.use(cors({ origin: "*" }));

    app.use(wrap(async (req, res, next) => {
        const userId = req.header("Authorization");
        const bannedUsers = (await userCollection.find({ permission: "banned" }).toArray()) as { _id: string, permission: string }[];
        const userIsBanned = !!bannedUsers.find(user => userId === user._id);

        if (userIsBanned) {
            res.status(403).send("you have been banned");

            return;
        }

        next();
    }));

    app.use("/thc/questions", itemRouter);

    app.use("/files", fileRouter);

    app.use((_: Request, res: express.Response) =>
        res.status(500).send("error"));

    createServer(app as any).listen(4001, () => console.log("listening"));
})