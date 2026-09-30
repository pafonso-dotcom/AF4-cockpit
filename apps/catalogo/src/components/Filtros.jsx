import React from "react";
import { Search } from "lucide-react";

/**
 * Barra de busca + filtros (marca, câmbio, combustível, ordenação).
 * Recebe o estado e os setters do App — fica "burro" de propósito.
 */
export default function Filtros({
  busca,
  setBusca,
  marca,
  setMarca,
  cambio,
  setCambio,
  ordem,
  setOrdem,
  marcas,
  total,
}) {
  const selectCls =
    "rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-zinc-200 outline-none transition focus:border-brand/60";

  return (
    <div className="sticky top-0 z-30 border-b border-line bg-ink/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* Busca */}
          <div className="relative flex-1">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por marca, modelo, versão..."
              className="w-full rounded-lg border border-line bg-surface py-2.5 pl-10 pr-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-brand/60"
            />
          </div>

          {/* Selects */}
          <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
            <select
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              className={selectCls}
            >
              <option value="">Marca</option>
              {marcas.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={cambio}
              onChange={(e) => setCambio(e.target.value)}
              className={selectCls}
            >
              <option value="">Câmbio</option>
              <option value="Automático">Automático</option>
              <option value="Manual">Manual</option>
            </select>

            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value)}
              className={selectCls}
            >
              <option value="relevancia">Destaques</option>
              <option value="menor">Menor preço</option>
              <option value="maior">Maior preço</option>
            </select>
          </div>
        </div>

        <div className="mt-2 text-[11px] uppercase tracking-wider text-zinc-500">
          {total} {total === 1 ? "veículo disponível" : "veículos disponíveis"}
        </div>
      </div>
    </div>
  );
}
