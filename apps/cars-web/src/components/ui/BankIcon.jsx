import React, { useState } from "react";
import { T } from "../../lib/theme.js";

// Domínio do banco a partir do nome/instituição/appUrl → favicon usado como "logo".
export function dominioBanco(c) {
  if (c?.appUrl) { try { return new URL(c.appUrl).hostname.replace(/^www\./, ""); } catch {} }
  const s = `${c?.nome || ""} ${c?.instituicao || ""}`.toLowerCase();
  const mapa = [
    [/nubank|\bnu\b/, "nubank.com.br"],
    [/ita[uú]/, "itau.com.br"],
    [/santander/, "santander.com.br"],
    [/bradesco/, "bradesco.com.br"],
    [/banco do brasil|\bbb\b/, "bb.com.br"],
    [/caixa/, "caixa.gov.br"],
    [/\binter\b/, "bancointer.com.br"],
    [/\bc6\b/, "c6bank.com.br"],
    [/\bxp\b/, "xpi.com.br"],
    [/picpay/, "picpay.com"],
    [/mercado ?pago|mercado ?livre|\bmeli\b/, "mercadopago.com.br"],
    [/sicoob/, "sicoob.com.br"],
    [/sicredi/, "sicredi.com.br"],
    [/safra/, "safra.com.br"],
    [/\bpan\b/, "bancopan.com.br"],
    [/\boriginal\b/, "original.com.br"],
    [/\bbtg\b/, "btgpactual.com"],
    [/\bwise\b/, "wise.com"],
    [/\bpaypal\b/, "paypal.com"],
    [/\bneon\b/, "neon.com.br"],
    [/\bwill\b/, "willbank.com.br"],
    [/\bdigio\b/, "digio.com.br"],
  ];
  for (const [re, dom] of mapa) if (re.test(s)) return dom;
  return null;
}

export function iniciaisDe(nome) {
  const p = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!p.length) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/**
 * Ícone do banco. Prioridade:
 *   1) logo próprio da conta (c.logo — URL ou dataURL definido pelo usuário)
 *   2) favicon do banco (domínio inferido pelo nome/instituição/appUrl)
 *   3) iniciais sobre a cor da conta (fallback)
 * `size` controla o lado em px (default 40).
 */
export default function BankIcon({ c, size = 40 }) {
  const [erroLogo, setErroLogo] = useState(false);
  const [erroFav, setErroFav] = useState(false);
  const r = Math.max(8, Math.round(size * 0.3));
  const box = { width: size, height: size, borderRadius: r, flexShrink: 0, boxShadow: "0 2px 8px rgba(0,0,0,.25)" };
  const pad = Math.max(3, Math.round(size * 0.12));

  if (c?.logo && !erroLogo) {
    return (
      <img src={c.logo} alt="" aria-hidden="true" onError={() => setErroLogo(true)}
           loading="lazy" referrerPolicy="no-referrer"
           style={{ ...box, objectFit: "contain", background: "#fff", padding: pad }} />
    );
  }
  const dom = dominioBanco(c);
  if (dom && !erroFav) {
    return (
      <img src={`https://www.google.com/s2/favicons?domain=${dom}&sz=64`} alt="" aria-hidden="true"
           onError={() => setErroFav(true)} loading="lazy" referrerPolicy="no-referrer"
           style={{ ...box, objectFit: "contain", background: "#fff", padding: pad }} />
    );
  }
  return (
    <div aria-hidden="true" style={{ ...box, background: c?.cor || T.gold, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: Math.round(size * 0.35) }}>
      {iniciaisDe(c?.nome)}
    </div>
  );
}
