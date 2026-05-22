// Metodologia Investidor de Verdade (IdV) — critérios por classe.
// fonte: "planilha" (import Excel) | "manual" (você preenche) | "auto" (BRAPI, futuro)

export const CRITERIOS_FII = [
  { id: "tipo",       label: "Tipo de FII",      fonte: "planilha", tipo: "opcao", grupo: "estrutura",
    opcoes: ["Tijolo", "Papel", "Híbrido", "Desenvolvimento", "FOF"],
    faixas: { bom: "Tijolo,Papel", aceitavel: "Híbrido", ruim: "Desenvolvimento,FOF" }, hint: "Tijolo/Papel é bom" },
  { id: "segmento",   label: "Segmento",         fonte: "planilha", tipo: "opcao", grupo: "estrutura",
    opcoes: ["Lajes Corporativas", "Logística", "Shoppings", "Títulos e Val. Mob.", "Residencial", "Outros", "Hospital", "Hotel"],
    faixas: { bom: "Lajes Corporativas,Logística,Shoppings,Títulos e Val. Mob.", aceitavel: "Residencial,Outros", ruim: "Hospital,Hotel" }, hint: "Lajes/Log/Shopping/TVM é bom" },
  { id: "ipo",        label: "Tempo listagem",   fonte: "planilha", tipo: "numero", grupo: "qualidade",
    faixas: { bom: ">=5", aceitavel: "3-5", ruim: "<3" }, hint: "≥5 anos é bom", unidade: "anos" },
  { id: "patrimonio", label: "Patrimônio Líquido", fonte: "planilha", tipo: "numero", grupo: "escala",
    faixas: { bom: ">=1", aceitavel: "0.5-1", ruim: "<0.5" }, hint: "≥1 Bi é bom", unidade: "Bi" },
  { id: "administrador", label: "Administrador", fonte: "planilha", tipo: "texto", grupo: "escala",
    faixas: {}, hint: "conforme ranking" },
  { id: "dy",         label: "DY 12M",           fonte: "planilha", tipo: "percent", grupo: "retorno",
    faixas: { bom: ">=9", aceitavel: "7-9", ruim: "<7" }, hint: "≥9% é bom" },
];

export const CRITERIOS_ACOES = [
  { id: "ipo", label: "IPO (anos)", fonte: "manual", tipo: "numero", grupo: "eliminatorio",
    faixas: { bom: ">=10", aceitavel: "6-10", ruim: "<6" }, hint: "≥10 anos é bom", unidade: "anos" },
  { id: "lucro", label: "Anos de lucro", fonte: "manual", tipo: "numero", grupo: "eliminatorio",
    faixas: { bom: ">=15", aceitavel: "10-14", ruim: "<10" }, hint: "≥15 anos é bom", unidade: "anos" },
  { id: "tipo", label: "Tipo de ação", fonte: "manual", tipo: "opcao", grupo: "eliminatorio",
    opcoes: ["ON", "PN", "Unit"], faixas: { bom: "ON", ruim: "PN,Unit" }, hint: "ON (cód 3) é bom" },
  { id: "tagalong", label: "Tag Along", fonte: "manual", tipo: "opcao", grupo: "eliminatorio",
    opcoes: ["100%", "80%", "<80%"], faixas: { bom: "100%", aceitavel: "80%", ruim: "<80%" }, hint: "100% é bom" },
  { id: "freefloat", label: "Free Float", fonte: "manual", tipo: "percent", grupo: "eliminatorio",
    faixas: { bom: ">35", aceitavel: "15-35", ruim: "<15" }, hint: ">35% é bom" },
  { id: "socio", label: "Sócio majoritário", fonte: "manual", tipo: "opcao", grupo: "eliminatorio",
    opcoes: ["Instituição Privada", "Governo"], faixas: { bom: "Instituição Privada", ruim: "Governo" }, hint: "Privada é bom" },
  { id: "segmento", label: "Segmento Listagem", fonte: "manual", tipo: "opcao", grupo: "eliminatorio",
    opcoes: ["Novo Mercado", "Nível 2", "Nível 1", "Tradicional"], faixas: { bom: "Novo Mercado", aceitavel: "Nível 2,Nível 1,Tradicional" }, hint: "Novo Mercado é bom" },
  { id: "dividaEbitda", label: "Dívida Líq./EBITDA", fonte: "manual", tipo: "numero", grupo: "eliminatorio",
    faixas: { bom: "<3", aceitavel: "3-4", ruim: ">4" }, hint: "<3 é bom" },
  { id: "roe", label: "ROE / ROIC", fonte: "manual", tipo: "percent", grupo: "classificatorio",
    faixas: { bom: ">=10", ruim: "<10" }, hint: "≥10% é bom" },
  { id: "pl", label: "Patrimônio Líquido", fonte: "manual", tipo: "numero", grupo: "classificatorio",
    faixas: { bom: ">=1", ruim: "<1" }, hint: "≥1 Bi é bom", unidade: "Bi" },
  { id: "liquidez", label: "Liquidez diária", fonte: "manual", tipo: "numero", grupo: "classificatorio",
    faixas: { bom: ">=10", ruim: "<10" }, hint: "≥10 M é bom", unidade: "M" },
  { id: "margemLiq", label: "Margem Líquida", fonte: "manual", tipo: "percent", grupo: "classificatorio",
    faixas: { bom: ">=4", ruim: "<4" }, hint: "≥4% é bom" },
  { id: "margemEbit", label: "Margem EBIT", fonte: "manual", tipo: "percent", grupo: "classificatorio",
    faixas: { bom: ">=4", ruim: "<4" }, hint: "≥4% é bom" },
];

