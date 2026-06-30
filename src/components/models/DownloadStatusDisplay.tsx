// src/components/models/DownloadStatusDisplay.tsx
import { FiLoader, FiCheckCircle, FiXCircle, FiDownload } from "react-icons/fi";

interface DownloadStatusDisplayProps {
  modelId: string;
  progress: number;
  message: string;
  status: string;
}

export const DownloadStatusDisplay = ({
  modelId,
  progress,
  message,
  status,
}: DownloadStatusDisplayProps) => {
  const getStatusIcon = () => {
    switch (status) {
      case "complete":
        return <FiCheckCircle className="text-green-400" size={20} />;
      case "error":
        return <FiXCircle className="text-red-400" size={20} />;
      case "downloading":
        return <FiLoader className="animate-spin text-purple-500" size={20} />;
      default:
        return <FiDownload className="text-white/40" size={20} />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "complete":
        return "border-green-500/30 bg-green-500/10";
      case "error":
        return "border-red-500/30 bg-red-500/10";
      case "downloading":
        return "border-purple-500/30 bg-purple-500/10";
      default:
        return "border-white/10 bg-white/5";
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${getStatusColor()} transition-all`}>
      <div className="flex items-center gap-3 mb-2">
        {getStatusIcon()}
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">{modelId}</p>
          <p className="text-white/60 text-sm truncate">{message}</p>
        </div>
        <span className="text-white/40 text-sm font-mono">{progress}%</span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            status === "error"
              ? "bg-red-500"
              : status === "complete"
                ? "bg-green-500"
                : "bg-purple-500"
          }`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
    </div>
  );
};
