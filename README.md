# NVIDIA NIM Model Playground

**Live demo:** [https://nvidia-api-key-free.vercel.app/](https://nvidia-api-key-free.vercel.app/)

Next.js playground for the [NVIDIA Integrate API](https://integrate.api.nvidia.com/v1). Switch coding-capable NIM models, tune generation parameters, stream chat responses with rich Markdown, and benchmark latency across the model list.

## Stack

- Next.js 16 (App Router) + React 19
- [Vercel AI SDK](https://ai-sdk.dev) (`ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`)
- Zustand (API key persisted in the browser)
- Tailwind CSS 4 + [shadcn/ui](https://ui.shadcn.com)
- `react-markdown` + `remark-gfm`, Shiki (code highlighting), Mermaid (diagrams)

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

- Bring-your-own NVIDIA API key (local persistence; clear/change from the UI)
- Coding-focused model list from the [NVIDIA Build](https://build.nvidia.com/models?q=coding) catalog
- Collapsible model picker with per-model latency ranks after benchmarking
- **Test latency** — sequential NDJSON benchmark of every model; sort by speed
- **Set as default** / **Use fastest as default** (persisted in `localStorage`)
- Prompt textarea with **Random question** (sample prompts: code, Mermaid, OS commands, and more)
- Generation presets: Default, Precise, Balanced, Creative (plus manual sliders)
- Temperature, top_p, max tokens, and stream toggle
- Streaming and non-streaming chat via `/api/chat`
- Assistant replies rendered as Markdown (GFM): tables, lists, links
- Fenced code blocks with Shiki highlighting and one-click copy
- ` ```mermaid ` blocks rendered as diagrams (source fallback if render fails)

## API routes

| Route | Purpose |
| --- | --- |
| `POST /api/chat` | Chat completions (stream or JSON); requires `x-nvidia-api-key` |
| `POST /api/benchmark` | NDJSON latency benchmark for all models; requires `x-nvidia-api-key` |

## Notes

- The API key lives in the browser and is sent only with each request to this app’s API routes.
- Only model IDs listed in `src/lib/models.ts` are allowed by the API routes.
- Some catalog models may time out or return 404 depending on account access; the benchmark surfaces that live.
