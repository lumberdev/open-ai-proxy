# OpenAI Node Proxy

A simple proxy that forwards requests to OpenAi with model limits while keeping the key secret.

## Getting Started

Run `yarn install` and then copy the `.env.example` to `.env`.

In the `.env` fill out the environment variables like this:

```
PORT=<Port to host on>
HOST=<Hostname>
OPEN_AI_SECRET=<Your open ai key>
ALLOWED_ORIGINS='["<Allowed domain>"]' // Takes a stringified array of allowed domains
ALLOWED_OPEN_AI_PATHS='["/v1/chat/completions", "/v1/completions"]' // Takes a stringified array of allowed open ai paths
ALLOWED_MODELS='["gpt-3.5-turbo"]' // Models that are whitelisted for use
```

if any of these `ALLOWED_ORIGINS`, `ALLOWED_OPEN_AI_PATHS`, `ALLOWED_MODELS` envs are empty, there will be no restrictions to what they limit.

Run `yarn start` to start.

## Usage

Make a request against `<Hostname>:<port>/openai` with an allowed domain. Your request should be forwarded to `https://api.openai.com/`.
