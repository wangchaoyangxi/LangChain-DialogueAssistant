import config from "./config";

type Message = { role: "user" | "assistant" | "system"; content: string };

const sessionHistories = new Map<string, Message[]>();

function getHistory(sessionId: string): Message[] {
  if (!sessionHistories.has(sessionId)) {
    sessionHistories.set(sessionId, []);
  }
  return sessionHistories.get(sessionId)!;
}

export async function* chat(sessionId: string, input: string, model?: string) {
  const history = getHistory(sessionId);
  history.push({ role: "user", content: input });

  const messages: Message[] = [
    { role: "system", content: config.chat.systemPrompt },
    ...history,
  ];

  const response = await fetch(`${config.anthropic.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${config.anthropic.apiKey}`,
    },
    body: JSON.stringify({
      model: model ?? config.model.name,
      max_tokens: config.model.maxTokens,
      temperature: config.model.temperature,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${response.status} ${err}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let assistantMessage = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") break;

      try {
        const event = JSON.parse(data);
        const text = event.choices?.[0]?.delta?.content;
        if (text) {
          assistantMessage += text;
          yield text;
        }
      } catch {
        // 忽略非 JSON 行
      }
    }
  }

  history.push({ role: "assistant", content: assistantMessage });
}
