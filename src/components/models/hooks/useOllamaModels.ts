// src/components/models/hooks/useOllamaModels.ts
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model: string;
    format: string;
    family: string;
    families?: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface ModelPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export const useOllamaModels = (refreshTrigger: number) => {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pullingModels, setPullingModels] = useState<Set<string>>(new Set());
  const [pullProgress, setPullProgress] = useState<
    Map<string, ModelPullProgress>
  >(new Map());

  const fetchModels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const modelList = await invoke<OllamaModel[]>("list_ollama_models");
      setModels(modelList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load models");
      console.error("Error fetching models:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const pullModel = useCallback(async (modelName: string) => {
    setPullingModels((prev) => new Set(prev).add(modelName));
    setError(null);

    try {
      await invoke("pull_ollama_model", { modelName });
      // The actual completion will be handled by the pull-progress events
    } catch (err) {
      setPullingModels((prev) => {
        const newSet = new Set(prev);
        newSet.delete(modelName);
        return newSet;
      });
      throw err;
    }
  }, []);

  const deleteModel = useCallback(
    async (modelName: string) => {
      try {
        await invoke("delete_ollama_model", { modelName });
        await fetchModels(); // Refresh the list
      } catch (err) {
        throw new Error(
          err instanceof Error ? err.message : "Failed to delete model",
        );
      }
    },
    [fetchModels],
  );

  // Fetch models on mount and when refreshTrigger changes
  useEffect(() => {
    fetchModels();
  }, [fetchModels, refreshTrigger]);

  // Set up progress event listeners
  useEffect(() => {
    const unlistenPullProgress = listen<ModelPullProgress>(
      "model-pull-progress",
      (event) => {
        const progress = event.payload;
        console.log("Pull progress:", progress);

        // If status is "success" or "completed", refresh the model list
        if (progress.status === "success" || progress.status === "completed") {
          // Remove from pulling set - we need to track which model completed
          // For simplicity, we'll clear the pulling set and refresh
          setPullingModels(new Set());
          fetchModels();
        }
      },
    );

    const unlistenPullError = listen<string>("model-pull-error", (event) => {
      setError(event.payload);
      setPullingModels(new Set());
    });

    return () => {
      unlistenPullProgress.then((fn) => fn());
      unlistenPullError.then((fn) => fn());
    };
  }, [fetchModels]);

  return {
    models,
    loading,
    error,
    pullingModels,
    pullProgress,
    fetchModels,
    pullModel,
    deleteModel,
  };
};
