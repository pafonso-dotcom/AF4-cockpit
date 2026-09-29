import React, { useState, useEffect } from "react";
import { Calendar, StickyNote, Bell } from "lucide-react";
import { T } from "../../lib/theme.js";
import Calendario from "./Calendario.jsx";
import Notas from "./Notas.jsx";
import Lembretes from "./Lembretes.jsx";

const VIEWS = [
  { id: "calendario",   label: "Calendário",   icon: Calendar },
  { id: "compromissos", label: "Compromissos", icon: StickyNote },
  { id: "lembretes",    label: "Lembretes",    icon: Bell },
];

/**
 * Hub do Calendário — reorganização 2026-09-29 (Agenda 8→4 abas):
 * Compromissos e Lembretes viraram views daqui (são todos "datas e
 * avisos"). As abas antigas viram alias via viewInicial.
 */
export default function AgendaCalendarioHub({ viewInicial, ...props }) {
  const [view, setView] = useState(viewInicial || "calendario");
  useEffect(() => { if (viewInicial) setView(viewInicial); }, [viewInicial]);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "18px 0 0" }}>
        {VIEWS.map(v => {
          const Icon = v.icon;
          const ativo = view === v.id;
          return (
            <button key={v.id} onClick={() => setView(v.id)}
              style={{
                padding: "9px 16px",
                background: ativo ? `${T.gold}22` : T.card,
                border: `1px solid ${ativo ? T.gold : T.border}`,
                color: ativo ? T.gold : T.muted,
                fontSize: 12, fontWeight: 600, borderRadius: 100,
                cursor: "pointer", letterSpacing: ".03em",
                display: "inline-flex", alignItems: "center", gap: 7,
                transition: "all .15s ease",
              }}>
              <Icon size={14} />
              {v.label}
            </button>
          );
        })}
      </div>
      {view === "calendario" && (
        <Calendario transacoes={props.transacoes} setTransacoes={props.setTransacoes}
                    contas={props.contas} setContas={props.setContas}
                    categorias={props.categorias} hidden={props.hidden}
                    fixas={props.fixas} fixaOcorrencias={props.fixaOcorrencias}
                    parcelamentos={props.parcelamentos} dividas={props.dividas} devedores={props.devedores}
                    cheques={props.cheques} cartoes={props.cartoes}
                    agenda={props.agenda} setAgenda={props.setAgenda}
                    escopoAtivo={props.escopoAtivo} />
      )}
      {view === "compromissos" && (
        <Notas agenda={props.agenda} setAgenda={props.setAgenda}
               notasLegacy={props.notasLegacy} setNotasLegacy={props.setNotasLegacy} />
      )}
      {view === "lembretes" && (
        <Lembretes lembretes={props.lembretes} setLembretes={props.setLembretes} />
      )}
    </div>
  );
}
