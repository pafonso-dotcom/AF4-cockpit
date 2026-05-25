import React, { useMemo, useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, Target, DollarSign, Calculator, Sparkles } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, fmtN } from "../../../lib/format.js";
import { parseValorBR } from "../../../lib/importExport.js";
import PageHeader from "../../ui/PageHeader.jsx";
import Field from "../../ui/Field.jsx";
import SugestaoAporte from "./SugestaoAporte.jsx";

const CLASS_LABEL = {
  acao: "Ações", fii: "FIIs", stock: "Stocks (US)", reit: "REITs (US)", etf: "ETFs",
  cripto: "Cripto", rf: "Renda Fixa", tesouro: "Tesouro", cdb: "CDB", outro: "Outros",
};

// Taxa mensal sugerida por classe (heurística — usuário pode ajustar)
const TAXA_SUGERIDA = {
  acao: 0.95, fii: 0.85, stock: 0.85, reit: 0.80, etf: 0.85,
  cripto: 1.50, rf: 0.80, tesouro: 0.75, cdb: 0.85, outro: 0.85,
};

export default function Projecao({ ativos = [], hidden, apiKeys = {}, alvoInicial, onConsumirAlvo }) {
  // Carteira com posição (qtd > 0)
  const ativosComPosicao = useMemo(
    () => (ativos || []).filter(a => Number(a.qtd || 0) > 0),
    [ativos]
  );

  const [ativoId, setAtivoId] = useState(alvoInicial?.id || ativosComPosicao[0]?.id || "manual");

  // Quando recebe alvo de fora (botão "Projetar" da Carteira), seleciona aquele ativo
  useEffect(() => {
    if (alvoInicial?.id) {
      setAtivoId(alvoInicial.id);
      onConsumirAlvo?.();
    }
  }, [alvoInicial?.id]);
  const isManual = ativoId === "manual";
  const ativo = useMemo(
    () => isManual ? null : (ativosComPosicao.find(a => a.id === ativoId) || ativosComPosicao[0]),
    [ativosComPosicao, ativoId, isManual]
  );

  const [aporteValor, setAporteValor] = useState("500");
  const [aporteModo, setAporteModo] = useState("mensal"); // "mensal" | "total"
  const [prazoAnos, setPrazoAnos] = useState(10);
  const [taxaMensal, setTaxaMensal] = useState("0.85");
  const [valorInicialManual, setValorInicialManual] = useState("10000");
  // Ativo futuro (Personalizado): nome + classe
  const [tickerManual, setTickerManual] = useState("");
  const [tipoManual, setTipoManual] = useState("fii");
  // Taxa CDB pra comparação (default ~0.90% a.m. = 100% CDI aproximado)
  const [taxaCdb, setTaxaCdb] = useState("0.90");

  // Modal de sugestão por IA
  const [sugestaoOpen, setSugestaoOpen] = useState(false);

  // Aplica uma opção sugerida pela IA aos campos da projeção
  const aplicarSugestao = ({ ticker, classe, valor }) => {
    // Procura o ativo na carteira pra usar dados reais (preço, qtd, pm)
    const naCarteira = ativosComPosicao.find(a =>
      (a.ticker || "").toUpperCase() === (ticker || "").toUpperCase()
    );
    if (naCarteira) {
      setAtivoId(naCarteira.id);
    } else {
      // Não tem na carteira → modo manual com ticker preenchido
      setAtivoId("manual");
      setTickerManual(String(ticker || "").toUpperCase());
      setTipoManual(classe || "acao");
      setValorInicialManual(String(Math.round(valor || 0)));
    }
  };

  // Atualiza valores sugeridos quando troca o ativo (ou classe no modo manual)
  useEffect(() => {
    if (ativo) {
      const sugerida = TAXA_SUGERIDA[ativo.tipo] ?? 0.85;
      setTaxaMensal(String(sugerida));
    }
  }, [ativo?.id]);

  useEffect(() => {
    if (isManual) {
      const sugerida = TAXA_SUGERIDA[tipoManual] ?? 0.85;
      setTaxaMensal(String(sugerida));
    }
  }, [tipoManual, isManual]);

  // Valores numéricos parseados (parseValorBR trata "1.500,50" e "1500.50")
  const valorInputado = parseValorBR(aporteValor);
  const taxa = parseValorBR(taxaMensal);
  const meses = prazoAnos * 12;

  // Se modo "total": divide o valor total pelos meses pra obter o aporte mensal equivalente
  const aporte = aporteModo === "total"
    ? (meses > 0 ? valorInputado / meses : 0)
    : valorInputado;

  // Valor inicial: da carteira ou manual
  const valorInicial = useMemo(() => {
    if (isManual) {
      return parseValorBR(valorInicialManual);
    }
    if (!ativo) return 0;
    return Number(ativo.qtd || 0) * Number(ativo.preco || 0);
  }, [ativo, isManual, valorInicialManual]);

  const custoAtual = useMemo(() => {
    if (isManual || !ativo) return 0;
    return Number(ativo.qtd || 0) * Number(ativo.pm ?? ativo.precoMedio ?? 0);
  }, [ativo, isManual]);

  const taxaCdbN = parseValorBR(taxaCdb);

  // Projeção mês a mês (ativo + CDB comparativo, mesmo aporte)
  const projecao = useMemo(() => {
    const out = [];
    const r = taxa / 100;
    const rCdb = taxaCdbN / 100;
    let acumulado = valorInicial;
    let cdb = valorInicial;
    let aportadoTotal = valorInicial;
    out.push({
      mes: 0, ano: 0,
      acumulado: round(acumulado),
      aportado: round(aportadoTotal),
      ganhos: 0,
      cdb: round(cdb),
    });
    for (let i = 1; i <= meses; i++) {
      acumulado = acumulado * (1 + r) + aporte;
      cdb = cdb * (1 + rCdb) + aporte;
      aportadoTotal += aporte;
      out.push({
        mes: i,
        ano: Math.floor(i / 12),
        acumulado: round(acumulado),
        aportado: round(aportadoTotal),
        ganhos: round(acumulado - aportadoTotal),
        cdb: round(cdb),
      });
    }
    return out;
  }, [valorInicial, aporte, taxa, taxaCdbN, meses]);

  const final = projecao[projecao.length - 1];
  const valorFinal = final?.acumulado || 0;
  const totalAportado = final?.aportado || 0;
  const totalGanhos = final?.ganhos || 0;

  // Cenário sem aporte (comparativo)
  const cenarioSemAporte = useMemo(() => {
    const r = taxa / 100;
    return valorInicial * Math.pow(1 + r, meses);
  }, [valorInicial, taxa, meses]);

  // Marcos: anos
  const marcos = useMemo(() => {
    const anos = [];
    for (let y = 1; y <= prazoAnos; y++) {
      if (prazoAnos > 5 && y % 5 !== 0 && y !== prazoAnos) continue;
      const p = projecao[y * 12];
      if (p) anos.push({ ano: y, acumulado: p.acumulado, aportado: p.aportado, ganhos: p.ganhos });
    }
    return anos;
  }, [projecao, prazoAnos]);

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Capítulo VIII"
        title="Projeção"
        sub="Simule a evolução de um ativo (da sua carteira ou personalizado) com aporte regular."
        action={
          <button className="btn-gold" onClick={() => setSugestaoOpen(true)}>
            <Sparkles size={13} className="inline mr-2" />
            Sugestão de Aporte (IA)
          </button>
        }
      />

      <SugestaoAporte
        open={sugestaoOpen}
        onClose={() => setSugestaoOpen(false)}
        ativosCarteira={ativos}
        apiKey={apiKeys.anthropic}
        onAplicarProjecao={aplicarSugestao}
      />

      {/* Form */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 18 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Ativo">
            <select value={ativoId} onChange={e => setAtivoId(e.target.value)}>
              <option value="manual">✏️ Ativo futuro / Personalizado</option>
              {ativosComPosicao.length > 0 && (
                <optgroup label="Da sua carteira">
                  {ativosComPosicao.map(a => {
                    const v = Number(a.qtd || 0) * Number(a.preco || 0);
                    return (
                      <option key={a.id} value={a.id}>
                        {a.ticker} · {CLASS_LABEL[a.tipo] || a.tipo} · {hidden ? "•••" : fmt(v)}
                      </option>
                    );
                  })}
                </optgroup>
              )}
            </select>
          </Field>
          {isManual ? (
            <Field label="Nome / Ticker do ativo futuro">
              <input type="text"
                     value={tickerManual}
                     onChange={e => setTickerManual(e.target.value)}
                     placeholder="Ex.: MXRF11, ITSA4, AAPL, BTC..."
                     autoCorrect="off" autoCapitalize="characters" spellCheck={false} />
            </Field>
          ) : (
            <Field label="Valor inicial (atual da carteira)">
              <input type="text" value={hidden ? "•••" : fmt(valorInicial)} disabled
                     style={{ background: T.bgSoft, color: T.ink, opacity: 0.8 }} />
            </Field>
          )}
          {isManual && (
            <>
              <Field label="Classe do ativo">
                <select value={tipoManual} onChange={e => setTipoManual(e.target.value)}>
                  <option value="acao">Ações</option>
                  <option value="fii">FIIs</option>
                  <option value="stock">Stocks (US)</option>
                  <option value="reit">REITs (US)</option>
                  <option value="etf">ETFs</option>
                  <option value="cripto">Cripto</option>
                  <option value="rf">Renda Fixa</option>
                  <option value="tesouro">Tesouro</option>
                  <option value="cdb">CDB</option>
                  <option value="outro">Outros</option>
                </select>
              </Field>
              <Field label="Valor inicial (R$)">
                <input type="text" inputMode="decimal"
                       value={valorInicialManual}
                       onChange={e => setValorInicialManual(e.target.value)}
                       placeholder="Ex.: 10000 (zero se vai começar do nada)" />
              </Field>
            </>
          )}
          <Field label="Prazo (anos)">
            <input type="number" min="1" max="40" value={prazoAnos}
                   onChange={e => setPrazoAnos(Math.max(1, Math.min(40, parseInt(e.target.value, 10) || 1)))} />
          </Field>
          <Field label={`Taxa esperada (% ao mês) — ${TAXA_SUGERIDA[isManual ? tipoManual : ativo?.tipo] ?? 0.85}% sugerido pra ${CLASS_LABEL[isManual ? tipoManual : ativo?.tipo] || (isManual ? tipoManual : ativo?.tipo)}`}>
            <input type="text" inputMode="decimal"
                   value={taxaMensal}
                   onChange={e => setTaxaMensal(e.target.value)}
                   placeholder="0.85" />
          </Field>
        </div>

        {/* Aporte: mensal ou total */}
        <div style={{ marginTop: 14 }}>
          <div className="label-eyebrow" style={{ marginBottom: 8 }}>
            Aporte adicional durante o prazo
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {[
              { id: "mensal", label: "Por mês" },
              { id: "total",  label: "Total no período" },
            ].map(m => {
              const ativoModo = aporteModo === m.id;
              return (
                <button key={m.id} onClick={() => setAporteModo(m.id)}
                  style={{
                    padding: "7px 14px",
                    background: ativoModo ? `${T.gold}22` : T.card,
                    border: `1px solid ${ativoModo ? T.gold : T.border}`,
                    color: ativoModo ? T.gold : T.muted,
                    fontSize: 11, fontWeight: 600, borderRadius: 100,
                    cursor: "pointer", letterSpacing: ".03em",
                  }}>
                  {m.label}
                </button>
              );
            })}
          </div>
          <input type="text" inputMode="decimal"
                 value={aporteValor}
                 onChange={e => setAporteValor(e.target.value)}
                 placeholder={aporteModo === "total" ? `Ex.: 60000 (em ${prazoAnos} ano${prazoAnos === 1 ? "" : "s"})` : "Ex.: 500"}
                 style={{ width: "100%" }} />
          {aporteModo === "total" && meses > 0 && valorInputado > 0 && (
            <div style={{ fontSize: 11, color: T.muted, marginTop: 6, fontStyle: "italic" }}>
              Equivale a <strong style={{ color: T.ink }}>{fmt(aporte)}/mês</strong> ao longo de {meses} meses
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3" style={{ marginBottom: 18 }}>
        <KpiCard
          label="Valor inicial"
          value={hidden ? "•••" : fmt(valorInicial)}
          sub={
            ativo ? `${ativo.qtd} cotas × ${fmt(Number(ativo.preco || 0))}`
              : isManual ? (tickerManual ? `${tickerManual.toUpperCase()} · ${CLASS_LABEL[tipoManual] || tipoManual}` : `Futuro · ${CLASS_LABEL[tipoManual] || tipoManual}`)
              : ""
          }
          icon={DollarSign}
          cor={T.gold}
        />
        <KpiCard
          label="Total a aportar"
          value={hidden ? "•••" : fmt(totalAportado - valorInicial)}
          sub={`${aporte > 0 ? fmt(aporte) + "/mês" : "—"} · ${meses} meses`}
          icon={Target}
          cor={T.blue || "#5b9bd5"}
        />
        <KpiCard
          label="Valor projetado"
          value={hidden ? "•••" : fmt(valorFinal)}
          sub={`em ${prazoAnos} ${prazoAnos === 1 ? "ano" : "anos"}`}
          icon={TrendingUp}
          cor={T.green}
        />
        <KpiCard
          label="Ganhos projetados"
          value={hidden ? "•••" : fmt(totalGanhos)}
          sub={`${fmtN(totalAportado > 0 ? (totalGanhos / totalAportado) * 100 : 0, 1)}% sobre aportado`}
          icon={Calculator}
          cor={T.green}
        />
      </div>

      {/* Gráfico */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 18 }}>
        <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 600, color: T.ink, marginBottom: 4 }}>
          Evolução em {prazoAnos} {prazoAnos === 1 ? "ano" : "anos"}
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>
          Aporte de {fmt(aporte)}/mês — Ativo a {fmtN(taxa, 2)}% a.m. · CDB a {fmtN(taxaCdbN, 2)}% a.m.
        </div>

        {/* Controle da taxa do CDB pra comparativo */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: T.muted, letterSpacing: ".08em", textTransform: "uppercase" }}>
            Taxa CDB (% a.m.) pra comparativo:
          </span>
          <input type="text" inputMode="decimal"
                 value={taxaCdb}
                 onChange={e => setTaxaCdb(e.target.value)}
                 style={{ width: 90, padding: "6px 10px", fontSize: 12, fontFamily: T.mono }} />
          <span style={{ fontSize: 10, color: T.faint, fontStyle: "italic" }}>
            (0.90% ≈ 100% CDI · 1.00% ≈ 110% CDI)
          </span>
        </div>

        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projecao}>
              <defs>
                <linearGradient id="grad-acumulado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.green} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={T.green} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-aportado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.gold} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={T.gold} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-cdb" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.blue || "#5b9bd5"} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={T.blue || "#5b9bd5"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={T.border} strokeDasharray="3 3" />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 10, fill: T.muted }}
                tickFormatter={(m) => m % 12 === 0 ? `${m / 12}a` : ""}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 10, fill: T.muted }}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                width={55}
              />
              <Tooltip
                contentStyle={{ background: T.card, border: `1px solid ${T.border}`, fontSize: 11 }}
                formatter={(v, name) => [fmt(v),
                  name === "acumulado" ? "Ativo" :
                  name === "aportado" ? "Aportado" :
                  name === "cdb" ? "CDB" : name
                ]}
                labelFormatter={(m) => `Mês ${m} (${Math.floor(m / 12)}a ${m % 12}m)`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) =>
                v === "acumulado" ? "Ativo escolhido" :
                v === "aportado" ? "Aportado" :
                v === "cdb" ? `CDB (${fmtN(taxaCdbN, 2)}% a.m.)` : v
              } />
              <Area type="monotone" dataKey="aportado" stroke={T.gold} fill="url(#grad-aportado)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="cdb" stroke={T.blue || "#5b9bd5"} fill="url(#grad-cdb)" strokeWidth={2} strokeDasharray="6 3" />
              <Area type="monotone" dataKey="acumulado" stroke={T.green} fill="url(#grad-acumulado)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Marcos por ano */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 18 }}>
        <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 600, color: T.ink, marginBottom: 14 }}>
          Marcos no caminho
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 360 }}>
            <thead>
              <tr style={{ color: T.muted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 10 }}>
                <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: `1px solid ${T.border}` }}>Ano</th>
                <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: `1px solid ${T.border}` }}>Acumulado</th>
                <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: `1px solid ${T.border}` }}>Aportado</th>
                <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: `1px solid ${T.border}` }}>Ganhos</th>
              </tr>
            </thead>
            <tbody>
              {marcos.map(m => (
                <tr key={m.ano}>
                  <td style={{ padding: "8px 6px", color: T.ink, fontWeight: 500 }}>Ano {m.ano}</td>
                  <td className="num" style={{ padding: "8px 6px", textAlign: "right", color: T.green, fontWeight: 600 }}>
                    {hidden ? "•••" : fmt(m.acumulado)}
                  </td>
                  <td className="num" style={{ padding: "8px 6px", textAlign: "right", color: T.muted }}>
                    {hidden ? "•••" : fmt(m.aportado)}
                  </td>
                  <td className="num" style={{ padding: "8px 6px", textAlign: "right", color: T.gold, fontWeight: 600 }}>
                    {hidden ? "•••" : fmt(m.ganhos)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparativos */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: 12 }}>
          Comparativos
        </div>

        {/* Ativo vs CDB */}
        {(() => {
          const cdbFinal = projecao[projecao.length - 1]?.cdb || 0;
          const diff = valorFinal - cdbFinal;
          const melhor = diff >= 0;
          return (
            <div style={{
              padding: 12, marginBottom: 10, borderRadius: 8,
              background: melhor ? `${T.green}10` : `${T.red}10`,
              border: `1px solid ${melhor ? T.green : T.red}33`,
            }}>
              <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6 }}>
                <strong style={{ color: T.ink }}>Ativo vs CDB</strong> · em {prazoAnos} {prazoAnos === 1 ? "ano" : "anos"}:<br />
                Ativo escolhido: <strong style={{ color: T.green }}>{fmt(valorFinal)}</strong> ·
                CDB ({fmtN(taxaCdbN, 2)}% a.m.): <strong style={{ color: T.blue || "#5b9bd5" }}>{fmt(cdbFinal)}</strong><br />
                <span style={{ color: melhor ? T.green : T.red, fontWeight: 600 }}>
                  {melhor ? "▲" : "▼"} {fmt(Math.abs(diff))} {melhor ? "a mais" : "a menos"} no ativo
                </span>
              </div>
            </div>
          );
        })()}

        {/* Sem aporte */}
        <div style={{ padding: 12, borderRadius: 8, background: T.bgSoft, border: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6 }}>
            <strong style={{ color: T.ink }}>E se você não aportasse?</strong><br />
            Mantendo só {fmt(valorInicial)} na mesma taxa do ativo, em {prazoAnos} {prazoAnos === 1 ? "ano" : "anos"} você teria <strong style={{ color: T.ink }}>{fmt(cenarioSemAporte)}</strong>.
            Com {fmt(aporte)}/mês você chega a <strong style={{ color: T.green }}>{fmt(valorFinal)}</strong> —
            diferença de <strong style={{ color: T.gold }}>{fmt(valorFinal - cenarioSemAporte)}</strong>.
          </div>
        </div>

        {custoAtual > 0 && (
          <div style={{ fontSize: 11, color: T.faint, fontStyle: "italic", marginTop: 12 }}>
            Seu custo médio atual: {fmt(custoAtual)} · Posição atual: {fmt(valorInicial)} ·
            Resultado atual: {fmt(valorInicial - custoAtual)} ({fmtN(custoAtual > 0 ? ((valorInicial - custoAtual) / custoAtual) * 100 : 0, 1)}%)
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, cor }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>
          {label}
        </div>
        {Icon && (
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: `${cor}22`, color: cor, display: "grid", placeItems: "center" }}>
            <Icon size={12} />
          </div>
        )}
      </div>
      <div className="num" style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 600, color: T.ink, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

function round(n) {
  return Math.round(n * 100) / 100;
}
