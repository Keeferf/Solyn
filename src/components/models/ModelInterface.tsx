// src/components/models/ModelInterface.tsx
import { FiServer, FiRefreshCw } from "react-icons/fi";
import { useOllama } from "@/contexts/OllamaContext";
import { useOllamaInstallation } from "./hooks/useOllamaInstallation";
import { useOllamaModels } from "./hooks/useOllamaModels";
import { DownloadDetails } from "./DownloadDetails";
import { DownloadStatusDisplay } from "./DownloadStatusDisplay";
import { ModelList } from "./ModelList";

export const ModelInterface = () => {
  const { isOllamaInstalled, ollamaVersion, refreshOllamaStatus } = useOllama();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const {
    models,
    loading: modelsLoading,
    pullingModels,
    pullModel,
    deleteModel,
    fetchModels,
  } = useOllamaModels(refreshTrigger);

  const {
    installInfo,
    downloadProgress,
    isDownloading,
    terminalLines,
    isTerminalExpanded,
    terminalEndRef,
    handleDownloadOllama,
    resetState,
    setIsTerminalExpanded,
    getPlatformDisplay,
  } = useOllamaInstallation(refreshOllamaStatus);

  const isIdle = downloadProgress.status === "Idle";
  const isActive = !isIdle;

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
    fetchModels();
  };

  const handlePullModel = async (modelName: string) => {
    try {
      await pullModel(modelName);
    } catch (error) {
      console.error("Failed to pull model:", error);
    }
  };

  const handleDeleteModel = async (modelName: string) => {
    if (
      window.confirm(
        `Are you sure you want to delete the model "${modelName}"?`,
      )
    ) {
      try {
        await deleteModel(modelName);
      } catch (error) {
        console.error("Failed to delete model:", error);
      }
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full p-6">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-(--color-purple-accent)/20 rounded-full flex items-center justify-center">
              <FiServer className="w-10 h-10 text-(--color-purple-accent)" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">
            {isOllamaInstalled ? "Model Library" : "Ollama Not Installed"}
          </h2>

          <p className="text-white/60 max-w-md mx-auto mb-4">
            {isOllamaInstalled
              ? `Ollama ${ollamaVersion ? `v${ollamaVersion} ` : ""}is running. Manage your AI models below.`
              : "Ollama is required to run AI models locally. Download it now to get started with Solyn."}
          </p>

          {isOllamaInstalled && (
            <button
              onClick={handleRefresh}
              disabled={modelsLoading}
              className="text-white/40 hover:text-white/60 transition-all flex items-center gap-2 mx-auto text-sm cursor-pointer"
            >
              <FiRefreshCw
                className={modelsLoading ? "animate-spin" : ""}
                size={14}
              />
              {modelsLoading ? "Refreshing..." : "Refresh Models"}
            </button>
          )}
        </div>

        {/* Download/Installation UI */}
        {!isOllamaInstalled && isIdle && installInfo && (
          <DownloadDetails
            installInfo={installInfo}
            platformDisplay={getPlatformDisplay()}
            isOllamaInstalled={isOllamaInstalled}
            onDownload={handleDownloadOllama}
            isDownloading={isDownloading}
          />
        )}

        {!isOllamaInstalled && isActive && (
          <DownloadStatusDisplay
            downloadProgress={downloadProgress}
            installInfo={installInfo}
            terminalLines={terminalLines}
            isTerminalExpanded={isTerminalExpanded}
            onToggleTerminal={() => setIsTerminalExpanded(!isTerminalExpanded)}
            terminalEndRef={terminalEndRef}
            onContinue={() => {
              refreshOllamaStatus();
              resetState();
            }}
            onTryAgain={() => {
              resetState();
            }}
          />
        )}

        {/* Models Management UI */}
        {isOllamaInstalled && (
          <ModelList
            models={models}
            loading={modelsLoading}
            pullingModels={pullingModels}
            onPullModel={handlePullModel}
            onDeleteModel={handleDeleteModel}
          />
        )}
      </div>
    </div>
  );
};

// Add this import at the top
import { useState } from "react";
