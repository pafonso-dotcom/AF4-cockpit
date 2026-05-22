import React, { useMemo } from "react";
import { fmt } from "../../../lib/format.js";
import { calcularKPIs, diasEmEstoque } from "../../../lib/lojaCarros.js";
import { chequesProximos, chequesVencidos } from "../../../lib/loja-types.js";

/**
 * Painel da Loja AF4 · estilo demo v3.
 */
export default function LojaPainel({ veiculos, vendas, leads, cheques, hidden }) {
  const kpis = useMemo(() => calcularKPIs(veiculos, vendas), [veiculos, vendas]);
  const hoje = new Date();
  const mes = hoje.toISOString().slice(0, 7);

  const vendasMes = vendas.filter(v => v.status !== "cancelada" && (v.data || "").startsWith(mes));
  const faturamentoMes = vendasMes.reduce((s, v) => s + Number(v.valorVenda || 0), 0);
  const lucroMes = vendasMes.reduce((s, v) => s + Number(v.margem?.absoluta || v.lucroLiquido || 0), 0);
  const margemMes = faturamentoMes > 0 ? (lucroMes / faturamentoMes) * 100 : 0;
  const ticketMedio = vendasMes.length > 0 ? faturamentoMes / vendasMes.length : 0;

  const disponiveis = veiculos.filter(v => v.status === "estoque" || v.status === "DISPONIVEL");
  const reservados = veiculos.filter(v => v.status === "reservado" || v.status === "RESERVADO");
  const capitalEstoque = disponiveis.concat(reservados).reduce((s, v) => s + Number(v.valorCompra || 0), 0);

  const tempoMedio = disponiveis.length > 0
    ? Math.round(disponiveis.reduce((s, v) => s + diasEmEstoque(v), 0) / disponiveis.length)
    : 0;

  const leadsAtivos = (leads || []).filter(l => l.estagio !== "fechado" && l.estagio !== "perdido");
  const leadsHot = (leads || []).filter(l => l.estagio === "negociacao" || l.estagio === "aprov");

  const chProx = chequesProximos(cheques || [], 7, hoje);
  const chVenc = chequesVencidos(cheques || [], hoje);
  const valorChProx = chProx.reduce((s, c) => s + Number(c.valor || 0), 0);

  const ultimasVendas = [...vendas].sort((a, b) => (b.data || "").localeCompare(a.data || "")).slice(0, 5);

  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="eb">Loja AF4 · Painel</div>
      <h1 className="h1">Sua loja, <em>em tempo real.</em></h1>
      <p className="hs">Estoque, vendas, leads e cheques num só lugar. Tudo conectado.</p>

      {/* Highlight metrics */}
      <div className="hm">
        <div className="hc">
          <div className="hl">Faturamento (mês)</div>
          <div className="hv"><span className="cy">R$</span>{hidden ? "•••" : fmt(faturamentoMes).replace("R$", "").trim()}</div>
          <div className="dl">{vendasMes.length} venda(s)</div>
        </div>
        <div className="hc">
          <div className="hl">Lucro líquido</div>
          <div className="hv"><span className="cy">R$</span>{hidden ? "•••" : fmt(lucroMes).replace("R$", "").trim()}</div>
          <div className={`dl ${lucroMes < 0 ? "neg" : ""}`}>{margemMes.toFixed(1)}% margem</div>
        </div>
        <div className="hc">
          <div className="hl">Ticket médio</div>
          <div className="hv"><span className="cy">R$</span>{hidden ? "•••" : fmt(ticketMedio).replace("R$", "").trim()}</div>
          <div className="dl">{disponiveis.length + reservados.length} no estoque</div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="st"><h2>Visão Geral</h2><div className="mt">Tempo real</div></div>
      <div className="kg">
        <div className="k">
          <div className="kh">
            <div className="kl">Em estoque</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 17V7l3-4h12l3 4v10"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
          </div>
          <div className="kv">{disponiveis.length}</div>
          <div className="ku">Disponíveis · {reservados.length} reservados</div>
        </div>
        <div className="k">
          <div className="kh">
            <div className="kl">Capital parado</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="kv">{hidden ? "•••" : fmt(capitalEstoque)}</div>
          <div className="ku">Valor de compra</div>
        </div>
        <div className="k">
          <div className="kh">
            <div className="kl">Tempo médio</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          </div>
          <div className="kv">{tempoMedio}d</div>
          <div className={`ku ${tempoMedio > 60 ? "neg" : "pos"}`}>Meta: 45d {tempoMedio <= 45 ? "✓" : ""}</div>
        </div>
        <div className="k">
          <div className="kh">
            <div className="kl">Cheques pendentes</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/></svg>
          </div>
          <div className="kv">{hidden ? "•••" : fmt(valorChProx)}</div>
          <div className="ku">{chProx.length} próximos · {chVenc.length} vencidos</div>
        </div>
      </div>

      {/* Alerta */}
      {leadsHot.length > 0 && (
        <div className="ar">
          <div className="ai">🎯</div>
          <div className="at">
            <strong>{leadsHot.length} lead(s) em negociação avançada</strong>
            <p>{leadsHot.slice(0, 3).map(l => l.nome).join(" · ")}. Follow-up recomendado nas próximas 48h.</p>
          </div>
        </div>
      )}

      {/* Últimas vendas */}
      <div className="st"><h2>Últimas Vendas</h2></div>
      <div className="pn">
        {ultimasVendas.length === 0 ? (
          <div className="empty-state">
            <div className="ic">📭</div>
            Nenhuma venda registrada ainda.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th><th>Data</th><th>Veículo</th><th>Cliente</th>
                <th style={{ textAlign: "right" }}>Valor</th>
                <th style={{ textAlign: "right" }}>Lucro</th>
              </tr>
            </thead>
            <tbody>
              {ultimasVendas.map((v, i) => (
                <tr key={v.id || i}>
                  <td><strong>#{v.numero || `${1000 + i}`}</strong></td>
                  <td>{v.data}</td>
                  <td>{v.veiculoDesc || v.veiculoNome || "—"}</td>
                  <td>{v.clienteNome || "—"}</td>
                  <td style={{ textAlign: "right" }}>{hidden ? "•••" : fmt(v.valorVenda)}</td>
                  <td style={{ textAlign: "right" }} className={(v.lucroLiquido || 0) >= 0 ? "pos" : "neg"}>
                    {hidden ? "•••" : `${(v.lucroLiquido || 0) >= 0 ? "+ " : ""}${fmt(v.lucroLiquido || 0)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
