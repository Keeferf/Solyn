// src/components/models/ModelList.tsx
import { FiTrash2, FiLoader, FiHardDrive } from "react-icons/fi";
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

export const ModelList = ({
  models,
  loading,
  pullingModels,
  onPullModel,
  onDeleteModel,
}: ModelListProps) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <FiLoader
          className="animate-spin text-(--color-purple-accent)"
          size={24}
        />
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className="text-center py-8">
        <FiHardDrive className="mx-auto text-white/20 mb-3" size={32} />
        <p className="text-white/40">No models installed</p>
        <p className="text-white/30 text-sm mt-1">
          Browse models below to download new ones
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {models.map((model) => {
        const isPulling = pullingModels.has(model.name);
        return (
          <div
            key={model.digest}
            className="bg-white/5 border border-white/10 rounded-xl p-3 hover:bg-white/8 transition-all"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
  );
};
