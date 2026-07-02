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
}

export interface HFModelDetails extends HFModelSummary {
  description?: string;
  gguf_files: GGUFFile[];
}

export type HFModel = HFModelSummary | HFModelDetails;

export function hasDetails(model: HFModel): model is HFModelDetails {
  return (
    "gguf_files" in model && Array.isArray((model as HFModelDetails).gguf_files)
  );
}

export const useHuggingFaceModels = () => {
  const [models, setModels] = useState<HFModelSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [totalModels, setTotalModels] = useState(0);
  const currentPageRef = useRef(1);
  const modelsPerPage = 20;
  const initialLoadDone = useRef(false);
  const hasLoadedAllRef = useRef(false);
  const loadedIdsRef = useRef<Set<string>>(new Set());

  const loadInitialModels = useCallback(async () => {
    if (initialLoadDone.current) return;

    setLoading(true);
    setError(null);
    try {
      console.log(`🔄 [FRONTEND] Loading initial models page 1...`);

      let total = 0;
      try {
        total = await invoke<number>("get_huggingface_model_count");
        console.log(
          `📊 [FRONTEND] Total models available (from API): ${total}`,
        );
      } catch (countErr) {
        console.warn(
          "[FRONTEND] Failed to get total count, will use fallback",
          countErr,
        );
        total = 0;
      }

      if (total < modelsPerPage) {
        console.log(
          `⚠️ [FRONTEND] Total count (${total}) is less than models per page (${modelsPerPage}), using fallback`,
        );
        total = 1000;
      }

      setTotalModels(total);

      console.log(
        `📤 [FRONTEND] Calling fetch_huggingface_models_page with page: 1, limit: ${modelsPerPage}`,
      );
      const response = await invoke<HFModelSummary[]>(
        "fetch_huggingface_models_page",
        {
          page: 1,
          limit: modelsPerPage,
        },
      );

      console.log(
        `📦 [FRONTEND] Received ${response.length} models from backend`,
      );
      if (response.length > 0) {
        console.log(`📦 [FRONTEND] First model: ${response[0]?.model_id}`);
        console.log(
          `📦 [FRONTEND] Last model: ${response[response.length - 1]?.model_id}`,
        );

        // Log all model IDs from page 1
        const ids = response.map((m) => m.model_id);
        console.log(`📋 [FRONTEND] All model IDs on page 1:`, ids);
      }

      // Track loaded IDs
      const ids = new Set<string>();
      response.forEach((m) => ids.add(m.model_id));
      loadedIdsRef.current = ids;

      setModels(response);
      currentPageRef.current = 1;

      const hasMoreModels = response.length === modelsPerPage;
      console.log(
        `🔍 [FRONTEND] Has more models? ${hasMoreModels} (got ${response.length}, total from API: ${total})`,
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
  }, [modelsPerPage]);

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
      console.log(`🔄 [FRONTEND] Loading more models page ${nextPage}...`);
      console.log(
        `📤 [FRONTEND] Calling fetch_huggingface_models_page with page: ${nextPage}, limit: ${modelsPerPage}`,
      );

      const response = await invoke<HFModelSummary[]>(
        "fetch_huggingface_models_page",
        {
          page: nextPage,
          limit: modelsPerPage,
        },
      );

      console.log(
        `📦 [FRONTEND] Received ${response.length} more models from backend`,
      );

      if (response.length > 0) {
        console.log(`📦 [FRONTEND] First new model: ${response[0]?.model_id}`);
        console.log(
          `📦 [FRONTEND] Last new model: ${response[response.length - 1]?.model_id}`,
        );

        // Log all model IDs from this page
        const ids = response.map((m) => m.model_id);
        console.log(`📋 [FRONTEND] All model IDs on page ${nextPage}:`, ids);
      }

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
      if (response.length < modelsPerPage) {
        console.log(
          `📭 [FRONTEND] Got less than limit (${response.length} < ${modelsPerPage}), no more models`,
        );
        setHasMore(false);
        hasLoadedAllRef.current = true;
      } else if (newModels.length < modelsPerPage) {
        console.log(
          `📭 [FRONTEND] Got ${newModels.length} new models (less than limit), no more models`,
        );
        setHasMore(false);
        hasLoadedAllRef.current = true;
      } else {
        console.log(
          `✅ [FRONTEND] Got full page of new models, assuming there are more`,
        );
        setHasMore(true);
      }
    } catch (err) {
      console.error(`❌ [FRONTEND] Failed to load more models:`, err);
      setError(String(err));
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, loading, modelsPerPage]);

  const refreshModels = useCallback(async () => {
    console.log(`🔄 [FRONTEND] Refreshing models...`);
    initialLoadDone.current = false;
    hasLoadedAllRef.current = false;
    loadedIdsRef.current = new Set();
    setModels([]);
    setHasMore(true);
    currentPageRef.current = 0;
    await loadInitialModels();
  }, [loadInitialModels]);

  useEffect(() => {
    loadInitialModels();
  }, [loadInitialModels]);

  return {
    models,
    loading,
    loadingMore,
    error,
    hasMore,
    totalModels,
    loadMoreModels,
    refreshModels,
  };
};
