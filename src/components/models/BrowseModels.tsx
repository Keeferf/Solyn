import { useEffect, useState } from "react";
import {
  FiLoader,
  FiServer,
  FiUser,
  FiRefreshCw,
  FiHeart,
  FiDownloadCloud,
  FiClock,
  FiThumbsUp,
  FiChevronRight,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { HFModelSummary } from "./hooks/useHuggingFaceModels";
import { useIntersectionObserver } from "./hooks/useIntersectionObserver";

interface BrowseModelsProps {
  models: HFModelSummary[];
  loading: boolean;
  loadingMore: boolean;
  isSwitchingFilter: boolean;
  hasMore: boolean;
  totalModels: number;
  maxModels: number;
  currentFilter: string;
  downloadingModels: Set<string>;
  onModelClick: (model: HFModelSummary) => void;
  onLoadMore: () => void;
  onRefresh?: () => void;
  onFilterChange: (filter: string) => void;
  error?: string | null;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
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

const formatLikes = (likes?: number): string => {
  if (!likes) return "0";
  if (likes >= 1_000_000) {
    return `${(likes / 1_000_000).toFixed(1)}M`;
  }
  if (likes >= 1_000) {
    const roundedDown = Math.floor(likes / 100) * 100;
    const thousands = roundedDown / 1000;
    if (Number.isInteger(thousands)) {
      return `${thousands}k`;
    }
    return `${thousands.toFixed(1)}k`;
  }
  return likes.toString();
};

const filterOptions = [
  { value: "most_downloads", label: "Most Downloads", icon: FiDownloadCloud },
  { value: "most_liked", label: "Most Liked", icon: FiThumbsUp },
  { value: "recent", label: "Recent", icon: FiClock },
];

export const BrowseModels = ({
  models,
  loading,
  loadingMore,
  isSwitchingFilter,
  hasMore,
  totalModels,
  maxModels,
  currentFilter,
  downloadingModels,
  onModelClick,
  onLoadMore,
  onRefresh,
  onFilterChange,
  error,
  searchQuery = "",
  onSearchChange,
}: BrowseModelsProps) => {
  const { targetRef, isIntersecting } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: "100px",
  });

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [contentVisible, setContentVisible] = useState(true);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Handle content visibility for smooth transitions
  useEffect(() => {
    if (isSwitchingFilter) {
      setContentVisible(false);
      // Show content after a brief delay with transition
      setTimeout(() => {
        setContentVisible(true);
      }, 150);
    }
  }, [isSwitchingFilter]);

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    if (onSearchChange) {
      onSearchChange(value);
    }
  };

  const handleClearSearch = () => {
    setLocalSearch("");
    if (onSearchChange) {
      onSearchChange("");
    }
  };

  useEffect(() => {
    if (
      isIntersecting &&
      hasMore &&
      !loadingMore &&
      !loading &&
      !isSwitchingFilter
    ) {
      onLoadMore();
    }
  }, [
    isIntersecting,
    hasMore,
    loadingMore,
    loading,
    isSwitchingFilter,
    onLoadMore,
  ]);

  if (loading && models.length === 0) {
    return (
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between text-sm text-white/40 px-2 py-2 bg-black/50 rounded-lg border border-white/5">
          <div className="flex items-center gap-3">
            <FiServer className="text-purple-accent" size={16} />
            <span>Loading GGUF models from Hugging Face...</span>
          </div>
        </div>
        <div className="flex items-center justify-center py-16">
          <FiLoader className="animate-spin text-purple-accent" size={40} />
        </div>
      </div>
    );
  }

  if (error && models.length === 0) {
    return (
      <div className="w-full space-y-6">
        <div className="flex items-center justify-between text-sm text-white/40 px-2 py-2 bg-black/50 rounded-lg border border-white/5">
          <div className="flex items-center gap-3">
            <FiServer className="text-purple-accent" size={16} />
            <span>Error loading GGUF models</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-white text-lg mb-2">Failed to load models</p>
          <p className="text-white/40 text-sm mb-4">{error}</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-black hover:bg-white/10 rounded-lg text-white transition-all flex items-center gap-2 cursor-pointer"
            >
              <FiRefreshCw size={16} />
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Search Bar and Filters - Inline */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <div className="relative">
            <FiSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              size={16}
            />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search models by name, author, or description..."
              className="w-full bg-black/50 border border-white/10 rounded-lg px-10 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent transition-all"
              disabled={loading || isSwitchingFilter}
            />
            {localSearch && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <FiX size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {filterOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => onFilterChange(value)}
              disabled={isSwitchingFilter}
              className={`px-3 py-2.5 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                isSwitchingFilter ? "opacity-50 cursor-not-allowed" : ""
              } ${
                currentFilter === value
                  ? "bg-purple-accent text-white border border-purple-accent"
                  : "bg-black/50 text-white/60 hover:bg-white/10 hover:text-white border border-white/10"
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content with smooth transitions */}
      <div
        className={`relative transition-all duration-300 ${
          isSwitchingFilter
            ? "opacity-50 transform scale-[0.99]"
            : "opacity-100 transform scale-100"
        }`}
      >
        {isSwitchingFilter && (
          <div className="flex flex-col items-center justify-center py-12 min-h-50">
            <div className="flex items-center gap-3">
              <FiLoader className="animate-spin text-purple-accent" size={32} />
              <span className="text-white/60 text-sm">Loading models...</span>
            </div>
          </div>
        )}

        {!isSwitchingFilter && (
          <div
            className={`transition-all duration-300 ${
              contentVisible
                ? "opacity-100 transform translate-y-0"
                : "opacity-0 transform -translate-y-2"
            }`}
          >
            {models.length === 0 ? (
              <div className="text-center py-16">
                {localSearch ? (
                  <>
                    <p className="text-white/40 text-lg">No models found</p>
                    <p className="text-white/30 text-sm mt-2">
                      No models match "{localSearch}"
                    </p>
                    <button
                      onClick={handleClearSearch}
                      className="mt-4 px-4 py-2 bg-black hover:bg-white/10 rounded-lg text-white transition-all flex items-center gap-2 mx-auto cursor-pointer"
                    >
                      <FiX size={16} />
                      Clear search
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-white/40 text-lg">No models available</p>
                    <p className="text-white/30 text-sm mt-2">
                      Try refreshing or check your connection
                    </p>
                    {onRefresh && (
                      <button
                        onClick={onRefresh}
                        className="mt-4 px-4 py-2 bg-black hover:bg-white/10 rounded-lg text-white transition-all flex items-center gap-2 mx-auto cursor-pointer"
                      >
                        <FiRefreshCw size={16} />
                        Refresh
                      </button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                  {models.map((model, index) => {
                    const isDownloading = downloadingModels.has(model.model_id);

                    return (
                      <div
                        key={`${model.id}-${index}`}
                        onClick={() => onModelClick(model)}
                        className={`group bg-black border border-white/10 rounded-xl p-5 transition-all duration-200 flex flex-col h-full hover:bg-white/5 hover:border-white/20 cursor-pointer hover:scale-[1.02] ${
                          isDownloading ? "opacity-50 pointer-events-none" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white font-semibold truncate text-base">
                              {model.name || model.model_id}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <FiUser className="text-white/30" size={12} />
                              <span className="text-white/40 text-xs">
                                {model.author || "Unknown"}
                              </span>
                            </div>
                          </div>
                          {isDownloading && (
                            <div className="text-purple-accent">
                              <FiLoader className="animate-spin" size={16} />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          {model.downloads !== undefined &&
                            model.downloads > 0 && (
                              <span className="text-xs bg-green-500/15 text-green-400 px-2 py-1 rounded-full border border-green-500/20 flex items-center gap-1">
                                <FiDownloadCloud size={12} />
                                {formatDownloads(model.downloads)}
                              </span>
                            )}
                          {model.likes !== undefined && model.likes > 0 && (
                            <span className="text-xs bg-red-500/15 text-red-400 px-2 py-1 rounded-full border border-red-500/20 flex items-center gap-1">
                              <FiHeart size={12} />
                              {formatLikes(model.likes)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-end mt-auto pt-3 border-t border-white/5">
                          <span className="text-xs text-white/30 flex items-center gap-1 group-hover:text-white/60 transition-colors">
                            View all quantizations
                            <FiChevronRight
                              size={14}
                              className="text-white/20 group-hover:text-purple-accent/60 transition-all group-hover:translate-x-1"
                            />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hasMore && (
                  <div ref={targetRef} className="py-8 flex justify-center">
                    {loadingMore ? (
                      <div className="flex items-center gap-3 text-white/60">
                        <FiLoader className="animate-spin" size={20} />
                        <span className="text-sm">Loading more models...</span>
                      </div>
                    ) : (
                      <div className="text-white/30 text-sm">
                        Scroll for more
                      </div>
                    )}
                  </div>
                )}

                {!hasMore && models.length > 0 && (
                  <div className="py-8 text-center text-white/30 text-sm border-t border-white/5">
                    All {models.length} top models loaded
                    {totalModels > 0 && totalModels < maxModels && (
                      <span className="block text-xs text-white/20 mt-2">
                        ({totalModels} available from Hugging Face)
                      </span>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
