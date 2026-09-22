/* ============================================================
   PDF DO RELATÓRIO MENSAL — gerador extraído de RelatorioMensal.jsx
   pra tela única "Análise do mês" usar o mesmo documento.

   Recebe o `rel` (saída de relatorioMensal), as frases do consultor
   (leituraConsultor) e a posição consolidada (posicaoConsolidada) e
   abre o overlay de impressão (printHTML → Salvar PDF/Excel).
   ============================================================ */

import { fmt, fmtN } from "./format.js";
import { MESES_LONGO } from "./meses.js";
import { printHTML } from "./importExport.js";

const FONTE_PRINT = "'Nunito','Inter',-apple-system,system-ui,sans-serif";

function rotuloMes(mesISO) {
  const [y, m] = String(mesISO).split("-").map(Number);
  const nome = MESES_LONGO[(m || 1) - 1] || "";
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} / ${y}`;
}

export function gerarPDFMensal({ mesISO, rel, escopoAtivo = "tudo", frases = [], pos = null }) {
  const { financas: f, invest: iv } = rel;
  const detCartoes = rel.cartoes || [];
  const esc = (s) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  const sinal = (v) => (v >= 0 ? "+" : "−") + fmt(Math.abs(v));

  const consultorHtml = frases.length
    ? `<h2>Leitura do consultor</h2><ul class="cons">${frases.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`
    : "";

  const consolidadaHtml = pos ? `<h2>Posição consolidada · hoje</h2>
<div class="note">Fotografia de agora (não do fim de ${esc(rotuloMes(mesISO))}): contas, carteira de proventos e investimentos, menos o que está em aberto nos cartões.</div>
<div class="stats">
  <div class="row"><span>🏦 Contas</span><b class="n">${esc(fmt(pos.contas))}</b></div>
  ${pos.proventos > 0 ? `<div class="row"><span>💰 Carteira de proventos</span><b class="n">${esc(fmt(pos.proventos))}</b></div>` : ""}
  <div class="row"><span>📈 Investimentos (Brasil)</span><b class="n">${esc(fmt(pos.investBR))}</b></div>
  ${pos.investUSD > 0 ? `<div class="row"><span>🇺🇸 Investimentos (US$, fora do total)</span><b class="n">US$ ${pos.investUSD.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></div>` : ""}
  <div class="row"><span>💳 Cartões em aberto</span><b class="n neg">− ${esc(fmt(pos.cartoesAbertos))}</b></div>
  <div class="row" style="border-top:1.5px solid #cfcabf;border-bottom:none;font-weight:800"><span>Líquido consolidado</span><b class="n ${pos.liquido >= 0 ? "pos" : "neg"}">${esc(fmt(pos.liquido))}</b></div>
</div>` : "";

  // Tabela resumida de categorias, com barra de % e linha de TOTAL.
  const tabelaCat = (linhas, total, cor, vazio) => {
    if (!linhas.length) return `<div class="empty">${esc(vazio)}</div>`;
    const rows = linhas.map((c) => `<tr>
      <td class="cat">${esc(c.nome)}</td>
      <td class="bar"><i style="width:${Math.max(3, Math.round(c.pct))}%;background:${cor}"></i></td>
      <td class="n">${esc(fmt(c.valor))}</td>
      <td class="pc">${fmtN(c.pct, 0)}%</td>
    </tr>`).join("");
    return `<table class="cat-t"><tbody>${rows}
      <tr class="tot"><td>Total</td><td></td><td class="n">${esc(fmt(total))}</td><td class="pc">100%</td></tr>
    </tbody></table>`;
  };

  const recTab = tabelaCat(f.receitasCategorias, f.receitas, "#3f6d6a", "Sem receitas no mês.");
  const despTab = tabelaCat(f.categorias, f.despesasBancos, "#a86b4b", "Sem gastos por banco.");
  const geralHtml = (f.categoriasGeral || []).length
    ? `<table class="cat-t"><tbody>${(f.categoriasGeral || []).map((p) => {
        const pai = `<tr class="pai"><td class="cat"><b>${esc(p.nome)}</b></td>
          <td class="bar"><i style="width:${Math.max(3, Math.round(p.pct))}%;background:#8a6a2a"></i></td>
          <td class="n">${esc(fmt(p.valor))}</td><td class="pc">${fmtN(p.pct, 0)}%</td></tr>`;
        const filhos = (p.filhos || []).map((c) => `<tr class="filho"><td class="cat">— ${esc(c.nome)}</td><td></td><td class="n">${esc(fmt(c.valor))}</td><td class="pc"></td></tr>`).join("");
        return pai + filhos;
      }).join("")}
      <tr class="tot"><td>Total</td><td></td><td class="n">${esc(fmt(f.despesasGeral))}</td><td class="pc">100%</td></tr>
    </tbody></table>`
    : `<div class="empty">Sem gastos no mês.</div>`;

  const provChips = (iv.proventosPorTipo || []).length
    ? (iv.proventosPorTipo || []).map((p) => `<span class="chip">${esc(p.tipo)} <b>${esc(fmt(p.valor))}</b></span>`).join("")
    : `<span class="muted">Sem proventos no mês.</span>`;

  const investVazio = !(iv.totalComprado > 0 || iv.totalVendido > 0 || iv.totalProventos > 0 || iv.patrimonioFim != null);
  const deltaDesp = f.deltaDespesas == null ? "—" : `${f.deltaDespesas >= 0 ? "▲ +" : "▼ "}${fmtN(Math.abs(f.deltaDespesas), 0)}%`;

  const cartoesHtml = detCartoes.map((cc) => {
    const rows = cc.categorias.map((c) => `<tr>
      <td class="cat">${esc(c.nome)}</td>
      <td class="bar"><i style="width:${Math.max(3, Math.round(c.pct))}%;background:#8a6a2a"></i></td>
      <td class="n">${esc(fmt(c.valor))}</td><td class="pc">${fmtN(c.pct, 0)}%</td>
    </tr>`).join("") || `<tr><td colspan="4" class="muted">—</td></tr>`;
    return `<div class="cc">
      <div class="cc-h"><b>${esc(cc.nome)}</b><span>Gasto ${esc(fmt(cc.total))}${cc.pagamento > 0 ? ` · Pago ${esc(fmt(cc.pagamento))}` : ""}</span></div>
      <table class="cat-t"><tbody>${rows}</tbody></table>
    </div>`;
  }).join("");

  printHTML(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório · ${esc(rotuloMes(mesISO))}</title>
<style>
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; }
body { font-family:${FONTE_PRINT}; color:#22262b; margin:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.wrap { padding: 16mm 15mm; }
.head { display:flex; justify-content:space-between; align-items:flex-end; padding:0 0 12px; border-bottom:2px solid #3f6d6a; }
.brand { font-size:12px; font-weight:800; letter-spacing:.02em; }
.brand .a { color:#6f93a6; } .brand .f { color:#3f6d6a; }
.head .doc { font-size:9px; letter-spacing:.28em; text-transform:uppercase; color:#8a8f96; margin-top:3px; }
.head h1 { font-size:24px; margin:2px 0 0; font-weight:700; }
.head .gen { text-align:right; font-size:9.5px; color:#9aa0a6; line-height:1.5; }
h2 { font-size:10.5px; text-transform:uppercase; letter-spacing:.14em; color:#3f6d6a; font-weight:700; margin:20px 0 8px; }
.cards { display:flex; gap:10px; }
.card { flex:1; border:1px solid #e7e3db; border-radius:10px; padding:11px 13px; }
.card .l { font-size:8.5px; text-transform:uppercase; letter-spacing:.08em; color:#9aa0a6; font-weight:700; }
.card .v { font-size:20px; font-weight:700; margin-top:3px; font-variant-numeric:tabular-nums; }
.two { display:flex; gap:22px; margin-top:2px; }
.two > div { flex:1; min-width:0; }
.sub { font-size:9px; letter-spacing:.1em; text-transform:uppercase; color:#9aa0a6; font-weight:700; margin:0 0 5px; }
table.cat-t { width:100%; border-collapse:collapse; font-size:11px; }
table.cat-t td { padding:4px 0; border-bottom:1px solid #f0ede7; vertical-align:middle; }
td.cat { color:#3a3f45; white-space:nowrap; max-width:120px; overflow:hidden; text-overflow:ellipsis; }
td.bar { width:34%; padding:0 8px; }
td.bar i { display:block; height:6px; border-radius:4px; min-width:3px; }
td.n { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; font-weight:600; }
td.pc { text-align:right; width:38px; padding-left:8px; color:#9aa0a6; font-variant-numeric:tabular-nums; }
tr.tot td { border-bottom:none; border-top:1.5px solid #cfcabf; font-weight:800; padding-top:6px; }
tr.pai td { border-bottom:none; padding-top:6px; }
tr.filho td { border-bottom:1px solid #f4f1eb; font-size:10px; color:#7a7f86; padding:2px 0; }
tr.filho td.cat { padding-left:10px; }
.stats { margin-top:8px; }
.row { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid #f0ede7; font-size:11px; }
.row span { color:#5a5f66; }
.chips { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
.chip { font-size:10.5px; padding:3px 10px; border:1px solid #e0dcd3; border-radius:999px; color:#3a3f45; }
.chip b { font-variant-numeric:tabular-nums; }
.empty, .muted { color:#a9adb3; font-style:italic; font-size:11px; }
.note { font-size:9.5px; color:#9aa0a6; font-style:italic; margin:-2px 0 8px; }
.ccs { display:flex; flex-direction:column; gap:10px; }
.cc { border:1px solid #e7e3db; border-radius:10px; padding:9px 12px; break-inside:avoid; }
.cc-h { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:5px; font-size:11.5px; }
.cc-h b { color:#22262b; } .cc-h span { color:#8a8f96; font-size:10px; font-variant-numeric:tabular-nums; }
ul.cons { margin:6px 0 0; padding:0 0 0 4px; list-style:none; }
ul.cons li { font-size:11px; color:#3a3f45; padding:5px 0 5px 18px; border-bottom:1px solid #f0ede7; position:relative; line-height:1.45; }
ul.cons li::before { content:"◆"; position:absolute; left:2px; color:#3f6d6a; font-size:8px; top:8px; }
.foot { margin-top:22px; padding-top:8px; border-top:1px solid #eee; font-size:8.5px; color:#b3b7bc; display:flex; justify-content:space-between; }
.pos, .green { color:#1f7a44; } .neg, .red { color:#b3261e; }
</style></head><body><div class="wrap">

<div class="head">
  <div>
    <div class="brand"><span class="a">A</span><span class="f">finanças</span></div>
    <div class="doc">Relatório mensal</div>
    <h1>${esc(rotuloMes(mesISO))}</h1>
  </div>
  <div class="gen">Finanças + Investimentos${escopoAtivo && escopoAtivo !== "tudo" ? "<br>escopo: " + esc(escopoAtivo) : ""}<br>gerado em ${esc(new Date().toLocaleDateString("pt-BR"))}</div>
</div>

<h2>Resumo do mês</h2>
<div class="cards">
  <div class="card"><div class="l">Receitas</div><div class="v green">${esc(fmt(f.receitas))}</div></div>
  <div class="card"><div class="l">Despesas</div><div class="v red">${esc(fmt(f.despesas))}</div></div>
  <div class="card"><div class="l">${f.sobra >= 0 ? "Sobrou" : "Faltou"}</div><div class="v ${f.sobra >= 0 ? "green" : "red"}">${esc(fmt(f.sobra))}</div></div>
</div>
<div class="stats">
  <div class="row"><span>Despesas pagas</span><b class="n">${esc(fmt(f.pagas))}</b></div>
  <div class="row"><span>Ainda a pagar</span><b class="n ${f.aPagar > 0 ? "neg" : ""}">${esc(fmt(f.aPagar))}</b></div>
  <div class="row"><span>Despesas vs mês anterior</span><b class="n">${deltaDesp}</b></div>
</div>

${consultorHtml}

<div class="two">
  <div><div class="sub">Recebimentos por categoria</div>${recTab}</div>
  <div><div class="sub">Despesas por categoria · bancos</div>${despTab}</div>
</div>

<h2>Investimentos do mês</h2>
${investVazio ? `<div class="empty">Sem movimentações de investimento neste mês.</div>` : `
<div class="cards">
  <div class="card"><div class="l">Aportes</div><div class="v">${esc(fmt(iv.totalComprado))}</div></div>
  <div class="card"><div class="l">Vendas</div><div class="v">${esc(fmt(iv.totalVendido))}</div></div>
  <div class="card"><div class="l">Proventos</div><div class="v green">${esc(fmt(iv.totalProventos))}</div></div>
</div>
<div class="chips">${provChips}</div>`}

${detCartoes.length ? `<h2>Cartões · detalhe</h2>
<div class="note">Informativo — compras/parcelas lançadas em cada cartão. O pagamento da fatura não soma.</div>
<div class="ccs">${cartoesHtml}</div>` : ""}

<h2>Resumo geral · por categoria</h2>
<div class="note">Bancos + cartões juntos — o gasto real do mês por categoria (pai) e subcategoria (filho).</div>
${geralHtml}

${consolidadaHtml}

<div class="foot"><span>Afinanças · relatório mensal</span><span>${esc(rotuloMes(mesISO))}</span></div>
</div></body></html>`);
}
