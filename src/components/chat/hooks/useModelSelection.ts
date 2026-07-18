import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type ModelType = string;

export interface ChatModel {
  value: string;
  label: string;
  model_id: string;
  author: string;
  name?: string;
  quantization?: string;
  parameter_count?: string;
  filename: string;
  path: string;
  has_modelfile: boolean;
  size?: number;
  ollama_model_name: string; // Make this required (remove ?)
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
        setModels([
          {
            value: "no-models",
            label: "No models installed",
            model_id: "",
            author: "",
            filename: "",
            path: "",
            has_modelfile: false,
            ollama_model_name: "", // Add required field
          },
        ]);
        setSelectedModel("no-models");
      } else {
        setModels(installedModels);
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
      setModels([
        {
          value: "error",
          label: "Error loading models",
          model_id: "",
          author: "",
          filename: "",
          path: "",
          has_modelfile: false,
          ollama_model_name: "", // Add required field
        },
      ]);
      setSelectedModel("error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

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
