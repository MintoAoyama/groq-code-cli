export interface ModelInfo {
  contextWindow?: number;
  name?: string;
  // Groq may remove preview models without the deprecation notice production models get.
  preview?: boolean;
  // Values the API accepts for reasoning_effort, from https://console.groq.com/docs/reasoning.
  efforts?: string[];
  // USD per million tokens.
  inputPrice?: number;
  outputPrice?: number;
}

export interface LiveModel {
  id: string;
  contextWindow?: number;
}

// The models API has no names, prices or reasoning efforts, so these come from
// https://console.groq.com/docs/models (checked 2026-11-15). Models missing here are
// still offered when the API lists them, with no cost shown and no reasoning effort
// taken, rather than a guess.
const GPT_OSS_EFFORTS = ['low', 'medium', 'high'];

const KNOWN_MODELS: Record<string, ModelInfo> = {
  'openai/gpt-oss-120b': { contextWindow: 131_072, name: 'GPT OSS 120B', efforts: GPT_OSS_EFFORTS, inputPrice: 0.15, outputPrice: 0.6 },
  'openai/gpt-oss-20b': { contextWindow: 131_072, name: 'GPT OSS 20B', efforts: GPT_OSS_EFFORTS, inputPrice: 0.075, outputPrice: 0.3 },
  'llama-3.3-70b-versatile': { contextWindow: 131_072, name: 'Llama 3.3 70B' },
  'llama-3.1-8b-instant': { contextWindow: 131_072, name: 'Llama 3.1 8B' },
  'qwen/qwen3.8-27b': {
    contextWindow: 131_072,
    name: 'Qwen 3.8 27B',
    preview: true,
    efforts: ['none', 'default', 'low', 'medium', 'high'],
    inputPrice: 0.8,
    outputPrice: 4.0,
  },
  'minimaxai/minimax-m2.7': { contextWindow: 196_608, name: 'MiniMax M2.7', preview: true },
  'meta-models/muse-spark-open': { contextWindow: 131_072, name: 'Muse Spark', preview: true, efforts: ['low', 'medium', 'high', 'xhigh'] },
};

export const DEFAULT_MODEL = 'openai/gpt-oss-120b';

// The models API does not say what a model is for, so speech, text-to-speech and
// safety classifier models are recognized by name.
const NON_CHAT_MODEL = /whisper|orpheus|tts|guard/;

// Active models from the API, or null until they have been fetched.
let liveModels: LiveModel[] | null = null;

export function setLiveModels(models: LiveModel[] | null): void {
  liveModels = models?.filter(model => !NON_CHAT_MODEL.test(model.id)) ?? null;
}

export function getModelInfo(model: string): ModelInfo | undefined {
  const known = KNOWN_MODELS[model];
  const live = liveModels?.find(entry => entry.id === model);
  if (!known && !live) return undefined;
  return { ...known, contextWindow: live?.contextWindow ?? known?.contextWindow };
}

// Without the API list the known models are assumed available.
export function isAvailableModel(model: string): boolean {
  return liveModels ? liveModels.some(entry => entry.id === model) : model in KNOWN_MODELS;
}

// Known models come first, in the order of KNOWN_MODELS.
export function getSelectableModels(): { id: string; name: string; known: boolean; preview?: boolean }[] {
  const knownIds = Object.keys(KNOWN_MODELS);
  const ids = liveModels ? liveModels.map(entry => entry.id) : knownIds;
  const rank = (id: string) => (knownIds.includes(id) ? knownIds.indexOf(id) : knownIds.length);
  return [...ids]
    .sort((a, b) => rank(a) - rank(b))
    .map(id => ({ id, name: KNOWN_MODELS[id]?.name ?? id, known: id in KNOWN_MODELS, preview: KNOWN_MODELS[id]?.preview }));
}

export function getEfforts(model: string): string[] {
  return KNOWN_MODELS[model]?.efforts ?? [];
}

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number | undefined {
  const info = KNOWN_MODELS[model];
  if (info?.inputPrice === undefined || info.outputPrice === undefined) return undefined;
  return (promptTokens * info.inputPrice + completionTokens * info.outputPrice) / 1_000_000;
}
