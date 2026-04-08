import config from "./config";
import { TOOLS as SKILL_TOOLS, executeSkill, SKILL_CONFIRM_SET, type SkillContext } from "./skills";
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
      if (data === "[DONE]") {
          // 部分 API 在 [DONE] 前不单独发 finish_reason: "tool_calls"
          // 此处兜底：如果还有未 yield 的 toolCalls，先 yield 再退出
          const pending = Object.values(pendingToolCalls);
          if (pending.length > 0) yield { toolCalls: pending };
          return;
        }

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

// ==================== 文件操作确认机制 ====================

// 需要用户确认的 MCP 文件系统工具
const FS_WRITE_TOOLS = new Set([
  "write_file", "edit_file", "create_directory", "move_file",
]);

// 挂起的确认请求 Map：id → { resolve }
export const pendingConfirms = new Map<string, (approved: boolean) => void>();

export interface ConfirmRequest {
  id: string;
  tool: string;        // 工具名（不含 mcp__ 前缀）
  path?: string;       // 涉及的路径（方便用户判断）
}

// ==================== 执行 tool calls ====================

async function* runToolCalls(
  toolCalls: ToolCall[],
  ctx: SkillContext
): AsyncGenerator<string, Message[]> {
  const results: Message[] = [];

  for (const call of toolCalls) {
    let result: string;
    try {
      const args = JSON.parse(call.function.arguments || "{}");
      const isMcpWriteTool = call.function.name.startsWith("mcp__") &&
        FS_WRITE_TOOLS.has(call.function.name.replace(/^mcp__/, ""));
      const isSkillConfirm = !call.function.name.startsWith("mcp__") &&
        SKILL_CONFIRM_SET.has(call.function.name);
      const isFsTool = isMcpWriteTool || isSkillConfirm;

      if (isFsTool) {
        // 生成确认请求，发给前端
        const id = Math.random().toString(36).slice(2);
        const toolName = call.function.name.replace(/^mcp__/, "");
        const req: ConfirmRequest = { id, tool: toolName, path: args.path ?? args.source ?? "" };
        yield `[CONFIRM:${JSON.stringify(req)}]`;

        // 挂起，等待用户操作（最多 10 分钟）
        let timedOut = false;
        const approved = await Promise.race([
          new Promise<boolean>((resolve) => pendingConfirms.set(id, resolve)),
          new Promise<boolean>((resolve) => setTimeout(() => { timedOut = true; resolve(false); }, 600_000)),
        ]);
        pendingConfirms.delete(id);

        if (!approved) {
          result = timedOut ? "确认超时（10 分钟），操作已自动取消。" : "用户已拒绝该操作。";
        } else {
          result = call.function.name.startsWith("mcp__")
            ? await callMcpTool(call.function.name, args)
            : await executeSkill(call.function.name, args, ctx);
        }
      } else {
        result = call.function.name.startsWith("mcp__")
          ? await callMcpTool(call.function.name, args)
          : await executeSkill(call.function.name, args, ctx);
      }
    } catch (e) {
      result = `工具调用失败: ${e instanceof Error ? e.message : String(e)}`;
    }

    results.push({ role: "tool" as Role, tool_call_id: call.id, content: result });
  }

  return results;
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

  // 循环处理多轮工具调用，直到模型不再请求工具为止
  while (toolCalls && toolCalls.length > 0) {
    messages.push({ role: "assistant", content: "", tool_calls: toolCalls });
    yield "[CLEAR]";

    const toolResults: Message[] = [];
    const gen = runToolCalls(toolCalls, ctx);
    let step = await gen.next();
    while (!step.done) {
      yield step.value;          // 转发 [CONFIRM:...] 或其他中间事件
      step = await gen.next();
    }
    toolResults.push(...step.value);  // generator return 值即 Message[]
    messages.push(...toolResults);

    yield "\n\n";
    assistantText = "";
    toolCalls = undefined;

    for await (const chunk of readStream(await fetchStream(messages, usedModel))) {
      if (chunk.text) { assistantText += chunk.text; yield chunk.text; }
      if (chunk.toolCalls) toolCalls = chunk.toolCalls;
    }
  }

  history.push({ role: "assistant", content: assistantText });
}
