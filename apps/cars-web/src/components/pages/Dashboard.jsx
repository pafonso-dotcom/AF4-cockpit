import React, { useMemo, useState } from "react";
import { Wallet, Briefcase, ArrowUpRight, ArrowDownRight, Sparkles, Activity, TrendingUp, AlertTriangle, CheckCircle2, Info, Lightbulb } from "lucide-react";
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { T } from "../../lib/theme.js";
import { fmt, fmtN } from "../../lib/format.js";
import { calcularScore, projetarCashflow, gerarInsights, detectarAssinaturas } from "../../lib/intelligence.js";
import { calcMoMTransacoes } from "../../lib/mom.js";
import { filtrarPorEscopo } from "../../lib/escopo.js";
import { lerCardsConfig } from "../../lib/dashboardConfig.js";
import StatCard from "../ui/StatCard.jsx";
import DashboardWidgets from "./DashboardWidgets.jsx";

export default function Dashboard({
  totais: totaisRaw, hidden, contas: contasRaw, ativos, transacoes: transacoesRaw,
  categorias, metas, cartoes = [], parcelamentos = [], devedores = [], dividas = [],
  escopoAtivo = "tudo",
}) {
  const mask = (v) => hidden ? "•••••" : v;

  // Config de cards do Painel (liga/desliga em Configurações → Aparência)
  const [cardsCfg] = useState(lerCardsConfig());
  const mostra = (id) => cardsCfg[id] !== false;

  // Aplica escopo: filtra contas e, por consequência, transações
  const contas = useMemo(
    () => filtrarPorEscopo(contasRaw || [], escopoAtivo),
    [contasRaw, escopoAtivo]
  );
  const transacoes = useMemo(() => {
    if (escopoAtivo === "tudo") return transacoesRaw || [];
    const nomes = new Set(contas.map(c => c.nome));
    return (transacoesRaw || []).filter(t => nomes.has(t.conta));
  }, [transacoesRaw, contas, escopoAtivo]);

  // Recalcula totais respeitando o escopo (carteira de investimentos não tem escopo)
  const totais = useMemo(() => {
    if (escopoAtivo === "tudo") return totaisRaw;
    const receitas = transacoes.filter(t => t.tipo === "receita").reduce((s, t) => s + Number(t.valor || 0), 0);
    const despesas = transacoes.filter(t => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor || 0), 0);
    const saldoContas = contas.reduce((s, c) => s + Number(c.saldo || 0), 0);
    const carteira = totaisRaw?.carteira || 0;
    return {
      ...totaisRaw,
      receitas, despesas, saldoContas,
      patrimonio: saldoContas + carteira,
      fluxo: receitas - despesas,
    };
  }, [totaisRaw, transacoes, contas, escopoAtivo]);

  // ============ INTELIGÊNCIA FINANCEIRA ============
  const score = useMemo(
    () => calcularScore(transacoes, contas, ativos, cartoes, parcelamentos, metas),
    [transacoes, contas, ativos, cartoes, parcelamentos, metas]
  );
  const cashflow = useMemo(
    () => projetarCashflow(transacoes, contas, 3),
    [transacoes, contas]
  );
  const insights = useMemo(
    () => gerarInsights(transacoes, contas, ativos, cartoes, parcelamentos),
    [transacoes, contas, ativos, cartoes, parcelamentos]
  );
  const assinaturas = useMemo(
    () => detectarAssinaturas(transacoes),
    [transacoes]
  );

  // Despesas por categoria
  const despesasCat = useMemo(() => {
    const m = {};
    transacoes.filter(t => t.tipo === "despesa").forEach(t => {
      m[t.categoria] = (m[t.categoria] || 0) + Number(t.valor || 0);
    });
    return Object.entries(m).map(([nome, valor]) => {
      const c = categorias.find(c => c.nome === nome);
      return { nome, valor, cor: c?.cor || T.gold };
    }).sort((a, b) => b.valor - a.valor);
  }, [transacoes, categorias]);

  // Receita vs Despesa — últimos 6 meses (relatório opcional)
  const seisMesesRD = useMemo(() => {
    const hoje = new Date();
    const out = [];
    const MES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const tx = transacoes.filter(t => (t.data || "").startsWith(key));
      const rec = tx.filter(t => t.tipo === "receita").reduce((s, t) => s + Number(t.valor || 0), 0);
      const desp = tx.filter(t => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor || 0), 0);
      out.push({ mes: MES[d.getMonth()], receita: rec, despesa: desp });
    }
    return out;
  }, [transacoes]);

  // Saldo previsto fim do mês = saldo atual + receitas pendentes - despesas pendentes (do mês corrente)
  const saldoPrevisto = useMemo(() => {
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;
    let pReceita = 0, pDespesa = 0;
    transacoes.forEach(t => {
      if (t.compensado || !t.data) return;
      const [y, m] = t.data.split("-").map(Number);
      if (y === curY && m === curM) {
        if (t.tipo === "receita") pReceita += Number(t.valor || 0);
        else pDespesa += Number(t.valor || 0);
      }
    });
    return {
      atual: totais.saldoContas,
      pReceita, pDespesa,
      previsto: totais.saldoContas + pReceita - pDespesa,
    };
  }, [transacoes, totais.saldoContas]);

  // Histórico patrimonial (simulado)
  const historico = useMemo(() => {
    const out = [];
    const final = totais.patrimonio;
    let p = final * 0.78;
    for (let i = 11; i >= 0; i--) {
      p = p * (1 + (Math.random() * 0.04 + 0.005));
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      out.push({ mes: d.toLocaleDateString("pt-BR", { month: "short" }), valor: +p.toFixed(2) });
    }
    out[out.length - 1].valor = final;
    return out;
  }, [totais.patrimonio]);

  // Composição por classe
  const composicao = useMemo(() => {
    const liquido = contas.reduce((s, c) => s + Number(c.saldo || 0), 0);
    const por = { acao: 0, fii: 0, cripto: 0, tesouro: 0, cdb: 0 };
    ativos.forEach(a => { por[a.tipo] = (por[a.tipo] || 0) + a.qtd * a.preco; });
    const arr = [
      { nome: "Líquido",   valor: liquido,    cor: T.gold },
      { nome: "Ações",     valor: por.acao,   cor: T.green },
      { nome: "FIIs",      valor: por.fii,    cor: T.blue },
      { nome: "Cripto",    valor: por.cripto, cor: T.goldHi },
      { nome: "Tesouro",   valor: por.tesouro,cor: "#9a8fb3" },
      { nome: "CDB",       valor: por.cdb,    cor: T.red },
    ].filter(x => x.valor > 0);
    return arr;
  }, [contas, ativos]);

  return (
    <div className="fade-up">
      {/* Stat cards */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-px mb-4" style={{ background: T.border }}>
        <StatCard label="Saldo em Contas" value={mask(fmt(totais.saldoContas))} accent={T.gold} icon={Wallet}
                  tooltip="Soma dos saldos atuais de todas as contas correntes, poupanças e carteiras cadastradas." />
        <StatCard label="Receitas" value={mask(fmt(totais.receitas))} accent={T.green} icon={ArrowUpRight}
                  variation={calcMoMTransacoes(transacoes, { tipo: "receita", compensadoOnly: true })}
                  tooltip="Soma das receitas compensadas do mês corrente. Comparativo automático com o mês anterior." />
        <StatCard label="Despesas" value={mask(fmt(totais.despesas))} accent={T.red} icon={ArrowDownRight}
                  variation={calcMoMTransacoes(transacoes, { tipo: "despesa", compensadoOnly: true })}
                  sub={`Saldo: ${mask(fmt(totais.fluxo))}`}
                  tooltip="Soma das despesas compensadas do mês corrente. Subir vs mês anterior = vermelho (ruim)." />
      </section>

      {/* Saldo previsto fim do mês */}
      {mostra("saldo-previsto") && (saldoPrevisto.pReceita > 0 || saldoPrevisto.pDespesa > 0) && (
        <section className="mb-5" style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14 }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="label-eyebrow">Saldo Previsto · fim do mês</div>
              <div className="num mt-1" style={{
                fontFamily: T.serif, fontSize: 22,
                color: saldoPrevisto.previsto >= 0 ? T.gold : T.red,
              }}>
                {hidden ? "•••••" : fmt(saldoPrevisto.previsto)}
              </div>
            </div>
            <div className="flex gap-6 text-sm flex-wrap">
              <div>
                <div style={{ color: T.muted, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>Atual</div>
                <div className="num" style={{ color: T.ink, fontSize: 15, marginTop: 4 }}>{hidden ? "•••" : fmt(saldoPrevisto.atual)}</div>
              </div>
              <div>
                <div style={{ color: T.muted, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>+ Receitas Pendentes</div>
                <div className="num" style={{ color: T.green, fontSize: 15, marginTop: 4 }}>+{hidden ? "•••" : fmt(saldoPrevisto.pReceita)}</div>
              </div>
              <div>
                <div style={{ color: T.muted, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>− Despesas Pendentes</div>
                <div className="num" style={{ color: T.red, fontSize: 15, marginTop: 4 }}>−{hidden ? "•••" : fmt(saldoPrevisto.pDespesa)}</div>
              </div>
            </div>
          </div>
          <div style={{ color: T.faint, fontSize: 11, fontStyle: "italic", marginTop: 10 }}>
            Considera todas as transações pendentes (não compensadas) com data dentro deste mês.
          </div>
        </section>
      )}

      {/* ★ TOPO: próximos vencimentos + a receber + parcelas */}
      <DashboardWidgets transacoes={transacoes} categorias={categorias}
                        devedores={devedores} dividas={dividas}
                        parcelamentos={parcelamentos} hidden={hidden} />

      {/* Insights da IA */}
      {insights.length > 0 && (
        <section style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14 }} className="mb-5">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={14} style={{ color: T.gold }} />
            <div className="label-eyebrow">Insights Automáticos</div>
          </div>
          <div className="space-y-3">
            {insights.slice(0, 5).map((ins, i) => {
              const cores = {
                alerta:      { bg: `${T.red}11`,   border: T.red,   icon: AlertTriangle },
                atencao:     { bg: `${T.gold}11`,  border: T.gold,  icon: AlertTriangle },
                positivo:    { bg: `${T.green}11`, border: T.green, icon: CheckCircle2 },
                oportunidade:{ bg: `${T.gold}11`,  border: T.gold,  icon: Lightbulb },
                info:        { bg: T.bgSoft,       border: T.border, icon: Info },
              };
              const cfg = cores[ins.tipo] || cores.info;
              const Icon = cfg.icon;
              return (
                <div key={i} style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, padding: 12,
                                       display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Icon size={16} style={{ color: cfg.border, flexShrink: 0, marginTop: 2 }} />
                  <div className="flex-1">
                    <div style={{ color: T.ink, fontSize: 13, fontWeight: 600 }}>{ins.titulo}</div>
                    <div style={{ color: T.muted, fontSize: 12, marginTop: 3 }}>{ins.descricao}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Assinaturas detectadas */}
      {assinaturas.length > 0 && (
        <section style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14 }} className="mb-5">
          <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Activity size={14} style={{ color: T.gold }} />
              <div className="label-eyebrow">Assinaturas Recorrentes Detectadas</div>
            </div>
            <div className="num text-sm" style={{ color: T.gold }}>
              {assinaturas.length} {assinaturas.length === 1 ? "serviço" : "serviços"} ·
              {" "}{hidden ? "•••" : fmt(assinaturas.reduce((s, a) => s + a.valorAnualizado, 0))}/ano
            </div>
          </div>
          <p style={{ color: T.muted, fontSize: 11, fontStyle: "italic", marginBottom: 16 }}>
            Detectadas automaticamente pelas transações que se repetem mensalmente
          </p>
          <div className="grid md:grid-cols-2 gap-2">
            {assinaturas.slice(0, 8).map((a, i) => (
              <div key={i} style={{ background: T.bgSoft, padding: 12, border: `1px solid ${T.border}` }}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div style={{ color: T.ink, fontSize: 13, fontWeight: 500 }} className="truncate">
                      {a.descricao}
                      {a.conhecida && <span style={{ color: T.gold, fontSize: 10, marginLeft: 6 }}>✓</span>}
                    </div>
                    <div style={{ color: T.muted, fontSize: 10, marginTop: 2, letterSpacing: "0.05em" }}>
                      {a.ocorrencias}× · {a.frequencia} · última: {a.ultimaData}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="num" style={{ color: T.gold, fontSize: 14, fontWeight: 600 }}>
                      {hidden ? "•••" : fmt(a.valorMedio)}
                    </div>
                    <div className="num" style={{ color: T.muted, fontSize: 10 }}>
                      {hidden ? "•••" : fmt(a.valorAnualizado)}/ano
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Charts grid */}
      {(mostra("ultimos-12m") || mostra("por-classe")) && (
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        {/* Histórico */}
        {mostra("ultimos-12m") && (
        <div className="lg:col-span-2" style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14 }}>
          <div className="flex items-baseline justify-between mb-1">
            <div>
              <div className="label-eyebrow">Trajetória Patrimonial</div>
              <h3 style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginTop: 2 }}>Últimos 12 meses</h3>
            </div>
            <div className="num text-sm" style={{ color: T.green }}>+ {fmtN(historico.length > 0 && historico[0].valor ? (historico.at(-1).valor / historico[0].valor - 1) * 100 : 0, 1)}%</div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={historico} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.gold} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={T.gold} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={T.border} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="mes" stroke={T.muted} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={T.muted} fontSize={11} tickLine={false} axisLine={false}
                     tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: T.bg, border: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 12 }}
                       formatter={(v) => fmt(v)} labelStyle={{ color: T.gold }} />
              <Area type="monotone" dataKey="valor" stroke={T.gold} strokeWidth={1.5} fill="url(#gradGold)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        )}

        {/* Composição */}
        {mostra("por-classe") && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14 }}>
          <div className="label-eyebrow">Composição</div>
          <h3 style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginTop: 2, marginBottom: 8 }}>Por classe</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={composicao} dataKey="valor" nameKey="nome" cx="50%" cy="50%"
                   innerRadius={50} outerRadius={75} paddingAngle={2}>
                {composicao.map((c, i) => <Cell key={i} fill={c.cor} stroke={T.bg} />)}
              </Pie>
              <Tooltip contentStyle={{ background: T.bg, border: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 11 }}
                       formatter={(v) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-4">
            {composicao.map(c => (
              <div key={c.nome} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div style={{ width: 10, height: 10, background: c.cor }} />
                  <span style={{ color: T.ink }}>{c.nome}</span>
                </div>
                <span className="num" style={{ color: T.muted }}>
                  {fmtN((c.valor / (totais.patrimonio || 1)) * 100, 1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
        )}
      </section>
      )}

      {/* Despesas por categoria + Metas summary */}
      {(mostra("por-categoria") || mostra("metas")) && (
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
        {mostra("por-categoria") && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14 }}>
          <div className="label-eyebrow">Despesas</div>
          <h3 style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginTop: 2, marginBottom: 10 }}>Por Categoria</h3>
          {despesasCat.length === 0 ? (
            <div style={{ color: T.muted }} className="italic">Nenhuma despesa registrada.</div>
          ) : (
            <div className="space-y-3">
              {despesasCat.slice(0, 6).map(d => {
                const pct = (d.valor / (totais.despesas || 1)) * 100;
                return (
                  <div key={d.nome}>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: T.ink }}>{d.nome}</span>
                      <span className="num" style={{ color: T.muted }}>{mask(fmt(d.valor))} · {fmtN(pct, 1)}%</span>
                    </div>
                    <div style={{ background: T.border, height: 4 }}>
                      <div style={{ width: `${pct}%`, background: d.cor, height: "100%", transition: "width 0.6s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        {mostra("metas") && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14 }}>
          <div className="label-eyebrow">Objetivos</div>
          <h3 style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginTop: 2, marginBottom: 10 }}>Metas em Curso</h3>
          {metas.length === 0 ? (
            <div style={{ color: T.muted }} className="italic">Nenhuma meta cadastrada.</div>
          ) : (
            <div className="space-y-4">
              {metas.map(m => {
                const pct = Math.min(100, (m.atual / m.alvo) * 100);
                return (
                  <div key={m.id}>
                    <div className="flex justify-between items-baseline mb-2">
                      <div style={{ fontFamily: T.serif, fontSize: 18, color: T.ink }}>{m.nome}</div>
                      <div className="num text-xs" style={{ color: T.gold }}>{fmtN(pct, 1)}%</div>
                    </div>
                    <div className="flex justify-between text-xs num mb-2" style={{ color: T.muted }}>
                      <span>{mask(fmt(m.atual))}</span>
                      <span>{mask(fmt(m.alvo))}</span>
                    </div>
                    <div style={{ background: T.border, height: 6 }}>
                      <div style={{ width: `${pct}%`, background: T.gold, height: "100%", transition: "width 0.6s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}
      </section>
      )}

      {/* ===== FASE 2 · gráficos opcionais ===== */}

      {/* Donut de categorias */}
      {mostra("donut-categorias") && despesasCat.length > 0 && (
        <section className="mb-5" style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14 }}>
          <div className="label-eyebrow">Distribuição</div>
          <h3 style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginTop: 2, marginBottom: 12 }}>Donut de categorias</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <svg width="150" height="150" viewBox="0 0 42 42">
              {(() => {
                const total = despesasCat.reduce((s, c) => s + c.valor, 0) || 1;
                const cores = [T.gold, T.green, T.blue, T.red, "#9a8fb3", T.goldHi, T.muted];
                let offset = 0;
                return despesasCat.slice(0, 7).map((c, i) => {
                  const pct = (c.valor / total) * 100;
                  const el = (
                    <circle key={i} cx="21" cy="21" r="15.9" fill="transparent"
                      stroke={cores[i % cores.length]} strokeWidth="6"
                      strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={-offset}
                      transform="rotate(-90 21 21)" />
                  );
                  offset += pct;
                  return el;
                });
              })()}
              <circle cx="21" cy="21" r="11" fill={T.card} />
            </svg>
            <div style={{ flex: 1, minWidth: 180 }}>
              {(() => {
                const total = despesasCat.reduce((s, x) => s + x.valor, 0) || 1;
                const cores = [T.gold, T.green, T.blue, T.red, "#9a8fb3", T.goldHi, T.muted];
                return despesasCat.slice(0, 7).map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 5 }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: cores[i % cores.length] }} />
                    <span style={{ flex: 1, color: T.ink }}>{c.nome}</span>
                    <span style={{ color: T.muted }}>{Math.round((c.valor / total) * 100)}%</span>
                    <span className="num" style={{ fontWeight: 600, color: T.ink }}>{hidden ? "•••" : fmt(c.valor)}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </section>
      )}

      {/* Waterfall do mês */}
      {mostra("waterfall") && (
        <section className="mb-5" style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14 }}>
          <div className="label-eyebrow">Fluxo do mês</div>
          <h3 style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginTop: 2, marginBottom: 12 }}>Waterfall</h3>
          {(() => {
            const receitas = totais.receitas || 0;
            const despesas = totais.despesas || 0;
            const saldoInicial = (totais.saldoContas || 0) - receitas + despesas;
            const etapas = [
              { lbl: "Saldo inicial", valor: saldoInicial, tipo: "base" },
              { lbl: "+ Receitas", valor: receitas, tipo: "up" },
              { lbl: "− Despesas", valor: -despesas, tipo: "down" },
              { lbl: "Saldo final", valor: totais.saldoContas || 0, tipo: "base" },
            ];
            const max = Math.max(...etapas.map(e => Math.abs(e.valor)), 1);
            return (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 170 }}>
                {etapas.map((e, i) => {
                  const h = (Math.abs(e.valor) / max) * 130;
                  const cor = e.tipo === "up" ? T.green : e.tipo === "down" ? T.red : T.gold;
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{ fontSize: 10, color: T.muted, fontWeight: 600 }}>{hidden ? "•••" : fmt(Math.abs(e.valor))}</div>
                      <div style={{ width: "100%", height: h, background: cor, borderRadius: "4px 4px 0 0", minHeight: 4 }} />
                      <div style={{ fontSize: 10, color: T.faint, textAlign: "center" }}>{e.lbl}</div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </section>
      )}

      {/* Evolução do saldo */}
      {mostra("evolucao-saldo") && (
        <section className="mb-5" style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14 }}>
          <div className="label-eyebrow">Tendência</div>
          <h3 style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginTop: 2, marginBottom: 12 }}>Evolução do saldo</h3>
          {(() => {
            const serie = (historico || []).map(m => m.valor || 0);
            if (serie.length < 2) return <div style={{ fontSize: 12, color: T.faint }}>Sem dados suficientes.</div>;
            const max = Math.max(...serie, 1);
            const min = Math.min(...serie, 0);
            const range = max - min || 1;
            const pts = serie.map((v, i) => {
              const x = (i / (serie.length - 1)) * 100;
              const y = 40 - ((v - min) / range) * 40;
              return `${x},${y}`;
            }).join(" ");
            return (
              <>
                <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: "100%", height: 110 }}>
                  <polyline points={pts} fill="none" stroke={T.gold} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T.faint, marginTop: 4 }}>
                  <span>{historico[0]?.mes}</span>
                  <span>{historico.at(-1)?.mes}</span>
                </div>
              </>
            );
          })()}
        </section>
      )}

      {/* ===== Relatórios financeiros (cards opcionais) ===== */}

      {/* Receita vs Despesa · 6 meses */}
      {mostra("rel-receita-despesa") && (
        <section className="mb-5" style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14 }}>
          <div className="label-eyebrow">Relatório</div>
          <h3 style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginTop: 2, marginBottom: 10 }}>Receita vs Despesa · 6 meses</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={seisMesesRD}>
              <CartesianGrid stroke={T.border} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="mes" stroke={T.muted} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={T.muted} fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: T.bg, border: `1px solid ${T.border}`, fontSize: 12 }}
                       formatter={(v) => hidden ? "•••" : fmt(v)} />
              <Bar dataKey="receita" fill={T.green} name="Receita" />
              <Bar dataKey="despesa" fill={T.red} name="Despesa" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Top categorias do mês */}
      {mostra("rel-top-categorias") && despesasCat.length > 0 && (
        <section className="mb-5" style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14 }}>
          <div className="label-eyebrow">Relatório</div>
          <h3 style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginTop: 2, marginBottom: 10 }}>Top categorias do mês</h3>
          <div className="space-y-3">
            {despesasCat.slice(0, 8).map(d => {
              const pct = totais.despesas > 0 ? (d.valor / totais.despesas) * 100 : 0;
              return (
                <div key={d.nome}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: T.ink }}>{d.nome}</span>
                    <span className="num" style={{ color: T.muted }}>{mask(fmt(d.valor))} · {fmtN(pct, 1)}%</span>
                  </div>
                  <div style={{ background: T.border, height: 4 }}>
                    <div style={{ width: `${pct}%`, background: d.cor, height: "100%" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Cashflow preditivo */}
      {mostra("rel-cashflow") && (
        <section className="mb-5" style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14 }}>
          <div className="label-eyebrow">Relatório</div>
          <h3 style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginTop: 2, marginBottom: 10 }}>Cashflow preditivo · 3 meses</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={cashflow}>
              <XAxis dataKey="nome" stroke={T.muted} fontSize={10} tickFormatter={n => n.split(" ")[0]} />
              <YAxis stroke={T.muted} fontSize={10} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, color: T.ink, fontSize: 12 }}
                       formatter={(v) => hidden ? "•••" : fmt(v)} />
              <Bar dataKey="saldo" fill={T.gold} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Recent transactions */}
      {mostra("ultimas-tx") && (
      <section style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14 }} className="mb-5">
        <div className="label-eyebrow">Diário</div>
        <h3 style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, marginTop: 2, marginBottom: 10 }}>Últimas transações</h3>
        <div className="space-y-2">
          {transacoes.slice(-6).reverse().map(t => (
            <div key={t.id} className="flex items-center justify-between py-2"
                 style={{ borderBottom: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-3 min-w-0">
                <div style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: t.tipo === "receita" ? `${T.green}22` : `${T.red}22`,
                  color: t.tipo === "receita" ? T.green : T.red,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {t.tipo === "receita" ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                </div>
                <div className="min-w-0">
                  <div style={{ color: T.ink, fontSize: 13 }} className="truncate">{t.descricao}</div>
                  <div style={{ color: T.muted, fontSize: 11 }} className="sans tracking-wider uppercase">
                    {t.categoria} · {t.conta}
                  </div>
                </div>
              </div>
              <div className="num text-right shrink-0 ml-3" style={{ color: t.tipo === "receita" ? T.green : T.red }}>
                {t.tipo === "receita" ? "+" : "−"} {mask(fmt(t.valor))}
              </div>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* ============ INTELIGÊNCIA FINANCEIRA (rodapé) ============ */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
        {/* Score Comportamental */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14 }}>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} style={{ color: T.gold }} />
            <div className="label-eyebrow">Score Financeiro</div>
          </div>
          <div className="flex items-baseline gap-3 mb-4">
            <div style={{ fontFamily: T.serif, fontSize: 40, color: score.cor, lineHeight: 1 }} className="num">
              {hidden ? "•••" : score.total}
            </div>
            <div>
              <div style={{ color: T.muted, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase" }}>de 1000</div>
              <div style={{ color: score.cor, fontSize: 13, fontWeight: 600, marginTop: 2 }}>{score.nivel}</div>
            </div>
          </div>
          <div className="space-y-2">
            {score.breakdown.map((b, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs">
                  <span style={{ color: T.ink }}>{b.label}</span>
                  <span style={{ color: T.muted }}>
                    <span className="num" style={{ color: T.ink }}>{b.pts}</span>
                    <span style={{ opacity: 0.6 }}> / {b.max}</span>
                  </span>
                </div>
                <div style={{ height: 4, background: T.bgSoft, marginTop: 4 }}>
                  <div style={{ height: "100%", width: `${(b.pts / b.max) * 100}%`,
                                background: b.pts / b.max > 0.7 ? T.green : b.pts / b.max > 0.4 ? T.gold : T.red }} />
                </div>
                <div style={{ color: T.faint, fontSize: 10, marginTop: 2, fontStyle: "italic" }}>{b.hint}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Cashflow Preditivo */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14 }}>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} style={{ color: T.gold }} />
            <div className="label-eyebrow">Cashflow Preditivo · 3 meses</div>
          </div>
          <p style={{ color: T.muted, fontSize: 11, fontStyle: "italic", marginBottom: 16 }}>
            Projeção baseada na média dos últimos 90 dias
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={cashflow}>
              <XAxis dataKey="nome" stroke={T.muted} fontSize={10} tickFormatter={n => n.split(" ")[0]} />
              <YAxis stroke={T.muted} fontSize={10} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: T.card, border: `1px solid ${T.border}`, color: T.ink, fontSize: 12 }}
                formatter={(v) => hidden ? "•••" : fmt(v)}
              />
              <Bar dataKey="saldo" fill={T.gold} />
            </BarChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${T.border}` }}>
            {cashflow.map((c, i) => (
              <div key={i} className="text-center">
                <div style={{ color: T.muted, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {c.nome.split(" ")[0]}
                </div>
                <div className="num" style={{ color: c.saldo >= 0 ? T.gold : T.red, fontSize: 14, marginTop: 4, fontWeight: 600 }}>
                  {hidden ? "•••" : fmt(c.saldo)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

