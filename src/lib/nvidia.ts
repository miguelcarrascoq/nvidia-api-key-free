import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

export function createNvidiaProvider() {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY is not configured');
  }

  return createOpenAICompatible({
    name: 'nvidia',
    apiKey,
    baseURL: NVIDIA_BASE_URL,
    includeUsage: true,
  });
}

export function hasNvidiaApiKey(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY?.trim());
}
