/* ============================================================
   BOLÃO · grupo de pessoas dividindo apostas e prêmios
   ─────────────────────────────────────────────────────────────
   Modelo:
     { id, nome, concursoAlvo, jogos[15][], participantes[],
       estrategia, custoTotal, criadoEm, status, resultado? }
   Participante:
     { id, nome, cotas, valorPago }

   Persistência:
     - Supabase: tabela lf_bolao (jsonb pra jogos/participantes)
     - Fallback localStorage: chave "lotoai:boloes"
   ============================================================ */

import { LOTOFACIL, contarAcertos } from "./lotofacil.js";
import { supabase } from "./supabase.js";

const KEY = "lotoai:boloes";
const PREMIO_MEDIO = { 11: 6, 12: 12, 13: 30, 14: 2000, 15: 1500000 };

const uid = () => {
  try { return crypto.randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
};

/* ---------- CRUD local ---------- */

function lerLocal() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}

function escreverLocal(boloes) {
  localStorage.setItem(KEY, JSON.stringify(boloes));
}

export async function listarBoloes() {
  if (supabase) {
    const { data, error } = await supabase
      .from("lf_bolao")
      .select("*")
      .order("criado_em", { ascending: false });
    if (!error && data) return data.map(deserializeRemote);
  }
  return lerLocal().sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""));
}

export async function salvarBolao(bolao) {
  bolao = { ...bolao, id: bolao.id || uid() };
  if (supabase) {
    const { error } = await supabase.from("lf_bolao").upsert(serializeRemote(bolao));
    if (!error) return bolao;
  }
  const lista = lerLocal();
  const idx = lista.findIndex(b => b.id === bolao.id);
  if (idx >= 0) lista[idx] = bolao; else lista.push(bolao);
  escreverLocal(lista);
  return bolao;
}

export async function removerBolao(id) {
  if (supabase) {
    const { error } = await supabase.from("lf_bolao").delete().eq("id", id);
    if (!error) return true;
  }
  escreverLocal(lerLocal().filter(b => b.id !== id));
  return true;
}

function serializeRemote(b) {
  return {
    id: b.id,
    nome: b.nome,
    concurso_alvo: b.concursoAlvo,
    jogos: b.jogos,
    participantes: b.participantes,
    estrategia: b.estrategia,
    custo_total: b.custoTotal,
    status: b.status,
    resultado: b.resultado || null,
    criado_em: b.criadoEm,
  };
}
function deserializeRemote(r) {
  return {
    id: r.id,
    nome: r.nome,
    concursoAlvo: r.concurso_alvo,
    jogos: r.jogos || [],
    participantes: r.participantes || [],
    estrategia: r.estrategia,
    custoTotal: Number(r.custo_total) || 0,
    status: r.status || "ativo",
    resultado: r.resultado,
    criadoEm: r.criado_em,
  };
}

/* ---------- Cálculos ---------- */

/** Custo total = apostas × preço unitário */
export function calcularCusto(jogos) {
  return +(jogos.length * LOTOFACIL.precoAposta).toFixed(2);
}

/** Total de cotas e custo por cota */
export function calcularCotas(participantes) {
  const totalCotas = participantes.reduce((a, p) => a + (Number(p.cotas) || 0), 0);
  return { totalCotas };
}

/** Aplica o sorteio sobre todos os jogos e calcula a distribuição entre participantes */
export function conferirBolao(bolao, sorteio) {
  const pontos = bolao.jogos.map(j => contarAcertos(j, sorteio));
  const dist = { 15: 0, 14: 0, 13: 0, 12: 0, 11: 0 };
  let premioTotal = 0;
  for (const p of pontos) {
    if (p in dist) {
      dist[p]++;
      premioTotal += PREMIO_MEDIO[p];
    }
  }
  const melhor = pontos.length ? Math.max(...pontos) : 0;

  const { totalCotas } = calcularCotas(bolao.participantes);
  const premioPorCota = totalCotas ? premioTotal / totalCotas : 0;
  const custoPorCota = totalCotas ? bolao.custoTotal / totalCotas : 0;

  const distribuicao = bolao.participantes.map(p => {
    const valor = +(p.cotas * premioPorCota).toFixed(2);
    const custo = +(p.cotas * custoPorCota).toFixed(2);
    return {
      id: p.id,
      nome: p.nome,
      cotas: p.cotas,
      custo,
      premio: valor,
      lucro: +(valor - custo).toFixed(2),
    };
  });

  return {
    pontos,
    melhor,
    dist,
    premioTotal: +premioTotal.toFixed(2),
    custoPorCota: +custoPorCota.toFixed(2),
    premioPorCota: +premioPorCota.toFixed(2),
    distribuicao,
    premiavel: melhor >= 11,
  };
}

/** Constrói um bolão novo a partir dos jogos gerados + participantes */
export function montarBolao({ nome, concursoAlvo, jogos, participantes, estrategia = "ponderado" }) {
  return {
    id: uid(),
    nome: nome?.trim() || "Bolão sem nome",
    concursoAlvo: concursoAlvo || null,
    jogos,
    participantes: participantes.map(p => ({
      id: p.id || uid(),
      nome: p.nome?.trim() || "Anônimo",
      cotas: Math.max(1, Math.floor(Number(p.cotas) || 1)),
      valorPago: Number(p.valorPago) || 0,
    })),
    estrategia,
    custoTotal: calcularCusto(jogos),
    status: "ativo",
    criadoEm: new Date().toISOString(),
  };
}
