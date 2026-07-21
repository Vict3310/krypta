"use client";

import { useEffect, useRef } from "react";

export function ScrollAnimations() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove(
              "opacity-0",
              "translate-y-4",
              "translate-x-4",
              "scale-95"
            );
            entry.target.classList.add("opacity-100", "translate-y-0", "translate-x-0", "scale-100");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    // Observe all animated elements
    const targets = document.querySelectorAll(
      "[data-reveal], [data-rise], [data-drift], [data-count-up]"
    );
    targets.forEach((el) => observerRef.current?.observe(el));

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return null;
}
