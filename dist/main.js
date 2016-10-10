"use strict";
const http_1 = require("http");
const mongodb_1 = require("mongodb");
const express = require("express");
const cors = require("cors");
const item_router_1 = require("./item-router");
new mongodb_1.MongoClient().connect("mongodb://localhost:27017/ttg").then(db => {
    const app = express();
    app.use(cors({ origin: "*" }));
    app.use("/group/:group/questions", item_router_1.itemRouter("questions", db));
    app.use((_, res) => {
        res.status(500).send("error");
    });
    http_1.createServer(app).listen(4001, () => console.log("listening"));
});
