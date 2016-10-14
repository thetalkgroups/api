import { createServer } from "http";
import { MongoClient } from "mongodb";
import * as express from "express";
import { Request } from "./types/request";
import * as cors from "cors";

import { itemRouterFactory } from "./item-router"
import fileRouter from "./file-router"

new MongoClient().connect("mongodb://localhost:27017/ttg").then(db => {
    const app = express();

    itemRouterFactory("questions", "thc", db).then(itemRouter => {
        app.use(cors({ origin: "*" }));

        app.use("/group/thc/questions", itemRouter);
    
        app.use("/files", fileRouter);

        app.use((_: Request, res: express.Response) =>
            res.status(500).send("error"));

        createServer(app as any).listen(4001, () => console.log("listening"));
    });
})