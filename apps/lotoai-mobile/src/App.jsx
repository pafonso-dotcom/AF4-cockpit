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
import { tokenDaURL, decodeBolao, limparTokenDaURL } from "./lib/share.js";

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bolaoCompartilhado, setBolaoCompartilhado] = useState(null);

  useEffect(() => {
    // Se a URL traz um bolão compartilhado, decodifica antes do splash sair
    const tok = tokenDaURL();
    if (tok) {
      const b = decodeBolao(tok);
      if (b) {
        setBolaoCompartilhado(b);
        setTab("bolao");
      }
    }
  }, []);

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

  function consumirCompartilhado() {
    limparTokenDaURL();
    setBolaoCompartilhado(null);
  }

  if (loading) return <Splash />;

  const ultimo = historico[historico.length - 1];

  return (
    <div className="min-h-screen bg-ink text-white">
      <Header ultimoConcurso={ultimo} historico={historico} onHistoricoUpdate={setHistorico} />
      <main>
        {tab === "dashboard" && <Dashboard historico={historico} />}
        {tab === "gerar"     && <GerarJogos historico={historico} />}
        {tab === "fechar"    && <Fechamentos historico={historico} />}
        {tab === "bolao"     && (
          <Bolao
            historico={historico}
            bolaoCompartilhado={bolaoCompartilhado}
            onConsumirCompartilhado={consumirCompartilhado}
          />
        )}
        {tab === "conferir"  && <Conferencia historico={historico} />}
        {tab === "simular"   && <Simulacoes historico={historico} />}
      </main>
      <BottomTabBar tab={tab} onChange={setTab} />
    </div>
  );
}
