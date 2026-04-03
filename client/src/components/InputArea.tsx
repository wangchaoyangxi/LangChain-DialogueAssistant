import { useState, type KeyboardEvent } from "react";
import "./InputArea.css";

interface Props {
  onSend: (text: string) => void;
  loading: boolean;
}

export default function InputArea({ onSend, loading }: Props) {
  const [value, setValue] = useState("");

  function handleSend() {
    if (!value.trim() || loading) return;
    onSend(value.trim());
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) handleSend();
  }

  return (
    <div className="input-area">
      <input
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入消息，按 Enter 发送..."
        disabled={loading}
      />
      <button className="send-btn" onClick={handleSend} disabled={loading}>
        {loading ? "..." : "发送"}
      </button>
    </div>
  );
}
