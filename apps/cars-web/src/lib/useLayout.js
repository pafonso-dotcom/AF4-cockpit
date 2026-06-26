import { useState, useEffect } from "react";

const LS_KEY = "af4:layout";

/**
 * Hook que detecta o layout atual (horizontal/vertical) e força horizontal em
 * mobile portrait (onde sidebar não cabe).
 *
 * Persistido em localStorage("af4:layout").
 */
export function useLayout() {
  const [layout, setLayout] = useState(() => {
    try { return localStorage.getItem(LS_KEY) || "vertical"; }
    catch { return "vertical"; }
  });
  const [forcaHorizontal, setForcaHorizontal] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768 && window.innerHeight > window.innerWidth;
  });

  useEffect(() => {
    const checkSize = () => {
      const isMobilePortrait = window.innerWidth < 768 && window.innerHeight > window.innerWidth;
      setForcaHorizontal(isMobilePortrait);
    };
    checkSize();
    window.addEventListener("resize", checkSize);
    window.addEventListener("orientationchange", checkSize);
    return () => {
      window.removeEventListener("resize", checkSize);
      window.removeEventListener("orientationchange", checkSize);
    };
  }, []);

  useEffect(() => {
    const onChange = (e) => setLayout(e.detail);
    window.addEventListener("af4:layout-changed", onChange);
    return () => window.removeEventListener("af4:layout-changed", onChange);
  }, []);

  const layoutAtivo = forcaHorizontal ? "horizontal" : layout;
  return {
    layout: layoutAtivo,
    isVertical: layoutAtivo === "vertical",
    isMobile: forcaHorizontal,
    setLayoutPref: (v) => {
      try { localStorage.setItem(LS_KEY, v); } catch {}
      window.dispatchEvent(new CustomEvent("af4:layout-changed", { detail: v }));
    },
  };
}
