/**
 * "🔄 Atualizar saldos" da Carteira (pedido 2026-10-02): você digita o saldo
 * e o rendimento de cada aplicação de renda fixa (como aparece no app do
 * banco) e o app atualiza preço atual, preço médio, taxa e vencimento.
 * Não mexe em contas nem transações.
 */
const RF = new Set(["cdb", "tesouro", "rf", "fundo"]);
const num = (v) => { if (v === "" || v == null) return null; const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };
export const ehRendaFixa = (a) => RF.has(String(a?.tipo || ""));

/** Campos a gravar no ativo a partir do que foi lido. */
export function camposDoLido(l) {
  const saldo = num(l.saldo), rend = num(l.rendimento), aplicado = num(l.aplicado);
  const out = {};
  if (RF.has(l.tipo) || (saldo != null && num(l.quantidade) == null)) {
    if (saldo != null) {
      const pm = aplicado ?? (rend != null ? saldo - rend : null);
      out.qtd = 1; out.preco = saldo; out.base = saldo;
      if (pm != null && pm > 0) out.pm = Math.round(pm * 100) / 100;
    }
  } else {
    if (num(l.quantidade) != null) out.qtd = num(l.quantidade);
    if (num(l.preco) != null) { out.preco = num(l.preco); out.base = num(l.preco); }
    if (aplicado != null && num(l.quantidade)) out.pm = Math.round((aplicado / num(l.quantidade)) * 100) / 100;
  }
  if (l.indexador) out.rfIndexador = l.indexador;
  if (num(l.taxa) != null) out.rfTaxa = num(l.taxa);
  if (l.vencimento) out.vencimento = l.vencimento;
  if (l.liquidez) out.liquidez = l.liquidez;
  out.saldoAtualizadoEm = new Date().toISOString().slice(0, 10);
  return out;
}

/** Aplica as linhas marcadas na carteira (atualiza ou cria). */
export function aplicarAtualizacao(ativos = [], linhas = [], gerarId = () => Math.random().toString(36).slice(2, 10)) {
  let out = [...ativos];
  for (const x of linhas) {
    if (x.ignorar) continue;
    const campos = camposDoLido(x.lido);
    if (x.alvo) out = out.map(a => a.id === x.alvo.id ? { ...a, ...campos } : a);
    else {
      const base = { id: gerarId(), ticker: String(x.ticker || x.lido.nome).toUpperCase(), nome: x.lido.nome, tipo: x.lido.tipo, segmento: "", conta: "", qtd: 1, pm: campos.preco || 0, preco: 0, criadoEm: new Date().toISOString().slice(0, 10) };
      const novo = { ...base, ...campos };
      if (!(novo.pm > 0)) novo.pm = novo.preco;
      out.push(novo);
    }
  }
  return out;
}
