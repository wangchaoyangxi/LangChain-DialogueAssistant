import "dotenv/config";

const config = {
  anthropic: {
    apiKey: process.env.API_KEY ?? "",
    baseURL: process.env.BASE_URL ?? "https://openrouter.ai/api/v1",
  },
  model: {
    name: process.env.MODEL_NAME ?? "deepseek/deepseek-chat-v3-0324:free",
    temperature: parseFloat(process.env.TEMPERATURE ?? "0.7"),
    maxTokens: parseInt(process.env.MAX_TOKENS ?? "2048"),
  },
  chat: {
    systemPrompt: process.env.SYSTEM_PROMPT ?? "你是一个友善的助手，回答简洁明了。",
  },
  server: {
    port: parseInt(process.env.PORT ?? "3000"),
  },
};

export default config;
