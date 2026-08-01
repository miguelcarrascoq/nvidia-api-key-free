import { hasNvidiaApiKey } from '@/lib/nvidia';
import { FALLBACK_DEFAULT_MODEL_ID, MODELS } from '@/lib/models';

export async function GET() {
  return Response.json({
    apiKeyConfigured: hasNvidiaApiKey(),
    models: MODELS,
    fallbackDefaultModelId: FALLBACK_DEFAULT_MODEL_ID,
  });
}
