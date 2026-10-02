import React, { useState } from "react";
import { T } from "../../lib/theme.js";
import { haQuanto, rotuloTema, lerVistas } from "../../lib/noticias.js";
import { useLeitorVoz } from "../../lib/useLeitorVoz.js";
import { useBriefing, PlayerManchetes } from "./Noticias.jsx";
import Card from "../ui/Card.jsx";

/** Painel · "📰 Seu briefing" — atualiza ao abrir o app; fim do Painel, com ocultar. */
export default function NoticiasCard({ onVer }) {
  const [oculto, setOculto] = useState(() => { try { return localStorage.getItem("af4:painel-noticias-oculto") === "1"; } catch { return false; } });
  const alternar = () => setOculto(o => { const n = !o; try { localStorage.setItem("af4:painel-noticias-oculto", n ? "1" : "0"); } catch {} return n; });
  const { itens, estado } = useBriefing();
  const leitor = useLeitorVoz();
  const vistas = lerVistas();
  const top = itens.slice(0, 5);
  const novas = itens.filter(n => !vistas.has(n.link)).length;

  if (oculto) {
    return (
      <button onClick={alternar} style={{ width: "100%", marginBottom: 14, padding: "10px 14px", borderRadius: 14, border: `1px dashed ${T.border}`, background: "transparent", color: T.muted, cursor: "pointer", fontSize: 12.5, textAlign: "left" }}>
        📰 Seu briefing{novas ? ` (${novas} novidades)` : ""} · mostrar
      </button>
    );
  }
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T.ink }}>📰 Seu briefing
          {novas > 0 && <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 800, color: "#0d1f1b", background: "#4DD9C0", borderRadius: 99, padding: "2px 8px", verticalAlign: "middle" }}>{novas} novas</span>}
        </span>
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <PlayerManchetes itens={itens} leitor={leitor} rotulo="Ouvir" max={8} />
          <button onClick={alternar} style={{ fontSize: 11, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 12, padding: "3px 8px", background: "transparent", cursor: "pointer", minHeight: 0 }}>ocultar</button>
        </span>
      </div>
      {estado === "carregando" && !top.length && <div style={{ fontSize: 12.5, color: T.muted }}>Buscando novidades dos seus temas…</div>}
      {estado === "erro" && !top.length && <div style={{ fontSize: 12.5, color: T.muted }}>Sem conexão pra buscar notícias agora.</div>}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {top.map((n, i) => (
          <a key={n.link} href={n.link} target="_blank" rel="noopener noreferrer"
             style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderTop: i ? `1px solid ${T.border}` : "none", textDecoration: "none" }}>
            {n.imagem ? <img src={n.imagem} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} style={{ width: 54, height: 40, objectFit: "cover", borderRadius: 8, flexShrink: 0, background: T.bgSoft }} />
              : <span style={{ width: 54, height: 40, borderRadius: 8, background: T.bgSoft, display: "grid", placeItems: "center", flexShrink: 0 }}>📰</span>}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: leitor.lendo && leitor.atual === i + 1 ? T.gold : T.ink, lineHeight: 1.3,
                             overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{n.titulo}</span>
              <span style={{ display: "block", fontSize: 11, color: T.muted, marginTop: 2 }}>{rotuloTema(n.tema)} · {n.fonte} · {haQuanto(n.horas)}</span>
            </span>
          </a>
        ))}
      </div>
      {onVer && itens.length > 0 && (
        <button onClick={onVer} style={{ marginTop: 8, background: "transparent", border: "none", color: T.gold, cursor: "pointer", fontSize: 12.5, padding: 0 }}>
          Ver todas ({itens.length}) →
        </button>
      )}
    </Card>
  );
}
