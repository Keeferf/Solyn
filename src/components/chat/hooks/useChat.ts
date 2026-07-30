// src/components/chat/hooks/useChat.ts
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

export interface ChatSession {
  id: number;
  title: string;
  model_name: string;
  created_at: string;
  updated_at: string;
}

export interface StoredChatMessage {
  id: number;
  session_id: number;
  role: string;
  content: string;
  created_at: string;
}

export interface ChatSessionWithMessages {
  session: ChatSession;
  messages: StoredChatMessage[];
}

export const useChat = (modelData: ChatModelData | undefined) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  const unlistenRefs = useRef<UnlistenFn[]>([]);
  const { isReady } = useOllama();
  const isOllamaReady = isReady;

  // Load all sessions
  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const result = await invoke<ChatSession[]>("get_chat_sessions");
      setSessions(result);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setIsLoadingSessions(false);
    }
  }, []);

  // Load a specific session with messages
  const loadSession = useCallback(async (sessionId: number) => {
    setIsLoading(true);
    try {
      const result = await invoke<ChatSessionWithMessages | null>(
        "get_chat_session",
        { sessionId },
      );
      if (result) {
        // Convert stored messages to chat messages
        const chatMessages: ChatMessage[] = result.messages.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        }));
        setMessages(chatMessages);
        setCurrentSessionId(sessionId);
        setError(null);
      }
    } catch (err) {
      console.error("Failed to load session:", err);
      setError(err as string);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create a new session
  const createSession = useCallback(
    async (modelName: string, title?: string) => {
      try {
        const sessionId = await invoke<number>("create_chat_session", {
          request: {
            model_name: modelName,
            title: title || `Chat with ${modelName}`,
          },
        });
        await loadSessions();
        return sessionId;
      } catch (err) {
        console.error("Failed to create session:", err);
        throw err;
      }
    },
    [loadSessions],
  );

  // Delete a session
  const deleteSession = useCallback(
    async (sessionId: number) => {
      try {
        await invoke("delete_chat_session", { sessionId });
        await loadSessions();
        if (currentSessionId === sessionId) {
          setMessages([]);
          setCurrentSessionId(null);
        }
      } catch (err) {
        console.error("Failed to delete session:", err);
        throw err;
      }
    },
    [currentSessionId, loadSessions],
  );

  // Update session title
  const updateSessionTitle = useCallback(
    async (sessionId: number, title: string) => {
      try {
        await invoke("update_chat_session_title", { sessionId, title });
        await loadSessions();
      } catch (err) {
        console.error("Failed to update session title:", err);
        throw err;
      }
    },
    [loadSessions],
  );

  // Send message with session support
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
    setIsStreaming(true);

    // If no session exists, create one
    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        sessionId = await createSession(modelData.ollama_model_name);
        setCurrentSessionId(sessionId);
      } catch (err) {
        setError("Failed to create chat session");
        setIsLoading(false);
        setIsStreaming(false);
        return;
      }
    }

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
          session_id: sessionId, // Pass session ID to save messages
        },
      });

      // Reload sessions to update the list
      await loadSessions();
    } catch (err) {
      console.error("Error sending message:", err);
      setError(err as string);
      setIsLoading(false);
      setIsStreaming(false);

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
    setCurrentSessionId(null);
  }, []);

  // Start new chat without clearing sessions
  const startNewChat = useCallback(async () => {
    setMessages([]);
    setError(null);
    setCurrentSessionId(null);
    // Don't clear sessions, just start a new conversation
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

        // Listen for the complete response (only one chunk with full content)
        const unlistenChunk = await listen<{ chunk: string }>(
          "chat-stream-chunk",
          (event) => {
            const fullContent = event.payload.chunk;
            console.log(
              "Received complete response, length:",
              fullContent.length,
            );

            // Update the last message with the complete content
            setMessages((prev) => {
              const updated = [...prev];
              const lastIndex = updated.length - 1;
              if (lastIndex >= 0 && updated[lastIndex].role === "assistant") {
                updated[lastIndex] = {
                  ...updated[lastIndex],
                  content: fullContent,
                };
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
          setIsStreaming(false);
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
            setIsStreaming(false);
          },
        );
        unlistenRefs.current.push(unlistenError);

        console.log("Chat event listeners set up successfully");
      } catch (err) {
        console.error("Failed to set up chat listeners:", err);
      }
    };

    setupListeners();
    loadSessions();

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
  }, [loadSessions]);

  return {
    messages,
    isLoading,
    isStreaming,
    error,
    isOllamaReady,
    sessions,
    isLoadingSessions,
    currentSessionId,
    sendMessage,
    clearMessages,
    startNewChat,
    loadSessions,
    loadSession,
    createSession,
    deleteSession,
    updateSessionTitle,
  };
};
