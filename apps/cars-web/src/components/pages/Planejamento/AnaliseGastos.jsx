import React, { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, PieChart, SlidersHorizontal, X, Plus, ChevronRight, ChevronDown, ChevronLeft, Target } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import { MESES_LONGO } from "../../../lib/meses.js";
import { getDespesasDoMes } from "../../../lib/agregador.js";
import { analiseGastosMes, mesAnterior } from "../../../lib/analiseGastos.js";

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

// Chip de variação (sobe = vermelho, cai = verde) ou selo "novo".
function Variacao({ nova, variacao }) {
  if (nova) {
    return <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 100, background: `${T.blue || "#5b9bd5"}22`, color: T.blue || "#5b9bd5", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>novo</span>;
  }
  if (variacao == null) return null;
  const subiu = variacao >= 0;
  return <span style={{ fontSize: 10.5, fontWeight: 700, color: subiu ? T.red : T.green }}>{pctStr(variacao)}</span>;
}

// Análise de GASTO por categoria do mês (só consumo), agrupada por categoria-pai
// com as subcategorias dentro. Fonte: getDespesasDoMes (transações + fixas +
// parcelas de cartão + dívidas). Respeita o escopo ativo.
export default function AnaliseGastos(props) {
  const { escopoAtivo = "tudo", hidden = false, categorias = [], onVerCategoria, setCategorias } = props;
  const podeAbrir = typeof onVerCategoria === "function";
  const podeOrcar = typeof setCategorias === "function";
  const [ajuste, setAjuste] = useState(lerAjuste);
  const [editar, setEditar] = useState(false);
  const [orcarModo, setOrcarModo] = useState(false);
  const [abertos, setAbertos] = useState({}); // grupos expandidos

  // Categoria de despesa registrada com esse nome (pra ler/gravar o limite mensal).
  const catDespPorNome = (nome) => (categorias || []).find((c) => c.nome === nome && (!c.tipo || c.tipo === "despesa"));
  const setLimite = (nome, valor) => {
    if (!podeOrcar) return;
    const cat = catDespPorNome(nome);
    if (!cat) return;
    const lim = valor === "" || valor == null ? null : Number(valor);
    setCategorias((categorias || []).map((c) => (c.id === cat.id ? { ...c, limite: Number.isFinite(lim) ? lim : null } : c)));
  };
  // Mês em análise (navegável). Default: mês atual.
  const mesAtualISO = new Date().toISOString().slice(0, 7);
  const [mesSel, setMesSel] = useState(mesAtualISO);
  const passoMes = (delta) => {
    const [y, m] = mesSel.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMesSel(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const aplicar = (next) => { setAjuste(next); salvarAjuste(next); };
  const addExcluir = (nomes) => aplicar({ incluir: ajuste.incluir.filter((n) => !nomes.includes(n)), excluir: semDup([...ajuste.excluir, ...nomes]) });
  const tirar = (nome, forcada) => aplicar(forcada
    ? { ...ajuste, incluir: ajuste.incluir.filter((n) => n !== nome) }
    : { ...ajuste, excluir: semDup([...ajuste.excluir, nome]) });
  const colocar = (nome, motivo) => aplicar(motivo === "manual"
    ? { ...ajuste, excluir: ajuste.excluir.filter((n) => n !== nome) }
    : { ...ajuste, incluir: semDup([...ajuste.incluir, nome]) });
  const toggleGrupo = (nome) => setAbertos((s) => ({ ...s, [nome]: !s[nome] }));

  const analise = useMemo(() => {
    const state = {
      transacoes: props.transacoes || [], fixas: props.fixas || [], fixaOcorrencias: props.fixaOcorrencias || [],
      dividas: props.dividas || [], parcelamentos: props.parcelamentos || [], contas: props.contas || [],
      categorias: props.categorias || [], devedores: props.devedores || [], cheques: props.cheques || [],
    };
    const mes = mesSel;
    const mesAnt = mesAnterior(mes);
    let itensMes = [], itensMesAnt = [];
    try { itensMes = getDespesasDoMes(mes, state, escopoAtivo); } catch {}
    try { itensMesAnt = getDespesasDoMes(mesAnt, state, escopoAtivo); } catch {}
    const cadastro = (categorias || []).filter((c) => !c.tipo || c.tipo === "despesa");
    return analiseGastosMes(itensMes, itensMesAnt, { mes, mesAnt, excluir: ajuste.excluir, incluir: ajuste.incluir, categorias: cadastro });
  }, [props.transacoes, props.fixas, props.fixaOcorrencias, props.dividas, props.parcelamentos, props.contas, props.devedores, props.cheques, categorias, escopoAtivo, ajuste, mesSel]);

  const { total, totalPct, grupos, foraDaAnalise, maiorAlta, mes } = analise;
  const sobe = totalPct != null && totalPct >= 0;
  const temAjuste = ajuste.excluir.length > 0 || ajuste.incluir.length > 0;

  const vazio = !grupos.length && !foraDaAnalise.length;

  const chipBtn = (extra = {}) => ({
    display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 100,
    border: `1px solid ${T.border}`, background: T.bgSoft, color: T.muted, fontSize: 11.5, fontWeight: 600,
    cursor: "pointer", ...extra,
  });
  const botaoX = (onClick, titulo) => (
    <button onClick={onClick} title={titulo}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 6, border: "none", background: `${T.red}18`, color: T.red, cursor: "pointer", flexShrink: 0 }}>
      <X size={12} />
    </button>
  );
  // Nome de categoria: clicável (abre Transações filtrada) fora do modo Ajustar.
  const NomeFolha = ({ nome, style }) => (
    podeAbrir && !editar ? (
      <button onClick={() => onVerCategoria(nome)} title={`Ver transações de "${nome}"`}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", color: "inherit", font: "inherit", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "underline", textDecorationColor: T.border, textUnderlineOffset: 2, ...style }}>
        {nome}
      </button>
    ) : (
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...style }}>{nome}</span>
    )
  );

  return (
    <div>
      {/* Topo: total do mês + variação + navegação de mês */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => passoMes(-1)} aria-label="Mês anterior"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 7, border: `1px solid ${T.border}`, background: T.bgSoft, color: T.muted, cursor: "pointer", flexShrink: 0 }}>
              <ChevronLeft size={14} />
            </button>
            <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, fontWeight: 600, minWidth: 128, textAlign: "center" }}>
              Gasto do mês · {nomeMes(mes)}
            </div>
            <button onClick={() => passoMes(1)} aria-label="Próximo mês"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 7, border: `1px solid ${T.border}`, background: T.bgSoft, color: T.muted, cursor: "pointer", flexShrink: 0 }}>
              <ChevronRight size={14} />
            </button>
            {mes !== mesAtualISO && (
              <button onClick={() => setMesSel(mesAtualISO)} title="Voltar pro mês atual"
                style={{ ...chipBtn(), padding: "2px 8px", fontSize: 10 }}>hoje</button>
            )}
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

      {vazio && (
        <div style={{ padding: 20, textAlign: "center", color: T.faint, fontSize: 13, fontStyle: "italic" }}>
          Nenhum gasto de consumo em {nomeMes(mes)}. (Investimentos, transferências e depósitos ficam de fora.)
        </div>
      )}

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
        <div style={{ display: "inline-flex", gap: 6 }}>
          {podeOrcar && (
            <button onClick={() => { setOrcarModo((v) => !v); setEditar(false); }} style={chipBtn(orcarModo ? { background: `${T.gold}22`, color: T.gold, borderColor: `${T.gold}55` } : {})}>
              <Target size={12} /> {orcarModo ? "Concluir" : "Orçamento"}
            </button>
          )}
          <button onClick={() => { setEditar((v) => !v); setOrcarModo(false); }} style={chipBtn(editar ? { background: `${T.gold}22`, color: T.gold, borderColor: `${T.gold}55` } : {})}>
            <SlidersHorizontal size={12} /> {editar ? "Concluir" : "Ajustar"}
          </button>
        </div>
      </div>

      {/* Grupos (pai) com subcategorias */}
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {grupos.map((g) => {
          const aberto = !!abertos[g.nome];
          const temFilhos = !g.solo && g.filhos.length > 0;
          return (
            <div key={g.nome}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12.5, marginBottom: 3, gap: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.ink, fontWeight: 700, minWidth: 0 }}>
                  {editar && botaoX(() => addExcluir(g.filhos.map((f) => f.nome)), "Tirar o grupo inteiro da análise")}
                  {temFilhos ? (
                    <button onClick={() => toggleGrupo(g.nome)} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, cursor: "pointer", color: T.ink, fontWeight: 700, minWidth: 0 }}>
                      {aberto ? <ChevronDown size={13} style={{ color: T.muted }} /> : <ChevronRight size={13} style={{ color: T.muted }} />}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.nome}</span>
                      <span style={{ fontSize: 10, color: T.faint, fontWeight: 500 }}>· {g.filhos.length}</span>
                    </button>
                  ) : (
                    <NomeFolha nome={g.nome} />
                  )}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <Variacao nova={g.nova} variacao={g.variacao} />
                  <span className="num" style={{ color: T.ink, fontWeight: 700, minWidth: 90, textAlign: "right" }}>{oculto(g.valor, hidden)}</span>
                  <span style={{ color: T.faint, fontSize: 11, minWidth: 34, textAlign: "right" }}>{g.pct.toFixed(0)}%</span>
                </span>
              </div>
              <div style={{ height: 7, background: T.bgSoft, borderRadius: 5, overflow: "hidden" }}>
                <div style={{ width: `${g.pct}%`, height: "100%", background: T.gold, borderRadius: 5 }} />
              </div>

              {/* Orçamento: definir limite (modo Orçamento) ou barra gasto vs limite */}
              {(() => {
                const cat = catDespPorNome(g.nome);
                if (orcarModo) {
                  if (!cat) return null;
                  return (
                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.muted }}>
                      <Target size={11} style={{ color: T.gold }} />
                      <span>Limite mensal · R$</span>
                      <input type="number" step="0.01" defaultValue={cat.limite ?? ""} placeholder="sem limite"
                        onBlur={(e) => setLimite(g.nome, e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                        style={{ width: 100, padding: "3px 7px", fontSize: 12, borderRadius: 7, border: `1px solid ${T.border}`, background: T.bgSoft, color: T.ink }} />
                    </div>
                  );
                }
                const limite = Number(cat?.limite) || 0;
                if (limite <= 0) return null;
                const pctL = (g.valor / limite) * 100;
                const cor = pctL >= 100 ? T.red : pctL >= 80 ? T.gold : T.green;
                return (
                  <div style={{ marginTop: 5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.muted, marginBottom: 2 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Target size={10} style={{ color: cor }} /> Orçamento</span>
                      <span className="num" style={{ color: cor, fontWeight: 700 }}>{oculto(g.valor, hidden)} / {oculto(limite, hidden)} · {pctL.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 5, background: T.bgSoft, borderRadius: 5, overflow: "hidden" }}>
                      <div style={{ width: `${Math.min(100, pctL)}%`, height: "100%", background: cor, borderRadius: 5 }} />
                    </div>
                  </div>
                );
              })()}

              {/* Subcategorias */}
              {temFilhos && aberto && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 7, paddingLeft: 14, borderLeft: `2px solid ${T.border}`, marginLeft: 6 }}>
                  {g.filhos.map((f) => (
                    <div key={f.nome} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 12, gap: 8 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.muted, minWidth: 0 }}>
                        {editar && botaoX(() => tirar(f.nome, f.forcada), "Tirar da análise")}
                        <NomeFolha nome={f.nome} />
                        {f.forcada && <span title="Colocada à mão na análise — normalmente ficaria de fora. Use o botão Ajustar pra tirar." style={{ fontSize: 8.5, padding: "1px 5px", borderRadius: 100, background: `${T.gold}22`, color: T.gold, fontWeight: 700, textTransform: "uppercase", cursor: "help" }}>avulso</span>}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                        <Variacao nova={f.nova} variacao={f.variacao} />
                        <span className="num" style={{ color: T.muted, minWidth: 84, textAlign: "right" }}>{oculto(f.valor, hidden)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, maxHeight: 240, overflowY: "auto" }}>
            {foraDaAnalise.map((f) => {
              const titulo = f.motivo === "movimentacao"
                ? "Movimentação (normalmente fora) — colocar mesmo assim"
                : f.motivo === "manual" ? "Você tirou — colocar de volta"
                : "Sem gasto neste mês — colocar na análise";
              return (
                <button key={f.nome} onClick={() => colocar(f.nome, f.motivo)} title={titulo} style={chipBtn()}>
                  <Plus size={12} style={{ color: T.green }} />
                  <span style={{ color: T.ink }}>{f.nome}</span>
                  {f.valor > 0 && <span className="num" style={{ color: T.faint }}>{oculto(f.valor, hidden)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ fontSize: 10, color: T.faint, marginTop: 10, fontStyle: "italic" }}>
        Só gasto de consumo (transações, fixas, cartão e dívidas) — investimentos, transferências e depósitos ficam de fora
        {temAjuste ? ", fora os ajustes que você fez." : "."}
      </div>
    </div>
  );
}
