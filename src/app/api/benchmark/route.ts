import { generateText } from 'ai';

import type { BenchmarkResult } from '@/lib/benchmark';
import { MODELS } from '@/lib/models';
import { createNvidiaProvider, getApiKeyFromRequest } from '@/lib/nvidia';

export const maxDuration = 300;

const BENCHMARK_PROMPT = 'Reply with exactly: OK';
const PER_MODEL_TIMEOUT_MS = 45_000;
const CONCURRENCY = 4;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function benchmarkModel(
  modelId: string,
  apiKey: string,
): Promise<BenchmarkResult> {
  const started = Date.now();

  try {
    const nvidia = createNvidiaProvider(apiKey);
    const result = await withTimeout(
      generateText({
        model: nvidia(modelId),
        messages: [{ role: 'user', content: BENCHMARK_PROMPT }],
        temperature: 0.2,
        maxOutputTokens: 16,
      }),
      PER_MODEL_TIMEOUT_MS,
    );

    return {
      modelId,
      ok: true,
      latencyMs: Date.now() - started,
      status: 200,
      preview: result.text.slice(0, 120),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const timedOut = message.toLowerCase().includes('timed out');

    return {
      modelId,
      ok: false,
      latencyMs: Date.now() - started,
      status: timedOut ? 504 : null,
      error: message,
    };
  }
}

export async function POST(req: Request) {
  const apiKey = getApiKeyFromRequest(req);

  if (!apiKey) {
    return Response.json(
      { error: 'Missing NVIDIA API key. Set your key in the playground.' },
      { status: 401 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      send({ type: 'start', total: MODELS.length });

      let next = 0;
      let completed = 0;

      async function worker() {
        while (next < MODELS.length) {
          const index = next;
          next += 1;
          const model = MODELS[index];
          send({
            type: 'progress',
            modelId: model.id,
            active: true,
            completed,
            total: MODELS.length,
          });

          const result = await benchmarkModel(model.id, apiKey);
          completed += 1;
          send({
            type: 'result',
            completed,
            total: MODELS.length,
            result,
          });
        }
      }

      await Promise.all(
        Array.from(
          { length: Math.min(CONCURRENCY, MODELS.length) },
          () => worker(),
        ),
      );

      send({ type: 'done' });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
