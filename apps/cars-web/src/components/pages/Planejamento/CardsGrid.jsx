import React, { useMemo } from "react";
import { Calendar, BarChart3, Wallet, CreditCard, AlertTriangle, ChevronRight, Shield, TrendingUp } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, fmtN, todayISO } from "../../../lib/format.js";
import { getProjecaoSaldo } from "../../../lib/agregador.js";

export default function CardsGrid({
  transacoes = [],
  devedores = [],
  dividas = [],
  fixas = [],
  fixaOcorrencias = [],
  parcelamentos = [],
  contas = [],
  categorias = [],
  escopoAtivo,
  hidden,
  onAbrir,
}) {
  const stats = useMemo(() => {
    const hoje = todayISO();
    const mesAtual = hoje.slice(0, 7);
    const anoAtual = hoje.slice(0, 4);
    const em3 = new Date(); em3.setDate(em3.getDate() + 3);
    const em3dias = em3.toISOString().slice(0, 10);

    // Despesas do mês: fixas + variáveis
    const fixasMes = fixaOcorrencias.filter(o => o.mes === mesAtual);
    const fixasPagas = fixasMes.filter(o => o.status === "paga");
    const fixasAtrasadas = fixasMes.filter(o => o.status !== "paga" && (o.dataVencimento || "") < hoje);
    const fixasPendentes = fixasMes.filter(o => o.status !== "paga" && (o.dataVencimento || "") >= hoje);

    const totalPago = fixasPagas.reduce((s, o) => s + (parseFloat(o.valorPago) || parseFloat(o.valor) || 0), 0);
    const totalAtrasado = fixasAtrasadas.reduce((s, o) => s + (parseFloat(o.valor) || 0), 0);
    const totalPendente = fixasPendentes.reduce((s, o) => s + (parseFloat(o.valor) || 0), 0);

    const variaveisMes = transacoes.filter(t =>
      t.tipo === "despesa" && !t.fixa && (t.data || "").startsWith(mesAtual)
    );
    const totalVariaveis = variaveisMes.reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);

    // Balanço anual: receitas - despesas - dividas pagas
    // Movimento de capital de empréstimo (saída ao emprestar / devolução do
    // principal) não entra no balanço — só os juros, que vêm sem essa marca.
    const txsAno = transacoes.filter(t => (t.data || "").startsWith(anoAtual) && !(t.emprestimoSaida || t.emprestimoRetorno));
    const receitasAno = txsAno.filter(t => t.tipo === "receita").reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const despesasAno = txsAno.filter(t => t.tipo === "despesa").reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const dividasPagasAno = dividas.filter(d => d.pago && (d.dataPagamento || "").startsWith(anoAtual))
      .reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    const balancoAno = receitasAno - despesasAno - dividasPagasAno;

    // Recebíveis em aberto, pelo valor que AINDA falta receber (desconta
    // recebimentos parciais) — consistente com a Visão Executiva e o Dashboard.
    const aReceber = devedores.filter(d => !d.recebido);
    const totalReceber = aReceber.reduce((s, d) =>
      s + Math.max(0, (parseFloat(d.valor) || 0) - (parseFloat(d.valorRecebido) || 0)), 0);

    // Parcelas
    const parcelasAtivas = parcelamentos.filter(p => (p.parcelasPagas?.length || 0) < p.totalParcelas);
    const parcelasMesValor = parcelasAtivas.reduce((s, p) => {
      const v = p.valorParcela || (p.valorTotal && p.totalParcelas ? p.valorTotal / p.totalParcelas : 0);
      return s + (parseFloat(v) || 0);
    }, 0);

    // Atenção
    const dividasAbertas = dividas.filter(d => !d.pago);
    const atencao = [
      ...fixasAtrasadas,
      ...fixasPendentes.filter(o => (o.dataVencimento || "") <= em3dias),
      ...dividasAbertas.filter(d => d.vencimento && d.vencimento <= em3dias),
    ];

    // Reserva de emergência: média 3m × 6 vs saldo líquido
    const mesesRef = [-1, -2, -3].map(off => {
      const d = new Date(); d.setMonth(d.getMonth() + off);
      return d.toISOString().slice(0, 7);
    });
    const despesas3m = transacoes
      .filter(t => t.tipo === "despesa" && t.compensado !== false)
      .filter(t => mesesRef.some(m => (t.data || "").startsWith(m)));
    const custoMedioMensal = despesas3m.length > 0
      ? despesas3m.reduce((s, t) => s + (parseFloat(t.valor) || 0), 0) / 3
      : 0;
    const reservaIdeal = custoMedioMensal * 6;
    const saldoLiquido = (typeof contas !== "undefined" ? contas : [])
      .filter(c => c.tipo !== "credito")
      .reduce((s, c) => s + (parseFloat(c.saldo) || 0), 0);
    const pctReserva = reservaIdeal > 0 ? Math.min(100, (saldoLiquido / reservaIdeal) * 100) : 0;

    return {
      despesasTotal: fixasMes.length + variaveisMes.length,
      despesasFixas: fixasMes.length,
      despesasVar: variaveisMes.length,
      totalPago, totalAtrasado, totalPendente: totalPendente + totalVariaveis,
      balancoAno,
      totalReceber, qtdReceber: aReceber.length,
      parcelasAtivas: parcelasAtivas.length, parcelasMesValor,
      atencao: atencao.length,
      reservaIdeal, saldoLiquido, pctReserva, custoMedioMensal,
    };
  }, [transacoes, devedores, dividas, fixaOcorrencias, parcelamentos, contas]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* DESPESAS DO MÊS — featured, ocupa 2 colunas */}
      <div
        onClick={() => onAbrir("despesas")}
        className="card-hover"
        style={{
          gridColumn: "1 / -1",
          background: `linear-gradient(135deg, ${T.gold}11, ${T.card})`,
          border: `1px solid ${T.gold}55`,
          borderRadius: 18, padding: 18, cursor: "pointer",
          transition: "all .2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 18px ${T.gold}22`; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 16,
            background: T.bgSoft, display: "grid", placeItems: "center",
          }}>
            <Calendar size={22} color={T.gold} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>A Pagar &amp; Receber</h4>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>
              {stats.despesasTotal} a pagar no mês · {stats.qtdReceber} a receber
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginTop: 14, fontSize: 11, color: T.muted }}>
          <Mini lbl="já pago"    val={hidden ? "•••" : fmt(stats.totalPago)}     cor={T.green} />
          <Mini lbl="a pagar"    val={hidden ? "•••" : fmt(stats.totalPendente)} cor={T.gold} />
          <Mini lbl="atrasado"   val={hidden ? "•••" : fmt(stats.totalAtrasado)} cor={T.red} />
          <Mini lbl="a receber"  val={hidden ? "•••" : fmt(stats.totalReceber)}  cor={T.green} />
        </div>

        <FooterCard />
      </div>

      {/* CONTROLE ANUAL */}
      <CardMenor
        onClick={() => onAbrir("anual")}
        icon={<BarChart3 size={20} color={T.gold} />}
        titulo="Controle anual"
        sub="12 meses · balanço acumulado"
        valor={hidden ? "•••" : (stats.balancoAno >= 0 ? "+ " : "− ") + fmt(Math.abs(stats.balancoAno))}
        valorCor={stats.balancoAno >= 0 ? T.green : T.red}
      />

      {/* (Recebíveis foi unido ao card "A Pagar & Receber" acima) */}

      {/* PARCELAS */}
      <CardMenor
        onClick={() => onAbrir("parcelas")}
        icon={<CreditCard size={20} color={T.gold} />}
        titulo="Parcelas em curso"
        sub={`${stats.parcelasAtivas} parcelamento${stats.parcelasAtivas === 1 ? "" : "s"} ativo${stats.parcelasAtivas === 1 ? "" : "s"}`}
        valor={hidden ? "•••" : `${fmt(stats.parcelasMesValor)}/mês`}
        valorCor={T.ink}
      />

      {/* ATENÇÃO */}
      <CardMenor
        onClick={() => onAbrir("atencao")}
        icon={<AlertTriangle size={20} color={stats.atencao > 0 ? T.red : T.gold} />}
        titulo="Atenção"
        sub="Itens que precisam de ação"
        valor={`${stats.atencao} ${stats.atencao === 1 ? "item" : "itens"}`}
        valorCor={stats.atencao > 0 ? T.red : T.muted}
      />

      {/* RESERVA DE EMERGÊNCIA */}
      <CardReserva
        onClick={() => onAbrir("reserva")}
        stats={stats}
        hidden={hidden}
      />
    </div>
  );
}

