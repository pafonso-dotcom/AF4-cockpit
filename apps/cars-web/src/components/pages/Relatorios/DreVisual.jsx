/**
 * DRE visual — resultado do mês em CASCATA + tabela clássica com comparativo.
 * Aprovado por mockup em 2026-09-24. Recebe as saídas puras de montarDRE
 * (lib/dre.js) do mês e do anterior; sem estado global.
 *
 * Cores validadas pra daltonismo (script do design system): verde entrada,
 * laranja saída, cinza totais — reforço com sinais +/− nos rótulos.
 */
import React, { useState } from "react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";

const UP = "#00795e", DOWN = "#e0592a", TOT = "#5b6472";
const H = 210; // altura útil do plot (px)

export default function DreVisual({ dre, dreAnt, hidden }) {
  const [aberta, setAberta] = useState(null); // linha da tabela expandida
  const m = (v) => (hidden ? "•••" : fmt(v));
  const n = (v) => (hidden ? "•••" : (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 }));

  // ---- cascata: passos com acumulado antes/depois ----
  const passos = [];
  let cum = 0;
  const delta = (nome, valor, tipo) => { passos.push({ nome, tipo, de: cum, para: cum + valor }); cum += valor; };
  delta("Receitas", dre.receitas, "up");
  delta("Fixas", -dre.fixas, "down");
  delta("Variáveis", -dre.variaveis, "down");
  delta("Cartões", -dre.cartoes, "down");
  passos.push({ nome: "Sobra oper.", tipo: "total", de: 0, para: dre.sobraOperacional, marco: true });
  cum = dre.sobraOperacional;
  delta("Proventos", dre.proventos, "up");
  passos.push({ nome: "Resultado", tipo: "total", de: 0, para: dre.resultado, marco: true, final: true });

  const vals = passos.flatMap(p => [p.de, p.para]);
  const topo = Math.max(...vals, 1), piso = Math.min(...vals, 0);
  const y = (v) => ((v - piso) / (topo - piso)) * H;

  const deltaCol = (atual, anterior) => {
    if (!dreAnt || hidden) return null;
    const d = (Number(atual) || 0) - (Number(anterior) || 0);
    if (Math.abs(d) < 0.5) return <span style={{ color: T.faint }}>= 0</span>;
    return <span style={{ color: T.faint }}>{d > 0 ? "▲" : "▼"} {n(Math.abs(d))}</span>;
  };

  const linhas = [
    { chave: "receitas", sinal: "", rotulo: "Receitas do mês", valor: dre.receitas, ant: dreAnt?.receitas, cor: UP },
    { chave: "fixas", sinal: "(−)", rotulo: "Despesas fixas", valor: dre.fixas, ant: dreAnt?.fixas },
    { chave: "variaveis", sinal: "(−)", rotulo: "Despesas variáveis", valor: dre.variaveis, ant: dreAnt?.variaveis },
    { chave: "cartoes", sinal: "(−)", rotulo: "Cartões (faturas e compras)", valor: dre.cartoes, ant: dreAnt?.cartoes },
    { chave: null, sinal: "(=)", rotulo: "Sobra operacional", valor: dre.sobraOperacional, ant: dreAnt?.sobraOperacional, sub: true },
    { chave: "proventos", sinal: "(+)", rotulo: "Proventos de investimentos", valor: dre.proventos, ant: dreAnt?.proventos, cor: UP },
    { chave: null, sinal: "(=)", rotulo: "Resultado do mês", valor: dre.resultado, ant: dreAnt?.resultado, sub: true, cor: dre.resultado >= 0 ? UP : DOWN },
  ];

  const dResultado = (Number(dre.resultado) || 0) - (Number(dreAnt?.resultado) || 0);

  return (
    <div>
      {/* herói */}
      <div style={{ margin: "12px 0 4px" }}>
        <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>Resultado do mês</div>
        <div style={{ fontSize: 30, fontWeight: 800, color: dre.resultado >= 0 ? T.ink : DOWN }}>{m(dre.resultado)}</div>
        {dreAnt && !hidden && (
          <div style={{ fontSize: 12.5, fontWeight: 700, color: dResultado >= 0 ? UP : DOWN }}>
            {dResultado >= 0 ? "▲" : "▼"} {fmt(Math.abs(dResultado))} vs mês anterior
          </div>
        )}
      </div>

      {/* cascata */}
      <div style={{ position: "relative", height: H + 26, display: "flex", alignItems: "flex-end", gap: 2, marginTop: 14 }}>
        {passos.map((p, i) => {
          const a = y(p.de), b = y(p.para);
          const base = Math.min(a, b), alt = Math.max(Math.abs(a - b), 3);
          const sobe = p.para >= p.de;
          const cor = p.tipo === "up" ? UP : p.tipo === "down" ? DOWN : p.final ? T.ink : TOT;
          const raio = sobe ? "4px 4px 0 0" : "0 0 4px 4px";
          const rotuloV = p.tipo === "down" ? `−${n(Math.abs(p.para - p.de))}`
            : p.tipo === "up" && i > 0 ? `+${n(p.para - p.de)}`
            : n(p.para);
          return (
            <div key={p.nome} style={{ flex: 1, position: "relative", height: "100%", minWidth: 0 }}>
              {i > 0 && (
                <div style={{ position: "absolute", bottom: y(p.de) + 26, left: "-50%", width: "100%", height: 1, background: T.border }} />
              )}
              <div title={`${p.nome}: ${m(Math.abs(p.para - p.de))}`}
                   style={{ position: "absolute", bottom: base + 26, left: "50%", transform: "translateX(-50%)",
                            width: 22, maxWidth: "70%", height: alt, background: cor, borderRadius: raio }} />
              <div className="num" style={{ position: "absolute", bottom: Math.max(a, b) + 32, left: "50%", transform: "translateX(-50%)",
                            fontSize: 10, fontWeight: p.final ? 800 : 700, color: p.tipo === "down" ? T.muted : T.ink, whiteSpace: "nowrap" }}>
                {rotuloV}
              </div>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, textAlign: "center",
                            fontSize: 9.5, color: T.muted, lineHeight: 1.1, borderTop: `1px solid ${T.border}`, paddingTop: 5 }}>
                {p.nome}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 11.5, color: T.muted }}>
        {[["Entradas", UP], ["Saídas", DOWN], ["Totais", TOT]].map(([r, c]) => (
          <span key={r}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: c, marginRight: 5, verticalAlign: -1 }} />{r}</span>
        ))}
      </div>

      {/* tabela DRE (toque na linha = maiores itens do grupo) */}
      <div style={{ marginTop: 16 }}>
        {linhas.map((l, i) => (
          <div key={i}>
            <div onClick={() => l.chave && setAberta(aberta === l.chave ? null : l.chave)}
                 style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "8px 2px",
                          borderTop: l.sub ? `2px solid ${T.border}` : "none",
                          borderBottom: l.sub ? "none" : `1px solid ${T.bgSoft}`,
                          cursor: l.chave ? "pointer" : "default", fontSize: 13 }}>
              <span style={{ width: 24, color: T.faint, flexShrink: 0 }}>{l.sinal}</span>
              <span style={{ flex: 1, fontWeight: l.sub ? 800 : 500, color: T.ink }}>
                {l.rotulo}{l.chave ? <span style={{ color: T.faint, fontSize: 10 }}> {aberta === l.chave ? "▾" : "▸"}</span> : null}
              </span>
              <span className="num" style={{ fontWeight: l.sub ? 800 : 600, color: l.cor || T.ink }}>{m(l.valor)}</span>
              <span className="num" style={{ width: 70, textAlign: "right", fontSize: 11 }}>{deltaCol(l.valor, l.ant)}</span>
            </div>
            {l.chave && aberta === l.chave && (
              <div style={{ padding: "4px 2px 8px 34px", display: "flex", flexDirection: "column", gap: 3 }}>
                {(dre.detalhe?.[l.chave] || []).map((it, j) => (
                  <div key={j} style={{ display: "flex", gap: 8, fontSize: 11.5, color: T.muted }}>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.descricao}</span>
                    <span className="num">{m(it.valor)}</span>
                  </div>
                ))}
                {!(dre.detalhe?.[l.chave] || []).length && (
                  <div style={{ fontSize: 11.5, color: T.faint }}>Nada neste grupo no mês.</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
