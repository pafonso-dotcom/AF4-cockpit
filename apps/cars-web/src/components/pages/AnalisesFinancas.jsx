import React, { useState } from "react";
import { ChevronDown, BarChart3, Brain, History, CalendarDays } from "lucide-react";
import { T } from "../../lib/theme.js";
import PageHeader from "../ui/PageHeader.jsx";
import RelatorioMensal from "./RelatorioMensal.jsx";
import RelatoriosFinancas from "./RelatoriosFinancas.jsx";
import Inteligencia from "./Inteligencia.jsx";
import AuditLog from "./AuditLog.jsx";

const KEY = "af4:analises-hub:abertos:v1";
const ler = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || '["relatorio-mensal"]')); } catch { return new Set(["relatorio-mensal"]); } };

/**
 * Hub "Análises & Relatórios" — junta Relatório de gastos, Relatórios,
 * Inteligência e Histórico de alterações num módulo só, em seções recolhíveis
 * (acordeão), pra a tela não ficar gigante. Cada seção abre/fecha independente;
 * o estado fica salvo.
 */
export default function AnalisesFinancas(props) {
  const [abertos, setAbertos] = useState(ler);

  const toggle = (id) => setAbertos((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    try { localStorage.setItem(KEY, JSON.stringify([...n])); } catch {}
    return n;
  });

  const Secao = ({ id, icon: Icon, titulo, desc, children }) => {
    const on = abertos.has(id);
    return (
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, marginBottom: 12, overflow: "hidden" }}>
        <button onClick={() => toggle(id)}
          style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                   padding: "14px 16px", background: on ? T.bgSoft : "transparent", border: "none", cursor: "pointer", textAlign: "left", color: T.ink }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <Icon size={17} style={{ color: on ? T.gold : T.muted, flexShrink: 0 }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 700, letterSpacing: ".02em", color: on ? T.gold : T.ink }}>{titulo}</span>
              <span style={{ display: "block", fontSize: 11.5, color: T.faint, marginTop: 1 }}>{desc}</span>
            </span>
          </span>
          <ChevronDown size={18} style={{ color: on ? T.gold : T.muted, transform: on ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }} />
        </button>
        {on && <div className="analises-sec-body" style={{ padding: "0 16px 16px" }}>{children}</div>}
      </div>
    );
  };

  return (
    <div className="fade-up py-6 px-6 analises-hub">
      {/* No mobile encolhe as laterais pro conteúdo usar quase a tela toda
          (o padding empilhava: hub + card da seção + card interno do relatório). */}
      <style>{`
        @media (max-width: 768px) {
          .analises-hub { padding-left: 8px !important; padding-right: 8px !important; }
          .analises-hub .analises-sec-body { padding-left: 4px !important; padding-right: 4px !important; }
        }
      `}</style>
      <PageHeader
        eyebrow="Finanças"
        title={<>Análises &amp; <em>Relatórios.</em></>}
        sub="Relatório de gastos, relatórios do período, inteligência e histórico de alterações num lugar só. Abra as seções conforme precisar."
      />
      <div style={{ marginTop: 8 }}>
        <Secao id="relatorio-mensal" icon={CalendarDays} titulo="Relatório mensal"
               desc="Fechamento de um mês: receitas, despesas por categoria, sobra e pagas × a pagar + aportes, vendas, proventos e variação do patrimônio. Com botão Salvar PDF.">
          <RelatorioMensal
            transacoes={props.transacoes} contas={props.contas} categorias={props.categorias}
            fixas={props.fixas} fixaOcorrencias={props.fixaOcorrencias}
            parcelamentos={props.parcelamentos} dividas={props.dividas} devedores={props.devedores}
            cheques={props.cheques} cartoes={props.cartoes}
            patrimonioHistorico={props.patrimonioHistorico}
            escopoAtivo={props.escopoAtivo} hidden={props.hidden} embed />
        </Secao>
        <Secao id="relatorios" icon={BarChart3} titulo="Relatórios"
               desc="Receita × despesa, projeção do ano, evolução de patrimônio e exportação (PDF/CSV/PNG).">
          <RelatoriosFinancas
            transacoes={props.transacoes} contas={props.contas}
            categorias={props.categorias}
            fixas={props.fixas} fixaOcorrencias={props.fixaOcorrencias}
            parcelamentos={props.parcelamentos} dividas={props.dividas} devedores={props.devedores}
            cheques={props.cheques}
            patrimonioHistorico={props.patrimonioHistorico}
            escopoAtivo={props.escopoAtivo}
            hidden={props.hidden} embed />
        </Secao>
        <Secao id="inteligencia" icon={Brain} titulo="Inteligência"
               desc="Score financeiro, insights, assinaturas, projeção de caixa e saúde da carteira.">
          <Inteligencia
            transacoes={props.transacoes} contas={props.contas} ativos={props.ativos}
            cartoes={props.cartoes} parcelamentos={props.parcelamentos} metas={props.metas}
            fixas={props.fixas}
            escopoAtivo={props.escopoAtivo} hidden={props.hidden} onTabChange={props.onTabChange} embed />
        </Secao>
        <Secao id="historico" icon={History} titulo="Histórico"
               desc="Registro de tudo que mudou no cockpit — útil pra revisar erros, auditar e debugar.">
          <AuditLog embed />
        </Secao>
      </div>
    </div>
  );
}
