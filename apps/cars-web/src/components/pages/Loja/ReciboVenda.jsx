import React from "react";
import { createPortal } from "react-dom";
import { Printer, X, MessageCircle, Mail } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";

/**
 * Recibo de venda — gerado automaticamente após registrar.
 * Layout otimizado pra impressão (A4 print-friendly).
 * Envio rápido por WhatsApp e email.
 */
export default function ReciboVenda({ venda, veiculo, cliente, onClose }) {
  if (!venda) return null;

  const numero = `${new Date().getFullYear()}/${String(venda.id || "").slice(-4).padStart(4, "0")}`;

  const formaPgto = (() => {
    switch (venda.formaPagamento) {
      case "financiamento":
        return `Financiamento — ${venda.banco || "—"} · ${venda.parcelas}× com entrada de ${fmt(venda.entrada || 0)}`;
      case "vista":
        return "À vista";
      case "cartao":
        return "Cartão / Outro";
      case "cheques":
        return `Cheques pré-datados (${(venda.chequesRecebidos || []).length}×)`;
      case "troca":
        return `Troca de veículo (${fmt(venda.valorTroca || 0)})`;
      case "misto":
        return "Pagamento combinado (misto)";
      default:
        return venda.formaPagamento || "—";
    }
  })();

  // Texto para WhatsApp
  const textoWA = encodeURIComponent(
    `🚗 *Recibo de venda · AF4 Motors*\n` +
    `Nº ${numero}\n\n` +
    `*Comprador:* ${cliente?.nome || venda.clienteNome || "—"}\n` +
    `*Veículo:* ${veiculo ? `${veiculo.marca} ${veiculo.modelo}` : "—"}` +
    `${veiculo?.placa ? ` · placa ${veiculo.placa}` : ""}\n` +
    `*Valor:* ${fmt(venda.valorVenda)}\n` +
    `*Pagamento:* ${formaPgto}\n` +
    `*Data:* ${venda.dataVenda}\n\n` +
    `Obrigado pela confiança! Qualquer coisa, estou à disposição.`
  );

  const enviarWA = () => {
    const tel = (cliente?.telefone || "").replace(/\D/g, "");
    const url = tel
      ? `https://wa.me/55${tel}?text=${textoWA}`
      : `https://wa.me/?text=${textoWA}`;
    window.open(url, "_blank");
  };

  const enviarEmail = () => {
    const subject = encodeURIComponent(`Recibo de venda · AF4 Motors · Nº ${numero}`);
    const body = decodeURIComponent(textoWA).replace(/\*/g, "");
    const email = cliente?.email || "";
    window.open(`mailto:${email}?subject=${subject}&body=${encodeURIComponent(body)}`);
  };

  const content = (
    <div onClick={(e) => { if (e.currentTarget === e.target) onClose(); }}
         className="no-print"
         style={{
           position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1100,
           display: "flex", alignItems: "center", justifyContent: "center", padding: 8,
         }}>
      <div style={{
        background: T.card, border: `1px solid ${T.borderHi}`,
        maxWidth: 640, width: "100%", maxHeight: "94vh", overflowY: "auto",
        borderRadius: 12, position: "relative",
        boxShadow: "0 24px 60px rgba(0,0,0,.6)",
      }}>
        <button onClick={onClose}
                aria-label="Fechar"
                className="no-print"
                style={{
                  position: "absolute", top: 10, right: 10, zIndex: 5,
                  color: T.muted, background: "transparent",
                  border: "none", cursor: "pointer", padding: 6,
                }}>
          <X size={20} />
        </button>

        {/* Área imprimível (printable) */}
        <div className="printable print-area" style={{
          padding: "clamp(24px, 4vw, 36px)",
          fontFamily: T.body,
        }}>
          {/* Cabeçalho */}
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", marginBottom: 24,
            paddingBottom: 16, borderBottom: `2px solid ${T.ink}`,
          }}>
            <div>
              <h2 style={{
                fontFamily: T.serif, fontSize: "clamp(22px, 4vw, 28px)",
                color: T.ink, letterSpacing: "-0.02em", marginBottom: 4,
              }}>AF4 MOTORS</h2>
              <div style={{ fontSize: 11, color: T.muted, letterSpacing: ".05em" }}>
                Tatuí · São Paulo · Brasil
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>
                Recibo de Venda
              </div>
              <div className="num" style={{ fontSize: 18, color: T.ink, marginTop: 2, fontWeight: 600 }}>
                Nº {numero}
              </div>
              <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>
                {venda.dataVenda}
              </div>
            </div>
          </div>

          {/* Comprador */}
          <Bloco titulo="Comprador">
            <Linha l="Nome" v={cliente?.nome || venda.clienteNome || "—"} />
            {cliente?.cpf && <Linha l="CPF" v={cliente.cpf} />}
            {cliente?.telefone && <Linha l="Telefone" v={cliente.telefone} />}
            {cliente?.email && <Linha l="E-mail" v={cliente.email} />}
            {cliente?.endereco && <Linha l="Endereço" v={cliente.endereco} />}
          </Bloco>

          {/* Veículo */}
          {veiculo && (
            <Bloco titulo="Veículo">
              <Linha l="Marca / Modelo" v={`${veiculo.marca} ${veiculo.modelo}`} />
              <Linha l="Ano" v={`${veiculo.anoFabricacao}/${veiculo.anoModelo}`} />
              {veiculo.placa && <Linha l="Placa" v={veiculo.placa} />}
              {veiculo.km != null && <Linha l="KM" v={`${(veiculo.km || 0).toLocaleString("pt-BR")} km`} />}
              {veiculo.cor && <Linha l="Cor" v={veiculo.cor} />}
              {veiculo.combustivel && <Linha l="Combustível" v={veiculo.combustivel} />}
            </Bloco>
          )}

          {/* Pagamento */}
          <Bloco titulo="Pagamento">
            <Linha l="Valor total" v={
              <strong style={{ color: T.gold, fontSize: 16 }}>{fmt(venda.valorVenda)}</strong>
            } />
            <Linha l="Forma" v={formaPgto} />
            {!!venda.valorTroca && venda.valorTroca > 0 && (
              <Linha l="Veículo em troca"
                     v={`${venda.trocaVeiculo?.marca || ""} ${venda.trocaVeiculo?.modelo || ""} — ${fmt(venda.valorTroca)}`.trim()} />
            )}
            {(venda.chequesRecebidos || []).length > 0 && (
              <Linha l="Cheques recebidos" v={
                <span>
                  {(venda.chequesRecebidos || []).map(c => (
                    <span key={c.id} style={{ display: "block", fontSize: 11, marginTop: 2 }}>
                      Nº {c.numero || "—"} · {c.banco || "—"} · venc. {c.data} · {fmt(c.valor)} {c.parcela ? `(${c.parcela})` : ""}
                    </span>
                  ))}
                </span>
              } />
            )}
            {venda.vendedor && <Linha l="Vendedor responsável" v={venda.vendedor} />}
          </Bloco>

          {/* Cláusula */}
          <div style={{
            marginTop: 20, padding: 12,
            border: `1px dashed ${T.border}`, borderRadius: 6,
            fontSize: 10.5, color: T.muted, lineHeight: 1.55, fontStyle: "italic",
          }}>
            O comprador declara estar de acordo com os termos da venda e ciente do estado de conservação
            do veículo no momento da entrega. As partes assinam abaixo em duas vias de igual teor.
          </div>

          {/* Assinaturas */}
          <div style={{
            display: "flex", justifyContent: "space-around",
            gap: 16, marginTop: 40, marginBottom: 12,
          }}>
            <div style={{ width: "45%", textAlign: "center" }}>
              <div style={{ borderTop: `1px solid ${T.ink}`, paddingTop: 6, fontSize: 11 }}>
                AF4 Motors · Vendedor
              </div>
            </div>
            <div style={{ width: "45%", textAlign: "center" }}>
              <div style={{ borderTop: `1px solid ${T.ink}`, paddingTop: 6, fontSize: 11 }}>
                {cliente?.nome || "Comprador"}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14, fontSize: 9.5, color: T.faint, textAlign: "center", fontStyle: "italic" }}>
            Recibo gerado pelo AF4 Cockpit · {new Date().toLocaleString("pt-BR")}
          </div>
        </div>

        {/* Ações (escondem no print) */}
        <div className="no-print" style={{
          display: "flex", gap: 8, flexWrap: "wrap",
          padding: 16, borderTop: `1px solid ${T.border}`,
          background: T.bgSoft,
          borderRadius: "0 0 12px 12px",
        }}>
          <button onClick={() => window.print()} className="btn-gold"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Printer size={13} /> Imprimir / PDF
          </button>
          <button onClick={enviarWA}
                  style={{
                    background: "#25D366", color: "#fff", border: "none",
                    padding: "10px 14px", fontSize: 11, fontWeight: 600,
                    letterSpacing: ".1em", textTransform: "uppercase", borderRadius: 7,
                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
            <MessageCircle size={13} /> WhatsApp
          </button>
          <button onClick={enviarEmail} className="btn-ghost"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Mail size={13} /> E-mail
          </button>
          <button onClick={onClose} className="btn-ghost" style={{ marginLeft: "auto" }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

function Bloco({ titulo, children }) {
  return (
    <div style={{ marginTop: 18 }} className="no-page-break">
      <div style={{
        fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase",
        color: T.gold, fontWeight: 700, marginBottom: 8,
        paddingBottom: 4, borderBottom: `1px solid ${T.border}`,
      }}>
        {titulo}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Linha({ l, v }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "150px 1fr", gap: 8,
      fontSize: 12, padding: "4px 0",
    }}>
      <div style={{ color: T.muted, fontWeight: 500 }}>{l}:</div>
      <div style={{ color: T.ink }}>{v}</div>
    </div>
  );
}
