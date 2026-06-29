// src/components/models/DownloadStatusDisplay.tsx
import { FiLoader, FiAlertCircle } from "react-icons/fi";
import { TerminalDisplay } from "./TerminalDisplay";
import { TerminalOutput } from "./hooks/useOllamaInstallation";

interface DownloadProgress {
  status: "Idle" | "Downloading" | "Completed" | "Error";
  progress: number;
  message: string;
  log?: string;
}

interface InstallInfo {
  platform: string;
  command: string;
  estimated_time: string;
}

interface DownloadStatusDisplayProps {
  downloadProgress: DownloadProgress;
  installInfo: InstallInfo | null;
  terminalLines: TerminalOutput[];
  isTerminalExpanded: boolean;
  onToggleTerminal: () => void;
  terminalEndRef: React.RefObject<HTMLDivElement>;
  onContinue: () => void;
  onTryAgain: () => void;
}

export const DownloadStatusDisplay = ({
  downloadProgress,
  installInfo,
  terminalLines,
  isTerminalExpanded,
  onToggleTerminal,
  terminalEndRef,
  onContinue,
  onTryAgain,
}: DownloadStatusDisplayProps) => {
  const { status, log } = downloadProgress;

  return (
    <div className="space-y-6">
      {/* Loading indicator */}
      {status === "Downloading" && (
        <div className="flex items-center justify-center gap-3 py-2">
          <FiLoader
            className="animate-spin text-(--color-purple-accent)"
            size={20}
          />
          <span className="text-white/80 font-medium">
            Installing, please wait...
          </span>
        </div>
      )}

      {/* Terminal output */}
      <TerminalDisplay
        terminalLines={terminalLines}
        isTerminalExpanded={isTerminalExpanded}
        onToggleExpand={onToggleTerminal}
        terminalEndRef={terminalEndRef}
      />

      {/* Completed state */}
      {status === "Completed" && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 text-green-400">
            <span className="text-lg font-medium">Installation Complete!</span>
          </div>
          <p className="text-white/40 text-sm">
            Ollama is now installed and running. You can start using AI models.
          </p>
          <button
            onClick={onContinue}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all"
          >
            Continue
          </button>
        </div>
      )}

      {/* Error state */}
      {status === "Error" && (
        <ErrorState
          log={log}
          installInfo={installInfo}
          onTryAgain={onTryAgain}
        />
      )}
    </div>
  );
};

// Error state subcomponent
const ErrorState = ({
  log,
  installInfo,
  onTryAgain,
}: {
  log?: string;
  installInfo: InstallInfo | null;
  onTryAgain: () => void;
}) => (
  <div className="space-y-4">
    <div className="flex items-center justify-center gap-3 text-red-400">
      <FiAlertCircle size={24} />
      <span className="text-lg font-medium">Installation Failed</span>
    </div>
    <p className="text-white/60">{log || "An unknown error occurred."}</p>
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left text-sm text-white/60">
      <h4 className="font-semibold text-white/80 mb-2">🔧 Troubleshooting:</h4>
      <div className="space-y-2">
        <p>
          <span className="text-white/80">1. Manual Download:</span>
          <br />
          Open terminal and run:
          <br />
          <code className="bg-white/10 px-2 py-1 rounded text-xs font-mono block mt-1 whitespace-pre-wrap break-all">
            {installInfo?.command ||
              "curl -fsSL https://ollama.com/install.sh | sh"}
          </code>
        </p>
        <p>
          <span className="text-white/80">2. Visit </span>
          <a
            href="https://ollama.com/download"
            target="_blank"
            rel="noopener noreferrer"
            className="text-(--color-purple-accent) hover:underline"
          >
            ollama.com/download
          </a>
        </p>
      </div>
    </div>
    <button
      onClick={onTryAgain}
      className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all"
    >
      Try Again
    </button>
  </div>
);
