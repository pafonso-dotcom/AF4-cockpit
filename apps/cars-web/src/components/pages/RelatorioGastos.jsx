import React, { useMemo, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Stethoscope, Puzzle, BarChart3, Repeat, Target, TrendingUp, Scissors, Sparkles, FileDown, Check, AlertTriangle } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt } from "../../lib/format.js";
import { MESES_LONGO } from "../../lib/meses.js";
import { getDespesasDoMes, getGanhosDoMes } from "../../lib/agregador.js";
import { totaisPorCategoria } from "../../lib/analiseGastos.js";
import { montarRelatorioGastos } from "../../lib/relatorioGastos.js";
import { promptDiagnostico } from "../../lib/diagnosticoGastos.js";
import { entradasDeRecebiveis } from "../../lib/entradas.js";
import { perguntarAoClaude } from "../../lib/aiChat.js";
import { filtrarPorEscopo } from "../../lib/escopo.js";
import { printHTML } from "../../lib/importExport.js";
import { SlidersHorizontal } from "lucide-react";

const PURPLE = "#8a6fb0";
const nomeMes = (iso) => { const [a, m] = (iso || "").split("-").map(Number); return `${MESES_LONGO[(m || 1) - 1]} ${a || ""}`; };
const pctStr = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`;
const semDup = (arr) => Array.from(new Set(arr));

// Ajuste de gastos é COMPARTILHADO com a Análise de gastos (mesma chave).
const GASTOS_KEY = "financas:analise-gastos:v1";
const ENTRADAS_KEY = "financas:relatorio-entradas:v1";
const lerAjuste = (key) => { try { const v = JSON.parse(localStorage.getItem(key) || "{}"); return { excluir: Array.isArray(v.excluir) ? v.excluir : [], incluir: Array.isArray(v.incluir) ? v.incluir : [] }; } catch { return { excluir: [], incluir: [] }; } };
const salvarAjuste = (key, a) => { try { localStorage.setItem(key, JSON.stringify(a)); } catch {} };

export default function RelatorioGastos(props) {
  const { escopoAtivo = "tudo", hidden = false, apiKey, embed = false } = props;
  const oculto = (v) => (hidden ? "•••" : fmt(v));

  const hoje = new Date();
  const mesAtualISO = hoje.toISOString().slice(0, 10).slice(0, 7);
  const hojeISO = hoje.toISOString().slice(0, 10);
  const [mesSel, setMesSel] = useState(mesAtualISO);
  const passo = (d) => { const [y, m] = mesSel.split("-").map(Number); const nd = new Date(y, m - 1 + d, 1); setMesSel(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`); };

  const [iaTexto, setIaTexto] = useState("");
  const [iaPensando, setIaPensando] = useState(false);
  const [iaErro, setIaErro] = useState("");
  useEffect(() => { setIaTexto(""); setIaErro(""); }, [mesSel]);

  // Livre escolha do que compõe gastos (compartilhado com a Análise) e entradas.
  const [gastosAj, setGastosAj] = useState(() => lerAjuste(GASTOS_KEY));
  const [entradasAj, setEntradasAj] = useState(() => lerAjuste(ENTRADAS_KEY));
  const [ajusteAberto, setAjusteAberto] = useState(false);
  const aplicarGastos = (a) => { setGastosAj(a); salvarAjuste(GASTOS_KEY, a); };
  const aplicarEntradas = (a) => { setEntradasAj(a); salvarAjuste(ENTRADAS_KEY, a); };
  const toggleCat = (aj, aplicar, cat, contada) => aplicar(contada
    ? { incluir: aj.incluir.filter((n) => n !== cat), excluir: semDup([...aj.excluir, cat]) }
    : { excluir: aj.excluir.filter((n) => n !== cat), incluir: semDup([...aj.incluir, cat]) });

  const { rel, entradas, gastosCats } = useMemo(() => {
    const state = {
      transacoes: props.transacoes || [], fixas: props.fixas || [], fixaOcorrencias: props.fixaOcorrencias || [],
      dividas: props.dividas || [], parcelamentos: props.parcelamentos || [], contas: props.contas || [],
      categorias: props.categorias || [], devedores: props.devedores || [], cheques: props.cheques || [],
    };
    const catsDe = (iso) => { let it = []; try { it = getDespesasDoMes(iso, state, escopoAtivo); } catch {} return totaisPorCategoria(it, gastosAj); };
    const [y, m] = mesSel.split("-").map(Number);
    const historicoCats = [];
    for (let i = 1; i <= 6; i++) { const d = new Date(y, m - 1 - i, 1); historicoCats.push(catsDe(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)); }
    let itensMes = []; try { itensMes = getDespesasDoMes(mesSel, state, escopoAtivo); } catch {}

    // Entradas pela MESMA base dos recebíveis do relatório (getGanhosDoMes):
    // cheques, parcelas a receber, juros, devedores, proventos, rendimentos e
    // transações de receita — recebido + a receber. Escopo já aplicado dentro.
    let ganhos = []; try { ganhos = getGanhosDoMes(mesSel, state, escopoAtivo); } catch {}
    const entradas = entradasDeRecebiveis(ganhos, entradasAj);

    const fixas = filtrarPorEscopo(props.fixas || [], escopoAtivo);
    const rel = montarRelatorioGastos({ itensMes, historicoCats, entradas, ajuste: gastosAj, categorias: props.categorias || [], fixas, hojeISO, ehMesCorrente: mesSel === mesAtualISO });

    // Lista de categorias de gasto (todas) pro Ajustar
    const rawG = {};
    itensMes.forEach((it) => { const c = it.categoria || "Outros"; rawG[c] = (rawG[c] || 0) + (Number(it.valor) || 0); });
    const contadas = new Set(Object.keys(totaisPorCategoria(itensMes, gastosAj)));
    const gastosCats = Object.entries(rawG).map(([categoria, valor]) => ({ categoria, valor, contada: contadas.has(categoria) })).sort((a, b) => b.valor - a.valor);

    return { rel, entradas, gastosCats };
  }, [props.transacoes, props.fixas, props.fixaOcorrencias, props.dividas, props.parcelamentos, props.contas, props.categorias, props.devedores, props.cheques, escopoAtivo, mesSel, gastosAj, entradasAj]);

  const aprofundarIA = async () => {
    if (!apiKey) { setIaErro("Configure a chave Anthropic em Configurações → API Keys."); return; }
    setIaPensando(true); setIaErro(""); setIaTexto("");
    try { setIaTexto(String(await perguntarAoClaude({ apiKey, pergunta: promptDiagnostico(rel, nomeMes(mesSel)), contextoDados: "" }) || "").trim()); }
    catch (e) { setIaErro(e?.message || "Falha ao consultar a IA."); }
    finally { setIaPensando(false); }
  };

  const exportarPDF = () => {
    const brl = (v) => `R$ ${Math.round(Number(v) || 0).toLocaleString("pt-BR")}`;
    const linha = (a, b) => `<tr><td>${a}</td><td class="n">${b}</td></tr>`;
    printHTML(`<!doctype html><html><head><meta charset="utf-8"><title>Relatório de gastos · ${nomeMes(mesSel)}</title>
<style>body{font-family:system-ui,sans-serif;color:#222;padding:24px}h1{font-size:20px;margin:0}h2{font-size:13px;margin:18px 0 6px;color:#555}table{width:100%;border-collapse:collapse;font-size:12px}td{padding:4px 6px;border-bottom:1px solid #eee}td.n{text-align:right;font-variant-numeric:tabular-nums}</style></head><body>
<h1>Relatório de gastos · ${nomeMes(mesSel)}</h1>
<h2>Resumo</h2><table>
${linha("Gasto do mês", brl(rel.totalMes))}${linha("Receita do mês", brl(rel.receitaMes))}
${linha("Taxa de consumo", rel.taxaConsumo != null ? `${rel.taxaConsumo.toFixed(0)}%` : "—")}${linha("Poupança", brl(rel.poupanca))}
${linha("Saúde do mês", rel.score != null ? `${rel.score}/100` : "—")}${rel.pctTotal != null ? linha("vs média 6 meses", pctStr(rel.pctTotal)) : ""}</table>
<h2>Composição</h2><table>${rel.composicao.map((c) => linha({ fixo: "Fixo/recorrente", cartao: "Cartão/parcelas", variavel: "Variável/avulso" }[c.classe], `${brl(c.valor)} · ${c.pct.toFixed(0)}%`)).join("")}</table>
<h2>Fora do padrão</h2><table>${rel.foraDoPadrao.slice(0, 8).map((i) => linha(i.categoria, `${brl(i.valor)} (média ${brl(i.media)})`)).join("") || "<tr><td>Nada fora da curva</td><td></td></tr>"}</table>
<h2>Sugestões de corte</h2><table>${rel.cortes.slice(0, 8).map((c) => linha(c.categoria, brl(c.economia))).join("") || "<tr><td>—</td><td></td></tr>"}${linha("<b>Potencial/mês</b>", `<b>${brl(rel.potencialTotal)}</b>`)}</table>
<p style="margin-top:16px;color:#888;font-size:11px">Gerado em ${new Date().toLocaleString("pt-BR")} · média dos últimos 6 meses · só gasto de consumo.</p>
</body></html>`);
  };

  // ---- estilos ----
  const card = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "14px 16px", marginBottom: 12 };
  const lbl = { fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: T.muted, fontWeight: 700, display: "flex", alignItems: "center", gap: 7, marginBottom: 10 };
  const chkCor = { ok: T.green, warn: T.gold, bad: T.red };
  const CompLabel = { fixo: "Fixo/recorrente", cartao: "Cartão/parcelas", variavel: "Variável/avulso" };
  const CompCor = { fixo: T.blue || "#5b86c4", cartao: PURPLE, variavel: T.gold };

  return (
    <div className={embed ? "" : "fade-up py-6 px-6"}>
      {/* Cabeçalho: mês + PDF */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => passo(-1)} aria-label="Mês anterior" style={navBtn}><ChevronLeft size={15} /></button>
          <span style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, textTransform: "capitalize", minWidth: 130, textAlign: "center" }}>{nomeMes(mesSel)}</span>
          <button onClick={() => passo(1)} aria-label="Próximo mês" style={navBtn}><ChevronRight size={15} /></button>
          {mesSel !== mesAtualISO && <button onClick={() => setMesSel(mesAtualISO)} style={{ ...navBtn, width: "auto", padding: "0 8px", fontSize: 11 }}>hoje</button>}
        </div>
        <div style={{ display: "inline-flex", gap: 6 }}>
          <button onClick={() => setAjusteAberto((v) => !v)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 9, border: `1px solid ${ajusteAberto ? T.gold + "66" : T.border}`, background: ajusteAberto ? `${T.gold}18` : T.bgSoft, color: ajusteAberto ? T.gold : T.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}><SlidersHorizontal size={13} /> {ajusteAberto ? "Concluir" : "Ajustar"}</button>
          <button onClick={exportarPDF} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.bgSoft, color: T.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}><FileDown size={13} /> PDF</button>
        </div>
      </div>

      {/* Ajustar: livre escolha do que compõe entradas e gastos */}
      {ajusteAberto && (
        <div style={card}>
          <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 10 }}>Toque numa categoria pra <b style={{ color: T.green }}>contar</b> ou <b style={{ color: T.muted }}>tirar</b>. Fica salvo. O ajuste de gastos vale também na Análise de gastos.</div>
          {[{ titulo: "Entradas", cor: T.green, itens: entradas.categorias, aj: entradasAj, aplicar: aplicarEntradas },
            { titulo: "Gastos", cor: T.red, itens: gastosCats, aj: gastosAj, aplicar: aplicarGastos }].map((grp) => (
            <div key={grp.titulo} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: grp.cor, fontWeight: 700, marginBottom: 6 }}>{grp.titulo}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {grp.itens.length === 0 && <span style={{ fontSize: 11.5, color: T.faint, fontStyle: "italic" }}>Nada neste mês.</span>}
                {grp.itens.map((it) => (
                  <button key={it.categoria} onClick={() => toggleCat(grp.aj, grp.aplicar, it.categoria, it.contada)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 100, cursor: "pointer", fontSize: 11, fontWeight: 600,
                      border: `1px solid ${it.contada ? grp.cor + "66" : T.border}`, background: it.contada ? `${grp.cor}14` : T.bgSoft, color: it.contada ? grp.cor : T.faint }}>
                    {it.contada ? "✓" : "＋"} {it.categoria} <span className="num" style={{ opacity: 0.7 }}>{oculto(it.valor)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 1. KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }} className="rg-kpis">
        {[
          { k: "Gasto do mês", v: oculto(rel.totalMes), s: rel.pctTotal != null ? `${pctStr(rel.pctTotal)} vs média 6m` : "", sc: rel.pctTotal > 5 ? T.red : T.green, a: T.red },
          { k: "Entrada do mês", v: oculto(rel.receitaMes), s: entradas.aReceber > 0 ? `${oculto(entradas.recebido)} recebido + ${oculto(entradas.aReceber)} a receber` : "dinheiro novo", sc: T.muted, a: T.green },
          { k: "Taxa de consumo", v: rel.taxaConsumo != null ? `${rel.taxaConsumo.toFixed(0)}%` : "—", s: "da renda foi gasta", sc: T.gold, a: T.gold },
          { k: "Sobrou / poupou", v: oculto(rel.poupanca), s: rel.pctPoupanca != null ? `${rel.pctPoupanca.toFixed(0)}% da renda` : "", sc: rel.poupanca >= 0 ? T.green : T.red, a: rel.poupanca >= 0 ? T.green : T.red },
        ].map((t, i) => (
          <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 13px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: t.a }} />
            <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>{t.k}</div>
            <div className="num" style={{ fontFamily: T.serif, fontSize: 19, fontWeight: 700, marginTop: 2, color: t.a === T.green && t.k.includes("poupou") ? T.green : T.ink }}>{t.v}</div>
            {t.s && <div className="num" style={{ fontSize: 10.5, marginTop: 3, color: t.sc }}>{t.s}</div>}
          </div>
        ))}
      </div>

      {/* Entradas do mês — de onde veio o dinheiro (só o que é entrada de verdade) */}
      <div style={card}>
        <div style={lbl}><TrendingUp size={13} style={{ color: T.green }} /> Entradas do mês</div>
        {entradas.categorias.filter((c) => c.contada).length === 0 ? (
          <div style={{ fontSize: 12, color: T.muted, fontStyle: "italic" }}>Nenhuma entrada registrada neste mês.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {entradas.categorias.filter((c) => c.contada).slice(0, 6).map((c) => (
              <div key={c.categoria} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
                <span style={{ color: T.ink }}>{c.categoria}</span>
                <span className="num" style={{ color: T.green, fontWeight: 600 }}>{oculto(entradas.porCategoria[c.categoria] || c.valor)}</span>
              </div>
            ))}
            {entradas.aReceber > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 8, borderTop: `1px dashed ${T.border}`, fontSize: 11.5, color: T.muted }}>
                <span>Recebido {oculto(entradas.recebido)} · ainda a receber</span>
                <span className="num" style={{ color: T.gold, fontWeight: 700 }}>{oculto(entradas.aReceber)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 12, color: T.muted }}>Total (recebido + a receber)</span>
              <span className="num" style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 700, color: T.green }}>{oculto(rel.receitaMes)}</span>
            </div>
          </div>
        )}
        {entradas.foraTotal > 0 && (
          <div style={{ fontSize: 10.5, color: T.faint, marginTop: 8, fontStyle: "italic" }}>
            {oculto(entradas.foraTotal)} não contam como entrada
            {(() => {
              const f = entradas.foraPorMotivo; const p = [];
              if (f.transferencia > 0) p.push(`transferências ${oculto(f.transferencia)}`);
              if (f.resgate > 0) p.push(`resgates ${oculto(f.resgate)}`);
              if (f.emprestimo > 0) p.push(`retorno de empréstimo ${oculto(f.emprestimo)}`);
              return p.length ? ` — ${p.join(" · ")}` : "";
            })()}. Use o <b>Ajustar</b> pra mudar.
          </div>
        )}
      </div>

      {/* 2. Saúde */}
      <div style={card}>
        <div style={lbl}><Stethoscope size={13} style={{ color: T.gold }} /> Saúde do mês</div>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 74, height: 74, borderRadius: "50%", flexShrink: 0, position: "relative",
            background: `conic-gradient(${rel.score >= 70 ? T.green : rel.score >= 45 ? T.gold : T.red} ${(rel.score || 0)}%, ${T.bgSoft} 0)`,
            display: "grid", placeItems: "center" }}>
            <div style={{ position: "absolute", width: 56, height: 56, borderRadius: "50%", background: T.card }} />
            <b style={{ position: "relative", fontFamily: T.serif, fontSize: 20, fontWeight: 700 }}>{rel.score ?? "—"}</b>
          </div>
          <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 6 }}>
            {rel.checks.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                <span style={{ width: 16, height: 16, borderRadius: 5, display: "grid", placeItems: "center", fontSize: 10, color: "#fff", background: chkCor[c.estado], flexShrink: 0 }}>{c.estado === "ok" ? "✓" : "!"}</span>
                <span>{c.texto}{c.detalhe ? <span style={{ color: T.muted, fontSize: 11 }}> — {c.detalhe}</span> : null}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Composição */}
      <div style={card}>
        <div style={lbl}><Puzzle size={13} style={{ color: T.gold }} /> De onde veio o gasto</div>
        <div style={{ height: 22, borderRadius: 8, overflow: "hidden", display: "flex", margin: "4px 0 10px", background: T.bgSoft }}>
          {rel.composicao.map((c) => c.pct > 0 && <div key={c.classe} style={{ width: `${c.pct}%`, background: CompCor[c.classe] }} title={CompLabel[c.classe]} />)}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12 }}>
          {rel.composicao.map((c) => (
            <span key={c.classe} style={{ display: "flex", alignItems: "center", gap: 6, color: T.muted }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: CompCor[c.classe] }} /> {CompLabel[c.classe]} <b className="num" style={{ color: T.ink }}>{oculto(c.valor)} · {c.pct.toFixed(0)}%</b>
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="rg-cols">
        {/* 4. Fora do padrão */}
        <div style={card}>
          <div style={lbl}><BarChart3 size={13} style={{ color: T.gold }} /> Fora do padrão</div>
          {rel.foraDoPadrao.length === 0 ? <div style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>Nada fora da curva. 👍</div> :
            rel.foraDoPadrao.slice(0, 5).map((i) => {
              const cor = i.estado === "abaixo" ? T.green : T.red;
              const chip = i.estado === "pico" ? "novo pico" : i.estado === "abaixo" ? `${pctStr(i.pct)}` : `${pctStr(i.pct)}`;
              return (
                <div key={i.categoria} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: `1px dashed ${T.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{i.categoria}</div>
                    <div className="num" style={{ fontSize: 10.5, color: T.muted }}>{oculto(i.valor)} · média {oculto(i.media)}</div>
                  </div>
                  <span className="num" style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: `${cor}18`, color: cor, whiteSpace: "nowrap" }}>{chip}</span>
                </div>
              );
            })}
        </div>

        {/* 6. Recorrentes */}
        <div style={card}>
          <div style={lbl}><Repeat size={13} style={{ color: T.gold }} /> Recorrentes / assinaturas</div>
          {rel.recorrentes.length === 0 ? <div style={{ fontSize: 12, color: T.muted, fontStyle: "italic" }}>Nenhuma fixa cadastrada.</div> :
            rel.recorrentes.slice(0, 5).map((r, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: `1px dashed ${T.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nome}</div>
                  {r.dia ? <div style={{ fontSize: 10.5, color: T.muted }}>todo dia {r.dia}</div> : null}
                </div>
                <span className="num" style={{ fontFamily: T.serif, fontWeight: 700, fontSize: 13 }}>{oculto(r.valor)}</span>
              </div>
            ))}
          {rel.recorrentes.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 11.5, color: T.muted }}>{rel.recorrentes.length} recorrência{rel.recorrentes.length > 1 ? "s" : ""} fixa{rel.recorrentes.length > 1 ? "s" : ""}</span>
              <span className="num" style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 700, color: T.green }}>{oculto(rel.recorrentesTotal)}<span style={{ fontSize: 10, color: T.muted, fontWeight: 500 }}>/mês</span></span>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="rg-cols">
        {/* 5. Concentração */}
        <div style={card}>
          <div style={lbl}><Target size={13} style={{ color: T.gold }} /> Concentração</div>
          <div style={{ fontSize: 13 }}>Suas <b>3 maiores categorias</b> concentram <b className="num" style={{ color: rel.concentracaoPct > 65 ? T.red : T.gold }}>{rel.concentracaoPct.toFixed(0)}%</b> do gasto.</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>{rel.top3.map((c) => c.nome).join(" · ") || "—"}</div>
          {rel.concentracaoPct > 65 && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: `${T.gold}14`, border: `1px solid ${T.gold}44`, borderRadius: 10, padding: "8px 10px", marginTop: 8, fontSize: 12 }}>
              <AlertTriangle size={13} style={{ color: T.gold, flexShrink: 0, marginTop: 1 }} />
              <span>Concentração alta — um imprevisto numa dessas mexe muito no mês.</span>
            </div>
          )}
        </div>

        {/* 7. Projeção de fechamento */}
        <div style={card}>
          <div style={lbl}><TrendingUp size={13} style={{ color: T.gold }} /> Projeção de fechamento</div>
          {mesSel === mesAtualISO ? (
            <>
              <div style={{ fontSize: 13 }}>Com os compromissos já agendados, {nomeMes(mesSel).split(" ")[0]} deve fechar em <b className="num" style={{ color: T.red }}>{oculto(rel.fechamentoPrevisto)}</b>.</div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4 }}>Já realizado {oculto(rel.realizado)} · ainda a vencer {oculto(rel.aVencer)}.</div>
            </>
          ) : (
            <div style={{ fontSize: 13 }}>Mês fechado: <b className="num">{oculto(rel.totalMes)}</b> em gastos.</div>
          )}
        </div>
      </div>

      {/* 8. Cortes */}
      {rel.cortes.length > 0 && (
        <div style={card}>
          <div style={lbl}><Scissors size={13} style={{ color: T.gold }} /> Onde dá pra cortar</div>
          {rel.cortes.slice(0, 5).map((c) => (
            <div key={c.categoria} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px dashed ${T.border}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{c.categoria}</div>
                <div className="num" style={{ fontSize: 10.5, color: T.muted }}>{c.pico ? <>Pico de {oculto(c.valor)} — se foi pontual, não repete</> : <>Gastou {oculto(c.valor)} · alvo {oculto(c.alvo)}/mês</>}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="num" style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 700, color: T.green }}>{oculto(c.economia)}</div>
                <div style={{ fontSize: 8.5, color: T.muted, textTransform: "uppercase", letterSpacing: ".05em" }}>{c.pico ? "se não repetir" : "economia/mês"}</div>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
            <span style={{ fontSize: 12, color: T.muted }}>Potencial voltando à média</span>
            <span className="num" style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 700, color: T.green }}>{oculto(rel.potencialTotal)}<span style={{ fontSize: 11, color: T.muted, fontWeight: 500 }}>/mês</span></span>
          </div>
        </div>
      )}

      {/* IA */}
      <div style={card}>
        <button onClick={aprofundarIA} disabled={iaPensando}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 11, borderRadius: 12, border: `1px solid ${T.green}55`, background: `${T.green}12`, color: T.green, fontWeight: 700, fontSize: 13, cursor: iaPensando ? "wait" : "pointer", opacity: iaPensando ? 0.7 : 1 }}>
          <Sparkles size={14} /> {iaPensando ? "Analisando…" : iaTexto ? "Refazer leitura com IA" : "Gerar leitura com IA"}
        </button>
        {iaErro && <div style={{ fontSize: 11, color: T.red, marginTop: 7, textAlign: "center" }}>{iaErro}</div>}
        {iaTexto && (
          <div style={{ marginTop: 12, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", fontSize: 12.5, lineHeight: 1.55 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: T.green, marginBottom: 6 }}><Sparkles size={11} /> Leitura da IA</div>
            <div>{iaTexto}</div>
          </div>
        )}
        <div style={{ fontSize: 9.5, color: T.faint, marginTop: 7, fontStyle: "italic", textAlign: "center" }}>Só gasto de consumo · média dos últimos 6 meses · a IA recebe só os números por categoria.</div>
      </div>

      <style>{`@media (max-width:720px){ .rg-kpis{grid-template-columns:1fr 1fr !important} .rg-cols{grid-template-columns:1fr !important} }`}</style>
    </div>
  );
}

const navBtn = { width: 24, height: 24, border: `1px solid ${T.border}`, borderRadius: 8, display: "grid", placeItems: "center", background: T.card, color: T.muted, cursor: "pointer" };
