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
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");
require("dotenv").config();
const bodyParser = require("body-parser");
// Create Express Server
const app = express();
// Configuration
const { PORT, HOST, OPEN_AI_SECRET, ALLOWED_ORIGINS, ALLOWED_OPEN_AI_PATHS } = process.env;
function extractArray(env) {
    try {
        if (typeof env === "string") {
            const parsed = JSON.parse(env);
            if (Array.isArray(parsed)) {
                return parsed;
            }
            return [];
        }
    }
    catch (e) {
        return [];
    }
    return [];
}
const allowedOrigins = extractArray(ALLOWED_ORIGINS !== null && ALLOWED_ORIGINS !== void 0 ? ALLOWED_ORIGINS : "");
const allowedOpenAIPaths = extractArray(ALLOWED_OPEN_AI_PATHS !== null && ALLOWED_OPEN_AI_PATHS !== void 0 ? ALLOWED_OPEN_AI_PATHS : "");
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
let proxyCallback = (proxyReq, req, res) => {
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
};
app.use("/openai*", createProxyMiddleware({
    target: "https://api.openai.com/",
    onProxyReq: proxyCallback,
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
