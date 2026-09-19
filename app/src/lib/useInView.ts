"use client";

import { RefObject, useEffect, useState } from "react";

/** True while the element is (nearly) on screen. Used to pause WebGL when scrolled away. */
export function useInView(ref: RefObject<Element | null>, rootMargin = "120px") {
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      rootMargin,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);

  return inView;
}
