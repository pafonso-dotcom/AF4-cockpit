import React from "react";
import { T } from "../../lib/theme.js";

export default function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${T.border}`, padding: "32px 24px", marginTop: 48 }}>
      <div className="max-w-7xl mx-auto text-center">
        <div className="ornament mb-4">
          <span style={{ fontSize: 18 }} className="italic">finis</span>
        </div>
        <div style={{ color: T.faint, fontSize: 12 }} className="sans tracking-widest uppercase">
          Aurum Finanças · Painel de Comando · Dados persistidos localmente
        </div>
        <div style={{ color: T.muted, fontSize: 14 }} className="italic mt-2">
          “O dinheiro fala — quem registra, escuta.”
        </div>
      </div>
    </footer>
  );
}
