# NVIDIA NIM Model Playground

Next.js playground for the [NVIDIA Integrate API](https://integrate.api.nvidia.com/v1). Switch models, tune generation parameters, stream chat responses, and benchmark latency across the model list.

## Stack

- Next.js (App Router)
- [Vercel AI SDK](https://ai-sdk.dev) with `@ai-sdk/openai-compatible`
- Tailwind CSS

## Setup

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and set:

```bash
NVIDIA_API_KEY=nvapi-your-key-here
```

## Develop

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Features

- Visual model selector for NVIDIA catalog IDs
- Prompt textarea with temperature, top_p, max tokens, and stream toggle
- Streaming chat via `/api/chat`
- **Test latency** button that sequentially benchmarks every model and sorts the selector
- **Set as default** / **Use fastest as default** (persisted in `localStorage`)

## API routes

| Route | Purpose |
| --- | --- |
| `POST /api/chat` | Chat completions (stream or JSON) |
| `POST /api/benchmark` | NDJSON latency benchmark for all models |
| `GET /api/status` | API key configured flag + model catalog |

## Notes

- The API key stays on the server (`.env.local`). It is never sent to the browser.
- Some catalog models may time out or return 404 depending on account access; the benchmark surfaces that live.
