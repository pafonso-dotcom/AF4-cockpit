import React, { useState } from "react";
import { Plus, Trash2, Bookmark } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { toast } from "../../../lib/toast.js";
import { getWatchlist, WATCHLIST_DEFAULT } from "../../../lib/watchlist.js";
import PageHeader from "../../ui/PageHeader.jsx";
import Modal from "../../ui/Modal.jsx";
import Field from "../../ui/Field.jsx";

export default function Watchlist({ tradeWatchlist, setTradeWatchlist }) {
  const lista = getWatchlist(tradeWatchlist);
  const usandoDefault = !tradeWatchlist || tradeWatchlist.length === 0;
  const [novaOpen, setNovaOpen] = useState(false);
  const [novo, setNovo] = useState({ symbol: "", display: "", name: "" });

  const adicionar = () => {
    if (!novo.symbol.trim()) {
      toast.error("Informe o symbol (ex.: BTCUSDT)");
      return;
    }
    const sym = novo.symbol.trim().toUpperCase();
    if (lista.find(w => w.symbol === sym)) {
      toast.error(`${sym} já está na watchlist.`);
      return;
    }
    const item = {
      symbol: sym,
      display: novo.display || sym.replace(/USDT$/, "/USDT"),
      name: novo.name || sym.replace(/USDT$/, ""),
      icon: (novo.name || sym).charAt(0).toUpperCase(),
    };
    setTradeWatchlist?.([...(tradeWatchlist || WATCHLIST_DEFAULT), item]);
    toast.success(`${sym} adicionado.`);
    setNovo({ symbol: "", display: "", name: "" });
    setNovaOpen(false);
  };

  const remover = (sym) => {
    if (usandoDefault) {
      // Materializa a lista atual sem esse item
      setTradeWatchlist?.(lista.filter(w => w.symbol !== sym));
    } else {
      setTradeWatchlist?.(tradeWatchlist.filter(w => w.symbol !== sym));
    }
    toast.success(`${sym} removido.`);
  };

  const restaurarDefault = () => {
    setTradeWatchlist?.([]);
    toast.success("Watchlist restaurada para o padrão (15 criptos).");
  };

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="AF4 Trade · Watchlist"
        title={<>Sua <em>watchlist.</em></>}
        sub="Lista das criptos analisadas pelo Radar. Adicione/remova pra ajustar ao seu universo."
        action={
          <div className="flex gap-2 flex-wrap">
            {!usandoDefault && (
              <button className="btn-ghost" onClick={restaurarDefault}>
                Restaurar padrão
              </button>
            )}
            <button className="btn-gold" onClick={() => setNovaOpen(true)}>
              <Plus size={14} className="inline mr-1.5" /> Adicionar moeda
            </button>
          </div>
        }
      />

      {usandoDefault && (
        <div style={{
          padding: "10px 14px", marginBottom: 14,
          background: `${T.gold}11`, border: `1px dashed ${T.gold}55`,
          borderRadius: 12, fontSize: 12, color: T.muted,
        }}>
          ⓘ Usando watchlist padrão (15 criptos). Qualquer adição/remoção materializa a lista personalizada.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {lista.map(w => (
          <div key={w.symbol} style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 14, padding: "10px 14px",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 12, background: T.bgSoft,
              display: "grid", placeItems: "center",
              color: T.gold, fontWeight: 700, fontSize: 14,
              flexShrink: 0,
            }}>{w.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: T.ink, fontSize: 13, fontWeight: 600 }}>{w.name}</div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2, fontFamily: "monospace" }}>
                {w.display} · {w.symbol}
              </div>
            </div>
            <button onClick={() => remover(w.symbol)}
              title="Remover da watchlist"
              style={{
                background: "transparent", color: T.red,
                border: `1px solid ${T.red}55`, padding: "6px 10px",
                borderRadius: 11, cursor: "pointer",
              }}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {novaOpen && (
        <Modal title="Adicionar moeda" onClose={() => setNovaOpen(false)}>
          <Field label="Symbol Binance" required hint="Ex.: BTCUSDT, ETHUSDT, SOLUSDT">
            <input value={novo.symbol}
                   onChange={e => setNovo({ ...novo, symbol: e.target.value.toUpperCase() })}
                   placeholder="BTCUSDT" />
          </Field>
          <Field label="Nome (opcional)">
            <input value={novo.name}
                   onChange={e => setNovo({ ...novo, name: e.target.value })}
                   placeholder="Bitcoin" />
          </Field>
          <Field label="Display (opcional)" hint="Como aparece nos cards">
            <input value={novo.display}
                   onChange={e => setNovo({ ...novo, display: e.target.value })}
                   placeholder="BTC/USDT" />
          </Field>
          <div style={{ padding: 10, marginTop: 8, fontSize: 11, color: T.muted, background: T.bgSoft, borderRadius: 11 }}>
            ℹ️ Use apenas symbols válidos da Binance (terminando em USDT é mais seguro). Liste em
            <a href="https://binance.com" target="_blank" rel="noopener noreferrer" style={{ color: T.gold, marginLeft: 4 }}>binance.com</a>.
          </div>
          <div className="flex gap-3 justify-end mt-5">
            <button className="btn-ghost" onClick={() => setNovaOpen(false)}>Cancelar</button>
            <button className="btn-gold" onClick={adicionar}>
              <Bookmark size={13} className="inline mr-1.5" /> Adicionar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
