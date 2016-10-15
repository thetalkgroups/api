import { Response, Router, RequestHandler } from "express"
import { Db, ObjectID } from "mongodb"
import * as bodyParser from "body-parser";
import "./map-keys"

import { Request } from "./types/request"

const wrap: (listener: (req: Request, res: Response) => Promise<void>) => RequestHandler = require("express-async-wrap");

const pageLength = 1;
const getPaginationData = (page: number, itemCount: number) => {
    const skip = (page - 1) * pageLength;
    const limit = skip + pageLength;
    const numberOfPages = Math.ceil(itemCount / pageLength);

    return { skip, limit, numberOfPages };  
};
const validateId = (id: string) => {
    if (id.length !== 24) throw `"${id}" is not a valid id`;
};
const getPermissionFactory = (adminUsers: string[]) => (userId: string, itemId: string) => {
    if ((!!adminUsers.find(id => id == userId))) return "admin";
    if (itemId === userId) return "you";
    return "none";
};
const escapeHtml = (content: any) => {
    if (typeof content === "string")
        return content.replace(/</g, "&lt;");

    return content;
};

const SORT = { sticky: -1, date: -1 };

export const itemRouterFactory = async (collectionName: string, group: string, db: Db) => {
    const itemCollection = db.collection(`${group}-${collectionName}`);
    const replyCollection = db.collection(`${group}-${collectionName.replace(/s$/, "")}-replys`);
    const userCollection = db.collection("users");
    const isAdmin = (userId: string) => !!adminUsers.find(id => id === userId);
    const authorizeQuery = (userId: string, query: any) => {
        if (isAdmin(userId)) return query;

        query["user.id"] = userId;

        return query;
    }
    const adminUsers = (await userCollection.find({ permission: "admin" }).toArray())
        .map(user => user._id) as string[];
    const getPermission = getPermissionFactory(adminUsers);
    const setPermission = (userId: string) => (item: { user: User, permission: string }) => {
        item.permission = getPermission(userId, item.user.id);

        delete item.user.id

        return item;
    };
    const router = Router();

    router.use(bodyParser.json());

    router.get("/:itemId", wrap(async (req, res): Promise<void> => {
        const { itemId } = req.params;
        const userId = req.header("Authorization"); 

        validateId(itemId);

        res.setHeader("Content-Type", "application/json");

        const item = await itemCollection
            .find(
                { "_id": new ObjectID(itemId) }, 
                { 
                    "title": 1, 
                    "content": 1, 
                    "date": 1, 
                    "user.name": 1, 
                    "user.photo": 1,
                    "user.id": 1,
                    "sticky": 1
                }
            )
            .limit(1)
            .toArray()
            .then(qs => qs[0] as Item)
            .then(setPermission(userId));

        res.send(item);
    }));

    
    const getAll = wrap(async (req, res) => {
        const ids: string[] = req.body as string[];

        ids.forEach(validateId);

        res.setHeader("Content-Type", "application/json");

        const items = await itemCollection
            .find(
                { "_id": { "$in": ids.map(id => new ObjectID(id)) }},
                { "title": 1, "user.name": 1, "date": 1 })
            .sort(SORT)
            .toArray();

        res.send(items);
    });
    router.post("/", getAll);
    router.post("/sticky/", getAll);

    const listFactory = (sticky: boolean) => wrap(async (req, res) => {
        let [ page, offset ]: any[] = req.params["page"].split("-");
        page = parseInt(page, 10) || 1;
        offset = parseInt(offset, 10) || 0;
        const itemCount = await itemCollection.count({})
        const { skip, limit, numberOfPages } = getPaginationData(page, itemCount);

        res.setHeader("Content-Type", "application/json");

        const ids = await itemCollection
            .find({ sticky }, { "_id": 1 })
            .sort(SORT)
            .skip(skip).limit(limit - offset)
            .toArray()
            .then(items => items.map(item => item._id));

        res.send({ ids, numberOfPages });
    })
    router.get("/list/:page", listFactory(false));
    router.get("/sticky/list/:page", listFactory(true));

    interface PutBody { 
        title: string, 
        content: { [key: string]: string }, 
        user: User 
    }
    router.put("/", wrap(async (req, res) => {
        const { title, content, user } = req.body as PutBody;

        res.setHeader("Content-Type", "text/text");

        await itemCollection.insertOne({ 
            title: escapeHtml(title), 
            content: Object.mapKeys(content, (_, value) => escapeHtml(value)), 
            user, 
            "date": Date.now(),
            sticky: false
        });

        res.send("OK");
    }));

    router.delete("/:itemId", wrap(async (req, res) => {
        const { itemId } = req.params;
        const userId = req.header("Authorization");

        validateId(itemId);

        res.setHeader("Content-Type", "text/text");

        await itemCollection.remove(authorizeQuery(userId, { "_id": new ObjectID(itemId) }))
            .then(result => {
                // if n is 1 the item has been removed, and you are authorized to remove it, 
                // thus you can remove the replys connected to the removed item 
                if (result.result.n === 1) 
                    return replyCollection.remove({ "itemId": new ObjectID(itemId) });
            });

        res.send("OK");
    }));

    router.post("/:itemId/replys", wrap(async (req, res) => {
        const { itemId } = req.params;
        const ids: string[] = req.body as string[];
        const userId = req.header("Authorization");

        validateId(itemId);
        ids.forEach(validateId);

        res.setHeader("Content-Type", "application/json");

        const selectedReplys = await replyCollection
            .find(
                { 
                    "itemId": new ObjectID(itemId), 
                    "_id": { "$in": ids.map(id => new ObjectID(id)) }
                },
                { 
                    "answer": 1, 
                    "image": 1, 
                    "date": 1, 
                    "user.name": 1, 
                    "user.photo": 1, 
                    "user.id": 1 
                } 
            )
            .toArray()
            .then((replys: Reply[]) => replys.map(setPermission(userId)));

        res.send(selectedReplys);
    }));

    router.get("/:itemId/replys/list/:page", wrap(async (req, res) => {
        const { itemId } = req.params;
        const page = parseInt(req.params["page"], 10) || 1;
        const replyCount = await replyCollection.count({});
        const { skip, limit, numberOfPages } = getPaginationData(page, replyCount);

        validateId(itemId);

        res.setHeader("Content-Type", "application/json");

        const ids = await replyCollection
            .find({ "itemId": new ObjectID(itemId) }, { "_id": 1 })
            .skip(skip).limit(limit)
            .toArray()
            .then(replys => replys.map(r => r._id));

        res.send({ ids, numberOfPages });
    }));

    interface ReplyPutBody { 
        answer: string, 
        user: User, 
        image: { filename: string, mimeType: string } 
    }
    router.put("/:itemId/replys", wrap(async (req, res) => {
        const { itemId } = req.params;
        const { answer, user, image } = req.body as ReplyPutBody;

        validateId(itemId);

        res.setHeader("Content-Type", "text/text");

        await replyCollection.insertOne({ 
            answer: escapeHtml(answer), 
            user, 
            image, 
            "date": Date.now(), 
            "itemId": new ObjectID(itemId), 
        });

        res.send("OK");
    }));

    router.delete("/:itemId/replys/:replyId", wrap(async (req, res) => {
        const { replyId } = req.params;
        const userId = req.header("Authorization");

        validateId(replyId);

        res.setHeader("Content-Type", "text/text");

        await replyCollection.remove(authorizeQuery(userId, { "_id": new ObjectID(replyId) }));

        res.send("OK");
    }));

    router.get("/:itemId/sticky", wrap(async (req, res) => {
        const { itemId } = req.params;
        
        validateId(itemId);

        const sticky = await itemCollection
            .find({ "_id": new ObjectID(itemId) }, { "sticky": 1 })
            .limit(1)
            .toArray()
            .then(items => items[0].sticky);

        res.send(sticky);
    }))

    router.post("/:itemId/sticky", wrap(async (req, res) => {
        const { value } = req.body as { value: boolean }; 
        const { itemId } = req.params;
        const userId = req.header("Authorization");
        
        validateId(itemId);

        if (!isAdmin(userId)) {
            res.status(403).send("not authorized");
            return;
        }

        await itemCollection.updateOne(
            { "_id": new ObjectID(itemId) }, 
            { "$set": { "sticky": !value }}
        );

        res.send("OK");
    }));
    
    return router;
}