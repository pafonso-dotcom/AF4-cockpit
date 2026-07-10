// Taxas do Banco Central via API SGS (api.bcb.gov.br) — pública, sem chave,
// CORS liberado. Usada pra projetar o rendimento de renda fixa (CDI/Tesouro).
//   série 4391 = CDI acumulado no mês (% a.m.)
//   série 4390 = Selic acumulada no mês (% a.m.)
//   série  433 = IPCA variação mensal (% a.m.)
// Cache em localStorage com TTL de 12h.

const KEY_TAXAS_MES = "aureus:bcb-taxas-mensais:v1";
const TTL_MS = 12 * 60 * 60 * 1000;

async function sgs(serie, ultimos) {
  const r = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/${ultimos}?formato=json`);
  if (!r.ok) throw new Error(`BCB SGS ${serie}: HTTP ${r.status}`);
  return r.json(); // [{ data: "DD/MM/YYYY", valor: "1.23" }]
}

/**
 * Últimas taxas MENSAIS (acumulado no mês, % a.m.) de CDI, Selic e IPCA,
 * usando o ÚLTIMO MÊS FECHADO — a série "acumulado no mês" traz o mês corrente
 * com valor PARCIAL (o mês ainda não terminou), o que subestimaria a projeção.
 * As datas vêm como "DD/MM/YYYY" (1º dia do mês-ref). Cache de 12h.
 * @returns {{ fetchedAt:number, cdiMes:number|null, selicMes:number|null, ipcaMes:number|null }}
 */
export async function buscarTaxasMensais({ force = false } = {}) {
  if (!force) {
    try {
      const c = JSON.parse(localStorage.getItem(KEY_TAXAS_MES) || "null");
      if (c && Date.now() - c.fetchedAt < TTL_MS) return c;
    } catch {}
  }
  const [cdi, selic, ipca] = await Promise.allSettled([
    sgs(4391, 3),
    sgs(4390, 3),
    sgs(433, 3),
  ]);
  const agora = new Date();
  const mmAtual = `${String(agora.getMonth() + 1).padStart(2, "0")}/${agora.getFullYear()}`;
  const ultFechado = (r) => {
    if (r.status !== "fulfilled" || !r.value?.length) return null;
    const pts = r.value;
    const fechados = pts.filter((p) => (p.data || "").slice(3) !== mmAtual);
    const alvo = fechados.length ? fechados : pts;
    return Number(alvo[alvo.length - 1].valor);
  };
  const out = {
    fetchedAt: Date.now(),
    cdiMes: ultFechado(cdi),
    selicMes: ultFechado(selic),
    ipcaMes: ultFechado(ipca),
  };
  try { localStorage.setItem(KEY_TAXAS_MES, JSON.stringify(out)); } catch {}
  return out;
}
