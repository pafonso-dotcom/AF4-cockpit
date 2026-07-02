import React, { useMemo, useState } from "react";
import { Stethoscope, Sparkles, AlertTriangle, CheckCircle2, ListChecks } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import { gerarJSONGemini } from "../../../lib/gemini.js";
import { carregarFundamentos, classificar } from "../../../lib/fundamentosLocal.js";
import { montarContextoDiagnostico, montarPromptDiagnostico } from "../../../lib/diagnosticoCarteira.js";

const KEY_ULTIMO = "af4:diagnostico-ia:v1";
const CARD = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 };

const ler = () => { try { return JSON.parse(localStorage.getItem(KEY_ULTIMO) || "null"); } catch { return null; } };
const SEV_COR = { alta: () => T.red, media: () => T.yellow, baixa: () => T.muted };

/**
 * Diagnóstico da Carteira por IA — visão consolidada estilo "portfolio review":
 * junta posições, concentração, fundamentos curados, YoC e benchmarks reais
 * num contexto e pede ao Gemini um parecer estruturado (nota, riscos, ações).
 */
export default function DiagnosticoIA({ ativos = [], hidden }) {
  const [resultado, setResultado] = useState(() => ler());
  const [rodando, setRodando] = useState(false);

  const contexto = useMemo(() => {
    const fundamentos = carregarFundamentos();
    const scores = {};
    (ativos || []).forEach((a) => {
      const r = classificar(a, fundamentos);
      if (r) scores[(a.ticker || "").toUpperCase()] = { score: r.score, badge: r.badge, recomendacao: r.recomendacao };
    });
    let proventosReais = {};
    try { proventosReais = JSON.parse(localStorage.getItem("af4:mapa-div:proventos-brapi:v1") || "null")?.porTicker || {}; } catch {}
    let benchmarks = null;
    try {
      const b = JSON.parse(localStorage.getItem("af4:bcb-benchmarks:v1") || "null");
      if (b) benchmarks = { cdi12m: b.cdi12m, ipca12m: b.ipca12m, ibov12m: b.ibov12m };
    } catch {}
    return montarContextoDiagnostico({ ativos, fundamentos, scores, proventosReais, benchmarks });
  }, [ativos]);

  async function diagnosticar() {
    if (!ativos.length) { toast.info("Adicione ativos à carteira primeiro."); return; }
    setRodando(true);
    try {
      const parsed = await gerarJSONGemini(montarPromptDiagnostico(contexto), { temperature: 0.3, maxOutputTokens: 4096 });
      if (!parsed || typeof parsed.notaGeral !== "number") throw new Error("A IA não retornou um diagnóstico válido. Tente de novo.");
      const novo = { ...parsed, geradoEm: new Date().toISOString(), posicoes: contexto.totais.posicoes };
      setResultado(novo);
      try { localStorage.setItem(KEY_ULTIMO, JSON.stringify(novo)); } catch {}
    } catch (e) {
      toast.error(e.message || "Falha ao gerar o diagnóstico.");
    } finally {
      setRodando(false);
    }
  }

  const notaCor = (n) => (n >= 70 ? T.green : n >= 40 ? T.yellow : T.red);

  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="eb">Investimentos · Diagnóstico IA</div>
      <h1 className="h1">Diagnóstico <em>da carteira.</em></h1>
      <p className="hs">
        Revisão consolidada por IA com os seus dados reais: pesos, concentração, fundamentos curados, yield-on-cost e benchmarks do Banco Central.
      </p>

      {/* Contexto que será enviado (transparência) + ação */}
      <div style={{ ...CARD, marginTop: 8, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 12.5, color: T.ink, fontWeight: 600 }}>
            {contexto.totais.posicoes} {contexto.totais.posicoes === 1 ? "posição" : "posições"} · {hidden ? "•••" : fmt(contexto.totais.valor)}
            {contexto.totais.custo > 0 && (
              <span style={{ color: contexto.totais.resultadoPct >= 0 ? T.green : T.red }}>
                {" "}· {contexto.totais.resultadoPct >= 0 ? "+" : ""}{contexto.totais.resultadoPct.toFixed(1)}%
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: T.faint, marginTop: 3 }}>
            A IA recebe só números já calculados pelo app (não adivinha valores).
            {contexto.benchmarks?.cdi12m != null && <> Benchmarks reais incluídos (CDI {contexto.benchmarks.cdi12m.toFixed(1)}%).</>}
          </div>
        </div>
        <button onClick={diagnosticar} disabled={rodando}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, background: T.gold, color: "#fff", border: "none", borderRadius: 11, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: rodando ? "wait" : "pointer", opacity: rodando ? 0.7 : 1 }}>
          <Sparkles size={15} className={rodando ? "spin" : ""} />
          {rodando ? "Analisando…" : resultado ? "Gerar novo diagnóstico" : "Diagnosticar carteira"}
        </button>
      </div>

      {!resultado && !rodando && (
        <div style={{ ...CARD, marginTop: 12, padding: 40, textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 13 }}>
          <Stethoscope size={28} style={{ color: T.faint, marginBottom: 10 }} />
          <div>Nenhum diagnóstico ainda. Clique em <b style={{ color: T.gold }}>Diagnosticar carteira</b> — leva ~10 segundos.</div>
        </div>
      )}

      {resultado && (
        <>
          {/* Nota + resumo */}
          <div style={{ ...CARD, marginTop: 12, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ textAlign: "center", minWidth: 110 }}>
              <div className="num" style={{ fontSize: 44, fontWeight: 800, color: notaCor(resultado.notaGeral), lineHeight: 1 }}>
                {resultado.notaGeral}
              </div>
              <div style={{ fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: T.muted, fontWeight: 700, marginTop: 4 }}>
                {resultado.classificacao || "—"} · /100
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ fontSize: 13.5, color: T.ink, lineHeight: 1.6 }}>{resultado.resumo}</div>
              <div style={{ fontSize: 10.5, color: T.faint, marginTop: 6 }}>
                Gerado em {new Date(resultado.geradoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                {" "}· {resultado.posicoes} posições · ferramenta educacional, não recomendação formal.
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, marginTop: 12 }}>
            {/* Pontos fortes */}
            <div style={CARD}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <CheckCircle2 size={15} style={{ color: T.green }} />
                <h3 style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>Pontos fortes</h3>
              </div>
              {(resultado.pontosFortes || []).length === 0 ? (
                <div style={{ fontSize: 12, color: T.faint, fontStyle: "italic" }}>Nenhum destacado.</div>
              ) : (resultado.pontosFortes || []).map((p, i) => (
                <div key={i} style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.55, padding: "5px 0", borderBottom: i < resultado.pontosFortes.length - 1 ? `1px dashed ${T.border}` : "none" }}>
                  {p}
                </div>
              ))}
            </div>

            {/* Riscos */}
            <div style={CARD}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <AlertTriangle size={15} style={{ color: T.red }} />
                <h3 style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>Riscos</h3>
              </div>
              {(resultado.riscos || []).length === 0 ? (
                <div style={{ fontSize: 12, color: T.faint, fontStyle: "italic" }}>Nenhum identificado.</div>
              ) : (resultado.riscos || []).map((r, i) => {
                const cor = (SEV_COR[r.severidade] || SEV_COR.baixa)();
                return (
                  <div key={i} style={{ padding: "7px 0", borderBottom: i < resultado.riscos.length - 1 ? `1px dashed ${T.border}` : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 4, background: cor, flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{r.titulo}</span>
                      <span style={{ fontSize: 9, letterSpacing: ".06em", textTransform: "uppercase", color: cor, fontWeight: 700 }}>{r.severidade}</span>
                    </div>
                    <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5, marginTop: 2, paddingLeft: 15 }}>{r.detalhe}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ações sugeridas */}
          <div style={{ ...CARD, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <ListChecks size={15} style={{ color: T.gold }} />
              <h3 style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>Ações sugeridas</h3>
              <span style={{ fontSize: 10.5, color: T.faint }}>em ordem de prioridade</span>
            </div>
            {(resultado.acoesSugeridas || []).slice().sort((a, b) => (a.prioridade || 9) - (b.prioridade || 9)).map((ac, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: i < (resultado.acoesSugeridas || []).length - 1 ? `1px dashed ${T.border}` : "none" }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 8, flexShrink: 0, marginTop: 1,
                  background: `${T.gold}22`, color: T.gold, fontWeight: 800, fontSize: 11,
                  display: "grid", placeItems: "center",
                }}>{ac.prioridade ?? i + 1}</span>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{ac.titulo}</div>
                  <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5, marginTop: 1 }}>{ac.detalhe}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
