import React from "react";
import { LayoutDashboard, Wand2, Layers, FlaskConical } from "lucide-react";

const TABS = [
  { id: "dashboard", label: "Painel", icon: LayoutDashboard },
  { id: "gerar", label: "Gerar", icon: Wand2 },
  { id: "fechar", label: "Fechar", icon: Layers },
  { id: "simular", label: "Simular", icon: FlaskConical },
];

export default function BottomTabBar({ tab, onChange }) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 bg-panel/95 backdrop-blur border-t border-line"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <li key={id}>
              <button
                onClick={() => onChange(id)}
                className={`w-full flex flex-col items-center gap-1 py-3 transition ${
                  active ? "text-gold" : "text-white/55"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
