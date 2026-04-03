import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { chat } from "./chatbot";
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

serve({ fetch: app.fetch, port: config.server.port }, () => {
  console.log(`服务启动: http://localhost:${config.server.port}`);
});
