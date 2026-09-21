import React, { useEffect, useState } from "react";
import { Calculator } from "lucide-react";
import { T } from "../../lib/theme.js";
import Modal from "../ui/Modal.jsx";

/**
 * Calculadora BÁSICA (+ − × ÷ %) — fica junto da calculadora de juros nos
 * módulos. Funciona no toque e no teclado (números, operadores, Enter, Esc,
 * Backspace). Sem eval: expressão resolvida termo a termo.
 */
const fmtBR = (n) => {
  if (!Number.isFinite(n)) return "Erro";
  const s = Math.abs(n) >= 1e12 ? n.toExponential(6) : String(+n.toFixed(8));
  return s.replace(".", ",");
};

export default function CalculadoraBasicaModal({ onClose }) {
  const [atual, setAtual] = useState("0");   // número sendo digitado
  const [acum, setAcum] = useState(null);    // acumulado
  const [op, setOp] = useState(null);        // operação pendente
  const [fresco, setFresco] = useState(true); // próximo dígito substitui o display

  const aplicar = (a, b, operacao) => {
    switch (operacao) {
      case "+": return a + b;
      case "-": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? NaN : a / b;
      default: return b;
    }
  };

  const digito = (d) => {
    setAtual(prev => {
      if (fresco) { setFresco(false); return d === "," ? "0," : d; }
      if (d === "," && prev.includes(",")) return prev;
      if (prev === "0" && d !== ",") return d;
      return prev.length >= 14 ? prev : prev + d;
    });
  };

  const num = () => parseFloat(String(atual).replace(",", ".")) || 0;

  const operar = (novaOp) => {
    const v = num();
    const base = acum == null || fresco ? (acum == null ? v : acum) : aplicar(acum, v, op);
    setAcum(base);
    setAtual(fmtBR(base));
    setOp(novaOp);
    setFresco(true);
  };

  const igual = () => {
    if (op == null || acum == null) return;
    const r = aplicar(acum, num(), op);
    setAtual(fmtBR(r));
    setAcum(null); setOp(null); setFresco(true);
  };

  const limpar = () => { setAtual("0"); setAcum(null); setOp(null); setFresco(true); };
  const backspace = () => setAtual(p => (fresco || p.length <= 1 ? "0" : p.slice(0, -1)));
  const porcento = () => { setAtual(fmtBR(num() / 100)); setFresco(true); };
  const inverter = () => setAtual(p => (p.startsWith("-") ? p.slice(1) : p === "0" ? p : "-" + p));

  // Teclado físico
  useEffect(() => {
    const h = (e) => {
      const k = e.key;
      if (/^[0-9]$/.test(k)) { digito(k); }
      else if (k === "," || k === ".") digito(",");
      else if (k === "+") operar("+");
      else if (k === "-") operar("-");
      else if (k === "*" || k.toLowerCase() === "x") operar("×");
      else if (k === "/") { e.preventDefault(); operar("÷"); }
      else if (k === "Enter" || k === "=") { e.preventDefault(); igual(); }
      else if (k === "Backspace") backspace();
      else if (k === "Escape") onClose?.();
      else if (k === "%") porcento();
      else if (k.toLowerCase() === "c") limpar();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const B = ({ label, onClick, cor, span }) => (
    <button onClick={onClick}
            style={{
              gridColumn: span ? "span 2" : undefined,
              padding: "14px 0", fontSize: 17, fontWeight: 700, borderRadius: 12,
              border: `1px solid ${T.border}`, cursor: "pointer",
              background: cor === "gold" ? T.gold : cor === "soft" ? T.bgSoft : T.card,
              color: cor === "gold" ? T.bg : cor === "soft" ? T.muted : T.ink,
              fontFamily: T.mono,
            }}>
      {label}
    </button>
  );

  return (
    <Modal title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Calculator size={20} style={{ color: T.gold }} /> Calculadora</span>} onClose={onClose}>
      {/* Display */}
      <div className="num" style={{
        background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 12,
        padding: "14px 16px", marginBottom: 10, textAlign: "right",
        fontSize: 30, fontWeight: 600, color: T.ink, overflow: "hidden",
        whiteSpace: "nowrap", textOverflow: "ellipsis", minHeight: 62,
      }}>
        {acum != null && op && (
          <div style={{ fontSize: 11, color: T.faint, minHeight: 14 }}>{fmtBR(acum)} {op}</div>
        )}
        {atual}
      </div>

      {/* Teclado */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        <B label="C" onClick={limpar} cor="soft" />
        <B label="±" onClick={inverter} cor="soft" />
        <B label="%" onClick={porcento} cor="soft" />
        <B label="÷" onClick={() => operar("÷")} cor="gold" />
        <B label="7" onClick={() => digito("7")} />
        <B label="8" onClick={() => digito("8")} />
        <B label="9" onClick={() => digito("9")} />
        <B label="×" onClick={() => operar("×")} cor="gold" />
        <B label="4" onClick={() => digito("4")} />
        <B label="5" onClick={() => digito("5")} />
        <B label="6" onClick={() => digito("6")} />
        <B label="−" onClick={() => operar("-")} cor="gold" />
        <B label="1" onClick={() => digito("1")} />
        <B label="2" onClick={() => digito("2")} />
        <B label="3" onClick={() => digito("3")} />
        <B label="+" onClick={() => operar("+")} cor="gold" />
        <B label="0" onClick={() => digito("0")} span />
        <B label="," onClick={() => digito(",")} />
        <B label="=" onClick={igual} cor="gold" />
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: T.faint, textAlign: "center" }}>
        Funciona também no teclado: números · + − * / · Enter (=) · Backspace · C (limpar) · Esc (fechar)
      </div>
    </Modal>
  );
}
