import React, { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, PieChart, SlidersHorizontal, X, Plus } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import { MESES_LONGO } from "../../../lib/meses.js";
import { filtrarPorEscopo } from "../../../lib/escopo.js";
import { analiseGastosMes } from "../../../lib/analiseGastos.js";

const AJUSTE_KEY = "financas:analise-gastos:v1";
const lerAjuste = () => {
  try {
    const v = JSON.parse(localStorage.getItem(AJUSTE_KEY) || "{}");
    return { excluir: Array.isArray(v.excluir) ? v.excluir : [], incluir: Array.isArray(v.incluir) ? v.incluir : [] };
  } catch { return { excluir: [], incluir: [] }; }
};
const salvarAjuste = (a) => { try { localStorage.setItem(AJUSTE_KEY, JSON.stringify(a)); } catch {} };

const nomeMes = (mesISO) => {
  const [a, m] = (mesISO || "").split("-").map(Number);
  return `${MESES_LONGO[(m || 1) - 1]} ${a || ""}`;
};
const oculto = (v, hidden) => (hidden ? "•••" : fmt(v));
const pctStr = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`;
const semDup = (arr) => Array.from(new Set(arr));

// Análise de GASTO por categoria do mês (só consumo). Barra de participação,
// variação vs mês anterior e destaque da maior alta. Respeita o escopo ativo.
// Ajuste avulso: tirar categoria de consumo ou colocar uma de movimentação.
export default function AnaliseGastos({ transacoes = [], contas = [], escopoAtivo = "tudo", hidden = false }) {
  const [ajuste, setAjuste] = useState(lerAjuste);
  const [editar, setEditar] = useState(false);

  const aplicar = (next) => { setAjuste(next); salvarAjuste(next); };
  // Tirar da análise uma categoria que hoje conta.
  const tirar = (nome, forcada) => aplicar(forcada
    ? { ...ajuste, incluir: ajuste.incluir.filter((n) => n !== nome) }
    : { ...ajuste, excluir: semDup([...ajuste.excluir, nome]) });
  // Colocar de volta uma categoria que está fora.
  const colocar = (nome, motivo) => aplicar(motivo === "manual"
    ? { ...ajuste, excluir: ajuste.excluir.filter((n) => n !== nome) }
    : { ...ajuste, incluir: semDup([...ajuste.incluir, nome]) });

  const analise = useMemo(() => {
    const contasEscopo = escopoAtivo === "tudo"
      ? null
      : new Set(filtrarPorEscopo(contas || [], escopoAtivo).map((c) => c.nome));
    const tx = contasEscopo ? (transacoes || []).filter((t) => contasEscopo.has(t.conta)) : transacoes;
    return analiseGastosMes(tx || [], { excluir: ajuste.excluir, incluir: ajuste.incluir });
  }, [transacoes, contas, escopoAtivo, ajuste]);

  const { total, totalPct, categorias, foraDaAnalise, maiorAlta, mes } = analise;
  const sobe = totalPct != null && totalPct >= 0;
  const temAjuste = ajuste.excluir.length > 0 || ajuste.incluir.length > 0;

  if (!categorias.length && !foraDaAnalise.length) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: T.faint, fontSize: 13, fontStyle: "italic" }}>
        Nenhum gasto de consumo em {nomeMes(mes)}. (Investimentos, transferências e depósitos ficam de fora.)
      </div>
    );
  }

  const chipBtn = (extra = {}) => ({
    display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 100,
    border: `1px solid ${T.border}`, background: T.bgSoft, color: T.muted, fontSize: 11.5, fontWeight: 600,
    cursor: "pointer", ...extra,
  });

  return (
    <div>
      {/* Topo: total do mês + variação */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>
            Gasto do mês · {nomeMes(mes)}
          </div>
          <div className="num" style={{ fontSize: 26, fontWeight: 800, color: T.ink, marginTop: 2 }}>{oculto(total, hidden)}</div>
        </div>
        {totalPct != null && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 5, color: sobe ? T.red : T.green, fontWeight: 700, fontSize: 13 }}>
            {sobe ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
            {pctStr(totalPct)} vs mês anterior
          </div>
        )}
      </div>

      {/* Destaque: maior alta */}
      {maiorAlta && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", marginBottom: 12, background: `${T.yellow}1a`, border: `1px solid ${T.yellow}55`, borderRadius: 10, color: T.ink, fontSize: 12.5 }}>
          <AlertTriangle size={14} style={{ color: T.yellow, flexShrink: 0 }} />
          <span><b>{maiorAlta.nome}</b> foi o que mais subiu: {oculto(maiorAlta.valor - maiorAlta.valorAnterior, hidden)} a mais{maiorAlta.variacao != null ? ` (${pctStr(maiorAlta.variacao)})` : ""}.</span>
        </div>
      )}

      {/* Cabeçalho da lista + botão Ajustar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PieChart size={14} style={{ color: T.gold }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>Por categoria</span>
        </div>
        <button onClick={() => setEditar((v) => !v)} style={chipBtn(editar ? { background: `${T.gold}22`, color: T.gold, borderColor: `${T.gold}55` } : {})}>
          <SlidersHorizontal size={12} /> {editar ? "Concluir" : "Ajustar"}
        </button>
      </div>

      {/* Lista por categoria */}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {categorias.map((c) => {
          const subiu = c.variacao != null && c.variacao >= 0;
          return (
            <div key={c.nome}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12.5, marginBottom: 3, gap: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.ink, fontWeight: 600, minWidth: 0 }}>
                  {editar && (
                    <button onClick={() => tirar(c.nome, c.forcada)} title="Tirar da análise"
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 6, border: "none", background: `${T.red}18`, color: T.red, cursor: "pointer", flexShrink: 0 }}>
                      <X size={12} />
                    </button>
                  )}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nome}</span>
                  {c.forcada && (
                    <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 100, background: `${T.gold}22`, color: T.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", flexShrink: 0 }}>avulso</span>
                  )}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  {c.nova ? (
                    <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 100, background: `${T.blue || "#5b9bd5"}22`, color: T.blue || "#5b9bd5", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>novo</span>
                  ) : c.variacao != null ? (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: subiu ? T.red : T.green }}>{pctStr(c.variacao)}</span>
                  ) : null}
                  <span className="num" style={{ color: T.muted, minWidth: 90, textAlign: "right" }}>{oculto(c.valor, hidden)}</span>
                  <span style={{ color: T.faint, fontSize: 11, minWidth: 34, textAlign: "right" }}>{c.pct.toFixed(0)}%</span>
                </span>
              </div>
              <div style={{ height: 7, background: T.bgSoft, borderRadius: 5, overflow: "hidden" }}>
                <div style={{ width: `${c.pct}%`, height: "100%", background: c.forcada ? T.blue || "#5b9bd5" : T.gold, borderRadius: 5 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Editor: colocar de volta o que está fora da análise */}
      {editar && foraDaAnalise.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${T.border}` }}>
          <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, marginBottom: 7 }}>
            Fora da análise <span style={{ color: T.faint, fontWeight: 500 }}>— toque em + para colocar no gasto</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {foraDaAnalise.map((f) => (
              <button key={f.nome} onClick={() => colocar(f.nome, f.motivo)}
                title={f.motivo === "movimentacao" ? "Movimentação (normalmente fora) — colocar mesmo assim" : "Você tirou — colocar de volta"}
                style={chipBtn()}>
                <Plus size={12} style={{ color: T.green }} />
                <span style={{ color: T.ink }}>{f.nome}</span>
                <span className="num" style={{ color: T.faint }}>{oculto(f.valor, hidden)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: T.faint, marginTop: 10, fontStyle: "italic" }}>
        Só gasto de consumo — investimentos, transferências e depósitos ficam de fora
        {temAjuste ? ", fora os ajustes que você fez." : "."}
      </div>
    </div>
  );
}
