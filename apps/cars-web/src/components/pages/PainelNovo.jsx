import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell } from "recharts";
import { CreditCard, TrendingUp, ArrowUpRight } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, fmtAbrev, fmtN } from "../../lib/format.js";
import { montarFluxoCaixa } from "../../lib/fluxoCaixa.js";
import { faturaEmAberto, mesAtualKey } from "../../lib/cartaoFatura.js";
import Card from "../ui/Card.jsx";
import BankIcon from "../ui/BankIcon.jsx";
import { Sparkline } from "../ui/widget.jsx";

/* ============================================================
   Painel novo (2026-10-01): linha de números do dia, fluxo do mês,
   cartões, rosca de categorias e barras dos totais por ano.
   ============================================================ */

const titulo = { fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: T.ink };
const rotulo = { fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, fontWeight: 700 };

/** Quadradinho de número do dia (Pode gastar, A pagar, A receber, Cartões). */
export function KpiMini({ icone, label, valor, sub, cor = T.ink, spark, oculto, onClick, alerta, onDetalhes, detalhesTitulo }) {
  return (
    <Card onClick={onClick} style={{ minWidth: 0, cursor: onClick ? "pointer" : "default", padding: "14px 15px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 112, borderLeft: alerta ? `3px solid ${T.red}` : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span aria-hidden style={{ width: 30, height: 30, borderRadius: 10, display: "grid", placeItems: "center", background: `${cor}1c`, fontSize: 15, flexShrink: 0 }}>{icone}</span>
        <span style={{ fontSize: 12, color: T.muted, fontWeight: 600, lineHeight: 1.2, flex: 1, minWidth: 0 }}>{label}</span>
        {!oculto && spark && <span className="painel-kpi-spark" style={{ flexShrink: 0 }}><Sparkline points={spark} cor={cor} w={46} h={18} /></span>}
        {/* Botão de composição (igual ao do Patrimônio Total do Painel). */}
        {onDetalhes && (
          <button onClick={(e) => { e.stopPropagation(); onDetalhes(); }}
                  title={detalhesTitulo || "Ver o que está sendo somado"} aria-label={detalhesTitulo || "Composição"}
                  style={{ width: 28, height: 28, borderRadius: "50%", background: T.bgSoft, border: `1px solid ${T.border}`, flexShrink: 0,
                           display: "flex", alignItems: "center", justifyContent: "center", color: T.ink, cursor: "pointer", padding: 0, minHeight: 0 }}>
            <ArrowUpRight size={14} strokeWidth={2} />
          </button>
        )}
      </div>
      <div className="num painel-kpi-valor" style={{ fontSize: 24, fontWeight: 700, color: cor, letterSpacing: "-.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 10 }}>
        {oculto ? "•••" : valor}
      </div>
      {sub && <div className={alerta ? undefined : "painel-kpi-sub"} style={{ fontSize: 11.5, color: alerta ? T.red : T.faint, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{oculto ? "" : sub}</div>}
    </Card>
  );
}

const diaISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Fluxo do mês: saldo projetado dia a dia até o fim do mês (só o agendado). */
/** Números do fluxo do mês (saldo hoje → fim do mês, só o agendado). */
export function useFluxoMes(stateAgg, escopoAtivo) {
  return useMemo(() => {
    const hoje = new Date();
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const dias = Math.max(1, fimMes.getDate() - hoje.getDate());
    let f;
    try { f = montarFluxoCaixa(stateAgg, escopoAtivo, dias, hoje, { estimarVariaveis: false }); } catch { return null; }
    const porDia = new Map((f.porDia || []).map(d => [d.dataISO, d]));
    const serie = [];
    let saldo = f.saldoInicial, entradas = 0, saidas = 0, menor = { saldo: f.saldoInicial, dia: diaISO(hoje) };
    for (let d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()); d <= fimMes; d.setDate(d.getDate() + 1)) {
      const k = diaISO(d);
      const ev = porDia.get(k);
      if (ev) { saldo = ev.saldoFim; entradas += ev.entradas; saidas += ev.saidas; }
      if (saldo < menor.saldo) menor = { saldo, dia: k };
      serie.push({ dia: Number(k.slice(8, 10)), saldo: Math.round(saldo * 100) / 100 });
    }
    return { serie, inicial: f.saldoInicial, final: saldo, entradas, saidas, menor };
  }, [stateAgg, escopoAtivo]);
}

export function FluxoMesCard({ stateAgg, escopoAtivo, hidden, onVer, compacto = false }) {
  const dados = useFluxoMes(stateAgg, escopoAtivo);

  if (!dados) return null;
  const subiu = dados.final >= dados.inicial;
  const corLinha = dados.menor.saldo < 0 ? T.red : subiu ? T.green : T.gold;
  const mini = (l, v, c) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: T.muted }}>{l}</div>
      <div className="num" style={{ fontSize: 15, fontWeight: 700, color: c, whiteSpace: "nowrap" }}>{hidden ? "•••" : fmt(v)}</div>
    </div>
  );
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <TrendingUp size={16} style={{ color: T.gold }} />
          <span style={titulo}>Fluxo do mês</span>
        </div>
        {onVer && <button onClick={onVer} style={{ background: "transparent", border: "none", color: T.gold, fontSize: 11, cursor: "pointer" }}>Detalhes</button>}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 10 }}>Saldo das contas daqui até o fim do mês, só com o que está agendado</div>
      <div className="painel-fluxo-nums" style={{ display: "grid", gridTemplateColumns: compacto ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 10 }}>
        {mini("Hoje", dados.inicial, T.ink)}
        {mini("Entradas", dados.entradas, T.green)}
        {mini("Saídas", dados.saidas, T.red)}
        {mini("Fim do mês", dados.final, dados.final < 0 ? T.red : T.ink)}
      </div>
      <div style={{ height: compacto ? 110 : 150, marginLeft: -8 }}>
        {hidden ? (
          <div style={{ height: "100%", display: "grid", placeItems: "center", color: T.faint, fontSize: 12 }}>valores ocultos</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dados.serie} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fluxoGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={corLinha} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={corLinha} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: T.faint }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
              <YAxis hide domain={["auto", "auto"]} />
              {dados.menor.saldo < 0 && <ReferenceLine y={0} stroke={T.red} strokeDasharray="4 4" />}
              <Tooltip formatter={(v) => [fmt(v), "Saldo"]} labelFormatter={(d) => `Dia ${d}`}
                       contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12 }} />
              <Area type="stepAfter" dataKey="saldo" stroke={corLinha} strokeWidth={2.2} fill="url(#fluxoGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      {!hidden && (
        <div style={{ fontSize: 11.5, color: dados.menor.saldo < 0 ? T.red : T.muted, marginTop: 6 }}>
          {dados.menor.saldo < 0
            ? `⚠ Fica negativo dia ${Number(dados.menor.dia.slice(8, 10))} (${fmt(dados.menor.saldo)})`
            : `Menor saldo do mês: ${fmt(dados.menor.saldo)} no dia ${Number(dados.menor.dia.slice(8, 10))}`}
        </div>
      )}
    </Card>
  );
}

