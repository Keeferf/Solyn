import { useEffect, useRef, useState } from "react";
import { useOllama } from "../contexts/OllamaContext";
import { OllamaDownloadPage } from "@/components/OllamaDownloadPage";
import {
  FiDownload,
  FiExternalLink,
  FiServer,
  FiAlertCircle,
} from "react-icons/fi";

interface OllamaStatusCheckerProps {
  children: React.ReactNode;
}

export const OllamaStatusChecker = ({ children }: OllamaStatusCheckerProps) => {
  const { status, loading, startOllama, isReady, refreshOllamaStatus } =
    useOllama();

  // Track retry attempts (replaced boolean startAttempted with counter)
  const startAttemptCount = useRef(0);
  const [showDownloadPage, setShowDownloadPage] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [attemptingStart, setAttemptingStart] = useState(false);

  // Auto-start logic with RETRY + EXPONENTIAL BACKOFF
  useEffect(() => {
    if (
      status?.installed &&
      !status?.running &&
      !loading &&
      !attemptingStart &&
      startAttemptCount.current < 3 // Allow up to 3 retries
    ) {
      const attemptNumber = startAttemptCount.current + 1;
      setAttemptingStart(true);
      setStartError(null);

      console.log(`Attempt ${attemptNumber}/3: Starting Ollama...`);

      startOllama()
        .then(() => {
          console.log("Ollama started successfully");
          startAttemptCount.current = 0; // Reset on success
          setAttemptingStart(false);
        })
        .catch((error) => {
          console.error(`Attempt ${attemptNumber} failed:`, error);
          startAttemptCount.current += 1;

          // Exponential backoff: 500ms → 1s → 2s
          const backoffMs = 500 * Math.pow(2, startAttemptCount.current - 1);

          if (startAttemptCount.current < 3) {
            setStartError(
              `Failed to start. Retrying in ${(backoffMs / 1000).toFixed(1)}s...`,
            );
            // Wait before retrying
            setTimeout(() => setAttemptingStart(false), backoffMs);
          } else {
            setStartError(
              "Could not start Ollama after 3 attempts. Please start it manually.",
            );
            setAttemptingStart(false);
          }
        });
    }
  }, [status, loading, startOllama, attemptingStart]);

  // Reset retry count when running
  useEffect(() => {
    if (status?.running) {
      startAttemptCount.current = 0;
      setStartError(null);
      setAttemptingStart(false);
    }
  }, [status?.running]);

  // Not installed → show download page
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

  // Show download page after user clicked download
  if (showDownloadPage) {
    return (
      <OllamaDownloadPage
        onBack={() => {
          setShowDownloadPage(false);
          refreshOllamaStatus();
          startAttemptCount.current = 0;
          setStartError(null);
        }}
        refreshOllamaStatus={refreshOllamaStatus}
        isOllamaInstalled={false}
        onInstallComplete={() => {
          refreshOllamaStatus();
          startAttemptCount.current = 0;
          setStartError(null);
        }}
      />
    );
  }

  // Initial status check loading
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

  // Starting state: installed but not yet running
  if (!isReady && status?.installed) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-accent mx-auto"></div>
          <p className="mt-4 text-white/60">Starting Ollama...</p>

          {/* Show current attempt number */}
          {attemptingStart ? (
            <p className="text-white/40 text-sm mt-2">
              Attempt {startAttemptCount.current + 1} of 3
            </p>
          ) : null}

          {/* Show error or waiting message */}
          {startError ? (
            <div className="mt-4 p-3 bg-amber-500/20 border border-amber-500/50 rounded-lg flex items-start gap-2">
              <FiAlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-amber-500/80 text-xs text-left">
                {startError}
              </p>
            </div>
          ) : (
            <p className="text-white/40 text-sm mt-2">
              Ollama is installed but not responding. Attempting to start...
            </p>
          )}

          {/* Show manual retry button if all attempts failed */}
          {startAttemptCount.current >= 3 && !status?.running ? (
            <button
              onClick={() => {
                startAttemptCount.current = 0;
                setAttemptingStart(false);
                setStartError(null);
              }}
              className="mt-4 px-4 py-2 bg-purple-accent/30 hover:bg-purple-accent/50 text-purple-accent text-sm rounded-lg transition-colors"
            >
              Try Again
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  // Ollama is ready → render children
  return <>{children}</>;
};
