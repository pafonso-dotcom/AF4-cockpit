import React, { useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, Printer, TrendingUp, TrendingDown,
  ArrowDownRight, ArrowUpRight, DollarSign, Wallet, Briefcase,
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
  const temInvest = iv.totalComprado > 0 || iv.totalVendido > 0 || iv.totalProventos > 0 || iv.patrimonioFim != null;

  const gerarPDF = () => {
    const esc = (s) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const catLinhas = f.categorias.slice(0, 14)
      .map((c) => `<tr><td>${esc(c.nome)}</td><td class="n">${esc(fmt(c.valor))}</td><td class="n">${fmtN(c.pct, 0)}%</td></tr>`)
      .join("") || `<tr><td colspan="3" class="muted">Sem gastos categorizados no mês.</td></tr>`;

    const movLinhas = (arr, tipo) => arr
      .map((x) => `<tr><td>${esc(x.data?.slice(8, 10) + "/" + x.data?.slice(5, 7))}</td><td>${esc(tipo)}</td><td>${esc(x.ticker || "—")}</td><td class="n">${esc(fmt(x.valor))}</td></tr>`)
      .join("");
    const movTodas = [
      ...movLinhas(iv.compras, "Aporte"),
      ...movLinhas(iv.vendas, "Venda"),
      ...movLinhas(iv.proventos, "Provento"),
    ].length
      ? movLinhas(iv.compras, "Aporte") + movLinhas(iv.vendas, "Venda") + movLinhas(iv.proventos, "Provento")
      : `<tr><td colspan="4" class="muted">Sem movimentações de investimento no mês.</td></tr>`;

    const patrLinha = iv.patrimonioFim != null
      ? `<tr><td>Patrimônio no fim do mês</td><td class="n">${esc(fmt(iv.patrimonioFim))}</td></tr>
         <tr><td>Variação no mês</td><td class="n ${iv.variacao >= 0 ? "pos" : "neg"}">${iv.variacao >= 0 ? "+" : ""}${esc(fmt(iv.variacao))}${iv.variacaoPct != null ? ` (${iv.variacaoPct >= 0 ? "+" : ""}${fmtN(iv.variacaoPct, 2)}%)` : ""}</td></tr>`
      : `<tr><td class="muted" colspan="2">Sem snapshots de patrimônio neste mês.</td></tr>`;

    printHTML(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório · ${esc(rotuloMes(mesISO))}</title>
<style>
@page { size: A4 portrait; margin: 12mm; }
body { font-family:${FONTE_PRINT}; color:#141414; margin:0; }
h1 { font-size:19px; margin:0 0 2px; }
h2 { font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:#8a6a2a; margin:18px 0 6px; border-bottom:1.5px solid #e6dcc8; padding-bottom:3px; }
.sub-head { color:#666; font-size:11px; margin:0 0 6px; }
.kpis { display:flex; gap:10px; margin:8px 0 2px; }
.kpi { flex:1; border:1px solid #e6e0d4; border-radius:8px; padding:8px 10px; }
.kpi .l { font-size:9px; text-transform:uppercase; letter-spacing:.05em; color:#888; }
.kpi .v { font-size:16px; font-weight:700; margin-top:2px; font-variant-numeric:tabular-nums; }
table { width:100%; border-collapse:collapse; font-size:11px; margin-top:2px; }
th,td { padding:4px 7px; border-bottom:1px solid #eee; text-align:left; }
th { text-transform:uppercase; font-size:8.5px; letter-spacing:.04em; color:#777; }
td.n, th.n { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
td.muted { color:#999; font-style:italic; }
.pos { color:#1f7a44; } .neg { color:#b3261e; }
.green { color:#1f7a44; } .red { color:#b3261e; }
</style></head><body>
<h1>Relatório mensal — ${esc(rotuloMes(mesISO))}</h1>
<div class="sub-head">Finanças + Investimentos${escopoAtivo && escopoAtivo !== "tudo" ? " · escopo: " + esc(escopoAtivo) : ""} · gerado em ${esc(new Date().toLocaleString("pt-BR"))}</div>

<h2>Finanças do mês</h2>
<div class="kpis">
  <div class="kpi"><div class="l">Receitas</div><div class="v green">${esc(fmt(f.receitas))}</div></div>
  <div class="kpi"><div class="l">Despesas</div><div class="v red">${esc(fmt(f.despesas))}</div></div>
  <div class="kpi"><div class="l">${f.sobra >= 0 ? "Sobrou" : "Faltou"}</div><div class="v ${f.sobra >= 0 ? "green" : "red"}">${esc(fmt(f.sobra))}</div></div>
</div>
<table><tbody>
  <tr><td>Despesas pagas</td><td class="n">${esc(fmt(f.pagas))}</td></tr>
  <tr><td>Ainda a pagar</td><td class="n">${esc(fmt(f.aPagar))}</td></tr>
  <tr><td>Despesas vs mês anterior</td><td class="n">${f.deltaDespesas == null ? "—" : (f.deltaDespesas >= 0 ? "+" : "") + fmtN(f.deltaDespesas, 0) + "%"}</td></tr>
</tbody></table>

<h2>Gastos por categoria</h2>
<table><thead><tr><th>Categoria</th><th class="n">Valor</th><th class="n">%</th></tr></thead><tbody>${catLinhas}</tbody></table>

<h2>Investimentos do mês</h2>
<div class="kpis">
  <div class="kpi"><div class="l">Aportes</div><div class="v">${esc(fmt(iv.totalComprado))}</div></div>
  <div class="kpi"><div class="l">Vendas</div><div class="v">${esc(fmt(iv.totalVendido))}</div></div>
  <div class="kpi"><div class="l">Proventos</div><div class="v green">${esc(fmt(iv.totalProventos))}</div></div>
</div>
<table><tbody>
  <tr><td>Resultado das vendas</td><td class="n ${iv.resultadoVendas >= 0 ? "pos" : "neg"}">${iv.resultadoVendas >= 0 ? "+" : ""}${esc(fmt(iv.resultadoVendas))}</td></tr>
  ${patrLinha}
</tbody></table>
<table><thead><tr><th>Dia</th><th>Tipo</th><th>Ativo</th><th class="n">Valor</th></tr></thead><tbody>${movTodas}</tbody></table>
</body></html>`);
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
      <div style={{ fontSize: 11, color: T.faint, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>Gastos por categoria</div>
      {f.categorias.length === 0 ? (
        <div style={{ fontSize: 12, color: T.faint, fontStyle: "italic", marginBottom: 8 }}>Sem gastos categorizados neste mês.</div>
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
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <Tile label="Aportes" valor={mask(iv.totalComprado)} cor={T.ink} icon={Briefcase} />
            <Tile label="Vendas" valor={mask(iv.totalVendido)} cor={T.ink} icon={ArrowUpRight} />
            <Tile label="Proventos" valor={mask(iv.totalProventos)} cor={T.green} icon={DollarSign} />
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12, color: T.muted, marginBottom: 4 }}>
            <span>Resultado das vendas: <b className="num" style={{ color: iv.resultadoVendas >= 0 ? T.green : T.red }}>{iv.resultadoVendas >= 0 ? "+" : ""}{hidden ? "•••" : fmt(iv.resultadoVendas)}</b></span>
            {iv.patrimonioFim != null && (
              <span>Patrimônio (fim): <b className="num" style={{ color: T.ink }}>{hidden ? "•••" : fmt(iv.patrimonioFim)}</b>
                {iv.variacao != null && (
                  <span style={{ color: iv.variacao >= 0 ? T.green : T.red, marginLeft: 6 }}>
                    {iv.variacao >= 0 ? "▲ +" : "▼ "}{hidden ? "•••" : fmt(Math.abs(iv.variacao))}{iv.variacaoPct != null ? ` (${fmtN(iv.variacaoPct, 1)}%)` : ""}
                  </span>
                )}
              </span>
            )}
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
