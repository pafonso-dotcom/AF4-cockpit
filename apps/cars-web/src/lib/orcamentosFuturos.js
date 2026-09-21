/* ============================================================
   ORÇAMENTOS DE COMPRAS FUTURAS · motor puro

   Cada item = { id, nome, valor, guardado, alvo:"AAAA-MM" }.
   A "calculadora": quantos meses faltam até o alvo e quanto
   guardar por mês pra chegar lá.
   ============================================================ */

/** Meses até o alvo (AAAA-MM), mínimo 1. null se alvo inválido. */
export function mesesAte(alvoYM, hoje = new Date()) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(alvoYM || ""));
  if (!m) return null;
  const diff = (Number(m[1]) - hoje.getFullYear()) * 12 + (Number(m[2]) - (hoje.getMonth() + 1));
  return Math.max(1, diff);
}

/** true quando o alvo já ficou pra trás. */
export function alvoPassado(alvoYM, hoje = new Date()) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(alvoYM || ""));
  if (!m) return false;
  const atual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  return String(alvoYM) < atual;
}

export function calcOrcamentoCompra(item, hoje = new Date()) {
  const valor = Math.max(0, Number(item?.valor) || 0);
  const guardado = Math.max(0, Number(item?.guardado) || 0);
  const falta = Math.max(0, +(valor - guardado).toFixed(2));
  const meses = mesesAte(item?.alvo, hoje) ?? 1;
  const porMes = +(falta / meses).toFixed(2);
  const pct = valor > 0 ? Math.min(100, (guardado / valor) * 100) : 0;
  return { valor, guardado, falta, meses, porMes, pct, passado: alvoPassado(item?.alvo, hoje) && falta > 0 };
}

export function resumoOrcamentos(itens = [], hoje = new Date()) {
  let totalValor = 0, totalGuardado = 0, totalFalta = 0, totalPorMes = 0;
  (itens || []).forEach(it => {
    const c = calcOrcamentoCompra(it, hoje);
    totalValor += c.valor; totalGuardado += c.guardado;
    totalFalta += c.falta; totalPorMes += c.falta > 0 ? c.porMes : 0;
  });
  return {
    qtd: (itens || []).length,
    totalValor: +totalValor.toFixed(2),
    totalGuardado: +totalGuardado.toFixed(2),
    totalFalta: +totalFalta.toFixed(2),
    totalPorMes: +totalPorMes.toFixed(2),
  };
}
