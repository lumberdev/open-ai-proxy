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
const {
  PORT,
  HOST,
  OPEN_AI_SECRET,
  ALLOWED_ORIGINS,
  ALLOWED_OPEN_AI_PATHS,
  ALLOWED_MODELS,
} = process.env;

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

function isArrayMissing(array: string[], value: string) {
  const missingValue =
    array.length > 0 &&
    array.findIndex((item) => {
      const re = new RegExp(item);
      return re.test(value);
    }) === -1;
  return missingValue;
}

const allowedOrigins = extractArray(ALLOWED_ORIGINS ?? "");
const allowedOpenAIPaths = extractArray(ALLOWED_OPEN_AI_PATHS ?? "");
const allowedModels = extractArray(ALLOWED_MODELS ?? "");

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
    // Check if CORS is valid
    if (isArrayMissing(allowedOrigins, origin)) {
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

const jsonParser = bodyParser.json();

app.use(jsonParser);

let proxyCallback: OnProxyReqCallback = (proxyReq, req, res) => {
  // Check if path is valid
  console.log(req.path, allowedOpenAIPaths);
  if (isArrayMissing(allowedOpenAIPaths, req.path)) {
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
  // Check if req.body contains a model and check if model is invalid
  if (req?.body?.model && isArrayMissing(allowedModels, req.body.model)) {
    const error = new Error("Invalid Model") as ExtendedError;
    error.code = 400;
    return globalExceptionLayer(error, req, res);
  }

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
      return path.replace("/openai", "");
    },
  })
);

// Starting our Proxy server
app.listen(PORT, HOST, () => {
  console.log(`Starting Proxy at ${HOST}:${PORT}`);
});
