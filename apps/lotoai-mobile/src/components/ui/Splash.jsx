import React from "react";
import { Sparkles } from "lucide-react";

export default function Splash() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-ink via-[#0d1326] to-ink flex flex-col items-center justify-center px-6">
      <div className="relative mb-6">
        <span className="absolute inset-0 rounded-3xl bg-accent/40 blur-2xl animate-pulse" aria-hidden />
        <span className="relative inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-accent to-indigo-700 shadow-2xl shadow-black/50">
          <Sparkles size={36} className="text-gold animate-pulse" />
        </span>
      </div>
      <h1 className="text-2xl font-extrabold tracking-wide">
        LOTO<span className="text-gold">AI</span>{" "}
        <span className="text-white/60 text-sm font-medium align-middle">PRO</span>
      </h1>
      <p className="mt-2 text-xs text-white/50 tracking-wide">
        Lotofácil · IA · Fechamentos · Simulações
      </p>

      <div className="mt-8 w-48 h-1 rounded-full bg-ink/60 overflow-hidden">
        <div className="h-full w-1/3 bg-gradient-to-r from-accent to-gold animate-[loader_1.4s_ease-in-out_infinite]"
             style={{
               animation: "loader 1.4s ease-in-out infinite",
             }}
        />
      </div>
      <p className="mt-3 text-[11px] text-white/40">
        Carregando 3197 concursos…
      </p>

      <style>{`
        @keyframes loader {
          0% { transform: translateX(-200%); }
          50% { transform: translateX(150%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}
