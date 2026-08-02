import {
  convertToModelMessages,
  generateText,
  streamText,
  type UIMessage,
} from 'ai';
import { z } from 'zod';

import type { ChatUIMessage } from '@/lib/chat-message';
import { isAllowedModel } from '@/lib/models';
import { createNvidiaProvider, getApiKeyFromRequest } from '@/lib/nvidia';

export const maxDuration = 60;

const bodySchema = z.object({
  messages: z.array(z.any()).min(1),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional().default(0.2),
  topP: z.number().min(0).max(1).optional().default(0.7),
  maxTokens: z.number().int().min(1).max(4096).optional().default(1024),
  stream: z.boolean().optional().default(true),
});

export async function POST(req: Request) {
  const apiKey = getApiKeyFromRequest(req);

  if (!apiKey) {
    return Response.json(
      { error: 'Missing NVIDIA API key. Set your key in the playground.' },
      { status: 401 },
    );
  }

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return Response.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { messages, model, temperature, topP, maxTokens, stream } = parsed.data;

  if (!isAllowedModel(model)) {
    return Response.json({ error: `Model not allowed: ${model}` }, { status: 400 });
  }

  const nvidia = createNvidiaProvider(apiKey);
  const modelMessages = await convertToModelMessages(messages as UIMessage[]);

  if (!stream) {
    const result = await generateText({
      model: nvidia(model),
      messages: modelMessages,
      temperature,
      topP,
      maxOutputTokens: maxTokens,
    });

    return Response.json({
      text: result.text,
      usage: result.usage,
      finishReason: result.finishReason,
      model,
    });
  }

  const result = streamText({
    model: nvidia(model),
    messages: modelMessages,
    temperature,
    topP,
    maxOutputTokens: maxTokens,
  });

  return result.toUIMessageStreamResponse<ChatUIMessage>({
    messageMetadata: ({ part }) => {
      if (part.type === 'finish') {
        return { finishReason: part.finishReason };
      }
    },
  });
}
