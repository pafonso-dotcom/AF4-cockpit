import React, { useEffect, useRef, useState } from "react";
import { Calculator, X, GripHorizontal } from "lucide-react";
import { T } from "../../lib/theme.js";

/**
 * Calculadora BÁSICA (+ − × ÷ %) — PAINEL FLUTUANTE, não modal: abre por cima
 * do canto da tela SEM escurecer o app, pra fazer contas enquanto olha um
 * extrato/fatura atrás. Arrastável pela barra de cima; posição lembrada.
 * Teclado físico funciona só quando o foco NÃO está num campo do app, pra não
 * roubar os dígitos de quem estiver digitando atrás. Sem eval.
 */
const fmtBR = (n) => {
  if (!Number.isFinite(n)) return "Erro";
  const s = Math.abs(n) >= 1e12 ? n.toExponential(6) : String(+n.toFixed(8));
  return s.replace(".", ",");
};

const POS_KEY = "af4:calc-pos:v1";

export default function CalculadoraBasicaModal({ onClose }) {
  const [atual, setAtual] = useState("0");   // número sendo digitado
  const [acum, setAcum] = useState(null);    // acumulado
  const [op, setOp] = useState(null);        // operação pendente
  const [fresco, setFresco] = useState(true); // próximo dígito substitui o display

  // Posição do painel; null = canto inferior direito (acima da tab bar mobile)
  const [pos, setPos] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem(POS_KEY) || "null");
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
          p.x < window.innerWidth - 60 && p.y < window.innerHeight - 60) return p;
    } catch {}
    return null;
  });
  const painelRef = useRef(null);

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

  // Teclado físico — ignorado quando o foco está num campo do app atrás
  useEffect(() => {
    const h = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target?.isContentEditable) return;
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

  // Arrastar pela barra de cima (pointer events cobrem mouse e toque)
  const onDragStart = (e) => {
    const painel = painelRef.current;
    if (!painel) return;
    e.preventDefault();
    const rect = painel.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    const dy = e.clientY - rect.top;
    const clampar = (ev) => ({
      x: Math.min(Math.max(4, ev.clientX - dx), window.innerWidth - rect.width - 4),
      y: Math.min(Math.max(4, ev.clientY - dy), window.innerHeight - 56),
    });
    const mover = (ev) => setPos(clampar(ev));
    const soltar = (ev) => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", soltar);
      try { localStorage.setItem(POS_KEY, JSON.stringify(clampar(ev))); } catch {}
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", soltar);
  };

  const B = ({ label, onClick, cor, span }) => (
    <button onClick={onClick}
            style={{
              gridColumn: span ? "span 2" : undefined,
              padding: "10px 0", fontSize: 15, fontWeight: 700, borderRadius: 8,
              border: `1px solid ${T.border}`, cursor: "pointer",
              background: cor === "gold" ? T.gold : cor === "soft" ? T.bgSoft : T.card,
              color: cor === "gold" ? T.bg : cor === "soft" ? T.muted : T.ink,
              fontFamily: T.mono, minHeight: 38,
            }}>
      {label}
    </button>
  );

  const posStyle = pos ? { left: pos.x, top: pos.y } : { right: 16, bottom: 86 };

  return (
    <div ref={painelRef} style={{
      position: "fixed", ...posStyle, zIndex: 320,
      width: "min(272px, calc(100vw - 24px))",
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,.35)",
      overflow: "hidden",
    }}>
      {/* Barra de arrastar + fechar */}
      <div onPointerDown={onDragStart}
           style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                    background: T.bgSoft, borderBottom: `1px solid ${T.border}`,
                    cursor: "grab", touchAction: "none", userSelect: "none" }}>
        <Calculator size={14} style={{ color: T.gold, flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.ink, flex: 1 }}>Calculadora</span>
        <GripHorizontal size={14} style={{ color: T.faint }} />
        <button onClick={onClose} aria-label="Fechar calculadora"
                onPointerDown={e => e.stopPropagation()}
                style={{ background: "transparent", border: "none", color: T.muted,
                         cursor: "pointer", padding: 2, display: "grid", placeItems: "center" }}>
          <X size={15} />
        </button>
      </div>

      <div style={{ padding: 10 }}>
        {/* Display */}
        <div className="num" style={{
          background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: "8px 12px", marginBottom: 8, textAlign: "right",
          fontSize: 24, fontWeight: 600, color: T.ink, overflow: "hidden",
          whiteSpace: "nowrap", textOverflow: "ellipsis", minHeight: 48,
        }}>
          {acum != null && op && (
            <div style={{ fontSize: 10, color: T.faint, minHeight: 13 }}>{fmtBR(acum)} {op}</div>
          )}
          {atual}
        </div>

        {/* Teclado */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
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
      </div>
    </div>
  );
}
