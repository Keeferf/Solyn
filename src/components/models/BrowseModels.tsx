// src/components/models/BrowseModels.tsx
import { useState } from "react";
import {
  FiDownload,
  FiLoader,
  FiFile,
  FiChevronLeft,
  FiChevronRight,
  FiServer,
  FiUser,
  FiRefreshCw,
  FiHeart,
  FiDownloadCloud,
  FiFolder,
  FiChevronDown,
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
  onModelClick: (model: HFModel) => void;
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

const getQuantizationLabel = (filename: string): string | null => {
  const name = filename.replace(/\.gguf$/i, "");

  const patterns = [
    /IQ[1-4]_[XSML]?/i,
    /Q[2-8]_[0-9K_][0-9K_]*/i,
    /Q[2-8]_[0-9]/i,
    /F[1-9][0-9]?/i,
    /q4_k_m|q5_k_m|q6_k|q8_0|q4_0|q5_0|q2_k|q3_k/i,
  ];

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      return match[0].toUpperCase();
    }
  }

  const lowerName = name.toLowerCase();
  const quantMap: { [key: string]: string } = {
    q4_k_m: "Q4_K_M",
    q5_k_m: "Q5_K_M",
    q6_k: "Q6_K",
    q8_0: "Q8_0",
    q4_0: "Q4_0",
    q5_0: "Q5_0",
    q2_k: "Q2_K",
    q3_k: "Q3_K",
    f16: "F16",
    f32: "F32",
  };

  for (const [key, value] of Object.entries(quantMap)) {
    if (lowerName.includes(key)) {
      return value;
    }
  }

  return null;
};

// Get first 3 unique quantizations for display
const getQuantizationPreview = (
  files: { filename: string; size: number; url: string }[],
): string[] => {
  const quants = new Set<string>();
  for (const file of files) {
    const quant = getQuantizationLabel(file.filename);
    if (quant) {
      quants.add(quant);
      if (quants.size >= 3) break;
    }
  }
  return Array.from(quants);
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
  onModelClick,
  onRefresh,
  error,
}: BrowseModelsProps) => {
  const totalPages = Math.max(1, Math.ceil(totalModels / modelsPerPage));

  if (loading && models.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <FiLoader
          className="animate-spin text-[var(--color-purple-accent)]"
          size={40}
        />
      </div>
    );
  }

  if (error && models.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[var(--color-white)] text-lg mb-2">
          Failed to load models
        </p>
        <p className="text-[var(--color-white)]/40 text-sm mb-4">{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-[var(--color-black)] hover:bg-[var(--color-white)]/10 rounded-lg text-[var(--color-white)] transition-all flex items-center gap-2 cursor-pointer"
          >
            <FiRefreshCw size={16} />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Info banner */}
      <div className="flex items-center justify-between text-sm text-[var(--color-white)]/40 px-2 py-2 bg-[var(--color-black)]/50 rounded-lg border border-[var(--color-white)]/5">
        <div className="flex items-center gap-3">
          <FiServer className="text-[var(--color-purple-accent)]" size={16} />
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
          <p className="text-[var(--color-white)]/40 text-lg">
            No models available
          </p>
          <p className="text-[var(--color-white)]/30 text-sm mt-2">
            Try refreshing or check your connection
          </p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-4 px-4 py-2 bg-[var(--color-black)] hover:bg-[var(--color-white)]/10 rounded-lg text-[var(--color-white)] transition-all flex items-center gap-2 mx-auto cursor-pointer"
            >
              <FiRefreshCw size={16} />
              Refresh
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {models.map((model) => {
            // Get unique quantizations for preview
            const quantPreviews = getQuantizationPreview(model.gguf_files);
            const hasGGUF = model.gguf_files.length > 0;

            return (
              <div
                key={model.id}
                onClick={() => hasGGUF && onModelClick(model)}
                className={`bg-[var(--color-black)] border border-[var(--color-white)]/10 rounded-xl p-5 transition-all duration-200 flex flex-col h-full ${
                  hasGGUF
                    ? "hover:bg-[var(--color-white)]/5 hover:border-[var(--color-white)]/20 cursor-pointer hover:scale-[1.02]"
                    : "opacity-50 cursor-not-allowed"
                }`}
              >
                {/* Model header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[var(--color-white)] font-semibold truncate text-base">
                      {model.name || model.model_id}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <FiUser
                        className="text-[var(--color-white)]/30"
                        size={12}
                      />
                      <span className="text-[var(--color-white)]/40 text-xs">
                        {model.author || "Unknown"}
                      </span>
                    </div>
                  </div>
                  {hasGGUF && (
                    <div className="text-[var(--color-white)]/30 text-xs bg-[var(--color-purple-accent)]/10 px-2 py-1 rounded-full border border-[var(--color-purple-accent)]/20">
                      <FiChevronDown size={14} />
                    </div>
                  )}
                </div>

                {/* Description */}
                {model.description && (
                  <p className="text-[var(--color-white)]/40 text-sm line-clamp-2 mb-3 flex-1">
                    {model.description}
                  </p>
                )}

                {/* Model stats */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {model.downloads !== undefined && model.downloads > 0 && (
                    <span className="text-xs bg-[var(--color-purple-accent)]/15 text-[var(--color-purple-accent)] px-2 py-1 rounded-full border border-[var(--color-purple-accent)]/20 flex items-center gap-1">
                      <FiDownloadCloud size={12} />
                      {formatDownloads(model.downloads)}
                    </span>
                  )}
                  {model.likes !== undefined && model.likes > 0 && (
                    <span className="text-xs bg-rose-500/15 text-rose-400 px-2 py-1 rounded-full border border-rose-500/20 flex items-center gap-1">
                      <FiHeart size={12} />
                      {model.likes}
                    </span>
                  )}
                  <span className="text-xs bg-[var(--color-purple-accent)]/10 text-[var(--color-white)]/60 px-2 py-1 rounded-full border border-[var(--color-white)]/10 flex items-center gap-1">
                    <FiFolder size={12} />
                    {model.gguf_files.length} files
                  </span>
                </div>

                {/* Quantization preview chips */}
                {quantPreviews.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-auto pt-3 border-t border-[var(--color-white)]/5">
                    {quantPreviews.map((quant) => (
                      <span
                        key={quant}
                        className="text-xs bg-[var(--color-purple-accent)]/10 text-[var(--color-white)]/60 px-2.5 py-1 rounded-full border border-[var(--color-white)]/10 font-mono"
                      >
                        {quant}
                      </span>
                    ))}
                    {model.gguf_files.length > quantPreviews.length && (
                      <span className="text-xs text-[var(--color-white)]/30 px-1 flex items-center">
                        +{model.gguf_files.length - quantPreviews.length} more
                      </span>
                    )}
                  </div>
                )}
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
            className="p-2 bg-[var(--color-black)] hover:bg-[var(--color-white)]/10 disabled:opacity-30 rounded-lg text-[var(--color-white)]/60 transition-all cursor-pointer disabled:cursor-not-allowed"
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
                      ? "bg-[var(--color-purple-accent)] text-[var(--color-white)]"
                      : "bg-[var(--color-black)] hover:bg-[var(--color-white)]/10 text-[var(--color-white)]/60"
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
            className="p-2 bg-[var(--color-black)] hover:bg-[var(--color-white)]/10 disabled:opacity-30 rounded-lg text-[var(--color-white)]/60 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <FiChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};
