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
  const [loadingMore, setLoadingMore] = useState(false);
  const [isSwitchingFilter, setIsSwitchingFilter] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalModels, setTotalModels] = useState(0);
  const [currentFilter, setCurrentFilter] =
    useState<ModelFilter>(initialFilter);
  const currentPageRef = useRef(1);
  const modelsPerPage = 20;
  const maxModels = 100;
  const initialLoadDone = useRef(false);
  const hasLoadedAllRef = useRef(false);
  const loadedIdsRef = useRef<Set<string>>(new Set());
  const isChangingFilterRef = useRef(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchFilterStartTimeRef = useRef<number | null>(null);
  const MIN_LOADING_TIME = 300; // Minimum 300ms to show loading state

  const loadInitialModels = useCallback(
    async (filter: ModelFilter, keepExistingModels: boolean = false) => {
      if (
        initialLoadDone.current &&
        filter === currentFilter &&
        !isChangingFilterRef.current
      )
        return;

      if (!keepExistingModels) {
        setLoading(true);
      } else {
        setIsSwitchingFilter(true);
      }
      setError(null);

      try {
        let total = 0;
        try {
          total = await invoke<number>("get_huggingface_model_count", {
            filter,
          });
        } catch (countErr) {
          total = maxModels;
        }

        const capped = Math.min(total, maxModels);
        setTotalModels(capped);

        const response = await invoke<HFModelSummary[]>(
          "fetch_huggingface_models_page",
          {
            page: 1,
            limit: modelsPerPage,
            filter,
          },
        );

        const ids = new Set<string>();
        response.forEach((m) => ids.add(m.model_id));
        loadedIdsRef.current = ids;

        setModels(response);
        currentPageRef.current = 1;
        setCurrentFilter(filter);

        const hasMoreModels =
          response.length === modelsPerPage && response.length < maxModels;
        setHasMore(hasMoreModels);

        if (!hasMoreModels) {
          hasLoadedAllRef.current = true;
        }

        initialLoadDone.current = true;
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
        // Don't set isSwitchingFilter to false here - let changeFilter handle it
      }
    },
    [modelsPerPage, maxModels, currentFilter],
  );

  const loadMoreModels = useCallback(async () => {
    if (
      loadingMore ||
      !hasMore ||
      loading ||
      hasLoadedAllRef.current ||
      isSwitchingFilter
    ) {
      return;
    }

    setLoadingMore(true);
    try {
      const nextPage = currentPageRef.current + 1;

      const response = await invoke<HFModelSummary[]>(
        "fetch_huggingface_models_page",
        {
          page: nextPage,
          limit: modelsPerPage,
          filter: currentFilter,
        },
      );

      if (response.length === 0) {
        setHasMore(false);
        hasLoadedAllRef.current = true;
        return;
      }

      const existingIds = loadedIdsRef.current;
      const newModels = response.filter((m) => !existingIds.has(m.model_id));

      if (newModels.length === 0) {
        setHasMore(false);
        hasLoadedAllRef.current = true;
        return;
      }

      newModels.forEach((m) => existingIds.add(m.model_id));

      setModels((prev) => [...prev, ...newModels]);
      currentPageRef.current = nextPage;

      if (
        response.length < modelsPerPage ||
        models.length + newModels.length >= maxModels
      ) {
        setHasMore(false);
        hasLoadedAllRef.current = true;
      } else {
        setHasMore(true);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoadingMore(false);
    }
  }, [
    loadingMore,
    hasMore,
    loading,
    modelsPerPage,
    maxModels,
    currentFilter,
    models.length,
    isSwitchingFilter,
  ]);

  const changeFilter = useCallback(
    async (newFilter: ModelFilter) => {
      if (newFilter === currentFilter) return;

      // Clear any existing timeout
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      setModels([]);
      setHasMore(true);
      setTotalModels(0);
      currentPageRef.current = 0;
      hasLoadedAllRef.current = false;
      loadedIdsRef.current = new Set();

      isChangingFilterRef.current = true;
      initialLoadDone.current = false;

      // Start timing for minimum loading display
      switchFilterStartTimeRef.current = Date.now();

      // Debounce the loading state - only show if operation takes > 150ms
      const showLoading = setTimeout(() => {
        setIsSwitchingFilter(true);
      }, 150);
      loadingTimeoutRef.current = showLoading;

      await loadInitialModels(newFilter, true);

      // Clear the debounce timeout since we're done
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

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

      setIsSwitchingFilter(false);
      isChangingFilterRef.current = false;
    },
    [currentFilter, loadInitialModels],
  );

  const refreshModels = useCallback(async () => {
    initialLoadDone.current = false;
    hasLoadedAllRef.current = false;
    loadedIdsRef.current = new Set();
    setModels([]);
    setHasMore(true);
    setTotalModels(0);
    currentPageRef.current = 0;
    await loadInitialModels(currentFilter, false);
  }, [loadInitialModels, currentFilter]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadInitialModels(initialFilter, false);
  }, []);

  return {
    models,
    loading,
    loadingMore,
    isSwitchingFilter,
    error,
    hasMore,
    totalModels,
    maxModels,
    currentFilter,
    changeFilter,
    loadMoreModels,
    refreshModels,
  };
};
