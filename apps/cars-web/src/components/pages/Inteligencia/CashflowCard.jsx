import React from "react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { fmt } from "../../../lib/format.js";
import { T } from "../../../lib/theme.js";
import Card from "../../ui/Card.jsx";
import { Vazio } from "./ScoreCard.jsx";

export default function CashflowCard({ projecao = [], hidden }) {
  if (!projecao.length) {
    return <Card><Vazio texto="Sem histórico suficiente para projetar." /></Card>;
  }
  const data = projecao.map(p => ({ nome: (p.nome || "").split(" de ")[0], saldo: Math.round(p.saldo) }));
  return (
    <Card>
      <div style={{ width: "100%", height: 120, marginBottom: 8 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
            <XAxis dataKey="nome" tick={{ fontSize: 10, fill: T.muted }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => hidden ? "•••" : fmt(v)} />
            <Area type="monotone" dataKey="saldo" stroke={T.gold} fill={`${T.gold}33`} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {projecao.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ flex: 1, color: T.ink, textTransform: "capitalize" }}>{p.nome}</span>
            <span style={{ fontSize: 10.5, color: p.fluxo >= 0 ? T.green : T.red }}>
              {p.fluxo >= 0 ? "+" : ""}{hidden ? "•••" : fmt(p.fluxo)}
            </span>
            <span className="num" style={{ color: T.ink, fontWeight: 600, width: 90, textAlign: "right" }}>
              {hidden ? "•••" : fmt(p.saldo)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
