import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

import { NVIDIA_API_KEY_HEADER } from '@/lib/api-key-header';

export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
export { NVIDIA_API_KEY_HEADER };

export function createNvidiaProvider(apiKey: string) {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    throw new Error('NVIDIA API key is required');
  }

  return createOpenAICompatible({
    name: 'nvidia',
    apiKey: trimmed,
    baseURL: NVIDIA_BASE_URL,
    includeUsage: true,
  });
}

export function getApiKeyFromRequest(req: Request): string | null {
  const headerKey = req.headers.get(NVIDIA_API_KEY_HEADER)?.trim();
  if (headerKey) return headerKey;

  const authorization = req.headers.get('authorization')?.trim();
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    const token = authorization.slice(7).trim();
    if (token) return token;
  }

  return null;
}
