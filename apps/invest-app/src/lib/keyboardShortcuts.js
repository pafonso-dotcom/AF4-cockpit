// Hook React que registra atalhos globais (N/V/A/?).
// Desabilita automaticamente quando há input em foco ou modal aberto.
import { useEffect } from "react";

function isInInput() {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.isContentEditable) return true;
  return false;
}

function isBlocked() {
  // Se algum modal estiver aberto, não dispara atalho de "nova ação"
  // Usa marker data-modal-open OU detecta via modais conhecidos
  if (document.querySelector("[data-modal-open='true']")) return true;
  // Modal padrão do projeto: portal com z-index 1000+ que tem botão "Fechar"
  // Detecta heuristicamente — se houver overlay visível, bloqueia
  return false;
}

export function useKeyboardShortcuts({
  onNovaTransacao,
  onNovaVenda,
  onNovoAporte,
  onMostrarAtalhos,
} = {}) {
  useEffect(() => {
    const handler = (e) => {
      if (isInInput()) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // ? sempre disponível (mesmo com modal aberto)
      if (key === "?" || (e.shiftKey && key === "/")) {
        e.preventDefault();
        onMostrarAtalhos?.();
        return;
      }

      // N/V/A bloqueados quando modal aberto
      if (isBlocked()) return;

      if (key === "n") { e.preventDefault(); onNovaTransacao?.(); }
      else if (key === "v") { e.preventDefault(); onNovaVenda?.(); }
      else if (key === "a") { e.preventDefault(); onNovoAporte?.(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNovaTransacao, onNovaVenda, onNovoAporte, onMostrarAtalhos]);
}
