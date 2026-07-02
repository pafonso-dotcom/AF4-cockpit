// Benchmarks reais via API SGS do Banco Central (api.bcb.gov.br).
// Pública, sem chave, CORS liberado — funciona direto do navegador.
//   série 4391 = CDI acumulado no mês (% a.m.)
//   série  433 = IPCA variação mensal (% a.m.)
//   série    7 = Ibovespa fechamento diário (pontos)
// Cache em localStorage com TTL de 12h pra não bater na API a cada render.

const KEY_CACHE = "af4:bcb-benchmarks:v1";
const TTL_MS = 12 * 60 * 60 * 1000;

/** Compõe uma lista de taxas mensais em % no acumulado do período (%). */
export function acumularMensais(valores = []) {
  const fator = (valores || []).reduce((f, v) => {
    const n = Number(v);
    return Number.isFinite(n) ? f * (1 + n / 100) : f;
  }, 1);
  return (fator - 1) * 100;
}

/** Retorno % entre o primeiro e o último ponto de uma série de níveis. */
export function retornoDePontos(pontos = []) {
  if (!pontos || pontos.length < 2) return null;
  const primeiro = Number(pontos[0]);
  const ultimo = Number(pontos[pontos.length - 1]);
  if (!Number.isFinite(primeiro) || primeiro <= 0 || !Number.isFinite(ultimo)) return null;
  return (ultimo / primeiro - 1) * 100;
}

async function sgs(serie, ultimos) {
  const r = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/${ultimos}?formato=json`);
  if (!r.ok) throw new Error(`BCB SGS ${serie}: HTTP ${r.status}`);
  return r.json(); // [{ data: "DD/MM/YYYY", valor: "1.23" }]
}

/**
 * CDI, IPCA e IBOV acumulados dos últimos 12 meses (%), com cache de 12h.
 * Cada série falha de forma independente (fica null) — sem derrubar as outras.
 * @returns {{ fetchedAt:number, cdi12m:number|null, ipca12m:number|null, ibov12m:number|null }}
 */
export async function buscarBenchmarks12m({ force = false } = {}) {
  if (!force) {
    try {
      const c = JSON.parse(localStorage.getItem(KEY_CACHE) || "null");
      if (c && Date.now() - c.fetchedAt < TTL_MS) return c;
    } catch {}
  }
  const [cdi, ipca, ibov] = await Promise.allSettled([
    sgs(4391, 12),
    sgs(433, 12),
    sgs(7, 253), // ~1 ano de pregões
  ]);
  const out = {
    fetchedAt: Date.now(),
    cdi12m: cdi.status === "fulfilled" ? acumularMensais(cdi.value.map((x) => x.valor)) : null,
    ipca12m: ipca.status === "fulfilled" ? acumularMensais(ipca.value.map((x) => x.valor)) : null,
    ibov12m: ibov.status === "fulfilled" ? retornoDePontos(ibov.value.map((x) => x.valor)) : null,
  };
  try { localStorage.setItem(KEY_CACHE, JSON.stringify(out)); } catch {}
  return out;
}
