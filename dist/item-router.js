"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const express_1 = require("express");
const mongodb_1 = require("mongodb");
const bodyParser = require("body-parser");
const wrap = require("express-async-wrap");
const PAGE_LENGTH = 10;
const getSkipAndLimit = (page) => {
    page -= 1;
    const skip = page * PAGE_LENGTH;
    const limit = skip + PAGE_LENGTH;
    return { skip, limit };
};
const getGroup = (baseUrl) => baseUrl.match(/\/group\/(\w+)/)[1];
exports.itemRouter = (collectionName, db) => {
    const itemCollection = db.collection(collectionName);
    const replyCollection = db.collection(`${collectionName.replace(/s$/, "")}-replys`);
    const router = express_1.Router();
    router.use(bodyParser.json());
    router.get("/:itemId", wrap((req, res) => __awaiter(this, void 0, void 0, function* () {
        const { itemId } = req.params;
        if (itemId.length !== 24)
            throw `"${itemId}" is not a valid id`;
        res.setHeader("Content-Type", "application/json");
        res.send(yield itemCollection
            .find({ _id: new mongodb_1.ObjectID(itemId) }, { "title": 1, "content": 1, "date": 1, "user.name": 1, "user.photo": 1 })
            .limit(1)
            .toArray().then(qs => qs[0]));
    })));
    router.post("/", wrap((req, res) => __awaiter(this, void 0, void 0, function* () {
        const ids = req.body;
        ids.forEach(id => {
            if (id.length !== 24)
                throw `"${id}" is not a valid id`;
        });
        res.setHeader("Content-Type", "application/json");
        res.send(yield itemCollection
            .find({ _id: { $in: ids.map(id => new mongodb_1.ObjectID(id)) } }, { "title": 1, "user.name": 1, "date": 1 })
            .toArray());
    })));
    router.get("/list/:page", wrap((req, res) => __awaiter(this, void 0, void 0, function* () {
        const group = getGroup(req.baseUrl);
        const page = parseInt(req.params["page"], 10) || 1;
        const { skip, limit } = getSkipAndLimit(page);
        res.setHeader("Content-Type", "application/json");
        res.send(yield itemCollection
            .find({ group }, { _id: 1 })
            .skip(skip).limit(limit)
            .toArray().then(qs => qs.map(q => q._id)));
    })));
    router.put("/", wrap((req, res) => __awaiter(this, void 0, void 0, function* () {
        const group = getGroup(req.baseUrl);
        const { title, content, user } = req.body;
        res.setHeader("Content-Type", "text/text");
        yield itemCollection.insertOne({
            title,
            content,
            user,
            group,
            date: Date.now()
        });
        res.send("OK");
    })));
    router.delete("/:itemId", wrap((req, res) => __awaiter(this, void 0, void 0, function* () {
        const { itemId } = req.params;
        if (itemId.length !== 24)
            throw `"${itemId}" is not a valid id`;
        res.setHeader("Content-Type", "text/text");
        yield itemCollection.remove({ _id: new mongodb_1.ObjectID(itemId) });
        res.send("OK");
    })));
    router.post("/:itemId/replys", wrap((req, res) => __awaiter(this, void 0, void 0, function* () {
        const { itemId } = req.params;
        const ids = req.body;
        if (itemId.length !== 24)
            throw `"${itemId}" is not a valid id`;
        ids.forEach(id => {
            if (id.length !== 24)
                throw `"${id}" is not a valid id`;
        });
        res.setHeader("Content-Type", "application/json");
        res.send(yield replyCollection
            .find({ itemId: new mongodb_1.ObjectID(itemId), _id: { $in: ids.map(id => new mongodb_1.ObjectID(id)) } }, { "answer": 1, "date": 1, "user.name": 1, "user.photo": 1 })
            .toArray());
    })));
    router.get("/:itemId/replys/list/:page", wrap((req, res) => __awaiter(this, void 0, void 0, function* () {
        const { itemId } = req.params;
        const page = parseInt(req.params["page"], 10) || 1;
        const { skip, limit } = getSkipAndLimit(page);
        if (itemId.length !== 24)
            throw `"${itemId}" is not a valid id`;
        res.setHeader("Content-Type", "application/json");
        res.send(yield replyCollection
            .find({ itemId: new mongodb_1.ObjectID(itemId) }, { _id: 1 })
            .skip(skip).limit(limit)
            .toArray().then(rs => rs.map(r => r._id)));
    })));
    router.put("/:itemId/replys", wrap((req, res) => __awaiter(this, void 0, void 0, function* () {
        const { itemId } = req.params;
        const { answer, user } = req.body;
        if (itemId.length !== 24)
            throw `"${itemId}" is not a valid id`;
        res.setHeader("Content-Type", "text/text");
        yield replyCollection.insertOne({ answer, user, date: Date.now(), itemId: new mongodb_1.ObjectID(itemId) });
        res.send("OK");
    })));
    router.delete("/:itemId/replys/:replyId", wrap((req, res) => __awaiter(this, void 0, void 0, function* () {
        const { replyId } = req.params;
        if (replyId.length !== 24)
            throw `"${replyId}" is not a valid id`;
        res.setHeader("Content-Type", "text/text");
        yield replyCollection.remove({ _id: new mongodb_1.ObjectID(replyId) });
        res.send("OK");
    })));
    return router;
};
