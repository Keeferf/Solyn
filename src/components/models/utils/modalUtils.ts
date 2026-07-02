// src/components/models/utils/modalUtils.ts
import { GGUFFile } from "../hooks/useHuggingFaceModels";

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

export const formatDownloads = (downloads?: number): string => {
  if (!downloads) return "0";
  if (downloads >= 1_000_000) {
    return `${(downloads / 1_000_000).toFixed(1)}M`;
  }
  if (downloads >= 1_000) {
    return `${(downloads / 1_000).toFixed(1)}K`;
  }
  return downloads.toString();
};

export const getQuantizationLabel = (filename: string): string | null => {
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

export const getQuantizationDescription = (quant: string | null): string => {
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

export const formatParameterCount = (
  paramCount: string | null | undefined,
): string => {
  if (!paramCount) return "Unknown";
  return paramCount;
};

export const groupFilesByQuantization = (files: GGUFFile[]) => {
  return files.reduce(
    (acc, file) => {
      const quant =
        file.quantization || getQuantizationLabel(file.filename) || "Unknown";
      if (!acc[quant]) {
        acc[quant] = [];
      }
      acc[quant].push(file);
      return acc;
    },
    {} as Record<string, GGUFFile[]>,
  );
};

export const getValidFiles = (files: GGUFFile[]) => {
  return files.filter(
    (file) => file.quantization || getQuantizationLabel(file.filename) !== null,
  );
};

export const getDefaultSelectedFile = (files: GGUFFile[]): GGUFFile | null => {
  const validFiles = getValidFiles(files);
  const sortedFiles = [...validFiles].sort((a, b) => b.size - a.size);
  return sortedFiles[0] || null;
};
