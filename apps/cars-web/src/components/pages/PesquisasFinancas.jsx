import React, { useMemo, useState } from "react";
import { Search, Download } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, todayISO } from "../../lib/format.js";
import { ordenarPorNome } from "../../lib/categoriaSort.js";

/**
 * Pesquisas (Relatórios Diversos) — consultas livres sobre os dados:
 * "quanto recebi de dividendos entre X e Y", "quanto gastei com Z no período",
 * etc. Escolhe a fonte (despesas / receitas / proventos), o período e filtros
 * de texto/categoria/conta; sai total, média mensal, quebra por categoria e
 * por mês, e a lista dos lançamentos. Exporta CSV.
 */

const MESES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesLabel = (iso) => `${MESES_CURTO[parseInt(iso.slice(5, 7), 10) - 1]}/${iso.slice(2, 4)}`;

// Períodos rápidos → { de, ate } (ISO). "Tudo" = sem limites.
function rangeRapido(id) {
  const hoje = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  const y = hoje.getFullYear(), m = hoje.getMonth();
  switch (id) {
    case "mes":      return { de: iso(new Date(y, m, 1)), ate: todayISO() };
    case "3m":       return { de: iso(new Date(y, m - 2, 1)), ate: todayISO() };
    case "6m":       return { de: iso(new Date(y, m - 5, 1)), ate: todayISO() };
    case "ano":      return { de: `${y}-01-01`, ate: todayISO() };
    case "anoPassado": return { de: `${y - 1}-01-01`, ate: `${y - 1}-12-31` };
    case "tudo":     return { de: "", ate: "" };
    default:         return null;
  }
}

