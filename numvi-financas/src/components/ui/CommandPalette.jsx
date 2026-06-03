import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Search, CornerDownLeft } from "lucide-react";
import { T } from "../../lib/theme.js";
import { filtrarNav } from "../../lib/navItems.js";

/**
 * Command Palette — busca rápida de abas (Ctrl/Cmd+K).
 *
 * Props:
 * - open (bool), onClose ()
 * - onNavigate ({ modulo, tab }) — chamado ao escolher um destino
 */
export default function CommandPalette({ open, onClose, onNavigate }) {
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const resultados = useMemo(() => filtrarNav(query), [query]);

  // Reseta ao abrir + foca o input
  useEffect(() => {
    if (open) {
      setQuery("");
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Mantém o índice dentro do range quando os resultados mudam
  useEffect(() => { setIdx(0); }, [query]);

  const escolher = (item) => {
    if (!item) return;
    onNavigate?.({ modulo: item.modulo, tab: item.tab });
    onClose?.();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx(i => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      escolher(resultados[idx]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose?.();
    }
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "12vh", padding: "12vh 12px 12px",
      }}>
      <div style={{
        width: "100%", maxWidth: 540,
        background: T.card, border: `1px solid ${T.borderHi}`,
        borderRadius: 12, boxShadow: "0 24px 60px rgba(0,0,0,.5)",
        overflow: "hidden", display: "flex", flexDirection: "column",
        maxHeight: "70vh",
      }}>
        {/* Campo de busca */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 14px", borderBottom: `1px solid ${T.border}`,
        }}>
          <Search size={16} style={{ color: T.muted, flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar aba… (ex: contas, calculadora, veículos)"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: T.ink, fontSize: 15, fontFamily: "inherit",
            }} />
          <kbd style={{
            fontSize: 10, color: T.muted, border: `1px solid ${T.border}`,
            borderRadius: 4, padding: "2px 6px", flexShrink: 0,
          }}>ESC</kbd>
        </div>

        {/* Resultados */}
        <div ref={listRef} style={{ overflowY: "auto", padding: 6 }}>
          {resultados.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: T.muted, fontSize: 13, fontStyle: "italic" }}>
              Nada encontrado pra "{query}".
            </div>
          ) : (
            resultados.map((item, i) => {
              const ativo = i === idx;
              return (
                <button
                  key={`${item.modulo}-${item.tab}`}
                  onClick={() => escolher(item)}
                  onMouseEnter={() => setIdx(i)}
                  style={{
                    width: "100%", textAlign: "left", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px", borderRadius: 7, border: "none",
                    background: ativo ? `${T.gold}22` : "transparent",
                    color: T.ink,
                  }}>
                  <span style={{
                    fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase",
                    color: T.muted, minWidth: 92, fontWeight: 600,
                  }}>
                    {item.grupo}
                  </span>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: ativo ? 600 : 400 }}>
                    {item.label}
                  </span>
                  {ativo && <CornerDownLeft size={13} style={{ color: T.gold, flexShrink: 0 }} />}
                </button>
              );
            })
          )}
        </div>

        {/* Rodapé com dica */}
        <div style={{
          padding: "8px 14px", borderTop: `1px solid ${T.border}`,
          fontSize: 10.5, color: T.faint, display: "flex", gap: 14, flexWrap: "wrap",
        }}>
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>{resultados.length} {resultados.length === 1 ? "resultado" : "resultados"}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
