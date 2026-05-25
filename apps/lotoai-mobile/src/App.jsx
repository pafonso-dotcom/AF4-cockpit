import React, { useEffect, useState } from "react";

import Header from "./components/Header.jsx";
import BottomTabBar from "./components/BottomTabBar.jsx";
import Dashboard from "./components/pages/Dashboard.jsx";
import GerarJogos from "./components/pages/GerarJogos.jsx";
import Simulacoes from "./components/pages/Simulacoes.jsx";

import { listarConcursos } from "./lib/supabase.js";

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const list = await listarConcursos({ limite: 500 });
      setHistorico(list);
      setLoading(false);
    })();
  }, []);

  const ultimo = historico[historico.length - 1];

  return (
    <div className="min-h-screen bg-ink text-white">
      <Header ultimoConcurso={ultimo} />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-white/50">
          Carregando concursos…
        </div>
      ) : (
        <main>
          {tab === "dashboard" && <Dashboard historico={historico} />}
          {tab === "gerar"     && <GerarJogos historico={historico} />}
          {tab === "simular"   && <Simulacoes historico={historico} />}
        </main>
      )}

      <BottomTabBar tab={tab} onChange={setTab} />
    </div>
  );
}