export default function PesquisasFinancas({
  transacoes = [], categorias = [], contas = [], proventosManuais = [],
  hidden, embed = false,
}) {
  const [fonte, setFonte] = useState("despesas"); // despesas | receitas | proventos
  const [{ de, ate }, setPeriodo] = useState(() => rangeRapido("ano"));
  const [rapido, setRapido] = useState("ano");
  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [conta, setConta] = useState("");
  const [incluirPendentes, setIncluirPendentes] = useState(true);

  const aplicarRapido = (id) => { setRapido(id); setPeriodo(rangeRapido(id)); };
  const setDe = (v) => { setRapido(""); setPeriodo(p => ({ ...p, de: v })); };
  const setAte = (v) => { setRapido(""); setPeriodo(p => ({ ...p, ate: v })); };

  const catsDaFonte = useMemo(() =>
    ordenarPorNome((categorias || []).filter(c => c.tipo === (fonte === "receitas" ? "receita" : "despesa"))),
  [categorias, fonte]);

  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // ===== A pesquisa em si =====
  const resultado = useMemo(() => {
    const q = norm(texto.trim());
    const dentro = (data) => {
      const d = (data || "").slice(0, 10);
      if (!d) return false;
      if (de && d < de) return false;
      if (ate && d > ate) return false;
      return true;
    };

    let rows = [];
    if (fonte === "proventos") {
      rows = (proventosManuais || [])
        .filter(p => dentro(p.data))
        .filter(p => !q || norm(p.ticker).includes(q) || norm(p.tipo).includes(q))
        .map(p => ({
          id: p.id, data: (p.data || "").slice(0, 10),
          descricao: `${p.ticker}${p.qtd ? ` · ${p.qtd} cotas` : ""}`,
          categoria: p.tipo || "Provento", conta: "",
          valor: Number(p.total) || 0, pendente: false,
        }));
    } else {
      const tipoTx = fonte === "receitas" ? "receita" : "despesa";
      rows = (transacoes || [])
        .filter(t => t.tipo === tipoTx)
        .filter(t => dentro(t.data))
        // Mesmas exclusões dos relatórios: transferências, pagamento de fatura
        // (a despesa são os itens) e o que foi marcado "fora do relatório".
        .filter(t => !t.transferenciaId && t.origem !== "fatura-pagamento" && !t.foraDoRelatorio)
        .filter(t => incluirPendentes || t.compensado)
        .filter(t => !categoria || (t.categoria || "Outros") === categoria)
        .filter(t => !conta || t.conta === conta)
        .filter(t => !q || norm(t.descricao).includes(q) || norm(t.obs).includes(q) || norm(t.categoria).includes(q))
        .map(t => ({
          id: t.id, data: (t.data || "").slice(0, 10),
          descricao: t.descricao || "—",
          categoria: t.categoria || "Outros", conta: t.conta || "",
          valor: Number(t.valor) || 0, pendente: !t.compensado,
        }));
    }
    rows.sort((a, b) => (b.data || "").localeCompare(a.data || ""));

    const total = rows.reduce((s, r) => s + r.valor, 0);

    // Nº de meses do período (pra média): do range escolhido; sem range, os
    // meses efetivamente presentes nos resultados.
    let meses = 1;
    if (de && ate) {
      meses = (parseInt(ate.slice(0, 4)) - parseInt(de.slice(0, 4))) * 12
        + (parseInt(ate.slice(5, 7)) - parseInt(de.slice(5, 7))) + 1;
    } else {
      meses = new Set(rows.map(r => r.data.slice(0, 7))).size || 1;
    }

    const porCat = {};
    rows.forEach(r => { porCat[r.categoria] = (porCat[r.categoria] || 0) + r.valor; });
    const categoriasOrdenadas = Object.entries(porCat).sort((a, b) => b[1] - a[1]);

    const porMes = {};
    rows.forEach(r => { const k = r.data.slice(0, 7); porMes[k] = (porMes[k] || 0) + r.valor; });
    const mesesOrdenados = Object.entries(porMes).sort((a, b) => a[0].localeCompare(b[0]));

    return { rows, total, media: total / Math.max(1, meses), categorias: categoriasOrdenadas, meses: mesesOrdenados };
  }, [fonte, transacoes, proventosManuais, de, ate, texto, categoria, conta, incluirPendentes]);

  const exportarCSV = () => {
    const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const linhas = [["data", "descricao", "categoria", "conta", "valor"].join(";")];
    resultado.rows.forEach(r => linhas.push([r.data, esc(r.descricao), esc(r.categoria), esc(r.conta), String(r.valor).replace(".", ",")].join(";")));
    const blob = new Blob(["﻿" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pesquisa-${fonte}-${de || "inicio"}-a-${ate || "hoje"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const corFonte = fonte === "despesas" ? T.red : fonte === "receitas" ? T.green : T.gold;
  const chip = (ativo) => ({
    padding: "5px 11px", borderRadius: 10, cursor: "pointer", fontSize: 11.5, fontWeight: 600,
    background: ativo ? `${T.gold}22` : T.bgSoft, color: ativo ? T.gold : T.muted,
    border: `1px solid ${ativo ? T.gold : T.border}`, whiteSpace: "nowrap",
  });

  return (
    <div className={embed ? "" : "fade-up py-6 px-6"}>
      {/* Fonte */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {[
          { id: "despesas", l: "💸 Gastos" },
          { id: "receitas", l: "💰 Receitas" },
          { id: "proventos", l: "📈 Proventos / Dividendos" },
        ].map(f => (
          <button key={f.id} onClick={() => { setFonte(f.id); setCategoria(""); }} style={chip(fonte === f.id)}>{f.l}</button>
        ))}
      </div>

      {/* Período */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        {[
          { id: "mes", l: "Este mês" }, { id: "3m", l: "3 meses" }, { id: "6m", l: "6 meses" },
          { id: "ano", l: "Este ano" }, { id: "anoPassado", l: "Ano passado" }, { id: "tudo", l: "Tudo" },
        ].map(r => (
          <button key={r.id} onClick={() => aplicarRapido(r.id)} style={chip(rapido === r.id)}>{r.l}</button>
        ))}
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 11.5, color: T.muted }}>
          <input type="date" value={de} onChange={e => setDe(e.target.value)}
                 style={{ padding: "4px 8px", fontSize: 12, borderRadius: 8, background: T.bgSoft, color: T.ink, border: `1px solid ${T.border}` }} />
          até
          <input type="date" value={ate} onChange={e => setAte(e.target.value)}
                 style={{ padding: "4px 8px", fontSize: 12, borderRadius: 8, background: T.bgSoft, color: T.ink, border: `1px solid ${T.border}` }} />
        </span>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
          <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: T.faint }} />
          <input value={texto} onChange={e => setTexto(e.target.value)}
                 placeholder={fonte === "proventos" ? "Filtrar por ticker (ex.: MXRF11)…" : "Filtrar por texto (ex.: mercado, farmácia)…"}
                 style={{ width: "100%", padding: "7px 10px 7px 28px", fontSize: 12.5, borderRadius: 10, background: T.bgSoft, color: T.ink, border: `1px solid ${T.border}` }} />
        </div>
        {fonte !== "proventos" && (
          <>
            <select value={categoria} onChange={e => setCategoria(e.target.value)}
                    style={{ padding: "7px 10px", fontSize: 12, borderRadius: 10, background: T.bgSoft, color: T.ink, border: `1px solid ${T.border}` }}>
              <option value="">Categoria · todas</option>
              {catsDaFonte.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              <option value="Outros">Outros</option>
            </select>
            <select value={conta} onChange={e => setConta(e.target.value)}
                    style={{ padding: "7px 10px", fontSize: 12, borderRadius: 10, background: T.bgSoft, color: T.ink, border: `1px solid ${T.border}` }}>
              <option value="">Conta · todas</option>
              {(contas || []).map(c => <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>)}
            </select>
            <label style={{ display: "inline-flex", gap: 5, alignItems: "center", fontSize: 11.5, color: T.muted, cursor: "pointer" }}>
              <input type="checkbox" checked={incluirPendentes} onChange={e => setIncluirPendentes(e.target.checked)} style={{ accentColor: T.gold }} />
              incluir pendentes
            </label>
          </>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${corFonte}`, borderRadius: 14, padding: 12 }}>
          <div style={{ fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>Total no período</div>
          <div className="num" style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 700, color: corFonte, marginTop: 4 }}>
            {hidden ? "•••" : fmt(resultado.total)}
          </div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 12 }}>
          <div style={{ fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>Lançamentos</div>
          <div className="num" style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 700, color: T.ink, marginTop: 4 }}>{resultado.rows.length}</div>
        </div>
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 12 }}>
          <div style={{ fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>Média / mês</div>
          <div className="num" style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 700, color: T.ink, marginTop: 4 }}>
            {hidden ? "•••" : fmt(resultado.media)}
          </div>
        </div>
      </div>

      {resultado.rows.length === 0 ? (
        <div style={{ padding: 34, textAlign: "center", color: T.muted, fontStyle: "italic", background: T.card, border: `1px dashed ${T.border}`, borderRadius: 14 }}>
          Nada encontrado com esses filtros. Ajusta o período ou o texto.
        </div>
      ) : (
        <>
          {/* Quebra por categoria + por mês */}
          <div className="pesq-grids" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, fontWeight: 700, marginBottom: 8 }}>
                Por {fonte === "proventos" ? "tipo" : "categoria"}
              </div>
              {resultado.categorias.slice(0, 8).map(([nome, v]) => (
                <div key={nome} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ width: 110, fontSize: 11, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nome}</span>
                  <div style={{ flex: 1, height: 7, borderRadius: 5, background: T.bgSoft, overflow: "hidden" }}>
                    <div style={{ width: `${(v / (resultado.categorias[0]?.[1] || 1)) * 100}%`, height: "100%", background: corFonte, borderRadius: 5 }} />
                  </div>
                  <span className="num" style={{ width: 84, textAlign: "right", fontSize: 11.5, color: T.ink, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {hidden ? "•••" : fmt(v)}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, fontWeight: 700, marginBottom: 8 }}>
                Por mês
              </div>
              {resultado.meses.map(([mes, v]) => (
                <div key={mes} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ width: 52, fontSize: 11, color: T.muted, textTransform: "capitalize" }}>{mesLabel(mes)}</span>
                  <div style={{ flex: 1, height: 7, borderRadius: 5, background: T.bgSoft, overflow: "hidden" }}>
                    <div style={{ width: `${(v / Math.max(...resultado.meses.map(x => x[1]), 1)) * 100}%`, height: "100%", background: corFonte, borderRadius: 5 }} />
                  </div>
                  <span className="num" style={{ width: 84, textAlign: "right", fontSize: 11.5, color: T.ink, fontWeight: 600, whiteSpace: "nowrap" }}>
                    {hidden ? "•••" : fmt(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Lista + exportar */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 11.5, color: T.muted }}>{resultado.rows.length} {resultado.rows.length === 1 ? "lançamento" : "lançamentos"}</span>
              <button onClick={exportarCSV}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 9, fontSize: 11, fontWeight: 600, background: T.bgSoft, color: T.muted, border: `1px solid ${T.border}`, cursor: "pointer" }}>
                <Download size={12} /> CSV
              </button>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {resultado.rows.map(r => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px", borderTop: `1px solid ${T.ink}0a`, fontSize: 12 }}>
                  <span className="num" style={{ width: 66, color: T.faint, flexShrink: 0 }}>{r.data.slice(8, 10)}/{r.data.slice(5, 7)}/{r.data.slice(2, 4)}</span>
                  <span style={{ flex: 1, minWidth: 0, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.descricao}
                    {r.pendente && <span style={{ marginLeft: 6, fontSize: 8.5, padding: "1px 5px", borderRadius: 100, background: `${T.gold}22`, color: T.gold, fontWeight: 700, textTransform: "uppercase" }}>pendente</span>}
                  </span>
                  <span style={{ fontSize: 10.5, color: T.muted, maxWidth: 130, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>{r.categoria}{r.conta ? ` · ${r.conta}` : ""}</span>
                  <span className="num" style={{ width: 92, textAlign: "right", color: corFonte, fontWeight: 600, flexShrink: 0, whiteSpace: "nowrap" }}>
                    {hidden ? "•••" : fmt(r.valor)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <style>{`
        @media (max-width: 720px) { .pesq-grids { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
}