/** Cartões: fatura em aberto de cada um (mesma conta da tela Cartões). */
export function CartoesResumoCard({ cartoes = [], parcelamentos = [], transacoes = [], hidden, onVer }) {
  const itens = useMemo(() => {
    const mk = mesAtualKey();
    const hoje = new Date();
    return (cartoes || []).map(c => {
      const f = faturaEmAberto(c, parcelamentos, transacoes, mk);
      const venc = Number(c.vencimento);
      let faltam = null;
      if (venc >= 1 && venc <= 31) {
        let alvo = new Date(hoje.getFullYear(), hoje.getMonth(), venc);
        if (alvo < new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) alvo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, venc);
        faltam = Math.round((alvo - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 86400000);
      }
      return { c, valor: f.valor, paga: f.paga, faltam };
    }).sort((a, b) => b.valor - a.valor);
  }, [cartoes, parcelamentos, transacoes]);
  const max = Math.max(1, ...itens.map(i => i.valor));
  const total = itens.reduce((s, i) => s + i.valor, 0);
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CreditCard size={16} style={{ color: T.gold }} />
          <span style={titulo}>Cartões</span>
          <span className="num" style={{ fontSize: 12, color: T.muted }}>{hidden ? "•••" : fmt(total)}</span>
        </div>
        {onVer && <button onClick={onVer} style={{ background: "transparent", border: "none", color: T.gold, fontSize: 11, cursor: "pointer" }}>Ver todos</button>}
      </div>
      {itens.length === 0 ? (
        <div style={{ padding: 18, textAlign: "center", color: T.muted, fontSize: 12, fontStyle: "italic" }}>Nenhum cartão cadastrado.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {itens.slice(0, 5).map(({ c, valor, paga, faltam }) => (
            <div key={c.id} onClick={onVer} style={{ display: "flex", alignItems: "center", gap: 10, cursor: onVer ? "pointer" : "default" }}>
              <BankIcon c={c} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</span>
                  <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: valor > 0 ? T.ink : T.muted, whiteSpace: "nowrap" }}>{hidden ? "•••" : fmt(valor)}</span>
                </div>
                <div style={{ height: 5, borderRadius: 5, background: T.bgSoft, overflow: "hidden", margin: "4px 0 3px" }}>
                  <div style={{ width: `${(valor / max) * 100}%`, height: "100%", borderRadius: 5, background: faltam != null && faltam <= 3 && valor > 0 ? T.red : T.gold }} />
                </div>
                <div style={{ fontSize: 10.5, color: faltam != null && faltam <= 3 && valor > 0 ? T.red : T.faint }}>
                  {paga && !(valor > 0) ? "fatura paga" : valor > 0 ? (faltam === 0 ? "vence hoje" : faltam != null ? `vence em ${faltam} dia${faltam === 1 ? "" : "s"} (dia ${c.vencimento})` : "em aberto") : "sem fatura"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

const CORES_ROSCA = ["#4DD9C0", "#e0b45c", "#6f9bd1", "#d97a6c", "#9b8cd6", "#7fbf7f", "#c9a0a0"];

/** Gastos do mês por categoria: rosca + lista. */
export function GastosRoscaCard({ data = [], hidden }) {
  const top = data.slice(0, 6);
  const resto = data.slice(6).reduce((s, d) => s + d.valor, 0);
  const fatias = resto > 0 ? [...top, { nome: "Outras", valor: resto, pct: 0 }] : top;
  const total = data.reduce((s, d) => s + d.valor, 0);
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={titulo}>Gastos por categoria</span>
        <span style={{ fontSize: 11, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 12, padding: "3px 8px" }}>Este mês</span>
      </div>
      {data.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: T.muted, fontSize: 12, fontStyle: "italic" }}>Nenhuma despesa este mês.</div>
      ) : (
        <div className="painel-rosca" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 150, height: 150, position: "relative", flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={fatias} dataKey="valor" nameKey="nome" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none" isAnimationActive>
                  {fatias.map((_, i) => <Cell key={i} fill={CORES_ROSCA[i % CORES_ROSCA.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "none" }}>
              <div>
                <div style={{ fontSize: 10, color: T.muted }}>total</div>
                <div className="num" style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{hidden ? "•••" : fmtAbrev(total)}</div>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
            {fatias.map((d, i) => (
              <div key={d.nome} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: CORES_ROSCA[i % CORES_ROSCA.length], flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.nome}</span>
                <span style={{ color: T.faint, fontSize: 11 }}>{total > 0 ? fmtN((d.valor / total) * 100, 0) : 0}%</span>
                <span className="num" style={{ color: T.muted, whiteSpace: "nowrap", minWidth: 72, textAlign: "right" }}>{hidden ? "•••" : fmt(d.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/** Barras horizontais "a pagar por ano" (substitui a lista de anos). */
export function BarrasPorAno({ porAno = [], oculto }) {
  const max = Math.max(1, ...porAno.map(a => a.valor));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
      {porAno.map(a => (
        <div key={a.ano} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
          <span style={{ width: 54, color: T.faint, flexShrink: 0 }}>{a.ano}</span>
          <div style={{ flex: 1, height: 7, borderRadius: 7, background: T.bgSoft, overflow: "hidden" }}>
            <div style={{ width: `${(a.valor / max) * 100}%`, height: "100%", borderRadius: 7, background: `${T.red}cc` }} />
          </div>
          <span className="num" style={{ width: 92, textAlign: "right", color: T.muted, flexShrink: 0 }}>{oculto ? "•••" : fmt(a.valor)}</span>
        </div>
      ))}
    </div>
  );
}

