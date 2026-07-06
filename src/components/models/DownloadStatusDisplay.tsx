// src/components/DownloadStatusDisplay.tsx
import { FiX, FiLoader, FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { invoke } from "@tauri-apps/api/core";

interface DownloadStatusDisplayProps {
  modelId: string;
  filename: string;
  progress: number;
  message: string;
  status: string;
  onCancel?: () => void; // Add optional cancel callback
}

export const DownloadStatusDisplay = ({
  modelId,
  filename,
  progress,
  status,
  onCancel,
}: DownloadStatusDisplayProps) => {
  // Format filename for display
  const displayName =
    filename.length > 40 ? filename.substring(0, 37) + "..." : filename;

  const isComplete = status === "complete";
  const isError = status === "error";
  const isCancelled = status === "cancelled";
  const isActive = status === "downloading" || status === "starting";
  const isStarting = status === "starting";

  const progressColor = isError
    ? "bg-red-500"
    : isComplete
      ? "bg-green-500"
      : isCancelled
        ? "bg-yellow-500"
        : "bg-purple-accent";
  const progressValue = Math.min(Math.max(progress, 0), 100);

  const handleCancel = async () => {
    try {
      await invoke("cancel_huggingface_download", {
        modelId,
        filename,
      });
      if (onCancel) {
        onCancel();
      }
    } catch (error) {
      console.error("Failed to cancel download:", error);
    }
  };

  // Determine status icon
  const StatusIcon = () => {
    if (isComplete)
      return <FiCheckCircle className="text-green-500 shrink-0" size={16} />;
    if (isError)
      return <FiAlertCircle className="text-red-500 shrink-0" size={16} />;
    if (isCancelled)
      return <FiAlertCircle className="text-yellow-500 shrink-0" size={16} />;
    if (isStarting)
      return (
        <FiLoader
          className="animate-spin text-purple-accent shrink-0"
          size={16}
        />
      );
    if (isActive)
      return (
        <FiLoader
          className="animate-spin text-purple-accent shrink-0"
          size={16}
        />
      );
    return null;
  };

  return (
    <div className="bg-black/50 rounded-lg border border-white/10 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <StatusIcon />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-sm">
                {isComplete ? "Downloaded:" : "Downloading:"}
              </span>
              <span className="text-white text-sm font-mono truncate">
                {displayName}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4 shrink-0">
          <span className="text-white/60 text-sm font-mono whitespace-nowrap">
            {isComplete
              ? "✓"
              : isError
                ? "✗"
                : isCancelled
                  ? "⊘"
                  : `${progressValue.toFixed(1)}%`}
          </span>
          {isActive && !isComplete && !isError && !isCancelled && (
            <button
              onClick={handleCancel}
              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs transition-all cursor-pointer border border-red-500/20 hover:border-red-500/40 flex items-center gap-1"
            >
              <FiX size={12} />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${progressColor}`}
          style={{
            width: isComplete
              ? "100%"
              : isError
                ? "100%"
                : isCancelled
                  ? "100%"
                  : `${progressValue}%`,
          }}
        />
      </div>
    </div>
  );
};
