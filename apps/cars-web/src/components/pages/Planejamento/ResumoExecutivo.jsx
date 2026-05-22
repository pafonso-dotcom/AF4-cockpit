import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, todayISO } from "../../../lib/format.js";
import { getKPIsMes, mesAtual } from "../../../lib/agregador.js";

const MES_NOMES_LONGOS = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

export default function ResumoExecutivo({
  transacoes = [],
  devedores = [],
  dividas = [],
  fixas = [],
  fixaOcorrencias = [],
  parcelamentos = [],
  hidden,
}) {
  const [mes, setMes] = useState(() => mesAtual());

  const state = { transacoes, devedores, dividas, fixas, fixaOcorrencias, parcelamentos };
  const kpis = useMemo(() => getKPIsMes(mes, state), [mes, transacoes, devedores, dividas, fixas, fixaOcorrencias, parcelamentos]);

  // A Receber: devedores em aberto que vencem no mês + receitas pendentes
  const aReceber = useMemo(() => {
    const devedoresMes = devedores.filter(d =>
      !d.recebido && (!d.vencimento || d.vencimento.startsWith(mes))
    );
    const totalDevedores = devedoresMes.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    return {
      total: totalDevedores + kpis.totalGanhos,
      qtd: devedoresMes.length + kpis.qtdGanhos,
    };
  }, [mes, devedores, kpis]);

  // Parcelas: agora filtradas pelo mês selecionado (vem do agregador)
  const parcelasInfo = useMemo(
    () => ({ total: kpis.totalParcelas || 0, qtd: kpis.qtdParcelas || 0 }),
    [kpis]
  );

  // Atenção: itens com vencimento nos próximos 3 dias
  const atencao = useMemo(() => {
    const hoje = todayISO();
    const em3 = new Date(); em3.setDate(em3.getDate() + 3);
    const em3ISO = em3.toISOString().slice(0, 10);
    const fixasAlerta = fixaOcorrencias.filter(o =>
      o.mes === mes && o.status !== "paga"
      && (o.dataVencimento || "") <= em3ISO
    );
    const dividasAlerta = dividas.filter(d =>
      !d.pago && d.vencimento && d.vencimento <= em3ISO
      && d.vencimento.startsWith(mes)
    );
    return fixasAlerta.length + dividasAlerta.length;
  }, [mes, fixaOcorrencias, dividas]);

  const balanco = aReceber.total - kpis.totalPrevisto;

  // Navegação de mês
  const prevMes = () => {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMes = () => {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const irHoje = () => setMes(mesAtual());

  const ehMesCorrente = mes === mesAtual();
  const [y, m] = mes.split("-").map(Number);
  const mesLabel = `${MES_NOMES_LONGOS[m - 1]} ${y}`;

  const kpisCards = [
    { lbl: "A Receber",         val: fmt(aReceber.total),      sub: `${aReceber.qtd} ${aReceber.qtd === 1 ? "item" : "itens"}`, cor: T.green },
    { lbl: "A Pagar",           val: fmt(kpis.totalPrevisto),  sub: `${kpis.qtdDespesas} ${kpis.qtdDespesas === 1 ? "item" : "itens"}`, cor: T.red },
    { lbl: "Parcelas",          val: fmt(parcelasInfo.total),  sub: `${parcelasInfo.qtd} no mês`, cor: T.blue || "#60a5fa" },
    { lbl: "Balanço previsto",  val: (balanco >= 0 ? "+ " : "− ") + fmt(Math.abs(balanco)), sub: "após pagar tudo", cor: T.gold, valCor: balanco >= 0 ? T.green : T.red },
    { lbl: "⚠ Atenção",         val: `${atencao} ${atencao === 1 ? "item" : "itens"}`, sub: "vencem em 3 dias", cor: T.gold, valCor: atencao > 0 ? T.red : T.muted },
  ];

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 10, padding: 16, marginBottom: 18,
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 12, flexWrap: "wrap", gap: 8,
      }}>
        <div style={{
          fontSize: 9.5, letterSpacing: ".2em", color: T.muted,
          textTransform: "uppercase", fontWeight: 700,
        }}>
          📊 Visão executiva
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={prevMes}
            style={{
              padding: 5, background: "transparent",
              border: `1px solid ${T.border}`, borderRadius: 5, cursor: "pointer", color: T.muted,
            }}>
            <ChevronLeft size={12} />
          </button>
          <span style={{
            fontSize: 11.5, fontWeight: 600, color: T.ink,
            minWidth: 130, textAlign: "center", textTransform: "capitalize",
          }}>
            {mesLabel}
            {ehMesCorrente && <span style={{ color: T.gold, marginLeft: 4 }}>★</span>}
          </span>
          <button onClick={nextMes}
            style={{
              padding: 5, background: "transparent",
              border: `1px solid ${T.border}`, borderRadius: 5, cursor: "pointer", color: T.muted,
            }}>
            <ChevronRight size={12} />
          </button>
          {!ehMesCorrente && (
            <button onClick={irHoje}
              style={{
                padding: "4px 10px", marginLeft: 4,
                background: T.gold, color: T.bg, border: "none", borderRadius: 5,
                fontSize: 10, fontWeight: 600, letterSpacing: ".05em",
                textTransform: "uppercase", cursor: "pointer",
              }}>
              Hoje
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpisCards.map((k, i) => (
          <div key={i} style={{
            background: T.bgSoft, padding: "12px 14px",
            borderRadius: 8, borderLeft: `3px solid ${k.cor}`,
          }}>
            <div style={{
              fontSize: 8.5, letterSpacing: ".15em", color: T.muted,
              textTransform: "uppercase", fontWeight: 700,
            }}>
              {k.lbl}
            </div>
            <div className="num" style={{
              fontFamily: T.serif, fontSize: 18,
              color: k.valCor || T.ink, marginTop: 5, fontWeight: 500,
              lineHeight: 1.1,
            }}>
              {hidden ? "•••" : k.val}
            </div>
            <div style={{ fontSize: 9.5, color: T.faint, marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
