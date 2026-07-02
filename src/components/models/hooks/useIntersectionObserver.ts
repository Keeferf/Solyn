// src/components/models/hooks/useIntersectionObserver.ts
import { useEffect, useRef, useState } from "react";

export const useIntersectionObserver = (
  options: IntersectionObserverInit = {
    threshold: 0.1,
    rootMargin: "50px",
  },
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      console.log(
        `👁️ [IntersectionObserver] Intersection observed: isIntersecting=${entry.isIntersecting}, target=${entry.target}`,
      );
      setIsIntersecting(entry.isIntersecting);
    }, options);

    const currentTarget = targetRef.current;
    if (currentTarget) {
      console.log(
        `👁️ [IntersectionObserver] Starting to observe sentinel element`,
      );
      observer.observe(currentTarget);
    } else {
      console.log(`👁️ [IntersectionObserver] No target element to observe yet`);
    }

    return () => {
      if (currentTarget) {
        console.log(`👁️ [IntersectionObserver] Stopping observation`);
        observer.unobserve(currentTarget);
      }
    };
  }, [options]);

  return { targetRef, isIntersecting };
};
