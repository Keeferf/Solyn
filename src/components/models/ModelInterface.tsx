import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { BrowseModels } from "./BrowseModels";
import { ModelToolbar } from "./ModelToolbar";
import { DownloadStatusDisplay } from "./DownloadStatusDisplay";
import { ModelDetailModal } from "./ModelDetailModal";
import {
  useHuggingFaceModels,
  HFModelSummary,
} from "./hooks/useHuggingFaceModels";

interface DownloadProgress {
  model_id: string;
  filename: string;
  status: string;
  progress: number;
  message: string;
}

type DownloadKey = string;

export const ModelInterface = () => {
  const {
    models,
    loading,
    loadingMore,
    isSwitchingFilter,
    error,
    hasMore,
    totalModels,
    maxModels,
    currentFilter,
    searchQuery,
    isSearching,
    changeFilter,
    loadMoreModels,
    refreshModels,
    searchModels,
    clearSearch,
  } = useHuggingFaceModels();

  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [downloadingModels, setDownloadingModels] = useState<Set<DownloadKey>>(
    new Set(),
  );
  const [downloadProgress, setDownloadProgress] = useState<
    Map<DownloadKey, DownloadProgress>
  >(new Map());

  const getDownloadKey = (modelId: string, filename: string): DownloadKey => {
    return `${modelId}::${filename}`;
  };

  const isDownloading = (modelId: string, filename: string): boolean => {
    return downloadingModels.has(getDownloadKey(modelId, filename));
  };

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
            const key = getDownloadKey(progress.model_id, progress.filename);

            setDownloadProgress((prev) => new Map(prev).set(key, progress));

            if (progress.status === "complete" || progress.status === "error") {
              setTimeout(() => {
                setDownloadingModels((prev) => {
                  const newSet = new Set(prev);
                  newSet.delete(key);
                  return newSet;
                });
                setDownloadProgress((prev) => {
                  const newMap = new Map(prev);
                  newMap.delete(key);
                  return newMap;
                });
              }, 3000);
            }
          },
        );

        unlistenComplete = await listen<{ model_id: string; filename: string }>(
          "model-download-complete",
          (event) => {
            const { model_id, filename } = event.payload;
            const key = getDownloadKey(model_id, filename);

            setDownloadingModels((prev) => {
              const newSet = new Set(prev);
              newSet.delete(key);
              return newSet;
            });
            setDownloadProgress((prev) => {
              const newMap = new Map(prev);
              newMap.delete(key);
              return newMap;
            });
          },
        );

        unlistenError = await listen<{ model_id: string; filename: string }>(
          "model-download-error",
          (event) => {
            const { model_id, filename } = event.payload;
            const key = getDownloadKey(model_id, filename);

            setDownloadingModels((prev) => {
              const newSet = new Set(prev);
              newSet.delete(key);
              return newSet;
            });
            setDownloadProgress((prev) => {
              const newMap = new Map(prev);
              newMap.delete(key);
              return newMap;
            });
          },
        );
      } catch (err) {
        console.error("Failed to setup download listeners:", err);
      }
    };

    setupListeners();

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenComplete) unlistenComplete();
      if (unlistenError) unlistenError();
    };
  }, []);

  const handleModelClick = (model: HFModelSummary) => {
    setSelectedModelId(model.model_id);
    setIsModalOpen(true);
  };

  const handleDownload = async (modelId: string, filename: string) => {
    const key = getDownloadKey(modelId, filename);
    if (downloadingModels.has(key)) return;

    setDownloadingModels((prev) => new Set(prev).add(key));

    try {
      await invoke("download_huggingface_model", {
        modelId,
        filename,
      });
    } catch (error) {
      setDownloadingModels((prev) => {
        const newSet = new Set(prev);
        newSet.delete(key);
        return newSet;
      });
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedModelId(null);
  };

  const handleFilterChange = (filter: string) => {
    changeFilter(filter as any);
  };

  const handleSearchChange = (query: string) => {
    searchModels(query);
  };

  const handleClearSearch = () => {
    clearSearch();
  };

  return (
    <div className="w-full h-full">
      <div className="flex items-center justify-between p-6 pb-0">
        <div className="flex items-center gap-8">
          <h2 className="font-anton text-3xl sm:text-4xl text-white tracking-wide">
            Browse
          </h2>
          <h2 className="font-anton text-3xl sm:text-4xl text-white/30 tracking-wide">
            Installed
          </h2>
        </div>
        <button
          onClick={refreshModels}
          disabled={loading || isSwitchingFilter || isSearching}
          className="px-4 py-2 bg-black hover:bg-white/10 rounded-lg text-white transition-all disabled:opacity-50 cursor-pointer"
        >
          Refresh
        </button>
      </div>

      <div className="p-6 pt-4 space-y-6">
        {/* Download Status */}
        {Array.from(downloadProgress.entries()).map(([key, progress]) => (
          <DownloadStatusDisplay
            key={key}
            modelId={progress.model_id}
            filename={progress.filename}
            progress={progress.progress}
            message={progress.message}
            status={progress.status}
          />
        ))}

        {/* Toolbar - Search and Filters */}
        <ModelToolbar
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          onClearSearch={handleClearSearch}
          currentFilter={currentFilter}
          onFilterChange={handleFilterChange}
          loading={loading || isSearching}
          disabled={isSwitchingFilter}
        />

        {/* Models Grid */}
        <BrowseModels
          models={models}
          loading={loading}
          loadingMore={loadingMore}
          isSwitchingFilter={isSwitchingFilter}
          isSearching={isSearching}
          hasMore={hasMore}
          totalModels={totalModels}
          maxModels={maxModels}
          downloadingModels={downloadingModels}
          onModelClick={handleModelClick}
          onLoadMore={loadMoreModels}
          onRefresh={refreshModels}
          error={error}
          searchQuery={searchQuery}
          onClearSearch={handleClearSearch}
        />
      </div>

      <ModelDetailModal
        modelId={selectedModelId}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onDownload={handleDownload}
        downloadingModels={downloadingModels}
        isDownloading={isDownloading}
      />
    </div>
  );
};
