// Tabela/lista de compromissos (A Receber ou A Pagar) com agrupamento por
// nome. (Movida de AReceberEDividas.jsx na fatia de 2026-09-21 — idêntica.)
import React, { useState, useMemo } from "react";
import { ChevronDown, Layers } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import CompromissoCard from "./CompromissoCard.jsx";
import { corDoNome } from "./corDoNome.js";

export default function CompromissoTabela({
  titulo, icone, tipo, itens, corAccent,
  onBaixa, onEditar, onExcluir, onWhats,
  dueLabel, hidden, mesLabelTitulo, showCredor,
}) {
  const isReceber = tipo === "receber";
  const total = itens.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
  const labelAcao = isReceber ? "Receber" : "Pagar";

  // Agrupar pelo nome — junta as ocorrências do mesmo compromisso (ex.: a fixa
  // "Condomínio" de todos os meses) num grupo recolhível: mais fácil de achar
  // e alterar. Persistido; nomes iguais a menos de caixa/espaços contam juntos.
  // Os grupos ABERTOS também são persistidos: alterar/pagar um item re-renderiza
  // (ou remonta) a tela, e sem isso ela "voltava" com tudo fechado.
  const KEY_ABERTOS = `af4:controle:agrupar-abertos:${tipo}:v1`;
  const [agrupar, setAgrupar] = useState(() => {
    try { return localStorage.getItem("af4:controle:agrupar-nome:v1") === "1"; } catch { return false; }
  });
  const toggleAgrupar = () => {
    const nv = !agrupar;
    try { localStorage.setItem("af4:controle:agrupar-nome:v1", nv ? "1" : "0"); } catch {}
    setAgrupar(nv);
  };
  const [abertos, setAbertos] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(KEY_ABERTOS) || "[]")); } catch { return new Set(); }
  });
  const toggleGrupo = (k) => setAbertos(prev => {
    const n = new Set(prev);
    n.has(k) ? n.delete(k) : n.add(k);
    try { localStorage.setItem(KEY_ABERTOS, JSON.stringify([...n])); } catch {}
    return n;
  });
  // Grupos na ordem do primeiro item (a lista já vem ordenada por vencimento).
  const grupos = useMemo(() => {
    if (!agrupar) return null;
    const map = new Map();
    itens.forEach(item => {
      const k = String(item.nome || "?").trim().toLowerCase();
      if (!map.has(k)) map.set(k, { nome: item.nome || "?", itens: [] });
      map.get(k).itens.push(item);
    });
    return [...map.entries()].map(([k, g]) => ({
      key: k, nome: g.nome, itens: g.itens,
      total: g.itens.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0),
    }));
  }, [agrupar, itens]);

  const renderCard = (item) => (
    <CompromissoCard key={item.id} item={item} hidden={hidden} dueLabel={dueLabel}
      corAccent={corAccent} isReceber={isReceber} labelAcao={labelAcao} showCredor={showCredor}
      onBaixa={() => onBaixa(item)} onWhats={() => onWhats(item)}
      onEditar={() => onEditar(item)} onExcluir={() => onExcluir(item)} />
  );

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{
        padding: "10px 14px", borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontSize: 14, color: T.ink, fontWeight: 600, letterSpacing: ".02em" }}>
            {icone} {titulo}
            {mesLabelTitulo && (
              <span style={{ color: T.muted, fontWeight: 400, fontSize: 12, marginLeft: 6 }}>
                · {mesLabelTitulo}
              </span>
            )}
            <span style={{ color: T.muted, fontWeight: 400, marginLeft: 8, fontSize: 11.5 }}>
              ({itens.length} {itens.length === 1 ? "item" : "itens"})
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={toggleAgrupar}
            title="Juntar as ocorrências do mesmo nome (ex.: a mesma conta fixa de vários meses)"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
              padding: "4px 10px", borderRadius: 12, fontSize: 11.5, fontWeight: 600,
              background: agrupar ? `${T.gold}22` : T.bgSoft,
              color: agrupar ? T.gold : T.muted,
              border: `1px solid ${agrupar ? T.gold : T.border}`,
            }}>
            <Layers size={12} /> Agrupar por nome
          </button>
          <div className="num" style={{
            color: corAccent, fontSize: 16, fontWeight: 600,
            fontFamily: T.serif, letterSpacing: "-.01em",
          }}>
            {hidden ? "•••" : fmt(total)}
          </div>
        </div>
      </div>

      {itens.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 12.5 }}>
          Nada por aqui neste mês.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12 }}>
          {!grupos && itens.map(renderCard)}
          {grupos && grupos.map(g => {
            // Nome único → card normal, sem cabeçalho de grupo.
            if (g.itens.length === 1) return renderCard(g.itens[0]);
            const on = abertos.has(g.key);
            const cor = corDoNome(g.nome);
            const prim = g.itens[0];
            const vencPrim = typeof prim.vencimento === "string" ? prim.vencimento : "";
            return (
              <div key={g.key} style={{ border: `1px solid ${on ? cor : T.border}`, borderLeft: `4px solid ${cor}`, borderRadius: 16, overflow: "hidden" }}>
                <button onClick={() => toggleGrupo(g.key)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px", background: on ? T.bgSoft : "transparent",
                    border: "none", cursor: "pointer", textAlign: "left", color: T.ink,
                  }}>
                  <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.nome}</span>
                  <span style={{ fontSize: 10.5, color: T.muted, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 100, padding: "1px 8px", flexShrink: 0 }}>
                    {g.itens.length}×
                  </span>
                  {vencPrim && (
                    <span style={{ fontSize: 10.5, color: T.muted, flexShrink: 0 }}>
                      próx.: {vencPrim.slice(8, 10)}/{vencPrim.slice(5, 7)}
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span className="num" style={{ color: corAccent, fontFamily: T.serif, fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {hidden ? "•••" : fmt(g.total)}
                  </span>
                  <ChevronDown size={15} style={{ color: on ? T.gold : T.muted, transform: on ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }} />
                </button>
                {on && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "4px 8px 8px" }}>
                    {g.itens.map(renderCard)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
