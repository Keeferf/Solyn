import { useEffect, useRef } from "react";
import { ChatMessage } from "./hooks/useChat";

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  isOllamaReady: boolean;
}

export const ChatMessages = ({
  messages,
  isLoading,
  isStreaming,
  error,
  isOllamaReady: _isOllamaReady,
}: ChatMessagesProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message, index) => {
        const isEmptyAssistant =
          index === messages.length - 1 &&
          message.role === "assistant" &&
          message.content === "";

        return (
          <div
            key={index}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`rounded-lg px-4 py-2 max-w-[80%] ${
                message.role === "user"
                  ? "bg-purple-accent text-white"
                  : "bg-white/10 text-white/90 border border-white/10"
              }`}
            >
              {isEmptyAssistant && isStreaming ? (
                <div className="flex space-x-1">
                  <div
                    className="w-2 h-2 bg-purple-accent/60 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <div
                    className="w-2 h-2 bg-purple-accent/60 rounded-full animate-bounce"
                    style={{ animationDelay: "200ms" }}
                  />
                  <div
                    className="w-2 h-2 bg-purple-accent/60 rounded-full animate-bounce"
                    style={{ animationDelay: "400ms" }}
                  />
                </div>
              ) : (
                <div className="text-sm whitespace-pre-wrap wrap-break-word">
                  {message.content}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {isLoading && !isStreaming && messages.length > 0 && (
        <div className="flex justify-start">
          <div className="bg-white/10 rounded-lg px-4 py-2 border border-white/10">
            <div className="flex space-x-1">
              <div
                className="w-2 h-2 bg-purple-accent/60 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <div
                className="w-2 h-2 bg-purple-accent/60 rounded-full animate-bounce"
                style={{ animationDelay: "200ms" }}
              />
              <div
                className="w-2 h-2 bg-purple-accent/60 rounded-full animate-bounce"
                style={{ animationDelay: "400ms" }}
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex justify-center">
          <div className="bg-error-bg text-error border border-error-border rounded-lg px-4 py-2 text-sm">
            Error: {error}
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
