import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

// ==================== 服务器配置 ====================

export interface McpServerConfig {
  name: string;      // 服务器标识，仅用于日志和路由
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export const MCP_SERVERS: McpServerConfig[] = [
  // 内置：地理位置 & 时区
  {
    name: "location",
    command: "npx",
    args: ["ts-node", path.resolve("src/mcp/location-server.ts")],
  },

  // 文件系统（读写本地文件，无需 Key）
  {
    name: "filesystem",
    command: path.resolve("node_modules/.bin/mcp-server-filesystem"),
    args: [
      "C:\\",
      "D:\\",
    ],
  },

  // ── 在这里添加更多外部 MCP 服务器 ─────────────────────
  //
  // GitHub（读 Issues / PR / 代码，需要 GITHUB_TOKEN）：
  // {
  //   name: "github",
  //   command: "npx",
  //   args: ["-y", "@modelcontextprotocol/server-github"],
  //   env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN ?? "" },
  // },
  //
  // Brave 搜索（联网搜索，需要 BRAVE_API_KEY）：
  // {
  //   name: "brave-search",
  //   command: "npx",
  //   args: ["-y", "@modelcontextprotocol/server-brave-search"],
  //   env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY ?? "" },
  // },
  //
  // PostgreSQL（执行 SQL 查询）：
  // {
  //   name: "postgres",
  //   command: "npx",
  //   args: ["-y", "@modelcontextprotocol/server-postgres", process.env.DATABASE_URL ?? ""],
  // },
  // ────────────────────────────────────────────────────────
];

// ==================== 客户端管理 ====================

// 已连接的客户端缓存
const clients = new Map<string, Client>();
// 工具名 → 服务器 name 的路由表（在 getMcpTools 时填充）
const toolRouter = new Map<string, string>();

async function getClient(config: McpServerConfig): Promise<Client> {
  if (clients.has(config.name)) return clients.get(config.name)!;

  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    env: config.env ? { ...process.env, ...config.env } as Record<string, string> : undefined,
  });

  const client = new Client({ name: `chatbot-${config.name}`, version: "1.0.0" });
  await client.connect(transport);
  clients.set(config.name, client);
  return client;
}

// ==================== 对外接口 ====================

// 获取所有服务器的工具列表（转为 OpenAI tool 格式）
export async function getMcpTools() {
  const allTools: ReturnType<typeof buildToolDef>[] = [];

  for (const config of MCP_SERVERS) {
    try {
      const client = await getClient(config);
      const { tools } = await client.listTools();

      for (const tool of tools) {
        toolRouter.set(tool.name, config.name);
        allTools.push(buildToolDef(tool));
      }
    } catch {
      console.warn(`[MCP] 服务器 "${config.name}" 不可用，已跳过`);
    }
  }

  return allTools;
}

// 执行 MCP 工具，通过路由表找到对应服务器
export async function callMcpTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const toolName = name.replace(/^mcp__/, "");
  const serverName = toolRouter.get(toolName);

  if (!serverName) return `[MCP] 未找到工具: ${toolName}`;

  const config = MCP_SERVERS.find((s) => s.name === serverName);
  if (!config) return `[MCP] 服务器配置不存在: ${serverName}`;

  const client = await getClient(config);
  const result = await client.callTool({ name: toolName, arguments: args });
  const content = result.content as Array<{ type: string; text?: string }>;

  return content.map((c) => c.text ?? "").join("\n");
}

// ==================== 工具定义构建 ====================

function buildToolDef(tool: { name: string; description?: string; inputSchema: unknown }) {
  // 部分模型不接受 JSON Schema 扩展字段，清洗掉避免 400 报错
  const schema = tool.inputSchema as Record<string, unknown>;
  const { $schema, additionalProperties, ...cleanSchema } = schema ?? {};
  void $schema; void additionalProperties;

  return {
    type: "function" as const,
    function: {
      name: `mcp__${tool.name}`,
      description: tool.description ?? "",
      parameters: cleanSchema,
    },
  };
}
