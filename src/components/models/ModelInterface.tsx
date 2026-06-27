import { useState, useEffect, useRef } from "react";
import {
  FiDownload,
  FiCheck,
  FiLoader,
  FiAlertCircle,
  FiServer,
  FiExternalLink,
  FiTerminal,
} from "react-icons/fi";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

type InstallStatus =
  | "Idle"
  | "Downloading"
  | "Verifying"
  | "Installing"
  | "Completed"
  | "Error";

interface InstallProgress {
  status: InstallStatus;
  progress: number;
  message: string;
  error?: string;
  log?: string;
}

interface InstallInfo {
  platform: string;
  method: string;
  command: string;
  estimated_time: string;
  models_note: string;
}

export const ModelInterface = () => {
  const [loading, setLoading] = useState(true);
  const [isOllamaInstalled, setIsOllamaInstalled] = useState<boolean | null>(
    null,
  );
  const [ollamaVersion, setOllamaVersion] = useState<string | null>(null);
  const [installInfo, setInstallInfo] = useState<InstallInfo | null>(null);
  const [installProgress, setInstallProgress] = useState<InstallProgress>({
    status: "Idle",
    progress: 0,
    message: "",
  });
  const [isInstalling, setIsInstalling] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Check Ollama installation on mount
  useEffect(() => {
    checkOllamaInstallation();
    fetchInstallInfo();

    // Listen for installation progress
    const setupListener = async () => {
      try {
        console.log("Setting up install-progress listener...");
        const unlisten = await listen<InstallProgress>(
          "install-progress",
          (event) => {
            console.log("Received install-progress event:", event.payload);
            const payload = event.payload;
            setInstallProgress(payload);

            // Add log message if present
            if (payload.log) {
              console.log("Adding log:", payload.log);
              setLogs((prev) => [...prev, payload.log!]);
            }

            if (payload.status === "Completed") {
              console.log("Installation completed!");
              setIsInstalling(false);
              checkOllamaInstallation();
            }

            if (payload.status === "Error") {
              console.log("Installation error:", payload.error);
              setIsInstalling(false);
            }
          },
        );
        console.log("Listener set up successfully");
        return unlisten;
      } catch (error) {
        console.error("Failed to set up listener:", error);
        return () => {};
      }
    };

    const unlistenPromise = setupListener();

    return () => {
      unlistenPromise.then((fn) => {
        if (fn) fn();
      });
    };
  }, []);

  // Auto-scroll log container to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const fetchInstallInfo = async () => {
    try {
      const info = await invoke<InstallInfo>("get_install_info");
      setInstallInfo(info);
    } catch (error) {
      console.error("Failed to get install info:", error);
    }
  };

  const checkOllamaInstallation = async () => {
    setLoading(true);
    try {
      const installed = await invoke<boolean>("check_ollama_installed");
      setIsOllamaInstalled(installed);

      if (installed) {
        const version = await invoke<string>("get_ollama_version");
        setOllamaVersion(version);
      }
    } catch (error) {
      console.error("Failed to check Ollama installation:", error);
      setIsOllamaInstalled(false);
    } finally {
      setLoading(false);
    }
  };

  const handleInstallOllama = async () => {
    console.log("Starting installation...");
    setIsInstalling(true);
    setLogs([]);
    setInstallProgress({
      status: "Installing",
      progress: 0,
      message: "Starting installation...",
    });

    try {
      await invoke("download_ollama");
      console.log("Installation command completed");
    } catch (error) {
      console.error("Installation failed:", error);
      setInstallProgress({
        status: "Error",
        progress: 0,
        message: "Installation failed",
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      });
      setIsInstalling(false);
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

  // Show loading state
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

  // Show installation UI if Ollama is not installed
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
            Ollama is required to run AI models locally. Install it now to get
            started with Solyn.
          </p>

          {installProgress.status === "Idle" && installInfo && (
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-left">
                <h3 className="text-sm font-semibold text-white/80 mb-3">
                  Installation Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-white/60 gap-4">
                    <span className="shrink-0">Platform</span>
                    <span className="text-white text-right">
                      {getPlatformDisplay()}
                    </span>
                  </div>
                  <div className="flex justify-between text-white/60 gap-4">
                    <span className="shrink-0">Method</span>
                    <span className="text-white text-right">
                      {installInfo.method}
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
                  <div className="flex justify-between text-white/60 gap-4">
                    <span className="shrink-0">Models</span>
                    <span className="text-white/80 text-right text-xs">
                      {installInfo.models_note}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleInstallOllama}
                disabled={isInstalling}
                className="px-8 py-3 bg-(--color-purple-accent) hover:bg-(--color-purple-accent)/80 disabled:opacity-50 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 mx-auto"
              >
                <FiDownload size={18} />
                Install Ollama for {getPlatformDisplay()}
              </button>

              <div className="text-xs text-white/30">
                <span className="block">Or manually install from </span>
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

          {(installProgress.status === "Downloading" ||
            installProgress.status === "Verifying" ||
            installProgress.status === "Installing") && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="relative w-full bg-white/10 rounded-full h-3 overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full bg-(--color-purple-accent) transition-all duration-500"
                    style={{ width: `${installProgress.progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-center gap-3">
                  <FiLoader
                    className="animate-spin text-(--color-purple-accent)"
                    size={20}
                  />
                  <span className="text-white/80">
                    {installProgress.message}
                  </span>
                </div>
                <div className="text-sm text-white/40">
                  {installProgress.progress}% complete
                </div>
              </div>

              {/* Log output terminal */}
              {logs.length > 0 && (
                <div className="bg-black/40 border border-white/10 rounded-xl p-4 text-left">
                  <div className="flex items-center gap-2 mb-2 text-white/40 text-xs">
                    <FiTerminal size={12} />
                    <span>Installation Log ({logs.length} lines)</span>
                  </div>
                  <div
                    ref={logContainerRef}
                    className="max-h-48 overflow-y-auto font-mono text-xs space-y-1"
                  >
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className={`${
                          log.startsWith("⚠️")
                            ? "text-yellow-400"
                            : log.startsWith("✅")
                              ? "text-green-400"
                              : log.startsWith("📥") || log.startsWith("📦")
                                ? "text-blue-400"
                                : log.startsWith("❌")
                                  ? "text-red-400"
                                  : "text-white/60"
                        }`}
                      >
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left">
                <p className="text-xs text-white/40">
                  ⚠️ The installation may require administrator privileges.
                  Please approve any system prompts that appear.
                </p>
              </div>
            </div>
          )}

          {installProgress.status === "Completed" && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 text-green-400">
                <FiCheck size={24} />
                <span className="text-lg font-medium">
                  Installation Complete! 🎉
                </span>
              </div>
              <p className="text-white/60">{installProgress.message}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all"
              >
                Refresh to Continue
              </button>
            </div>
          )}

          {installProgress.status === "Error" && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 text-red-400">
                <FiAlertCircle size={24} />
                <span className="text-lg font-medium">Installation Failed</span>
              </div>
              <p className="text-white/60">
                {installProgress.error || "An unknown error occurred."}
              </p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left text-sm text-white/60">
                <h4 className="font-semibold text-white/80 mb-2">
                  🔧 Troubleshooting:
                </h4>
                <div className="space-y-2">
                  <p>
                    <span className="text-white/80">
                      1. Manual Installation:
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
                  setInstallProgress({
                    status: "Idle",
                    progress: 0,
                    message: "",
                  });
                  setLogs([]);
                }}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-all"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Show success state when Ollama is installed
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
              setIsOllamaInstalled(false);
              setInstallProgress({ status: "Idle", progress: 0, message: "" });
              setLogs([]);
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
