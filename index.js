const express = require("express");
const request = require("request");
const fs = require("fs");
const app = express();
const port = 3001;
const host = "localhost";
const TARGET_API_URL = "https://picsum.photos";

// Middleware to add necessary headers for SSE
function sseMiddleware(req, res, next) {
  res.header("Cache-Control", "no-cache");
  res.header("Connection", "keep-alive");
  res.header("Content-Type", "text/event-stream");
  res.header("Access-Control-Allow-Origin", "*");
  next();
}

app.use(sseMiddleware);

// Info GET endpoint
app.get("/info", (req, res, next) => {
  res.send(
    "This is a proxy service which proxies to Billing and Account APIs."
  );
});

app.all("/openai*", (req, res, next) => {
  const parsedURL = req.url.replace("/openai", "");
  const TARGET_API_URL = "https://api.openai.com/";
  const OPEN_AI_KEY = "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";
  try {
    const apiReq = request({
      uri: `${TARGET_API_URL}${parsedURL}`,
      method: req.method,
      headers: { ...req.headers, Authorization: `Bearer ${OPEN_AI_KEY}` },
      body: req.body,
    });
    // If SSE, handle it differently
    if (req.headers.accept && req.headers.accept === "text/event-stream") {
      apiReq.on("data", (data) => {
        res.write(data); // forward the SSE data to the client
      });

      apiReq.on("end", () => {
        res.end();
      });
    } else {
      // For other types of requests, simply pipe the request
      req.pipe(apiReq).pipe(res);
    }
  } catch (error) {
    console.log(error);
    res.write("Error occured");
  }
});

app.all("/photo*", (req, res) => {
  const parsedURL = req.url.replace("/photo", "");
  const apiReq = request(`${TARGET_API_URL}${parsedURL}`);
  req.pipe(apiReq).pipe(res);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
