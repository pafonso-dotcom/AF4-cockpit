// Diagnóstico de gastos do mês (determinístico, puro e testável).
//
// Compara os gastos por categoria do mês com a MÉDIA recente da própria pessoa
// (meses anteriores). Aponta o que fugiu do padrão e onde dá pra cortar.
//
// Entrada:
//   mesCats        { categoria: valor }        — totais do mês analisado
//   historicoCats  Array<{ categoria: valor }> — totais dos N meses anteriores
// Meses sem gasto numa categoria contam como 0 na média (é o "normal" dela).

const money = (v) => Number(v) || 0;

export function diagnosticoMes(mesCats = {}, historicoCats = [], opts = {}) {
  const minPct = opts.minPct ?? 15;      // % mínimo pra considerar "fora do padrão"
  const minValor = opts.minValor ?? 50;  // ignora categorias irrelevantes
  const nMeses = historicoCats.length;

  // Universo de categorias (mês + histórico)
  const todas = new Set(Object.keys(mesCats));
  historicoCats.forEach((m) => Object.keys(m || {}).forEach((k) => todas.add(k)));

  // Média por categoria (0 nos meses sem gasto)
  const media = {};
  todas.forEach((cat) => {
    const soma = historicoCats.reduce((s, m) => s + money(m && m[cat]), 0);
    media[cat] = nMeses > 0 ? soma / nMeses : 0;
  });

  const itens = [];
  todas.forEach((cat) => {
    const valor = money(mesCats[cat]);
    const med = media[cat] || 0;
    if (valor < minValor && med < minValor) return; // irrelevante
    const delta = valor - med;
    const pct = med > 0 ? (delta / med) * 100 : (valor > 0 ? Infinity : 0);
    // "novo pico": categoria que quase não tinha média e disparou neste mês.
    const novoPico = med < Math.max(minValor, valor * 0.15) && valor >= minValor && delta > 0;
    let estado = "flat";
    if (novoPico) estado = "pico";
    else if (pct >= minPct) estado = "acima";
    else if (pct <= -minPct) estado = "abaixo";
    itens.push({ categoria: cat, valor, media: med, delta, pct, estado, novoPico });
  });

  const totalMes = Object.values(mesCats).reduce((s, v) => s + money(v), 0);
  const totalMedia = Object.values(media).reduce((s, v) => s + v, 0);
  const deltaTotal = totalMes - totalMedia;
  const pctTotal = totalMedia > 0 ? (deltaTotal / totalMedia) * 100 : null;

  const foraDoPadrao = itens
    .filter((i) => i.estado !== "flat")
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const maiorAlta = itens
    .filter((i) => i.delta > 0)
    .sort((a, b) => b.delta - a.delta)[0] || null;

  // Sugestões de corte: categorias acima/pico, economia = excesso sobre a média.
  const cortes = itens
    .filter((i) => i.delta > 0 && (i.estado === "acima" || i.estado === "pico"))
    .map((i) => ({
      categoria: i.categoria,
      valor: i.valor,
      alvo: i.media,
      economia: i.delta,
      pico: i.estado === "pico",
    }))
    .sort((a, b) => b.economia - a.economia);

  const potencialTotal = cortes.reduce((s, c) => s + c.economia, 0);

  return {
    nMeses, totalMes, totalMedia, deltaTotal, pctTotal,
    maiorAlta, foraDoPadrao, cortes, potencialTotal,
  };
}

// Prompt pra IA aprofundar o diagnóstico (usa a chave Anthropic do usuário).
// Envia só números por categoria — nada de dado pessoal identificável.
export function promptDiagnostico(diag = {}, mesLabel = "") {
  const brl = (v) => `R$ ${Math.round(Number(v) || 0).toLocaleString("pt-BR")}`;
  const L = [];
  L.push("Você é um consultor financeiro pessoal. Com base APENAS nos dados abaixo, escreva um diagnóstico curto (português do Brasil, 4 a 6 frases, tom direto e amigável) do mês de gastos do usuário: o que fugiu do normal, se algum pico parece pontual, e 1 ou 2 sugestões concretas de corte. Não invente números além dos fornecidos. No máximo 1 emoji. Sem markdown de título.");
  L.push("");
  L.push(`Mês: ${mesLabel || "—"}`);
  L.push(`Gasto do mês: ${brl(diag.totalMes)} · média recente (${diag.nMeses} meses): ${brl(diag.totalMedia)}`);
  if (diag.pctTotal != null) L.push(`Variação vs média: ${diag.pctTotal >= 0 ? "+" : ""}${diag.pctTotal.toFixed(0)}%`);
  if (diag.foraDoPadrao?.length) {
    L.push("Categorias fora do padrão (mês vs média):");
    diag.foraDoPadrao.slice(0, 6).forEach((i) => {
      const tag = i.estado === "pico" ? "novo pico" : i.estado === "acima" ? "acima" : "abaixo";
      L.push(`- ${i.categoria}: ${brl(i.valor)} vs ${brl(i.media)} (${tag})`);
    });
  }
  if (diag.cortes?.length) {
    L.push(`Potencial de corte voltando à média: ${brl(diag.potencialTotal)}/mês.`);
  }
  return L.join("\n");
}
