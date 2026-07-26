import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useOllama } from "@/contexts/OllamaContext";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatModelData {
  model_id: string;
  filename: string;
  ollama_model_name: string;
}

export const useChat = (modelData: ChatModelData | undefined) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messageBufferRef = useRef<string>("");
  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const { isReady } = useOllama();
  const isOllamaReady = isReady;

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading || !modelData) {
      console.log("Cannot send message:", {
        hasContent: !!content.trim(),
        isLoading,
        hasModelData: !!modelData,
      });
      return;
    }

    if (!isOllamaReady) {
      setError("Ollama is not running. Please wait for it to start.");
      return;
    }

    if (!modelData.ollama_model_name) {
      setError(
        "Selected model has no Ollama name. Please reinstall the model.",
      );
      return;
    }

    console.log("Sending message with model:", modelData.ollama_model_name);

    setError(null);
    setIsLoading(true);
    messageBufferRef.current = "";

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: content.trim() }]);

    // Add placeholder assistant message
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const chatHistory = [
        ...messages,
        { role: "user", content: content.trim() },
      ];

      await invoke("send_chat_stream", {
        request: {
          model: modelData.ollama_model_name,
          messages: chatHistory,
        },
      });
    } catch (err) {
      console.error("Error sending message:", err);
      setError(err as string);
      setIsLoading(false);
      messageBufferRef.current = "";

      // Remove the empty assistant message on error
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

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    messageBufferRef.current = "";
  }, []);

  // Setup event listeners
  useEffect(() => {
    const setupListeners = async () => {
      try {
        // Clean up any existing listeners
        unlistenRefs.current.forEach((unlisten) => {
          try {
            unlisten();
          } catch (e) {
            console.error("Error cleaning up listener:", e);
          }
        });
        unlistenRefs.current = [];

        console.log("Setting up chat event listeners...");

        // Listen for chunk events
        const unlistenChunk = await listen<{ chunk: string }>(
          "chat-stream-chunk",
          (event) => {
            const { chunk } = event.payload;
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
          },
        );
        unlistenRefs.current.push(unlistenChunk);

        // Listen for done events
        const unlistenDone = await listen("chat-stream-done", () => {
          console.log("Chat stream completed");
          setIsLoading(false);
          messageBufferRef.current = "";
        });
        unlistenRefs.current.push(unlistenDone);

        // Listen for error events
        const unlistenError = await listen<{ error: string }>(
          "chat-stream-error",
          (event) => {
            const { error: errorMsg } = event.payload;
            console.error("Chat stream error:", errorMsg);
            setError(errorMsg);
            setIsLoading(false);
            messageBufferRef.current = "";
          },
        );
        unlistenRefs.current.push(unlistenError);

        console.log("Chat event listeners set up successfully");
      } catch (err) {
        console.error("Failed to set up chat listeners:", err);
      }
    };

    setupListeners();

    // Cleanup function
    return () => {
      console.log("Cleaning up chat event listeners...");
      unlistenRefs.current.forEach((unlisten) => {
        try {
          unlisten();
        } catch (e) {
          console.error("Error cleaning up listener:", e);
        }
      });
      unlistenRefs.current = [];
    };
  }, []); // Empty dependency array - setup once

  return {
    messages,
    isLoading,
    error,
    isOllamaReady,
    sendMessage,
    clearMessages,
  };
};
