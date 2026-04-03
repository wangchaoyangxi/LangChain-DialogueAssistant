import config from "./config";
import { TOOLS as SKILL_TOOLS, executeSkill, type SkillContext } from "./skills";
import { getMcpTools, callMcpTool } from "./mcp/client";
import { reverseGeocode } from "./mcp/geocode";

type Role = "user" | "assistant" | "system" | "tool";
type Message = { role: Role; content: string; tool_call_id?: string; tool_calls?: ToolCall[] };
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

// ==================== 合并所有工具 ====================

async function getAllTools() {
  const mcpTools = await getMcpTools().catch(() => []);  // MCP 不可用时降级
  return [...SKILL_TOOLS, ...mcpTools];
}

// ==================== 对话历史 ====================

const sessionHistories = new Map<string, Message[]>();

function getHistory(sessionId: string): Message[] {
  if (!sessionHistories.has(sessionId)) {
    sessionHistories.set(sessionId, []);
  }
  return sessionHistories.get(sessionId)!;
}

// ==================== 流式请求 ====================

async function fetchStream(messages: Message[], model: string): Promise<Response> {
  const response = await fetch(`${config.anthropic.baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${config.anthropic.apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: config.model.maxTokens,
      temperature: config.model.temperature,
      messages,
      tools: await getAllTools(),
      stream: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`${response.status} ${err}`);
  }

  return response;
}

async function* readStream(response: Response): AsyncGenerator<{ text?: string; toolCalls?: ToolCall[] }> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const pendingToolCalls: Record<number, ToolCall> = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;

      try {
        const event = JSON.parse(data);
        const choice = event.choices?.[0];
        if (!choice) continue;

        const text = choice.delta?.content;
        if (text) yield { text };

        const toolCallDeltas = choice.delta?.tool_calls as Array<{
          index: number; id?: string;
          function?: { name?: string; arguments?: string };
        }> | undefined;

        if (toolCallDeltas) {
          for (const delta of toolCallDeltas) {
            const i = delta.index;
            if (!pendingToolCalls[i]) {
              pendingToolCalls[i] = { id: delta.id ?? "", type: "function", function: { name: "", arguments: "" } };
            }
            if (delta.id) pendingToolCalls[i].id = delta.id;
            if (delta.function?.name) pendingToolCalls[i].function.name += delta.function.name;
            if (delta.function?.arguments) pendingToolCalls[i].function.arguments += delta.function.arguments;
          }
        }

        if (choice.finish_reason === "tool_calls") {
          yield { toolCalls: Object.values(pendingToolCalls) };
        }
      } catch {
        // 忽略非 JSON 行
      }
    }
  }
}

// ==================== 执行 tool calls ====================

async function runToolCalls(toolCalls: ToolCall[], ctx: SkillContext): Promise<Message[]> {
  return Promise.all(
    toolCalls.map(async (call) => {
      const args = JSON.parse(call.function.arguments);
      // mcp__ 前缀的交给 MCP 执行，其余交给 Skills
      const result = call.function.name.startsWith("mcp__")
        ? await callMcpTool(call.function.name, args)
        : await executeSkill(call.function.name, args, ctx);
      return { role: "tool" as Role, tool_call_id: call.id, content: result };
    })
  );
}

// ==================== 主入口 ====================

export async function* chat(
  sessionId: string,
  input: string,
  model?: string,
  location?: { lat: number; lon: number }
) {
  const history = getHistory(sessionId);
  history.push({ role: "user", content: input });

  const ctx: SkillContext = { location };
  const usedModel = model ?? config.model.name;

  // 预查地址，让模型能直接回答"我在哪里"
  let locationHint = "";
  if (location) {
    try {
      const geo = await reverseGeocode(location.lat, location.lon);
      locationHint = `\n\n用户当前位置：${geo.city}，${geo.state}，${geo.country}（坐标：${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}）。当用户询问位置或当前天气时，直接使用此信息。`;
    } catch {
      locationHint = `\n\n用户当前位置坐标：纬度 ${location.lat.toFixed(4)}，经度 ${location.lon.toFixed(4)}。`;
    }
  }

  const messages: Message[] = [
    { role: "system", content: config.chat.systemPrompt + locationHint },
    ...history,
  ];

  let assistantText = "";
  let toolCalls: ToolCall[] | undefined;

  for await (const chunk of readStream(await fetchStream(messages, usedModel))) {
    if (chunk.text) { assistantText += chunk.text; yield chunk.text; }
    if (chunk.toolCalls) toolCalls = chunk.toolCalls;
  }

  if (toolCalls && toolCalls.length > 0) {
    messages.push({ role: "assistant", content: "", tool_calls: toolCalls });
    yield "\n\n⏳ 正在查询...";

    const toolResults = await runToolCalls(toolCalls, ctx);
    messages.push(...toolResults);

    yield "\n\n";
    assistantText = "";

    for await (const chunk of readStream(await fetchStream(messages, usedModel))) {
      if (chunk.text) { assistantText += chunk.text; yield chunk.text; }
    }
  }

  history.push({ role: "assistant", content: assistantText });
}
