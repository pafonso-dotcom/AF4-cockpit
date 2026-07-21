import React, { useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, Printer, TrendingUp, TrendingDown,
  ArrowDownRight, ArrowUpRight, DollarSign, Wallet, Briefcase, CreditCard,
} from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, fmtN } from "../../lib/format.js";
import { MESES_LONGO } from "../../lib/meses.js";
import { relatorioMensal } from "../../lib/relatorioMensal.js";
import { printHTML } from "../../lib/importExport.js";

const FONTE_PRINT = "'Nunito','Inter',-apple-system,system-ui,sans-serif";

// mês atual em ISO (YYYY-MM)
function mesAtualISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function rotuloMes(mesISO) {
  const [y, m] = mesISO.split("-").map(Number);
  const nome = MESES_LONGO[(m || 1) - 1] || "";
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} / ${y}`;
}

/**
 * Relatório mensal — fechamento de um mês juntando finanças (receitas,
 * despesas por categoria, sobra, pagas × a pagar) e investimentos (aportes,
 * vendas, proventos, resultado e variação do patrimônio). Tela + PDF.
 */
export default function RelatorioMensal({
  transacoes = [], contas = [], categorias = [],
  fixas = [], fixaOcorrencias = [], parcelamentos = [], dividas = [],
  devedores = [], cheques = [], cartoes = [],
  patrimonioHistorico = [], escopoAtivo = "tudo", hidden, embed = false,
}) {
  const [mesISO, setMesISO] = useState(mesAtualISO);

  const state = useMemo(
    () => ({ transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques }),
    [transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques]
  );
  const rel = useMemo(
    () => relatorioMensal(mesISO, state, escopoAtivo, patrimonioHistorico),
    [mesISO, state, escopoAtivo, patrimonioHistorico]
  );

  const shiftMes = (delta) => {
    const [y, m] = mesISO.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMesISO(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const ehMesAtual = mesISO >= mesAtualISO();

  const mask = (v) => (hidden ? "•••••" : fmt(v));
  const { financas: f, invest: iv } = rel;
  const detCartoes = rel.cartoes || [];
  const temInvest = iv.totalComprado > 0 || iv.totalVendido > 0 || iv.totalProventos > 0 || iv.patrimonioFim != null;

  const gerarPDF = () => {
    const esc = (s) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const sinal = (v) => (v >= 0 ? "+" : "−") + fmt(Math.abs(v));

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
    // Resumo geral hierárquico: categoria pai (alfabético) + subcategorias filho.
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

    const patrBloco = iv.patrimonioFim != null
      ? `<div class="row"><span>Patrimônio no fim do mês</span><b class="n">${esc(fmt(iv.patrimonioFim))}</b></div>
         <div class="row"><span>Variação no mês</span><b class="n ${iv.variacao >= 0 ? "pos" : "neg"}">${sinal(iv.variacao)}${iv.variacaoPct != null ? ` (${iv.variacaoPct >= 0 ? "+" : ""}${fmtN(iv.variacaoPct, 1)}%)` : ""}</b></div>`
      : `<div class="row muted"><span>Patrimônio</span><span>sem snapshots neste mês</span></div>`;

    const investVazio = !(iv.totalComprado > 0 || iv.totalVendido > 0 || iv.totalProventos > 0 || iv.patrimonioFim != null);
    const deltaDesp = f.deltaDespesas == null ? "—" : `${f.deltaDespesas >= 0 ? "▲ +" : "▼ "}${fmtN(Math.abs(f.deltaDespesas), 0)}%`;

    // Detalhe por cartão (informativo) — categorias separadas + pagamento.
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

<div class="foot"><span>Afinanças · relatório mensal</span><span>${esc(rotuloMes(mesISO))}</span></div>
</div></body></html>`);
  };

  const Tile = ({ label, valor, cor, icon: Icon, delta }) => (
    <div style={{ flex: 1, minWidth: 140, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 13px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: T.muted }}>{label}</span>
        {Icon && <Icon size={14} style={{ color: cor || T.muted }} />}
      </div>
      <div className="num" style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 700, color: cor || T.ink, marginTop: 3 }}>
        {hidden ? "•••••" : valor}
      </div>
      {delta != null && (
        <div style={{ fontSize: 10.5, marginTop: 2, color: delta.bom ? T.green : T.red }}>
          {delta.txt}
        </div>
      )}
    </div>
  );

  const catMax = Math.max(1, ...f.categorias.map((c) => c.valor));

  return (
    <div style={{ padding: embed ? 0 : "6px 2px" }}>
      {/* Barra: navegação de mês + PDF */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => shiftMes(-1)} aria-label="Mês anterior"
            style={navBtn}><ChevronLeft size={16} /></button>
          <div style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 700, color: T.ink, minWidth: 150, textAlign: "center" }}>
            {rotuloMes(mesISO)}
          </div>
          <button onClick={() => shiftMes(1)} disabled={ehMesAtual} aria-label="Próximo mês"
            style={{ ...navBtn, opacity: ehMesAtual ? 0.35 : 1, cursor: ehMesAtual ? "default" : "pointer" }}><ChevronRight size={16} /></button>
        </div>
        <button onClick={gerarPDF} className="btn-gold"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, borderRadius: 10, cursor: "pointer" }}>
          <Printer size={15} /> Salvar PDF
        </button>
      </div>

      {/* ===== FINANÇAS ===== */}
      <SecTitulo>Finanças do mês</SecTitulo>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <Tile label="Receitas" valor={mask(f.receitas)} cor={T.green} icon={ArrowDownRight}
          delta={f.deltaReceitas == null ? null : { txt: `${f.deltaReceitas >= 0 ? "▲ +" : "▼ "}${fmtN(Math.abs(f.deltaReceitas), 0)}% vs mês ant.`, bom: f.deltaReceitas >= 0 }} />
        <Tile label="Despesas" valor={mask(f.despesas)} cor={T.red} icon={ArrowUpRight}
          delta={f.deltaDespesas == null ? null : { txt: `${f.deltaDespesas >= 0 ? "▲ +" : "▼ "}${fmtN(Math.abs(f.deltaDespesas), 0)}% vs mês ant.`, bom: f.deltaDespesas <= 0 }} />
        <Tile label={f.sobra >= 0 ? "Sobrou" : "Faltou"} valor={mask(f.sobra)} cor={f.sobra >= 0 ? T.green : T.red} icon={Wallet} />
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: T.muted, marginBottom: 12 }}>
        <span>Pagas: <b className="num" style={{ color: T.ink }}>{hidden ? "•••" : fmt(f.pagas)}</b></span>
        <span>A pagar: <b className="num" style={{ color: f.aPagar > 0 ? T.red : T.ink }}>{hidden ? "•••" : fmt(f.aPagar)}</b></span>
      </div>

      {/* Top categorias */}
      <div style={{ fontSize: 11, color: T.faint, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Gastos por categoria · bancos</div>
      {f.categorias.length === 0 ? (
        <div style={{ fontSize: 12, color: T.faint, fontStyle: "italic", marginBottom: 8 }}>Sem gastos por banco neste mês.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 8 }}>
          {f.categorias.slice(0, 6).map((c) => (
            <div key={c.nome} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 110, flexShrink: 0, fontSize: 11.5, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 999, background: T.bgSoft, overflow: "hidden" }}>
                <div style={{ width: `${(c.valor / catMax) * 100}%`, height: "100%", borderRadius: 999, background: T.gold }} />
              </div>
              <span className="num" style={{ width: 92, textAlign: "right", flexShrink: 0, fontSize: 11.5, color: T.ink }}>{hidden ? "•••" : fmt(c.valor)}</span>
              <span className="num" style={{ width: 34, textAlign: "right", flexShrink: 0, fontSize: 10.5, color: T.muted }}>{fmtN(c.pct, 0)}%</span>
            </div>
          ))}
        </div>
      )}

      {/* ===== INVESTIMENTOS ===== */}
      <SecTitulo style={{ marginTop: 18 }}>Investimentos do mês</SecTitulo>
      {!temInvest ? (
        <div style={{ fontSize: 12, color: T.faint, fontStyle: "italic" }}>Sem movimentações de investimento neste mês.</div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
            <Tile label="Aportes" valor={mask(iv.totalComprado)} cor={T.ink} icon={Briefcase} />
            <Tile label="Vendas" valor={mask(iv.totalVendido)} cor={T.ink} icon={ArrowUpRight} />
            <Tile label="Proventos" valor={mask(iv.totalProventos)} cor={T.green} icon={DollarSign} />
          </div>
        </>
      )}

      {/* ===== CARTÕES (informativo, separado por cartão) ===== */}
      {detCartoes.length > 0 && (
        <>
          <SecTitulo style={{ marginTop: 18 }}>Cartões · detalhe</SecTitulo>
          <div style={{ fontSize: 11, color: T.faint, fontStyle: "italic", marginBottom: 8 }}>
            Informativo — estas compras já estão somadas nas despesas acima; aqui só separadas por cartão. O pagamento da fatura não soma.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {detCartoes.map((cc) => (
              <div key={cc.id} style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: "11px 13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <CreditCard size={14} style={{ color: T.gold }} /> {cc.nome}
                  </div>
                  <div style={{ fontSize: 11, color: T.muted }}>
                    Gasto: <b className="num" style={{ color: T.ink }}>{hidden ? "•••" : fmt(cc.total)}</b>
                    {cc.pagamento > 0 && <> · Pago: <b className="num" style={{ color: T.muted }}>{hidden ? "•••" : fmt(cc.pagamento)}</b></>}
                  </div>
                </div>
                {cc.categorias.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {cc.categorias.map((c) => (
                      <div key={c.nome} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <span style={{ width: 120, flexShrink: 0, fontSize: 11.5, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</span>
                        <div style={{ flex: 1, height: 7, borderRadius: 999, background: T.bgSoft, overflow: "hidden" }}>
                          <div style={{ width: `${c.pct}%`, height: "100%", borderRadius: 999, background: T.gold }} />
                        </div>
                        <span className="num" style={{ width: 92, textAlign: "right", flexShrink: 0, fontSize: 11.5, color: T.ink }}>{hidden ? "•••" : fmt(c.valor)}</span>
                        <span className="num" style={{ width: 34, textAlign: "right", flexShrink: 0, fontSize: 10.5, color: T.muted }}>{fmtN(c.pct, 0)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ===== RESUMO GERAL · bancos + cartões por categoria ===== */}
      {f.categoriasGeral.length > 0 && (
        <>
          <SecTitulo style={{ marginTop: 18 }}>Resumo geral · por categoria</SecTitulo>
          <div style={{ fontSize: 11, color: T.faint, fontStyle: "italic", marginBottom: 8 }}>
            Bancos + cartões juntos, em ordem alfabética — categoria e subcategorias.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {f.categoriasGeral.map((p) => (
              <div key={p.nome}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 0" }}>
                  <span style={{ width: 130, flexShrink: 0, fontSize: 12, fontWeight: 700, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nome}</span>
                  <div style={{ flex: 1, height: 7, borderRadius: 999, background: T.bgSoft, overflow: "hidden" }}>
                    <div style={{ width: `${p.pct}%`, height: "100%", borderRadius: 999, background: T.gold }} />
                  </div>
                  <span className="num" style={{ width: 92, textAlign: "right", flexShrink: 0, fontSize: 12, fontWeight: 600, color: T.ink }}>{hidden ? "•••" : fmt(p.valor)}</span>
                  <span className="num" style={{ width: 34, textAlign: "right", flexShrink: 0, fontSize: 10.5, color: T.muted }}>{fmtN(p.pct, 0)}%</span>
                </div>
                {p.filhos.map((c) => (
                  <div key={c.nome} style={{ display: "flex", alignItems: "baseline", gap: 9, padding: "1px 0 1px 12px" }}>
                    <span style={{ flex: 1, fontSize: 10.5, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>— {c.nome}</span>
                    <span className="num" style={{ fontSize: 10.5, color: T.muted }}>{hidden ? "•••" : fmt(c.valor)}</span>
                  </div>
                ))}
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0 0", marginTop: 3, borderTop: `1.5px solid ${T.border}` }}>
              <span style={{ flex: 1, fontSize: 12, fontWeight: 800, color: T.ink }}>Total</span>
              <span className="num" style={{ fontSize: 12.5, fontWeight: 800, color: T.ink }}>{hidden ? "•••••" : fmt(f.despesasGeral)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const navBtn = {
  width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 10, color: T.ink, cursor: "pointer",
};

function SecTitulo({ children, style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 10px", ...style }}>
      <div style={{ width: 4, height: 16, borderRadius: 3, background: T.gold }} />
      <h3 style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 700, color: T.ink, margin: 0 }}>{children}</h3>
    </div>
  );
}
