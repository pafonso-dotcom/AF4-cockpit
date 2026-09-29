import React, { useState } from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { getHistorico, getDividendos } from "../../../lib/brapi.js";
import { calcularRadarRisco, montarPromptRadar } from "../../../lib/radarRisco.js";
import { gerarTextoGeminiComBusca } from "../../../lib/gemini.js";

const CARD = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 };
const NIVEIS = {
  atencao:  { emoji: "🔴", rotulo: "Atenção",   cor: T.red },
  observar: { emoji: "🟡", rotulo: "Observar",  cor: T.yellow },
  ok:       { emoji: "🟢", rotulo: "Tranquilo", cor: T.green },
};
// Sinais vêm da brapi (B3) — ativos US/cripto/renda fixa ficam de fora.
const TIPOS_RADAR = ["acao", "fii", "etf"];

/**
 * 🚨 Radar de Risco — ranking de ATENÇÃO da carteira (não é previsão):
 * sinais objetivos calculados da brapi (momentum 12m/3m, faixa de 52
 * semanas, proventos minguando, concentração) + IA com busca explicando
 * o porquê dos piores, com fontes.
 */
export default function RadarRisco({ ativos = [] }) {
  const [lista, setLista] = useState(null);
  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [erro, setErro] = useState(null);
  const [ia, setIa] = useState(null);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaErro, setIaErro] = useState(null);

  const elegiveis = ativos.filter(a => a.ticker && TIPOS_RADAR.includes((a.tipo || "").toLowerCase()));
  const patrimonio = ativos.reduce((s, a) => s + (Number(a.qtd) || 0) * (Number(a.preco) || 0), 0);

  async function analisar() {
    setRodando(true); setErro(null); setLista(null); setIa(null); setIaErro(null);
    try {
      const itens = [];
      let feito = 0;
      for (const a of elegiveis.slice(0, 30)) {
        setProgresso(`${a.ticker} (${++feito}/${Math.min(elegiveis.length, 30)})`);
        const [hist, divs] = await Promise.all([
          getHistorico(a.ticker, "1y", "1mo").catch(() => []),
          getDividendos(a.ticker).catch(() => []),
        ]);
        const pesoPct = patrimonio > 0 ? ((Number(a.qtd) || 0) * (Number(a.preco) || 0) / patrimonio) * 100 : 0;
        itens.push({ ativo: a, hist, dividendos: divs, pesoPct });
      }
      setLista(calcularRadarRisco(itens));
    } catch (e) {
      setErro(e?.message || "Falha ao consultar a brapi — confere o token em ⚙ APIs.");
    } finally {
      setRodando(false); setProgresso("");
    }
  }

  async function explicarPiores() {
    const piores = (lista || []).filter(x => x.nivel !== "ok").slice(0, 3);
    if (!piores.length || iaLoading) return;
    setIaLoading(true); setIaErro(null);
    try {
      const r = await gerarTextoGeminiComBusca(montarPromptRadar(piores), { temperature: 0.3, maxOutputTokens: 1100 });
      if (!r.texto) throw new Error("A IA voltou vazia — tenta de novo em instantes.");
      setIa(r);
    } catch (err) {
      setIaErro(
        /não configurada/i.test(err?.message || "")
          ? "Chave do Gemini não configurada — adiciona em ⚙ Configurações → APIs."
          : (err?.message || "Falha na análise com IA."),
      );
    } finally {
      setIaLoading(false);
    }
  }

  const resumo = lista ? {
    atencao: lista.filter(x => x.nivel === "atencao").length,
    observar: lista.filter(x => x.nivel === "observar").length,
    ok: lista.filter(x => x.nivel === "ok").length,
  } : null;
  const temPiores = lista?.some(x => x.nivel !== "ok");

  return (
    <div className="py-8 px-6">
      <div style={{ ...CARD }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <AlertTriangle size={18} style={{ color: T.gold }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>Radar de Risco da Carteira</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
              Sinais objetivos (queda 12m/3m, perto da mínima, proventos minguando, concentração) — não é previsão nem recomendação.
            </div>
          </div>
          <button onClick={analisar} disabled={rodando || elegiveis.length === 0}
                  style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 7,
                           background: T.gold, color: "#fff", border: "none", borderRadius: 12,
                           padding: "10px 16px", fontSize: 13.5, fontWeight: 700,
                           cursor: rodando ? "wait" : "pointer", opacity: rodando ? 0.75 : 1 }}>
            {rodando ? <Loader2 size={15} className="spin" /> : "🚨"}
            {rodando ? `Analisando ${progresso}…` : lista ? "Analisar de novo" : "Analisar carteira"}
          </button>
        </div>
        {elegiveis.length === 0 && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: T.faint, fontStyle: "italic" }}>
            Nenhum ativo elegível (ações, FIIs e ETFs da B3) na carteira ainda.
          </div>
        )}
        {erro && <div style={{ marginTop: 12, fontSize: 12.5, color: T.red }}>{erro}</div>}
      </div>

      {resumo && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {["atencao", "observar", "ok"].map(n => (
            <span key={n} style={{ fontSize: 13, fontWeight: 700, color: NIVEIS[n].cor,
                                   background: `${NIVEIS[n].cor}15`, border: `1px solid ${NIVEIS[n].cor}44`,
                                   borderRadius: 100, padding: "6px 14px" }}>
              {NIVEIS[n].emoji} {resumo[n]} {NIVEIS[n].rotulo.toLowerCase()}
            </span>
          ))}
        </div>
      )}

      {lista && (
        <div style={{ ...CARD, marginTop: 12, padding: 0, overflow: "hidden" }}>
          {lista.map(x => (
            <div key={x.ticker}
                 style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                          borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${NIVEIS[x.nivel].cor}` }}>
              <span style={{ fontSize: 17, flexShrink: 0 }}>{NIVEIS[x.nivel].emoji}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 700, color: T.ink }}>{x.ticker}</span>
                  <span style={{ fontSize: 12, color: NIVEIS[x.nivel].cor, fontWeight: 700 }}>{NIVEIS[x.nivel].rotulo}</span>
                </div>
                <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2, lineHeight: 1.45 }}>
                  {x.sinais.length ? x.sinais.join(" · ") : "nenhum sinal de alerta nos dados"}
                </div>
              </div>
              <span className="num" title="Placar de atenção (0-100): soma dos sinais"
                    style={{ fontSize: 14, fontWeight: 800, color: NIVEIS[x.nivel].cor, flexShrink: 0 }}>
                {x.score}
              </span>
            </div>
          ))}
        </div>
      )}

      {lista && temPiores && !ia && (
        <button onClick={explicarPiores} disabled={iaLoading}
                style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7,
                         background: "transparent", color: T.gold, border: `1px solid ${T.gold}66`,
                         borderRadius: 12, padding: "10px 16px", fontSize: 13.5, fontWeight: 700,
                         cursor: iaLoading ? "wait" : "pointer" }}>
          {iaLoading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
          {iaLoading ? "Pesquisando notícias…" : "Por que estão no radar? (IA)"}
        </button>
      )}
      {lista && !temPiores && (
        <div style={{ marginTop: 12, fontSize: 13, color: T.green, fontWeight: 600 }}>
          ✅ Nenhum ativo em nível de atenção — carteira sem sinais fortes agora.
        </div>
      )}

      {ia && (
        <div style={{ marginTop: 12, padding: "12px 14px", background: `${T.gold}0d`, border: `1px solid ${T.gold}44`, borderRadius: 12 }}>
          <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{ia.texto}</div>
          {ia.fontes?.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ia.fontes.map((f, i) => (
                <a key={i} href={f.url} target="_blank" rel="noreferrer"
                   style={{ fontSize: 11, color: T.gold, border: `1px solid ${T.gold}55`, borderRadius: 100,
                            padding: "3px 10px", textDecoration: "none", maxWidth: 220, overflow: "hidden",
                            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  🔗 {f.titulo}
                </a>
              ))}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 10.5, color: T.faint }}>
            Gerado por IA com busca no Google — informativo, não é recomendação de investimento.
          </div>
        </div>
      )}
      {iaErro && (
        <div style={{ marginTop: 12, padding: "10px 12px", background: `${T.red}12`, border: `1px solid ${T.red}44`, borderRadius: 12, fontSize: 12.5, color: T.ink }}>
          {iaErro}
        </div>
      )}
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
