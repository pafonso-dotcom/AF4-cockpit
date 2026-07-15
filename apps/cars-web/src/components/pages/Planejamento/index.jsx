import React, { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import AReceberEDividas from "../AReceberEDividas.jsx";
import DespesasFixas from "../DespesasFixas.jsx";
import Cheques from "../Cheques.jsx";
import AnaliseGastos from "./AnaliseGastos.jsx";

/**
 * Centro de Controle — cada seção mostra uma VISÃO GERAL simples sempre visível
 * (recebido/pago · pendente · atrasado · total previsto) e o detalhe abre só ao
 * clicar (acordeão, uma seção por vez). Sem "Visão Executiva".
 */
export default function Planejamento(props) {
  const {
    devedores = [], fixas = [], fixaOcorrencias = [],
    dividas = [], parcelamentos = [], transacoes = [], hidden,
  } = props;
  const [aberto, setAberto] = useState(props.secaoInicial ?? null); // "areceber" | "fixas" | "cheques" | null

  const toggle = (id) => setAberto(prev => (prev === id ? null : id));

  // A Receber: recebido (todos) / pendente (vence no MÊS corrente) / atrasado
  // (todos vencidos) / total previsto (tudo: recebido + tudo em aberto).
  const resumoReceber = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const mes = hoje.slice(0, 7);
    let recebido = 0, pendenteMes = 0, atrasado = 0, abertoTotal = 0;
    devedores.forEach(d => {
      const valor = Number(d.valor) || 0;
      const vr = Number(d.valorRecebido) || 0;
      // Juros de empréstimo já recebidos (mês a mês) contam como recebido e
      // abatem do que ainda falta receber. Sem isto, o juros baixado sumia:
      // não entrava em "Recebido" e o total continuava cheio.
      const jurosRec = d.emprestimo && Array.isArray(d.recebimentos)
        ? d.recebimentos.filter(r => r && r.tipo === "juros").reduce((s, r) => s + (Number(r.valor) || 0), 0)
        : 0;
      if (d.recebido) { recebido += vr > 0 ? vr : valor; return; }
      recebido += vr + jurosRec; // parciais e juros já contam como "recebido"
      const restante = Math.max(0, valor - vr - jurosRec);
      if (restante <= 0) return;
      abertoTotal += restante;
      if (d.vencimento && d.vencimento < hoje) atrasado += restante;
      else if (!d.vencimento || d.vencimento.slice(0, 7) === mes) pendenteMes += restante;
      // vencimentos de meses futuros não entram em "pendente (mês)"
    });
    return { recebido, pendente: pendenteMes, atrasado, total: recebido + abertoTotal, aReceber: abertoTotal };
  }, [devedores]);

  // A Pagar: espelha o "em aberto" da tela A Receber & Dívidas — dívidas +
  // fixas pendentes + parcelas de cartão + despesas avulsas não compensadas.
  // "do mês" = vence no mês corrente; "cartões" = só as parcelas de cartão.
  const resumoPagar = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const mes = hoje.slice(0, 7);
    const ymOf = (v) => {
      if (!v) return "";
      if (typeof v === "string") return v.slice(0, 7);
      try { return new Date(v).toISOString().slice(0, 7); } catch { return ""; }
    };
    // Cada item vira { valor, venc, cartao }
    const itens = [];
    // 1) Dívidas tradicionais em aberto
    dividas.filter(d => !d.pago).forEach(d => itens.push({ valor: Number(d.valor) || 0, venc: d.vencimento, cartao: false }));
    // 2) Ocorrências de despesas fixas pendentes (com fixa existente)
    (fixaOcorrencias || []).filter(o => o.status === "pendente" && fixas.some(f => f.id === o.fixaId))
      .forEach(o => itens.push({ valor: Number(o.valor) || 0, venc: o.dataVencimento, cartao: false }));
    // 3) Parcelas de cartão ainda não pagas
    (parcelamentos || []).forEach(p => {
      const total = p.totalParcelas || 0;
      if (total <= 0) return;
      const valorPorParcela = (p.valorTotal || 0) / total;
      const pagas = new Set(p.parcelasPagas || []);
      const base = p.dataPrimeira || p.dataCompra;
      if (!base) return;
      const [bY, bM, bD] = base.split("-").map(Number);
      const startMonth = p.dataPrimeira ? bM : bM + 1;
      for (let n = 1; n <= total; n++) {
        if (pagas.has(n)) continue;
        const offset = n - 1;
        const dt = new Date(bY, startMonth - 1 + offset, 1);
        const ultDia = new Date(bY, startMonth + offset, 0).getDate();
        dt.setDate(Math.min(bD, ultDia));
        const vencISO = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        itens.push({ valor: valorPorParcela, venc: vencISO, cartao: true });
      }
    });
    // 4) Despesas avulsas (transações de despesa não compensadas, sem origem fixa/parcela)
    (transacoes || []).filter(t => t.tipo === "despesa" && !t.compensado
      && !t.origemFixaOcorrenciaId && !t.origemParcelamentoId)
      .forEach(t => itens.push({ valor: Number(t.valor) || 0, venc: t.vencimento || t.data, cartao: false }));

    let total = 0, pagarMes = 0, cartoes = 0;
    itens.forEach(it => {
      total += it.valor;
      if (it.cartao) cartoes += it.valor;
      // sem data cai no mês corrente (mesma regra da tela A Pagar)
      if (!it.venc || ymOf(it.venc) === mes) pagarMes += it.valor;
    });
    return { total, pagarMes, cartoes };
  }, [dividas, fixas, fixaOcorrencias, parcelamentos, transacoes]);

  // Despesas Fixas · mês: já pago / pendente / atrasado / total previsto.
  const resumoFixas = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const mes = hoje.slice(0, 7);
    const existe = (id) => fixas.some(f => f.id === id);
    let pago = 0, pendente = 0, atrasado = 0;
    fixaOcorrencias.forEach(o => {
      if (o.mes !== mes || !existe(o.fixaId)) return;
      if (o.status === "paga") pago += Number(o.valorPago ?? o.valor) || 0;
      else if ((o.dataVencimento || "") < hoje) atrasado += Number(o.valor) || 0;
      else pendente += Number(o.valor) || 0;
    });
    return { pago, pendente, atrasado, total: pago + pendente + atrasado };
  }, [fixas, fixaOcorrencias]);

  // Mini visão geral (4 números) — sempre visível, acima do detalhe da seção.
  const VisaoGeral = ({ legenda, itens }) => (
    <div style={{ borderTop: `1px solid ${T.border}`, padding: "10px 16px 12px" }}>
      <div style={{ fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: T.faint, fontWeight: 700, marginBottom: 8 }}>{legenda}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 8 }}>
        {itens.map(it => (
          <div key={it.lbl} style={{ background: T.bgSoft, borderRadius: 12, padding: "10px 11px", borderLeft: `3px solid ${it.cor}` }}>
            <div style={{ fontSize: 8.5, letterSpacing: ".05em", textTransform: "uppercase", color: T.faint, fontWeight: 700 }}>{it.lbl}</div>
            <div className="num" style={{ fontFamily: T.mono || T.serif, fontSize: 14, fontWeight: 700, color: it.cor, marginTop: 4, whiteSpace: "nowrap" }}>
              {hidden ? "•••" : fmt(it.v)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Visão geral em DOIS grupos (o que entra × o que sai) — usada na seção
  // "A Receber & Dívidas". Cada grupo tem seus próprios cards.
  const Card = ({ lbl, v, cor, hint }) => (
    <div style={{ background: T.bgSoft, borderRadius: 12, padding: "10px 11px", borderLeft: `3px solid ${cor}`, minWidth: 0 }}>
      <div style={{ fontSize: 8.5, letterSpacing: ".05em", textTransform: "uppercase", color: T.faint, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{lbl}</div>
      <div className="num" style={{ fontFamily: T.mono || T.serif, fontSize: 14, fontWeight: 700, color: cor, marginTop: 4, whiteSpace: "nowrap" }}>
        {hidden ? "•••" : fmt(v)}
      </div>
      {hint && <div style={{ fontSize: 9, color: T.faint, marginTop: 2 }}>{hint}</div>}
    </div>
  );
  const VisaoGeralGrupos = ({ legenda, entra, sai }) => (
    <div style={{ borderTop: `1px solid ${T.border}`, padding: "10px 16px 12px" }}>
      <div style={{ fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: T.faint, fontWeight: 700, marginBottom: 8 }}>{legenda}</div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,3fr)", gap: 14, alignItems: "stretch" }} className="vg-grupos">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700, color: T.green }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.green }} /> A Receber
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
            {entra.map(it => <Card key={it.lbl} {...it} />)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 8.5, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700, color: T.red }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.red }} /> A Pagar
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
            {sai.map(it => <Card key={it.lbl} {...it} />)}
          </div>
        </div>
      </div>
    </div>
  );

  const Secao = ({ id, titulo, overview, children }) => {
    const on = aberto === id;
    return (
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, marginBottom: 12, overflow: "hidden" }}>
        <button
          onClick={() => toggle(id)}
          style={{
            width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 16px", background: on ? T.bgSoft : "transparent",
            border: "none", cursor: "pointer", color: T.ink, textAlign: "left",
          }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: on ? T.gold : T.ink }}>
            {titulo}
          </span>
          <ChevronDown size={18} style={{ color: on ? T.gold : T.muted, transform: on ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </button>
        {overview}
        {on && (
          <div style={{ padding: "0 16px 16px", overflowX: "auto" }}>
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fade-up py-6 px-3 sm:px-6">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: ".2em", color: T.faint, textTransform: "uppercase", fontWeight: 600 }}>
          Finanças
        </div>
        <h1 style={{ fontFamily: T.serif, fontSize: 30, fontWeight: 300, letterSpacing: "-.02em", marginTop: 6 }}>
          Centro de <em style={{ color: T.gold, fontStyle: "italic" }}>controle.</em>
        </h1>
        <p style={{ fontSize: 12, color: T.muted, marginTop: 6, fontStyle: "italic" }}>
          Toque numa seção para abrir os detalhes.
        </p>
      </div>

      {/* Módulos — visão geral sempre visível; detalhe abre ao clicar */}
      <div style={{ marginTop: 4 }}>
        <Secao
          id="areceber"
          titulo="A Receber & Dívidas"
          overview={
            <VisaoGeralGrupos
              legenda="Visão geral · todos os meses"
              entra={[
                { lbl: "Total a receber", v: resumoReceber.aReceber, cor: T.green, hint: "tudo em aberto" },
                { lbl: "A receber do mês", v: resumoReceber.pendente, cor: T.gold, hint: "vence este mês" },
              ]}
              sai={[
                { lbl: "Total a pagar", v: resumoPagar.total, cor: T.red, hint: "tudo em aberto" },
                { lbl: "A pagar do mês", v: resumoPagar.pagarMes, cor: T.yellow, hint: "vence este mês" },
                { lbl: "Cartões a pagar", v: resumoPagar.cartoes, cor: T.blue, hint: "parcelas em aberto" },
              ]}
            />
          }
        >
          <AReceberEDividas {...props} embed />
        </Secao>

        <Secao
          id="fixas"
          titulo="Despesas Fixas"
          overview={
            <VisaoGeral
              legenda="Visão geral · mês"
              itens={[
                { lbl: "Já pago", v: resumoFixas.pago, cor: T.green },
                { lbl: "Pendente", v: resumoFixas.pendente, cor: T.gold },
                { lbl: "Atrasado", v: resumoFixas.atrasado, cor: T.red },
                { lbl: "Total previsto", v: resumoFixas.total, cor: T.ink },
              ]}
            />
          }
        >
          <DespesasFixas {...props} embed />
        </Secao>

        <Secao id="cheques" titulo="Cheques">
          <Cheques cheques={props.cheques} setCheques={props.setCheques}
                   contas={props.contas} setContas={props.setContas}
                   transacoes={props.transacoes} setTransacoes={props.setTransacoes}
                   escopoAtivo={props.escopoAtivo} hidden={props.hidden} embed />
        </Secao>

        <Secao id="analise-gastos" titulo="Análise de gastos">
          <AnaliseGastos transacoes={props.transacoes} contas={props.contas}
                         categorias={props.categorias} fixas={props.fixas}
                         fixaOcorrencias={props.fixaOcorrencias} dividas={props.dividas}
                         parcelamentos={props.parcelamentos} devedores={props.devedores}
                         cheques={props.cheques} onVerCategoria={props.onVerCategoria}
                         escopoAtivo={props.escopoAtivo} hidden={props.hidden} />
        </Secao>
      </div>
    </div>
  );
}
