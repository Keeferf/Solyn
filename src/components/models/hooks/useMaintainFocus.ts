// src/hooks/useMaintainFocus.ts
import { useEffect, useRef } from "react";

export function useMaintainFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const isFocusedRef = useRef(false);
  const restoreTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Track focus state
    const handleFocus = () => {
      isFocusedRef.current = true;
    };

    const handleBlur = () => {
      isFocusedRef.current = false;
    };

    element.addEventListener("focus", handleFocus);
    element.addEventListener("blur", handleBlur);

    // Restore focus after any DOM mutations (e.g., content changes)
    const observer = new MutationObserver(() => {
      // Clear any pending restore attempts
      if (restoreTimeoutRef.current) {
        cancelAnimationFrame(restoreTimeoutRef.current);
        restoreTimeoutRef.current = null;
      }

      // Only restore if we're still focused and the element is not active
      if (isFocusedRef.current && document.activeElement !== element) {
        // Use multiple frames to ensure DOM is fully updated
        restoreTimeoutRef.current = requestAnimationFrame(() => {
          // Check again after a frame
          if (
            isFocusedRef.current &&
            document.contains(element) &&
            document.activeElement !== element
          ) {
            // Try to restore focus
            element.focus();

            // If focus was lost due to a re-render, try one more time after a short delay
            if (document.activeElement !== element) {
              setTimeout(() => {
                if (
                  isFocusedRef.current &&
                  document.contains(element) &&
                  document.activeElement !== element
                ) {
                  element.focus();
                }
              }, 50);
            }
          }
          restoreTimeoutRef.current = null;
        });
      }
    });

    // Watch for changes to the parent and its children
    // Also watch for subtree changes to catch any deep DOM mutations
    const targetNode = element.parentElement || element;
    observer.observe(targetNode, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    // Also observe the element itself for any changes
    observer.observe(element, {
      attributes: true,
      childList: true,
      subtree: true,
    });

    return () => {
      element.removeEventListener("focus", handleFocus);
      element.removeEventListener("blur", handleBlur);
      observer.disconnect();
      if (restoreTimeoutRef.current) {
        cancelAnimationFrame(restoreTimeoutRef.current);
        restoreTimeoutRef.current = null;
      }
    };
  }, []);

  return ref;
}
