import React from "react";

const PRIMOS = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23]);

export default function Ball({ n, highlight = false, size = "md", markPrime = false }) {
  const sz = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-12 h-12 text-base" : "w-9 h-9 text-sm";
  const bg = highlight
    ? "bg-gradient-to-br from-gold to-amber-500 text-ink"
    : "bg-gradient-to-br from-accent/80 to-indigo-700 text-white";
  const isPrime = markPrime && PRIMOS.has(n);
  const dotSize = size === "sm" ? "w-1.5 h-1.5" : size === "lg" ? "w-2.5 h-2.5" : "w-2 h-2";
  return (
    <span className={`relative inline-flex items-center justify-center rounded-full font-bold shadow-md shadow-black/40 ${sz} ${bg}`}>
      {String(n).padStart(2, "0")}
      {isPrime && (
        <span
          aria-hidden
          title="Primo"
          className={`absolute -top-0.5 -right-0.5 ${dotSize} rounded-full bg-emerald-400 ring-2 ring-ink shadow-md`}
        />
      )}
    </span>
  );
}
