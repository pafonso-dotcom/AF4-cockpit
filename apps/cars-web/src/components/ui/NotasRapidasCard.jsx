import React, { useState, useEffect, useRef } from "react";
import { StickyNote } from "lucide-react";
import { T } from "../../lib/theme.js";
import { CARD_SHADOW } from "../../lib/styles.js";

// Bloco de notas rápidas — texto livre salvo automaticamente no localStorage
// (debounce de 500ms). Serve pra lembretes/rascunhos à mão. Por padrão usa a
// chave única (mesma nota em todo lugar); passe `storageKey` pra ter uma nota
// própria do módulo (ex.: Cartões).
const NOTAS_KEY = "af4:notas-rapidas:v1";

export default function NotasRapidasCard({ style, storageKey = NOTAS_KEY }) {
  const [txt, setTxt] = useState(() => { try { return localStorage.getItem(storageKey) || ""; } catch { return ""; } });
  const [salvo, setSalvo] = useState(true);
  const primeiro = useRef(true);
  useEffect(() => {
    if (primeiro.current) { primeiro.current = false; return; }
    setSalvo(false);
    const id = setTimeout(() => {
      try { localStorage.setItem(storageKey, txt); } catch {}
      setSalvo(true);
    }, 500);
    return () => clearTimeout(id);
  }, [txt, storageKey]);
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, boxShadow: CARD_SHADOW, ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StickyNote size={15} style={{ color: T.gold }} />
          <div style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 600 }}>Notas rápidas</div>
        </div>
        <span style={{ fontSize: 10, color: salvo ? T.faint : T.gold }}>{salvo ? "salvo" : "salvando…"}</span>
      </div>
      <textarea value={txt} onChange={(e) => setTxt(e.target.value)}
        placeholder="Anote lembretes, ideias, números… fica salvo automaticamente."
        rows={5}
        style={{ width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: 96, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 11px", color: T.ink, fontFamily: "inherit", fontSize: 14, lineHeight: 1.5, outline: "none" }} />
    </div>
  );
}
