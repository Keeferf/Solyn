// src/components/models/BrowseModels.tsx
import {
  FiDownload,
  FiLoader,
  FiFile,
  FiChevronLeft,
  FiChevronRight,
  FiServer,
  FiUser,
  FiRefreshCw,
} from "react-icons/fi";
import { HFModel } from "./hooks/useHuggingFaceModels";

interface BrowseModelsProps {
  models: HFModel[];
  loading: boolean;
  downloadingModels: Set<string>;
  currentPage: number;
  totalModels: number;
  modelsPerPage: number;
  onGoToPage: (page: number) => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onDownload: (modelId: string) => Promise<void>;
  onRefresh?: () => void;
  error?: string | null;
}

const formatDownloads = (downloads?: number): string => {
  if (!downloads) return "0";
  if (downloads >= 1_000_000) {
    return `${(downloads / 1_000_000).toFixed(1)}M`;
  }
  if (downloads >= 1_000) {
    return `${(downloads / 1_000).toFixed(1)}K`;
  }
  return downloads.toString();
};

const formatSize = (size?: number): string => {
  if (!size) return "Unknown";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return `${(size / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

const getQuantizationColor = (quantization: string): string => {
  const colors: Record<string, string> = {
    Q8_0: "bg-green-500/20 text-green-400 border-green-500/30",
    Q8_1: "bg-green-500/20 text-green-400 border-green-500/30",
    Q6_K: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Q5_K: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Q5_0: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Q5_1: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    Q4_K: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    Q4_0: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    Q4_1: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    Q3_K: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    Q3_0: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    Q3_1: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    Q2_K: "bg-red-500/20 text-red-400 border-red-500/30",
    FP16: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    FP32: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  };
  return colors[quantization] || "bg-white/10 text-white/40 border-white/10";
};

export const BrowseModels = ({
  models,
  loading,
  downloadingModels,
  currentPage,
  totalModels,
  modelsPerPage,
  onGoToPage,
  onNextPage,
  onPreviousPage,
  onDownload,
  onRefresh,
  error,
}: BrowseModelsProps) => {
  const totalPages = Math.max(1, Math.ceil(totalModels / modelsPerPage));

  if (loading && models.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <FiLoader className="animate-spin text-purple-500" size={40} />
      </div>
    );
  }

  if (error && models.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-red-400 text-lg mb-2">Failed to load models</p>
        <p className="text-white/40 text-sm mb-4">{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all flex items-center gap-2 cursor-pointer"
          >
            <FiRefreshCw size={16} />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="flex items-center justify-between text-sm text-white/40 px-2 py-2 bg-white/5 rounded-lg border border-white/5">
        <div className="flex items-center gap-3">
          <FiServer className="text-purple-500" size={16} />
          <span>GGUF models from Hugging Face</span>
        </div>
        {totalModels > 0 && (
          <span>
            Page {currentPage} of {totalPages} · {totalModels} total
          </span>
        )}
      </div>

      {/* Model grid */}
      {models.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-white/40 text-lg">No models available</p>
          <p className="text-white/30 text-sm mt-2">
            Try refreshing or check your connection
          </p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all flex items-center gap-2 mx-auto cursor-pointer"
            >
              <FiRefreshCw size={16} />
              Refresh
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((model) => {
            const isDownloading = downloadingModels.has(model.id);
            const ggufFile =
              model.gguf_files && model.gguf_files.length > 0
                ? model.gguf_files[0]
                : null;

            return (
              <div
                key={model.id}
                className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/8 hover:border-white/20 transition-all duration-200 flex flex-col h-full"
              >
                {/* Model header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-semibold truncate text-base">
                      {model.name || model.id}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <FiUser className="text-white/30" size={12} />
                      <span className="text-white/40 text-xs">
                        {model.author || "Unknown"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {model.description && (
                  <p className="text-white/40 text-sm line-clamp-2 mb-3 flex-1">
                    {model.description}
                  </p>
                )}

                {/* Model stats */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {model.downloads !== undefined && model.downloads > 0 && (
                    <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-white/60 flex items-center gap-1">
                      ⬇️ {formatDownloads(model.downloads)}
                    </span>
                  )}
                  {model.likes !== undefined && model.likes > 0 && (
                    <span className="text-xs bg-white/10 px-2 py-1 rounded-full text-white/60 flex items-center gap-1">
                      ❤️ {model.likes}
                    </span>
                  )}
                  {ggufFile && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full border ${getQuantizationColor(ggufFile.quantization)}`}
                    >
                      {ggufFile.quantization}
                    </span>
                  )}
                </div>

                {/* GGUF file info */}
                {ggufFile && (
                  <div className="flex items-center gap-3 text-xs text-white/30 mb-4 pt-2 border-t border-white/5">
                    <span className="flex items-center gap-1">
                      <FiFile size={12} />
                      {formatSize(ggufFile.size)}
                    </span>
                    <span className="truncate flex-1">{ggufFile.filename}</span>
                  </div>
                )}

                {/* Tags */}
                {model.tags && model.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {model.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-white/5 px-2 py-0.5 rounded-full text-white/30"
                      >
                        {tag}
                      </span>
                    ))}
                    {model.tags.length > 3 && (
                      <span className="text-xs text-white/20">
                        +{model.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Download button */}
                <button
                  onClick={() => onDownload(model.id)}
                  disabled={isDownloading || !ggufFile}
                  className="w-full mt-auto px-4 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isDownloading ? (
                    <>
                      <FiLoader className="animate-spin" size={16} />
                      Downloading...
                    </>
                  ) : !ggufFile ? (
                    <>
                      <FiFile size={16} />
                      No GGUF File
                    </>
                  ) : (
                    <>
                      <FiDownload size={16} />
                      Download Model
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={onPreviousPage}
            disabled={currentPage === 1 || loading}
            className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg text-white/60 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <FiChevronLeft size={18} />
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => onGoToPage(pageNum)}
                  disabled={loading}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all cursor-pointer ${
                    currentPage === pageNum
                      ? "bg-purple-500 text-white"
                      : "bg-white/5 hover:bg-white/10 text-white/60"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={onNextPage}
            disabled={currentPage === totalPages || loading}
            className="p-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 rounded-lg text-white/60 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <FiChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};
