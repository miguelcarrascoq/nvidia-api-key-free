export type BenchmarkResult = {
  modelId: string;
  ok: boolean;
  latencyMs: number | null;
  status: number | null;
  error?: string;
  preview?: string;
};
