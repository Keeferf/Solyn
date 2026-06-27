import { useState, useEffect } from "react";
import {
  FiSearch,
  FiDownload,
  FiCheck,
  FiLoader,
  FiTrash2,
} from "react-icons/fi";

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface AvailableModel {
  name: string;
  description?: string;
  size?: string;
  pullCount?: number;
}

export const ModelInterface = () => {
  const [installedModels, setInstalledModels] = useState<OllamaModel[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [availableModels] = useState<AvailableModel[]>([
    { name: "llama3.2", description: "Meta's Llama 3.2 3B model" },
    { name: "llama3.2:1b", description: "Meta's Llama 3.2 1B model" },
    { name: "mistral", description: "Mistral 7B model" },
    { name: "phi3", description: "Microsoft Phi-3 mini 3.8B" },
    { name: "gemma2", description: "Google's Gemma 2 9B model" },
    { name: "qwen2.5", description: "Qwen 2.5 7B model" },
    { name: "deepseek-coder", description: "DeepSeek Coder 6.7B" },
    { name: "nomic-embed-text", description: "Nomic's embedding model" },
    { name: "mxbai-embed-large", description: "MixedBread embedding model" },
    { name: "codellama", description: "Meta's CodeLlama 7B" },
  ]);

  // Fetch installed models on mount
  useEffect(() => {
    fetchInstalledModels();
  }, []);

  const fetchInstalledModels = async () => {
    try {
      const response = await fetch("http://localhost:11434/api/tags");
      if (response.ok) {
        const data = await response.json();
        setInstalledModels(data.models || []);
      }
    } catch (error) {
      console.error("Failed to fetch installed models:", error);
    }
  };

  const handleDownloadModel = async (modelName: string) => {
    setDownloading(modelName);
    try {
      const response = await fetch("http://localhost:11434/api/pull", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: modelName }),
      });

      if (response.ok) {
        // Read the streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.trim());

          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              if (data.status === "success") {
                // Refresh the model list
                await fetchInstalledModels();
                setDownloading(null);
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      console.error(`Failed to download model ${modelName}:`, error);
      setDownloading(null);
    }
  };

  const handleDeleteModel = async (modelName: string) => {
    if (!confirm(`Are you sure you want to delete ${modelName}?`)) return;

    try {
      const response = await fetch("http://localhost:11434/api/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: modelName }),
      });

      if (response.ok) {
        await fetchInstalledModels();
      }
    } catch (error) {
      console.error(`Failed to delete model ${modelName}:`, error);
    }
  };

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb > 1
      ? `${gb.toFixed(2)} GB`
      : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const filteredModels = availableModels.filter(
    (model) =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const isInstalled = (modelName: string) => {
    return installedModels.some((m) => m.name === modelName);
  };

  return (
    <div className="max-w-5xl mx-auto w-full p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Models</h1>
        <p className="text-white/60">
          Browse and download Ollama models for your AI assistant.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative mb-8">
        <FiSearch
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
          size={20}
        />
        <input
          type="text"
          placeholder="Search models..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-12 py-3 text-white placeholder-white/40 focus:outline-none focus:border-(--color-purple-accent) transition-colors"
        />
      </div>

      {/* Installed models section */}
      {installedModels.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white/80 mb-3">
            Installed Models
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {installedModels.map((model) => (
              <div
                key={model.name}
                className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium text-white">{model.name}</div>
                  <div className="text-xs text-white/40 mt-1">
                    {formatSize(model.size)} • {model.details.parameter_size}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteModel(model.name)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors"
                  title="Delete model"
                >
                  <FiTrash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available models grid */}
      <div>
        <h2 className="text-lg font-semibold text-white/80 mb-3">
          Available Models
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredModels.map((model) => {
            const installed = isInstalled(model.name);
            const isDownloading = downloading === model.name;

            return (
              <div
                key={model.name}
                className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-white">{model.name}</div>
                    {model.description && (
                      <div className="text-sm text-white/40 mt-0.5">
                        {model.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (installed) {
                        // If installed, we could show details or open a chat with this model
                        return;
                      }
                      handleDownloadModel(model.name);
                    }}
                    disabled={isDownloading}
                    className={`ml-3 px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                      installed
                        ? "bg-green-500/20 text-green-400 cursor-default"
                        : isDownloading
                          ? "bg-(--color-purple-accent)/20 text-(--color-purple-accent) cursor-wait"
                          : "bg-(--color-purple-accent) hover:bg-(--color-purple-accent)/80 text-white"
                    }`}
                  >
                    {installed ? (
                      <>
                        <FiCheck size={16} />
                        Installed
                      </>
                    ) : isDownloading ? (
                      <>
                        <FiLoader size={16} className="animate-spin" />
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
          })}
        </div>
      </div>

      {/* Ollama not running message */}
      {installedModels.length === 0 && !loading && (
        <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <p className="text-yellow-400 text-sm">
            ⚠️ No models found. Make sure Ollama is running locally
            (http://localhost:11434). You can download models from the list
            above.
          </p>
        </div>
      )}
    </div>
  );
};
