/**
 * Integração bancária PLUGGY (Meu Pluggy · Open Finance) — lado do app.
 *
 * As chamadas vão pro NOSSO Worker (/api/pluggy/*), nunca direto pra Pluggy:
 * o client_secret vive só no servidor. O PIN (localStorage) vai no header
 * x-pluggy-pin e é obrigatório. Fonte OPCIONAL — o app funciona 100% sem.
 */
import { uid } from "./format.js";
import { chaveTransacao } from "./extratoParser.js";

const PIN_KEY = "af4:pluggy-pin";
const USUARIO_KEY = "af4:pluggy-usuario";

export function getPluggyPin() {
  try { return localStorage.getItem(PIN_KEY) || ""; } catch { return ""; }
}
export function setPluggyPin(v) {
  try { localStorage.setItem(PIN_KEY, (v || "").trim()); } catch {}
}

// Só o e-mail/usuário fica lembrado (a senha NUNCA é salva — só transita).
export function getPluggyUsuario() {
  try { return localStorage.getItem(USUARIO_KEY) || ""; } catch { return ""; }
}
export function setPluggyUsuario(v) {
  try { localStorage.setItem(USUARIO_KEY, (v || "").trim()); } catch {}
}

async function chamar(caminho, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  const pin = getPluggyPin();
  if (pin) headers["x-pluggy-pin"] = pin;
  let res;
  try {
    res = await fetch(`/api/pluggy/${caminho}`, { ...opts, headers });
  } catch {
    throw new Error("Sem conexão com o servidor — tenta de novo.");
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401) throw new Error("PIN da conexão bancária inválido — confere em Configurações → APIs.");
  if (res.status === 501) throw new Error(data?.error || "Integração Pluggy não configurada no servidor.");
  if (!res.ok || data?.ok === false) throw new Error(data?.error || `Erro na conexão bancária (HTTP ${res.status}).`);
  return data;
}

export const conectarMeuPluggy = (usuario, senha) =>
  chamar("conectar", { method: "POST", body: JSON.stringify({ usuario, senha }) });
export const statusItem = (itemId, atualizar = false) =>
  chamar(`item?itemId=${encodeURIComponent(itemId)}${atualizar ? "&atualizar=1" : ""}`);
export const contasPluggy = (itemId) =>
  chamar(`contas?itemId=${encodeURIComponent(itemId)}`);
export const transacoesPluggy = (accountId, from, to) =>
  chamar(`transacoes?accountId=${encodeURIComponent(accountId)}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`);

// Consentimento Open Finance expira — estes status pedem reconexão no Meu Pluggy.
export const STATUS_RECONECTAR = new Set(["LOGIN_ERROR", "OUTDATED", "WAITING_USER_INPUT", "USER_INPUT_TIMEOUT"]);

/**
 * PURA: converte transações vindas do Worker pro shape do app e DEDUPLICA:
 *  1) idempotência real — descarta quem já existe por pluggyId (rodar a sync
 *     duas vezes importa zero);
 *  2) marca `_duplicada` (não descarta) quem bate com lançamento MANUAL pela
 *     chave data|valor|tipo (mesma regra do importador de extrato) — o
 *     usuário decide na prévia.
 */
export function prepararImportPluggy(txsPluggy = [], existentes = [], contaNome = "") {
  const idsExistentes = new Set((existentes || []).map(t => t.pluggyId).filter(Boolean));
  const chavesExistentes = new Set((existentes || []).map(chaveTransacao));

  const novas = [];
  let jaImportadas = 0;
  for (const t of txsPluggy || []) {
    if (t.pluggyId && idsExistentes.has(t.pluggyId)) { jaImportadas++; continue; }
    const tx = {
      id: uid(),
      descricao: t.descricao || "Transação",
      categoria: "",
      subcategoria: "",
      tipo: t.tipo === "receita" ? "receita" : "despesa",
      conta: contaNome,
      data: t.data,
      valor: Math.abs(Number(t.valor) || 0),
      compensado: true,
      fixa: false,
      obs: "Importado do banco (Open Finance)",
      origem: "pluggy",
      pluggyId: t.pluggyId,
    };
    tx._duplicada = chavesExistentes.has(chaveTransacao(tx));
    novas.push(tx);
  }
  return { novas, jaImportadas };
}
