import { useEffect, useRef } from "react";
import { ChatMessage } from "./hooks/useChat";
import { MarkdownMessage } from "./MarkdownMessage";

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
    <div className="px-4 py-6 space-y-6">
      {messages.map((message, index) => {
        const isEmptyAssistant =
          index === messages.length - 1 &&
          message.role === "assistant" &&
          message.content === "";

        const isUser = message.role === "user";

        return (
          <div
            key={index}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`${
                isUser
                  ? "max-w-[85%] rounded-2xl px-4 py-3 bg-purple-accent text-white"
                  : "w-full max-w-4xl"
              }`}
            >
              {isUser ? (
                <div className="text-sm whitespace-pre-wrap">
                  {message.content}
                </div>
              ) : (
                <div>
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
                    <MarkdownMessage
                      content={message.content}
                      isUser={isUser}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {isLoading && !isStreaming && messages.length > 0 && (
        <div className="flex justify-start">
          <div className="w-full max-w-4xl">
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
