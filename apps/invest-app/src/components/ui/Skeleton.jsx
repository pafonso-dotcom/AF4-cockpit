import React from "react";
import { T } from "../../lib/theme.js";

/**
 * Skeleton loader — placeholder animado.
 * Usar quando estiver carregando dados (cotações, transações, etc).
 *
 * <Skeleton w={120} h={14} />
 * <Skeleton w="100%" h={20} round />
 * <SkeletonRow icon /> // linha completa com ícone + 2 textos + valor
 */
export function Skeleton({ w = "100%", h = 14, round = false }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: typeof w === "number" ? `${w}px` : w,
        height: typeof h === "number" ? `${h}px` : h,
        background: `linear-gradient(90deg, ${T.bgSoft || T.card}, ${T.border}, ${T.bgSoft || T.card})`,
        backgroundSize: "200% 100%",
        borderRadius: round ? "50%" : 5,
        animation: "skelPulse 1.6s ease-in-out infinite",
      }}
    />
  );
}

export function SkeletonRow({ icon = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
      {icon && <Skeleton w={28} h={28} round />}
      <div style={{ flex: 1 }}>
        <Skeleton w={130} h={13} />
        <div style={{ height: 4 }} />
        <Skeleton w={90} h={10} />
      </div>
      <Skeleton w={70} h={14} />
    </div>
  );
}

export function SkeletonCard({ h = 100 }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14, borderRadius: 8 }}>
      <Skeleton w={80} h={10} />
      <div style={{ height: 8 }} />
      <Skeleton w="60%" h={h * 0.25} />
      <div style={{ height: 8 }} />
      <Skeleton w="40%" h={10} />
    </div>
  );
}

export default Skeleton;
