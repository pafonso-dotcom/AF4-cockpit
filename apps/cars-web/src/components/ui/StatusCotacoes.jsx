import React from "react";
import { T } from "../../lib/theme.js";

/**
 * Linha de status das cotações de mercado — responde "por que o preço não
 * mudou?": mostra quantos ativos receberam cotação REAL, a hora, quantos
 * ficaram sem (mantendo o último preço) e o erro da fonte quando houver.
 * Recebe o marketStatus do App ({ at, mode, okCount, total, erros }).
 */
export default function StatusCotacoes({ status }) {
  if (!status) return null;

  const base = {
    display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap",
    fontSize: 11, lineHeight: 1.5, padding: "5px 10px", borderRadius: 12,
    marginBottom: 10,
  };

  if (status.mode === "off") {
    return (
      <div className="no-print" style={{ ...base, background: `${T.gold}12`, color: T.gold, border: `1px solid ${T.gold}44` }}>
        ⚠ Mercado real <strong>desligado</strong> (⚙ Configurações → APIs) — os preços não se atualizam.
      </div>
    );
  }

  if (!status.at) {
    return (
      <div className="no-print" style={{ ...base, background: T.bgSoft, color: T.muted, border: `1px solid ${T.border}` }}>
        Cotações: aguardando a primeira atualização…
      </div>
    );
  }

  const hora = new Date(status.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const ok = Number(status.okCount) || 0;
  const total = Number(status.total) || 0;
  const semCotacao = Math.max(0, total - ok);
  const erros = (status.erros || []).filter(Boolean);

  if (ok > 0) {
    return (
      <div className="no-print" style={{ ...base, background: `${T.green}10`, color: T.green, border: `1px solid ${T.green}44` }}>
        ● Cotação real em <strong>{ok} de {total}</strong> ativos às {hora}
        {semCotacao > 0 && (
          <span style={{ color: T.gold }}>· {semCotacao} sem cotação (mantido o último preço)</span>
        )}
        {erros.length > 0 && <span style={{ color: T.red }}>· {erros.join(" · ")}</span>}
      </div>
    );
  }

  return (
    <div className="no-print" style={{ ...base, background: `${T.red}10`, color: T.red, border: `1px solid ${T.red}44` }}>
      ✕ Nenhuma cotação real obtida às {hora} — preços mantidos.
      {erros.length > 0 ? ` Motivo: ${erros.join(" · ")}` : " Verifique o token da BRAPI em ⚙ Configurações → APIs."}
    </div>
  );
}
