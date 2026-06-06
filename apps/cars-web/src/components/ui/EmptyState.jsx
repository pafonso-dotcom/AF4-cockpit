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
        <div style={{
          width: 52, height: 52, borderRadius: "50%",
          background: T.bgSoft, border: `1px solid ${T.border}`,
          display: "grid", placeItems: "center", color: T.muted,
        }}>
          <Icon size={24} />
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
