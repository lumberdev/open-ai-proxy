"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");
require("dotenv").config();
const bodyParser = require("body-parser");
// Create Express Server
const app = express();
// Configuration
const PORT = 3001;
const HOST = "localhost";
const OPEN_AI_SECRET = process.env.OPEN_AI_SECRET;
const allowedOrigins = ["http://localhost:3000"];
const allowedOpenAIPaths = ["/v1/chat/completions", "/v1/completions"];
function globalExceptionLayer(error, req, res, next) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const message = error instanceof Error ? error.message : "Internal Server Error";
        const statusCode = error instanceof Error ? (_a = error.code) !== null && _a !== void 0 ? _a : 400 : 500;
        return res.status(statusCode).json({ error: true, message, statusCode });
    });
}
const corsOptions = {
    origin: (origin, callback) => {
        console.log("origin", origin);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = "CORS policy for this site does not allow access.";
            const error = new Error(msg);
            error.code = 403;
            return callback(error, false);
        }
        return callback(null, true);
    },
    credentials: true,
};
app.use(cors(corsOptions));
app.use(globalExceptionLayer);
// // Logging the requests
app.use(morgan("combined"));
app.get("/test", cors(corsOptions), (req, res) => {
    res.json({ msg: "This is CORS-enabled for an allowed domain." });
});
const jsonParser = bodyParser.json();
app.use(jsonParser);
app.use("/openai*", createProxyMiddleware({
    target: "https://api.openai.com/",
    onProxyReq: (proxyReq, req, res) => {
        if (allowedOpenAIPaths.indexOf(req.path) === -1) {
            const error = new Error("Api endpoint not allowed");
            error.code = 403;
            return globalExceptionLayer(error, req, res);
        }
        proxyReq.setHeader("Authorization", `Bearer ${OPEN_AI_SECRET}`);
        const contentType = proxyReq.getHeader("Content-Type");
        const writeBody = (bodyData) => {
            proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
        };
        const newBody = Object.assign({}, req.body);
        newBody.model = "gpt-3.5-turbo";
        if (contentType === "application/json") {
            writeBody(JSON.stringify(newBody));
        }
    },
    changeOrigin: true,
    pathRewrite: (path, req) => {
        console.log(path);
        return path.replace("/openai", "");
    },
}));
// Starting our Proxy server
app.listen(PORT, HOST, () => {
    console.log(`Starting Proxy at ${HOST}:${PORT}`);
});
