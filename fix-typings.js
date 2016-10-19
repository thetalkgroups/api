const fs = require("fs");

const expressPath = __dirname + "/typings/modules/express/index.d.ts"
let expressFile = fs.readFileSync(expressPath).toString()

expressFile = expressFile.replace(/send\(body: string \| Buffer\)/, "send(body: string | Buffer | Object)")

fs.writeFileSync(expressPath, expressFile);