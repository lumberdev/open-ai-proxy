import { NextFunction, Request, Response } from "express";
import { OnProxyReqCallback } from "http-proxy-middleware/dist/types";

const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");
require("dotenv").config();
const bodyParser = require("body-parser");

// Create Express Server
const app = express();

// Configuration
const { PORT, HOST, OPEN_AI_SECRET, ALLOWED_ORIGINS, ALLOWED_OPEN_AI_PATHS } =
  process.env;

function extractArray(env: string): string[] {
  try {
    if (typeof env === "string") {
      const parsed = JSON.parse(env);

      if (Array.isArray(parsed)) {
        return parsed;
      }
      return [];
    }
  } catch (e) {
    return [];
  }
  return [];
}

const allowedOrigins = extractArray(ALLOWED_ORIGINS ?? "");
const allowedOpenAIPaths = extractArray(ALLOWED_OPEN_AI_PATHS ?? "");

type ExtendedError = Error & { code: number };

async function globalExceptionLayer(
  error: ExtendedError,
  req: Request,
  res: Response,
  next?: NextFunction
) {
  const message =
    error instanceof Error ? error.message : "Internal Server Error";
  const statusCode = error instanceof Error ? error.code ?? 400 : 500;

  return res.status(statusCode).json({ error: true, message, statusCode });
}

const corsOptions = {
  origin: (
    origin: string,
    callback: (arg: null | unknown, bool: boolean) => {}
  ) => {
    console.log("origin", origin);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = "CORS policy for this site does not allow access.";
      const error = new Error(msg) as ExtendedError;
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

app.get("/test", cors(corsOptions), (req: Request, res: Response) => {
  res.json({ msg: "This is CORS-enabled for an allowed domain." });
});

const jsonParser = bodyParser.json();

app.use(jsonParser);

let proxyCallback: OnProxyReqCallback = (proxyReq, req, res) => {
  if (allowedOpenAIPaths.indexOf(req.path) === -1) {
    const error = new Error("Api endpoint not allowed") as ExtendedError;
    error.code = 403;
    return globalExceptionLayer(error, req, res);
  }

  proxyReq.setHeader("Authorization", `Bearer ${OPEN_AI_SECRET}`);

  const contentType = proxyReq.getHeader("Content-Type");
  const writeBody = (bodyData: string | DataView | ArrayBuffer) => {
    proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  };

  const newBody = { ...req.body };
  newBody.model = "gpt-3.5-turbo";

  if (contentType === "application/json") {
    writeBody(JSON.stringify(newBody));
  }
};

app.use(
  "/openai*",
  createProxyMiddleware({
    target: "https://api.openai.com/",
    onProxyReq: proxyCallback,
    changeOrigin: true,
    pathRewrite: (path: string, req: Request) => {
      console.log(path);
      return path.replace("/openai", "");
    },
  })
);

// Starting our Proxy server
app.listen(PORT, HOST, () => {
  console.log(`Starting Proxy at ${HOST}:${PORT}`);
});
