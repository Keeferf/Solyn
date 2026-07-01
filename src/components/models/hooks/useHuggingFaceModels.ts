// src/components/models/hooks/useHuggingFaceModels.ts
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface GGUFFile {
  filename: string;
  size: number;
  quantization: string;
  url: string;
  parameter_count?: string | null;
}

// Summary type - what we get from browse API (no GGUF files)
export interface HFModelSummary {
  id: string;
  model_id: string;
  author: string;
  name: string;
  downloads?: number;
  likes?: number;
}

// Details type - what we get from fetch_model_details
export interface HFModelDetails extends HFModelSummary {
  description?: string;
  gguf_files: GGUFFile[];
}

// Union type for convenience
export type HFModel = HFModelSummary | HFModelDetails;

// Type guard to check if model has details
export function hasDetails(model: HFModel): model is HFModelDetails {
  return (
    "gguf_files" in model && Array.isArray((model as HFModelDetails).gguf_files)
  );
}

export const useHuggingFaceModels = () => {
  const [models, setModels] = useState<HFModelSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalModels, setTotalModels] = useState(0);
  const [totalModelsFetched, setTotalModelsFetched] = useState(false);
  const modelsPerPage = 20;

  const fetchModels = useCallback(
    async (page: number) => {
      setLoading(true);
      setError(null);
      try {
        console.log(
          `🔄 Fetching models page ${page} with limit ${modelsPerPage}...`,
        );
        const response = await invoke<HFModelSummary[]>(
          "fetch_huggingface_models",
          {
            page,
            limit: modelsPerPage,
          },
        );

        console.log(
          `📦 Received ${response.length} models from backend for page ${page}`,
        );

        // Log first few model IDs to verify pagination
        if (response.length > 0) {
          const firstIds = response.slice(0, 3).map((m) => m.model_id || m.id);
          console.log(`🔍 First 3 model IDs on page ${page}:`, firstIds);
        }

        setModels(response);
        setCurrentPage(page);

        // Only fetch total count once
        if (!totalModelsFetched) {
          try {
            const total = await invoke<number>("get_huggingface_model_count");
            setTotalModels(total);
            setTotalModelsFetched(true);
            console.log(`📊 Total models available: ${total}`);
          } catch (countErr) {
            console.error("Failed to fetch total count:", countErr);
            // If we can't get total, use a default
            setTotalModels(response.length * 10);
          }
        }
      } catch (err) {
        console.error(`❌ Failed to fetch models for page ${page}:`, err);
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [modelsPerPage, totalModelsFetched],
  );

  // Initial load
  useEffect(() => {
    fetchModels(1);
  }, [fetchModels]);

  return {
    models,
    loading,
    error,
    currentPage,
    totalModels,
    modelsPerPage,
    fetchModels,
    setCurrentPage: (page: number) => fetchModels(page),
    nextPage: () => fetchModels(currentPage + 1),
    previousPage: () => fetchModels(currentPage - 1),
  };
};
