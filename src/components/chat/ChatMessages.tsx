import { useEffect, useRef } from "react";
import { ChatMessage } from "./hooks/useChat";

interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  isOllamaReady: boolean;
}

export const ChatMessages = ({
  messages,
  isLoading,
  error,
  isOllamaReady: _isOllamaReady, // Prefix with underscore to mark as intentionally unused
}: ChatMessagesProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message, index) => (
        <div
          key={index}
          className={`flex ${
            message.role === "user" ? "justify-end" : "justify-start"
          }`}
        >
          <div
            className={`max-w-[80%] rounded-lg px-4 py-2 ${
              message.role === "user"
                ? "bg-purple-accent text-white"
                : "bg-white/5 text-white/90"
            }`}
          >
            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
          </div>
        </div>
      ))}

      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-white/5 rounded-lg px-4 py-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce delay-200" />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex justify-center">
          <div className="bg-red-500/10 text-red-400 rounded-lg px-4 py-2 text-sm">
            Error: {error}
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
