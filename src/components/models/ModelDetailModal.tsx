// src/components/models/ModelDetailModal.tsx
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  FiX,
  FiDownload,
  FiLoader,
  FiFile,
  FiUser,
  FiHeart,
  FiDownloadCloud,
  FiFolder,
  FiInfo,
  FiHardDrive,
} from "react-icons/fi";
import { HFModel, GGUFFile } from "./hooks/useHuggingFaceModels";

interface ModelDetailModalProps {
  model: HFModel | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (modelId: string, filename: string) => Promise<void>;
  downloadingModels: Set<string>;
  isDownloading?: (modelId: string, filename: string) => boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

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

// Get quantization quality description
const getQuantizationDescription = (quant: string | null): string => {
  if (!quant) return "Unknown quantization";

  const descriptions: { [key: string]: string } = {
    Q2_K: "Lowest quality, smallest size (~2-bit)",
    Q3_K: "Very low quality, small size (~3-bit)",
    Q4_0: "Low quality, small size (~4-bit)",
    Q4_K_M: "Medium quality, medium size (~4-bit with K)",
    Q5_0: "Medium quality, medium size (~5-bit)",
    Q5_K_M: "High quality, medium-large size (~5-bit with K)",
    Q6_K: "Very high quality, large size (~6-bit with K)",
    Q8_0: "Highest quality, largest size (~8-bit)",
    F16: "Float 16-bit, very high quality",
    F32: "Float 32-bit, maximum quality",
    IQ1_S: "1-bit quantization (experimental)",
    IQ2_XS: "2-bit quantization (experimental)",
    IQ3_XS: "3-bit quantization (experimental)",
    IQ4_XS: "4-bit quantization (experimental)",
  };

  return descriptions[quant] || `${quant} quantization`;
};

export const ModelDetailModal = ({
  model,
  isOpen,
  onClose,
  onDownload,
  downloadingModels,
  isDownloading = (modelId: string, filename: string) => {
    return downloadingModels.has(`${modelId}::${filename}`);
  },
}: ModelDetailModalProps) => {
  const [selectedFile, setSelectedFile] = useState<GGUFFile | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Reset selection when model changes
  useEffect(() => {
    if (model && model.gguf_files.length > 0) {
      // Filter out files with unknown quantization first
      const validFiles = model.gguf_files.filter(
        (file) => getQuantizationLabel(file.filename) !== null,
      );

      // Sort files by size (largest first as default)
      const sortedFiles = [...validFiles].sort((a, b) => b.size - a.size);
      setSelectedFile(sortedFiles[0] || null);
    } else {
      setSelectedFile(null);
    }
  }, [model]);

  if (!isOpen || !model) return null;

  const getDownloadKey = (modelId: string, filename: string): string => {
    return `${modelId}::${filename}`;
  };

  const handleDownloadClick = () => {
    if (selectedFile) {
      onDownload(model.model_id, selectedFile.filename);
    }
  };

  // Filter out files with unknown quantization
  const validFiles = model.gguf_files.filter(
    (file) => getQuantizationLabel(file.filename) !== null,
  );

  // Sort files by size for display
  const sortedFiles = [...validFiles].sort((a, b) => b.size - a.size);

  // Group files by quantization type for better display
  const groupedFiles = sortedFiles.reduce(
    (acc, file) => {
      const quant = getQuantizationLabel(file.filename) || "Unknown";
      if (!acc[quant]) {
        acc[quant] = [];
      }
      acc[quant].push(file);
      return acc;
    },
    {} as Record<string, GGUFFile[]>,
  );

  const selectedQuant = selectedFile
    ? getQuantizationLabel(selectedFile.filename)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#1a1a1a] border border-[#d8d4cf]/10 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-slideUp">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[#d8d4cf]/10">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-[#d8d4cf] truncate">
              {model.name || model.model_id}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1 text-[#d8d4cf]/40 text-sm">
                <FiUser size={14} />
                <span>{model.author || "Unknown"}</span>
              </div>
              {model.downloads !== undefined && model.downloads > 0 && (
                <div className="flex items-center gap-1 text-[#d8d4cf]/40 text-sm">
                  <FiDownloadCloud size={14} />
                  <span>{formatDownloads(model.downloads)}</span>
                </div>
              )}
              {model.likes !== undefined && model.likes > 0 && (
                <div className="flex items-center gap-1 text-[#d8d4cf]/40 text-sm">
                  <FiHeart size={14} />
                  <span>{model.likes}</span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#d8d4cf]/10 rounded-lg transition-all text-[#d8d4cf]/60 hover:text-[#d8d4cf] cursor-pointer"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Description */}
          {model.description && (
            <div className="mb-6 p-4 bg-[#121212] rounded-lg border border-[#d8d4cf]/5">
              <p className="text-[#d8d4cf]/70 text-sm leading-relaxed">
                {model.description}
              </p>
            </div>
          )}

          {/* Model Info */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-[#d8d4cf]/60 mb-3 flex items-center gap-2">
              <FiFolder size={16} />
              Available Quantizations ({validFiles.length} files)
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(groupedFiles).map(([quant, files]) => {
                const isSelected =
                  selectedFile &&
                  files.some((f) => f.filename === selectedFile.filename);
                // Show the largest file for this quantization
                const largestFile = files.reduce((a, b) =>
                  a.size > b.size ? a : b,
                );

                return (
                  <div
                    key={quant}
                    className={`p-4 bg-[#121212] rounded-lg border-2 transition-all cursor-pointer hover:bg-[#d8d4cf]/5 ${
                      isSelected
                        ? "border-[#7d7abc] bg-[#7d7abc]/10"
                        : "border-[#d8d4cf]/10 hover:border-[#d8d4cf]/20"
                    }`}
                    onClick={() => setSelectedFile(largestFile)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[#d8d4cf] font-medium text-sm">
                            {quant}
                          </span>
                          {isSelected && (
                            <span className="text-[#7d7abc] text-xs">
                              ▼ Selected
                            </span>
                          )}
                        </div>
                        <p className="text-[#d8d4cf]/40 text-xs mt-1 line-clamp-1">
                          {getQuantizationDescription(quant)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <div className="text-[#d8d4cf]/60 text-sm font-mono">
                          {formatFileSize(largestFile.size)}
                        </div>
                        {files.length > 1 && (
                          <div className="text-[#d8d4cf]/30 text-xs">
                            +{files.length - 1} more
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Show message if no valid files */}
            {validFiles.length === 0 && (
              <div className="text-center py-8 text-[#d8d4cf]/40">
                <p>No recognized quantization formats found</p>
                <p className="text-xs mt-1">
                  This model may have no GGUF files or uses an unsupported
                  naming convention
                </p>
              </div>
            )}
          </div>

          {/* Selected file details */}
          {selectedFile && (
            <div className="p-4 bg-[#0a0a0a] rounded-lg border border-[#d8d4cf]/10">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FiFile className="text-[#7d7abc]" size={16} />
                    <span className="text-[#d8d4cf] text-sm font-mono truncate">
                      {selectedFile.filename}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-[#d8d4cf]/40">
                    <span className="flex items-center gap-1">
                      <FiHardDrive size={12} />
                      {formatFileSize(selectedFile.size)}
                    </span>
                    <span className="flex items-center gap-1">
                      <FiInfo size={12} />
                      {getQuantizationDescription(selectedQuant)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleDownloadClick}
                  disabled={isDownloading(
                    model.model_id,
                    selectedFile.filename,
                  )}
                  className="ml-4 px-6 py-2.5 bg-[#7d7abc] hover:bg-[#7d7abc]/80 disabled:opacity-50 text-[#d8d4cf] rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                >
                  {isDownloading(model.model_id, selectedFile.filename) ? (
                    <>
                      <FiLoader className="animate-spin" size={16} />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <FiDownload size={16} />
                      Download
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#d8d4cf]/10 flex justify-between items-center">
          <span className="text-xs text-[#d8d4cf]/30">
            {validFiles.length} GGUF file
            {validFiles.length > 1 ? "s" : ""} available
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#121212] hover:bg-[#d8d4cf]/10 rounded-lg text-[#d8d4cf]/60 hover:text-[#d8d4cf] transition-all text-sm cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
