import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { chat, pendingConfirms } from "./chatbot";
import config from "./config";

const app = new Hono();

app.use("/*", serveStatic({ root: "./public" }));

app.post("/api/chat", async (c) => {
  const { message, sessionId, model, location } = await c.req.json();

  return streamSSE(c, async (stream) => {
    try {
      for await (const chunk of chat(sessionId, message, model, location)) {
        await stream.writeSSE({ data: chunk });
      }
      await stream.writeSSE({ data: "[DONE]" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[chat error]", msg);
      await stream.writeSSE({ data: `[ERROR] ${msg}` });
      await stream.writeSSE({ data: "[DONE]" });
    }
  });
});

// 用户确认/拒绝文件操作
app.post("/api/confirm/:id", async (c) => {
  const id = c.req.param("id");
  const { approved } = await c.req.json<{ approved: boolean }>();
  const resolve = pendingConfirms.get(id);
  if (!resolve) return c.json({ ok: false, error: "not found" }, 404);
  resolve(approved);
  return c.json({ ok: true });
});

serve({ fetch: app.fetch, port: config.server.port }, () => {
  console.log(`服务启动: http://localhost:${config.server.port}`);
});
