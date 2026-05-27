import React from "react";

export default function Ball({ n, highlight = false, size = "md" }) {
  const sz = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-12 h-12 text-base" : "w-9 h-9 text-sm";
  const bg = highlight
    ? "bg-gradient-to-br from-gold to-amber-500 text-ink"
    : "bg-gradient-to-br from-accent/80 to-indigo-700 text-white";
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-bold shadow-md shadow-black/40 ${sz} ${bg}`}>
      {String(n).padStart(2, "0")}
    </span>
  );
}
