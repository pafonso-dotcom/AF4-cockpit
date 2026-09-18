/* ============================================================
   ALERTAS DE PREÇO-ALVO · por ativo

   Cada ativo pode ter `alertaAcima` e/ou `alertaAbaixo` (R$).
   Quando a COTAÇÃO REAL cruza o alvo (preço ≥ acima ou ≤ abaixo),
   o app avisa na atualização de mercado — no máximo 1 aviso por
   ativo/direção/dia (dedupe em localStorage, feito pelo chamador
   com filtrarNovos/marcarNotificados).
   ============================================================ */

export function alertasDisparados(ativos = []) {
  const out = [];
  for (const a of ativos || []) {
    const preco = Number(a?.preco) || 0;
    // Só cotação REAL dispara — preço simulado/parado não é sinal de mercado.
    if (preco <= 0 || !a?.realtime) continue;
    const acima = Number(a.alertaAcima) || 0;
    const abaixo = Number(a.alertaAbaixo) || 0;
    if (acima > 0 && preco >= acima) out.push({ ticker: a.ticker || "?", dir: "acima", alvo: acima, preco });
    if (abaixo > 0 && preco <= abaixo) out.push({ ticker: a.ticker || "?", dir: "abaixo", alvo: abaixo, preco });
  }
  return out;
}

export const chaveAlerta = (al) => `${String(al.ticker).toUpperCase()}|${al.dir}|${al.alvo}`;

/** Só os alertas ainda não avisados HOJE. */
export function filtrarNovos(alertas = [], notificados = {}, hojeISO) {
  return (alertas || []).filter(al => notificados?.[chaveAlerta(al)] !== hojeISO);
}

/** Marca os alertas como avisados hoje (retorna o novo mapa pra persistir). */
export function marcarNotificados(alertas = [], notificados = {}, hojeISO) {
  const out = { ...(notificados || {}) };
  (alertas || []).forEach(al => { out[chaveAlerta(al)] = hojeISO; });
  return out;
}
