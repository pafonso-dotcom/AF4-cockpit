import React, { useState, useMemo } from "react";
import { resumoAPagar } from "../../../lib/aPagar.js";
import { ChevronDown } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, fmtAbrev } from "../../../lib/format.js";
import { useFluxoMes } from "../PainelNovo.jsx";
import Letreiro, { LetRotulo, LetValor } from "../../ui/Letreiro.jsx";
import AReceberEDividas from "../AReceberEDividas.jsx";
import DespesasFixas from "../DespesasFixas.jsx";
import Emprestimos from "../Emprestimos.jsx";
import Metas from "../Metas.jsx";
import Cheques from "../Cheques.jsx";
import ReservaEmergenciaView from "./ReservaEmergenciaView.jsx";
import SimuladorCompra from "./SimuladorCompra.jsx";
import FluxoCaixa from "./FluxoCaixa.jsx";
import { somaContasBRL } from "../../../lib/cambio.js";

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

  // A Pagar — FONTE ÚNICA (lib/aPagar.js): mesma conta do Patrimônio/Painel.
  // (Unificação 2026-09-30: cada tela calculava do seu jeito e divergiam.)
  const resumoPagar = useMemo(
    () => {
      const r = resumoAPagar({ dividas, fixas, fixaOcorrencias, parcelamentos, transacoes });
      return { total: r.total, pagarMes: r.pagarMes, cartoes: r.cartoes, prox7: r.prox7 };
    },
    [dividas, fixas, fixaOcorrencias, parcelamentos, transacoes]
  );

  // Cobertura do mês: saldo real das contas vs o que vence no mês.
  const cobertura = useMemo(() => {
    const saldo = somaContasBRL(props.contas || []);
    const aPagarMes = resumoPagar.pagarMes;
    const pct = aPagarMes > 0 ? (saldo / aPagarMes) * 100 : null;
    return { saldo, aPagarMes, pct };
  }, [props.contas, resumoPagar.pagarMes]);

  // Despesas Fixas · mês: já pago / pendente / atrasado / total previsto.
  // Fluxo do mês (mesmos números do card do Painel), agora em letreiro.
  const fluxo = useFluxoMes(
    useMemo(() => ({ transacoes: props.transacoes, contas: props.contas, fixas: props.fixas, fixaOcorrencias: props.fixaOcorrencias,
      parcelamentos: props.parcelamentos, dividas: props.dividas, devedores: props.devedores, cartoes: props.cartoes, cheques: props.cheques }),
      [props.transacoes, props.contas, props.fixas, props.fixaOcorrencias, props.parcelamentos, props.dividas, props.devedores, props.cartoes, props.cheques]),
    props.escopoAtivo || "tudo");
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

  return (
    <div className="fade-up py-6 px-3 sm:px-6">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: ".2em", color: T.faint, textTransform: "uppercase", fontWeight: 600 }}>
          Finanças
        </div>
        <h1 style={{ fontFamily: T.serif, fontSize: 30, fontWeight: 300, letterSpacing: "-.02em", marginTop: 6 }}>
          Planejamento<em style={{ color: T.gold, fontStyle: "italic" }}>.</em>
        </h1>
        <p style={{ fontSize: 12, color: T.muted, marginTop: 6, fontStyle: "italic" }}>
          Toque numa seção para abrir os detalhes.
        </p>
      </div>

      {/* Números do mês + Fluxo do mês em letreiro (pedido 2026-10-01: no
          lugar dos quadradinhos e do card Fluxo do mês). */}
      {(() => {
        const pct = cobertura.pct;
        const corCob = pct == null ? T.muted : pct >= 100 ? T.green : pct >= 60 ? T.gold : T.red;
        const p7 = resumoPagar.prox7;
        const v = (x) => hidden ? "•••" : fmt(x);
        const caixa = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "0 4px", marginBottom: 10 };
        return (<>
          <div className="card-vivo" style={caixa}>
            <Letreiro itens={[
              { chave: "cob", conteudo: (<>
                <LetRotulo>🛡 Cobertura do mês</LetRotulo>
                <LetValor cor={corCob}>{pct == null ? "—" : `${Math.min(999, Math.round(pct))}%`}</LetValor>
                {pct != null && pct < 100 && <span style={{ fontSize: 11.5, color: T.red }}>faltam {v(cobertura.aPagarMes - cobertura.saldo)}</span>}
              </>) },
              { chave: "pagar", onClick: () => setAberto("areceber"), conteudo: (<><LetRotulo>📤 A pagar no mês</LetRotulo><LetValor cor={resumoPagar.pagarMes > 0 ? T.red : T.muted}>{v(resumoPagar.pagarMes)}</LetValor></>) },
              { chave: "receber", onClick: () => setAberto("areceber"), conteudo: (<>
                <LetRotulo>📥 A receber no mês</LetRotulo><LetValor cor={T.green}>{v(resumoReceber.pendente)}</LetValor>
                {resumoReceber.atrasado > 0 && <span style={{ fontSize: 11.5, color: T.red }}>{v(resumoReceber.atrasado)} atrasado</span>}
              </>) },
              { chave: "p7", conteudo: (<>
                <LetRotulo>⏰ Próximos 7 dias</LetRotulo><LetValor cor={p7.total > 0 ? T.gold : T.muted}>{v(p7.total)}</LetValor>
                {p7.count > 0 && <span style={{ fontSize: 11.5, color: T.muted }}>{p7.count} vencimento{p7.count === 1 ? "" : "s"}</span>}
              </>) },
            ]} />
          </div>
          {fluxo && (
            <div className="card-vivo" style={{ ...caixa, marginBottom: 14 }}>
              <Letreiro segPorItem={6} itens={[
                { chave: "titulo", onClick: () => setAberto("fluxocaixa"), conteudo: <LetRotulo cor={T.gold}>📈 Fluxo do mês</LetRotulo> },
                { chave: "hoje", conteudo: (<><LetRotulo>Hoje</LetRotulo><LetValor>{v(fluxo.inicial)}</LetValor></>) },
                { chave: "ent", conteudo: (<><LetRotulo>Entradas</LetRotulo><LetValor cor={T.green}>{v(fluxo.entradas)}</LetValor></>) },
                { chave: "sai", conteudo: (<><LetRotulo>Saídas</LetRotulo><LetValor cor={T.red}>{v(fluxo.saidas)}</LetValor></>) },
                { chave: "fim", conteudo: (<><LetRotulo>Fim do mês</LetRotulo><LetValor cor={fluxo.final < 0 ? T.red : T.ink}>{v(fluxo.final)}</LetValor></>) },
                { chave: "menor", conteudo: (<>
                  <LetRotulo>Menor saldo</LetRotulo><LetValor cor={fluxo.menor.saldo < 0 ? T.red : T.ink}>{v(fluxo.menor.saldo)}</LetValor>
                  <span style={{ fontSize: 11.5, color: T.muted }}>dia {Number(fluxo.menor.dia.slice(8, 10))}</span>
                </>) },
              ]} />
            </div>
          )}
        </>);
      })()}

      {/* Módulos — visão geral sempre visível; detalhe abre ao clicar */}
      <div style={{ marginTop: 4 }}>
        <Secao
          on={aberto === "areceber"} onToggle={() => toggle("areceber")}
          titulo="🤝 A Receber & Dívidas"
          overview={
            <VisaoGeralGrupos
              hidden={hidden}
              entra={[
                { lbl: "Total a receber", v: resumoReceber.aReceber, cor: T.green },
                { lbl: "A receber do mês", v: resumoReceber.pendente, cor: T.gold },
              ]}
              sai={[
                { lbl: "Total a pagar", v: resumoPagar.total, cor: T.red },
                { lbl: "A pagar do mês", v: resumoPagar.pagarMes, cor: T.yellow },
                { lbl: "Cartões a pagar", v: resumoPagar.cartoes, cor: T.blue },
              ]}
            />
          }
        >
          <AReceberEDividas {...props} embed />
        </Secao>

        <Secao
          on={aberto === "fixas"} onToggle={() => toggle("fixas")}
          titulo="🔁 Despesas Fixas"
          overview={
            <VisaoGeral
              hidden={hidden}
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

        {/* Empréstimos MUDOU DE CASA (reorganização 2026-09-29): era aba
            própria de Finanças, mas é leitura dos mesmos devedores daqui. */}
        <Secao on={aberto === "emprestimos"} onToggle={() => toggle("emprestimos")} titulo="💸 Empréstimos">
          <Emprestimos devedores={props.devedores} hidden={props.hidden}
                       onTabChange={props.onTabChange} embed />
        </Secao>

        <Secao on={aberto === "cheques"} onToggle={() => toggle("cheques")} titulo="🧾 Cheques">
          <Cheques cheques={props.cheques} setCheques={props.setCheques}
                   contas={props.contas} setContas={props.setContas}
                   transacoes={props.transacoes} setTransacoes={props.setTransacoes}
                   escopoAtivo={props.escopoAtivo} hidden={props.hidden} embed />
        </Secao>

        {/* Análise de gastos MUDOU DE CASA (unificação 2026-09-22): agora é a
            tela única "Análise do mês" em Análises & Relatórios — aqui fica só
            o atalho, pra não duplicar a mesma informação em dois lugares. */}
        {props.onTabChange && (
          <button onClick={() => props.onTabChange("relatorios-f")}
                  style={{
                    width: "100%", textAlign: "left", cursor: "pointer",
                    background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.gold}`,
                    borderRadius: 16, padding: "13px 16px", marginBottom: 12,
                    display: "flex", alignItems: "center", gap: 10, color: T.ink,
                  }}>
            <span style={{ fontSize: 15 }}>📊</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>Análise de gastos → Análise do mês</span>
              <span style={{ display: "block", fontSize: 11, color: T.faint, marginTop: 1 }}>
                Categorias com comparação, leitura do consultor e PDF — tudo numa tela só, em Análises &amp; Relatórios.
              </span>
            </span>
            <span style={{ color: T.gold, fontSize: 13, flexShrink: 0 }}>abrir →</span>
          </button>
        )}

        {/* 💵 Fluxo de caixa — projeção DIÁRIA do caixa (2026-09-28):
            linha do saldo + extrato do futuro, com aviso de caixa furando. */}
        <Secao on={aberto === "fluxocaixa"} onToggle={() => toggle("fluxocaixa")} titulo="💵 Fluxo de caixa">
          <FluxoCaixa
            transacoes={props.transacoes} contas={props.contas}
            fixas={props.fixas} fixaOcorrencias={props.fixaOcorrencias}
            parcelamentos={props.parcelamentos} dividas={props.dividas}
            devedores={props.devedores} cartoes={props.cartoes} cheques={props.cheques}
            escopoAtivo={props.escopoAtivo} hidden={props.hidden} />
        </Secao>

        {/* 🛒 Simulador de compra — "E se eu comprar X em 4x?" (2026-09-25).
            SÓ VISUAL: projeta o saldo com/sem a compra, nada é lançado. */}
        <Secao on={aberto === "simulador"} onToggle={() => toggle("simulador")} titulo="🛒 Simulador de compra">
          <SimuladorCompra
            transacoes={props.transacoes} contas={props.contas}
            fixas={props.fixas} fixaOcorrencias={props.fixaOcorrencias}
            parcelamentos={props.parcelamentos} dividas={props.dividas}
            devedores={props.devedores} cartoes={props.cartoes} cheques={props.cheques}
            escopoAtivo={props.escopoAtivo} hidden={props.hidden} />
        </Secao>

        {/* Reserva de emergência — tela completa que existia órfã no código
            (auditoria 2026-09-18) e voltou como 5ª seção do Centro. */}
        {/* Metas MUDOU DE CASA (reorganização 2026-09-29): morava na Agenda,
            mas é 100% financeira — vive junto do planejamento. */}
        <Secao on={aberto === "metas"} onToggle={() => toggle("metas")} titulo="🎯 Metas">
          <Metas embed metas={props.metas} setMetas={props.setMetas} hidden={props.hidden}
                 fixas={props.fixas} setFixas={props.setFixas}
                 fixaOcorrencias={props.fixaOcorrencias} setFixaOcorrencias={props.setFixaOcorrencias}
                 categorias={props.categorias} contas={props.contas} setContas={props.setContas}
                 transacoes={props.transacoes} setTransacoes={props.setTransacoes}
                 ativos={props.ativos} setAtivos={props.setAtivos} />
        </Secao>

        <Secao on={aberto === "reserva"} onToggle={() => toggle("reserva")} titulo="🛟 Reserva de emergência">
          <ReservaEmergenciaView
            transacoes={props.transacoes} contas={props.contas}
            metas={props.metas} setMetas={props.setMetas}
            hidden={props.hidden} />
        </Secao>
      </div>
    </div>
  );
}

/* ============================================================
   Sub-componentes ESTÁVEIS (escopo do módulo).
   IMPORTANTE: antes eram definidos dentro do render — a cada mudança de estado
   o React via um "componente novo" e REMONTAVA a seção inteira (a tela voltava
   pro topo e estados internos zeravam ao salvar uma edição). Aqui fora a
   identidade é estável e a tela permanece exatamente onde estava.
   ============================================================ */

// Mini visão geral (4 números) — aparece com a seção aberta.
function VisaoGeral({ itens, hidden }) {
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
        {itens.map(it => <CardVG key={it.lbl} lbl={it.lbl} v={it.v} cor={it.cor} hidden={hidden} />)}
      </div>
    </div>
  );
}

// Card de valor (remodelado 2026-10-01): nome pequeno + valor, sem texto extra.
function CardVG({ lbl, v, cor, hidden }) {
  return (
    <div style={{ background: T.bgSoft, borderRadius: 14, padding: "11px 13px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.muted, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: cor, flexShrink: 0 }} />{lbl}
      </div>
      <div className="num" style={{ fontSize: 17, fontWeight: 700, color: cor, marginTop: 6, whiteSpace: "nowrap", letterSpacing: "-.01em" }}>
        {hidden ? "•••" : fmt(v)}
      </div>
    </div>
  );
}

// Visão geral em DOIS grupos — usada na seção "A Receber & Dívidas".
function VisaoGeralGrupos({ entra, sai, hidden }) {
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, padding: "12px 16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,3fr)", gap: 14, alignItems: "stretch" }} className="vg-grupos">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700, color: T.green }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.green }} /> A Receber
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 8 }}>
            {entra.map(it => <CardVG key={it.lbl} {...it} hidden={hidden} />)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 700, color: T.red }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.red }} /> A Pagar
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 8 }}>
            {sai.map(it => <CardVG key={it.lbl} {...it} hidden={hidden} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Secao({ on, onToggle, titulo, overview, children }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, marginBottom: 12, overflow: "hidden" }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "14px 16px", background: on ? T.bgSoft : "transparent",
          border: "none", cursor: "pointer", color: T.ink, textAlign: "left",
        }}>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: on ? T.gold : T.ink }}>{titulo}</span>
        </span>
        <ChevronDown size={18} style={{ color: on ? T.gold : T.muted, transform: on ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }} />
      </button>
      {on && overview}
      {on && (
        <div style={{ padding: "0 16px 16px", overflowX: "auto" }}>
          {children}
        </div>
      )}
    </div>
  );
}
