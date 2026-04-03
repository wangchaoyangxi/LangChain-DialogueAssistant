export interface Model {
  id: string;
  name: string;
}

export const FREE_MODELS: Model[] = [
  { id: "openrouter/free", name: "Auto (自动选择)" },
  { id: "qwen/qwen3.6-plus:free", name: "Qwen 3.6 Plus" },
  { id: "google/gemma-3-27b-it:free", name: "Gemma 3 27B" },
  { id: "google/gemma-3-12b-it:free", name: "Gemma 3 12B" },
  { id: "google/gemma-3-4b-it:free", name: "Gemma 3 4B" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B" },
  { id: "minimax/minimax-m2.5:free", name: "MiniMax M2.5" },
  { id: "openai/gpt-oss-20b:free", name: "GPT OSS 20B" },
  { id: "stepfun/step-3.5-flash:free", name: "Step 3.5 Flash" },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super 120B A12B" },
  { id: "arcee-ai/trinity-large-preview:free", name: "Trinity Large Preview" },
  { id: "z-ai/glm-4.5-air:free", name: "GLM 4.5 Air" },
  { id: "nvidia/nemotron-3-nano-30b-a3b:free", name: "Nemotron 3 Nano 30B A3B" },
  { id: "arcee-ai/trinity-mini:free", name: "Trinity Mini" },
  { id: "nvidia/nemotron-nano-12b-v2-vl:free", name: "Nemotron Nano 12B V2 VL" },
  { id: "nvidia/nemotron-nano-9b-v2:free", name: "Nemotron Nano 9B V2" },
  { id: "qwen/qwen3-coder:free", name: "Qwen 3 Coder" },
  { id: "openai/gpt-oss-120b:free", name: "GPT OSS 120B" },
  { id: "qwen/qwen3-next-80b-a3b-instruct:free", name: "Qwen 3 Next 80B A3B" },
  { id: "liquid/lfm-2.5-1.2b-thinking:free", name: "LFM2.5 1.2B Thinking" },
  { id: "liquid/lfm-2.5-1.2b-instruct:free", name: "LFM2.5 1.2B Instruct" },
  { id: "cognitivecomputations/dolphin-mistral-24b-venice-edition:free", name: "Venice Uncensored" },
  { id: "nousresearch/hermes-3-llama-3.1-405b:free", name: "Hermes 3 405B" },
  { id: "meta-llama/llama-3.2-3b-instruct:free", name: "Llama 3.2 3B" },
  { id: "google/gemma-3n-e4b-it:free", name: "Gemma 3n 4B" },
  { id: "google/gemma-3n-e2b-it:free", name: "Gemma 3n 2B" },
];
