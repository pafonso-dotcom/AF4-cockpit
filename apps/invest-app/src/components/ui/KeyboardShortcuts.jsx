import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt } from "../../lib/format.js";

/**
 * Atalhos globais:
 * - ? abre o modal de ajuda
 * - Cmd/Ctrl + K abre busca rápida (transações, contas, ativos, cartões)
 * - Esc fecha
 * - 1..9 troca de aba (mesma ordem do Header)
 */
export default function KeyboardShortcuts({
  setTab,
  transacoes = [],
  contas = [],
  ativos = [],
  cartoes = [],
}) {
  const [help, setHelp] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      // Don't trigger shortcuts when typing in inputs/textarea
      const inField = ["INPUT", "TEXTAREA", "SELECT"].includes(e.target?.tagName);

      // Cmd/Ctrl + K — sempre aceita, mesmo em inputs
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
        return;
      }

      if (inField) return;

      // ? abre help
      if (e.key === "?" && !e.shiftKey) {
        // shift required for ? on most layouts but allow plain ? too
      }
      if (e.key === "?") {
        e.preventDefault();
        setHelp(true);
        return;
      }

      // 1..9 troca aba (corresponde aos primeiros 9 ids do Header)
      const tabMap = ["dashboard","contas","cartoes","transacoes","calendario","categorias","investimentos","analise","mercado"];
      if (e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key) - 1;
        if (tabMap[idx]) {
          e.preventDefault();
          setTab(tabMap[idx]);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTab]);

  return (
    <>
      {help && <HelpModal onClose={() => setHelp(false)} />}
      {palette && (
        <CommandPalette
          onClose={() => setPalette(false)}
          setTab={setTab}
          transacoes={transacoes}
          contas={contas}
          ativos={ativos}
          cartoes={cartoes}
        />
      )}
    </>
  );
}

