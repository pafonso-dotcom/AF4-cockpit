import React from "react";
import { T } from "../../lib/theme.js";

/**
 * Estado vazio padrão — ícone + título + mensagem + ação (CTA) opcional.
 * Uso:
 *   <EmptyState icon={Inbox} title="Nada por aqui ainda"
 *               message="Adicione sua primeira transação."
 *               action={<button>…</button>} />
 */
export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      textAlign: "center", padding: "40px 24px", gap: 10,
    }}>
      {Icon && (
        <div style={{ position: "relative", width: 96, height: 96, marginBottom: 4 }}>
          {/* brilho suave do acento */}
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `radial-gradient(circle at 50% 42%, ${T.gold}26, transparent 70%)` }} />
          {/* disco + ícone */}
          <div style={{
            position: "absolute", inset: 18, borderRadius: "50%",
            background: `${T.gold}14`, border: `1.5px solid ${T.gold}44`,
            display: "grid", placeItems: "center", color: T.gold,
          }}>
            <Icon size={28} />
          </div>
          {/* detalhes decorativos */}
          <span style={{ position: "absolute", top: 8, right: 16, width: 8, height: 8, borderRadius: "50%", background: `${T.gold}66` }} />
          <span style={{ position: "absolute", bottom: 14, left: 12, width: 5, height: 5, borderRadius: "50%", background: `${T.gold}44` }} />
          <span style={{ position: "absolute", top: 28, left: 6, width: 4, height: 4, borderRadius: "50%", background: `${T.gold}33` }} />
        </div>
      )}
      <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: T.ink }}>{title}</div>
      {message && (
        <div style={{ fontSize: 12.5, color: T.muted, maxWidth: 340, lineHeight: 1.5 }}>{message}</div>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}
