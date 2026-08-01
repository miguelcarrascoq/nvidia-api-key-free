# NVIDIA NIM Model Playground

Next.js playground for the [NVIDIA Integrate API](https://integrate.api.nvidia.com/v1). Switch models, tune generation parameters, stream chat responses, and benchmark latency across the model list.

## Stack

- Next.js (App Router)
- [Vercel AI SDK](https://ai-sdk.dev) with `@ai-sdk/openai-compatible`
- Zustand (API key persisted in the browser)
- Tailwind CSS

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

There is **no shared server API key**. On first visit, the UI asks for your own NVIDIA key and stores it in `localStorage` (via Zustand) so you are not prompted again on that browser.

### Get an API key

1. Go to [https://build.nvidia.com/](https://build.nvidia.com/)
2. Sign in or create an NVIDIA account
3. Open a model or your profile and choose **Get API Key** / **Generate Key**
4. Paste the key (`nvapi-…`) into the playground modal

## Deploy on Vercel

Deploy as usual. Do **not** set `NVIDIA_API_KEY` in Vercel environment variables — each visitor brings their own key. The Next.js API routes forward the per-request `x-nvidia-api-key` header to NVIDIA and never persist it.

## Features

- Bring-your-own NVIDIA API key (local persistence)
- Visual model selector for NVIDIA catalog IDs
- Prompt textarea with temperature, top_p, max tokens, and stream toggle
- Streaming chat via `/api/chat`
- **Test latency** button that sequentially benchmarks every model and sorts the selector
- **Set as default** / **Use fastest as default** (persisted in `localStorage`)

## API routes

| Route | Purpose |
| --- | --- |
| `POST /api/chat` | Chat completions (stream or JSON); requires `x-nvidia-api-key` |
| `POST /api/benchmark` | NDJSON latency benchmark for all models; requires `x-nvidia-api-key` |

## Notes

- The API key lives in the browser and is sent only with each request to this app’s API routes.
- Some catalog models may time out or return 404 depending on account access; the benchmark surfaces that live.
