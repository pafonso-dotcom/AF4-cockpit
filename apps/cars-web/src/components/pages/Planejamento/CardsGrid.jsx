import React, { useMemo } from "react";
import { Calendar, BarChart3, Wallet, CreditCard, AlertTriangle, ChevronRight } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, todayISO } from "../../../lib/format.js";

export default function CardsGrid({
  transacoes = [],
  devedores = [],
  dividas = [],
  fixaOcorrencias = [],
  parcelamentos = [],
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
    const txsAno = transacoes.filter(t => (t.data || "").startsWith(anoAtual));
    const receitasAno = txsAno.filter(t => t.tipo === "receita").reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const despesasAno = txsAno.filter(t => t.tipo === "despesa").reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const dividasPagasAno = dividas.filter(d => d.pago && (d.dataPagamento || "").startsWith(anoAtual))
      .reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    const balancoAno = receitasAno - despesasAno - dividasPagasAno;

    // Recebíveis
    const aReceber = devedores.filter(d => !d.recebido);
    const totalReceber = aReceber.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

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

    return {
      despesasTotal: fixasMes.length + variaveisMes.length,
      despesasFixas: fixasMes.length,
      despesasVar: variaveisMes.length,
      totalPago, totalAtrasado, totalPendente: totalPendente + totalVariaveis,
      balancoAno,
      totalReceber, qtdReceber: aReceber.length,
      parcelasAtivas: parcelasAtivas.length, parcelasMesValor,
      atencao: atencao.length,
    };
  }, [transacoes, devedores, dividas, fixaOcorrencias, parcelamentos]);

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
          borderRadius: 12, padding: 18, cursor: "pointer",
          transition: "all .2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 18px ${T.gold}22`; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: T.bgSoft, display: "grid", placeItems: "center",
          }}>
            <Calendar size={22} color={T.gold} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>Despesas do mês</h4>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>
              {stats.despesasTotal} lançamentos · {stats.despesasFixas} fixas + {stats.despesasVar} variáveis
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3" style={{ marginTop: 14, fontSize: 11, color: T.muted }}>
          <Mini lbl="já pago"    val={hidden ? "•••" : fmt(stats.totalPago)}     cor={T.green} />
          <Mini lbl="a pagar"    val={hidden ? "•••" : fmt(stats.totalPendente)} cor={T.gold} />
          <Mini lbl="atrasado"   val={hidden ? "•••" : fmt(stats.totalAtrasado)} cor={T.red} />
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

      {/* RECEBÍVEIS */}
      <CardMenor
        onClick={() => onAbrir("recebiveis")}
        icon={<Wallet size={20} color={T.gold} />}
        titulo="Recebíveis"
        sub={`${stats.qtdReceber} ${stats.qtdReceber === 1 ? "item em aberto" : "itens em aberto"}`}
        valor={hidden ? "•••" : fmt(stats.totalReceber)}
        valorCor={T.green}
      />

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
    </div>
  );
}

function Mini({ lbl, val, cor }) {
  return (
    <div style={{
      padding: "10px 12px", background: T.card,
      border: `1px solid ${T.border}`, borderRadius: 7,
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
        borderRadius: 10, padding: 16, cursor: "pointer",
        transition: "all .2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.boxShadow = `0 4px 12px ${T.gold}22`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
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
