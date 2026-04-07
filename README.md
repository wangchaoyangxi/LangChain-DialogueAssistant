# My Chatbot

基于 **TypeScript + Hono + React** 构建的全栈 AI 聊天助手，通过 OpenRouter 接入多种大语言模型，支持流式输出、工具调用和 MCP 协议。

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
└── package.json
```

## 快速开始

**1. 安装依赖**

```bash
npm install
cd client && npm install && cd ..
```

**2. 配置环境变量**

复制 `.env` 并填写：

```env
API_KEY=your_openrouter_api_key
BASE_URL=https://openrouter.ai/api/v1
MODEL_NAME=deepseek/deepseek-chat-v3-0324:free
SYSTEM_PROMPT=你是一个友善的助手，回答简洁明了。
PORT=3000
```

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

在 [src/skills.ts](src/skills.ts) 中按照 `Skill` 接口定义新工具，加入 `SKILLS` 数组即可自动注册。
