import React from "react";
import { Check, MessageCircle, FileText } from "lucide-react";
import { T } from "../../../../lib/theme.js";
import { fmt } from "../../../../lib/format.js";
import { btnIcon } from "./servicosConstants.js";

export default function VendaRow({ venda: v, cliente, instalador, servicos = [], hidden,
                   onMarcarPago, onMarcarNaoPago, onCobrar, onPDF, onEstornar }) {
  // Lucro: além de custo, desconta também o repasse ao colaborador (saída
  // virtual da Caixa). Backward-compat: vendas sem colaborador → valorInst 0.
  const valorInst = Number(v.valorInstalador || 0);
  const lucro = Number(v.valor || 0) - Number(v.custo || 0) - valorInst;
  // Retrocompat: vendas antigas com servicoId; vendas novas com servicosIds[]
  const servicosVinc = v.servicosIds || (v.servicoId ? [v.servicoId] : []);
  const qtdServicos = servicosVinc.length;
  // Chip do colaborador: só renderiza se a venda tem instaladorId — não
  // depende de o cadastro ainda existir (fallback pra "colaborador").
  const temInstalador = !!v.instaladorId && valorInst > 0;
  const nomeInst = instalador?.nome || (temInstalador ? "colaborador" : "");
  const pendente = v.pago === false; // cobrança em aberto
  const corBorda = pendente ? T.red : T.green;
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${corBorda}`,
      borderRadius: 14, padding: 12,
      display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 12, alignItems: "center",
    }}>
      <div style={{ color: T.faint, fontFamily: T.mono, fontSize: 11 }}>
        {v.data.split("-").reverse().slice(0, 2).join("/")}
      </div>
      <div style={{ minWidth: 0 }}>
        {/* Linha 1: NOME DA EMPRESA/CLIENTE em destaque + status */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 15, color: T.ink, fontWeight: 700 }}>
            {cliente?.nome || v.nome}
          </span>
          <span style={{
            fontSize: 9, padding: "1px 7px", borderRadius: 3, fontWeight: 700,
            letterSpacing: ".08em", textTransform: "uppercase",
            background: pendente ? `${T.red}22` : `${T.green}22`,
            color: pendente ? T.red : T.green,
          }}>
            {pendente ? "Pendente" : "Pago"}
          </span>
          {qtdServicos > 1 && (
            <span style={{
              fontSize: 9, padding: "1px 6px", borderRadius: 3,
              background: T.border, color: T.muted,
              letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700,
            }}
            title={servicosVinc
              .map(id => servicos.find(s => s.id === id)?.nome)
              .filter(Boolean)
              .join(", ")}>
              +{qtdServicos} serviços
            </span>
          )}
        </div>
        {/* Linha 2: PLANO/serviço (abaixo) */}
        <div style={{ fontSize: 12, color: T.muted, marginTop: 1, fontWeight: 500 }}>
          {v.nome}
        </div>
        {/* Linha 3: detalhes (colaborador, repasse, pago em, conta) */}
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {temInstalador && (
            <span title={`Repasse a ${nomeInst}: ${fmt(valorInst)} (sai do Caixa do Negócio)`}>
              🧑‍💻 {nomeInst} · {hidden ? "•••" : `repasse ${fmt(valorInst)}`}
            </span>
          )}
          {!pendente && v.pagoEm && (
            <span style={{ color: T.green }}>✓ pago em {v.pagoEm.split("-").reverse().join("/")}</span>
          )}
          <span>→ {v.contaDestino}</span>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="num" style={{ color: T.gold, fontWeight: 600 }}>{hidden ? "•••" : fmt(v.valor)}</div>
        <div className="num" style={{ fontSize: 10, color: lucro >= 0 ? T.green : T.red }}>
          lucro {lucro >= 0 ? "+" : ""}{hidden ? "•••" : fmt(lucro)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {pendente ? (
          <button onClick={onMarcarPago} title="Marcar como pago (entra na Caixa do Negócio)"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: T.green, border: "none", color: "#fff",
                    padding: "0 10px", height: 32, borderRadius: 5, cursor: "pointer",
                    fontSize: 10, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
                  }}>
            <Check size={12} /> Receber
          </button>
        ) : (
          <button onClick={onMarcarNaoPago} title="Desfazer recebimento (sai da Caixa)"
                  style={btnIcon({ color: T.green })}>
            <Check size={13} />
          </button>
        )}
        <button onClick={onCobrar} title={pendente ? "Enviar cobrança no WhatsApp" : "Enviar recibo no WhatsApp"}
                style={btnIcon({ color: "#25D366" })}>
          <MessageCircle size={13} />
        </button>
        <button onClick={onPDF} title="Gerar fatura/recibo em PDF" style={btnIcon()}>
          <FileText size={13} />
        </button>
        <button onClick={onEstornar} title="Estornar" style={btnIcon({ color: T.red })}>
          ↩
        </button>
      </div>
    </div>
  );
}
