// src/components/models/ModelList.tsx
import { useState } from "react";
import {
  FiTrash2,
  FiDownload,
  FiLoader,
  FiCheck,
  FiHardDrive,
} from "react-icons/fi";
import { OllamaModel } from "./hooks/useOllamaModels";

interface ModelListProps {
  models: OllamaModel[];
  loading: boolean;
  pullingModels: Set<string>;
  onPullModel: (modelName: string) => void;
  onDeleteModel: (modelName: string) => void;
}

const formatSize = (bytes: number): string => {
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const RecommendedModels = [
  { name: "llama3.2:3b", description: "Lightweight, fast, efficient" },
  { name: "llama3.2:1b", description: "Ultra-lightweight, fastest" },
  { name: "llama3.1:8b", description: "Balanced performance" },
  { name: "qwen2.5:7b", description: "Strong reasoning" },
  { name: "phi3.5:3.8b", description: "Efficient and capable" },
];

export const ModelList = ({
  models,
  loading,
  pullingModels,
  onPullModel,
  onDeleteModel,
}: ModelListProps) => {
  const [showRecommended, setShowRecommended] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <FiLoader
          className="animate-spin text-(--color-purple-accent)"
          size={32}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Model count and controls */}
      <div className="flex items-center justify-between">
        <div className="text-white/60 text-sm">
          {models.length} model{models.length !== 1 ? "s" : ""} installed
        </div>
        <button
          onClick={() => setShowRecommended(!showRecommended)}
          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-all cursor-pointer"
        >
          {showRecommended ? "Hide" : "Show"} Recommended
        </button>
      </div>

      {/* Recommended models */}
      {showRecommended && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white/80 mb-3">
            Recommended Models
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {RecommendedModels.map((model) => {
              const isInstalled = models.some((m) => m.name === model.name);
              const isPulling = pullingModels.has(model.name);
              return (
                <div
                  key={model.name}
                  className="flex items-center justify-between bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-all"
                >
                  <div className="flex-1">
                    <div className="text-white font-medium">{model.name}</div>
                    <div className="text-white/40 text-xs">
                      {model.description}
                    </div>
                  </div>
                  {isInstalled ? (
                    <span className="text-green-400 text-sm flex items-center gap-1">
                      <FiCheck size={14} /> Installed
                    </span>
                  ) : (
                    <button
                      onClick={() => onPullModel(model.name)}
                      disabled={isPulling}
                      className="px-3 py-1.5 bg-(--color-purple-accent) hover:bg-(--color-purple-accent)/80 disabled:opacity-50 text-white rounded-lg text-sm transition-all flex items-center gap-1 cursor-pointer"
                    >
                      {isPulling ? (
                        <FiLoader className="animate-spin" size={14} />
                      ) : (
                        <FiDownload size={14} />
                      )}
                      {isPulling ? "Pulling..." : "Pull"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Installed models list */}
      {models.length === 0 ? (
        <div className="text-center py-12">
          <FiHardDrive className="mx-auto text-white/20 mb-4" size={48} />
          <p className="text-white/40">No models installed</p>
          <p className="text-white/30 text-sm mt-2">
            Click "Show Recommended" to see models you can pull
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {models.map((model) => {
            const isPulling = pullingModels.has(model.name);
            return (
              <div
                key={model.digest}
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/8 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-white font-medium truncate">
                        {model.name}
                      </h4>
                      {model.details && (
                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/40">
                          {model.details.parameter_size}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/40 mt-1">
                      <span>Modified: {formatDate(model.modified_at)}</span>
                      <span>Size: {formatSize(model.size)}</span>
                      {model.details?.family && (
                        <span>Family: {model.details.family}</span>
                      )}
                      {model.details?.quantization_level && (
                        <span>
                          Quantization: {model.details.quantization_level}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteModel(model.name)}
                    disabled={isPulling}
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 text-red-400 rounded-lg text-sm transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <FiTrash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
