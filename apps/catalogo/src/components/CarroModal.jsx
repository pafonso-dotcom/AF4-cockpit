import React, { useEffect, useState } from "react";
import {
  X,
  Calendar,
  Settings2,
  Fuel,
  Gauge,
  Palette,
  Check,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import CarImage from "./CarImage.jsx";
import { fmtPreco, fmtKm } from "../lib/format.js";
import { linkWhatsApp } from "../config.js";

/** Detalhes do veículo + galeria de fotos + CTA de WhatsApp. */
export default function CarroModal({ carro, onClose }) {
  const [idx, setIdx] = useState(0);

  // Galeria: usa "fotos" (array) ou cai pra "foto" única.
  const fotos = carro
    ? carro.fotos?.length
      ? carro.fotos
      : carro.foto
        ? [carro.foto]
        : []
    : [];
  const temGaleria = fotos.length > 1;
  const irPara = (n) => setIdx((n + fotos.length) % fotos.length);

  // Fecha no ESC, navega galeria com ← →, e trava o scroll do fundo.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (temGaleria && e.key === "ArrowLeft") setIdx((i) => (i - 1 + fotos.length) % fotos.length);
      if (temGaleria && e.key === "ArrowRight") setIdx((i) => (i + 1) % fotos.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, temGaleria, fotos.length]);

  if (!carro) return null;

  const km = fmtKm(carro.km);
  const ficha = [
    { icon: Calendar, label: "Ano", value: carro.ano },
    { icon: Settings2, label: "Câmbio", value: carro.cambio },
    { icon: Fuel, label: "Combustível", value: carro.combustivel },
    km ? { icon: Gauge, label: "Quilometragem", value: km } : null,
    carro.cor ? { icon: Palette, label: "Cor", value: carro.cor } : null,
  ].filter(Boolean);

  const href = linkWhatsApp({ ...carro, precoFmt: fmtPreco(carro.preco) });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="fade-up flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-line bg-surface sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Galeria + fechar */}
        <div className="relative aspect-[16/10] w-full shrink-0">
          <CarImage
            src={fotos[idx]}
            alt={`${carro.marca} ${carro.modelo} — foto ${idx + 1}`}
            className="h-full w-full"
          />
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white ring-1 ring-white/20 transition hover:bg-black/80"
          >
            <X size={18} />
          </button>

          {temGaleria && (
            <>
              <button
                onClick={() => irPara(idx - 1)}
                aria-label="Foto anterior"
                className="absolute left-3 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/20 transition hover:bg-black/80"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => irPara(idx + 1)}
                aria-label="Próxima foto"
                className="absolute right-3 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/20 transition hover:bg-black/80"
              >
                <ChevronRight size={20} />
              </button>
              <span className="absolute right-3 bottom-3 z-10 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/15">
                {idx + 1}/{fotos.length}
              </span>
            </>
          )}

          <div className="pointer-events-none absolute bottom-3 left-4 right-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
              {carro.marca}
            </div>
            <h2 className="font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl">
              {carro.modelo}{" "}
              <span className="text-zinc-300">{carro.versao}</span>
            </h2>
          </div>
        </div>

        {/* Miniaturas */}
        {temGaleria && (
          <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-line bg-surface px-4 py-3">
            {fotos.map((f, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Ver foto ${i + 1}`}
                className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg ring-2 transition ${
                  i === idx ? "ring-accent" : "ring-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <CarImage src={f} alt="" className="h-full w-full" />
              </button>
            ))}
          </div>
        )}

        {/* Corpo rolável */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Preço */}
          <div className="mb-5 flex items-end justify-between rounded-2xl bg-surface2 p-4 ring-1 ring-line">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                {carro.vendido ? "Vendido por" : "Valor"}
              </div>
              <div className="num font-display text-3xl font-extrabold text-money">
                {fmtPreco(carro.preco)}
              </div>
            </div>
            {carro.vendido && (
              <span className="rounded-full bg-black/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white ring-1 ring-white/20">
                Vendido
              </span>
            )}
          </div>

          {/* Ficha técnica */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ficha.map((f, i) => (
              <div
                key={i}
                className="rounded-xl bg-surface2 p-3 ring-1 ring-line"
              >
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
                  <f.icon size={13} className="text-accent" />
                  {f.label}
                </div>
                <div className="mt-1 font-semibold text-white">{f.value}</div>
              </div>
            ))}
          </div>

          {/* Extras / opcionais */}
          {carro.extras?.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Itens & opcionais
              </div>
              <div className="flex flex-wrap gap-2">
                {carro.extras.map((e, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 px-3 py-1.5 text-[12px] font-medium text-accentSoft ring-1 ring-accent/25"
                  >
                    <Check size={13} /> {e}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CTA fixo no rodapé do modal */}
        <div className="shrink-0 border-t border-line bg-surface p-4">
          <a
            href={carro.vendido ? undefined : href}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={carro.vendido}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold uppercase tracking-wide transition ${
              carro.vendido
                ? "cursor-not-allowed bg-surface2 text-zinc-500 ring-1 ring-line"
                : "bg-gradient-to-r from-accent to-brand text-white hover:from-accentSoft hover:to-brandSoft active:scale-[0.99]"
            }`}
            onClick={(e) => carro.vendido && e.preventDefault()}
          >
            <MessageCircle size={18} />
            {carro.vendido ? "Veículo vendido" : "Tenho interesse · falar no WhatsApp"}
          </a>
        </div>
      </div>
    </div>
  );
}
