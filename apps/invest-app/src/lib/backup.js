/* ============================================================
   BACKUP / RESTORE — exporta e importa todos os dados em JSON
   ============================================================ */

import { loadAll, loadKeys, saveAll, saveKeys } from "./storage.js";

const BACKUP_VERSION = 1;

/**
 * Gera um JSON com todos os dados do usuário (sem chaves de API por padrão)
 * e dispara o download.
 */
export const exportBackup = async (includeKeys = false) => {
  const data = await loadAll();
  const keys = includeKeys ? await loadKeys() : null;

  const payload = {
    app: "af4-cockpit",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: data || {},
    apiKeys: keys || undefined,
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const ts = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `af4-cockpit-backup-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/**
 * Lê um arquivo JSON, valida o formato e restaura os dados.
 * Retorna { ok: true, summary } ou { ok: false, error }.
 */
export const importBackup = async (file) => {
  if (!file) return { ok: false, error: "Nenhum arquivo selecionado" };

  let payload;
  try {
    const text = await file.text();
    payload = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: "Arquivo não é um JSON válido" };
  }

  if (payload.app !== "af4-cockpit") {
    return { ok: false, error: "Este arquivo não é um backup do AF4 Cockpit" };
  }

  if (!payload.data || typeof payload.data !== "object") {
    return { ok: false, error: "Backup sem dados válidos" };
  }

  // Save data slice
  await saveAll(payload.data);

  // Optionally save keys if present
  if (payload.apiKeys && typeof payload.apiKeys === "object") {
    await saveKeys(payload.apiKeys);
  }

  // Build summary for user feedback
  const d = payload.data;
  const summary = {
    contas: d.contas?.length || 0,
    transacoes: d.transacoes?.length || 0,
    cartoes: d.cartoes?.length || 0,
    parcelamentos: d.parcelamentos?.length || 0,
    ativos: d.ativos?.length || 0,
    devedores: d.devedores?.length || 0,
    dividas: d.dividas?.length || 0,
    metas: d.metas?.length || 0,
    exportedAt: payload.exportedAt,
    keysIncluded: !!payload.apiKeys,
  };

  return { ok: true, summary };
};
