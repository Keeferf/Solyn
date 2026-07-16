import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface GGUFFile {
  filename: string;
  size: number;
  quantization: string;
  url: string;
  parameter_count?: string | null;
}

export interface HFModelSummary {
  id: string;
  model_id: string;
  author: string;
  name: string;
  downloads?: number;
  likes?: number;
  created_at?: string;
  last_modified?: string;
}

export interface HFModelDetails extends HFModelSummary {
  description?: string;
  gguf_files: GGUFFile[];
}

export type HFModel = HFModelSummary | HFModelDetails;

export type ModelFilter = "most_downloads" | "most_liked" | "recent";

export function hasDetails(model: HFModel): model is HFModelDetails {
  return (
    "gguf_files" in model && Array.isArray((model as HFModelDetails).gguf_files)
  );
}

export const useHuggingFaceModels = (
  initialFilter: ModelFilter = "most_downloads",
) => {
  const [models, setModels] = useState<HFModelSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSwitchingFilter, setIsSwitchingFilter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalModels, setTotalModels] = useState(0);
  const [currentFilter, setCurrentFilter] =
    useState<ModelFilter>(initialFilter);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);

  const maxModels = 100;
  const initialLoadDone = useRef(false);
  const loadedIdsRef = useRef<Set<string>>(new Set());
  const isChangingFilterRef = useRef(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchFilterStartTimeRef = useRef<number | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MIN_LOADING_TIME = 300;

  // Load all models at once (up to maxModels)
  const loadInitialModels = useCallback(
    async (
      filter: ModelFilter,
      query: string = "",
      keepExistingModels: boolean = false,
    ) => {
      // Skip if already loaded and no changes
      if (
        initialLoadDone.current &&
        filter === currentFilter &&
        query === searchQuery &&
        !isChangingFilterRef.current
      ) {
        return;
      }

      if (!keepExistingModels) {
        setLoading(true);
      } else {
        setIsSwitchingFilter(true);
      }
      setError(null);

      try {
        let total = 0;

        // Get total count (with or without search)
        try {
          if (query.trim()) {
            total = await invoke<number>("get_huggingface_search_count", {
              query: query.trim(),
              filter: filter,
            });
          } else {
            total = await invoke<number>("get_huggingface_model_count", {
              filter: filter,
            });
          }
        } catch (countErr) {
          console.warn("Failed to get total count, using fallback:", countErr);
          total = maxModels;
        }

        const capped = Math.min(total, maxModels);
        setTotalModels(capped);

        let response: HFModelSummary[] = [];

        // Fetch ALL models at once (up to maxModels)
        if (query.trim()) {
          const searchResult = await invoke<{
            models: HFModelSummary[];
            total: number;
            has_more: boolean;
          }>("search_huggingface_models", {
            query: query.trim(),
            page: 1,
            limit: maxModels,
            filter: filter,
          });

          response = searchResult.models || [];
        } else {
          response = await invoke<HFModelSummary[]>(
            "fetch_huggingface_models_page",
            {
              page: 1,
              limit: maxModels,
              filter: filter,
            },
          );
        }

        // Track loaded model IDs
        const ids = new Set<string>();
        response.forEach((m) => ids.add(m.model_id));
        loadedIdsRef.current = ids;

        setModels(response);
        setCurrentFilter(filter);
        setSearchQuery(query);

        initialLoadDone.current = true;
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
        setIsSwitchingFilter(false);
      }
    },
    [maxModels, currentFilter, searchQuery],
  );

  // Change filter - loads all models at once
  const changeFilter = useCallback(
    async (newFilter: ModelFilter) => {
      if (newFilter === currentFilter) return;

      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      // Reset state
      setModels([]);
      setTotalModels(0);
      loadedIdsRef.current = new Set();

      isChangingFilterRef.current = true;
      initialLoadDone.current = false;

      // Start timing for minimum loading display
      switchFilterStartTimeRef.current = Date.now();

      // Show loading state immediately for filter switch
      setIsSwitchingFilter(true);

      try {
        // Load all models with current search query
        await loadInitialModels(newFilter, searchQuery, true);

        // Ensure minimum loading time for visual consistency
        if (switchFilterStartTimeRef.current) {
          const elapsed = Date.now() - switchFilterStartTimeRef.current;
          if (elapsed < MIN_LOADING_TIME) {
            await new Promise((resolve) =>
              setTimeout(resolve, MIN_LOADING_TIME - elapsed),
            );
          }
          switchFilterStartTimeRef.current = null;
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setIsSwitchingFilter(false);
        isChangingFilterRef.current = false;
        setLoading(false);
      }
    },
    [currentFilter, loadInitialModels, searchQuery],
  );

  // Search models with debounce - loads all models at once
  const searchModels = useCallback(
    async (query: string) => {
      // Clear existing search timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }

      // If query hasn't changed, do nothing
      if (query === searchQuery) return;

      // Debounce search
      searchTimeoutRef.current = setTimeout(async () => {
        setIsSearching(true);

        try {
          // Only reset if we have a non-empty query or the query changed
          if (query.trim() !== "" || query !== searchQuery) {
            // Reset state for new search
            setModels([]);
            setTotalModels(0);
            loadedIdsRef.current = new Set();
            initialLoadDone.current = false;
            setSearchQuery(query);

            // Load all models with search query
            await loadInitialModels(currentFilter, query, false);
          }
        } catch (err) {
          setError(String(err));
        } finally {
          setLoading(false);
          setIsSearching(false);
        }
      }, 300);
    },
    [currentFilter, loadInitialModels, searchQuery],
  );

  // Refresh models (clear cache and reload all)
  const refreshModels = useCallback(async () => {
    initialLoadDone.current = false;
    loadedIdsRef.current = new Set();
    setModels([]);
    setTotalModels(0);

    // Clear cache
    try {
      await invoke("clear_models_cache", { filter: currentFilter });
    } catch (err) {
      console.warn("Failed to clear cache:", err);
    }

    await loadInitialModels(currentFilter, searchQuery, false);
  }, [loadInitialModels, currentFilter, searchQuery]);

  // Clear search
  const clearSearch = useCallback(async () => {
    if (!searchQuery) return;

    // Clear search timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    setIsSearching(true);
    setSearchQuery("");

    // Reset and reload without search
    setModels([]);
    setTotalModels(0);
    loadedIdsRef.current = new Set();
    initialLoadDone.current = false;

    await loadInitialModels(currentFilter, "", false);
    setIsSearching(false);
  }, [searchQuery, currentFilter, loadInitialModels]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Initial load
  useEffect(() => {
    loadInitialModels(initialFilter, "", false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    // State
    models,
    loading,
    isSwitchingFilter,
    error,
    totalModels,
    maxModels,
    currentFilter,
    searchQuery,
    isSearching,

    // Actions
    changeFilter,
    refreshModels,
    searchModels,
    clearSearch,
  };
};
