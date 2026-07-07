// src/components/chat/hooks/useChat.ts (updated)
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

  // Use Ollama context instead of checking health directly
  const { isReady, status } = useOllama();
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

    // Add user message to UI
    setMessages((prev) => [...prev, { role: "user", content: content.trim() }]);

    // Add placeholder for assistant response
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      // Prepare the message history for the backend
      const chatHistory = [
        ...messages,
        { role: "user", content: content.trim() },
      ];

      // First, ensure the model is created in Ollama
      await invoke("create_ollama_model", {
        modelId: modelData.model_id,
        filename: modelData.filename,
      });

      // Send the message with streaming
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

      // Remove the placeholder if there was an error
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

  // Setup streaming listeners
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
