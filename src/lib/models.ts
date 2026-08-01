export type ModelUseCase = 'coding';

export type ModelDefinition = {
  id: string;
  label: string;
  vendor: string;
  /** Intended use case from NVIDIA Build catalog filters. */
  useCase: ModelUseCase;
};

/**
 * Models sourced from https://build.nvidia.com/models?q=coding
 * (Free Endpoint / coding-capable LLMs). Deprecated catalog entries omitted.
 */
export const MODELS: ModelDefinition[] = [
  {
    id: 'poolside/laguna-xs-2.1',
    label: 'Laguna XS 2.1',
    vendor: 'Poolside',
    useCase: 'coding',
  },
  {
    id: 'z-ai/glm-5.2',
    label: 'GLM 5.2',
    vendor: 'Z.ai',
    useCase: 'coding',
  },
  {
    id: 'minimaxai/minimax-m3',
    label: 'MiniMax M3',
    vendor: 'MiniMax',
    useCase: 'coding',
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b',
    label: 'Nemotron 3 Ultra 550B',
    vendor: 'NVIDIA',
    useCase: 'coding',
  },
  {
    id: 'stepfun-ai/step-3.7-flash',
    label: 'Step 3.7 Flash',
    vendor: 'StepFun',
    useCase: 'coding',
  },
  {
    id: 'moonshotai/kimi-k2.6',
    label: 'Kimi K2.6',
    vendor: 'Moonshot',
    useCase: 'coding',
  },
  {
    id: 'mistralai/mistral-medium-3.5-128b',
    label: 'Mistral Medium 3.5',
    vendor: 'Mistral',
    useCase: 'coding',
  },
  {
    id: 'deepseek-ai/deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    vendor: 'DeepSeek',
    useCase: 'coding',
  },
  {
    id: 'deepseek-ai/deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    vendor: 'DeepSeek',
    useCase: 'coding',
  },
  {
    id: 'google/gemma-4-31b-it',
    label: 'Gemma 4 31B IT',
    vendor: 'Google',
    useCase: 'coding',
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b',
    label: 'Nemotron 3 Super 120B',
    vendor: 'NVIDIA',
    useCase: 'coding',
  },
  {
    id: 'nvidia/nemotron-3-nano-30b-a3b',
    label: 'Nemotron 3 Nano 30B',
    vendor: 'NVIDIA',
    useCase: 'coding',
  },
  {
    id: 'sarvamai/sarvam-m',
    label: 'Sarvam M',
    vendor: 'Sarvam',
    useCase: 'coding',
  },
  {
    id: 'mistralai/mistral-nemotron',
    label: 'Mistral Nemotron',
    vendor: 'Mistral',
    useCase: 'coding',
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
