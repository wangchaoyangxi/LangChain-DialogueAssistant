import { useState, useRef, useEffect } from "react";
import MessageItem from "./components/MessageItem";
import InputArea from "./components/InputArea";
import { FREE_MODELS } from "./models";
import "./App.css";

export interface Message {
  role: "user" | "bot";
  content: string;
}

const SESSION_ID = "user_" + Date.now();

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState(FREE_MODELS[0].id);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    setMessages((prev) => [...prev, { role: "bot", content: "" }]);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, sessionId: SESSION_ID, model }),
    });

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let raw = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split("\n");
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") break;
        raw += data;

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "bot", content: raw };
          return updated;
        });
      }
    }

    setLoading(false);
  }

  return (
    <div className="app">
      <header className="header">
        <span>🤖 聊天机器人</span>
        <select
          className="model-select"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={loading}
        >
          {FREE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </header>

      <div className="messages">
        {messages.length === 0 && (
          <div className="empty">有什么我可以帮你的吗？</div>
        )}
        {messages.map((msg, i) => (
          <MessageItem
            key={i}
            message={msg}
            streaming={loading && i === messages.length - 1}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <InputArea onSend={sendMessage} loading={loading} />
    </div>
  );
}
