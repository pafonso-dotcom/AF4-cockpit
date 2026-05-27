import React, { useEffect, useState } from "react";

import Header from "./components/Header.jsx";
import BottomTabBar from "./components/BottomTabBar.jsx";
import Splash from "./components/ui/Splash.jsx";
import Dashboard from "./components/pages/Dashboard.jsx";
import GerarJogos from "./components/pages/GerarJogos.jsx";
import Fechamentos from "./components/pages/Fechamentos.jsx";
import Bolao from "./components/pages/Bolao.jsx";
import Conferencia from "./components/pages/Conferencia.jsx";
import Simulacoes from "./components/pages/Simulacoes.jsx";

import { listarConcursos } from "./lib/supabase.js";

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const t0 = Date.now();
      const list = await listarConcursos({ limite: 5000 });
      setHistorico(list);
      // garante splash visível por pelo menos 600ms (sensação de produto, não bug)
      const min = 600;
      const elapsed = Date.now() - t0;
      if (elapsed < min) await new Promise(r => setTimeout(r, min - elapsed));
      setLoading(false);
    })();
  }, []);

  if (loading) return <Splash />;

  const ultimo = historico[historico.length - 1];

  return (
    <div className="min-h-screen bg-ink text-white">
      <Header ultimoConcurso={ultimo} historico={historico} onHistoricoUpdate={setHistorico} />
      <main>
        {tab === "dashboard" && <Dashboard historico={historico} />}
        {tab === "gerar"     && <GerarJogos historico={historico} />}
        {tab === "fechar"    && <Fechamentos historico={historico} />}
        {tab === "bolao"     && <Bolao historico={historico} />}
        {tab === "conferir"  && <Conferencia historico={historico} />}
        {tab === "simular"   && <Simulacoes historico={historico} />}
      </main>
      <BottomTabBar tab={tab} onChange={setTab} />
    </div>
  );
}
