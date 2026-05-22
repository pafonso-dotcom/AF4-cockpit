import React, { useState, useMemo } from "react";
import { Plus, Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { T } from "../../../lib/theme.js";
import { fmt, uid, todayISO } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import PageHeader from "../../ui/PageHeader.jsx";
import Modal from "../../ui/Modal.jsx";
import Field from "../../ui/Field.jsx";

const TIPOS_OP = [
  "Operacional", "Aluguel", "Comissão", "Combustível", "IPVA / Licenc.",
  "Manutenção", "Marketing", "Despachante", "Outros",
];

export default function BancoLoja({ vendas = [], veiculos = [], cheques = [], hidden }) {
  // Operações manuais persistidas via localStorage (entradas/saídas avulsas da loja)
  const [operacoes, setOperacoes] = useState(() => {
    try { return JSON.parse(localStorage.getItem("loja:operacoes:v1")) || []; }
    catch { return []; }
  });
  const persist = (lista) => {
    setOperacoes(lista);
    try { localStorage.setItem("loja:operacoes:v1", JSON.stringify(lista)); } catch {}
  };

  const [form, setForm] = useState(null);

  // ===== Cálculos: movimentações derivadas (vendas + compras de veículos) + operacionais =====
  const movimentacoes = useMemo(() => {
    const out = [];
    // Vendas → crédito
    vendas.forEach(v => {
      const veic = veiculos.find(x => x.id === v.veiculoId);
      out.push({
        id: `venda-${v.id}`,
        tipo: "credito",
        categoria: "Venda",
        descricao: veic ? `${veic.marca || ""} ${veic.modelo || ""}`.trim() || "Venda de veículo" : "Venda de veículo",
        sub: v.formaPagamento ? `Pagamento: ${v.formaPagamento}` : null,
        data: v.data || todayISO(),
        valor: parseFloat(v.valorVenda) || 0,
        origem: "venda",
      });
    });
    // Compras de veículos (custo de aquisição) → débito
    veiculos.forEach(vc => {
      const custoCompra = parseFloat(vc.valorCompra ?? vc.precoCompra) || 0;
      if (custoCompra > 0 && vc.dataCompra) {
        out.push({
          id: `compra-${vc.id}`,
          tipo: "debito",
          categoria: "Compra veículo",
          descricao: `${vc.marca || ""} ${vc.modelo || ""}`.trim() || "Compra veículo",
          sub: vc.fornecedor ? `Fornecedor: ${vc.fornecedor}` : null,
          data: vc.dataCompra,
          valor: custoCompra,
          origem: "compra",
        });
      }
    });
    // Operacionais manuais
    operacoes.forEach(op => {
      out.push({
        id: `op-${op.id}`,
        tipo: op.tipo,
        categoria: op.categoria,
        descricao: op.descricao,
        sub: op.fornecedor || null,
        data: op.data,
        valor: parseFloat(op.valor) || 0,
        origem: "manual",
        opId: op.id,
      });
    });
    return out.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [vendas, veiculos, operacoes]);

  // KPIs do mês corrente
  const mesAtual = todayISO().slice(0, 7);
  const kpis = useMemo(() => {
    const noMes = movimentacoes.filter(m => (m.data || "").startsWith(mesAtual));
    const entradas = noMes.filter(m => m.tipo === "credito").reduce((s, m) => s + m.valor, 0);
    const saidas = noMes.filter(m => m.tipo === "debito").reduce((s, m) => s + m.valor, 0);
    const lucro = entradas - saidas;
    return { entradas, saidas, lucro };
  }, [movimentacoes, mesAtual]);

  // Saldo operacional acumulado
  const saldoOp = useMemo(() => {
    return movimentacoes.reduce((s, m) => s + (m.tipo === "credito" ? m.valor : -m.valor), 0);
  }, [movimentacoes]);

  // ===== 3 saldos parciais =====
  const saldosParciais = useMemo(() => {
    const aguardando = (cheques || []).filter(c => c.status === "aguardando");
    const chequesAguardandoTotal = aguardando.reduce((s, c) => s + (parseFloat(c.valor) || 0), 0);
    const chequesAguardandoCount = aguardando.length;

    const emEstoque = (veiculos || []).filter(v => v.status === "estoque");
    const veiculosEstoqueTotal = emEstoque.reduce((s, v) =>
      s + (parseFloat(v.valorCompra) || parseFloat(v.precoCompra) || 0), 0);
    const veiculosEstoqueCount = emEstoque.length;

    const vendasNoMes = (vendas || []).filter(v => (v.dataVenda || v.data || "").startsWith(mesAtual));
    const vendasMesTotal = vendasNoMes.reduce((s, v) => s + (parseFloat(v.valorVenda) || 0), 0);
    const vendasMesCount = vendasNoMes.length;

    return {
      chequesAguardandoTotal, chequesAguardandoCount,
      veiculosEstoqueTotal, veiculosEstoqueCount,
      vendasMesTotal, vendasMesCount,
    };
  }, [cheques, veiculos, vendas, mesAtual]);

  // Fluxo de caixa 6 meses (barras duplas)
  const fluxo6m = useMemo(() => {
    const dados = [];
    const hoje = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const noMes = movimentacoes.filter(m => (m.data || "").startsWith(key));
      const entradas = noMes.filter(m => m.tipo === "credito").reduce((s, m) => s + m.valor, 0);
      const saidas = noMes.filter(m => m.tipo === "debito").reduce((s, m) => s + m.valor, 0);
      dados.push({ mes: meses[d.getMonth()], entradas, saidas });
    }
    return dados;
  }, [movimentacoes]);

  const save = () => {
    if (!form.descricao?.trim() || !form.valor) {
      toast.error("Descrição e valor são obrigatórios.");
      return;
    }
    if (form.id) {
      persist(operacoes.map(o => o.id === form.id ? form : o));
    } else {
      persist([{ ...form, id: uid() }, ...operacoes]);
    }
    setForm(null);
  };

  const del = (id) => {
    if (!confirm("Excluir esta operação?")) return;
    persist(operacoes.filter(o => o.id !== id));
  };

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Loja AF4 · Banco"
        title={<>Banco da <em>Loja.</em></>}
        sub="Caixa operacional · separado das suas finanças pessoais. Vendas viram crédito · compras viram débito · despesas operacionais entram manualmente."
        action={
          <button className="btn-gold" onClick={() => setForm({
            id: null, tipo: "debito", categoria: "Operacional", descricao: "",
            valor: "", data: todayISO(), fornecedor: "",
          })}>
            <Plus size={14} className="inline mr-1.5" /> Nova Operação
          </button>
        }
      />

      {/* Hero: saldo operacional */}
      <div style={{
        padding: 24, marginBottom: 18,
        background: `linear-gradient(135deg, ${T.gold}11, transparent)`,
        border: `1px solid ${T.border}`, borderRadius: 14,
      }}>
        <div className="label-eyebrow">Saldo Operacional · Loja AF4</div>
        <div className="num" style={{ fontFamily: T.serif, fontSize: 42, color: T.gold, fontWeight: 300, marginTop: 8 }}>
          {hidden ? "R$ •••••" : fmt(saldoOp)}
        </div>
        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>
          {kpis.lucro >= 0 ? "↗" : "↘"} {hidden ? "•••" : fmt(Math.abs(kpis.lucro))} no mês
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-6" style={{ background: T.border }}>
        <div style={{ background: T.card, padding: 16 }}>
          <div className="label-eyebrow">Entradas (mês)</div>
          <div className="num" style={{ fontSize: 22, color: T.green, fontWeight: 300, marginTop: 8 }}>
            {hidden ? "•••" : fmt(kpis.entradas)}
          </div>
        </div>
        <div style={{ background: T.card, padding: 16 }}>
          <div className="label-eyebrow">Saídas (mês)</div>
          <div className="num" style={{ fontSize: 22, color: T.red, fontWeight: 300, marginTop: 8 }}>
            {hidden ? "•••" : fmt(kpis.saidas)}
          </div>
        </div>
        <div style={{ background: T.card, padding: 16 }}>
          <div className="label-eyebrow">Lucro líquido</div>
          <div className="num" style={{ fontSize: 22, color: kpis.lucro >= 0 ? T.gold : T.red, fontWeight: 300, marginTop: 8 }}>
            {hidden ? "•••" : fmt(kpis.lucro)}
          </div>
        </div>
        <div style={{ background: T.card, padding: 16 }}>
          <div className="label-eyebrow">Margem</div>
          <div className="num" style={{ fontSize: 22, color: T.gold, fontWeight: 300, marginTop: 8 }}>
            {kpis.entradas > 0 ? `${((kpis.lucro / kpis.entradas) * 100).toFixed(1)}%` : "—"}
          </div>
        </div>
      </div>

      {/* ===== Saldos parciais ===== */}
      <div style={{ marginBottom: 24 }}>
        <div className="label-eyebrow" style={{ color: T.gold, marginBottom: 12 }}>★ Saldos parciais</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SaldoCard
            label="A receber · cheques"
            valor={hidden ? null : saldosParciais.chequesAguardandoTotal}
            sub={`${saldosParciais.chequesAguardandoCount} cheque${saldosParciais.chequesAguardandoCount === 1 ? "" : "s"} pendente${saldosParciais.chequesAguardandoCount === 1 ? "" : "s"}`}
            cor={T.blue || "#60a5fa"}
            icone="📥"
          />
          <SaldoCard
            label="Capital em estoque"
            valor={hidden ? null : saldosParciais.veiculosEstoqueTotal}
            sub={`${saldosParciais.veiculosEstoqueCount} veículo${saldosParciais.veiculosEstoqueCount === 1 ? "" : "s"} parado${saldosParciais.veiculosEstoqueCount === 1 ? "" : "s"}`}
            cor={T.red}
            icone="🚗"
          />
          <SaldoCard
            label="Vendas no mês"
            valor={hidden ? null : saldosParciais.vendasMesTotal}
            sub={`${saldosParciais.vendasMesCount} venda${saldosParciais.vendasMesCount === 1 ? "" : "s"} · ${mesAtual}`}
            cor={T.green}
            icone="💰"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Movimentações recentes */}
        <div className="lg:col-span-2" style={{ background: T.card, border: `1px solid ${T.border}`, padding: 20, borderRadius: 10 }}>
          <div className="label-eyebrow mb-3">Movimentações recentes</div>
          {movimentacoes.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 13 }}>
              Nenhuma movimentação. Registre vendas em <strong>Loja → Vendas</strong> ou adicione operacionais aqui.
            </div>
          ) : movimentacoes.slice(0, 12).map(m => (
            <div key={m.id} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 0", borderBottom: `1px dashed ${T.border}`, fontSize: 12.5,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: m.tipo === "credito" ? `${T.green}22` : `${T.red}22`,
                color: m.tipo === "credito" ? T.green : T.red,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {m.tipo === "credito" ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: T.ink, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>{m.descricao}</span>
                  <span style={{
                    fontSize: 8.5, padding: "1px 6px", borderRadius: 4,
                    background: T.bgSoft, color: T.muted,
                    letterSpacing: ".05em", textTransform: "uppercase",
                  }}>{m.categoria}</span>
                </div>
                <div style={{ fontSize: 10, color: T.faint, marginTop: 1 }}>
                  {m.sub && `${m.sub} · `}{m.data}
                </div>
              </div>
              <div className="num" style={{
                color: m.tipo === "credito" ? T.green : T.red,
                fontWeight: 500, whiteSpace: "nowrap",
              }}>
                {m.tipo === "credito" ? "+ " : "− "}{hidden ? "•••" : fmt(m.valor)}
              </div>
              {m.origem === "manual" && (
                <button onClick={() => setForm(operacoes.find(o => o.id === m.opId))}
                        aria-label="Editar"
                        style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", padding: 2 }}>
                  ✎
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Resumo + Contas (visual) */}
        <div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 20, marginBottom: 14, borderRadius: 10 }}>
            <div className="label-eyebrow mb-3">Resumo do mês</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: T.muted }}>Entradas:</span>
                <span style={{ color: T.green, fontVariantNumeric: "tabular-nums" }}>+ {hidden ? "•••" : fmt(kpis.entradas)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: T.muted }}>Saídas:</span>
                <span style={{ color: T.red, fontVariantNumeric: "tabular-nums" }}>− {hidden ? "•••" : fmt(kpis.saidas)}</span>
              </div>
              <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 500 }}>
                <span>Lucro líquido:</span>
                <span style={{ color: kpis.lucro >= 0 ? T.gold : T.red, fontVariantNumeric: "tabular-nums" }}>
                  {hidden ? "•••" : fmt(kpis.lucro)}
                </span>
              </div>
            </div>
          </div>

          <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 20, borderRadius: 10 }}>
            <div className="label-eyebrow mb-3">Integrações</div>
            <div style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.6 }}>
              ✓ Vendas (Loja → Vendas) entram automaticamente como crédito<br/>
              ✓ Compras de veículos (Loja → Estoque) viram débito<br/>
              ✓ Cheques compensados aparecem em Carteira<br/>
              ✎ Use "Nova Operação" para despesas operacionais manuais (combustível, aluguel, comissões)
            </div>
          </div>
        </div>
      </div>

      {/* Fluxo de caixa 6 meses */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 20, borderRadius: 10 }}>
        <div className="label-eyebrow mb-3">Fluxo de caixa · 6 meses</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={fluxo6m} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={T.border} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="mes" stroke={T.muted} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke={T.muted} fontSize={11} tickLine={false} axisLine={false}
                   tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: T.bg, border: `1px solid ${T.border}`, fontSize: 12 }}
              formatter={(v) => fmt(v)}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="entradas" fill={T.green} name="Entradas" />
            <Bar dataKey="saidas" fill={T.red} name="Saídas" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Modal Nova Operação */}
      {form && (
        <Modal title={form.id ? "Editar Operação" : "Nova Operação"} onClose={() => setForm(null)}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {["debito", "credito"].map(t => (
              <button key={t} onClick={() => setForm({ ...form, tipo: t })}
                style={{
                  padding: 12,
                  border: `1px solid ${form.tipo === t ? (t === "credito" ? T.green : T.red) : T.border}`,
                  background: form.tipo === t ? (t === "credito" ? `${T.green}22` : `${T.red}22`) : "transparent",
                  color: form.tipo === t ? (t === "credito" ? T.green : T.red) : T.muted,
                  fontFamily: T.sans, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase",
                  borderRadius: 7, cursor: "pointer",
                }}>
                {t === "credito" ? "Crédito (entrada)" : "Débito (saída)"}
              </button>
            ))}
          </div>
          <Field label="Descrição" required>
            <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })}
                   placeholder="Ex.: Combustível para test-drives" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                {TIPOS_OP.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Valor (R$)" required>
              <input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}
                     placeholder="380.00" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" required>
              <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
            </Field>
            <Field label="Fornecedor / Origem">
              <input value={form.fornecedor} onChange={e => setForm({ ...form, fornecedor: e.target.value })}
                     placeholder="Posto Shell" />
            </Field>
          </div>
          <div className="flex gap-2 justify-between mt-4">
            {form.id ? (
              <button className="btn-ghost" onClick={() => { del(form.id); setForm(null); }}
                      style={{ color: T.red, borderColor: T.red }}>
                <Trash2 size={12} className="inline mr-1" /> Excluir
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn-gold" onClick={save}>Salvar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SaldoCard({ label, valor, sub, cor, icone }) {
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${cor}55`,
      borderLeft: `4px solid ${cor}`,
      borderRadius: 10,
      padding: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>{icone}</span>
        <div className="label-eyebrow" style={{ color: cor }}>{label}</div>
      </div>
      <div className="num" style={{ fontSize: 22, fontWeight: 300, color: cor }}>
        {valor == null ? "•••" : fmt(valor)}
      </div>
      <div style={{ fontSize: 11, color: T.faint, marginTop: 4 }}>{sub}</div>
    </div>
  );
}