export const CRITERIOS_STOCK = [
  { id: "lucro", label: "Anos sem prejuízo", fonte: "manual", tipo: "numero", grupo: "resultado",
    faixas: { bom: ">=14", aceitavel: "10-13", ruim: "<10" }, hint: "≥14 anos é esperado", unidade: "anos" },
  { id: "lpa", label: "Cresc. LPA 5 anos", fonte: "manual", tipo: "percent", grupo: "resultado",
    faixas: { bom: ">=10", aceitavel: "2-9", ruim: "<2" }, hint: "≥10% é esperado" },
  { id: "dividaEbitda", label: "Dívida Líq./EBITDA", fonte: "manual", tipo: "numero", grupo: "risco",
    faixas: { bom: "<=5", aceitavel: "5.1-6", ruim: ">6" }, hint: "≤5 é esperado" },
  { id: "roe", label: "ROE", fonte: "manual", tipo: "percent", grupo: "retorno",
    faixas: { bom: ">=10", ruim: "<10" }, hint: "≥10% é esperado" },
  { id: "roic", label: "ROIC", fonte: "manual", tipo: "percent", grupo: "retorno",
    faixas: { bom: ">=4", ruim: "<4" }, hint: "≥4% é esperado" },
  { id: "margemLiq", label: "Margem Líquida", fonte: "manual", tipo: "percent", grupo: "retorno",
    faixas: { bom: ">=7", ruim: "<7" }, hint: "≥7% é esperado" },
  { id: "margemEbit", label: "Margem EBIT", fonte: "manual", tipo: "percent", grupo: "retorno",
    faixas: { bom: ">=7", ruim: "<7" }, hint: "≥7% é esperado" },
  { id: "ipo", label: "IPO (anos)", fonte: "manual", tipo: "numero", grupo: "sociedade",
    faixas: { bom: ">=14", aceitavel: "10-13", ruim: "<10" }, hint: "≥14 anos é esperado", unidade: "anos" },
  { id: "sharpe", label: "Índice Sharpe", fonte: "manual", tipo: "numero", grupo: "sociedade",
    faixas: { bom: ">=0.5", aceitavel: "0.2-0.4", ruim: "<0.2" }, hint: "≥0,5 é esperado" },
];

