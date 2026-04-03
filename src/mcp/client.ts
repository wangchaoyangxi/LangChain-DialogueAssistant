import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

let mcpClient: Client | null = null;

export async function getMcpClient(): Promise<Client> {
  if (mcpClient) return mcpClient;

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["ts-node", path.resolve("src/mcp/location-server.ts")],
  });

  mcpClient = new Client({ name: "chatbot-client", version: "1.0.0" });
  await mcpClient.connect(transport);

  return mcpClient;
}

// 获取 MCP 提供的工具列表（转为 OpenAI tool 格式）
export async function getMcpTools() {
  const client = await getMcpClient();
  const { tools } = await client.listTools();

  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: `mcp__${tool.name}`,   // 加前缀避免与 skill 冲突
      description: tool.description ?? "",
      parameters: tool.inputSchema,
    },
  }));
}

// 执行 MCP 工具
export async function callMcpTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const client = await getMcpClient();
  const toolName = name.replace(/^mcp__/, "");    // 去掉前缀

  const result = await client.callTool({ name: toolName, arguments: args });
  const content = result.content as Array<{ type: string; text?: string }>;

  return content.map((c) => c.text ?? "").join("\n");
}
