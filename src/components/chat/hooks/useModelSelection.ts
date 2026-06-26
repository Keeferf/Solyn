import { useState } from "react";
import { ModelType } from "../ChatInterface";

export const useModelSelection = () => {
  const [selectedModel, setSelectedModel] = useState<ModelType>("gpt-4");
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const models = [
    { value: "gpt-4" as const, label: "GPT-4" },
    { value: "claude-3" as const, label: "Claude 3" },
    { value: "gemini-pro" as const, label: "Gemini Pro" },
    { value: "llama-3" as const, label: "Llama 3" },
  ];

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

  return {
    selectedModel,
    models,
    isModelDropdownOpen,
    selectModel,
    toggleDropdown,
    closeDropdown,
  };
};
