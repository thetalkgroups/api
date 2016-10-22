import { Response, Router, RequestHandler } from "express"
import { Db, ObjectID } from "mongodb"
import * as bodyParser from "body-parser";
import { updateAll } from "./object-helpers"

import { Request } from "./types/request"
import { users } from "./users"

const wrap: (listener: (req: Request, res: Response) => Promise<void>) => RequestHandler = require("express-async-wrap");

const pageLength = 2;
const getPaginationData = (page: number, itemCount: number) => {
    const skip = (page - 1) * pageLength;
    const numberOfPages = Math.ceil(itemCount / pageLength);

    return { skip, numberOfPages };  
};
const validateId = (id: string) => {
    if (id.length !== 24) throw `"${id}" is not a valid id`;
};

const escapeHtml = (content: any) => {
    if (typeof content === "string")
        return content.replace(/</g, "&lt;");

    return content;
};

const SORT = { sticky: -1, date: -1 };

export const itemRouterFactory = (users: users, db: Db) => async (collectionName: string, group: string)=> {
    const itemCollection = db.collection(`${group}-${collectionName}`);
    const replyCollection = db.collection(`${group}-${collectionName}-replys`);
    
    const router = Router();

    let itemCount = await itemCollection.count({});
    let replyCount = await replyCollection.count({});
    let stickyCount = await itemCollection.count({ sticky: true });

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
            .then(qs => {
                if (qs.length === 0) {
                    res.status(404).send("item was not found");
                    return;
                }

                return qs[0] as Item
            })
            .then(users.setPermission(userId));

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
        let page = parseInt(req.params["page"], 10);
        page = page || 1;
        let { skip, numberOfPages } = getPaginationData(page, itemCount);
        let limit = pageLength;
        let ids: string[] = []
        let none = false;

        if (!sticky) {
            if (page * pageLength <= stickyCount) {
                none = true;
            }
            else  {
                const offset = Math.max(pageLength - ( page * pageLength - stickyCount), 0);

                skip += offset;
                limit -= offset;
            }
        }

        if (!none) {
            ids = await itemCollection
                .find(sticky ? { sticky } : {}, { "_id": 1 })
                .sort(SORT)
                .skip(skip).limit(limit)
                .toArray()
                .then(items => items.map(item => item._id));
        }

        res.send({ ids, numberOfPages });
    })
    router.get("/list/:page", listFactory(false));
    router.get("/sticky/list/:page", listFactory(true));

    interface PutBody { 
        title: string, 
        content: { [key: string]: any }, 
        user: User 
    }
    router.put("/", wrap(async (req, res) => {
        const { title, content, user } = req.body as PutBody;

        res.setHeader("Content-Type", "text/text");

        await itemCollection.insertOne({ 
            title: escapeHtml(title), 
            content: updateAll(content)(escapeHtml), 
            user, 
            "date": Date.now(),
            sticky: false
        });

        itemCount += 1;

        res.send("OK");
    }));

    router.delete("/:itemId", wrap(async (req, res) => {
        const { itemId } = req.params;
        const userId = req.header("Authorization");

        validateId(itemId);

        res.setHeader("Content-Type", "text/text");

        const result = await itemCollection.remove(users.authorizeQuery(userId, { "_id": new ObjectID(itemId) }))

        // if n is 1 the item has been removed, and you are authorized to remove it, 
        // thus you can remove the replys connected to the removed item 
        if (result.result.n) {
            itemCount -= 1;

            const result = await replyCollection.remove({ "itemId": new ObjectID(itemId) });
            replyCount -= result.result.n;
        } 

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
            .then((replys: Reply[]) => replys.map(users.setPermission(userId)));

        res.send(selectedReplys);
    }));

    router.get("/:itemId/replys/list/:page", wrap(async (req, res) => {
        const { itemId } = req.params;
        const page = parseInt(req.params["page"], 10) || 1;
        const { skip, numberOfPages } = getPaginationData(page, replyCount);

        validateId(itemId);

        res.setHeader("Content-Type", "application/json");

        const ids = await replyCollection
            .find({ "itemId": new ObjectID(itemId) }, { "_id": 1 })
            .skip(skip).limit(pageLength)
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

        replyCount += 1;

        res.send("OK");
    }));

    router.delete("/:itemId/replys/:replyId", wrap(async (req, res) => {
        const { replyId } = req.params;
        const userId = req.header("Authorization");

        validateId(replyId);

        res.setHeader("Content-Type", "text/text");

        const result = await replyCollection.remove(users.authorizeQuery(userId, { "_id": new ObjectID(replyId) }))
        if (result.result.n) {
            replyCount -= 1;
        }

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

        if (value === false) {
            stickyCount += 1;
        }

        if (!users.isAdmin(userId)) {
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