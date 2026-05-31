// Helpers do "CDB de meta" — quando o cofrinho de uma meta vira uma aplicação
// CDB de verdade no módulo Investimentos, rendendo a CDI automaticamente.
//
// Modelo do ativo CDB de meta (compatível com o resto do módulo Investimentos):
//   {
//     id, ticker: "CDB <meta>", nome, tipo: "cdb",
//     segmento: "Pós-fixado (CDI)",
//     qtd: 1,                 // 1 "cota" — o preço é o valor da aplicação
//     pm: <valor aplicado>,   // custo = quanto entrou (preço médio)
//     preco: <valor atual>,   // valor de mercado = aplicado capitalizado a CDI
//     _metaId, _cdbMeta: true,
//     _aplicadoEm: "YYYY-MM-DD",  // data-base da capitalização
//     _capituladoEm: "YYYY-MM-DD" // último dia em que rendeu (idempotência)
//   }

export const TAXA_CDI_KEY = "af4-cdi-anual";

export function getCdiAnual() {
  const v = Number(localStorage.getItem(TAXA_CDI_KEY));
  return Number.isFinite(v) && v > 0 ? v : 10.5;
}

// Valor de mercado de um CDB de meta hoje = valor-base capitalizado a CDI desde
// _aplicadoEm. O valor-base (_baseValor) é o valor de MERCADO na data-base — que
// na 1ª aplicação é igual ao aporte, mas após reaplicar já inclui o rendimento
// consolidado. Por isso NÃO usamos `pm` (custo) como base: senão a reaplicação
// jogaria fora o rendimento já acumulado. Juros compostos diários.
export function valorCdbHoje(ativo, hojeISO = new Date().toISOString().slice(0, 10), cdiAnual = getCdiAnual()) {
  const base = Number(ativo._baseValor != null ? ativo._baseValor : ativo.pm) || 0;
  const baseData = ativo._aplicadoEm || hojeISO;
  const dias = Math.max(0, (new Date(`${hojeISO}T00:00:00`) - new Date(`${baseData}T00:00:00`)) / 86400000);
  const taxa = cdiAnual / 100;
  return +(base * Math.pow(1 + taxa, dias / 365)).toFixed(2);
}

// Recalcula o preço (valor de mercado) de todos os CDBs de meta.
// Idempotente por dia: só mexe se o preço mudou de verdade.
// Retorna { ativos: novaLista, mudou: bool }.
export function capitalizarCdbsMeta(ativos = [], hojeISO = new Date().toISOString().slice(0, 10), cdiAnual = getCdiAnual()) {
  let mudou = false;
  const nova = (ativos || []).map(a => {
    if (!a._cdbMeta) return a;
    const novoPreco = valorCdbHoje(a, hojeISO, cdiAnual);
    if (Math.abs((Number(a.preco) || 0) - novoPreco) > 0.005 || a._capituladoEm !== hojeISO) {
      mudou = true;
      return { ...a, preco: novoPreco, _capituladoEm: hojeISO };
    }
    return a;
  });
  return { ativos: nova, mudou };
}
