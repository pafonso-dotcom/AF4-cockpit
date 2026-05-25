import React from "react";
import { Sparkles } from "lucide-react";

export default function Header({ ultimoConcurso }) {
  return (
    <header
      className="sticky top-0 z-10 bg-ink/90 backdrop-blur border-b border-line"
      style={{ paddingTop: "var(--safe-top)" }}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-indigo-700 shadow-lg shadow-black/40">
            <Sparkles size={18} className="text-gold" />
          </span>
          <div className="leading-tight">
            <h1 className="font-extrabold tracking-wide">
              LOTO<span className="text-gold">AI</span> <span className="text-white/60 text-xs font-medium">PRO</span>
            </h1>
            <p className="text-[11px] text-white/50">Lotofácil · IA · Fechamentos</p>
          </div>
        </div>
        {ultimoConcurso && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-white/40">Concurso</div>
            <div className="font-bold text-gold">#{ultimoConcurso.numero}</div>
          </div>
        )}
      </div>
    </header>
  );
}
