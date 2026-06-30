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
  FiChevronDown,
  FiDownloadCloud,
  FiHeart,
  FiFolder,
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
  onDownload: (modelId: string, filename: string) => Promise<void>;
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
  // Remove file extension for cleaner matching
  const name = filename.replace(/\.gguf$/i, "");

  // Common quantization patterns - ordered by specificity
  const patterns = [
    // IQ (I-quant) formats
    /IQ[1-4]_[XSML]?/i,
    // Q formats with K/M
    /Q[2-8]_[0-9K_][0-9K_]*/i,
    // Simple Q formats
    /Q[2-8]_[0-9]/i,
    // F formats (float)
    /F[1-9][0-9]?/i,
    // Other common patterns
    /q4_k_m|q5_k_m|q6_k|q8_0|q4_0|q5_0|q2_k|q3_k/i,
  ];

  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      // Normalize to uppercase for consistency
      return match[0].toUpperCase();
    }
  }

  // Check for specific patterns without regex
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

// Get unique quantization labels from files
const getUniqueQuantizations = (
  files: { filename: string; size: number; url: string }[],
) => {
  const quantMap = new Map<
    string,
    { filename: string; size: number; url: string }
  >();

  for (const file of files) {
    const quant = getQuantizationLabel(file.filename);
    if (quant) {
      // If this quantization already exists, keep the one with the most detailed name
      if (
        !quantMap.has(quant) ||
        file.filename.length > quantMap.get(quant)!.filename.length
      ) {
        quantMap.set(quant, file);
      }
    }
  }

  return Array.from(quantMap.values());
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
  const [selectedFile, setSelectedFile] = useState<Map<string, string>>(
    new Map(),
  );

  const getDownloadKey = (modelId: string, filename: string): string => {
    return `${modelId}::${filename}`;
  };

  const isDownloading = (modelId: string, filename: string): boolean => {
    return downloadingModels.has(getDownloadKey(modelId, filename));
  };

  const handleFileSelect = (modelId: string, filename: string) => {
    setSelectedFile((prev) => new Map(prev).set(modelId, filename));
  };

  if (loading && models.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <FiLoader className="animate-spin text-[#7d7abc]" size={40} />
      </div>
    );
  }

  if (error && models.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[#d8d4cf] text-lg mb-2">Failed to load models</p>
        <p className="text-[#d8d4cf]/40 text-sm mb-4">{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-[#121212] hover:bg-[#d8d4cf]/10 rounded-lg text-[#d8d4cf] transition-all flex items-center gap-2 cursor-pointer"
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
      <div className="flex items-center justify-between text-sm text-[#d8d4cf]/40 px-2 py-2 bg-[#121212]/50 rounded-lg border border-[#d8d4cf]/5">
        <div className="flex items-center gap-3">
          <FiServer className="text-[#7d7abc]" size={16} />
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
          <p className="text-[#d8d4cf]/40 text-lg">No models available</p>
          <p className="text-[#d8d4cf]/30 text-sm mt-2">
            Try refreshing or check your connection
          </p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-4 px-4 py-2 bg-[#121212] hover:bg-[#d8d4cf]/10 rounded-lg text-[#d8d4cf] transition-all flex items-center gap-2 mx-auto cursor-pointer"
            >
              <FiRefreshCw size={16} />
              Refresh
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {models.map((model) => {
            // Get unique quantizations
            const uniqueFiles = getUniqueQuantizations(model.gguf_files);
            const defaultFile =
              uniqueFiles.length > 0 ? uniqueFiles[0].filename : "";
            const selectedFileName = selectedFile.get(model.id) || defaultFile;
            const selectedFileData = uniqueFiles.find(
              (f) => f.filename === selectedFileName,
            );

            // Skip models with no identifiable quantization
            if (uniqueFiles.length === 0) {
              return null;
            }

            return (
              <div
                key={model.id}
                className="bg-[#121212] border border-[#d8d4cf]/10 rounded-xl p-5 hover:bg-[#d8d4cf]/5 hover:border-[#d8d4cf]/20 transition-all duration-200 flex flex-col h-full"
              >
                {/* Model header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[#d8d4cf] font-semibold truncate text-base">
                      {model.name || model.id}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <FiUser className="text-[#d8d4cf]/30" size={12} />
                      <span className="text-[#d8d4cf]/40 text-xs">
                        {model.author || "Unknown"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {model.description && (
                  <p className="text-[#d8d4cf]/40 text-sm line-clamp-2 mb-3 flex-1">
                    {model.description}
                  </p>
                )}

                {/* Model stats */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {model.downloads !== undefined && model.downloads > 0 && (
                    <span className="text-xs bg-[#121212] px-2 py-1 rounded-full text-[#d8d4cf]/60 flex items-center gap-1">
                      <FiDownloadCloud size={12} />
                      {formatDownloads(model.downloads)}
                    </span>
                  )}
                  {model.likes !== undefined && model.likes > 0 && (
                    <span className="text-xs bg-[#121212] px-2 py-1 rounded-full text-[#d8d4cf]/60 flex items-center gap-1">
                      <FiHeart size={12} />
                      {model.likes}
                    </span>
                  )}
                  <span className="text-xs bg-[#121212] px-2 py-1 rounded-full text-[#d8d4cf]/60 flex items-center gap-1">
                    <FiFolder size={12} />
                    {uniqueFiles.length} files
                  </span>
                </div>

                {/* GGUF file selection */}
                <div className="mb-4 space-y-2">
                  <div className="relative">
                    <select
                      value={selectedFileName}
                      onChange={(e) =>
                        handleFileSelect(model.id, e.target.value)
                      }
                      className="w-full bg-[#0a0a0a] text-[#d8d4cf] border border-[#d8d4cf]/10 rounded-lg px-3 py-2 pr-8 text-sm appearance-none hover:border-[#d8d4cf]/30 transition-all focus:outline-none focus:border-[#7d7abc]"
                    >
                      {uniqueFiles.map((file) => (
                        <option key={file.filename} value={file.filename}>
                          {getQuantizationLabel(file.filename)}
                        </option>
                      ))}
                    </select>
                    <FiChevronDown
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#d8d4cf]/40 pointer-events-none"
                      size={14}
                    />
                  </div>

                  {/* Show selected file details */}
                  {selectedFileData && (
                    <div className="text-xs text-[#d8d4cf]/30 px-1 flex items-center gap-2">
                      <FiFile size={12} />
                      <span className="truncate">
                        {selectedFileData.filename}
                      </span>
                    </div>
                  )}
                </div>

                {/* Download button */}
                <button
                  onClick={() => onDownload(model.id, selectedFileName)}
                  disabled={
                    isDownloading(model.id, selectedFileName) ||
                    !selectedFileName ||
                    uniqueFiles.length === 0
                  }
                  className="w-full mt-auto px-4 py-2.5 bg-[#7d7abc] hover:bg-[#7d7abc]/80 disabled:opacity-50 text-[#d8d4cf] rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isDownloading(model.id, selectedFileName) ? (
                    <>
                      <FiLoader className="animate-spin" size={16} />
                      Downloading...
                    </>
                  ) : !selectedFileName || uniqueFiles.length === 0 ? (
                    <>
                      <FiFile size={16} />
                      No Quantized File
                    </>
                  ) : (
                    <>
                      <FiDownload size={16} />
                      Download {getQuantizationLabel(selectedFileName)}
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
            className="p-2 bg-[#121212] hover:bg-[#d8d4cf]/10 disabled:opacity-30 rounded-lg text-[#d8d4cf]/60 transition-all cursor-pointer disabled:cursor-not-allowed"
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
                      ? "bg-[#7d7abc] text-[#d8d4cf]"
                      : "bg-[#121212] hover:bg-[#d8d4cf]/10 text-[#d8d4cf]/60"
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
            className="p-2 bg-[#121212] hover:bg-[#d8d4cf]/10 disabled:opacity-30 rounded-lg text-[#d8d4cf]/60 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <FiChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};
