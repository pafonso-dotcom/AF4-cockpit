import React, { useMemo, useState } from "react";
import { Plus, Trash2, ShoppingCart, X, Check } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, uid } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";

const CATEGORIAS = [
  { id: "mercado",   label: "Mercado",   cor: "#70ad47" },
  { id: "farmacia",  label: "Farmácia",  cor: "#5b9bd5" },
  { id: "casa",      label: "Casa",      cor: "#c9a96b" },
  { id: "tech",      label: "Tech",      cor: "#8b5cf6" },
  { id: "outros",    label: "Outros",    cor: "#9ca3af" },
];

const catMeta = (id) => CATEGORIAS.find(c => c.id === id) || CATEGORIAS[CATEGORIAS.length - 1];

export default function Compras({ compras = [], setCompras }) {
  const [novo, setNovo] = useState("");
  const [novoPreco, setNovoPreco] = useState("");
  const [novoCat, setNovoCat] = useState("mercado");
  const [filtroCat, setFiltroCat] = useState("todas");

  const adicionar = () => {
    const t = novo.trim();
    if (!t) return;
    const item = {
      id: uid(),
      nome: t,
      preco: novoPreco ? parseFloat(String(novoPreco).replace(",", ".")) || 0 : null,
      qtd: 1,
      checked: false,
      categoria: novoCat,
      createdAt: new Date().toISOString(),
    };
    setCompras([item, ...compras]);
    setNovo("");
    setNovoPreco("");
  };

  const toggle = (item) => {
    setCompras(compras.map(c => c.id === item.id ? { ...c, checked: !c.checked } : c));
  };

  const excluir = (item) => {
    setCompras(compras.filter(c => c.id !== item.id));
  };

  const limparComprados = async () => {
    const comprados = compras.filter(c => c.checked);
    if (comprados.length === 0) return;
    const ok = await confirm({
      title: `Limpar ${comprados.length} ${comprados.length === 1 ? "item comprado" : "itens comprados"}?`,
      confirmLabel: "Limpar",
    });
    if (!ok) return;
    setCompras(compras.filter(c => !c.checked));
    toast.success("Itens limpos.");
  };

  const setPreco = (item, valor) => {
    const p = valor === "" ? null : parseFloat(String(valor).replace(",", ".")) || 0;
    setCompras(compras.map(c => c.id === item.id ? { ...c, preco: p } : c));
  };

  const setQtd = (item, delta) => {
    setCompras(compras.map(c => c.id === item.id ? { ...c, qtd: Math.max(1, (c.qtd || 1) + delta) } : c));
  };

  const filtrados = useMemo(() => {
    return compras.filter(c => filtroCat === "todas" || c.categoria === filtroCat);
  }, [compras, filtroCat]);

  const pendentes = filtrados.filter(c => !c.checked);
  const comprados = filtrados.filter(c => c.checked);

  const total = useMemo(() => {
    return pendentes.reduce((s, c) => s + ((c.preco || 0) * (c.qtd || 1)), 0);
  }, [pendentes]);

  const totalComprado = useMemo(() => {
    return comprados.reduce((s, c) => s + ((c.preco || 0) * (c.qtd || 1)), 0);
  }, [comprados]);

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Lista de Compras"
        title="Compras"
        sub="O que precisa antes de sair de casa."
        action={
          comprados.length > 0 && (
            <button className="btn-ghost" onClick={limparComprados}>
              Limpar {comprados.length} ✓
            </button>
          )
        }
      />

      {/* Quick add */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 16,
        padding: 12, marginBottom: 14,
      }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input value={novo}
                 onChange={e => setNovo(e.target.value)}
                 onKeyDown={e => { if (e.key === "Enter") adicionar(); }}
                 placeholder="O que falta?"
                 style={{ flex: "1 1 180px", minWidth: 160, fontSize: 14 }} />
          <input value={novoPreco}
                 onChange={e => setNovoPreco(e.target.value)}
                 onKeyDown={e => { if (e.key === "Enter") adicionar(); }}
                 placeholder="R$ (opcional)"
                 inputMode="decimal"
                 style={{ width: 110 }} />
          <select value={novoCat} onChange={e => setNovoCat(e.target.value)} style={{ width: 120 }}>
            {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <button className="btn-gold" onClick={adicionar} disabled={!novo.trim()}>
            <Plus size={14} className="inline mr-1" />Add
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {[{ id: "todas", label: "Todas", cor: T.gold }, ...CATEGORIAS].map(c => {
          const ativo = filtroCat === c.id;
          const qtd = c.id === "todas" ? compras.length : compras.filter(x => x.categoria === c.id).length;
          return (
            <button key={c.id} onClick={() => setFiltroCat(c.id)}
              style={{
                padding: "6px 12px",
                background: ativo ? `${c.cor}22` : T.card,
                border: `1px solid ${ativo ? c.cor : T.border}`,
                color: ativo ? c.cor : T.muted,
                fontSize: 11, fontWeight: 600, borderRadius: 100,
                cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}>
              {c.label}
              <span style={{ opacity: 0.7, fontSize: 10 }}>{qtd}</span>
            </button>
          );
        })}
      </div>

      {/* Total */}
      {(total > 0 || totalComprado > 0) && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14,
        }}>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600 }}>
              A comprar
            </div>
            <div className="num" style={{ fontSize: 18, fontWeight: 700, color: T.gold, marginTop: 2 }}>
              {fmt(total)}
            </div>
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>{pendentes.length} {pendentes.length === 1 ? "item" : "itens"}</div>
          </div>
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600 }}>
              Já comprado
            </div>
            <div className="num" style={{ fontSize: 18, fontWeight: 700, color: T.green, marginTop: 2 }}>
              {fmt(totalComprado)}
            </div>
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>{comprados.length} {comprados.length === 1 ? "item" : "itens"}</div>
          </div>
        </div>
      )}

      {/* Lista pendente */}
      {pendentes.length === 0 && comprados.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 24px",
          background: T.card, border: `1px dashed ${T.border}`, borderRadius: 18,
        }}>
          <ShoppingCart size={36} style={{ color: T.gold, marginBottom: 12 }} />
          <h3 style={{ fontFamily: T.serif, fontSize: 20, color: T.ink, margin: "0 0 8px", fontWeight: 600 }}>
            Lista vazia
          </h3>
          <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>
            Adicione itens acima e marque conforme compra.
          </p>
        </div>
      ) : (
        <>
          {pendentes.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {pendentes.map(item => (
                <CompraRow key={item.id} item={item}
                           onToggle={toggle} onExcluir={excluir}
                           setPreco={setPreco} setQtd={setQtd} />
              ))}
            </div>
          )}

          {comprados.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600, marginTop: 16, marginBottom: 6 }}>
                Comprado ({comprados.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {comprados.map(item => (
                  <CompraRow key={item.id} item={item}
                             onToggle={toggle} onExcluir={excluir}
                             setPreco={setPreco} setQtd={setQtd} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function CompraRow({ item, onToggle, onExcluir, setPreco, setQtd }) {
  const cat = catMeta(item.categoria);
  return (
    <div style={{
      background: item.checked ? T.bgSoft : T.card,
      border: `1px solid ${T.border}`,
      borderLeft: `4px solid ${cat.cor}`,
      borderRadius: 14,
      padding: "10px 12px",
      display: "flex", alignItems: "center", gap: 10,
      opacity: item.checked ? 0.55 : 1,
    }}>
      <button onClick={() => onToggle(item)}
        style={{
          width: 26, height: 26, borderRadius: 5,
          background: item.checked ? T.green : "transparent",
          border: `1px solid ${item.checked ? T.green : T.border}`,
          color: item.checked ? T.bg : "transparent",
          cursor: "pointer", display: "grid", placeItems: "center",
          flexShrink: 0, minHeight: 26,
        }}
        title={item.checked ? "Desmarcar" : "Marcar comprado"}>
        {item.checked && <Check size={15} />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 500, color: T.ink,
          textDecoration: item.checked ? "line-through" : "none",
        }}>
          {item.nome}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
          {/* Quantidade */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <button onClick={() => setQtd(item, -1)} disabled={(item.qtd || 1) <= 1}
              style={{
                width: 22, height: 22, borderRadius: 4,
                background: T.bgSoft, border: `1px solid ${T.border}`,
                color: T.muted, cursor: "pointer", minHeight: 22,
                opacity: (item.qtd || 1) <= 1 ? 0.4 : 1,
              }}>−</button>
            <span className="num" style={{ fontSize: 11, color: T.ink, fontWeight: 600, minWidth: 18, textAlign: "center" }}>
              {item.qtd || 1}
            </span>
            <button onClick={() => setQtd(item, +1)}
              style={{
                width: 22, height: 22, borderRadius: 4,
                background: T.bgSoft, border: `1px solid ${T.border}`,
                color: T.muted, cursor: "pointer", minHeight: 22,
              }}>+</button>
          </div>
          {/* Preço inline */}
          <input value={item.preco != null ? String(item.preco).replace(".", ",") : ""}
                 onChange={e => setPreco(item, e.target.value)}
                 placeholder="R$"
                 inputMode="decimal"
                 style={{
                   width: 70, padding: "3px 6px", fontSize: 11,
                   background: T.bgSoft, border: `1px solid ${T.border}`,
                   borderRadius: 4, fontFamily: T.mono,
                 }} />
          {item.preco != null && (item.qtd || 1) > 1 && (
            <span className="num" style={{ fontSize: 10.5, color: T.muted }}>
              = {fmt(item.preco * (item.qtd || 1))}
            </span>
          )}
        </div>
      </div>

      <button onClick={() => onExcluir(item)} title="Remover"
        style={{
          background: "transparent", border: "none", color: T.muted,
          cursor: "pointer", padding: 6, minHeight: 28,
        }}>
        <X size={15} />
      </button>
    </div>
  );
}
