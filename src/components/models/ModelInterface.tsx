// src/components/models/ModelInterface.tsx
import { FiServer } from "react-icons/fi";
import { useOllama } from "@/contexts/OllamaContext";
import { useOllamaInstallation } from "./hooks/useOllamaInstallation";
import { DownloadDetails } from "./DownloadDetails";
import { DownloadStatusDisplay } from "./DownloadStatusDisplay";

export const ModelInterface = () => {
  const { isOllamaInstalled, ollamaVersion, refreshOllamaStatus } = useOllama();

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

  return (
    <div className="max-w-5xl mx-auto w-full p-6">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-(--color-purple-accent)/20 rounded-full flex items-center justify-center">
            <FiServer className="w-10 h-10 text-(--color-purple-accent)" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-3">
          {isOllamaInstalled ? "Ollama is Installed" : "Ollama Not Installed"}
        </h2>

        <p className="text-white/60 max-w-md mx-auto mb-8">
          {isOllamaInstalled
            ? `Ollama ${ollamaVersion ? `v${ollamaVersion} ` : ""}is installed and running. You can reinstall if needed.`
            : "Ollama is required to run AI models locally. Download it now to get started with Solyn."}
        </p>

        {isIdle && installInfo && (
          <DownloadDetails
            installInfo={installInfo}
            platformDisplay={getPlatformDisplay()}
            isOllamaInstalled={isOllamaInstalled}
            onDownload={handleDownloadOllama}
            isDownloading={isDownloading}
          />
        )}

        {isActive && (
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
      </div>
    </div>
  );
};
