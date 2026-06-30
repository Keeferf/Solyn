// src/components/models/hooks/useHuggingFaceModels.ts
import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface HFModel {
  id: string;
  description?: string;
  pipeline_tag?: string;
  likes?: number;
  downloads?: number;
  size?: number;
  lastModified?: string;
  license?: string;
  tags?: string[];
  gguf_file?: string; // The GGUF filename
  isInstalled?: boolean;
}

export interface ModelDownloadProgress {
  modelId: string;
  status: "downloading" | "converting" | "complete" | "error";
  progress: number;
  message: string;
}

export const useHuggingFaceModels = (onModelInstalled: () => Promise<void>) => {
  const [models, setModels] = useState<HFModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(
    new Set(),
  );
  const [downloadProgress, setDownloadProgress] = useState<
    Map<string, ModelDownloadProgress>
  >(new Map());

  const searchModels = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setModels([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const results = await invoke<HFModel[]>("search_huggingface_models", {
        query: query.trim(),
        limit: 20,
      });
      setModels(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search models");
      console.error("Error searching Hugging Face models:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadModel = useCallback(async (modelId: string) => {
    setDownloadingModels((prev) => new Set(prev).add(modelId));

    try {
      await invoke("download_huggingface_model", { modelId });
    } catch (err) {
      setDownloadingModels((prev) => {
        const newSet = new Set(prev);
        newSet.delete(modelId);
        return newSet;
      });
      throw err;
    }
  }, []);

  // Set up progress event listeners
  useEffect(() => {
    let unlistenProgress: (() => void) | null = null;
    let unlistenError: (() => void) | null = null;

    const setupListeners = async () => {
      unlistenProgress = await listen<ModelDownloadProgress>(
        "model-download-progress",
        (event) => {
          const progress = event.payload;

          setDownloadProgress((prev) => {
            const newMap = new Map(prev);
            newMap.set(progress.modelId, progress);
            return newMap;
          });

          if (progress.status === "complete") {
            setDownloadingModels((prev) => {
              const newSet = new Set(prev);
              newSet.delete(progress.modelId);
              return newSet;
            });
            // Refresh installed models
            onModelInstalled();
          }

          if (progress.status === "error") {
            setDownloadingModels((prev) => {
              const newSet = new Set(prev);
              newSet.delete(progress.modelId);
              return newSet;
            });
          }
        },
      );

      unlistenError = await listen<string>("model-download-error", (event) => {
        setError(event.payload);
        // Try to extract model ID from error message
        const match = event.payload.match(/Error downloading (.+?):/);
        if (match) {
          const modelId = match[1];
          setDownloadingModels((prev) => {
            const newSet = new Set(prev);
            newSet.delete(modelId);
            return newSet;
          });
        }
      });
    };

    setupListeners();

    // Cleanup function
    return () => {
      if (unlistenProgress) {
        unlistenProgress();
      }
      if (unlistenError) {
        unlistenError();
      }
    };
  }, [onModelInstalled]);

  return {
    models,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    searchModels,
    downloadModel,
    downloadingModels,
    downloadProgress,
  };
};
