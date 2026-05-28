/* ============================================================
   RECORRÊNCIA · gera projeções de transações fixas
   Uso: const projecoes = projectFixas(transacoes, "2026-05");
   Retorna array de transações sintéticas que NÃO foram criadas ainda,
   marcadas com flag `projetada: true` (não persistem).
   ============================================================ */

import { uid } from "./format.js";

/**
 * Para cada transação `t.fixa === true` com `t.vencimento` (dia do mês 1-31):
 * Se já existe uma transação no mês alvo com a mesma descrição e fixa=true,
 * pula. Senão, projeta uma cópia para o mês alvo com data = vencimento.
 *
 * @param {Array} transacoes — lista atual
 * @param {string} mes — formato "YYYY-MM"
 * @returns {Array} transações projetadas (sintéticas, com projetada: true)
 */
export const projectFixas = (transacoes, mes) => {
  if (!Array.isArray(transacoes) || !mes) return [];
  const [year, month] = mes.split("-").map(Number);
  if (!year || !month) return [];

  const lastDayOfMonth = new Date(year, month, 0).getDate();
  const projecoes = [];

  for (const t of transacoes) {
    if (!t.fixa || !t.vencimento) continue;
    const dia = Math.min(parseInt(t.vencimento), lastDayOfMonth);
    const data = `${year}-${String(month).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

    // Já existe nesse mês uma transação fixa com a mesma descrição?
    const existe = transacoes.some(x =>
      x.fixa && x.descricao === t.descricao &&
      x.data && x.data.startsWith(`${year}-${String(month).padStart(2, "0")}`)
    );
    if (existe) continue;

    projecoes.push({
      id: `proj-${t.id}-${mes}`,
      tipo: t.tipo,
      valor: t.valor,
      descricao: t.descricao,
      categoria: t.categoria,
      conta: t.conta,
      data,
      obs: `Projetada de transação fixa de ${t.data}`,
      fixa: true,
      vencimento: t.vencimento,
      compensado: false,
      projetada: true,
      sourceId: t.id,
    });
  }

  return projecoes;
};

/**
 * Materializa uma projeção: transforma em transação real e adiciona ao array.
 */
export const materializeProjecao = (projecao) => {
  const { projetada, sourceId, ...rest } = projecao;
  return { ...rest, id: uid() };
};

/**
 * Gera automaticamente instâncias PENDENTES das transações fixas para o mês corrente.
 * Diferente de `projectFixas`, estas são transações reais (persistem no estado).
 *
 * Regras:
 * - Considera fixas com `vencimento` (dia 1-31). Sem vencimento, usa o dia da `data` original.
 * - Dia limitado a 28 para evitar problemas em fevereiro.
 * - Não duplica: pula se já existe instância no mês com `recurringOf` apontando pra esta fixa,
 *   ou se a própria fixa tem `data` no mês corrente.
 * - Marca a instância gerada com `recurringOf: <id da fixa>`.
 *
 * @param transacoes lista atual
 * @param refDate data de referência (default = hoje)
 * @returns array das NOVAS transações a serem adicionadas (vazio se nada a fazer)
 */
export const generateRecurringForCurrentMonth = (transacoes, refDate = new Date()) => {
  if (!Array.isArray(transacoes)) return [];
  const y = refDate.getFullYear();
  const m = refDate.getMonth() + 1;
  const monthKey = `${y}-${String(m).padStart(2, "0")}`;

  // Fixas "originais": fixa = true E não é instância gerada automaticamente
  const fixas = transacoes.filter((t) => t.fixa && !t.recurringOf);
  const novas = [];

  for (const fixa of fixas) {
    // 1. Não duplicar: alguma instância já tem recurringOf === fixa.id neste mês?
    const jaExisteInstancia = transacoes.some(
      (t) => t.recurringOf === fixa.id && t.data?.startsWith(monthKey)
    );
    if (jaExisteInstancia) continue;

    // 2. Não gerar se a própria fixa já está no mês corrente
    if (fixa.data?.startsWith(monthKey)) continue;

    // 3. Determinar o dia do vencimento
    let dia;
    if (fixa.vencimento) {
      dia = parseInt(fixa.vencimento, 10);
    } else if (fixa.data) {
      dia = parseInt(fixa.data.slice(8, 10), 10);
    } else {
      dia = 1;
    }
    if (isNaN(dia) || dia < 1) dia = 1;
    if (dia > 28) dia = 28; // evita problema em fevereiro

    const dataNova = `${monthKey}-${String(dia).padStart(2, "0")}`;

    novas.push({
      ...fixa,
      id: uid(),
      data: dataNova,
      compensado: false,
      recurringOf: fixa.id,
      obs: fixa.obs
        ? `${fixa.obs} · gerada automaticamente`
        : `Gerada automaticamente da fixa "${fixa.descricao}"`,
    });
  }

  return novas;
};
