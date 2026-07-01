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

export interface HFModel {
  id: string;
  model_id: string;
  author: string;
  name: string;
  downloads?: number;
  likes?: number;
  description?: string;
  tags?: string[];
  gguf_files: GGUFFile[];
}

// Backend type matching Rust's HuggingFaceModelListing
interface BackendModel {
  id: string;
  model_id: string;
  author: string;
  name: string;
  downloads: number | null;
  likes: number | null;
  description: string | null;
  gguf_files: {
    filename: string;
    size: number;
    quantization: string;
    url: string;
    parameter_count?: string | null;
  }[];
}

export const useHuggingFaceModels = () => {
  const [models, setModels] = useState<HFModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalModels, setTotalModels] = useState(0);
  const [totalModelsFetched, setTotalModelsFetched] = useState(false);
  const [prefetchedModels, setPrefetchedModels] = useState<Set<string>>(
    new Set(),
  );
  const modelsPerPage = 20;

  const transformModel = (backendModel: BackendModel): HFModel => {
    return {
      id: backendModel.model_id || backendModel.id,
      model_id: backendModel.model_id || backendModel.id,
      author: backendModel.author || "Unknown",
      name: backendModel.name || backendModel.model_id?.split("/").pop() || "",
      downloads: backendModel.downloads || 0,
      likes: backendModel.likes || 0,
      description: backendModel.description || "",
      tags: [],
      gguf_files: (backendModel.gguf_files || []).map((file) => ({
        filename: file.filename,
        size: file.size,
        quantization: file.quantization || "", // Use backend's quantization
        url: file.url,
        parameter_count: file.parameter_count || null,
      })),
    };
  };

  const fetchModels = useCallback(
    async (page: number) => {
      setLoading(true);
      setError(null);
      try {
        console.log(
          `🔄 Fetching models page ${page} with limit ${modelsPerPage}...`,
        );
        const response = await invoke<BackendModel[]>(
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

        const transformedModels = response.map(transformModel);
        console.log(
          `✅ Transformed ${transformedModels.length} models for page ${page}`,
        );
        setModels(transformedModels);

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

        setCurrentPage(page);

        // Pre-fetch details for visible models (first 3)
        if (transformedModels.length > 0) {
          const modelsToPrefecth = transformedModels.slice(0, 3);
          for (const model of modelsToPrefecth) {
            if (!prefetchedModels.has(model.model_id)) {
              setPrefetchedModels((prev) => new Set(prev).add(model.model_id));
              // Don't await - fire and forget
              invoke("fetch_model_details", { modelId: model.model_id })
                .then((details: any) => {
                  console.log(`📦 Pre-fetched details for ${model.model_id}`);
                  // Update the model in the list with details
                  setModels((prevModels) =>
                    prevModels.map((m) => {
                      if (m.model_id === model.model_id) {
                        return {
                          ...m,
                          gguf_files: details.gguf_files || [],
                        };
                      }
                      return m;
                    }),
                  );
                })
                .catch((err) => {
                  console.error(`Failed to pre-fetch ${model.model_id}:`, err);
                });
            }
          }
        }
      } catch (err) {
        console.error(`❌ Failed to fetch models for page ${page}:`, err);
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [modelsPerPage, totalModelsFetched, prefetchedModels],
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
