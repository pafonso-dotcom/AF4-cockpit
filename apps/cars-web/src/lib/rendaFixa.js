// Renda fixa — projeção de rendimento MENSAL a partir do indexador + taxa
// contratada do ativo (ex.: 104,5% do CDI, Selic + 0,07%) e das taxas mensais
// atuais (CDI/Selic/IPCA acumulados no mês, vindos do BCB).
//
// Modelo esperado no ativo (campos opcionais, preenchidos no cadastro):
//   { tipo: "cdb" | "tesouro", rfIndexador: "cdi"|"selic"|"ipca"|"pre",
//     rfTaxa: <número> }  // % do CDI, ou spread a.a., ou taxa prefixada a.a.

// Indexadores suportados + rótulo/placeholder do campo de taxa no formulário.
export const RF_INDEXADORES = [
  { v: "cdi",   l: "% do CDI",        campo: "% do CDI (ex.: 104,5)",  sufixo: "% CDI" },
  { v: "selic", l: "Selic + (a.a.)",  campo: "Spread a.a. (ex.: 0,07)", sufixo: "" },
  { v: "ipca",  l: "IPCA + (a.a.)",   campo: "Spread a.a. (ex.: 5,5)",  sufixo: "" },
  { v: "pre",   l: "Prefixado (a.a.)", campo: "Taxa a.a. (ex.: 11)",    sufixo: "" },
];

// Ativo de renda fixa que aceita o cálculo por taxa contratada?
export function ehRendaFixa(ativo) {
  return ["cdb", "tesouro", "rf"].includes(String(ativo?.tipo || "").toLowerCase());
}

// Lê a taxa aceitando número ou string (com vírgula pt-BR, ex.: "104,5").
export function parseTaxaRF(v) {
  if (typeof v === "number") return v;
  if (v == null || v === "") return NaN;
  return parseFloat(String(v).trim().replace(/\s/g, "").replace(",", "."));
}

// Tem indexador + taxa preenchidos (dá pra projetar)?
export function temTaxaRF(ativo) {
  return ehRendaFixa(ativo) && !!ativo?.rfIndexador && Number.isFinite(parseTaxaRF(ativo?.rfTaxa));
}

// Rótulo curto da taxa: "104,5% CDI", "Selic + 0,07%", "IPCA + 5,5%", "Pré 11%".
export function rotuloTaxaRF(ativo) {
  const idx = ativo?.rfIndexador;
  const taxa = parseTaxaRF(ativo?.rfTaxa);
  if (!idx || !Number.isFinite(taxa)) return null;
  const n = taxa.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  if (idx === "cdi")   return `${n}% CDI`;
  if (idx === "selic") return `Selic + ${n}%`;
  if (idx === "ipca")  return `IPCA + ${n}%`;
  if (idx === "pre")   return `Pré ${n}%`;
  return null;
}

// a.a. → a.m. (juros compostos): (1+aa)^(1/12) − 1, em %.
function anualParaMensal(aaPct) {
  return (Math.pow(1 + aaPct / 100, 1 / 12) - 1) * 100;
}

// Taxa MENSAL (%) projetada do ativo, dadas as taxas mensais atuais (%):
// cdiMes/selicMes/ipcaMes = acumulado do mês (% a.m.) do BCB.
export function taxaMensalRF(ativo, { cdiMes = 0, selicMes = 0, ipcaMes = 0 } = {}) {
  const idx = ativo?.rfIndexador;
  const taxa = parseTaxaRF(ativo?.rfTaxa);
  if (!idx || !Number.isFinite(taxa)) return null;
  if (idx === "cdi")   return cdiMes * (taxa / 100);       // ex.: 0,836% × 1,045
  if (idx === "selic") return selicMes + anualParaMensal(taxa); // Selic + spread
  if (idx === "ipca")  return ipcaMes + anualParaMensal(taxa);  // IPCA + spread
  if (idx === "pre")   return anualParaMensal(taxa);       // prefixado a.a. → a.m.
  return null;
}

// Valor investido base = valor de mercado atual (qtd × preço; cai no PM se não
// houver preço atual). Para CDB/Tesouro do app, qtd costuma ser 1 e o preço é o
// valor da aplicação.
export function valorBaseRF(ativo) {
  const qtd = Number(ativo?.qtd) || 0;
  const preco = Number(ativo?.preco) || Number(ativo?.pm) || 0;
  return qtd * preco;
}

// Rendimento previsto no mês (R$) do ativo. null se não dá pra projetar.
export function rendimentoMesRF(ativo, taxas = {}) {
  if (!temTaxaRF(ativo)) return null;
  const tm = taxaMensalRF(ativo, taxas);
  if (tm == null) return null;
  return valorBaseRF(ativo) * (tm / 100);
}

// Resumo de TODOS os ativos de renda fixa (CDB/Tesouro/RF): lista + total do
// mês. Ativos sem indexador+taxa entram com temTaxa=false (aparecem na tela com
// aviso "definir taxa"), mas não somam no total.
export function resumoRendaFixa(ativos = [], taxas = {}) {
  const itens = (ativos || [])
    .filter(ehRendaFixa)
    .map((a) => {
      const comTaxa = temTaxaRF(a);
      return {
        id: a.id,
        ticker: a.ticker,
        temTaxa: comTaxa,
        rotulo: comTaxa ? rotuloTaxaRF(a) : null,
        base: valorBaseRF(a),
        taxaMes: comTaxa ? taxaMensalRF(a, taxas) : null,
        rendimentoMes: comTaxa ? rendimentoMesRF(a, taxas) : null,
      };
    })
    .sort((a, b) => (b.rendimentoMes || 0) - (a.rendimentoMes || 0));
  const comTaxa = itens.filter((i) => i.temTaxa);
  const totalMes = comTaxa.reduce((s, i) => s + (i.rendimentoMes || 0), 0);
  const totalBase = comTaxa.reduce((s, i) => s + (i.base || 0), 0);
  return { itens, totalMes, totalBase };
}
