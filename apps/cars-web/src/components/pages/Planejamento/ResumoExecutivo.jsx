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
  onAbrir,
}) {
  const [mes, setMes] = useState(() => mesAtual());

  const state = { transacoes, devedores, dividas, fixas, fixaOcorrencias, parcelamentos };
  const kpis = useMemo(() => getKPIsMes(mes, state), [mes, transacoes, devedores, dividas, fixas, fixaOcorrencias, parcelamentos]);

  // A Receber: SÓ recebíveis em aberto que vencem no mês (ou sem vencimento),
  // pelo valor que AINDA falta receber (desconta recebimentos parciais).
  // NÃO soma kpis.totalGanhos — esse já inclui esses mesmos devedores (contava
  // em dobro) e ainda receitas já lançadas, que são renda, não "a receber".
  const aReceber = useMemo(() => {
    const restante = (d) => Math.max(0, (parseFloat(d.valor) || 0) - (parseFloat(d.valorRecebido) || 0));
    const devedoresMes = devedores.filter(d =>
      !d.recebido && (!d.vencimento || d.vencimento.startsWith(mes))
    );
    return {
      total: devedoresMes.reduce((s, d) => s + restante(d), 0),
      qtd: devedoresMes.length,
    };
  }, [mes, devedores]);

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

  // Balanço previsto do mês = renda prevista (ganhos: receitas + recebíveis do
  // mês, via agregador) − despesas previstas. Usa totalGanhos (não o card
  // "A Receber", que agora é só recebíveis em aberto) pra não ficar negativo à toa.
  const balanco = kpis.totalGanhos - kpis.totalPrevisto;

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
    { lbl: "A Receber",         val: fmt(aReceber.total),      sub: `${aReceber.qtd} ${aReceber.qtd === 1 ? "item" : "itens"}`, cor: T.green, destino: "recebiveis:receber" },
    { lbl: "A Pagar",           val: fmt(kpis.totalPrevisto),  sub: `${kpis.qtdDespesas} ${kpis.qtdDespesas === 1 ? "item" : "itens"}`, cor: T.red, destino: "recebiveis:pagar" },
    { lbl: "Parcelas",          val: fmt(parcelasInfo.total),  sub: `${parcelasInfo.qtd} no mês`, cor: T.blue || "#60a5fa", destino: "parcelas" },
    { lbl: "Balanço previsto",  val: (balanco >= 0 ? "+ " : "− ") + fmt(Math.abs(balanco)), sub: "após pagar tudo", cor: T.gold, valCor: balanco >= 0 ? T.green : T.red, destino: "anual" },
    { lbl: "⚠ Atenção",         val: `${atencao} ${atencao === 1 ? "item" : "itens"}`, sub: "vencem em 3 dias", cor: T.gold, valCor: atencao > 0 ? T.red : T.muted, destino: "atencao" },
  ];

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 16, padding: 16, marginBottom: 18,
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
        {kpisCards.map((k, i) => {
          const clicavel = !!(onAbrir && k.destino);
          return (
          <div key={i}
            onClick={clicavel ? () => onAbrir(k.destino) : undefined}
            className={clicavel ? "card-hover" : undefined}
            title={clicavel ? `Abrir ${k.lbl}` : undefined}
            style={{
              background: T.bgSoft, padding: "12px 14px",
              borderRadius: 14, borderLeft: `3px solid ${k.cor}`,
              cursor: clicavel ? "pointer" : "default",
              transition: "all .15s",
            }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
              fontSize: 8.5, letterSpacing: ".15em", color: T.muted,
              textTransform: "uppercase", fontWeight: 700,
            }}>
              <span>{k.lbl}</span>
              {clicavel && <ChevronRight size={11} style={{ color: T.faint }} />}
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
          );
        })}
      </div>
    </div>
  );
}
