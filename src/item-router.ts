import { Response, Router, RequestHandler } from "express"
import { Db, ObjectID } from "mongodb"
import * as bodyParser from "body-parser";

import { Request } from "./types/request"

const wrap: (listener: (req: Request, res: Response) => Promise<void>) => RequestHandler = require("express-async-wrap")

const PAGE_LENGTH = 10;
const getSkipAndLimit = (page: number) => {
    const skip = (page - 1) * PAGE_LENGTH;
    const limit = skip + PAGE_LENGTH;

    return { skip, limit }  
}

const SORT = { sticky: -1, date: -1 }

export const itemRouter = (collectionName: string, group: string, db: Db) => {
    const itemCollection = db.collection(`${group}-${collectionName}`);
    const replyCollection = db.collection(`${group}-${collectionName.replace(/s$/, "")}-replys`);
    const router = Router();

    router.use(bodyParser.json());

    router.get("/:itemId", wrap(async (req, res): Promise<void> => {
        const { itemId } = req.params;
        const userId = req.header("Authorization"); 

        if (itemId.length !== 24)
            throw `"${itemId}" is not a valid id`;

        res.setHeader("Content-Type", "application/json");

        res.send(await itemCollection
            .find(
                { _id: new ObjectID(itemId) }, 
                { "title": 1, "content": 1, "date": 1, "user.name": 1, "user.photo": 1, "user.id": 1 })
            .limit(1)
            .toArray()
            .then(qs => {
                const question = qs[0] as Item;

                if (question.user.id === userId) {
                    question.isYou = true;
                }

                delete question.user.id

                return question; 
            }));
    }));
    router.post("/", wrap(async (req, res) => {
        const ids: string[] = req.body as string[];

        ids.forEach(id => {
            if (id.length !== 24)
                throw `"${id}" is not a valid id`;
        });

        res.setHeader("Content-Type", "application/json");

        res.send(await itemCollection
            .find(
                { _id: { $in: ids.map(id => new ObjectID(id)) }},
                { "title": 1, "user.name": 1, "date": 1, "sticky": 1 })
            .sort(SORT)
            .toArray());
    }));
    router.get("/list/:page", wrap(async (req, res) => {
        const page = parseInt(req.params["page"], 10) || 1;
        const { skip, limit } = getSkipAndLimit(page);

        res.setHeader("Content-Type", "application/json");

        res.send(await itemCollection
            .find({}, { _id: 1 })
            .sort(SORT)
            .skip(skip).limit(limit)
            .toArray().then(qs => qs.map(q => q._id)));
    }));
    router.put("/", wrap(async (req, res) => {
        const { title, content, user } = req.body as { title: string, content: { [key: string]: string }, user: User };

        res.setHeader("Content-Type", "text/text");

        await itemCollection.insertOne({ 
            title, 
            content, 
            user, 
            date: Date.now() 
        });

        res.send("OK");
    }));
    router.delete("/:itemId", wrap(async (req, res) => {
        const { itemId } = req.params;
        const userId = req.header("Authorization");

        if (itemId.length !== 24)
            throw `"${itemId}" is not a valid id`;

        res.setHeader("Content-Type", "text/text");

        await itemCollection.remove({ _id: new ObjectID(itemId), "user.id": userId });
        await replyCollection.remove({ itemId: new ObjectID(itemId) });

        res.send("OK");
    }));

    router.post("/:itemId/replys", wrap(async (req, res) => {
        const { itemId } = req.params;
        const ids: string[] = req.body as string[];
        const userId = req.header("Authorization");

        if (itemId.length !== 24)
            throw `"${itemId}" is not a valid id`;
        ids.forEach(id => {
            if (id.length !== 24)
                throw `"${id}" is not a valid id`;
        });

        res.setHeader("Content-Type", "application/json");

        res.send(await replyCollection
            .find(
                { itemId: new ObjectID(itemId), _id: { $in: ids.map(id => new ObjectID(id)) }},
                { "answer": 1, "image": 1, "date": 1, "user.name": 1, "user.photo": 1, "user.id": 1 } 
            )
            .toArray()
            .then((replys: Reply[]) => replys.map(reply => {
                if (reply.user.id = userId) {
                    reply.isYou = true;
                }

                delete reply.user.id;

                return reply;
            })));
    }));
    router.get("/:itemId/replys/list/:page", wrap(async (req, res) => {
        const { itemId } = req.params;
        const page = parseInt(req.params["page"], 10) || 1;
        const { skip, limit } = getSkipAndLimit(page);

        if (itemId.length !== 24)
            throw `"${itemId}" is not a valid id`;

        res.setHeader("Content-Type", "application/json");

        res.send(await replyCollection
            .find({ itemId: new ObjectID(itemId) }, { _id: 1 })
            .skip(skip).limit(limit)
            .toArray().then(rs => rs.map(r => r._id)));
    }));
    router.put("/:itemId/replys", wrap(async (req, res) => {
        const { itemId } = req.params;
        const { answer, user, image } = req.body as { answer: string, user: User, image: { filename: string, mimeType: string } };

        if (itemId.length !== 24)
            throw `"${itemId}" is not a valid id`;

        res.setHeader("Content-Type", "text/text");

        await replyCollection.insertOne({ answer, user, date: Date.now(), itemId: new ObjectID(itemId), image });

        res.send("OK");
    }));
    router.delete("/:itemId/replys/:replyId", wrap(async (req, res) => {
        const { replyId } = req.params;
        const userId = req.header("Authorization");

        if (replyId.length !== 24)
            throw `"${replyId}" is not a valid id`;

        res.setHeader("Content-Type", "text/text");

        await replyCollection.remove({ _id: new ObjectID(replyId), "user.id": userId });

        res.send("OK");
    }));
    
    return router;
}

