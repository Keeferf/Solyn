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
  // Format filename for display
  const displayName =
    filename.length > 40 ? filename.substring(0, 37) + "..." : filename;

  const isComplete = status === "complete";
  const isError = status === "error";

  const progressColor = isError
    ? "bg-red-500"
    : isComplete
      ? "bg-green-500"
      : "bg-purple-accent";
  const progressValue = Math.min(Math.max(progress, 0), 100);

  return (
    <div className="bg-black/50 rounded-lg border border-white/10 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-sm">Downloading:</span>
            <span className="text-white text-sm font-mono truncate">
              {displayName}
            </span>
            <span className="text-white/40 text-xs ml-2">
              {modelId.split("/").pop()}
            </span>
          </div>
          <span
            className={`text-xs ${
              isError
                ? "text-red-400"
                : isComplete
                  ? "text-green-400"
                  : "text-white/40"
            }`}
          >
            {message}
          </span>
        </div>
        <span className="text-white/60 text-sm font-mono ml-4 whitespace-nowrap">
          {isComplete ? "✓" : isError ? "✗" : `${progressValue.toFixed(1)}%`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${progressColor}`}
          style={{
            width: isComplete ? "100%" : isError ? "100%" : `${progressValue}%`,
          }}
        />
      </div>
    </div>
  );
};
