import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { BrowseModels } from "./BrowseModels";
import { InstalledModels } from "./InstalledModels";
import { ModelToolbar } from "./ModelToolbar";
import { DownloadStatusDisplay } from "./DownloadStatusDisplay";
import { ModelDetailModal } from "./ModelDetailModal";
import {
  useHuggingFaceModels,
  HFModelSummary,
} from "./hooks/useHuggingFaceModels";

// Match the Rust ModelAcquisitionProgress type
interface DownloadProgress {
  model_id: string;
  filename: string;
  status: string;
  progress: number;
  message: string;
}

type DownloadKey = string;

export const ModelInterface = () => {
  // Add tab state
  const [activeTab, setActiveTab] = useState<"browse" | "installed">("browse");

  const {
    models,
    loading,
    isSwitchingFilter,
    error,
    totalModels,
    maxModels,
    currentFilter,
    searchQuery,
    isSearching,
    changeFilter,
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
  const [cancellingDownloads, setCancellingDownloads] = useState<
    Set<DownloadKey>
  >(new Set());

  const getDownloadKey = (modelId: string, filename: string): DownloadKey => {
    return `${modelId}::${filename}`;
  };

  const isDownloading = (modelId: string, filename: string): boolean => {
    return downloadingModels.has(getDownloadKey(modelId, filename));
  };

  const handleCancelDownload = (modelId: string, filename: string) => {
    const key = getDownloadKey(modelId, filename);
    setCancellingDownloads((prev) => new Set(prev).add(key));
  };

  useEffect(() => {
    let unlistenProgress: (() => void) | undefined;
    let unlistenComplete: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        // Listen for progress updates
        unlistenProgress = await listen<DownloadProgress>(
          "model-download-progress",
          (event) => {
            const progress = event.payload;
            const key = getDownloadKey(progress.model_id, progress.filename);

            // Remove from cancelling set when status changes
            setCancellingDownloads((prev) => {
              const newSet = new Set(prev);
              newSet.delete(key);
              return newSet;
            });

            // Add to downloading set if not already present and status is active
            if (
              !downloadingModels.has(key) &&
              (progress.status === "starting" ||
                progress.status === "downloading")
            ) {
              setDownloadingModels((prev) => new Set(prev).add(key));
            }

            setDownloadProgress((prev) => new Map(prev).set(key, progress));

            // If status is complete or error or cancelled, remove after delay
            if (
              progress.status === "complete" ||
              progress.status === "error" ||
              progress.status === "cancelled"
            ) {
              // For cancelled, keep showing the status for a bit longer
              const delay = progress.status === "cancelled" ? 5000 : 3000;
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
                setCancellingDownloads((prev) => {
                  const newSet = new Set(prev);
                  newSet.delete(key);
                  return newSet;
                });
              }, delay);
            }
          },
        );

        // Listen for completion events
        unlistenComplete = await listen<{ model_id: string; filename: string }>(
          "model-download-complete",
          (event) => {
            const { model_id, filename } = event.payload;
            const key = getDownloadKey(model_id, filename);

            // Update progress to complete if it's still in the map
            setDownloadProgress((prev) => {
              const existing = prev.get(key);
              if (existing) {
                const newMap = new Map(prev);
                newMap.set(key, {
                  ...existing,
                  status: "complete",
                  progress: 100,
                  message: "Download complete!",
                });
                return newMap;
              }
              return prev;
            });

            // Remove after delay
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
    };
  }, [downloadingModels]);

  const handleModelClick = (model: HFModelSummary) => {
    setSelectedModelId(model.model_id);
    setIsModalOpen(true);
  };

  const handleDownload = async (modelId: string, filename: string) => {
    const key = getDownloadKey(modelId, filename);
    if (downloadingModels.has(key) || cancellingDownloads.has(key)) return;

    setDownloadingModels((prev) => new Set(prev).add(key));

    try {
      await invoke("download_huggingface_model", {
        modelId,
        filename,
      });
    } catch (error) {
      console.error("Download failed:", error);
      // If error is "Download cancelled", don't show as error
      if (error !== "Download cancelled") {
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
      }
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
          {/* Tab buttons with cursor-pointer */}
          <button
            onClick={() => setActiveTab("browse")}
            className={`font-anton text-3xl sm:text-4xl tracking-wide transition-all cursor-pointer ${
              activeTab === "browse"
                ? "text-white"
                : "text-white/30 hover:text-white/50"
            }`}
          >
            Browse
          </button>
          <button
            onClick={() => setActiveTab("installed")}
            className={`font-anton text-3xl sm:text-4xl tracking-wide transition-all cursor-pointer ${
              activeTab === "installed"
                ? "text-white"
                : "text-white/30 hover:text-white/50"
            }`}
          >
            Installed
          </button>
        </div>
        {activeTab === "browse" && (
          <button
            onClick={refreshModels}
            disabled={loading || isSwitchingFilter || isSearching}
            className="px-4 py-2 bg-black hover:bg-white/10 rounded-lg text-white transition-all disabled:opacity-50 cursor-pointer"
          >
            Refresh
          </button>
        )}
      </div>

      <div className="p-6 pt-4 space-y-6">
        {/* Download Status - Shows at top with cancel button */}
        {Array.from(downloadProgress.entries()).map(([key, progress]) => (
          <DownloadStatusDisplay
            key={key}
            modelId={progress.model_id}
            filename={progress.filename}
            progress={progress.progress}
            message={progress.message}
            status={progress.status}
            onCancel={() =>
              handleCancelDownload(progress.model_id, progress.filename)
            }
          />
        ))}

        {activeTab === "browse" ? (
          <>
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
              isSwitchingFilter={isSwitchingFilter}
              isSearching={isSearching}
              totalModels={totalModels}
              maxModels={maxModels}
              downloadingModels={downloadingModels}
              onModelClick={handleModelClick}
              onRefresh={refreshModels}
              error={error}
              searchQuery={searchQuery}
              onClearSearch={handleClearSearch}
            />
          </>
        ) : (
          <InstalledModels
            onModelClick={(model) => {
              // Optional: handle clicking an installed model
              console.log("Clicked installed model:", model.model_id);
            }}
          />
        )}
      </div>

      {/* Model Detail Modal - Also has cancel button for individual files */}
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
