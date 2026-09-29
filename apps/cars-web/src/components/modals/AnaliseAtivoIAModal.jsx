import React, { useState, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import Modal from "../ui/Modal.jsx";
import { T } from "../../lib/theme.js";
import { fmt } from "../../lib/format.js";
import { getHistorico, getDividendos } from "../../lib/brapi.js";
import { rentabilidade12m, montarPromptAnaliseAtivo } from "../../lib/analiseAtivo.js";
import { gerarTextoGeminiComBusca } from "../../lib/gemini.js";

/**
 * ✨ Análise de ativo com IA — modal usado pela Carteira (2026-09-29).
 * Mesmo conteúdo do Pesquisador de mercado: rentabilidade 12m calculada
 * da brapi (preço + proventos, sem IA) e notícias/leitura de analistas
 * via Gemini com busca no Google. Roda tudo ao abrir.
 */
export default function AnaliseAtivoIAModal({ ativo, onClose }) {
  const [rent, setRent] = useState(null);
  const [rentPronta, setRentPronta] = useState(false);
  const [ia, setIa] = useState(null);
  const [iaLoading, setIaLoading] = useState(true);
  const [iaErro, setIaErro] = useState(null);

  // Rentabilidade 12m (brapi) — se o ticker não for B3 ou faltar token,
  // segue só com a parte de IA.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [h1a, divs] = await Promise.all([
          getHistorico(ativo.symbol, "1y", "1mo").catch(() => []),
          getDividendos(ativo.symbol).catch(() => []),
        ]);
        if (vivo) setRent(rentabilidade12m(h1a, divs));
      } finally {
        if (vivo) setRentPronta(true);
      }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo.symbol]);

  // IA roda quando a rentabilidade resolve (pra entrar no prompt).
  useEffect(() => {
    if (!rentPronta) return;
    analisar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rentPronta]);

  async function analisar() {
    setIaLoading(true); setIaErro(null);
    try {
      const r = await gerarTextoGeminiComBusca(
        montarPromptAnaliseAtivo({ symbol: ativo.symbol, name: ativo.name, price: ativo.price }, rent),
        { temperature: 0.3, maxOutputTokens: 1000 },
      );
      if (!r.texto) throw new Error("A IA voltou vazia — tenta de novo em instantes.");
      setIa(r);
    } catch (err) {
      setIaErro(
        /não configurada/i.test(err?.message || "")
          ? "Chave do Gemini não configurada — adiciona em ⚙ Configurações → APIs e tenta de novo."
          : (err?.message || "Falha na análise com IA."),
      );
    } finally {
      setIaLoading(false);
    }
  }

  return (
    <Modal title={`✨ ${ativo.symbol} · análise`} avisarSair={false} onClose={onClose}>
      {ativo.name && <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 10 }}>{ativo.name}</div>}

      {rent && (
        <div style={{ padding: "10px 12px", background: T.bgSoft, borderRadius: 12, fontSize: 13, color: T.ink,
                      display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: T.muted, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>
            📈 12 meses
          </span>
          <span className="num" style={{ fontWeight: 800, fontSize: 15, color: rent.pctTotal >= 0 ? T.green : T.red }}>
            {rent.pctTotal >= 0 ? "+" : ""}{rent.pctTotal.toFixed(1)}%
          </span>
          <span className="num" style={{ fontSize: 11.5, color: T.muted }}>
            preço {rent.pctPreco >= 0 ? "+" : ""}{rent.pctPreco.toFixed(1)}% · proventos +{rent.pctProventos.toFixed(1)}%
            {rent.somaProventos > 0 ? ` (${fmt(rent.somaProventos)}/cota)` : ""}
          </span>
        </div>
      )}
      {rentPronta && !rent && (
        <div style={{ fontSize: 11.5, color: T.faint, marginBottom: 10 }}>
          Sem histórico de 12 meses na brapi pra este ticker — seguindo só com a análise de notícias.
        </div>
      )}

      {iaLoading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.muted, fontSize: 13, padding: "14px 2px" }}>
          <Loader2 size={15} className="spin" /> Pesquisando notícias e leitura de analistas…
        </div>
      )}
      {ia && !iaLoading && (
        <div style={{ padding: "12px 14px", background: `${T.gold}0d`, border: `1px solid ${T.gold}44`, borderRadius: 12 }}>
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
      {iaErro && !iaLoading && (
        <div style={{ padding: "10px 12px", background: `${T.red}12`, border: `1px solid ${T.red}44`, borderRadius: 12, fontSize: 12.5, color: T.ink }}>
          {iaErro}
          <button onClick={analisar}
                  style={{ display: "block", marginTop: 8, background: "transparent", color: T.gold,
                           border: `1px solid ${T.gold}66`, borderRadius: 10, padding: "6px 12px",
                           fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            <Sparkles size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Tentar de novo
          </button>
        </div>
      )}
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Modal>
  );
}
