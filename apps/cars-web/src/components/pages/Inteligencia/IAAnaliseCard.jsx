import React, { useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { T } from "../../../lib/theme.js";
import Card from "../../ui/Card.jsx";
import { promptAnaliseMes } from "../../../lib/iaFinancas.js";
import { gerarTextoGemini } from "../../../lib/gemini.js";

// Análise do mês em linguagem natural — gerada pela IA (Gemini) a partir de um
// resumo compacto dos dados. A chave do Gemini vem de Configurações → API Keys
// (localStorage af4:gemini-key), lida direto pelo gerarTextoGemini.
export default function IAAnaliseCard({ resumo, extras }) {
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const temKey = (() => { try { return !!localStorage.getItem("af4:gemini-key"); } catch { return false; } })();

  const gerar = async () => {
    setErro(""); setCarregando(true); setTexto("");
    try {
      const prompt = promptAnaliseMes(resumo || {}, extras || {});
      const t = await gerarTextoGemini(prompt, { temperature: 0.4, maxOutputTokens: 700 });
      setTexto((t || "").trim() || "A IA não retornou um resumo. Tente de novo.");
    } catch (e) {
      setErro(e?.message || "Falha ao gerar a análise.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Card variant="soft">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Sparkles size={18} style={{ color: T.gold, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Análise com IA</div>
          <div style={{ fontSize: 11, color: T.muted }}>Resumo do mês em linguagem natural (via Gemini).</div>
        </div>
        <button onClick={gerar} disabled={carregando || !temKey}
          title={temKey ? "Gerar resumo do mês" : "Configure a chave do Gemini em Configurações → API Keys"}
          style={{
            background: temKey ? T.gold : T.border, color: temKey ? T.bg : T.muted,
            border: "none", borderRadius: 10, padding: "6px 12px", fontSize: 11.5, fontWeight: 600,
            cursor: (carregando || !temKey) ? "not-allowed" : "pointer", opacity: (carregando || !temKey) ? 0.75 : 1,
            display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
          }}>
          {carregando ? <><RefreshCw size={12} className="spin" /> Gerando…</> : (texto ? "Gerar de novo" : "Gerar análise")}
        </button>
      </div>

      {!temKey && (
        <div style={{ fontSize: 11, color: T.muted, marginTop: 10, fontStyle: "italic" }}>
          Configure a chave do <strong>Gemini</strong> em Configurações → API Keys para usar a análise.
        </div>
      )}
      {erro && <div style={{ fontSize: 12, color: T.red, marginTop: 10 }}>{erro}</div>}
      {texto && (
        <div style={{ fontSize: 13, color: T.ink, marginTop: 12, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{texto}</div>
      )}
    </Card>
  );
}
