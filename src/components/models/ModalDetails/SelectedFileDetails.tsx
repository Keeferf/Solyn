// src/components/models/ModalDetails/SelectedFileDetails.tsx
import {
  FiFile,
  FiHardDrive,
  FiInfo,
  FiCpu,
  FiDownload,
  FiLoader,
} from "react-icons/fi";
import { GGUFFile } from "../hooks/useHuggingFaceModels";
import {
  formatFileSize,
  getQuantizationDescription,
  formatParameterCount,
  getQuantizationLabel,
} from "../utils/modalUtils";

interface SelectedFileDetailsProps {
  file: GGUFFile;
  modelId: string;
  isDownloading: boolean;
  onDownload: (modelId: string, filename: string) => void;
}

export const SelectedFileDetails = ({
  file,
  modelId,
  isDownloading,
  onDownload,
}: SelectedFileDetailsProps) => {
  const quant = file.quantization || getQuantizationLabel(file.filename);

  return (
    <div className="p-4 bg-[#0a0a0a] rounded-lg border border-[#d8d4cf]/10">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FiFile className="text-[#7d7abc]" size={16} />
            <span className="text-[#d8d4cf] text-sm font-mono truncate">
              {file.filename}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-[#d8d4cf]/40 flex-wrap">
            <span className="flex items-center gap-1">
              <FiHardDrive size={12} />
              {formatFileSize(file.size)}
            </span>
            <span className="flex items-center gap-1">
              <FiInfo size={12} />
              {getQuantizationDescription(quant)}
            </span>
            {file.parameter_count && (
              <span className="flex items-center gap-1 text-emerald-400">
                <FiCpu size={12} />
                {formatParameterCount(file.parameter_count)}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => onDownload(modelId, file.filename)}
          disabled={isDownloading}
          className="ml-4 px-6 py-2.5 bg-[#7d7abc] hover:bg-[#7d7abc]/80 disabled:opacity-50 text-[#d8d4cf] rounded-lg text-sm font-medium transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0"
        >
          {isDownloading ? (
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
  );
};
