import React from "react";
import { Phone, Instagram, MapPin, ShoppingCart } from "lucide-react";
import { LOJA, linkWhatsApp } from "../config.js";

/** Rodapé do vendedor — contato + CTA "Comprar agora", igual à arte. */
export default function Vendedor() {
  const iniciais = LOJA.vendedor
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <section className="border-t border-line bg-gradient-to-b from-surface to-ink">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid items-center gap-6 rounded-3xl border border-line bg-surface p-6 sm:grid-cols-[auto,1fr,auto] sm:p-8">
          {/* Avatar + nome */}
          <div className="flex items-center gap-4">
            {LOJA.vendedorFoto ? (
              <img
                src={LOJA.vendedorFoto}
                alt={LOJA.vendedor}
                className="h-16 w-16 rounded-full object-cover ring-2 ring-brand/40"
              />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-full bg-brand/15 font-display text-xl font-extrabold text-brandSoft ring-2 ring-brand/40">
                {iniciais}
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                Seu vendedor
              </div>
              <div className="font-display text-xl font-extrabold uppercase text-white">
                {LOJA.vendedor}
              </div>
              <div className="mt-0.5 max-w-[14rem] text-[11px] leading-tight text-zinc-400">
                {LOJA.vendedorCargo}
              </div>
            </div>
          </div>

          {/* Contatos */}
          <div className="flex flex-col gap-2.5 sm:border-l sm:border-line sm:pl-8">
            <a
              href={linkWhatsApp(null)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 text-sm text-zinc-200 transition hover:text-brandSoft"
            >
              <Phone size={16} className="text-brandSoft" />
              {LOJA.telefoneExibicao}
            </a>
            <a
              href={LOJA.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 text-sm text-zinc-200 transition hover:text-brandSoft"
            >
              <Instagram size={16} className="text-brandSoft" />
              {LOJA.instagram}
            </a>
            <div className="flex items-center gap-2.5 text-sm text-zinc-200">
              <MapPin size={16} className="text-brandSoft" />
              {LOJA.cidade}
            </div>
          </div>

          {/* CTA */}
          <a
            href={linkWhatsApp(null)}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center gap-3 rounded-2xl bg-brand px-6 py-4 transition hover:bg-brandSoft active:scale-[0.99]"
          >
            <ShoppingCart size={26} className="text-white" />
            <div className="text-left leading-none">
              <div className="font-display text-xl font-extrabold uppercase text-white">
                Comprar agora!
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wide text-white/80">
                Clique e fale com o vendedor
              </div>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}
