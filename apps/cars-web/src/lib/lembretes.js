// Lembretes de vencimento — notificação do sistema (Notification API) pra
// fixas pendentes, faturas de cartão em aberto, cheques aguardando e dívidas,
// avisando de hoje até N dias antes do vencimento.
//
// Limitações honestas: funciona em desktop (Chrome/Edge/Firefox/Safari) e
// Android; o Safari do iOS NÃO suporta Notification local em página/PWA —
// lá o sino de alertas do app continua sendo o aviso. Cada item notifica no
// máximo 1× por dia (dedupe em localStorage).
import { fmt } from "./format.js";

const KEY_ON = "af4:lembretes:v1";
const KEY_NOTIFICADOS = "af4:lembretes-notificados:v1";
const DIAS_ANTECEDENCIA = 2;

export function suportaNotificacao() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function lembretesAtivos() {
  try { return localStorage.getItem(KEY_ON) === "1"; } catch { return false; }
}

export function setLembretesAtivos(v) {
  try { localStorage.setItem(KEY_ON, v ? "1" : "0"); } catch {}
}

export async function pedirPermissao() {
  if (!suportaNotificacao()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try { return await Notification.requestPermission(); } catch { return "denied"; }
}

const hojeISO = () => new Date().toISOString().slice(0, 10);

function rotuloDia(iso, hoje) {
  if (iso < hoje) return "VENCIDA";
  if (iso === hoje) return "vence HOJE";
  const d = Math.round((new Date(iso) - new Date(hoje)) / 86400000);
  return d === 1 ? "vence amanhã" : `vence em ${d} dias (${iso.slice(8, 10)}/${iso.slice(5, 7)})`;
}

/**
 * Varre o estado e devolve os lembretes da janela [hoje, hoje+dias]
 * (+ atrasados de até 3 dias, pra não deixar passar batido).
 * Cada item: { id, titulo, corpo, data }.
 */
export function coletarVencimentos(state = {}, { dias = DIAS_ANTECEDENCIA } = {}) {
  const hoje = hojeISO();
  const lim = new Date();
  lim.setDate(lim.getDate() + dias);
  const limISO = lim.toISOString().slice(0, 10);
  const min = new Date();
  min.setDate(min.getDate() - 3);
  const minISO = min.toISOString().slice(0, 10);
  const naJanela = (iso) => iso && iso >= minISO && iso <= limISO;
  const out = [];

  // Fixas pendentes (só de fixas que ainda existem)
  const fixaPorId = new Map((state.fixas || []).map(f => [f.id, f]));
  (state.fixaOcorrencias || []).forEach(o => {
    if (o.status === "paga") return;
    const fixa = fixaPorId.get(o.fixaId);
    if (!fixa || !naJanela(o.dataVencimento)) return;
    out.push({
      id: `fixa-${o.id}`,
      data: o.dataVencimento,
      titulo: `💡 ${fixa.descricao} · ${rotuloDia(o.dataVencimento, hoje)}`,
      corpo: `Conta fixa de ${fmt(o.valor || 0)}. Abra o Afinanças pra marcar como paga.`,
    });
  });

  // Faturas de cartão importadas em aberto
  (state.cartoes || []).forEach(c => {
    const fi = c.faturaImportada;
    if (!fi || fi.paga || !naJanela(fi.vencimento)) return;
    out.push({
      id: `fatura-${c.id}-${fi.competencia || fi.vencimento}`,
      data: fi.vencimento,
      titulo: `💳 Fatura ${c.nome} · ${rotuloDia(fi.vencimento, hoje)}`,
      corpo: `Valor da fatura: ${fmt(fi.valorTotal || 0)}.`,
    });
  });

  // Cheques aguardando compensação
  (state.cheques || []).forEach(ch => {
    if (ch.status !== "aguardando" || !naJanela(ch.vencimento)) return;
    out.push({
      id: `cheque-${ch.id}`,
      data: ch.vencimento,
      titulo: `🧾 Cheque de ${ch.de || "?"} · ${rotuloDia(ch.vencimento, hoje)}`,
      corpo: `${fmt(ch.valor || 0)} pra compensar${ch.banco ? ` (${ch.banco})` : ""}.`,
    });
  });

  // Dívidas a pagar
  (state.dividas || []).forEach(d => {
    if (d.pago || !naJanela(d.vencimento)) return;
    out.push({
      id: `divida-${d.id}`,
      data: d.vencimento,
      titulo: `📌 ${d.nome || d.descricao || "Dívida"} · ${rotuloDia(d.vencimento, hoje)}`,
      corpo: `A pagar: ${fmt(d.valor || 0)}.`,
    });
  });

  return out.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
}

function lerNotificados() {
  try { return JSON.parse(localStorage.getItem(KEY_NOTIFICADOS)) || {}; } catch { return {}; }
}

/**
 * Dispara as notificações pendentes (no máx. 1 por item por dia).
 * Chamar na abertura do app e periodicamente enquanto aberto.
 * Retorna quantas foram disparadas (0 quando desligado/sem permissão).
 */
export function dispararLembretes(state) {
  if (!lembretesAtivos()) return 0;
  if (!suportaNotificacao() || Notification.permission !== "granted") return 0;
  const hoje = hojeISO();
  const notificados = lerNotificados();
  let enviados = 0;
  coletarVencimentos(state).forEach(l => {
    if (notificados[l.id] === hoje) return; // já avisou hoje
    try {
      new Notification(l.titulo, { body: l.corpo, tag: l.id, icon: "/apple-touch-icon.png" });
      notificados[l.id] = hoje;
      enviados++;
    } catch { /* alguns navegadores exigem ServiceWorker — falha silenciosa */ }
  });
  if (enviados > 0) {
    // Limpa entradas antigas (itens que saíram da janela) pra não crescer sem fim.
    const idsAtuais = new Set(coletarVencimentos(state).map(l => l.id));
    Object.keys(notificados).forEach(k => { if (!idsAtuais.has(k) && notificados[k] !== hoje) delete notificados[k]; });
    try { localStorage.setItem(KEY_NOTIFICADOS, JSON.stringify(notificados)); } catch {}
  }
  return enviados;
}
