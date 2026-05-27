import React, { useState } from "react";
import { Sparkles, RefreshCw, Check, X } from "lucide-react";
import { importarNovos } from "../lib/import.js";
import { mergeConcursos } from "../lib/supabase.js";

export default function Header({ ultimoConcurso, historico, onHistoricoUpdate }) {
  const [estado, setEstado] = useState("idle"); // idle | loading | done | erro
  const [info, setInfo] = useState(null);
  const [progresso, setProgresso] = useState(null);

  async function atualizar() {
    setEstado("loading");
    setInfo(null);
    setProgresso(null);
    try {
      const { novos, ultimoRemoto } = await importarNovos(historico, {
        max: 30,
        onProgresso: setProgresso,
      });
      if (!novos.length) {
        setInfo(`já em #${ultimoRemoto.numero}`);
        setEstado("done");
      } else {
        const final = await mergeConcursos(historico, novos);
        onHistoricoUpdate?.(final);
        setInfo(`+${novos.length} novos · agora #${ultimoRemoto.numero}`);
        setEstado("done");
      }
    } catch (e) {
      console.warn("[Header] atualizar falhou:", e);
      setInfo(e.message);
      setEstado("erro");
    }
    setTimeout(() => { setEstado("idle"); setInfo(null); setProgresso(null); }, 4000);
  }

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
        <div className="flex items-center gap-2">
          {ultimoConcurso && (
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wide text-white/40">Concurso</div>
              <div className="font-bold text-gold">#{ultimoConcurso.numero}</div>
            </div>
          )}
          <button
            onClick={atualizar}
            disabled={estado === "loading"}
            aria-label="Atualizar histórico"
            title="Atualizar histórico"
            className="w-9 h-9 rounded-lg border border-line bg-ink/60 text-white/70 active:scale-95 disabled:opacity-50 inline-flex items-center justify-center"
          >
            {estado === "loading" ? <RefreshCw size={16} className="animate-spin" />
              : estado === "done" ? <Check size={16} className="text-green-400" />
              : estado === "erro" ? <X size={16} className="text-red-400" />
              : <RefreshCw size={16} />}
          </button>
        </div>
      </div>
      {(progresso || info) && (
        <div className="px-4 pb-2 text-[11px] text-white/60">
          {estado === "loading" && progresso
            ? `Baixando ${progresso.atual}/${progresso.total}…`
            : info}
        </div>
      )}
    </header>
  );
}
