// src/components/models/hooks/useHuggingFaceModels.ts
import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface GGUFFile {
  filename: string;
  size: number;
  quantization: string;
  url: string;
}

export interface HFModel {
  id: string;
  model_id: string;
  author: string;
  name: string;
  downloads?: number;
  likes?: number;
  description?: string;
  tags: string[];
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
  tags: string[];
  gguf_files: {
    filename: string;
    size: number;
    quantization: string;
    url: string;
  }[];
}

export const useHuggingFaceModels = () => {
  const [models, setModels] = useState<HFModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalModels, setTotalModels] = useState(0);
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
      tags: backendModel.tags || [],
      gguf_files: backendModel.gguf_files || [],
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

        // Fetch total count
        try {
          const total = await invoke<number>("get_huggingface_model_count");
          setTotalModels(total);
          console.log(`📊 Total models available: ${total}`);
        } catch (countErr) {
          console.error("Failed to fetch total count:", countErr);
          // If we can't get total, use a default
          setTotalModels(response.length * 10);
        }

        setCurrentPage(page);
      } catch (err) {
        console.error(`❌ Failed to fetch models for page ${page}:`, err);
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [modelsPerPage],
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
