import React, { useMemo, useState } from "react";
import { SearchX } from "lucide-react";
import Hero from "./components/Hero.jsx";
import Filtros from "./components/Filtros.jsx";
import CarroCard from "./components/CarroCard.jsx";
import CarroModal from "./components/CarroModal.jsx";
import Vendedor from "./components/Vendedor.jsx";
import { VEICULOS } from "./data/veiculos.js";
import { LOJA } from "./config.js";

export default function App() {
  const [busca, setBusca] = useState("");
  const [marca, setMarca] = useState("");
  const [cambio, setCambio] = useState("");
  const [ordem, setOrdem] = useState("relevancia");
  const [selecionado, setSelecionado] = useState(null);

  // Marcas únicas (ordenadas) pro filtro
  const marcas = useMemo(
    () => [...new Set(VEICULOS.map((v) => v.marca))].sort(),
    []
  );

  // Aplica busca + filtros + ordenação. Vendidos vão pro fim.
  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let out = VEICULOS.filter((v) => {
      if (marca && v.marca !== marca) return false;
      if (cambio && v.cambio !== cambio) return false;
      if (termo) {
        const alvo = `${v.marca} ${v.modelo} ${v.versao || ""} ${
          v.combustivel
        }`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });

    out = [...out].sort((a, b) => {
      // Vendidos sempre por último
      if (!!a.vendido !== !!b.vendido) return a.vendido ? 1 : -1;
      if (ordem === "menor") return a.preco - b.preco;
      if (ordem === "maior") return b.preco - a.preco;
      // relevância: destaques primeiro, depois mais baratos
      if (!!a.destaque !== !!b.destaque) return a.destaque ? -1 : 1;
      return a.preco - b.preco;
    });
    return out;
  }, [busca, marca, cambio, ordem]);

  const disponiveis = lista.filter((v) => !v.vendido).length;

  return (
    <div className="min-h-screen bg-ink">
      <Hero />

      <Filtros
        busca={busca}
        setBusca={setBusca}
        marca={marca}
        setMarca={setMarca}
        cambio={cambio}
        setCambio={setCambio}
        ordem={ordem}
        setOrdem={setOrdem}
        marcas={marcas}
        total={disponiveis}
      />

      <main className="mx-auto max-w-6xl px-4 py-8">
        {lista.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface/40 py-20 text-center">
            <SearchX size={36} className="mb-3 text-zinc-600" />
            <p className="text-zinc-400">
              Nenhum veículo encontrado com esses filtros.
            </p>
            <button
              onClick={() => {
                setBusca("");
                setMarca("");
                setCambio("");
              }}
              className="mt-4 rounded-lg bg-brand/10 px-4 py-2 text-sm font-semibold text-brandSoft ring-1 ring-brand/30 transition hover:bg-brand hover:text-white"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((carro) => (
              <CarroCard
                key={carro.id}
                carro={carro}
                onAbrir={setSelecionado}
              />
            ))}
          </div>
        )}
      </main>

      <Vendedor />

      {/* Rodapé legal */}
      <footer className="border-t border-line bg-ink py-6 text-center">
        <p className="text-[11px] text-zinc-600">
          © {new Date().getFullYear()} {LOJA.nome} · Catálogo de veículos
          seminovos. Valores e disponibilidade sujeitos a alteração sem aviso
          prévio.
        </p>
      </footer>

      {selecionado && (
        <CarroModal
          carro={selecionado}
          onClose={() => setSelecionado(null)}
        />
      )}
    </div>
  );
}
