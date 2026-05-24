import React, { useState, useEffect, useRef } from "react";
import { Clock, Play, Pause, RotateCcw, X, Coffee, Brain } from "lucide-react";
import { T } from "../lib/theme.js";
import { toast } from "../lib/toast.js";

const TRABALHO_MIN = 25;
const DESCANSO_MIN = 5;

function fmtTempo(seg) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PomodoroFloat() {
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState("trabalho"); // "trabalho" | "descanso"
  const [restante, setRestante] = useState(TRABALHO_MIN * 60);
  const [rodando, setRodando] = useState(false);
  const intervalRef = useRef(null);

  // Tick
  useEffect(() => {
    if (!rodando) {
      clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRestante(prev => {
        if (prev <= 1) {
          // Fim do ciclo
          clearInterval(intervalRef.current);
          setRodando(false);
          if (modo === "trabalho") {
            toast.success("⏰ Pomodoro completo! Hora do descanso.");
            try { new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAA").play(); } catch {}
            setModo("descanso");
            return DESCANSO_MIN * 60;
          } else {
            toast.success("☕ Descanso acabou. Bora foco!");
            setModo("trabalho");
            return TRABALHO_MIN * 60;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [rodando, modo]);

  const start = () => setRodando(true);
  const pause = () => setRodando(false);
  const reset = () => {
    setRodando(false);
    setRestante(modo === "trabalho" ? TRABALHO_MIN * 60 : DESCANSO_MIN * 60);
  };

  const trocarModo = (novoModo) => {
    setRodando(false);
    setModo(novoModo);
    setRestante(novoModo === "trabalho" ? TRABALHO_MIN * 60 : DESCANSO_MIN * 60);
  };

  const totalSeg = modo === "trabalho" ? TRABALHO_MIN * 60 : DESCANSO_MIN * 60;
  const progresso = ((totalSeg - restante) / totalSeg) * 100;
  const cor = modo === "trabalho" ? T.gold : "#5b9bd5";

  if (!aberto) {
    return (
      <>
        <button onClick={() => setAberto(true)} aria-label="Abrir Pomodoro"
          className="pomodoro-fab"
          style={{
            position: "fixed",
            bottom: "calc(80px + env(safe-area-inset-bottom, 0))",
            right: 16,
            width: 48, height: 48, borderRadius: "50%",
            background: rodando ? cor : T.bg,
            color: rodando ? "#fff" : T.gold,
            border: `2px solid ${cor}`,
            cursor: "pointer",
            display: "grid", placeItems: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,.25)",
            zIndex: 55,
            fontSize: 11, fontWeight: 700,
          }}>
          {rodando ? fmtTempo(restante).slice(0, 5).replace(/:.*/, "") + "m" : <Clock size={18} />}
        </button>
        <style>{`
          @media (min-width: 769px) {
            .pomodoro-fab { bottom: 16px !important; right: 16px !important; }
          }
        `}</style>
      </>
    );
  }

  return (
    <div className="pomodoro-panel"
      style={{
        position: "fixed",
        bottom: "calc(80px + env(safe-area-inset-bottom, 0))",
        right: 16, left: 16,
        maxWidth: 320, marginLeft: "auto",
        background: T.card,
        border: `2px solid ${cor}`,
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 8px 24px rgba(0,0,0,.35)",
        zIndex: 55,
      }}>
      <style>{`
        @media (min-width: 769px) {
          .pomodoro-panel { bottom: 16px !important; right: 16px !important; left: auto !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: cor, fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>
          {modo === "trabalho" ? <Brain size={14} /> : <Coffee size={14} />}
          {modo === "trabalho" ? "Foco" : "Descanso"}
        </div>
        <button onClick={() => setAberto(false)} aria-label="Fechar"
          style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* Timer */}
      <div className="num" style={{
        fontSize: 48, fontWeight: 300, fontFamily: T.serif,
        color: cor, textAlign: "center", lineHeight: 1, marginBottom: 12,
      }}>
        {fmtTempo(restante)}
      </div>

      {/* Barra de progresso */}
      <div style={{ background: T.bgSoft, height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ background: cor, width: `${progresso}%`, height: "100%", transition: "width 1s linear" }} />
      </div>

      {/* Controles */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {!rodando ? (
          <button onClick={start} className="btn-gold"
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Play size={14} /> Iniciar
          </button>
        ) : (
          <button onClick={pause} className="btn-gold"
            style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Pause size={14} /> Pausar
          </button>
        )}
        <button onClick={reset} className="btn-ghost"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 14px" }}
          title="Resetar">
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Trocar modo */}
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => trocarModo("trabalho")}
          style={{
            flex: 1, padding: "6px 10px",
            background: modo === "trabalho" ? `${T.gold}22` : T.bgSoft,
            border: `1px solid ${modo === "trabalho" ? T.gold : T.border}`,
            color: modo === "trabalho" ? T.gold : T.muted,
            fontSize: 10.5, fontWeight: 600, borderRadius: 5,
            cursor: "pointer", letterSpacing: ".05em", textTransform: "uppercase",
            minHeight: 32,
          }}>
          25 min Foco
        </button>
        <button onClick={() => trocarModo("descanso")}
          style={{
            flex: 1, padding: "6px 10px",
            background: modo === "descanso" ? `#5b9bd522` : T.bgSoft,
            border: `1px solid ${modo === "descanso" ? "#5b9bd5" : T.border}`,
            color: modo === "descanso" ? "#5b9bd5" : T.muted,
            fontSize: 10.5, fontWeight: 600, borderRadius: 5,
            cursor: "pointer", letterSpacing: ".05em", textTransform: "uppercase",
            minHeight: 32,
          }}>
          5 min Pausa
        </button>
      </div>
    </div>
  );
}
