import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { T } from "../../lib/theme.js";
import { fmt } from "../../lib/format.js";

/**
 * Pie chart de alocação. Substitui copies inline em InvestPainel e
 * CarteiraSaude.
 *
 * Props:
 * - data: array de { nome, valor, pct, cor }
 * - hidden (bool): mascara valores em R$
 * - innerRadius / outerRadius: customizáveis (default 32 / 56)
 * - height: altura do container (default 120)
 */
export default function AlocacaoPieChart({
  data, hidden,
  innerRadius = 32, outerRadius = 56, height = 120,
}) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="valor"
            nameKey="nome"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={2}
          >
            {(data || []).map((p, i) => (
              <Cell key={i} fill={p.cor} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: T.card, border: `1px solid ${T.border}`, fontSize: 11 }}
            formatter={(v, _n, ctx) => [
              hidden ? "•••••" : fmt(v),
              `${ctx.payload.nome} (${ctx.payload.pct.toFixed(1)}%)`,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