export const CRITERIOS_REIT = [
  { id: "lucro", label: "Anos sem prejuízo", fonte: "manual", tipo: "numero", grupo: "resultado",
    faixas: { bom: ">=10", aceitavel: "7-10", ruim: "<7" }, hint: "≥10 anos é esperado", unidade: "anos" },
  { id: "lpa", label: "Cresc. LPA 5 anos", fonte: "manual", tipo: "percent", grupo: "resultado",
    faixas: { bom: ">=4", aceitavel: "2-3", ruim: "<2" }, hint: "≥4% é esperado" },
  { id: "dividaEbitda", label: "Dívida Líq./EBITDA", fonte: "manual", tipo: "numero", grupo: "risco",
    faixas: { bom: "<=6.5", aceitavel: "6.6-9", ruim: ">9" }, hint: "≤6,5 é esperado" },
  { id: "roe", label: "ROE", fonte: "manual", tipo: "percent", grupo: "retorno",
    faixas: { bom: ">=5", ruim: "<5" }, hint: "≥5% é esperado" },
  { id: "margemLiq", label: "Margem Líquida", fonte: "manual", tipo: "percent", grupo: "retorno",
    faixas: { bom: ">=10", ruim: "<10" }, hint: "≥10% é esperado" },
  { id: "margemEbit", label: "Margem EBIT", fonte: "manual", tipo: "percent", grupo: "retorno",
    faixas: { bom: ">=10", ruim: "<10" }, hint: "≥10% é esperado" },
  { id: "ipo", label: "IPO (anos)", fonte: "manual", tipo: "numero", grupo: "sociedade",
    faixas: { bom: ">=10", aceitavel: "7-10", ruim: "<7" }, hint: "≥10 anos é esperado", unidade: "anos" },
];

export const CLASSES = [
  { id: "fii",   label: "FII",      icon: "🏢", criterios: CRITERIOS_FII },
  { id: "acao",  label: "Ação BR",  icon: "🇧🇷", criterios: CRITERIOS_ACOES },
  { id: "stock", label: "Stock US", icon: "🇺🇸", criterios: CRITERIOS_STOCK },
  { id: "reit",  label: "REIT US",  icon: "🏘", criterios: CRITERIOS_REIT },
];

/** Avalia um valor contra as faixas do critério. Retorna "bom"|"aceitavel"|"ruim"|"vazio". */
export function avaliarCriterio(criterio, valor) {
  if (valor === null || valor === undefined || valor === "") return "vazio";
  if (criterio.tipo === "opcao") {
    const v = String(valor).trim();
    if (criterio.faixas.bom && criterio.faixas.bom.split(",").includes(v)) return "bom";
    if (criterio.faixas.aceitavel && criterio.faixas.aceitavel.split(",").includes(v)) return "aceitavel";
    if (criterio.faixas.ruim && criterio.faixas.ruim.split(",").includes(v)) return "ruim";
    return "vazio";
  }
  if (criterio.tipo === "texto") return valor ? "bom" : "vazio";
  const n = parseFloat(String(valor).replace(",", ".").replace(/[^0-9.\-]/g, ""));
  if (isNaN(n)) return "vazio";
  const testa = (f) => {
    if (!f) return false;
    if (f.startsWith(">=")) return n >= parseFloat(f.slice(2));
    if (f.startsWith("<=")) return n <= parseFloat(f.slice(2));
    if (f.startsWith(">"))  return n > parseFloat(f.slice(1));
    if (f.startsWith("<"))  return n < parseFloat(f.slice(1));
    if (f.includes("-")) { const [lo, hi] = f.split("-").map(parseFloat); return n >= lo && n <= hi; }
    return false;
  };
  if (testa(criterio.faixas.bom)) return "bom";
  if (testa(criterio.faixas.aceitavel)) return "aceitavel";
  if (testa(criterio.faixas.ruim)) return "ruim";
  return "vazio";
}
