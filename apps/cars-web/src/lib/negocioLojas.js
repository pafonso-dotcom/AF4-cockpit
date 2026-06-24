// Helpers puros do "financeiro por loja" do Negócio.
import { uid } from "./format.js";

export const LOJA_TODAS = "todas";

const soma = (arr, sel = (x) => x.valor) =>
  (Array.isArray(arr) ? arr : []).reduce((s, x) => s + (Number(sel(x)) || 0), 0);

/** Itens da loja ativa (ou todos quando "todas"). */
export function filtrarPorLoja(itens, lojaAtiva) {
  const arr = Array.isArray(itens) ? itens : [];
  if (lojaAtiva === LOJA_TODAS) return arr;
  return arr.filter((i) => i.lojaId === lojaAtiva);
}

/** Totais financeiros de uma loja (ou consolidado quando "todas"). */
export function resumoLoja({ contas = [], despesasFixas = [], despesasVar = [], recebimentos = [] } = {}, lojaAtiva) {
  const f = (arr) => filtrarPorLoja(arr, lojaAtiva);
  const saldoBanco = soma(f(contas), (c) => c.saldo);
  const dFixas = soma(f(despesasFixas));
  const dVar = soma(f(despesasVar));
  const receb = soma(f(recebimentos));
  return {
    saldoBanco,
    despesasFixas: dFixas,
    despesasVar: dVar,
    recebimentos: receb,
    resultado: +(receb - (dFixas + dVar)).toFixed(2),
  };
}

/** Migração: garante ≥1 loja e atribui lojaId aos itens financeiros sem. */
export function migrarNegocioLojas(data = {}) {
  let negocioLojas = Array.isArray(data.negocioLojas) ? data.negocioLojas : [];
  if (negocioLojas.length === 0) negocioLojas = [{ id: uid(), nome: "Loja 1" }];
  const padrao = negocioLojas[0].id;
  const negocioLojaAtiva = data.negocioLojaAtiva || padrao;
  const comLoja = (arr) =>
    (Array.isArray(arr) ? arr : []).map((i) => (i.lojaId ? i : { ...i, lojaId: padrao }));
  return {
    negocioLojas,
    negocioLojaAtiva,
    negocioFinContas: comLoja(data.negocioFinContas),
    negocioFinDespesasFixas: comLoja(data.negocioFinDespesasFixas),
    negocioFinDespesasVar: comLoja(data.negocioFinDespesasVar),
    negocioRecebimentos: comLoja(data.negocioRecebimentos),
  };
}
