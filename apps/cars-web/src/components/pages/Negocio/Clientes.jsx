import React, { useMemo, useState } from "react";
import { Plus, Trash2, Edit3, Check, X, Search, User, Phone, Mail, Hash, Car, Wrench } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, uid } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import PageHeader from "../../ui/PageHeader.jsx";
import Field from "../../ui/Field.jsx";
import Modal from "../../ui/Modal.jsx";

/**
 * Clientes do módulo Negócio.
 * Shape: { id, nome, doc, telefone, email, obs, criadoEm }
 *
 * Cada card mostra dados de contato + estatísticas do cliente
 * (veículos comprados, serviços contratados, valor total gasto)
 * agregadas a partir das vendas vinculadas.
 */
export default function Clientes({
  clientes = [], setClientes,
  vendasVeiculos = [],
  vendasServicos = [],
  hidden,
}) {
  const [form, setForm] = useState(null);
  const [busca, setBusca] = useState("");

  // Estatísticas por cliente
  const statsPorCliente = useMemo(() => {
    const map = {};
    (vendasVeiculos || []).forEach(v => {
      if (!v.clienteId) return;
      const s = (map[v.clienteId] = map[v.clienteId] || { vVeic: 0, totalVeic: 0, vServ: 0, totalServ: 0 });
      s.vVeic++;
      s.totalVeic += Number(v.valorVenda || 0);
    });
    (vendasServicos || []).forEach(v => {
      if (!v.clienteId) return;
      const s = (map[v.clienteId] = map[v.clienteId] || { vVeic: 0, totalVeic: 0, vServ: 0, totalServ: 0 });
      s.vServ++;
      s.totalServ += Number(v.valor || 0);
    });
    return map;
  }, [vendasVeiculos, vendasServicos]);

  const listaFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = q
      ? clientes.filter(c =>
          (c.nome || "").toLowerCase().includes(q) ||
          (c.doc || "").toLowerCase().includes(q) ||
          (c.telefone || "").toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q))
      : clientes;
    return [...lista].sort((a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR"));
  }, [clientes, busca]);

  const abrirNovo = () => {
    setForm({ id: null, nome: "", doc: "", telefone: "", email: "", obs: "" });
  };
  const abrirEditar = (c) => setForm({ ...c });

  const salvar = () => {
    const nome = (form.nome || "").trim();
    if (!nome) { toast.error("Informe o nome do cliente."); return; }
    const dados = {
      ...form,
      nome,
      doc: (form.doc || "").trim(),
      telefone: (form.telefone || "").trim(),
      email: (form.email || "").trim(),
      obs: (form.obs || "").trim(),
    };
    if (form.id) {
      setClientes(clientes.map(c => c.id === form.id ? dados : c));
      toast.success(`${nome} atualizado.`);
    } else {
      setClientes([{ ...dados, id: uid(), criadoEm: new Date().toISOString() }, ...clientes]);
      toast.success(`${nome} cadastrado.`);
    }
    setForm(null);
  };

  const excluir = async (c) => {
    const s = statsPorCliente[c.id];
    const totalVendas = (s?.vVeic || 0) + (s?.vServ || 0);
    const ok = await confirm({
      title: `Excluir ${c.nome}?`,
      body: totalVendas > 0
        ? `Este cliente tem ${totalVendas} venda(s) vinculada(s). As vendas continuam registradas mas vão perder o vínculo com cliente. Deseja prosseguir?`
        : `O cadastro de ${c.nome} será removido.`,
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    setClientes(clientes.filter(x => x.id !== c.id));
    toast.success("Cliente removido.");
  };

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Negócio · Clientes"
        title="Clientes"
        sub="Cadastro de clientes vinculáveis a vendas de veículos e serviços."
        action={
          <button onClick={abrirNovo} className="btn-gold">
            <Plus size={14} className="inline mr-1.5" /> Novo cliente
          </button>
        }
      />

      {/* Busca */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: 10, marginBottom: 14, display: "flex", alignItems: "center", gap: 10,
      }}>
        <Search size={15} style={{ color: T.muted, flexShrink: 0 }} />
        <input value={busca} onChange={e => setBusca(e.target.value)}
               placeholder="Buscar por nome, CPF/CNPJ, telefone ou email…"
               style={{
                 flex: 1, background: "transparent", border: "none", outline: "none",
                 color: T.ink, fontSize: 13, fontFamily: "inherit",
               }} />
        <div style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>
          {listaFiltrada.length} {listaFiltrada.length === 1 ? "cliente" : "clientes"}
        </div>
      </div>

      {/* Lista */}
      {listaFiltrada.length === 0 ? (
        <div style={{
          background: T.card, border: `1px dashed ${T.border}`, borderRadius: 10,
          padding: 60, textAlign: "center", color: T.muted, fontStyle: "italic",
        }}>
          <User size={28} style={{ color: T.muted, marginBottom: 10 }} />
          <div>
            {clientes.length === 0
              ? "Nenhum cliente cadastrado ainda. Clique em \"Novo cliente\" pra começar."
              : "Nada encontrado pra essa busca."}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {listaFiltrada.map(c => (
            <ClienteCard key={c.id} cliente={c}
                         stats={statsPorCliente[c.id]}
                         hidden={hidden}
                         onEditar={() => abrirEditar(c)}
                         onExcluir={() => excluir(c)} />
          ))}
        </div>
      )}

      {/* Modal de form */}
      {form && (
        <Modal title={form.id ? "Editar cliente" : "Novo cliente"} onClose={() => setForm(null)}>
          <Field label="Nome" required>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
                   placeholder="Ex.: João Silva" autoFocus />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="CPF / CNPJ">
              <input value={form.doc} onChange={e => setForm({ ...form, doc: e.target.value })}
                     placeholder="000.000.000-00" />
            </Field>
            <Field label="Telefone">
              <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })}
                     placeholder="(00) 00000-0000" />
            </Field>
          </div>
          <Field label="E-mail">
            <input type="email" value={form.email}
                   onChange={e => setForm({ ...form, email: e.target.value })}
                   placeholder="cliente@exemplo.com" />
          </Field>
          <Field label="Observações">
            <textarea value={form.obs} rows={3}
                      onChange={e => setForm({ ...form, obs: e.target.value })}
                      placeholder="Notas internas, preferências, contexto…"
                      style={{ resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <div className="flex gap-3 justify-end mt-6">
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn-gold" onClick={salvar}>
              <Check size={13} className="inline mr-1" />
              {form.id ? "Salvar" : "Cadastrar"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ClienteCard({ cliente: c, stats, hidden, onEditar, onExcluir }) {
  const total = (stats?.totalVeic || 0) + (stats?.totalServ || 0);
  const totalCompras = (stats?.vVeic || 0) + (stats?.vServ || 0);

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
      padding: 14,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{c.nome}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6, fontSize: 11.5, color: T.muted }}>
            {c.doc && <span style={ChipStyle}><Hash size={11} /> {c.doc}</span>}
            {c.telefone && <span style={ChipStyle}><Phone size={11} /> {c.telefone}</span>}
            {c.email && <span style={ChipStyle}><Mail size={11} /> {c.email}</span>}
          </div>
          {c.obs && (
            <div style={{ marginTop: 8, fontSize: 12, color: T.muted, fontStyle: "italic", lineHeight: 1.45 }}>
              {c.obs}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button onClick={onEditar} title="Editar"
                  style={btnIconStyle}>
            <Edit3 size={14} />
          </button>
          <button onClick={onExcluir} title="Excluir"
                  style={{ ...btnIconStyle, color: T.red }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Stats de vendas */}
      {totalCompras > 0 && (
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${T.border}`,
          display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11.5, color: T.muted,
        }}>
          {stats?.vVeic > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Car size={12} style={{ color: T.gold }} />
              {stats.vVeic} {stats.vVeic === 1 ? "veículo" : "veículos"}
              <strong style={{ color: T.ink, marginLeft: 4, fontVariantNumeric: "tabular-nums" }}>
                {hidden ? "•••" : fmt(stats.totalVeic)}
              </strong>
            </span>
          )}
          {stats?.vServ > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Wrench size={12} style={{ color: T.green }} />
              {stats.vServ} {stats.vServ === 1 ? "serviço" : "serviços"}
              <strong style={{ color: T.ink, marginLeft: 4, fontVariantNumeric: "tabular-nums" }}>
                {hidden ? "•••" : fmt(stats.totalServ)}
              </strong>
            </span>
          )}
          <span style={{ marginLeft: "auto", color: T.gold, fontWeight: 600 }}>
            Total: <span className="num">{hidden ? "•••••" : fmt(total)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

const ChipStyle = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "2px 8px", borderRadius: 4,
  background: "var(--bd)", color: "var(--tm)",
};

const btnIconStyle = {
  background: "transparent", border: `1px solid var(--bd)`,
  color: "var(--tm)", padding: 8, borderRadius: 5, cursor: "pointer",
  minWidth: 36, minHeight: 36, display: "grid", placeItems: "center",
};
