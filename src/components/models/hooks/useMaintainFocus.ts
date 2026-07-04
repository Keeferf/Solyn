// src/hooks/useMaintainFocus.ts
import { useEffect, useRef } from "react";

export function useMaintainFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const isFocusedRef = useRef(false);

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
      if (isFocusedRef.current && document.activeElement !== element) {
        requestAnimationFrame(() => {
          if (document.contains(element) && isFocusedRef.current) {
            element.focus();
          }
        });
      }
    });

    // Watch for changes to parent's children (e.g., sibling elements being added/removed)
    observer.observe(element.parentElement || element, {
      childList: true,
      subtree: true,
    });

    return () => {
      element.removeEventListener("focus", handleFocus);
      element.removeEventListener("blur", handleBlur);
      observer.disconnect();
    };
  }, []);

  return ref;
}
