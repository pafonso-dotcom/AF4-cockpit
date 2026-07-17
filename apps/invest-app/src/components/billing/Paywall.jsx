import React from "react";
import { Check, LogOut } from "lucide-react";
import { T } from "../../lib/theme.js";
import Logo from "../ui/Logo.jsx";

/**
 * Tela de planos / paywall (Fase 4 — estrutura).
 * Mostrada quando a cobrança está ligada e o cliente não tem assinatura ativa.
 * O botão "Assinar" leva ao checkout da Kiwify (VITE_KIWIFY_CHECKOUT_URL).
 */
export default function Paywall({ onAssinar, onSair, motivo, preco }) {
  const precoFmt = preco != null
    ? preco.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";
  const beneficios = [
    "Carteira na nuvem, acesse de qualquer lugar",
    "Cotações e análises sempre atualizadas",
    "Calculadora, projeção e proventos",
    "Seus dados isolados e seguros",
  ];
  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.ink, display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Logo size={32} />
          </div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>
            {motivo === "expirada" ? "Sua assinatura expirou — renove pra continuar." : "Assine pra acessar sua carteira."}
          </div>
        </div>

        <div style={{ background: T.card, border: `1px solid ${T.gold}55`, borderRadius: 14, padding: 22 }}>
          <div style={{ fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: T.gold, fontWeight: 700 }}>
            Plano Pro
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 6, marginBottom: 14 }}>
            <span className="num" style={{ fontFamily: T.serif, fontSize: 30, fontWeight: 600, color: T.ink }}>R$ {precoFmt}</span>
            <span style={{ fontSize: 12, color: T.muted }}>/ mês</span>
          </div>

          <div style={{ display: "grid", gap: 8, marginBottom: 18 }}>
            {beneficios.map((b, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12.5, color: T.muted }}>
                <Check size={15} style={{ color: T.green, flexShrink: 0, marginTop: 1 }} /> {b}
              </div>
            ))}
          </div>

          <button onClick={onAssinar}
                  style={{
                    width: "100%", padding: "12px 14px", borderRadius: 9, border: "none",
                    background: T.gold, color: "#1a1407", fontWeight: 700, fontSize: 14, cursor: "pointer",
                  }}>
            Assinar
          </button>
          <div style={{ fontSize: 10.5, color: T.faint, textAlign: "center", marginTop: 8 }}>
            Pagamento seguro via Kiwify · cancele quando quiser
          </div>
        </div>

        <button onClick={onSair}
                style={{
                  margin: "16px auto 0", display: "flex", alignItems: "center", gap: 6,
                  background: "transparent", border: "none", color: T.muted, fontSize: 12, cursor: "pointer",
                }}>
          <LogOut size={13} /> Sair
        </button>
      </div>
    </div>
  );
}
