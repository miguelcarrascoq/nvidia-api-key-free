export type ModelDefinition = {
  id: string;
  label: string;
  vendor: string;
};

export const MODELS: ModelDefinition[] = [
  { id: 'z-ai/glm-5.2', label: 'GLM 5.2', vendor: 'Z.ai' },
  {
    id: 'mistralai/mistral-medium-3.5-128b',
    label: 'Mistral Medium 3.5',
    vendor: 'Mistral',
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b',
    label: 'Nemotron 3 Super 120B',
    vendor: 'NVIDIA',
  },
  {
    id: 'deepseek-ai/deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    vendor: 'DeepSeek',
  },
  { id: 'minimaxai/minimax-m3', label: 'MiniMax M3', vendor: 'MiniMax' },
  {
    id: 'google/gemma-4-31b-it',
    label: 'Gemma 4 31B IT',
    vendor: 'Google',
  },
  {
    id: 'moonshotai/kimi-k2.6',
    label: 'Kimi K2.6',
    vendor: 'Moonshot',
  },
];

export const FALLBACK_DEFAULT_MODEL_ID = 'z-ai/glm-5.2';

export const DEFAULT_MODEL_STORAGE_KEY = 'nvidia.defaultModelId';

export const MODEL_IDS = MODELS.map((model) => model.id);

export function isAllowedModel(modelId: string): boolean {
  return MODEL_IDS.includes(modelId);
}

export function getModelById(modelId: string): ModelDefinition | undefined {
  return MODELS.find((model) => model.id === modelId);
}
