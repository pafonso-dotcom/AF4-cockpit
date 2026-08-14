/* ============================================================
   Importa concursos novos da Lotofácil
   ─────────────────────────────────────────────────────────────
   Tenta múltiplos endpoints em ordem até um responder:
     1. VITE_LOTOFACIL_API se definida (override do dev)
     2. Worker Cloudflare (af4cockpit) — nosso proxy oficial
     3. api.guidi.dev.br/loteria — mirror comunitário conhecido, CORS ok
     4. loteriascaixa-api.herokuapp.com — outro mirror, CORS ok
     5. /api/lotofacil (same-origin, se app + worker no mesmo domínio)
   Se todos falharem, propaga o erro do último tentado.
   ============================================================ */

const OVERRIDE = import.meta.env.VITE_LOTOFACIL_API;

const ENDPOINTS = [
  ...(OVERRIDE ? [{ nome: "override", latest: `${OVERRIDE}/latest`, byId: (n) => `${OVERRIDE}/${n}`, parse: parseNosso }] : []),
  {
    nome: "worker af4cockpit",
    latest: "https://af4cockpit.p-afonso.workers.dev/api/lotofacil/latest",
    byId:  (n) => `https://af4cockpit.p-afonso.workers.dev/api/lotofacil/${n}`,
    parse: parseNosso,
  },
  {
    nome: "guidi mirror",
    latest: "https://api.guidi.dev.br/loteria/lotofacil/ultimo",
    byId:  (n) => `https://api.guidi.dev.br/loteria/lotofacil/${n}`,
    parse: parseGuidi,
  },
  {
    nome: "heroku mirror",
    latest: "https://loteriascaixa-api.herokuapp.com/api/lotofacil/latest",
    byId:  (n) => `https://loteriascaixa-api.herokuapp.com/api/lotofacil/${n}`,
    parse: parseHeroku,
  },
  {
    nome: "same-origin",
    latest: "/api/lotofacil/latest",
    byId:  (n) => `/api/lotofacil/${n}`,
    parse: parseNosso,
  },
];

/** Nosso worker devolve { numero, data, dezenas, ... } */
function parseNosso(j) {
  if (!j || j.numero == null) return null;
  return {
    numero: Number(j.numero),
    data: parseDataBR(j.data || j.dataApuracao),
    dezenas: normalizaDezenas(j.dezenas || j.listaDezenas),
  };
}
/** guidi.dev.br devolve { concurso: { numero, data, dezenas } } ou plano */
function parseGuidi(j) {
  const c = j?.concurso || j;
  if (!c || (c.numero == null && c.concurso == null)) return null;
  return {
    numero: Number(c.numero ?? c.concurso),
    data: parseDataBR(c.data || c.dataApuracao),
    dezenas: normalizaDezenas(c.dezenas),
  };
}
/** heroku mirror devolve { concurso, data, dezenas } */
function parseHeroku(j) {
  if (!j || j.concurso == null) return null;
  return {
    numero: Number(j.concurso),
    data: parseDataBR(j.data),
    dezenas: normalizaDezenas(j.dezenas),
  };
}
function normalizaDezenas(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(Number).filter(n => n >= 1 && n <= 25).sort((a, b) => a - b);
}
function parseDataBR(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const m = String(d).match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (m) {
    const [, dd, mm, yy] = m;
    const y = yy.length === 2 ? `20${yy}` : yy;
    return `${y}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const iso = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}

/** Tenta cada endpoint em ordem até um responder com dados válidos */
async function tentarEndpoints(getUrl) {
  const erros = [];
  for (const ep of ENDPOINTS) {
    try {
      const res = await fetch(getUrl(ep), { headers: { Accept: "application/json" } });
      if (!res.ok) { erros.push(`${ep.nome}: HTTP ${res.status}`); continue; }
      const j = await res.json();
      const parsed = ep.parse(j);
      if (parsed && parsed.dezenas.length === 15) {
        console.log(`[import] ✓ via ${ep.nome} → #${parsed.numero}`);
        return parsed;
      }
      erros.push(`${ep.nome}: resposta malformada`);
    } catch (e) {
      erros.push(`${ep.nome}: ${e.message}`);
    }
  }
  throw new Error("Nenhum endpoint respondeu · " + erros.join(" · "));
}

export async function buscarUltimoConcurso() {
  return tentarEndpoints(ep => ep.latest);
}

export async function buscarConcurso(numero) {
  return tentarEndpoints(ep => ep.byId(numero));
}

/**
 * Importa todos os concursos do (ultimoLocal+1) até o mais recente.
 */
export async function importarNovos(historicoAtual, { max = 30, onProgresso } = {}) {
  const ultimoLocal = historicoAtual.length
    ? historicoAtual[historicoAtual.length - 1].numero
    : 0;

  const ultimoRemoto = await buscarUltimoConcurso();
  const inicio = ultimoLocal + 1;
  const fim = Math.min(ultimoRemoto.numero, ultimoLocal + max);

  if (inicio > ultimoRemoto.numero) {
    return { novos: [], ultimoRemoto, ultimoLocal };
  }

  const novos = [];
  const total = fim - inicio + 1;

  if (ultimoRemoto.numero >= inicio && ultimoRemoto.numero <= fim) {
    novos.push(ultimoRemoto);
    onProgresso?.({ atual: 1, total, novos: novos.length });
  }

  for (let n = inicio; n < fim; n++) {
    try {
      const c = await buscarConcurso(n);
      novos.push(c);
    } catch (e) {
      console.warn(`[import] falhou #${n}: ${e.message}`);
    }
    onProgresso?.({ atual: n - inicio + 1, total, novos: novos.length });
  }

  return { novos, ultimoRemoto, ultimoLocal };
}
