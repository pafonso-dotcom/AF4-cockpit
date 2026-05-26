import React, { useState, useRef, useEffect } from "react";
import { Send, Sparkles, AlertCircle, Trash2, KeyRound } from "lucide-react";
import { T } from "../../lib/theme.js";
import { perguntarAoClaude, buildContext, SUGESTOES } from "../../lib/aiChat.js";
import PageHeader from "../ui/PageHeader.jsx";

export default function PergunteAoClaude({
  apiKey,
  transacoes, contas, ativos, vendas, veiculos,
  devedores, dividas, cheques,
}) {
  const [pergunta, setPergunta] = useState("");
  const [historico, setHistorico] = useState([]);
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState("");
  const scrollRef = useRef();
  const inputRef = useRef();

  // Auto-scroll ao adicionar mensagens
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [historico, pensando]);

  const enviar = async (texto) => {
    const q = (texto ?? pergunta).trim();
    if (!q || pensando) return;
    if (!apiKey) {
      setErro("Configure a chave Anthropic em Configurações → API Keys antes de usar o chat.");
      return;
    }

    setErro("");
    setPensando(true);
    setPergunta("");

    const novoHist = [...historico, { role: "user", content: q }];
    setHistorico(novoHist);

    try {
      const contextoDados = buildContext({
        transacoes, contas, ativos, vendas, veiculos,
        devedores, dividas, cheques,
      });
      const resposta = await perguntarAoClaude({
        apiKey,
        pergunta: q,
        historico: novoHist.slice(0, -1), // tudo menos a pergunta atual (já vai no msg)
        contextoDados,
      });
      setHistorico([...novoHist, { role: "assistant", content: resposta }]);
    } catch (err) {
      setErro(err.message || "Erro ao consultar Claude.");
      setHistorico(novoHist);
    } finally {
      setPensando(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const limpar = () => {
    setHistorico([]);
    setErro("");
  };

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="IA · Análise contextual"
        title={<>Pergunte ao <em>Claude.</em></>}
        sub="Faça perguntas em português sobre seus dados financeiros. O Claude responde com base no seu cockpit em tempo real."
        action={
          historico.length > 0 && (
            <button onClick={limpar} className="btn-ghost"
                    style={{ color: T.red, borderColor: T.red, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Trash2 size={12} /> Nova conversa
            </button>
          )
        }
      />

      {!apiKey && (
        <div style={{
          padding: 18, marginBottom: 16, borderRadius: 8,
          background: `${T.yellow}11`, border: `1px solid ${T.yellow}`,
          display: "flex", gap: 12, alignItems: "center",
        }}>
          <KeyRound size={18} style={{ color: T.yellow, flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 12.5, color: T.muted, lineHeight: 1.55 }}>
            <strong style={{ color: T.yellow }}>Chave da Anthropic API não configurada.</strong>
            <br />Para usar o chat IA, abra <strong>Configurações</strong> e cole sua chave (começa com <code>sk-ant-...</code>).
            Você pode obter uma em <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" style={{ color: T.gold }}>console.anthropic.com</a>.
          </div>
        </div>
      )}

      {/* Chat container */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`,
        borderRadius: 10, padding: 0, overflow: "hidden",
        display: "flex", flexDirection: "column",
        minHeight: "60vh", maxHeight: "75vh",
      }}>
        {/* Lista de mensagens */}
        <div ref={scrollRef} style={{
          flex: 1, overflowY: "auto", padding: 20,
          display: "flex", flexDirection: "column", gap: 12,
        }}>
          {historico.length === 0 && !pensando && (
            <div style={{ textAlign: "center", padding: "30px 20px" }}>
              <Sparkles size={36} style={{ color: T.gold, opacity: 0.7, marginBottom: 12 }} />
              <h3 style={{ fontFamily: T.serif, fontSize: 22, color: T.ink, marginBottom: 6 }}>
                Como posso ajudar?
              </h3>
              <p style={{ fontSize: 12, color: T.muted, marginBottom: 20, maxWidth: 480, margin: "0 auto 20px" }}>
                Pergunte sobre seus gastos, vendas, investimentos ou peça sugestões.
                Eu vejo seu cockpit atual e respondo com base nos dados reais.
              </p>
              <div className="pac-suggest-grid" style={{
                display: "grid", gap: 6, maxWidth: 520, margin: "0 auto",
                gridTemplateColumns: "1fr 1fr",
              }}>
                {SUGESTOES.slice(0, 6).map((s, i) => (
                  <button key={i} onClick={() => enviar(s)}
                          disabled={!apiKey || pensando}
                          style={{
                            padding: "10px 12px", textAlign: "left",
                            background: T.bgSoft, border: `1px solid ${T.border}`,
                            color: T.ink, fontSize: 11.5, borderRadius: 7,
                            cursor: apiKey ? "pointer" : "not-allowed",
                            transition: "all .2s",
                            opacity: !apiKey ? 0.5 : 1,
                          }}
                          onMouseEnter={e => { if (apiKey) e.currentTarget.style.borderColor = T.gold; }}
                          onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
                    "{s}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {historico.map((msg, i) => <Bubble key={i} msg={msg} />)}

          {pensando && (
            <div style={{
              alignSelf: "flex-start", maxWidth: "85%",
              padding: "10px 13px",
              background: `linear-gradient(135deg, ${T.gold}11, transparent)`,
              border: `1px solid ${T.border}`,
              borderRadius: "9px 9px 9px 2px",
              fontSize: 12, color: T.muted, fontStyle: "italic",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <Sparkles size={12} style={{ color: T.gold }} className="spin" />
              Claude está pensando…
            </div>
          )}

          {erro && (
            <div style={{
              padding: 11, background: `${T.red}22`,
              border: `1px solid ${T.red}`, borderRadius: 7,
              fontSize: 11.5, color: T.red,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <AlertCircle size={13} /> {erro}
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{
          padding: 14, borderTop: `1px solid ${T.border}`,
          background: T.bgSoft,
          display: "flex", gap: 8, alignItems: "flex-end",
        }}>
          <textarea
            ref={inputRef}
            value={pergunta}
            onChange={e => setPergunta(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            placeholder={apiKey ? "Pergunte algo sobre seus dados…" : "Configure a chave primeiro"}
            disabled={!apiKey || pensando}
            rows={1}
            style={{
              flex: 1, padding: "10px 12px",
              background: T.card, color: T.ink,
              border: `1px solid ${T.border}`, borderRadius: 7,
              fontSize: 13, resize: "vertical", maxHeight: 120,
              fontFamily: T.body, outline: "none",
            }}
          />
          <button onClick={() => enviar()}
                  disabled={!apiKey || pensando || !pergunta.trim()}
                  className="btn-gold"
                  style={{
                    padding: "10px 16px",
                    opacity: (!apiKey || pensando || !pergunta.trim()) ? 0.5 : 1,
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
            <Send size={13} /> {pensando ? "..." : "Enviar"}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 10, color: T.faint, marginTop: 12, fontStyle: "italic", textAlign: "center" }}>
        🔒 Privacidade: somente um resumo agregado dos seus dados é enviado à API. Nenhum dado individual deixa sua máquina sem necessidade.
      </div>
      <style>{`
        @media (max-width: 480px) {
          .pac-suggest-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Bubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      alignSelf: isUser ? "flex-end" : "flex-start",
      maxWidth: "85%",
      padding: "10px 13px",
      background: isUser
        ? T.bgSoft
        : `linear-gradient(135deg, ${T.gold}11, transparent)`,
      border: `1px solid ${T.border}`,
      borderRadius: isUser ? "9px 9px 2px 9px" : "9px 9px 9px 2px",
      fontSize: 13, lineHeight: 1.55,
      color: isUser ? T.ink : T.muted,
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
    }}>
      {!isUser && (
        <div style={{ fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: T.gold, marginBottom: 4, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
          <Sparkles size={9} /> Claude
        </div>
      )}
      {msg.content}
    </div>
  );
}
