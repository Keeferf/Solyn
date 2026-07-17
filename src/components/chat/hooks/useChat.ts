import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useOllama } from "@/contexts/OllamaContext";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatModelData {
  model_id: string;
  filename: string;
}

export const useChat = (modelData: ChatModelData | undefined) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageBufferRef = useRef<string>("");
  const { isReady, status: _status } = useOllama(); // Prefix with underscore to mark as intentionally unused
  const isOllamaReady = isReady;

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading || !modelData) return;
    if (!isOllamaReady) {
      setError("Ollama is not running. Please wait for it to start.");
      return;
    }

    setError(null);
    setIsLoading(true);
    messageBufferRef.current = "";

    setMessages((prev) => [...prev, { role: "user", content: content.trim() }]);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const chatHistory = [
        ...messages,
        { role: "user", content: content.trim() },
      ];

      await invoke("create_ollama_model", {
        modelId: modelData.model_id,
        filename: modelData.filename,
      });

      await invoke("send_chat_stream", {
        request: {
          model_id: modelData.model_id,
          filename: modelData.filename,
          messages: chatHistory,
        },
      });
    } catch (err) {
      setError(err as string);
      setIsLoading(false);
      messageBufferRef.current = "";

      setMessages((prev) => {
        const updated = [...prev];
        if (
          updated.length > 0 &&
          updated[updated.length - 1].role === "assistant"
        ) {
          updated.pop();
        }
        return updated;
      });
    }
  };

  const clearMessages = () => {
    setMessages([]);
    setError(null);
    messageBufferRef.current = "";
  };

  useEffect(() => {
    let unlistenChunk: (() => void) | undefined;
    let unlistenDone: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        const unlisten = await listen("chat-stream-chunk", (event) => {
          const { chunk } = event.payload as { chunk: string };
          messageBufferRef.current += chunk;

          setMessages((prev) => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            if (lastIndex >= 0 && updated[lastIndex].role === "assistant") {
              updated[lastIndex] = {
                ...updated[lastIndex],
                content: messageBufferRef.current,
              };
            } else {
              updated.push({
                role: "assistant",
                content: messageBufferRef.current,
              });
            }
            return updated;
          });
        });
        unlistenChunk = unlisten;

        const unlistenDoneFn = await listen("chat-stream-done", () => {
          setIsLoading(false);
          messageBufferRef.current = "";
        });
        unlistenDone = unlistenDoneFn;

        const unlistenErrorFn = await listen("chat-stream-error", (event) => {
          const { error: errorMsg } = event.payload as { error: string };
          setError(errorMsg);
          setIsLoading(false);
          messageBufferRef.current = "";
        });
        unlistenError = unlistenErrorFn;
      } catch (err) {
        console.error("Failed to set up chat listeners:", err);
      }
    };

    setupListeners();

    return () => {
      if (unlistenChunk) unlistenChunk();
      if (unlistenDone) unlistenDone();
      if (unlistenError) unlistenError();
    };
  }, []);

  return {
    messages,
    isLoading,
    error,
    isOllamaReady,
    sendMessage,
    clearMessages,
  };
};
