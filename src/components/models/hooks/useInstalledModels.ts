import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface InstalledModelFile {
  filename: string;
  size: number;
  path: string;
  parameter_count?: string | null;
  quantization?: string | null;
}

export interface InstalledModel {
  model_id: string;
  author: string;
  name: string;
  files: InstalledModelFile[];
  total_size: number;
  downloaded_at: string;
}

export const useInstalledModels = () => {
  const [models, setModels] = useState<InstalledModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadInstalledModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<InstalledModel[]>(
        "get_installed_models_command",
      );
      setModels(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteModel = useCallback(async (modelId: string) => {
    try {
      await invoke("delete_installed_model_command", { modelId });
      setModels((prev) => prev.filter((m) => m.model_id !== modelId));
      return true;
    } catch (err) {
      setError(String(err));
      return false;
    }
  }, []);

  const deleteFile = useCallback(async (modelId: string, filename: string) => {
    try {
      await invoke("delete_model_file_command", { modelId, filename });
      setModels((prev) =>
        prev
          .map((model) => {
            if (model.model_id !== modelId) return model;
            const updatedFiles = model.files.filter(
              (f) => f.filename !== filename,
            );
            const newTotalSize = updatedFiles.reduce(
              (sum, f) => sum + f.size,
              0,
            );
            return {
              ...model,
              files: updatedFiles,
              total_size: newTotalSize,
            };
          })
          .filter((model) => model.files.length > 0),
      );
      return true;
    } catch (err) {
      setError(String(err));
      return false;
    }
  }, []);

  const deleteQuantization = useCallback(
    async (modelId: string, quantization: string) => {
      try {
        await invoke("delete_model_quantization_command", {
          modelId,
          quantization,
        });
        setModels((prev) =>
          prev
            .map((model) => {
              if (model.model_id !== modelId) return model;
              const updatedFiles = model.files.filter(
                (f) => f.quantization !== quantization,
              );
              const newTotalSize = updatedFiles.reduce(
                (sum, f) => sum + f.size,
                0,
              );
              return {
                ...model,
                files: updatedFiles,
                total_size: newTotalSize,
              };
            })
            .filter((model) => model.files.length > 0),
        );
        return true;
      } catch (err) {
        setError(String(err));
        return false;
      }
    },
    [],
  );

  const refresh = useCallback(() => {
    loadInstalledModels();
  }, [loadInstalledModels]);

  useEffect(() => {
    loadInstalledModels();
  }, [loadInstalledModels]);

  const filteredModels = models.filter((model) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      model.model_id.toLowerCase().includes(query) ||
      model.name.toLowerCase().includes(query) ||
      model.author.toLowerCase().includes(query) ||
      model.files.some((f) => f.filename.toLowerCase().includes(query))
    );
  });

  return {
    models: filteredModels,
    allModels: models,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    deleteModel,
    deleteFile,
    deleteQuantization,
    refresh,
  };
};
