import { readFile } from "mz/fs";
import { join } from "path"
import { Router, Response, RequestHandler } from "express";
import { Form } from "multiparty";
import { Request } from "./types/request";

const wrap: (listener: (req: Request, res: Response) => Promise<void>) => RequestHandler = require("express-async-wrap");
const userContentPath = join(__dirname, "/../user-content");

const fileRouter = Router();

const mimeTypes: { [extenstion: string]: string } = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    png: "image/png",
    svg: "image/xml+svg",
    bmp: "image/bmp"
}

fileRouter.get("/:filename", wrap(async (req: Request, res: Response) => {
    const { filename } = req.params;
    const extension = filename.match(/\.(\w+)/)[1];
    const file = await readFile(`${userContentPath}/${filename}`)

    res.setHeader("Cache-Control", "max-age=31536000");
    res.setHeader("Content-Type", mimeTypes[extension]);

    console.log(filename);

    res.send(file);
}));

fileRouter.post("/", (req: Request, res: Response) => {
    const form = new Form({ uploadDir: userContentPath });

    form.parse(req, (err, _, files) => {
        if (err) throw err;

        const filename = files.image[0].path.replace(userContentPath + "/", "");

        res.send(filename);
    });
});

export default fileRouter;