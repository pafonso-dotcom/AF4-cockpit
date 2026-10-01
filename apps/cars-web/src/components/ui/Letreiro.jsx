import React from "react";
import { T } from "../../lib/theme.js";

/**
 * Letreiro — uma linha rolando pela tela (estilo cotação de TV). Pedido de
 * 2026-10-01: usar no lugar de cards que só ocupam espaço.
 *
 * - `itens`: [{ chave, conteudo, onClick? }] — cada um vira um "bloco" da faixa.
 * - `fixo`: elemento opcional parado à direita (ex.: botão ✕).
 * - `segPorItem`: velocidade (segundos por item; mínimo 18s a volta).
 *
 * A lista vai duplicada e a faixa anda -50% em loop, então o fim emenda no
 * começo. Pausa só onde há mouse (no iPhone o :hover "gruda" após o toque);
 * não desliga com "reduzir movimento" (o letreiro é pedido explícito).
 */
export default function Letreiro({ itens = [], fixo = null, segPorItem = 5, style }) {
  if (!itens.length) return null;
  const dur = Math.max(18, itens.length * segPorItem);
  const bloco = (it, k) => (
    <span key={k + "-" + it.chave} onClick={it.onClick}
      style={{ display: "inline-flex", alignItems: "baseline", gap: 6, padding: "0 18px", whiteSpace: "nowrap",
               borderRight: `1px solid ${T.border}`, cursor: it.onClick ? "pointer" : "default" }}>
      {it.conteudo}
    </span>
  );
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0, ...style }}>
      <div className="letreiro" style={{ flex: 1, minWidth: 0, overflow: "hidden", position: "relative", padding: "10px 0",
        maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)",
        WebkitMaskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)" }}>
        <div className="letreiro-faixa" style={{ "--letreiro-dur": `${dur}s` }}>
          {[0, 1].map(k => <React.Fragment key={k}>{itens.map(it => bloco(it, k))}</React.Fragment>)}
        </div>
      </div>
      {fixo}
    </div>
  );
}

/** Pedaços prontos pra montar um item: rótulo pequeno, valor forte, variação. */
export const LetRotulo = ({ children, cor }) => (
  <span style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: cor || T.muted, fontWeight: 600 }}>{children}</span>
);
export const LetValor = ({ children, cor }) => (
  <span className="num" style={{ fontSize: 14, fontWeight: 700, color: cor || T.ink }}>{children}</span>
);
export const LetVar = ({ pct, casas = 2 }) => {
  const up = (pct ?? 0) >= 0;
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: up ? T.green : T.red }}>
      {up ? "▲" : "▼"} {up ? "+" : ""}{(pct ?? 0).toFixed(casas).replace(".", ",")}%
    </span>
  );
};
