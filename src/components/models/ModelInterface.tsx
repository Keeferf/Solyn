// src/components/models/ModelInterface.tsx
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { BrowseModels } from "./BrowseModels";
import { DownloadStatusDisplay } from "./DownloadStatusDisplay";
import { useHuggingFaceModels } from "./hooks/useHuggingFaceModels";

interface DownloadProgress {
  model_id: string;
  status: string;
  progress: number;
  message: string;
}

export const ModelInterface = () => {
  const {
    models,
    loading,
    error,
    currentPage,
    totalModels,
    modelsPerPage,
    setCurrentPage,
    nextPage,
    previousPage,
    fetchModels,
  } = useHuggingFaceModels();

  const [downloadingModels, setDownloadingModels] = useState<Set<string>>(
    new Set(),
  );
  const [downloadProgress, setDownloadProgress] = useState<
    Map<string, DownloadProgress>
  >(new Map());

  // Listen for download progress events
  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenComplete: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        unlistenProgress = await listen<DownloadProgress>(
          "model-download-progress",
          (event) => {
            const progress = event.payload;
            setDownloadProgress((prev) =>
              new Map(prev).set(progress.model_id, progress),
            );

            // If status is complete or error, remove from downloading set after a delay
            if (progress.status === "complete" || progress.status === "error") {
              setTimeout(() => {
                setDownloadingModels((prev) => {
                  const newSet = new Set(prev);
                  newSet.delete(progress.model_id);
                  return newSet;
                });
                setDownloadProgress((prev) => {
                  const newMap = new Map(prev);
                  newMap.delete(progress.model_id);
                  return newMap;
                });
              }, 3000);
            }
          },
        );

        unlistenComplete = await listen<string>(
          "model-download-complete",
          (event) => {
            const modelId = event.payload;
            setDownloadingModels((prev) => {
              const newSet = new Set(prev);
              newSet.delete(modelId);
              return newSet;
            });
            setDownloadProgress((prev) => {
              const newMap = new Map(prev);
              newMap.delete(modelId);
              return newMap;
            });
          },
        );

        unlistenError = await listen<string>(
          "model-download-error",
          (event) => {
            const modelId = event.payload;
            setDownloadingModels((prev) => {
              const newSet = new Set(prev);
              newSet.delete(modelId);
              return newSet;
            });
            setDownloadProgress((prev) => {
              const newMap = new Map(prev);
              newMap.delete(modelId);
              return newMap;
            });
          },
        );
      } catch (err) {
        console.error("Failed to setup event listeners:", err);
      }
    };

    setupListeners();

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenComplete) unlistenComplete();
      if (unlistenError) unlistenError();
    };
  }, []);

  const handleDownload = async (modelId: string) => {
    if (downloadingModels.has(modelId)) return;

    setDownloadingModels((prev) => new Set(prev).add(modelId));

    try {
      await invoke("download_huggingface_model", { modelId });
    } catch (error) {
      console.error("Failed to start download:", error);
      setDownloadingModels((prev) => {
        const newSet = new Set(prev);
        newSet.delete(modelId);
        return newSet;
      });
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-2rem)]">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Browse Models</h2>
        <button
          onClick={() => fetchModels(currentPage)}
          disabled={loading}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all disabled:opacity-50 cursor-pointer"
        >
          Refresh
        </button>
      </div>

      {/* Download progress displays */}
      {Array.from(downloadProgress.entries()).map(([modelId, progress]) => (
        <DownloadStatusDisplay
          key={modelId}
          modelId={modelId}
          progress={progress.progress}
          message={progress.message}
          status={progress.status}
        />
      ))}

      {/* Browse models */}
      <BrowseModels
        models={models}
        loading={loading}
        downloadingModels={downloadingModels}
        currentPage={currentPage}
        totalModels={totalModels}
        modelsPerPage={modelsPerPage}
        onGoToPage={setCurrentPage}
        onNextPage={nextPage}
        onPreviousPage={previousPage}
        onDownload={handleDownload}
        onRefresh={() => fetchModels(currentPage)}
        error={error}
      />
    </div>
  );
};
