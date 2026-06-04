import React from "react";
import { T } from "../../lib/theme.js";

/**
 * Captura erros durante render dos filhos e mostra uma tela de fallback
 * em vez do app inteiro quebrar. Útil para evitar tela branca em produção.
 */
export default class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Em produção, você poderia mandar para Sentry/LogRocket aqui.
    console.error("AF4 crashed:", error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const msg = this.state.error?.message || "Erro inesperado";

    return (
      <div style={{
        background: T.bg, color: T.ink, fontFamily: T.body,
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}>
        <div style={{ maxWidth: 560, textAlign: "center" }}>
          <div style={{
            color: T.gold, fontSize: 11, letterSpacing: "0.3em",
            textTransform: "uppercase", fontWeight: 500, marginBottom: 16,
          }}>
            Erro · AF4
          </div>
          <h1 style={{
            fontFamily: T.serif, fontSize: 36, color: T.ink,
            lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 16,
          }}>
            <span style={{ color: T.gold, fontStyle: "italic" }}>Algo</span> não funcionou.
          </h1>
          <p style={{ color: T.muted, fontSize: 16, fontStyle: "italic", marginBottom: 8 }}>
            Seus dados continuam salvos no navegador. Recarregue para continuar.
          </p>
          <details style={{ color: T.faint, fontSize: 12, marginTop: 16, marginBottom: 24, textAlign: "left" }}>
            <summary style={{ cursor: "pointer", color: T.muted }}>Detalhes técnicos</summary>
            <pre style={{
              background: T.card, border: `1px solid ${T.border}`, padding: 12, marginTop: 8,
              fontFamily: T.mono, fontSize: 11, overflow: "auto", whiteSpace: "pre-wrap",
            }}>{msg}</pre>
          </details>
          <div className="flex gap-3 justify-center">
            <button onClick={this.reload}
              style={{
                background: T.gold, color: T.bg, fontFamily: T.sans, fontWeight: 600,
                fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase",
                padding: "12px 24px", border: "none", cursor: "pointer",
              }}>
              Recarregar
            </button>
            <button onClick={this.reset}
              style={{
                background: "transparent", color: T.ink, fontFamily: T.sans, fontWeight: 500,
                fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase",
                padding: "12px 24px", border: `1px solid ${T.border}`, cursor: "pointer",
              }}>
              Tentar de novo
            </button>
          </div>
        </div>
      </div>
    );
  }
}
