import React from "react";
import { Wallet, Briefcase, Car, Settings } from "lucide-react";
import { T } from "../lib/theme.js";

/**
 * Bottom tab bar fixo no celular (≤640px). Esconde em desktop.
 * Navega entre os 3 módulos + abre Configurações.
 */
export default function BottomTabBar({ modulo, setModulo, setTab, escopoAtivo, onEscopoChange }) {
  const irPara = (id) => {
    setModulo(id);
    const firstTab = FIRST_TAB_OF[id];
    if (firstTab) setTab(firstTab);
    if (id === "loja" && escopoAtivo === "pessoal") onEscopoChange?.("negocio");
  };

  const irConfig = () => {
    setModulo("config");
    setTab("cfg-aparencia");
  };

  const items = [
    { id: "financas", label: "Finanças", icon: Wallet,    onClick: () => irPara("financas") },
    { id: "invest",   label: "Invest",   icon: Briefcase, onClick: () => irPara("invest") },
    { id: "loja",     label: "Loja",     icon: Car,       onClick: () => irPara("loja") },
    { id: "config",   label: "Config",   icon: Settings,  onClick: irConfig },
  ];

  return (
    <>
      <nav className="bottom-tab-bar" aria-label="Navegação principal">
        <div className="btb-inner">
          {items.map(it => {
            const Icon = it.icon;
            const active = modulo === it.id;
            return (
              <button key={it.id} onClick={it.onClick}
                className={`btb-item${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}>
                <Icon size={22} strokeWidth={active ? 2.2 : 1.6} />
                <span>{it.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <style>{`
        .bottom-tab-bar {
          display: none;
        }
        @media (max-width: 640px) {
          .bottom-tab-bar {
            display: block;
            position: fixed; left: 0; right: 0; bottom: 0;
            background: rgba(10,10,12,.97);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-top: 1px solid rgba(255,255,255,0.08);
            padding-bottom: env(safe-area-inset-bottom, 0);
            z-index: 60;
          }
          .btb-inner {
            display: flex; align-items: stretch;
            max-width: 640px; margin: 0 auto;
          }
          .btb-item {
            flex: 1; min-height: 56px;
            background: transparent; border: none;
            color: #a8a8b0;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center; gap: 2px;
            font-size: 10px; letter-spacing: .04em; font-weight: 600;
            cursor: pointer; padding: 8px 4px 6px;
            font-family: ${T.sans};
            transition: color .15s ease, transform .15s ease;
            position: relative;
          }
          .btb-item:active { transform: scale(0.94); }
          .btb-item.active { color: ${T.gold}; }
          .btb-item.active::before {
            content: "";
            position: absolute; top: 0; left: 50%;
            transform: translateX(-50%);
            width: 28px; height: 2.5px;
            background: ${T.gold}; border-radius: 0 0 2px 2px;
          }
        }
      `}</style>
    </>
  );
}

// Primeira aba ao trocar de módulo (espelha o que o Header faz)
const FIRST_TAB_OF = {
  financas: "dashboard",
  invest:   "investimentos",
  loja:     "loja-painel",
};
