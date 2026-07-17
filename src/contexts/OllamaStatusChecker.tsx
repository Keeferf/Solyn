import { useEffect, useRef, useState } from "react";
import { useOllama } from "../contexts/OllamaContext";
import { OllamaDownloadPage } from "@/components/OllamaDownloadPage";
import { FiDownload, FiExternalLink, FiServer } from "react-icons/fi";

interface OllamaStatusCheckerProps {
  children: React.ReactNode;
}

export const OllamaStatusChecker = ({ children }: OllamaStatusCheckerProps) => {
  const { status, loading, startOllama, isReady, refreshOllamaStatus } =
    useOllama();
  const startAttempted = useRef(false);
  const [showDownloadPage, setShowDownloadPage] = useState(false);
  // Remove unused showDownloadPrompt state
  // const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);

  // Handle automatic start when installed but not running
  useEffect(() => {
    if (
      status?.installed &&
      !status?.running &&
      !loading &&
      !startAttempted.current
    ) {
      startAttempted.current = true;
      console.log(
        "Ollama is installed but not running. Attempting to start...",
      );
      startOllama().catch((error) => {
        console.error("Failed to start Ollama automatically:", error);
        startAttempted.current = false;
      });
    }
  }, [status, loading, startOllama]);

  // Reset start attempt when running
  useEffect(() => {
    if (status?.running) {
      startAttempted.current = false;
    }
  }, [status?.running]);

  // If Ollama is not installed, show download prompt
  if (!loading && status?.installed === false && !showDownloadPage) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-center max-w-md p-8">
          <div className="mb-6">
            <div className="w-20 h-20 mx-auto mb-4 bg-purple-accent/20 rounded-full flex items-center justify-center">
              <FiServer className="w-10 h-10 text-purple-accent" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Ollama Not Installed
            </h2>
            <p className="text-white/60 text-sm leading-relaxed">
              Ollama is required to run AI models locally. Please download and
              install it to continue using the app.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setShowDownloadPage(true)}
              className="w-full px-6 py-3 bg-purple-accent hover:bg-purple-accent/80 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <FiDownload size={18} />
              Download Ollama
            </button>

            <a
              href="https://ollama.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 text-white/40 hover:text-white/60 text-sm transition-colors cursor-pointer"
            >
              Visit Ollama Website
              <FiExternalLink size={14} />
            </a>
          </div>

          <div className="mt-6 pt-6 border-t border-white/5">
            <p className="text-white/20 text-xs">
              Installation typically takes 2-5 minutes depending on your
              connection.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If user clicked download, show the download page
  if (showDownloadPage) {
    return (
      <OllamaDownloadPage
        onBack={() => {
          setShowDownloadPage(false);
          refreshOllamaStatus();
        }}
        refreshOllamaStatus={refreshOllamaStatus}
        isOllamaInstalled={false}
        onInstallComplete={() => {
          // After installation, refresh status
          refreshOllamaStatus();
        }}
      />
    );
  }

  // Show loading state while checking status
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-accent mx-auto"></div>
          <p className="mt-4 text-white/60">Checking Ollama status...</p>
        </div>
      </div>
    );
  }

  // Show starting state (installed but not yet running)
  if (!isReady && status?.installed) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-accent mx-auto"></div>
          <p className="mt-4 text-white/60">Starting Ollama...</p>
          <p className="text-white/40 text-sm mt-2">
            {startAttempted.current
              ? "Ollama is starting up. Please wait..."
              : "Ollama is installed but not responding. Attempting to start..."}
          </p>
        </div>
      </div>
    );
  }

  // Ollama is ready - render children
  return <>{children}</>;
};
