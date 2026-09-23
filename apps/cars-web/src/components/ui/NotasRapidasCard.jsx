import React, { useState, useEffect, useRef } from "react";
import { StickyNote } from "lucide-react";
import { T } from "../../lib/theme.js";
import { CARD_SHADOW } from "../../lib/styles.js";

// Bloco de notas rápidas — texto livre salvo automaticamente (debounce 500ms).
//
// Dois modos:
//  - SINCRONIZADO (novo, 2026-09-22): passe `valor` + `onSalvar` e a nota vive
//    no estado do app → vai pra nuvem e aparece em todos os aparelhos (pedido:
//    "deixa salvo o que for lançado, aí dá pra ver no mobile"). Na primeira
//    vez, migra o texto que já estava no localStorage do aparelho.
//  - LOCAL (legado): sem `onSalvar`, continua só no localStorage deste aparelho.
const NOTAS_KEY = "af4:notas-rapidas:v1";

export default function NotasRapidasCard({ style, storageKey = NOTAS_KEY, valor, onSalvar, linhas = 5 }) {
  const sincronizado = typeof onSalvar === "function";
  const lerLocal = () => { try { return localStorage.getItem(storageKey) || ""; } catch { return ""; } };
  const [txt, setTxt] = useState(() => {
    if (sincronizado && valor) return valor;
    return lerLocal();
  });
  const [salvo, setSalvo] = useState(true);
  const primeiro = useRef(true);
  const emFoco = useRef(false);

  // Migração one-shot: nota antiga do aparelho sobe pro estado sincronizado.
  useEffect(() => {
    if (sincronizado && !valor && txt) onSalvar(txt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nota atualizada em OUTRO aparelho chegou pelo sync → reflete aqui,
  // desde que o usuário não esteja digitando neste campo agora.
  useEffect(() => {
    if (sincronizado && valor != null && valor !== txt && !emFoco.current) setTxt(valor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  useEffect(() => {
    if (primeiro.current) { primeiro.current = false; return; }
    setSalvo(false);
    const id = setTimeout(() => {
      try { localStorage.setItem(storageKey, txt); } catch {} // cache local sempre
      if (sincronizado) onSalvar(txt);
      setSalvo(true);
    }, 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txt, storageKey]);

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, boxShadow: CARD_SHADOW, ...style }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StickyNote size={15} style={{ color: T.gold }} />
          <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>Notas rápidas</div>
        </div>
        <span style={{ fontSize: 10, color: salvo ? T.faint : T.gold }}>{salvo ? "salvo" : "salvando…"}</span>
      </div>
      <textarea value={txt} onChange={(e) => setTxt(e.target.value)}
        onFocus={() => { emFoco.current = true; }}
        onBlur={() => { emFoco.current = false; }}
        placeholder="Anote lembretes, ideias, números… fica salvo automaticamente."
        rows={linhas}
        style={{ width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: Math.max(96, linhas * 24), background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 12, padding: "9px 11px", color: T.ink, fontFamily: "inherit", fontSize: 17, lineHeight: 1.5, outline: "none" }} />
    </div>
  );
}
