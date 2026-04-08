import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Message } from "../App";
import "./MessageItem.css";

interface Props {
  message: Message;
  streaming?: boolean;
}

export default function MessageItem({ message, streaming }: Props) {
  const isBot = message.role === "bot";

  return (
    <div className={`message ${message.role}`}>
      {isBot ? (
        <>
          {streaming && !message.content ? (
            <span className="thinking">
              <div>{"思考中"}</div>
              <span />
              <span />
              <span />
            </span>
          ) : (
            <ReactMarkdown
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const isBlock = match != null;
                  return isBlock ? (
                    <SyntaxHighlighter
                      style={oneLight}
                      language={match[1]}
                      PreTag="div"
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.content || " "}
            </ReactMarkdown>
          )}
          {streaming && message.content && <span className="cursor" />}
        </>
      ) : (
        <span>{message.content}</span>
      )}
    </div>
  );
}
