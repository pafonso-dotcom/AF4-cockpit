import React, { useMemo } from "react";
import { Store, Car, Wrench, Users, TrendingUp, Package } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import PageHeader from "../../ui/PageHeader.jsx";

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
  hidden,
  onTabChange,
}) {
  const stats = useMemo(() => {
    const hoje = new Date();
    const mesISO = hoje.toISOString().slice(0, 7);

    const veiculosEstoque = negocioVeiculos.filter(v => !v.vendido).length;
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
      veiculosVendidosMes: vendasMes.length,
      servicosCatalogo: (negocioServicos || []).length,
      servicosVendidosMes: servVendasMes.length,
      clientes: (negocioClientes || []).length,
      receita, custo, lucro,
      pctMargem: receita > 0 ? (lucro / receita) * 100 : 0,
    };
  }, [negocioVeiculos, negocioVendasVeiculos, negocioServicos, negocioVendasServicos, negocioClientes]);

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Negócio · Painel"
        title="Visão geral"
        sub="Resumo do que está rolando hoje no seu negócio: estoque, vendas, lucro e atalhos pras áreas."
      />

      {/* Cards de resumo do mês */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-6" style={{ background: T.border }}>
        <KpiCard label="Receita do mês" valor={hidden ? "•••••" : fmt(stats.receita)} cor={T.gold} icon={TrendingUp} />
        <KpiCard label="Custo do mês" valor={hidden ? "•••••" : fmt(stats.custo)} cor={T.muted} />
        <KpiCard label="Lucro do mês"
                 valor={hidden ? "•••••" : fmt(stats.lucro)}
                 sub={`${stats.pctMargem.toFixed(1)}% margem`}
                 cor={stats.lucro >= 0 ? T.green : T.red} />
        <KpiCard label="Veículos em estoque" valor={String(stats.veiculosEstoque)} cor={T.blue || "#60a5fa"} icon={Package} />
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
