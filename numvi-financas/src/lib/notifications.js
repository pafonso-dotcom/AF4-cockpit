/**
 * Notificações de vencimentos · cheques, dívidas, devedores em atraso, backups.
 *
 * Funciona via Notifications API do navegador (PWA compatível).
 * Configurações persistem em localStorage:
 *   af4:notif:cfg   → { habilitada, antecedenciaDias, tipos: { cheques, dividas, recebimentos, backups } }
 *   af4:notif:enviadas → Set de IDs já notificadas (evita duplicar)
 */

const CFG_KEY = "af4:notif:cfg";
const SENT_KEY = "af4:notif:enviadas";

const DEFAULTS = {
  habilitada: false,           // só ativa após o usuário permitir
  antecedenciaDias: 3,          // quantos dias antes do vencimento alertar
  tipos: {
    cheques: true,
    dividas: true,
    recebimentos: true,
    backups: false,             // backup automático não notifica por padrão
  },
};

const safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

export function getConfig() {
  return safe(() => {
    const raw = localStorage.getItem(CFG_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  }, { ...DEFAULTS });
}

export function setConfig(cfg) {
  safe(() => localStorage.setItem(CFG_KEY, JSON.stringify({ ...DEFAULTS, ...cfg })));
}

export function isSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getPermission() {
  return isSupported() ? Notification.permission : "denied";
}

export async function requestPermission() {
  if (!isSupported()) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return "denied";
  }
}

/** Disparar uma notificação manualmente */
export function notify(title, body, options = {}) {
  if (!isSupported() || Notification.permission !== "granted") return null;
  try {
    return new Notification(title, {
      body,
      icon: `${import.meta.env.BASE_URL}icon.svg`,
      badge: `${import.meta.env.BASE_URL}icon.svg`,
      ...options,
    });
  } catch {
    return null;
  }
}

function getSent() {
  return safe(() => new Set(JSON.parse(localStorage.getItem(SENT_KEY) || "[]")), new Set());
}

function setSent(set) {
  safe(() => localStorage.setItem(SENT_KEY, JSON.stringify([...set])));
}

function markSent(id) {
  const s = getSent();
  s.add(id);
  // Mantém só os 200 mais recentes pra não crescer infinito
  if (s.size > 200) {
    const arr = [...s].slice(-200);
    setSent(new Set(arr));
  } else {
    setSent(s);
  }
}

function diasAte(dateISO) {
  if (!dateISO) return null;
  const d = new Date(dateISO + "T00:00:00");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((d - hoje) / 86400000);
}

/**
 * Verifica todos os vencimentos próximos e dispara notificações
 * para os que ainda não foram notificados hoje.
 *
 * Chamar:
 *   - 1x logo após o app carregar
 *   - Periodicamente (a cada 30min)
 */
export function checkAndNotify({ devedores = [], dividas = [], cheques = [] }) {
  const cfg = getConfig();
  if (!cfg.habilitada || getPermission() !== "granted") return { fired: 0, total: 0 };

  const sent = getSent();
  const hoje = new Date().toISOString().slice(0, 10);
  let fired = 0;
  let total = 0;

  const tryFire = (id, title, body, options = {}) => {
    total++;
    const sentKey = `${id}__${hoje}`;
    if (sent.has(sentKey)) return false;
    notify(title, body, options);
    markSent(sentKey);
    fired++;
    return true;
  };

  // Cheques (a compensar)
  if (cfg.tipos.cheques) {
    cheques.filter(c => c.status === "aguardando").forEach(c => {
      const d = diasAte(c.data);
      if (d === null) return;
      if (d < 0) {
        tryFire(`cheque-atraso-${c.id}`,
          "⚠ Cheque vencido sem compensar",
          `${c.emitente || "Emitente"} · ${formatBRL(c.valor)} · venceu há ${Math.abs(d)} ${Math.abs(d) === 1 ? "dia" : "dias"}`);
      } else if (d <= cfg.antecedenciaDias) {
        tryFire(`cheque-${c.id}`,
          d === 0 ? "💰 Cheque vence HOJE" : d === 1 ? "💰 Cheque vence AMANHÃ" : `💰 Cheque vence em ${d} dias`,
          `${c.emitente || "Emitente"} · Nº ${c.numero || "—"} · ${formatBRL(c.valor)} · ${c.banco || ""}`);
      }
    });
  }

  // Dívidas (a pagar)
  if (cfg.tipos.dividas) {
    dividas.filter(d => !d.pago).forEach(div => {
      const d = diasAte(div.vencimento);
      if (d === null) return;
      if (d < 0) {
        tryFire(`divida-atraso-${div.id}`,
          "⚠ Dívida em atraso",
          `${div.nome} · ${formatBRL(div.valor)} · atrasou ${Math.abs(d)} ${Math.abs(d) === 1 ? "dia" : "dias"}`);
      } else if (d <= cfg.antecedenciaDias) {
        tryFire(`divida-${div.id}`,
          d === 0 ? "📅 Dívida vence HOJE" : d === 1 ? "📅 Dívida vence AMANHÃ" : `📅 Dívida vence em ${d} dias`,
          `${div.nome} · ${formatBRL(div.valor)}${div.parcela ? ` · ${div.parcela}` : ""}`);
      }
    });
  }

  // Recebimentos (devedores)
  if (cfg.tipos.recebimentos) {
    devedores.filter(d => !d.recebido).forEach(dev => {
      const d = diasAte(dev.vencimento);
      if (d === null) return;
      if (d < 0) {
        tryFire(`devedor-atraso-${dev.id}`,
          "⚠ Recebimento em atraso",
          `${dev.nome} atrasou ${formatBRL(dev.valor)} há ${Math.abs(d)} ${Math.abs(d) === 1 ? "dia" : "dias"}`);
      } else if (d <= cfg.antecedenciaDias) {
        tryFire(`devedor-${dev.id}`,
          d === 0 ? "💵 Receber HOJE" : d === 1 ? "💵 Receber AMANHÃ" : `💵 Receber em ${d} dias`,
          `${dev.nome} · ${formatBRL(dev.valor)}`);
      }
    });
  }

  return { fired, total };
}

function formatBRL(v) {
  try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0); }
  catch { return `R$ ${v}`; }
}
