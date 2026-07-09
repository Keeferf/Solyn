import { useEffect, useRef } from "react";
import { useOllama } from "../contexts/OllamaContext";

interface OllamaStatusCheckerProps {
  children: React.ReactNode;
}

export const OllamaStatusChecker = ({ children }: OllamaStatusCheckerProps) => {
  const { status, loading, startOllama, isReady } = useOllama();
  const startAttempted = useRef(false);

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

  useEffect(() => {
    if (status?.running) {
      startAttempted.current = false;
    }
  }, [status?.running]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-white/60">Checking Ollama status...</p>
        </div>
      </div>
    );
  }

  if (!status?.installed) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-white mb-4">
            Ollama Not Installed
          </h2>
          <p className="text-white/60 mb-6">
            Ollama is required to run models. Please install it first.
          </p>
          <button
            onClick={() => {
              window.open("https://ollama.com/download", "_blank");
            }}
            className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
          >
            Download Ollama
          </button>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto"></div>
          <p className="mt-4 text-white/60">Starting Ollama...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
