export interface ModelInfo {
  contextWindow: number;
  // USD per million tokens.
  inputPrice?: number;
  outputPrice?: number;
}

// From https://console.groq.com/docs/models (checked 2026-11-15). Models missing here
// show no cost or context percentage rather than a guess.
const MODELS: Record<string, ModelInfo> = {
  'openai/gpt-oss-120b': { contextWindow: 131_072, inputPrice: 0.15, outputPrice: 0.6 },
  'openai/gpt-oss-20b': { contextWindow: 131_072, inputPrice: 0.075, outputPrice: 0.3 },
  'openai/gpt-oss-safeguard-20b': { contextWindow: 131_072, inputPrice: 0.075, outputPrice: 0.3 },
  'qwen/qwen3.8-27b': { contextWindow: 131_072, inputPrice: 0.8, outputPrice: 4.0 },
  'llama-3.1-8b-instant': { contextWindow: 131_072 },
  'llama-3.3-70b-versatile': { contextWindow: 131_072 },
  'minimaxai/minimax-m2.7': { contextWindow: 196_608 },
};

export function getModelInfo(model: string): ModelInfo | undefined {
  return MODELS[model];
}

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number | undefined {
  const info = getModelInfo(model);
  if (info?.inputPrice === undefined || info.outputPrice === undefined) return undefined;
  return (promptTokens * info.inputPrice + completionTokens * info.outputPrice) / 1_000_000;
}
