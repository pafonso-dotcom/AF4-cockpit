/* ============================================================
   Importa concursos novos da Caixa via worker proxy
   - Tenta o worker (mesma origem, com CORS já configurado)
   - Em dev/local, aceita VITE_LOTOFACIL_API como URL alternativa
   ============================================================ */

const API_BASE = import.meta.env.VITE_LOTOFACIL_API || "/api/lotofacil";

export async function buscarUltimoConcurso() {
  const res = await fetch(`${API_BASE}/latest`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return normaliza(await res.json());
}

export async function buscarConcurso(numero) {
  const res = await fetch(`${API_BASE}/${numero}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} para concurso #${numero}`);
  return normaliza(await res.json());
}

function normaliza(j) {
  return {
    numero: Number(j.numero),
    data: parseDataBR(j.data),
    dezenas: (j.dezenas || []).map(Number).sort((a, b) => a - b),
  };
}

function parseDataBR(d) {
  if (!d) return null;
  const m = String(d).match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (m) {
    const [, dd, mm, yy] = m;
    const y = yy.length === 2 ? `20${yy}` : yy;
    return `${y}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const iso = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : null;
}

/**
 * Importa todos os concursos do (ultimoLocal+1) até o mais recente.
 * @param {object[]} historicoAtual  lista já carregada (precisa do último numero)
 * @param {object} opts
 * @param {number} opts.max          limite duro (default 30 — não trava UI)
 * @param {(progresso: { atual, total, novos }) => void} opts.onProgresso
 * @returns {Promise<{ novos, ultimoRemoto, ultimoLocal }>}
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

  // o último já veio na primeira chamada
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
