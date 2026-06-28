import React, { useState, useEffect } from "react";
import { Trash2, Scale, Copy, Check, Search, PieChart, Loader2 } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt } from "../../lib/format.js";
import PageHeader from "../ui/PageHeader.jsx";
import { getQuotes } from "../../lib/brapi.js";
import {
  carregarWatchlist, salvarWatchlist, removerPapel,
  definirPeso, somaPesos, normalizarPesos,
} from "../../lib/mercadoWatchlist.js";

const CARD = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 };

/**
 * Construtor de mercado — pega os papéis acompanhados (watchlist) e monta uma
 * carteira-alvo com pesos. Normaliza pra 100% e exporta o plano.
 */
export default function ConstrutorMercado({ onIrPesquisador, onIrMonteCarteira }) {
  const [lista, setLista] = useState(() => carregarWatchlist());
  const [precos, setPrecos] = useState({}); // symbol -> { price, name }
  const [loading, setLoading] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => { salvarWatchlist(lista); }, [lista]);

  // Busca cotações atuais (best-effort) ao montar / quando a lista muda de tamanho.
  useEffect(() => {
    const symbols = lista.map((x) => x.symbol);
    if (symbols.length === 0) { setPrecos({}); return; }
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const qs = await getQuotes(symbols);
        if (cancel) return;
        const map = {};
        for (const q of qs) map[q.symbol] = { price: q.price, name: q.name };
        setPrecos(map);
      } catch { /* sem token/erro: segue sem preço */ }
      finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [lista.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = somaPesos(lista);
  const fechado = Math.abs(total - 100) < 0.5;

  function copiarPlano() {
    const txt = lista.map((x) => `${x.symbol}\t${(Number(x.peso) || 0).toFixed(1)}%`).join("\n");
    try {
      navigator.clipboard?.writeText(txt);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch { /* clipboard bloqueado */ }
  }

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Finanças · Construtor de mercado"
        title={<>Construtor de <em>mercado.</em></>}
        sub="Defina os pesos-alvo dos papéis que você acompanha e monte sua carteira ideal."
        action={
          <button onClick={onIrPesquisador} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 10, padding: "6px 10px", fontSize: 12.5, cursor: "pointer" }}>
            <Search size={13} /> Pesquisar papéis
          </button>
        }
      />

      {lista.length === 0 ? (
        <div style={{ ...CARD, marginTop: 12, textAlign: "center", padding: 32 }}>
          <PieChart size={28} style={{ color: T.faint, marginBottom: 10 }} />
          <div style={{ color: T.ink, fontWeight: 600, fontSize: 14 }}>Nenhum papel acompanhado ainda.</div>
          <div style={{ color: T.faint, fontSize: 12.5, marginTop: 4 }}>Use o Pesquisador de mercado e clique em “Acompanhar” pra trazer papéis pra cá.</div>
          <button onClick={onIrPesquisador} style={{ marginTop: 14, background: T.gold, color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
            Ir ao Pesquisador
          </button>
        </div>
      ) : (
        <>
          <div style={{ ...CARD, marginTop: 12, padding: 0, overflow: "hidden" }}>
            {lista.map((x, i) => {
              const info = precos[x.symbol];
              return (
                <div key={x.symbol} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i > 0 ? `1px solid ${T.border}` : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: T.ink, fontSize: 14 }}>{x.symbol}</div>
                    <div style={{ fontSize: 11.5, color: T.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {info?.name || x.name || "—"}{info?.price != null ? ` · ${fmt(info.price)}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="number" min="0" max="100" step="1"
                      value={x.peso || 0}
                      onChange={(e) => setLista((prev) => definirPeso(prev, x.symbol, e.target.value))}
                      style={{ width: 64, textAlign: "right", background: T.bgSoft, color: T.ink, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 8px", fontSize: 14, fontFamily: "inherit" }}
                    />
                    <span style={{ color: T.muted, fontSize: 13 }}>%</span>
                  </div>
                  <button onClick={() => setLista((prev) => removerPapel(prev, x.symbol))} title="Remover" style={{ background: "transparent", border: "none", color: T.faint, cursor: "pointer", display: "flex" }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Barra de composição */}
          <div style={{ ...CARD, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, color: T.muted, display: "flex", alignItems: "center", gap: 6 }}>
                {loading && <Loader2 size={13} className="spin" />} Soma dos pesos
              </span>
              <span style={{ fontWeight: 800, fontSize: 15, color: fechado ? T.green : T.yellow }}>
                {total.toFixed(1)}%
              </span>
            </div>
            <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: T.bgSoft }}>
              {lista.map((x, i) => {
                const w = total > 0 ? (Number(x.peso) || 0) : 0;
                const cores = [T.gold, T.blue, T.green, T.yellow, T.goldHi, "#a78bfa", "#fb7185"];
                return w > 0 ? <div key={x.symbol} title={`${x.symbol} ${w.toFixed(1)}%`} style={{ width: `${w}%`, background: cores[i % cores.length] }} /> : null;
              })}
            </div>
            {!fechado && (
              <div style={{ fontSize: 12, color: T.faint, marginTop: 8 }}>
                {total > 100 ? `Passou ${(total - 100).toFixed(1)}% de 100%.` : `Faltam ${(100 - total).toFixed(1)}% pra fechar 100%.`}
              </div>
            )}
          </div>

          {/* Ações */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <button onClick={() => setLista((prev) => normalizarPesos(prev))} style={{ display: "flex", alignItems: "center", gap: 6, background: T.gold, color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
              <Scale size={15} /> Normalizar 100%
            </button>
            <button onClick={copiarPlano} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", color: T.ink, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
              {copiado ? <Check size={15} style={{ color: T.green }} /> : <Copy size={15} />} {copiado ? "Copiado!" : "Copiar plano"}
            </button>
            {onIrMonteCarteira && (
              <button onClick={onIrMonteCarteira} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", color: T.gold, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                <PieChart size={15} /> Abrir Monte sua Carteira
              </button>
            )}
          </div>
        </>
      )}
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