function CardReserva({ onClick, stats, hidden }) {
  const tem = stats.reservaIdeal > 0;
  const pct = stats.pctReserva || 0;
  const pronta = pct >= 100;
  return (
    <div
      onClick={onClick}
      style={{
        gridColumn: "1 / -1",
        background: T.card, border: `1px solid ${pronta ? T.green + "66" : T.border}`,
        borderLeft: `3px solid ${pronta ? T.green : T.gold}`,
        borderRadius: 16, padding: 16, cursor: "pointer",
        transition: "all .2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 12px ${T.gold}22`; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 16,
          background: T.bgSoft, display: "grid", placeItems: "center", flexShrink: 0,
        }}>
          <Shield size={20} color={pronta ? T.green : T.gold} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>
            Reserva de Emergência
          </h4>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
            {tem
              ? `Ideal: ${hidden ? "•••" : fmt(stats.reservaIdeal)} (6× custo médio de ${hidden ? "•••" : fmt(stats.custoMedioMensal)})`
              : "Calcule sua reserva ideal e plano de construção"}
          </div>
        </div>
        <ChevronRight size={14} color={T.gold} style={{ flexShrink: 0 }} />
      </div>
      {tem && (
        <>
          <div style={{
            height: 8, background: T.border, borderRadius: 999, overflow: "hidden",
            marginTop: 6,
          }}>
            <div style={{
              width: `${pct}%`, height: "100%",
              background: pronta ? T.green : T.gold,
              transition: "width .4s",
            }} />
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: 11, color: T.muted, marginTop: 6,
          }}>
            <span>Você tem: <strong style={{ color: pronta ? T.green : T.ink }} className="num">
              {hidden ? "•••" : fmt(stats.saldoLiquido)}
            </strong></span>
            <span style={{ color: pronta ? T.green : T.gold, fontWeight: 600 }}>
              {fmtN(pct, 1)}%
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function Mini({ lbl, val, cor }) {
  return (
    <div style={{
      padding: "10px 12px", background: T.card,
      border: `1px solid ${T.border}`, borderRadius: 12,
    }}>
      <div className="num" style={{ color: cor, fontSize: 13.5, fontWeight: 600 }}>{val}</div>
      <div style={{ fontSize: 10, color: T.muted, marginTop: 2, letterSpacing: ".05em" }}>{lbl}</div>
    </div>
  );
}

function FooterCard() {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${T.border}`,
    }}>
      <span style={{
        fontSize: 10, color: T.muted, letterSpacing: ".1em",
        textTransform: "uppercase", fontWeight: 600,
      }}>
        Toque para expandir
      </span>
      <ChevronRight size={16} color={T.gold} />
    </div>
  );
}

function CardMenor({ onClick, icon, titulo, sub, valor, valorCor }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.card, border: `1px solid ${T.border}`,
        borderRadius: 16, padding: 16, cursor: "pointer",
        transition: "all .2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.boxShadow = `0 4px 12px ${T.gold}22`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 16,
          background: T.bgSoft, display: "grid", placeItems: "center",
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div>
          <h4 style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{titulo}</h4>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{sub}</div>
        </div>
      </div>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${T.border}`,
      }}>
        <div className="num" style={{
          fontFamily: T.serif, fontSize: 17, fontWeight: 600,
          color: valorCor || T.ink,
        }}>
          {valor}
        </div>
        <ChevronRight size={14} color={T.gold} />
      </div>
    </div>
  );
}
