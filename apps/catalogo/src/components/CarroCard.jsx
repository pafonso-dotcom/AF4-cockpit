import React from "react";
import { Calendar, Settings2, Fuel, Gauge, Star } from "lucide-react";
import CarImage from "./CarImage.jsx";
import { fmtPreco, fmtKm } from "../lib/format.js";

/**
 * Card de um veículo no catálogo — foto, marca/modelo, specs e preço.
 * Clicar abre os detalhes (modal). O botão de WhatsApp vive lá dentro.
 */
export default function CarroCard({ carro, onAbrir }) {
  const km = fmtKm(carro.km);
  const specs = [
    { icon: Calendar, label: carro.ano },
    { icon: Settings2, label: carro.cambio },
    { icon: Fuel, label: carro.combustivel },
    km ? { icon: Gauge, label: km } : null,
  ].filter(Boolean);

  return (
    <button
      onClick={() => onAbrir(carro)}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface text-left transition-all duration-300 hover:-translate-y-1 hover:border-brand/60 hover:shadow-[0_18px_50px_-20px_rgba(228,18,31,0.55)] ${
        carro.vendido ? "opacity-60" : ""
      }`}
    >
      {/* Foto */}
      <div className="relative aspect-[16/10] w-full">
        <CarImage
          src={carro.foto}
          alt={`${carro.marca} ${carro.modelo}`}
          className="h-full w-full"
        />

        {carro.destaque && !carro.vendido && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg">
            <Star size={11} fill="currentColor" /> Destaque
          </span>
        )}
        {carro.vendido && (
          <span className="absolute left-3 top-3 rounded-full bg-black/80 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white ring-1 ring-white/20">
            Vendido
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex flex-1 flex-col p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          {carro.marca}
        </div>
        <h3 className="font-display text-xl font-extrabold leading-tight text-white">
          {carro.modelo}
        </h3>
        {carro.versao && (
          <div className="mt-0.5 text-[12px] font-medium uppercase tracking-wide text-zinc-400">
            {carro.versao}
          </div>
        )}

        {/* Specs */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {specs.map((s, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-md bg-surface2 px-2 py-1 text-[11px] font-medium text-zinc-300 ring-1 ring-line"
            >
              <s.icon size={12} className="text-brandSoft" />
              {s.label}
            </span>
          ))}
        </div>

        {/* Preço */}
        <div className="mt-4 flex items-end justify-between border-t border-line pt-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">
              {carro.vendido ? "Vendido por" : "Por apenas"}
            </div>
            <div className="num font-display text-2xl font-extrabold text-brandSoft">
              {fmtPreco(carro.preco)}
            </div>
          </div>
          <span className="rounded-lg bg-brand/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-brandSoft ring-1 ring-brand/30 transition group-hover:bg-brand group-hover:text-white">
            Ver detalhes
          </span>
        </div>
      </div>
    </button>
  );
}
