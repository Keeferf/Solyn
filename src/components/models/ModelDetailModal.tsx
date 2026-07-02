// src/components/models/ModelDetailModal.tsx
import { useState, useEffect } from "react";
import { FiFolder, FiX } from "react-icons/fi";
import { HFModelDetails, GGUFFile } from "./hooks/useHuggingFaceModels";
import { useModelDetails } from "./hooks/useModelDetails";
import {
  getValidFiles,
  groupFilesByQuantization,
  getDefaultSelectedFile,
} from "./utils/modalUtils";
import {
  LoadingState,
  ErrorState,
  ModalHeader,
  ModelInfo,
  QuantizationCard,
  SelectedFileDetails,
} from "./ModalDetails";

interface ModelDetailModalProps {
  modelId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (modelId: string, filename: string) => Promise<void>;
  downloadingModels: Set<string>;
  isDownloading?: (modelId: string, filename: string) => boolean;
}

export const ModelDetailModal = ({
  modelId,
  isOpen,
  onClose,
  onDownload,
  downloadingModels,
  isDownloading = (modelId: string, filename: string) => {
    return downloadingModels.has(`${modelId}::${filename}`);
  },
}: ModelDetailModalProps) => {
  const { details, isLoading, error } = useModelDetails(modelId, isOpen);
  const [selectedFile, setSelectedFile] = useState<GGUFFile | null>(null);

  // Reset selection when details change
  useEffect(() => {
    if (details && details.gguf_files.length > 0) {
      const defaultFile = getDefaultSelectedFile(details.gguf_files);
      setSelectedFile(defaultFile);
    } else {
      setSelectedFile(null);
    }
  }, [details]);

  // Loading state
  if (isLoading) {
    return <LoadingState onClose={onClose} />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error} onClose={onClose} />;
  }

  // No details yet
  if (!details || !modelId) return null;

  const validFiles = getValidFiles(details.gguf_files);
  const groupedFiles = groupFilesByQuantization(validFiles);

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
          <ModelInfo details={details} />
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
          {details.description && (
            <div className="mb-6 p-4 bg-[#121212] rounded-lg border border-[#d8d4cf]/5">
              <p className="text-[#d8d4cf]/70 text-sm leading-relaxed">
                {details.description}
              </p>
            </div>
          )}

          {/* Quantizations */}
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
                return (
                  <QuantizationCard
                    key={quant}
                    quant={quant}
                    files={files}
                    isSelected={!!isSelected}
                    onSelect={setSelectedFile}
                  />
                );
              })}
            </div>

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
            <SelectedFileDetails
              file={selectedFile}
              modelId={modelId}
              isDownloading={isDownloading(modelId, selectedFile.filename)}
              onDownload={onDownload}
            />
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
