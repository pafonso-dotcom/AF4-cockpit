import React, { useState, useMemo } from "react";
import { Search, Trash2, History, FileText, Plus, Edit3, AlertCircle } from "lucide-react";
import { T } from "../../lib/theme.js";
import { confirm } from "../../lib/confirm.js";
import { toast } from "../../lib/toast.js";
import { list, clear, formatTime, formatDate } from "../../lib/auditLog.js";
import PageHeader from "../ui/PageHeader.jsx";

const FILTROS = [
  { id: "todos",  label: "Todos" },
  { id: "create", label: "Criados" },
  { id: "update", label: "Editados" },
  { id: "delete", label: "Excluídos" },
  { id: "system", label: "Sistema" },
];

export default function AuditLog() {
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [reload, setReload] = useState(0);

  const entries = useMemo(() => list(), [reload]);

  const filtradas = useMemo(() => {
    let arr = entries;
    if (filtro !== "todos") arr = arr.filter(e => e.action === filtro);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      arr = arr.filter(e =>
        (e.target?.nome || "").toLowerCase().includes(q) ||
        (e.target?.tipo || "").toLowerCase().includes(q) ||
        (e.autor || "").toLowerCase().includes(q)
      );
    }
    return arr;
  }, [entries, filtro, busca]);

  // Agrupa por dia
  const porDia = useMemo(() => {
    const map = new Map();
    filtradas.forEach(e => {
      const dia = formatDate(e.ts);
      if (!map.has(dia)) map.set(dia, []);
      map.get(dia).push(e);
    });
    return [...map.entries()];
  }, [filtradas]);

  const limparTudo = async () => {
    const ok = await confirm({
      title: "Limpar todo o histórico?",
      body: `${entries.length} registros serão apagados permanentemente. Não há como desfazer.`,
      danger: true, confirmLabel: "Limpar tudo",
    });
    if (!ok) return;
    clear();
    setReload(r => r + 1);
    toast.success("Histórico limpo.");
  };

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Finanças · Auditoria"
        title={<>Histórico de <em>alterações.</em></>}
        sub="Registro de tudo que mudou no cockpit · útil pra revisar erros, auditar mudanças e debugar."
        action={
          entries.length > 0 && (
            <button onClick={limparTudo} className="btn-ghost"
                    style={{ color: T.red, borderColor: T.red, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Trash2 size={12} /> Limpar histórico
            </button>
          )
        }
      />

      {/* Filtros */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {FILTROS.map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
                  style={{
                    padding: "6px 11px", fontSize: 10.5, letterSpacing: ".1em",
                    textTransform: "uppercase", fontWeight: 500, borderRadius: 11,
                    background: filtro === f.id ? `${T.gold}22` : "transparent",
                    color: filtro === f.id ? T.gold : T.muted,
                    border: `1px solid ${filtro === f.id ? T.gold : T.border}`,
                    cursor: "pointer",
                  }}>
            {f.label}
          </button>
        ))}
        <div style={{ position: "relative", flex: 1, minWidth: 200, marginLeft: "auto" }}>
          <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
          <input value={busca} onChange={e => setBusca(e.target.value)}
                 placeholder="Buscar…"
                 style={{ width: "100%", padding: "6px 10px 6px 28px", background: T.bgSoft, border: `1px solid ${T.border}`, color: T.ink, fontSize: 12, borderRadius: 11 }} />
        </div>
      </div>

      {entries.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: T.muted, fontStyle: "italic", border: `1px dashed ${T.border}`, borderRadius: 16 }}>
          <History size={32} style={{ opacity: 0.4, margin: "0 auto 12px" }} /><br />
          Nenhuma alteração registrada ainda.<br />
          <span style={{ fontSize: 11 }}>Conforme você usa o cockpit, suas ações aparecerão aqui.</span>
        </div>
      ) : (
        porDia.map(([dia, lista]) => (
          <div key={dia} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 10, letterSpacing: ".25em", textTransform: "uppercase", color: T.muted, fontWeight: 500, marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${T.border}` }}>
              {dia} · {lista.length} {lista.length === 1 ? "registro" : "registros"}
            </div>
            {lista.map(e => <AuditRow key={e.id} entry={e} />)}
          </div>
        ))
      )}
    </div>
  );
}

function AuditRow({ entry }) {
  const config = {
    create: { cor: T.green || "#4ade80", bg: "#4ade8022", label: "Criou",     Ic: Plus },
    update: { cor: T.blue  || "#60a5fa", bg: "#60a5fa22", label: "Editou",    Ic: Edit3 },
    delete: { cor: T.red   || "#f87171", bg: "#f8717122", label: "Excluiu",   Ic: Trash2 },
    system: { cor: T.muted || "#8a8a93", bg: "#8a8a9322", label: "Sistema",   Ic: AlertCircle },
  }[entry.action] || { cor: T.muted, bg: `${T.muted}22`, label: entry.action, Ic: FileText };

  const Ic = config.Ic;

  const detalhe = (() => {
    const m = entry.meta || {};
    if (entry.action === "update" && m.antes && m.depois) {
      const keys = Object.keys(m.depois).filter(k => m.antes[k] !== m.depois[k] && k !== "id");
      if (keys.length === 0) return null;
      return keys.slice(0, 3).map(k => `${k}: ${String(m.antes[k] ?? "—").slice(0, 30)} → ${String(m.depois[k] ?? "—").slice(0, 30)}`).join(" · ");
    }
    return null;
  })();

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 12px", borderBottom: `1px dashed ${T.border}`,
      fontSize: 12, transition: "background .15s",
    }}
         onMouseEnter={e => e.currentTarget.style.background = T.bgSoft}
         onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <span style={{ color: T.faint, fontFamily: "monospace", width: 50, flexShrink: 0, fontSize: 11 }}>
        {formatTime(entry.ts)}
      </span>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 9, padding: "2px 7px", borderRadius: 4,
        background: config.bg, color: config.cor,
        letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600,
        flexShrink: 0, minWidth: 70, justifyContent: "center",
      }}>
        <Ic size={9} /> {config.label}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: T.muted, fontSize: 10.5, letterSpacing: ".05em", textTransform: "uppercase", marginRight: 6 }}>
          {entry.target?.tipo || "?"}
        </span>
        <strong style={{ color: T.ink, fontWeight: 500 }}>{entry.target?.nome || "—"}</strong>
        {detalhe && (
          <div style={{ fontSize: 10, color: T.faint, marginTop: 2, fontStyle: "italic" }}>
            {detalhe}
          </div>
        )}
      </span>
      <span style={{ color: T.faint, fontSize: 10, flexShrink: 0 }}>{entry.autor}</span>
    </div>
  );
}
