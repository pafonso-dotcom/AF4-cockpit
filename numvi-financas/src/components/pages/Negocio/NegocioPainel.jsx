import React, { useMemo, useState } from "react";
import { Store, Car, Wrench, Users, TrendingUp, Package, DollarSign } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import PageHeader from "../../ui/PageHeader.jsx";
import Modal from "../../ui/Modal.jsx";

/**
 * Painel · visão geral do módulo Negócio.
 *
 * Mostra cards-resumo das 4 áreas (veículos, serviços, clientes,
 * resultado do mês) com totais derivados dos states. Atalhos pra cada
 * sub-aba via onTabChange.
 */
export default function NegocioPainel({
  negocioVeiculos = [], negocioVendasVeiculos = [],
  negocioServicos = [], negocioVendasServicos = [],
  negocioClientes = [],
  caixaNegocio = { saldo: 0, historico: [] },
  hidden,
  onTabChange,
}) {
  const [caixaModalAberto, setCaixaModalAberto] = useState(false);
  const stats = useMemo(() => {
    const hoje = new Date();
    const mesISO = hoje.toISOString().slice(0, 7);

    const veiculosEmEstoque = negocioVeiculos.filter(v => !v.vendido);
    const veiculosEstoque = veiculosEmEstoque.length;
    // Valor investido em estoque: custo de entrada + custos extras de cada veículo
    const valorEstoque = veiculosEmEstoque.reduce((s, v) =>
      s + Number(v.custoEntrada || 0)
        + ((v.custosExtra || []).reduce((s2, c) => s2 + Number(c.valor || 0), 0)),
      0);
    const vendasMes = (negocioVendasVeiculos || []).filter(v => (v.data || "").startsWith(mesISO));
    const servVendasMes = (negocioVendasServicos || []).filter(v => (v.data || "").startsWith(mesISO));

    const receitaVeic = vendasMes.reduce((s, v) => s + Number(v.valorVenda || 0), 0);
    const custoVeic = vendasMes.reduce((s, v) => s + Number(v.custoTotal || 0), 0);
    const receitaServ = servVendasMes.reduce((s, v) => s + Number(v.valor || 0), 0);
    const custoServ = servVendasMes.reduce((s, v) => s + Number(v.custo || 0), 0);

    const receita = receitaVeic + receitaServ;
    const custo = custoVeic + custoServ;
    const lucro = receita - custo;

    return {
      veiculosEstoque,
      valorEstoque,
      veiculosVendidosMes: vendasMes.length,
      servicosCatalogo: (negocioServicos || []).length,
      servicosVendidosMes: servVendasMes.length,
      clientes: (negocioClientes || []).length,
      receita, custo, lucro,
      pctMargem: receita > 0 ? (lucro / receita) * 100 : 0,
    };
  }, [negocioVeiculos, negocioVendasVeiculos, negocioServicos, negocioVendasServicos, negocioClientes]);

  const saldoCaixa = Number(caixaNegocio?.saldo || 0);
  const historico = caixaNegocio?.historico || [];
  const qtdEntradas = historico.length;

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Negócio · Painel"
        title="Visão geral"
        sub="Resumo do que está rolando hoje no seu negócio: estoque, vendas, lucro e atalhos pras áreas."
      />

      {/* Cards destaque lado a lado: Caixa do Negócio · Valor em estoque */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ marginBottom: 14 }}>
        <button
          onClick={() => setCaixaModalAberto(true)}
          style={{
            width: "100%", textAlign: "left", cursor: "pointer",
            background: T.card, border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${T.gold}`, borderRadius: 8, padding: 16,
            display: "flex", alignItems: "center", gap: 14,
          }}>
          <span style={{
            width: 44, height: 44, borderRadius: 10,
            background: `${T.gold}22`, color: T.gold,
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <DollarSign size={22} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted }}>
              Caixa do Negócio
            </div>
            <div style={{ fontFamily: T.serif, fontSize: 24, fontWeight: 500, color: T.gold, fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
              {hidden ? "•••••" : fmt(saldoCaixa)}
            </div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>
              {qtdEntradas} {qtdEntradas === 1 ? "movimentação" : "movimentações"} · clique pra ver histórico
            </div>
          </div>
        </button>

        <div style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderLeft: `3px solid ${T.blue || "#60a5fa"}`, borderRadius: 8, padding: 16,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <span style={{
            width: 44, height: 44, borderRadius: 10,
            background: `${T.blue || "#60a5fa"}22`, color: T.blue || "#60a5fa",
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <Package size={22} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted }}>
              Valor em estoque (carros)
            </div>
            <div style={{ fontFamily: T.serif, fontSize: 24, fontWeight: 500, color: T.blue || "#60a5fa", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
              {hidden ? "•••••" : fmt(stats.valorEstoque)}
            </div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>
              {stats.veiculosEstoque} {stats.veiculosEstoque === 1 ? "veículo" : "veículos"} · custo + extras
            </div>
          </div>
        </div>
      </div>

      {/* Cards de resumo do mês */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-6" style={{ background: T.border }}>
        <KpiCard label="Receita do mês" valor={hidden ? "•••••" : fmt(stats.receita)} cor={T.gold} icon={TrendingUp} />
        <KpiCard label="Custo do mês" valor={hidden ? "•••••" : fmt(stats.custo)} cor={T.muted} />
        <KpiCard label="Lucro do mês"
                 valor={hidden ? "•••••" : fmt(stats.lucro)}
                 sub={`${stats.pctMargem.toFixed(1)}% margem`}
                 cor={stats.lucro >= 0 ? T.green : T.red} />
        <KpiCard label="Veículos em estoque"
                 valor={String(stats.veiculosEstoque)}
                 cor={T.blue || "#60a5fa"} icon={Package} />
      </div>

      {/* Atalhos pras áreas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Atalho icon={Car} label="Veículos" sub={`${stats.veiculosEstoque} em estoque · ${stats.veiculosVendidosMes} vendidos este mês`}
                onClick={() => onTabChange?.("negocio-veiculos")} cor={T.gold} />
        <Atalho icon={Wrench} label="Serviços" sub={`${stats.servicosCatalogo} no catálogo · ${stats.servicosVendidosMes} vendidos este mês`}
                onClick={() => onTabChange?.("negocio-servicos")} cor={T.green} />
        <Atalho icon={Users} label="Clientes" sub={`${stats.clientes} cadastrados`}
                onClick={() => onTabChange?.("negocio-clientes")} cor={T.blue || "#60a5fa"} />
      </div>

      {/* Modal: histórico da Caixa do Negócio */}
      {caixaModalAberto && (
        <Modal title="Caixa do Negócio · histórico" onClose={() => setCaixaModalAberto(false)}>
          <div style={{
            padding: 12, marginBottom: 14, borderRadius: 6,
            background: `${T.gold}11`, border: `1px solid ${T.gold}33`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted }}>
                Saldo atual
              </div>
              <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 500, color: T.gold, fontVariantNumeric: "tabular-nums" }}>
                {hidden ? "•••••" : fmt(saldoCaixa)}
              </div>
            </div>
            <DollarSign size={28} style={{ color: T.gold, opacity: 0.55 }} />
          </div>
          {historico.length === 0 ? (
            <div style={{
              padding: 28, fontSize: 12, color: T.faint, fontStyle: "italic", textAlign: "center",
              background: T.bgSoft, borderRadius: 6,
            }}>
              Nenhuma movimentação ainda. Vendas de veículos, serviços e faturas recorrentes vão aparecer aqui.
            </div>
          ) : (
            <div>
              <div className="label-eyebrow" style={{ marginBottom: 8 }}>
                Últimas {Math.min(historico.length, 10)} movimentações
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                {historico.slice(0, 10).map(h => (
                  <div key={h.id} style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: 10, alignItems: "center", padding: "8px 10px",
                    background: T.bgSoft, borderRadius: 5,
                  }}>
                    <span style={{ color: T.faint, fontFamily: T.mono, fontSize: 10.5 }}>
                      {(h.data || "").split("-").reverse().slice(0, 2).join("/")}
                    </span>
                    <span style={{ fontSize: 12, color: T.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {h.descricao}
                    </span>
                    <span className="num" style={{ fontSize: 12, color: T.gold, fontWeight: 600 }}>
                      +{hidden ? "•••" : fmt(h.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function KpiCard({ label, valor, sub, cor, icon: Icon }) {
  return (
    <div style={{ background: T.card, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted }}>
          {label}
        </div>
        {Icon && <Icon size={14} style={{ color: cor || T.gold, opacity: 0.7 }} />}
      </div>
      <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 500, color: cor || T.ink, fontVariantNumeric: "tabular-nums" }}>
        {valor}
      </div>
      {sub && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Atalho({ icon: Icon, label, sub, cor, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${cor}`,
      borderRadius: 8, padding: 16, cursor: "pointer",
      textAlign: "left", display: "flex", gap: 12, alignItems: "center",
      transition: "border-color .15s",
    }}>
      <span style={{
        width: 36, height: 36, borderRadius: 8,
        background: `${cor}22`, color: cor,
        display: "grid", placeItems: "center", flexShrink: 0,
      }}>
        <Icon size={18} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{label}</div>
        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  );
}
