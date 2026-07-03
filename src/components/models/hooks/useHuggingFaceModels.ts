// src/components/models/hooks/useHuggingFaceModels.ts
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

export type ModelFilter =
  | "most_downloads"
  | "most_liked"
  | "trending"
  | "recent";

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
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalModels, setTotalModels] = useState(0);
  const [currentFilter, setCurrentFilter] =
    useState<ModelFilter>(initialFilter);
  const currentPageRef = useRef(1);
  const modelsPerPage = 20;
  const maxModels = 100; // Reduced to 100 total
  const initialLoadDone = useRef(false);
  const hasLoadedAllRef = useRef(false);
  const loadedIdsRef = useRef<Set<string>>(new Set());

  const loadInitialModels = useCallback(
    async (filter: ModelFilter) => {
      if (initialLoadDone.current && filter === currentFilter) return;

      setLoading(true);
      setError(null);
      try {
        console.log(
          `🔄 [FRONTEND] Loading initial GGUF models page 1 with filter: ${filter}...`,
        );

        let total = 0;
        try {
          total = await invoke<number>("get_huggingface_model_count", {
            filter,
          });
          console.log(
            `📊 [FRONTEND] Total GGUF models available for filter ${filter}: ${total}`,
          );
        } catch (countErr) {
          console.warn("[FRONTEND] Failed to get total count", countErr);
          total = maxModels;
        }

        // Cap at maxModels
        const capped = Math.min(total, maxModels);
        setTotalModels(capped);
        console.log(`📊 [FRONTEND] Capped total to ${capped} models`);

        const response = await invoke<HFModelSummary[]>(
          "fetch_huggingface_models_page",
          {
            page: 1,
            limit: modelsPerPage,
            filter,
          },
        );

        console.log(
          `📦 [FRONTEND] Received ${response.length} models from backend for filter ${filter}`,
        );
        if (response.length > 0) {
          console.log(`📦 [FRONTEND] First model: ${response[0]?.model_id}`);
          console.log(
            `📦 [FRONTEND] Last model: ${response[response.length - 1]?.model_id}`,
          );
        }

        // Track loaded IDs
        const ids = new Set<string>();
        response.forEach((m) => ids.add(m.model_id));
        loadedIdsRef.current = ids;

        setModels(response);
        currentPageRef.current = 1;
        setCurrentFilter(filter);

        const hasMoreModels =
          response.length === modelsPerPage && response.length < maxModels;
        console.log(
          `🔍 [FRONTEND] Has more models? ${hasMoreModels} (got ${response.length}/${modelsPerPage})`,
        );
        setHasMore(hasMoreModels);

        if (!hasMoreModels) {
          hasLoadedAllRef.current = true;
        }

        initialLoadDone.current = true;
      } catch (err) {
        console.error(`❌ [FRONTEND] Failed to load models:`, err);
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [modelsPerPage, maxModels, currentFilter],
  );

  const loadMoreModels = useCallback(async () => {
    if (loadingMore || !hasMore || loading || hasLoadedAllRef.current) {
      console.log(
        `⏭️ [FRONTEND] Skipping load more: loadingMore=${loadingMore}, hasMore=${hasMore}, loading=${loading}, hasLoadedAll=${hasLoadedAllRef.current}`,
      );
      return;
    }

    setLoadingMore(true);
    try {
      const nextPage = currentPageRef.current + 1;
      console.log(
        `🔄 [FRONTEND] Loading more models page ${nextPage} with filter ${currentFilter}...`,
      );

      const response = await invoke<HFModelSummary[]>(
        "fetch_huggingface_models_page",
        {
          page: nextPage,
          limit: modelsPerPage,
          filter: currentFilter,
        },
      );

      console.log(
        `📦 [FRONTEND] Received ${response.length} more models from backend`,
      );

      if (response.length === 0) {
        console.log(`📭 [FRONTEND] No more models to load`);
        setHasMore(false);
        hasLoadedAllRef.current = true;
        return;
      }

      // Filter out duplicates
      const existingIds = loadedIdsRef.current;
      const newModels = response.filter((m) => !existingIds.has(m.model_id));

      console.log(`🔍 [FRONTEND] Existing IDs count: ${existingIds.size}`);
      console.log(
        `🔍 [FRONTEND] New models found: ${newModels.length} (${response.length - newModels.length} duplicates filtered)`,
      );

      if (newModels.length === 0) {
        console.log(
          `⚠️ [FRONTEND] All received models are duplicates, stopping`,
        );
        setHasMore(false);
        hasLoadedAllRef.current = true;
        return;
      }

      // Add new IDs to the set
      newModels.forEach((m) => existingIds.add(m.model_id));

      setModels((prev) => {
        const newModelsList = [...prev, ...newModels];
        console.log(
          `📊 [FRONTEND] Now have ${newModelsList.length} total models`,
        );
        return newModelsList;
      });

      currentPageRef.current = nextPage;

      // Check if we've loaded all models
      if (
        response.length < modelsPerPage ||
        models.length + newModels.length >= maxModels
      ) {
        console.log(`📭 [FRONTEND] Reached end of models or max limit`);
        setHasMore(false);
        hasLoadedAllRef.current = true;
      } else {
        console.log(
          `✅ [FRONTEND] Got full page of models, possibly more available`,
        );
        setHasMore(true);
      }
    } catch (err) {
      console.error(`❌ [FRONTEND] Failed to load more models:`, err);
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
  ]);

  const changeFilter = useCallback(
    async (newFilter: ModelFilter) => {
      if (newFilter === currentFilter) return;

      console.log(
        `🔄 [FRONTEND] Changing filter from ${currentFilter} to ${newFilter}`,
      );

      // Clear state for new filter
      initialLoadDone.current = false;
      hasLoadedAllRef.current = false;
      loadedIdsRef.current = new Set();
      setModels([]);
      setHasMore(true);
      setTotalModels(0);
      currentPageRef.current = 0;

      // Load models with new filter
      await loadInitialModels(newFilter);
    },
    [currentFilter, loadInitialModels],
  );

  const refreshModels = useCallback(async () => {
    console.log(
      `🔄 [FRONTEND] Refreshing GGUF models with filter ${currentFilter}...`,
    );
    initialLoadDone.current = false;
    hasLoadedAllRef.current = false;
    loadedIdsRef.current = new Set();
    setModels([]);
    setHasMore(true);
    setTotalModels(0);
    currentPageRef.current = 0;
    await loadInitialModels(currentFilter);
  }, [loadInitialModels, currentFilter]);

  useEffect(() => {
    loadInitialModels(initialFilter);
  }, []);

  return {
    models,
    loading,
    loadingMore,
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
