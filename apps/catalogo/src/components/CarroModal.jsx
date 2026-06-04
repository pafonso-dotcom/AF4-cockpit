import React, { useEffect } from "react";
import {
  X,
  Calendar,
  Settings2,
  Fuel,
  Gauge,
  Palette,
  Check,
  MessageCircle,
} from "lucide-react";
import CarImage from "./CarImage.jsx";
import { fmtPreco, fmtKm } from "../lib/format.js";
import { linkWhatsApp } from "../config.js";

/** Detalhes do veículo + CTA de WhatsApp. */
export default function CarroModal({ carro, onClose }) {
  // Fecha no ESC e trava o scroll do fundo enquanto aberto.
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

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
        {/* Foto + fechar */}
        <div className="relative aspect-[16/10] w-full shrink-0">
          <CarImage
            src={carro.foto}
            alt={`${carro.marca} ${carro.modelo}`}
            className="h-full w-full"
          />
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white ring-1 ring-white/20 transition hover:bg-black/80"
          >
            <X size={18} />
          </button>
          <div className="absolute bottom-3 left-4 right-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
              {carro.marca}
            </div>
            <h2 className="font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl">
              {carro.modelo}{" "}
              <span className="text-zinc-300">{carro.versao}</span>
            </h2>
          </div>
        </div>

        {/* Corpo rolável */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Preço */}
          <div className="mb-5 flex items-end justify-between rounded-2xl bg-surface2 p-4 ring-1 ring-line">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                {carro.vendido ? "Vendido por" : "Valor"}
              </div>
              <div className="num font-display text-3xl font-extrabold text-brandSoft">
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
                  <f.icon size={13} className="text-brandSoft" />
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
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand/10 px-3 py-1.5 text-[12px] font-medium text-brandSoft ring-1 ring-brand/25"
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
