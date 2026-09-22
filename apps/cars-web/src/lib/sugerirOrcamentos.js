/* ============================================================
   SUGERIR ORÇAMENTOS · limite automático pelas médias reais

   Olha o consumo dos últimos meses (base unificada: bancos +
   cartões, filha somada na mãe) e sugere um orçamento por
   categoria-raiz de despesa: a MÉDIA dos meses com gasto,
   arredondada pra cima em degraus redondos (10/50/100).
   O usuário revisa/edita e aplica — nada é gravado sem confirmar.
   ============================================================ */

// Arredonda pra cima em degraus que ficam bonitos no orçamento.
export function degrauOrcamento(v) {
  if (!(v > 0)) return 0;
  const passo = v <= 200 ? 10 : v <= 1000 ? 50 : 100;
  return Math.ceil(v / passo) * passo;
}

/**
 * @param categorias  cadastro completo (usa parentId pra rolar filha na mãe)
 * @param mesesItens  array de MESES, cada um a lista de itens de consumo
 *                    (itensConsumoDoMes) — ex.: [mêsAtual, mês-1, mês-2]
 * @returns [{ id, nome, media, sugestao, atual, meses }] ordenado por média desc
 */
export function sugerirOrcamentos({ categorias = [], mesesItens = [] } = {}) {
  const catPorId = {};
  (categorias || []).forEach(c => { if (c?.id) catPorId[c.id] = c; });
  const paiDe = {};
  (categorias || []).forEach(c => {
    if (c?.parentId && catPorId[c.parentId]) paiDe[(c.nome || "").trim()] = (catPorId[c.parentId].nome || "").trim();
  });

  const porMes = (mesesItens || []).map(itens => {
    const m = {};
    (itens || []).forEach(d => {
      const k0 = String(d?.categoria || "").trim() || "Outros";
      const k = paiDe[k0] || k0;
      m[k] = (m[k] || 0) + (Number(d?.valor) || 0);
    });
    return m;
  });

  const raizes = (categorias || []).filter(c => c && !c.parentId && c.tipo === "despesa");
  const out = [];
  for (const c of raizes) {
    // Média só dos meses em que a categoria teve gasto — dados esparsos
    // (conta anual, começou a usar mês passado) não puxam a média pra baixo.
    const vals = porMes.map(m => m[(c.nome || "").trim()] || 0).filter(v => v > 0);
    if (!vals.length) continue;
    const media = vals.reduce((s, v) => s + v, 0) / vals.length;
    out.push({
      id: c.id, nome: c.nome, media,
      sugestao: degrauOrcamento(media),
      atual: Number(c.limite) > 0 ? Number(c.limite) : null,
      meses: vals.length,
    });
  }
  return out.sort((a, b) => b.media - a.media);
}
