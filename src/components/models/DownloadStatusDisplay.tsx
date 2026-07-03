// src/components/models/DownloadStatusDisplay.tsx
import {
  FiLoader,
  FiCheckCircle,
  FiXCircle,
  FiDownload,
  FiFile,
} from "react-icons/fi";

interface DownloadStatusDisplayProps {
  modelId: string;
  filename: string;
  progress: number;
  message: string;
  status: string;
}

export const DownloadStatusDisplay = ({
  modelId,
  filename,
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
        return (
          <FiLoader className="animate-spin text-purple-accent" size={20} />
        );
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
        return "border-purple-accent/30 bg-purple-accent/10";
      default:
        return "border-white/10 bg-white/5";
    }
  };

  // Helper to extract quantization from filename
  const getQuantizationLabel = (filename: string): string => {
    const match = filename.match(
      /Q[0-9]_[0-9K]|Q[0-9]_[0-9]|F[0-9]{2}|[IQ][0-9]_[0-9]/,
    );
    if (match) return match[0];
    if (filename.includes("q4")) return "Q4";
    if (filename.includes("q5")) return "Q5";
    if (filename.includes("q8")) return "Q8";
    if (filename.includes("f16")) return "F16";
    if (filename.includes("f32")) return "F32";
    return "GGUF";
  };

  return (
    <div className={`border rounded-lg p-4 ${getStatusColor()} transition-all`}>
      <div className="flex items-center gap-3 mb-2">
        {getStatusIcon()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white font-medium truncate">{modelId}</p>
            <span className="text-xs text-white/30 bg-white/5 px-2 py-0.5 rounded-full whitespace-nowrap">
              {getQuantizationLabel(filename)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiFile className="text-white/30" size={12} />
            <p className="text-white/60 text-sm truncate">{filename}</p>
          </div>
          <p className="text-white/40 text-xs mt-0.5">{message}</p>
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
                : "bg-purple-accent"
          }`}
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
    </div>
  );
};
