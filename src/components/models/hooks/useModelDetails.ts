// src/components/models/hooks/useModelDetails.ts
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { HFModelDetails } from "./useHuggingFaceModels";

export const useModelDetails = (modelId: string | null, isOpen: boolean) => {
  const [details, setDetails] = useState<HFModelDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && modelId) {
      setIsLoading(true);
      setError(null);

      invoke<HFModelDetails>("fetch_model_details", { modelId })
        .then((result) => {
          setDetails(result);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error("Failed to fetch model details:", err);
          setError("Failed to load model details. Please try again.");
          setIsLoading(false);
        });
    } else {
      // Reset when modal closes
      setDetails(null);
      setError(null);
    }
  }, [isOpen, modelId]);

  return { details, isLoading, error };
};
