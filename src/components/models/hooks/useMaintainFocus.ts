import { useEffect, useRef } from "react";

export function useMaintainFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const isFocusedRef = useRef(false);
  const restoreTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleFocus = () => {
      isFocusedRef.current = true;
    };

    const handleBlur = () => {
      isFocusedRef.current = false;
    };

    element.addEventListener("focus", handleFocus);
    element.addEventListener("blur", handleBlur);

    const observer = new MutationObserver(() => {
      if (restoreTimeoutRef.current) {
        cancelAnimationFrame(restoreTimeoutRef.current);
        restoreTimeoutRef.current = null;
      }

      if (isFocusedRef.current && document.activeElement !== element) {
        restoreTimeoutRef.current = requestAnimationFrame(() => {
          if (
            isFocusedRef.current &&
            document.contains(element) &&
            document.activeElement !== element
          ) {
            element.focus();

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

    const targetNode = element.parentElement || element;
    observer.observe(targetNode, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

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
