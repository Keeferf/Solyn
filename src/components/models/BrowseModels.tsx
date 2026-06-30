// src/components/models/BrowseModels.tsx
import { useState } from "react";
import {
  FiSearch,
  FiDownload,
  FiLoader,
  FiCheck,
  FiClock,
  FiCode,
  FiFile,
} from "react-icons/fi";
import { HFModel } from "./hooks/useHuggingFaceModels";

interface BrowseModelsProps {
  models: HFModel[];
  loading: boolean;
  downloadingModels: Set<string>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearch: (query: string) => Promise<void>;
  onDownload: (modelId: string) => Promise<void>;
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

export const BrowseModels = ({
  models,
  loading,
  downloadingModels,
  searchQuery,
  onSearchChange,
  onSearch,
  onDownload,
}: BrowseModelsProps) => {
  const [searchTimeout, setSearchTimeout] = useState<number | null>(null);

  const handleSearchChange = (value: string) => {
    onSearchChange(value);

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      onSearch(value);
    }, 500);
    setSearchTimeout(timeout);
  };

  if (loading && models.length === 0) {
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
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search GGUF models on Hugging Face (e.g., llama, mistral, phi)..."
          className="w-full bg-white/5 border border-white/10 rounded-xl px-10 py-3 text-white placeholder-white/40 focus:outline-none focus:border-(--color-purple-accent)/50 transition-all"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <span className="text-xs text-white/30 bg-white/5 px-2 py-1 rounded border border-white/10">
            GGUF
          </span>
          <kbd className="text-xs text-white/30 bg-white/5 px-2 py-1 rounded border border-white/10">
            Enter
          </kbd>
        </div>
      </div>

      {/* Info banner */}
      <div className="text-xs text-white/30 px-2">
        <FiFile className="inline mr-1" size={12} />
        Showing models with GGUF files (compatible with Ollama)
      </div>

      {/* Model grid */}
      {models.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/40">
            Search for GGUF models on Hugging Face
          </p>
          <p className="text-white/30 text-sm mt-2">
            Try searching for "llama", "mistral", "phi", or "qwen"
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {models.map((model) => {
            const isDownloading = downloadingModels.has(model.id);
            const isInstalled = model.isInstalled || false;

            return (
              <div
                key={model.id}
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/8 transition-all group"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate">
                        {model.id}
                      </h4>
                      <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/40">
                          {model.pipeline_tag || "Unknown"}
                        </span>
                        {model.likes !== undefined && (
                          <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/40">
                            ❤️ {model.likes}
                          </span>
                        )}
                        {model.downloads !== undefined && (
                          <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/40">
                            ⬇️ {formatDownloads(model.downloads)}
                          </span>
                        )}
                        {model.gguf_file && (
                          <span className="text-xs bg-green-500/20 px-2 py-0.5 rounded-full text-green-400">
                            GGUF
                          </span>
                        )}
                      </div>
                    </div>
                    {isInstalled ? (
                      <span className="text-green-400 text-sm flex items-center gap-1 shrink-0">
                        <FiCheck size={14} /> Installed
                      </span>
                    ) : (
                      <button
                        onClick={() => onDownload(model.id)}
                        disabled={isDownloading}
                        className="px-3 py-1.5 bg-(--color-purple-accent) hover:bg-(--color-purple-accent)/80 disabled:opacity-50 text-white rounded-lg text-sm transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        {isDownloading ? (
                          <FiLoader className="animate-spin" size={14} />
                        ) : (
                          <FiDownload size={14} />
                        )}
                        {isDownloading ? "Downloading..." : "Download"}
                      </button>
                    )}
                  </div>
                  {model.description && (
                    <p className="text-white/40 text-sm line-clamp-2">
                      {model.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-white/30 mt-1">
                    {model.size && <span>Size: {formatSize(model.size)}</span>}
                    {model.gguf_file && (
                      <span className="flex items-center gap-1">
                        <FiFile size={12} />
                        {model.gguf_file}
                      </span>
                    )}
                    {model.lastModified && (
                      <span className="flex items-center gap-1">
                        <FiClock size={12} />
                        Updated:{" "}
                        {new Date(model.lastModified).toLocaleDateString()}
                      </span>
                    )}
                    {model.license && (
                      <span className="flex items-center gap-1">
                        <FiCode size={12} />
                        {model.license}
                      </span>
                    )}
                  </div>
                  {model.tags && model.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
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
                          +{model.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
