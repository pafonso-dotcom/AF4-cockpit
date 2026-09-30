import React from "react";
import { ShieldCheck, Award, Handshake, FileCheck2, Star } from "lucide-react";
import { LOJA, SELOS } from "../config.js";

const SELO_ICONS = [ShieldCheck, Award, Handshake, FileCheck2];

/** Cabeçalho do catálogo — nome da loja, chamada e selos de confiança. */
export default function Hero() {
  return (
    <header className="glow-bg border-b border-line">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        {/* Marca da loja — "AF" laranja, "4" vermelho */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-xl bg-surface2 px-3.5 py-2 font-display text-3xl font-black uppercase leading-none tracking-tight shadow-[0_8px_24px_-8px_rgba(249,115,22,0.55)] ring-1 ring-line">
            <span className="text-accent">AF</span>
            <span className="text-brand">4</span>
          </span>
          <span className="font-display text-base font-bold uppercase tracking-[0.2em] text-zinc-300">
            Seminovos
          </span>
        </div>

        {/* Selo + estrelas */}
        <div className="mt-5 flex items-center gap-2 text-accent">
          {[...Array(5)].map((_, i) => (
            <Star key={i} size={13} fill="currentColor" />
          ))}
          <span className="ml-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-400">
            {LOJA.selo}
          </span>
        </div>

        <h1 className="mt-4 font-display text-4xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-6xl">
          {LOJA.titulo}
        </h1>
        <p className="mt-2 font-display text-xl font-bold uppercase tracking-wide text-brand sm:text-2xl">
          {LOJA.subtitulo}
        </p>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
          {LOJA.descricao}
        </p>

        {/* Selos de confiança */}
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SELOS.map((selo, i) => {
            const Icon = SELO_ICONS[i % SELO_ICONS.length];
            return (
              <div
                key={i}
                className="flex items-center gap-2.5 rounded-xl border border-line bg-surface/60 px-3 py-2.5"
              >
                <Icon size={20} className="shrink-0 text-brandSoft" />
                <span className="text-[12px] font-semibold leading-tight text-zinc-200">
                  {selo}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}
