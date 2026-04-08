# My Chatbot

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/your-username/my-chatbot/actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org)

基于 **TypeScript + Hono + React** 构建的全栈 AI 聊天助手，通过 OpenRouter 接入多种大语言模型，支持流式输出、工具调用和 MCP 协议。

## 演示

**对话界面** — 让 AI 创建文件，多轮工具调用自动完成：

![聊天界面演示](docs/images/demo-chat.png)

**文件结果** — 生成的文件直接出现在 `workspace/` 目录中：

![VSCode 文件树](docs/images/demo-workspace.png)

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | [Hono](https://hono.dev/) + ts-node |
| 前端 | React 18 + Vite + react-markdown |
| AI 接入 | OpenRouter API（兼容 OpenAI 格式） |
| 工具协议 | MCP（Model Context Protocol） |

## 主要功能

- **流式对话**：SSE 实时输出，响应不卡顿
- **多会话隔离**：每个 sessionId 独立维护对话历史
- **工具调用**：内置天气查询（wttr.in），可扩展更多 Skill
- **MCP 支持**：通过 `@modelcontextprotocol/sdk` 接入外部工具服务
- **地理位置**：前端上报坐标，后端逆地理编码后注入上下文
- **多模型切换**：前端可选模型，默认 `deepseek/deepseek-chat-v3-0324:free`

## 目录结构

```
my-chatbot/
├── src/
│   ├── server.ts       # Hono 服务器，SSE /api/chat 接口
│   ├── chatbot.ts      # 对话核心逻辑（流式请求 + 工具调用）
│   ├── skills.ts       # 内置 Skill 定义（天气等）
│   ├── config.ts       # 环境变量统一配置
│   └── mcp/            # MCP 客户端 & 地理编码
├── client/             # React 前端（Vite 构建）
├── public/             # 静态资源（后端托管）
├── .env.example        # 环境变量示例
└── package.json
```

## 快速开始

**1. 安装依赖**

```bash
npm install
cd client && npm install && cd ..
```

**2. 配置环境变量**

```bash
cp .env.example .env
```

编辑 `.env`，至少填写 `API_KEY`（从 [OpenRouter](https://openrouter.ai/keys) 获取）。

**3. 开发模式启动**

```bash
npm run dev
```

前端访问 `http://localhost:5173`，后端运行在 `http://localhost:3000`。

**4. 生产构建**

```bash
npm run build
npm start
```

## 扩展 Skill

在 [src/skills.ts](src/skills.ts) 中按照 `Skill` 接口定义新工具，加入 `SKILLS` 数组即可自动注册，无需修改其他文件。

## MCP 支持

[MCP（Model Context Protocol）](https://modelcontextprotocol.io) 是 Anthropic 推出的开放协议，允许 AI 通过标准接口调用外部工具服务。本项目通过子进程 stdio 方式内置了一个 MCP 服务器。

### 架构

```
chatbot.ts
  ├── Skills（本地直接调用）
  │     └── get_weather
  └── MCP Client（多服务器 stdio）
        ├── location   → mcp__reverse_geocode, mcp__get_timezone
        ├── github     → mcp__search_repositories, mcp__get_issue ...
        └── filesystem → mcp__read_file, mcp__write_file ...
```

每次对话时，`chatbot.ts` 自动合并所有 Skills 和所有 MCP 服务器的工具，统一传给模型。MCP 工具名加 `mcp__` 前缀，内部路由表负责把调用分发到对应服务器。

### 内置 MCP 工具

| 工具 | 说明 | 依赖服务 |
|------|------|----------|
| `reverse_geocode` | 经纬度 → 可读地址（城市/省份/国家） | OpenStreetMap Nominatim（免费，无需 Key） |
| `get_timezone` | 经纬度 → 时区和当地时间 | timeapi.io（免费，无需 Key） |

> 这两个工具在前端开启地理位置授权后可直接使用，模型会在用户询问位置或时间相关问题时自动调用。

### 添加新的 MCP 工具

在 [src/mcp/location-server.ts](src/mcp/location-server.ts) 中用 `server.tool()` 注册新工具即可：

```typescript
server.tool(
  "tool_name",           // 工具名（前端调用时会自动加 mcp__ 前缀）
  "工具描述",
  { param: z.string().describe("参数说明") },
  async ({ param }) => {
    // 实现逻辑
    return { content: [{ type: "text", text: "结果" }] };
  }
);
```

### 接入外部 MCP 服务器

在 [src/mcp/client.ts](src/mcp/client.ts) 的 `MCP_SERVERS` 数组里追加配置即可，支持同时接入多个服务器，工具路由自动处理。

```typescript
export const MCP_SERVERS: McpServerConfig[] = [
  // 内置 location 服务器（保留）
  { name: "location", command: "npx", args: ["ts-node", "..."] },

  // 追加外部服务器 ↓
  {
    name: "filesystem",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/your/dir"],
  },
];
```

#### 常用外部服务器

| 服务器 | 包名 | 功能 | 需要 Key |
|--------|------|------|----------|
| 文件系统 | `@modelcontextprotocol/server-filesystem` | 读写本地文件 | 无 |
| GitHub | `@modelcontextprotocol/server-github` | 读 Issues / PR / 代码搜索 | `GITHUB_TOKEN` |
| Brave 搜索 | `@modelcontextprotocol/server-brave-search` | 联网实时搜索 | `BRAVE_API_KEY` |
| PostgreSQL | `@modelcontextprotocol/server-postgres` | 执行 SQL 查询 | 数据库连接串 |
| Puppeteer | `@modelcontextprotocol/server-puppeteer` | 浏览器自动化 / 截图 | 无 |

#### 完整示例：同时接入 GitHub + 文件系统

**1. `.env` 中添加所需 Key：**

```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
```

**2. 在 `MCP_SERVERS` 中添加配置：**

```typescript
{
  name: "github",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-github"],
  env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN ?? "" },
},
{
  name: "filesystem",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "./workspace"],
},
```

**3. 启动后可直接对话：**

```
你：帮我搜索一下仓库里关于 MCP 的 Issue
你：读取 ./workspace/notes.txt 的内容
```

模型会自动选择对应工具完成任务，无需手动指定。

## 参与贡献

欢迎提交 Issue 和 Pull Request，请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 安全

如发现安全漏洞，请参考 [SECURITY.md](SECURITY.md) 进行私下报告，勿使用公开 Issue。

## 许可证

[MIT](LICENSE)
