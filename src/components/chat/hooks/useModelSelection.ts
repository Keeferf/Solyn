import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// Model type is now a string to support dynamic model IDs
export type ModelType = string;

export interface ChatModel {
  value: string; // Now includes filename to make it unique: "model_id:filename"
  label: string;
  model_id: string;
  author: string;
  name?: string;
  quantization?: string;
  parameter_count?: string;
  filename: string; // Added to track which file to use
  path: string;
  has_modelfile: boolean;
  size?: number;
}

export const useModelSelection = () => {
  const [selectedModel, setSelectedModel] = useState<ModelType>("");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [models, setModels] = useState<ChatModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadModels = async () => {
    try {
      setIsLoading(true);
      const installedModels = await invoke<ChatModel[]>("get_chat_models");

      if (installedModels.length === 0) {
        // If no models installed, show a placeholder
        setModels([
          {
            value: "no-models",
            label: "No models installed",
            model_id: "",
            author: "",
            filename: "",
            path: "",
            has_modelfile: false,
          },
        ]);
        setSelectedModel("no-models");
      } else {
        setModels(installedModels);
        // Only update selection if current selection is not in the new list
        const currentModelExists = installedModels.some(
          (m) => m.value === selectedModel,
        );
        if (
          !currentModelExists ||
          selectedModel === "" ||
          selectedModel === "no-models"
        ) {
          setSelectedModel(installedModels[0].value);
        }
      }
    } catch (error) {
      console.error("Failed to load installed models:", error);
      // Fallback to placeholder
      setModels([
        {
          value: "error",
          label: "Error loading models",
          model_id: "",
          author: "",
          filename: "",
          path: "",
          has_modelfile: false,
        },
      ]);
      setSelectedModel("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Load installed models on mount
  useEffect(() => {
    loadModels();
  }, []);

  // Listen for model download completion events to refresh the list
  useEffect(() => {
    let unlistenFn: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const unlisten = await listen("model-download-complete", () => {
          console.log("Model download completed, refreshing model list...");
          loadModels();
        });
        unlistenFn = unlisten;
      } catch (error) {
        console.error("Failed to set up model download listener:", error);
      }
    };

    setupListener();

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  const selectModel = (model: ModelType) => {
    setSelectedModel(model);
    setIsModelDropdownOpen(false);
  };

  const toggleDropdown = () => {
    setIsModelDropdownOpen(!isModelDropdownOpen);
  };

  const closeDropdown = () => {
    setIsModelDropdownOpen(false);
  };

  // Get the selected model's full data
  const getSelectedModelData = (): ChatModel | undefined => {
    return models.find((m) => m.value === selectedModel);
  };

  return {
    selectedModel,
    models,
    isModelDropdownOpen,
    isLoading,
    selectModel,
    toggleDropdown,
    closeDropdown,
    getSelectedModelData,
  };
};
