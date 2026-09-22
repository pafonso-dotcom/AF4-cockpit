import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Search, Printer, BarChart3, Brain, Sparkles, TrendingUp, Tag } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, fmtN } from "../../lib/format.js";
import { MESES_LONGO } from "../../lib/meses.js";
import { relatorioMensal, mesAnteriorISO, posicaoConsolidada, leituraConsultor } from "../../lib/relatorioMensal.js";
import { gerarPDFMensal } from "../../lib/relatorioMensalPDF.js";
import { mapaGastosDeItens, insightFimDeSemana } from "../../lib/gastosCalendario.js";
import { getDespesasDoMes } from "../../lib/agregador.js";
import { saldoContaBRL } from "../../lib/cambio.js";
import { calcularScore } from "../../lib/intelligence.js";
import { escoparFinancas } from "../../lib/inteligenciaPainel.js";
import PageHeader from "../ui/PageHeader.jsx";
import Modal from "../ui/Modal.jsx";
import PesquisasFinancas from "./PesquisasFinancas.jsx";
import RelatoriosFinancas from "./RelatoriosFinancas.jsx";
import Inteligencia from "./Inteligencia.jsx";

const mesAtualISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const rotuloMes = (mesISO) => {
  const [y, m] = String(mesISO).split("-").map(Number);
  const nome = MESES_LONGO[(m || 1) - 1] || "";
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} ${y}`;
};
// Seção recolhível do rodapé — DEFINIDA FORA do componente pra não remontar
// os filhos (Relatórios/Inteligência têm estado próprio) a cada render.
function ExtraSec({ on, onToggle, icon: Icon, titulo, desc, children }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, marginBottom: 10, overflow: "hidden" }}>
      <button onClick={onToggle}
        style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                 padding: "12px 14px", background: on ? T.bgSoft : "transparent", border: "none", cursor: "pointer", textAlign: "left", color: T.ink }}>
        <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Icon size={15} style={{ color: on ? T.gold : T.muted, flexShrink: 0 }} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13, fontWeight: 700, color: on ? T.gold : T.ink }}>{titulo}</span>
            <span style={{ display: "block", fontSize: 11, color: T.faint, marginTop: 1 }}>{desc}</span>
          </span>
        </span>
        <ChevronDown size={16} style={{ color: on ? T.gold : T.muted, transform: on ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }} />
      </button>
      {on && <div className="analises-sec-body" style={{ padding: "0 14px 14px" }}>{children}</div>}
    </div>
  );
}

// Pagamento de fatura / transferência: fora do drill (mesma regra do motor).
const foraDoGasto = (t) =>
  !t || t.transferenciaId || t.foraDoRelatorio
  || /transf/i.test(t.categoria || "")
  || t.origem === "fatura-pagamento" || /pagamento\s+(de\s+)?fatura/i.test(t.descricao || "");

/**
 * ANÁLISE DO MÊS — tela ÚNICA que substitui o acordeão de 5 seções
 * (unificação decidida em 2026-09-22, inspirada em Monarch/Copilot/YNAB):
 *   resposta primeiro (KPIs com comparação) → leitura do consultor →
 *   gastos por categoria com drill-down → extras recolhidos.
 * A busca livre (Pesquisas) virou modal; o PDF é um botão só.
 */
export default function AnalisesFinancas(props) {
  const {
    transacoes = [], contas = [], categorias = [], ativos = [], carteiraProventos,
    fixas = [], fixaOcorrencias = [], parcelamentos = [], dividas = [], devedores = [],
    cheques = [], cartoes = [], metas = [], proventosManuais = [],
    patrimonioHistorico = [], escopoAtivo = "tudo", hidden, onTabChange,
  } = props;

  const [mesISO, setMesISO] = useState(mesAtualISO);
  const [pesquisaAberta, setPesquisaAberta] = useState(false);
  const [catAberta, setCatAberta] = useState(null); // nome do pai expandido

  const shiftMes = (delta) => {
    const [y, m] = mesISO.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMesISO(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    setCatAberta(null);
  };

  const state = useMemo(
    () => ({ transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques }),
    [transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques]
  );
  const rel = useMemo(
    () => relatorioMensal(mesISO, state, escopoAtivo, patrimonioHistorico),
    [mesISO, state, escopoAtivo, patrimonioHistorico]
  );
  const relAnt = useMemo(
    () => relatorioMensal(mesAnteriorISO(mesISO), state, escopoAtivo, []),
    [mesISO, state, escopoAtivo]
  );
  const f = rel.financas;

  // Itens agregados do mês (fixas + parcelas + avulsas) pro drill-down.
  const despesasAgg = useMemo(() => {
    try { return (getDespesasDoMes(mesISO, state, escopoAtivo) || []).filter(t => !foraDoGasto(t)); }
    catch { return []; }
  }, [mesISO, state, escopoAtivo]);

  // Leitura do consultor (mesmas frases do PDF, agora na tela).
  const frases = useMemo(() => {
    const mapaG = mapaGastosDeItens(despesasAgg, { categorias, ym: mesISO });
    return leituraConsultor({
      financas: f, mesISO, mapaGastos: mapaG,
      insightFds: insightFimDeSemana(mapaG.porDia, mesISO),
      fmt: (v) => (hidden ? "•••" : fmt(v)),
    });
  }, [despesasAgg, categorias, mesISO, f, hidden]);

  // Score financeiro — selo pequeno no topo (o card completo fica em "Mais análises").
  const score = useMemo(() => {
    try {
      const fin = escoparFinancas(transacoes, contas, escopoAtivo);
      return calcularScore(fin.transacoes, fin.contas, ativos, cartoes, parcelamentos, metas);
    } catch { return null; }
  }, [transacoes, contas, escopoAtivo, ativos, cartoes, parcelamentos, metas]);

  // Categorias (pai) por valor desc + delta vs mês anterior + orçamento.
  const gastoAntPorPai = useMemo(() => {
    const m = {};
    (relAnt.financas?.categoriasGeral || []).forEach(p => { m[p.nome] = p.valor; });
    return m;
  }, [relAnt]);
  const pais = useMemo(
    () => [...(f.categoriasGeral || [])].sort((a, b) => b.valor - a.valor),
    [f]
  );
  const maxPai = Math.max(1, ...pais.map(p => p.valor));
  const limiteDe = (nome) => {
    const c = (categorias || []).find(x => x.nome === nome);
    return Number(c?.limite) > 0 ? Number(c.limite) : null;
  };

  // Tendência · últimos 6 meses (receitas × despesas × sobra) — o motor
  // mensal roda uma vez por mês da janela (memoizado; só recalcula se os
  // dados ou o mês selecionado mudarem).
  const tendencia = useMemo(() => {
    const [y, m] = mesISO.split("-").map(Number);
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      let r = null;
      try { r = relatorioMensal(iso, state, escopoAtivo, []); } catch { r = null; }
      out.push({
        iso,
        label: (MESES_LONGO[d.getMonth()] || "").slice(0, 3),
        receitas: r?.financas?.receitas || 0,
        despesas: r?.financas?.despesas || 0,
        sobra: r?.financas?.sobra || 0,
      });
    }
    return out;
  }, [mesISO, state, escopoAtivo]);
  const maxTend = Math.max(1, ...tendencia.flatMap(t => [t.receitas, t.despesas]));

  const gerarPDF = () => {
    const mapaG = mapaGastosDeItens(despesasAgg, { categorias, ym: mesISO });
    gerarPDFMensal({
      mesISO, rel, escopoAtivo,
      frases: leituraConsultor({
        financas: f, mesISO, mapaGastos: mapaG,
        insightFds: insightFimDeSemana(mapaG.porDia, mesISO), fmt,
      }),
      pos: posicaoConsolidada({ contas, ativos, parcelamentos, carteiraProventos, saldoContaBRL }),
    });
  };

  const mask = (v) => (hidden ? "•••••" : fmt(v));
  const deltaTag = (pct, invertido = false) => {
    if (pct == null || !Number.isFinite(pct)) return null;
    const subiu = pct >= 0;
    const ruim = invertido ? subiu : !subiu;
    return (
      <span className="num" style={{ fontSize: 10.5, fontWeight: 700, color: ruim ? T.red : T.green }}>
        {subiu ? "▲" : "▼"} {fmtN(Math.abs(pct), 0)}% vs mês ant.
      </span>
    );
  };

  /* ===== Seções recolhíveis — TODAS abrem e fecham (pedido 2026-09-22);
     o que você deixa aberto fica salvo. Padrão: consultor + categorias. ===== */
  const KEY = "af4:analise-secoes:v3";
  const [abertos, setAbertos] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) || '["consultor","categorias"]')); }
    catch { return new Set(["consultor", "categorias"]); }
  });
  const toggle = (id) => setAbertos(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    try { localStorage.setItem(KEY, JSON.stringify([...n])); } catch {}
    return n;
  });
  const extra = (id) => ({ on: abertos.has(id), onToggle: () => toggle(id) });

  return (
    <div className="fade-up py-6 px-6 analises-hub">
      <style>{`
        @media (max-width: 768px) {
          .analises-hub { padding-left: 8px !important; padding-right: 8px !important; }
          .analises-hub .analises-sec-body { padding-left: 4px !important; padding-right: 4px !important; }
          .an-kpis { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <PageHeader
        eyebrow="Finanças"
        title={<>Análise do <em>mês.</em></>}
        sub="Pra onde foi o dinheiro, em uma tela: resumo, leitura do consultor e categorias com detalhe. O PDF completo sai num botão."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            {score && (
              <span title={`Score financeiro: ${score.total}/1000 (${score.nivel}) — detalhes em Mais análises`}
                    className="num"
                    style={{ fontSize: 11.5, fontWeight: 700, color: T.gold, border: `1px solid ${T.gold}55`,
                             background: `${T.gold}11`, borderRadius: 100, padding: "4px 11px" }}>
                ⭐ {hidden ? "•••" : score.total}
              </span>
            )}
            <button className="btn-ghost" onClick={() => setPesquisaAberta(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Search size={13} /> Pesquisar
            </button>
            <button className="btn-gold" onClick={gerarPDF} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Printer size={13} /> PDF do mês
            </button>
          </div>
        }
      />

      {/* Seletor de mês — vale pra tela inteira */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 14px" }}>
        <button onClick={() => shiftMes(-1)} className="btn-ghost" aria-label="Mês anterior" style={{ padding: "6px 10px" }}><ChevronLeft size={15} /></button>
        <span style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 600, color: T.ink, minWidth: 170, textAlign: "center" }}>{rotuloMes(mesISO)}</span>
        <button onClick={() => shiftMes(1)} className="btn-ghost" aria-label="Próximo mês" style={{ padding: "6px 10px" }}><ChevronRight size={15} /></button>
        {mesISO !== mesAtualISO() && (
          <button onClick={() => { setMesISO(mesAtualISO()); setCatAberta(null); }} className="btn-ghost" style={{ fontSize: 11 }}>hoje</button>
        )}
      </div>

      {/* KPIs — resposta primeiro, cada número com comparação */}
      <div className="an-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 12 }}>
        {[
          { l: "Receitas", v: f.receitas, cor: T.green, delta: f.deltaReceitas, inv: false },
          { l: "Despesas", v: f.despesas, cor: T.red, delta: f.deltaDespesas, inv: true },
          { l: f.sobra >= 0 ? "Sobrou" : "Faltou", v: Math.abs(f.sobra), cor: f.sobra >= 0 ? T.green : T.red,
            deltaAbs: f.deltaSobra },
        ].map((k, i) => (
          <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${k.cor}`, borderRadius: 14, padding: "12px 14px" }}>
            <div className="label-eyebrow">{k.l}</div>
            <div className="num" style={{ fontFamily: T.serif, fontSize: 24, fontWeight: 700, color: k.cor, marginTop: 3 }}>{mask(k.v)}</div>
            <div style={{ marginTop: 3, minHeight: 14 }}>
              {k.delta != null && deltaTag(k.delta, k.inv)}
              {k.deltaAbs != null && Math.abs(k.deltaAbs) > 0.005 && (
                <span className="num" style={{ fontSize: 10.5, fontWeight: 700, color: k.deltaAbs >= 0 ? T.green : T.red }}>
                  {k.deltaAbs >= 0 ? "▲ +" : "▼ −"}{hidden ? "•••" : fmt(Math.abs(k.deltaAbs))} vs mês ant.
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Leitura do consultor — recolhível */}
      {frases.length > 0 && (
        <ExtraSec {...extra("consultor")} icon={Sparkles} titulo="Leitura do consultor"
                  desc="O que os números do mês estão dizendo, em frases diretas.">
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {frases.map((x, i) => (
              <div key={i} style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5, paddingLeft: 14, position: "relative" }}>
                <span style={{ position: "absolute", left: 0, color: T.gold, fontSize: 9, top: 4 }}>◆</span>{x}
              </div>
            ))}
          </div>
        </ExtraSec>
      )}

      {/* TENDÊNCIA · últimos 6 meses — recolhível */}
      {tendencia.some(t => t.receitas > 0 || t.despesas > 0) && (
        <ExtraSec {...extra("tendencia")} icon={TrendingUp} titulo="Tendência · últimos 6 meses"
                  desc="Receitas (verde) × despesas (vermelho) mês a mês, com a sobra embaixo.">
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${tendencia.length}, 1fr)`, gap: 8, alignItems: "end" }}>
            {tendencia.map(t => {
              const atual = t.iso === mesISO;
              return (
                <div key={t.iso} title={`${t.label}: receitas ${fmt(t.receitas)} · despesas ${fmt(t.despesas)} · ${t.sobra >= 0 ? "sobrou" : "faltou"} ${fmt(Math.abs(t.sobra))}`}
                     style={{ textAlign: "center", opacity: atual ? 1 : 0.85 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3, height: 72 }}>
                    <div style={{ width: 12, borderRadius: "4px 4px 0 0", background: T.green, height: `${Math.max(2, (t.receitas / maxTend) * 100)}%` }} />
                    <div style={{ width: 12, borderRadius: "4px 4px 0 0", background: T.red, height: `${Math.max(2, (t.despesas / maxTend) * 100)}%` }} />
                  </div>
                  <div style={{ fontSize: 10, color: atual ? T.gold : T.muted, fontWeight: atual ? 700 : 500, marginTop: 4, textTransform: "capitalize" }}>{t.label}</div>
                  <div className="num" style={{ fontSize: 9.5, fontWeight: 700, color: t.sobra >= 0 ? T.green : T.red }}>
                    {hidden ? "•••" : `${t.sobra >= 0 ? "+" : "−"}${Math.round(Math.abs(t.sobra)).toLocaleString("pt-BR")}`}
                  </div>
                </div>
              );
            })}
          </div>
        </ExtraSec>
      )}

      {/* GASTOS POR CATEGORIA — o coração: barra + % + delta + drill-down (recolhível) */}
      <ExtraSec {...extra("categorias")} icon={Tag} titulo="Gastos por categoria"
                desc={`Bancos + cartões · total ${mask(f.despesasGeral)} — toque numa categoria pra abrir os lançamentos.`}>
        {pais.length === 0 ? (
          <div style={{ color: T.muted, fontStyle: "italic", fontSize: 12.5, padding: "12px 0" }}>Sem gastos neste mês.</div>
        ) : pais.map(p => {
          const aberto = catAberta === p.nome;
          const limite = limiteDe(p.nome);
          const pctLimite = limite ? (p.valor / limite) * 100 : null;
          const corBarra = pctLimite == null ? T.gold : pctLimite >= 100 ? T.red : pctLimite >= 80 ? T.gold : T.green;
          const ant = gastoAntPorPai[p.nome];
          const deltaCat = ant > 0 ? ((p.valor - ant) / ant) * 100 : null;
          // Drill nos MESMOS itens do ranking (f.itensConsumo inclui o que está
          // dentro da fatura importada). O grupo inclui as FILHAS da categoria
          // (o ranking soma filha na mãe) — assim a lista bate com a barra.
          const catRaiz = aberto ? (categorias || []).find(c => c.nome === p.nome) : null;
          const nomesGrupo = aberto
            ? new Set([p.nome, ...(catRaiz ? (categorias || []).filter(c => c.parentId === catRaiz.id).map(c => c.nome) : [])])
            : null;
          const itensDaCat = aberto
            ? (f.itensConsumo || despesasAgg).filter(t => nomesGrupo.has(String(t.categoria || "").trim() || "Outros"))
                .sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0))
            : [];
          return (
            <div key={p.nome} style={{ borderTop: `1px solid ${T.border}` }}>
              <button onClick={() => setCatAberta(aberto ? null : p.nome)}
                      style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: "9px 0", color: T.ink }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: "0 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</span>
                  <span style={{ fontSize: 10.5, color: T.faint, flexShrink: 0 }}>{fmtN(p.pct, 0)}%</span>
                  {deltaCat != null && Math.abs(deltaCat) >= 1 && (
                    <span className="num" style={{ fontSize: 10, fontWeight: 700, flexShrink: 0, color: deltaCat >= 0 ? T.red : T.green }}>
                      {deltaCat >= 0 ? "▲" : "▼"}{fmtN(Math.abs(deltaCat), 0)}%
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span className="num" style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{mask(p.valor)}</span>
                  <ChevronDown size={14} style={{ color: aberto ? T.gold : T.muted, transform: aberto ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }} />
                </div>
                <div style={{ height: 6, borderRadius: 6, background: T.bgSoft, overflow: "hidden", marginTop: 6 }}
                     title={limite ? `Orçamento: ${fmt(limite)} · usado ${fmtN(pctLimite, 0)}%` : `${fmtN(p.pct, 0)}% dos gastos do mês`}>
                  <div style={{ width: `${Math.min(100, limite ? pctLimite : (p.valor / maxPai) * 100)}%`, height: "100%", background: corBarra, borderRadius: 6 }} />
                </div>
                {limite && (
                  <div style={{ fontSize: 10, color: pctLimite >= 100 ? T.red : T.faint, marginTop: 3 }}>
                    orçamento {mask(limite)} · {fmtN(pctLimite, 0)}% usado{pctLimite >= 100 ? " — ESTOUROU" : ""}
                  </div>
                )}
              </button>
              {aberto && (
                <div style={{ padding: "0 0 10px 8px" }}>
                  {p.filhos?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      {p.filhos.map(fi => (
                        <span key={fi.nome} className="num" style={{ fontSize: 10.5, color: T.muted, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 100, padding: "2px 9px" }}>
                          {fi.nome} · {mask(fi.valor)}
                        </span>
                      ))}
                    </div>
                  )}
                  {itensDaCat.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: T.faint, fontStyle: "italic" }}>Sem lançamentos detalhados nesta categoria.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 300, overflowY: "auto" }}>
                      {itensDaCat.map((t, i) => (
                        <div key={t.id || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: T.bgSoft, borderRadius: 10 }}>
                          <span className="num" style={{ fontSize: 10.5, color: T.faint, flexShrink: 0, minWidth: 40 }}>
                            {String(t.data || "").slice(8, 10)}/{String(t.data || "").slice(5, 7)}
                          </span>
                          <span style={{ fontSize: 12, color: T.ink, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.descricao || "—"}
                            {t.subcategoria ? <span style={{ color: T.faint }}> · {t.subcategoria}</span> : ""}
                          </span>
                          {t.status === "paga"
                            ? <span style={{ fontSize: 9.5, color: T.green, flexShrink: 0 }}>✓ paga</span>
                            : t.status ? <span style={{ fontSize: 9.5, color: T.gold, flexShrink: 0 }}>pendente</span> : null}
                          <span className="num" style={{ fontSize: 12.5, fontWeight: 600, color: T.red, flexShrink: 0 }}>{mask(t.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </ExtraSec>

      {/* EXTRAS — recolhidos por padrão, pra tela não virar feira */}
      <ExtraSec {...extra("projecao")} icon={BarChart3} titulo="Projeção & matriz por categoria"
                desc="Meses a vencer por categoria (matriz), receita × despesa e evolução do patrimônio.">
        <RelatoriosFinancas
          transacoes={transacoes} contas={contas} categorias={categorias}
          fixas={fixas} fixaOcorrencias={fixaOcorrencias}
          parcelamentos={parcelamentos} dividas={dividas} devedores={devedores}
          cheques={cheques} cartoes={cartoes}
          patrimonioHistorico={patrimonioHistorico}
          escopoAtivo={escopoAtivo} hidden={hidden} embed />
      </ExtraSec>
      <ExtraSec {...extra("mais")} icon={Brain} titulo="Mais análises"
                desc="Score detalhado, assinaturas detectadas, projeção de caixa, saúde da carteira e análise com IA.">
        <Inteligencia
          transacoes={transacoes} contas={contas} ativos={ativos}
          cartoes={cartoes} parcelamentos={parcelamentos} metas={metas}
          fixas={fixas}
          escopoAtivo={escopoAtivo} hidden={hidden} onTabChange={onTabChange} embed />
      </ExtraSec>
      {/* Histórico de alterações mudou pra Configurações → Backup (auditoria
          técnica não é análise de gasto). */}

      {/* MODAL: Pesquisas (busca livre) */}
      {pesquisaAberta && (
        <Modal title="🔎 Pesquisar · relatórios diversos" onClose={() => setPesquisaAberta(false)}>
          <PesquisasFinancas
            transacoes={transacoes} categorias={categorias} contas={contas}
            proventosManuais={proventosManuais}
            hidden={hidden} embed />
        </Modal>
      )}
    </div>
  );
}
