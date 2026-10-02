import { useEffect, useState } from "react";
import { buscarCotacao } from "./cambio.js";

/**
 * Dólar do dia (R$ por 1 US$) — uma busca por sessão, compartilhada entre as
 * telas (Painel, Invest, assistente). Guarda o último valor em sessionStorage
 * pra não piscar ao trocar de tela. null = ainda carregando / indisponível.
 */
const CHAVE = "af4:dolar-dia";
let cache = null;
let pendente = null;

export function dolarEmCache() {
  if (cache) return cache;
  try { const v = Number(sessionStorage.getItem(CHAVE)); if (v > 0) cache = v; } catch {}
  return cache;
}

export function carregarDolar() {
  if (!pendente) {
    pendente = buscarCotacao("USD").then(r => {
      if (r > 0) { cache = r; try { sessionStorage.setItem(CHAVE, String(r)); } catch {} }
      return dolarEmCache();
    }).catch(() => dolarEmCache());
  }
  return pendente;
}

export function useDolar() {
  const [v, setV] = useState(dolarEmCache);
  useEffect(() => {
    let vivo = true;
    carregarDolar().then(r => { if (vivo && r) setV(r); });
    return () => { vivo = false; };
  }, []);
  return v;
}

// Euro do dia — mesmo esquema do dólar (orçamento de viagens em €).
const CHAVE_EUR = "af4:euro-dia";
let cacheEur = null;
let pendenteEur = null;
export function euroEmCache() {
  if (cacheEur) return cacheEur;
  try { const v = Number(sessionStorage.getItem(CHAVE_EUR)); if (v > 0) cacheEur = v; } catch {}
  return cacheEur;
}
export function useEuro() {
  const [v, setV] = useState(euroEmCache);
  useEffect(() => {
    let vivo = true;
    if (!pendenteEur) {
      pendenteEur = buscarCotacao("EUR").then(r => {
        if (r > 0) { cacheEur = r; try { sessionStorage.setItem(CHAVE_EUR, String(r)); } catch {} }
        return euroEmCache();
      }).catch(() => euroEmCache());
    }
    pendenteEur.then(r => { if (vivo && r) setV(r); });
    return () => { vivo = false; };
  }, []);
  return v;
}
