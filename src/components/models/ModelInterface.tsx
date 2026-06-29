// src/components/models/ModelInterface.tsx
import { useState, useEffect, useRef } from "react";
import {
  FiDownload,
  FiCheck,
  FiLoader,
  FiAlertCircle,
  FiServer,
  FiExternalLink,
  FiTerminal,
  FiChevronDown,
  FiChevronUp,
} from "react-icons/fi";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useOllama } from "@/contexts/OllamaContext";

type DownloadStatus = "Idle" | "Downloading" | "Completed" | "Error";

interface DownloadProgress {
  status: DownloadStatus;
  progress: number;
  message: string;
  log?: string;
}

interface InstallInfo {
  platform: string;
  command: string;
  estimated_time: string;
}

interface TerminalOutput {
  line: string;
  stream: string;
}

export const ModelInterface = () => {
  // Use the context instead of local state
  const { isOllamaInstalled, ollamaVersion, loading, refreshOllamaStatus } =
    useOllama();

  const [installInfo, setInstallInfo] = useState<InstallInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    status: "Idle",
    progress: 0,
    message: "",
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [terminalLines, setTerminalLines] = useState<TerminalOutput[]>([]);
  const [isTerminalExpanded, setIsTerminalExpanded] = useState(true);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLines]);

  useEffect(() => {
    fetchInstallInfo();

    const setupListeners = async () => {
      const unlistenProgress = await listen<DownloadProgress>(
        "download-progress",
        (event) => {
          const payload = event.payload;
          setDownloadProgress(payload);

          if (payload.status === "Completed") {
            setIsDownloading(false);
            // Try to refresh status multiple times with delays
            let attempts = 0;
            const maxAttempts = 8;

            const tryRefresh = async () => {
              attempts++;
              await refreshOllamaStatus();

              // If not installed yet and we have more attempts, try again
              if (attempts < maxAttempts) {
                setTimeout(tryRefresh, 2000);
              }
            };

            // Start with a 2 second delay
            setTimeout(tryRefresh, 2000);
          }

          if (payload.status === "Error") {
            setIsDownloading(false);
          }
        },
      );

      const unlistenTerminal = await listen<TerminalOutput>(
        "terminal-output",
        (event) => {
          const line = event.payload.line;

          // Filter out the "Install complete" message
          if (
            line.includes(
              "Install complete. Run 'ollama' from the command line.",
            ) ||
            line.includes("Run 'ollama' from the command line.") ||
            line.includes("Install complete.")
          ) {
            return;
          }

          // Detect progress lines (contain progress bar characters)
          const isProgressLine =
            line.includes("#") ||
            line.includes("=") ||
            line.includes("█") ||
            line.includes("▓") ||
            line.includes("░") ||
            line.includes("%");

          setTerminalLines((prev) => {
            if (isProgressLine) {
              // Replace the last progress line if it exists
              const lastIndex = prev.length - 1;
              if (lastIndex >= 0 && isProgressLine) {
                // Check if the last line is also a progress line
                const lastLine = prev[lastIndex].line;
                const lastIsProgress =
                  lastLine.includes("#") ||
                  lastLine.includes("=") ||
                  lastLine.includes("█") ||
                  lastLine.includes("▓") ||
                  lastLine.includes("░") ||
                  lastLine.includes("%");

                if (lastIsProgress) {
                  // Replace the last progress line
                  return [...prev.slice(0, lastIndex), event.payload];
                }
              }
              // If no previous progress line, just append
              return [...prev, event.payload];
            } else {
              // Regular line - always append
              return [...prev, event.payload];
            }
          });
        },
      );

      return () => {
        unlistenProgress();
        unlistenTerminal();
      };
    };

    const unlistenPromise = setupListeners();

    return () => {
      unlistenPromise.then((fn) => {
        if (fn) fn();
      });
    };
  }, [refreshOllamaStatus]);

  const fetchInstallInfo = async () => {
    try {
      const info = await invoke<InstallInfo>("get_install_info");
      setInstallInfo(info);
    } catch {
      // Silent fail
    }
  };

  const handleDownloadOllama = async () => {
    setIsDownloading(true);
    setTerminalLines([]);
    setDownloadProgress({
      status: "Downloading",
      progress: 0,
      message: "Starting download...",
    });
    setIsTerminalExpanded(true);

    try {
      await invoke("download_ollama");
    } catch (error) {
      setDownloadProgress({
        status: "Error",
        progress: 0,
        message: "Download failed",
        log: error instanceof Error ? error.message : "Unknown error occurred",
      });
      setIsDownloading(false);
    }
  };

  const getPlatformDisplay = () => {
    if (!installInfo) return "Your Platform";
    switch (installInfo.platform) {
      case "windows":
        return "Windows";
      case "macos":
        return "macOS";
      case "linux":
        return "Linux";
      default:
        return installInfo.platform;
    }
  };

  // Filter function to remove verbose PowerShell messages
  const shouldShowLine = (line: string): boolean => {
    // Filter out all PowerShell VERBOSE messages
    if (line.includes("VERBOSE:")) return false;

    // Filter out specific verbose messages even if they don't have VERBOSE: prefix
    if (line.includes("GET with") && line.includes("payload")) return false;
    if (line.includes("received") && line.includes("response of content type"))
      return false;

    // Filter out "Install complete" messages
    if (line.includes("Install complete. Run 'ollama' from the command line."))
      return false;
    if (line.includes("Run 'ollama' from the command line.")) return false;
    if (line.includes("Install complete.")) return false;

    // Filter out empty lines
    if (line.trim() === "") return false;

    return true;
  };

  const getStreamColor = (stream: string) => {
    switch (stream) {
      case "stdout":
        return "text-white/70";
      case "stderr":
        return "text-yellow-400/70";
      case "info":
        return "text-blue-400/70";
      case "success":
        return "text-green-400/70";
      default:
        return "text-white/70";
    }
  };

  const getStreamPrefix = (stream: string) => {
    switch (stream) {
      case "stdout":
        return ">";
      case "stderr":
        return "!";
      case "info":
        return "ℹ";
      case "success":
        return "✓";
      default:
        return "$";
    }
  };

  // Loading state from context
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto w-full p-6 flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-white/60">
          <FiLoader className="animate-spin" size={24} />
          <span>Checking Ollama status...</span>
        </div>
      </div>
    );
  }

  // Ollama not installed state
  if (isOllamaInstalled === false) {
    return (
      <div className="max-w-5xl mx-auto w-full p-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-(--color-purple-accent)/20 rounded-full flex items-center justify-center">
              <FiServer className="w-10 h-10 text-(--color-purple-accent)" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">
            Ollama Not Installed
          </h2>

          <p className="text-white/60 max-w-md mx-auto mb-8">
            Ollama is required to run AI models locally. Download it now to get
            started with Solyn.
          </p>

          {downloadProgress.status === "Idle" && installInfo && (
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-left">
                <h3 className="text-sm font-semibold text-white/80 mb-3">
                  Download Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-white/60 gap-4">
                    <span className="shrink-0">Platform</span>
                    <span className="text-white text-right">
                      {getPlatformDisplay()}
                    </span>
                  </div>
                  <div className="flex justify-between text-white/60 gap-4">
                    <span className="shrink-0">Command</span>
                    <span className="text-white text-right font-mono text-xs break-all">
                      {installInfo.command}
                    </span>
                  </div>
                  <div className="flex justify-between text-white/60 gap-4">
                    <span className="shrink-0">Estimated Time</span>
                    <span className="text-white text-right">
                      {installInfo.estimated_time}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleDownloadOllama}
                disabled={isDownloading}
                className="px-8 py-3 bg-(--color-purple-accent) hover:bg-(--color-purple-accent)/80 disabled:opacity-50 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
              >
                <FiDownload size={18} />
                Download Ollama for {getPlatformDisplay()}
              </button>

              <div className="text-xs text-white/30">
                <span className="block">Or manually download from </span>
                <a
                  href="https://ollama.com/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-(--color-purple-accent) hover:underline inline-flex items-center gap-1"
                >
                  ollama.com/download
                  <FiExternalLink size={12} />
                </a>
              </div>
            </div>
          )}

          {(downloadProgress.status === "Downloading" ||
            downloadProgress.status === "Completed" ||
            downloadProgress.status === "Error") && (
            <div className="space-y-6">
              {/* Installing status with loader */}
              {downloadProgress.status === "Downloading" && (
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
              <div className="bg-black/60 border border-white/10 rounded-xl overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10 cursor-pointer hover:bg-white/10 transition-colors"
                  onClick={() => setIsTerminalExpanded(!isTerminalExpanded)}
                >
                  <div className="flex items-center gap-2">
                    <FiTerminal className="text-white/60" size={18} />
                  </div>
                  <button
                    className="text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsTerminalExpanded(!isTerminalExpanded);
                    }}
                  >
                    {isTerminalExpanded ? (
                      <FiChevronUp size={18} />
                    ) : (
                      <FiChevronDown size={18} />
                    )}
                  </button>
                </div>

                {isTerminalExpanded && (
                  <div
                    ref={terminalContainerRef}
                    className="max-h-64 overflow-y-auto p-3 text-left font-mono text-xs"
                  >
                    {terminalLines.filter((output) =>
                      shouldShowLine(output.line),
                    ).length === 0 ? (
                      <p className="text-white/20">Waiting for output...</p>
                    ) : (
                      terminalLines
                        .filter((output) => shouldShowLine(output.line))
                        .map((output, index) => {
                          return (
                            <div
                              key={index}
                              className={`${getStreamColor(output.stream)} py-0.5 whitespace-pre-wrap break-all`}
                            >
                              <span className="text-white/20 mr-2 select-none">
                                {getStreamPrefix(output.stream)}
                              </span>
                              {output.line}
                            </div>
                          );
                        })
                    )}
                    <div ref={terminalEndRef} />
                  </div>
                )}
              </div>

              {downloadProgress.status === "Completed" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3 text-green-400">
                    <FiCheck size={24} />
                    <span className="text-lg font-medium">
                      Installation Complete! 🎉
                    </span>
                  </div>
                  <p className="text-white/40 text-sm">
                    Ollama is now installed and running. You can start using AI
                    models.
                  </p>
                  <button
                    onClick={() => {
                      refreshOllamaStatus();
                      setDownloadProgress({
                        status: "Idle",
                        progress: 0,
                        message: "",
                      });
                      setTerminalLines([]);
                    }}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all"
                  >
                    Continue
                  </button>
                </div>
              )}

              {downloadProgress.status === "Error" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3 text-red-400">
                    <FiAlertCircle size={24} />
                    <span className="text-lg font-medium">
                      Installation Failed
                    </span>
                  </div>
                  <p className="text-white/60">
                    {downloadProgress.log || "An unknown error occurred."}
                  </p>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left text-sm text-white/60">
                    <h4 className="font-semibold text-white/80 mb-2">
                      🔧 Troubleshooting:
                    </h4>
                    <div className="space-y-2">
                      <p>
                        <span className="text-white/80">
                          1. Manual Download:
                        </span>
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
                    onClick={() => {
                      setDownloadProgress({
                        status: "Idle",
                        progress: 0,
                        message: "",
                      });
                      setTerminalLines([]);
                      setIsTerminalExpanded(true);
                    }}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Ollama installed state
  return (
    <div className="max-w-5xl mx-auto w-full p-6">
      <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
            <FiCheck className="w-10 h-10 text-green-400" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-3">
          Ollama is Ready! 🎉
        </h2>

        <p className="text-white/60 max-w-md mx-auto mb-2">
          Ollama{" "}
          {ollamaVersion && (
            <span className="text-white font-mono">v{ollamaVersion}</span>
          )}{" "}
          is installed and running.
        </p>
        <p className="text-white/40 text-sm">
          You can now download and use AI models.
        </p>

        <div className="mt-6 text-xs text-white/30">
          <span>Need to reinstall? </span>
          <button
            onClick={() => {
              // Force a recheck by refreshing the status
              refreshOllamaStatus();
              setDownloadProgress({
                status: "Idle",
                progress: 0,
                message: "",
              });
              setTerminalLines([]);
            }}
            className="text-(--color-purple-accent) hover:underline"
          >
            Click here
          </button>
        </div>
      </div>
    </div>
  );
};