function HelpModal({ onClose }) {
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const groups = [
    {
      titulo: "Navegação",
      atalhos: [
        { k: "1", desc: "Visão Geral" },
        { k: "2", desc: "Contas" },
        { k: "3", desc: "Cartões" },
        { k: "4", desc: "Transações" },
        { k: "5", desc: "Calendário" },
        { k: "6", desc: "Categorias" },
        { k: "7", desc: "Investimentos" },
        { k: "8", desc: "Análise" },
        { k: "9", desc: "Mercado" },
      ],
    },
    {
      titulo: "Comandos",
      atalhos: [
        { k: "⌘ K", desc: "Abrir busca rápida" },
        { k: "?", desc: "Mostrar esta ajuda" },
        { k: "Esc", desc: "Fechar modal / palette" },
      ],
    },
  ];

  return createPortal((
    <div onClick={onClose}
         style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
           style={{ background: T.card, border: `1px solid ${T.borderHi}`, maxWidth: 520, width: "100%", padding: 32, position: "relative", borderRadius: 12, boxShadow: "0 24px 60px rgba(0,0,0,.6)" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, color: T.muted, background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
          <X size={20} />
        </button>
        <div className="label-eyebrow">Atalhos</div>
        <h3 style={{ fontFamily: T.serif, fontSize: 28, color: T.ink, marginBottom: 24, letterSpacing: "-0.02em", marginTop: 8 }}>
          Como navegar mais rápido
        </h3>

        {groups.map(g => (
          <div key={g.titulo} style={{ marginBottom: 24 }}>
            <div style={{ color: T.gold, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 500, marginBottom: 12 }}>
              {g.titulo}
            </div>
            <div className="space-y-2">
              {g.atalhos.map(a => (
                <div key={a.k} className="flex items-center justify-between" style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ color: T.ink, fontSize: 14 }}>{a.desc}</span>
                  <kbd style={{
                    background: T.bg, color: T.gold,
                    border: `1px solid ${T.border}`,
                    padding: "4px 10px", fontFamily: T.mono, fontSize: 12,
                    minWidth: 40, textAlign: "center",
                  }}>{a.k}</kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  ), document.body);
}

function CommandPalette({ onClose, setTab, transacoes, contas, ativos, cartoes }) {
  const [q, setQ] = useState("");
  const inputRef = useRef();
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const tabs = [
    { id: "dashboard", l: "Visão Geral" }, { id: "contas", l: "Contas" },
    { id: "cartoes", l: "Cartões" }, { id: "transacoes", l: "Transações" },
    { id: "calendario", l: "Calendário" }, { id: "categorias", l: "Categorias" },
    { id: "investimentos", l: "Investimentos" }, { id: "analise", l: "Análise" },
    { id: "mercado", l: "Mercado" }, { id: "simulador", l: "Simulador" },
  ];

  const items = useMemo(() => {
    const results = [];
    const ql = q.toLowerCase().trim();
    if (!ql) {
      // Show tabs as default suggestions
      tabs.forEach(t => results.push({ tipo: "Aba", titulo: t.l, sub: "Trocar de seção", action: () => setTab(t.id) }));
      return results.slice(0, 8);
    }

    tabs.forEach(t => {
      if (t.l.toLowerCase().includes(ql)) {
        results.push({ tipo: "Aba", titulo: t.l, sub: "Trocar de seção", action: () => setTab(t.id) });
      }
    });

    transacoes.forEach(t => {
      if ((t.descricao + " " + (t.obs || "")).toLowerCase().includes(ql)) {
        results.push({ tipo: "Transação", titulo: t.descricao, sub: `${t.tipo} · ${fmt(t.valor)} · ${t.data}`, action: () => setTab("transacoes") });
      }
    });

    contas.forEach(c => {
      if (c.nome.toLowerCase().includes(ql)) {
        results.push({ tipo: "Conta", titulo: c.nome, sub: fmt(c.saldo), action: () => setTab("contas") });
      }
    });

    ativos.forEach(a => {
      if ((a.ticker + " " + a.nome).toLowerCase().includes(ql)) {
        results.push({ tipo: "Ativo", titulo: `${a.ticker} — ${a.nome}`, sub: `${a.qtd} × ${fmt(a.preco)}`, action: () => setTab("investimentos") });
      }
    });

    cartoes.forEach(c => {
      if (c.nome.toLowerCase().includes(ql)) {
        results.push({ tipo: "Cartão", titulo: c.nome, sub: `Limite ${fmt(c.limite)}`, action: () => setTab("cartoes") });
      }
    });

    return results.slice(0, 12);
  }, [q, transacoes, contas, ativos, cartoes, setTab]);

  useEffect(() => {
    setSelected(0);
  }, [q]);

  const handleKey = (e) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected(s => Math.min(items.length - 1, s + 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected(s => Math.max(0, s - 1));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const it = items[selected];
      if (it) {
        it.action();
        onClose();
      }
    }
  };

  return createPortal((
    <div onClick={onClose}
         style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1050, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "10vh 16px 16px" }}>
      <div onClick={e => e.stopPropagation()}
           style={{ background: T.card, border: `1px solid ${T.borderHi}`, maxWidth: 600, width: "100%", borderRadius: 12, boxShadow: "0 24px 60px rgba(0,0,0,.6)" }}>
        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
          <Search size={18} style={{ color: T.muted }} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Buscar transação, conta, ativo, cartão, ou aba…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: T.ink, fontSize: 17, fontFamily: T.body,
            }}
          />
          <kbd style={{ background: T.bg, color: T.muted, border: `1px solid ${T.border}`, padding: "2px 8px", fontFamily: T.mono, fontSize: 11 }}>ESC</kbd>
        </div>
        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {items.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: T.muted, fontStyle: "italic" }}>
              Nada encontrado.
            </div>
          )}
          {items.map((it, i) => (
            <button
              key={i}
              onClick={() => { it.action(); onClose(); }}
              onMouseEnter={() => setSelected(i)}
              style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%",
                padding: "12px 20px", textAlign: "left", border: "none", cursor: "pointer",
                background: i === selected ? T.cardHi : "transparent",
                borderLeft: `2px solid ${i === selected ? T.gold : "transparent"}`,
              }}>
              <span style={{
                color: T.gold, fontSize: 9, fontWeight: 500, letterSpacing: "0.15em",
                textTransform: "uppercase", minWidth: 80, opacity: 0.85,
              }}>
                {it.tipo}
              </span>
              <div className="flex-1 min-w-0">
                <div style={{ color: T.ink, fontSize: 14, fontWeight: 500 }} className="truncate">{it.titulo}</div>
                <div style={{ color: T.muted, fontSize: 12 }} className="truncate">{it.sub}</div>
              </div>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 px-5 py-2" style={{ borderTop: `1px solid ${T.border}`, color: T.faint, fontSize: 11 }}>
          <span>↑↓ navegar</span>
          <span>↵ selecionar</span>
          <span style={{ marginLeft: "auto" }}>
            <kbd style={{ background: T.bg, color: T.muted, padding: "1px 5px", fontFamily: T.mono, fontSize: 10 }}>?</kbd> ajuda
          </span>
        </div>
      </div>
    </div>
  ), document.body);
}
