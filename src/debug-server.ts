import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

// 捕获所有请求，打印 headers
app.all("*", async (c) => {
  console.log("\n========== 捕获到请求 ==========");
  console.log("Method:", c.req.method);
  console.log("Path:", c.req.path);
  console.log("Headers:");
  c.req.raw.headers.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });
  console.log("=================================\n");

  // 返回假数据避免 Claude Code 报错
  return c.json({
    id: "msg_debug",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text: "debug" }],
    model: "debug",
    stop_reason: "end_turn",
    usage: { input_tokens: 1, output_tokens: 1 },
  });
});

serve({ fetch: app.fetch, port: 9999 }, () => {
  console.log("调试服务器启动: http://localhost:9999");
  console.log("请将 Claude Code 的 ANTHROPIC_BASE_URL 临时改为 http://localhost:9999");
});
