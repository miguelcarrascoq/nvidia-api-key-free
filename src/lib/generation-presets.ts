export type GenerationParams = {
  temperature: number;
  topP: number;
  maxTokens: number;
};

export type GenerationPresetId = 'default' | 'precise' | 'balanced' | 'creative';

export type GenerationPreset = {
  id: GenerationPresetId;
  label: string;
  description: string;
} & GenerationParams;

export const DEFAULT_GENERATION_PARAMS: GenerationParams = {
  temperature: 0.2,
  topP: 0.7,
  maxTokens: 1024,
};

export const GENERATION_PRESETS: GenerationPreset[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'App defaults — steady, concise replies.',
    ...DEFAULT_GENERATION_PARAMS,
  },
  {
    id: 'precise',
    label: 'Precise',
    description: 'More deterministic and factual.',
    temperature: 0.0,
    topP: 0.3,
    maxTokens: 1024,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'General chat with room for longer answers.',
    temperature: 0.7,
    topP: 0.9,
    maxTokens: 1024,
  },
  {
    id: 'creative',
    label: 'Creative',
    description: 'More varied, expressive output.',
    temperature: 1.2,
    topP: 0.95,
    maxTokens: 1024,
  },
];

export function matchGenerationPreset(
  params: GenerationParams,
): GenerationPreset | undefined {
  return GENERATION_PRESETS.find(
    (preset) =>
      preset.temperature === params.temperature &&
      preset.topP === params.topP &&
      preset.maxTokens === params.maxTokens,
  );
}
