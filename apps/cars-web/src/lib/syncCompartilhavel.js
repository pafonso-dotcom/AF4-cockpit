/**
 * Sincronização entre dispositivos · 2 modos práticos sem backend:
 *
 * MODO 1 · Backup completo via texto compartilhável:
 *   Gera JSON do app, comprime simples (base64), e dá:
 *    - Botão pra copiar texto
 *    - Botão pra abrir email com anexo
 *    - Botão pra abrir WhatsApp Web (auto-arquivo no próprio chat)
 *   Outro dispositivo cola o texto na tela de Restaurar.
 *
 * MODO 2 · Arquivo .json (já existe via Backup/Restore manual)
 *
 * Não usa OAuth Drive (precisa de backend ou redirect URL fixo, complica em prod).
 */

import { loadAll, loadKeys } from "./storage.js";

const STORAGE_KEY = "financas:dados:v1";

/** Coleta tudo num único snapshot */
export function snapshot() {
  return {
    versao: 1,
    geradoEm: new Date().toISOString(),
    dispositivo: navigator.userAgent.includes("Mac") ? "Mac" : navigator.userAgent.includes("iPhone") ? "iPhone" : "Outro",
    dados: loadAll(),
    apiKeys: loadKeys(),
  };
}

/** Snapshot → string base64 (texto curto-ish pra colar) */
export function snapshotParaTexto(snap) {
  const json = JSON.stringify(snap || snapshot());
  // Encode UTF-8 → base64
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  const base64 = btoa(binary);
  return `AF4SYNCv1:${base64}`;
}

/** Texto colado → snapshot */
export function textoParaSnapshot(texto) {
  if (!texto) throw new Error("Texto vazio.");
  const trimmed = texto.trim();
  if (!trimmed.startsWith("AF4SYNCv1:")) {
    throw new Error("Formato inválido. O texto deve começar com 'AF4SYNCv1:'.");
  }
  const base64 = trimmed.slice("AF4SYNCv1:".length);
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch (err) {
    throw new Error("Não consegui decodificar o backup. Verifique se o texto foi copiado completo.");
  }
}

/** Aplica snapshot no localStorage (substitui tudo) */
export function aplicarSnapshot(snap) {
  if (!snap || !snap.dados) throw new Error("Snapshot inválido.");
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap.dados));
    if (snap.apiKeys) {
      localStorage.setItem("financas:apiKeys:v1", JSON.stringify(snap.apiKeys));
    }
    return true;
  } catch (err) {
    throw new Error("Erro ao salvar: " + err.message);
  }
}

/** Tamanho legível */
export function tamanho(texto) {
  const bytes = new Blob([texto]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** Abre WhatsApp Web pra você enviar pra você mesmo */
export function compartilharWhatsApp(texto) {
  const preview = `📦 *Backup NUMVI* — ${new Date().toLocaleString("pt-BR")}\n\nCole este texto na tela de "Restaurar" do app no outro dispositivo:\n\n${texto}`;
  // Notebookmark wa.me sem número = abre escolher contato
  window.open(`https://wa.me/?text=${encodeURIComponent(preview)}`, "_blank", "noopener,noreferrer");
}

/** Abre email pré-preenchido com o backup */
export function compartilharEmail(texto) {
  const subject = `Backup NUMVI · ${new Date().toLocaleDateString("pt-BR")}`;
  const body = `Backup gerado pelo NUMVI.\n\nGuarde este email — basta colar o conteúdo abaixo na tela de "Restaurar" do app em qualquer dispositivo.\n\n---\n\n${texto}`;
  window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
}

/** Copia texto pra clipboard */
export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Fallback: cria textarea temporário
    try {
      const ta = document.createElement("textarea");
      ta.value = texto;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}
