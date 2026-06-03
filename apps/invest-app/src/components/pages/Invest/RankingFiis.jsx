import React, { useEffect, useMemo, useState } from "react";
import { Building2, Search, RefreshCw, Filter, Sparkles } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { carregarRankingFiis } from "../../../lib/fiisRanking.js";

/**
 * Ranking de FIIs — seleção dos ativos com melhor potencial.
 * Universo via BRAPI; notas (Ativo/Imóvel/Gestão/Geral) pela metodologia.
 * Os campos ainda não automáticos (vacância, nº imóveis, taxa) entram com a
 * CVM depois — aqui mostram "—" sem quebrar o ranking.
 */
export default function RankingFiis({ apiKeys = {}, getFundamentos, preencherIA }) {
  const [estado, setEstado] = useState({ carregando: true, erro: null, linhas: [] });
  const [busca, setBusca] = useState("");
  const [segmento, setSegmento] = useState("");
  const [limite, setLimite] = useState(25);
  const [soPotencial, setSoPotencial] = useState(false);
  const [progresso, setProgresso] = useState(null); // { i, total } durante o preenchimento por IA

  const carregar = async () => {
    setEstado(e => ({ ...e, carregando: true, erro: null }));
    const fundamentos = getFundamentos ? ((await getFundamentos()) || {}) : {};
    const r = await carregarRankingFiis({ token: apiKeys.brapi, fundamentos });
    setEstado({ carregando: false, erro: r.ok ? null : r.erro, linhas: r.linhas || [] });
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [apiKeys.brapi]);

  const segmentos = useMemo(
    () => [...new Set(estado.linhas.map(l => l.segmento).filter(Boolean))].sort(),
    [estado.linhas]
  );

  const filtradas = useMemo(() => {
    const q = busca.trim().toUpperCase();
    return estado.linhas.filter(l => {
      if (soPotencial && !l.notas.melhorPotencial) return false;
      if (segmento && l.segmento !== segmento) return false;
      if (q && !`${l.ticker} ${l.nome}`.toUpperCase().includes(q)) return false;
      return true;
    }).slice(0, limite);
  }, [estado.linhas, busca, segmento, limite, soPotencial]);

  const totalPotencial = estado.linhas.filter(l => l.notas.melhorPotencial).length;
  const semDados = filtradas.filter(l => l.notas.notaImovel == null || l.notas.notaGestao == null);

  // Completa com IA os FIIs visíveis sem dados (vacância/imóveis/taxa) e recalcula.
  const completarComIA = async () => {
    if (!preencherIA || semDados.length === 0) return;
    setProgresso({ i: 0, total: semDados.length });
    for (let i = 0; i < semDados.length; i++) {
      try { await preencherIA(semDados[i]); } catch { /* pula falhas e segue */ }
      setProgresso({ i: i + 1, total: semDados.length });
    }
    setProgresso(null);
    await carregar();
  };

  return (
    <div className="fade-up py-8" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
        <Building2 size={20} style={{ color: T.gold }} />
        <h2 style={{ fontFamily: T.serif, fontSize: 22, color: T.ink, fontWeight: 600 }}>Ranking de FIIs</h2>
        <button onClick={carregar} title="Atualizar"
          style={{ marginLeft: "auto", ...btnGhost(), display: "inline-flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>
      <p style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>
        Seleção dos ativos com melhor potencial pela metodologia (Nota Ativo, Imóvel, Gestão e Geral).
        {estado.linhas.length > 0 && <> · {estado.linhas.length} FIIs · <strong style={{ color: T.green }}>{totalPotencial}</strong> com potencial (Ativo e Imóvel &gt; 8).</>}
      </p>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: T.muted }} />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por código (ex.: HGLG11)"
            style={{ ...inp, paddingLeft: 30 }} />
        </div>
        <select value={segmento} onChange={e => setSegmento(e.target.value)} style={{ ...inp, flex: "0 0 auto", minWidth: 150 }}>
          <option value="">Todos os segmentos</option>
          {segmentos.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={limite} onChange={e => setLimite(Number(e.target.value))} style={{ ...inp, flex: "0 0 auto", width: 110 }}>
          {[10, 15, 25, 50, 100, 200].map(n => <option key={n} value={n}>{n} / página</option>)}
        </select>
        <button onClick={() => setSoPotencial(v => !v)}
          style={{ ...(soPotencial ? btnGold() : btnGhost()), display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Filter size={13} /> Só melhor potencial
        </button>
        {preencherIA && (
          <button onClick={completarComIA} disabled={!!progresso || semDados.length === 0}
            title="Preenche por IA os FIIs visíveis sem vacância/imóveis/taxa"
            style={{ ...btnGhost(), borderColor: T.gold, color: T.gold, display: "inline-flex", alignItems: "center", gap: 6, opacity: semDados.length === 0 ? 0.5 : 1 }}>
            <Sparkles size={13} />
            {progresso ? `Completando ${progresso.i}/${progresso.total}…` : `Completar com IA${semDados.length ? ` (${semDados.length})` : ""}`}
          </button>
        )}
      </div>

      {estado.carregando ? (
        <Box>Carregando FIIs…</Box>
      ) : estado.erro ? (
        <Box erro>{estado.erro}</Box>
      ) : filtradas.length === 0 ? (
        <Box>Nenhum FII encontrado com esses filtros.</Box>
      ) : (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: T.bgSoft }}>
                  <th style={th("center")}>#</th>
                  <th style={th("left")}>Código</th>
                  <th style={th("left")}>Tipo</th>
                  <th style={th("left")}>Segmento</th>
                  <th style={th("center")}>Ativo</th>
                  <th style={th("center")}>Imóvel</th>
                  <th style={th("center")}>Gestão</th>
                  <th style={th("center")}>Geral</th>
                  <th style={th("right")}>DY 12M</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map(l => (
                  <tr key={l.ticker} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ ...td(), textAlign: "center", color: T.muted, fontWeight: 600 }}>{l.rank}</td>
                    <td style={{ ...td(), color: T.ink, fontWeight: 700 }}>{l.ticker}</td>
                    <td style={{ ...td(), color: T.muted }}>{l.tipo || "—"}</td>
                    <td style={{ ...td(), color: T.muted, fontSize: 12 }}>{l.segmento || "—"}</td>
                    <td style={{ ...td(), textAlign: "center" }}><Nota v={l.notas.notaAtivo} /></td>
                    <td style={{ ...td(), textAlign: "center" }}><Nota v={l.notas.notaImovel} /></td>
                    <td style={{ ...td(), textAlign: "center" }}><Nota v={l.notas.notaGestao} /></td>
                    <td style={{ ...td(), textAlign: "center" }}><Nota v={l.notas.notaGeral} forte /></td>
                    <td style={{ ...td(), textAlign: "right" }} className="num">
                      {l.notas.dy != null ? <span style={{ color: T.green, fontWeight: 600 }}>{l.notas.dy.toFixed(2)}%</span> : <span style={{ color: T.faint }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 10.5, color: T.faint, fontStyle: "italic" }}>
        Vacância, nº de imóveis e taxa entram automaticamente com a base da CVM (em construção). Ferramenta educacional, não recomendação.
      </div>
    </div>
  );
}

function Nota({ v, forte }) {
  if (v == null) return <span style={{ color: T.faint, fontSize: 12 }}>—</span>;
  const cor = v >= 8 ? T.green : v >= 6 ? (T.yellow || "#C99A2E") : T.red;
  return (
    <span className="num" style={{
      fontSize: forte ? 14 : 13, fontWeight: 700, color: cor,
      ...(forte ? { background: `${cor}18`, padding: "2px 9px", borderRadius: 100 } : {}),
    }}>{Number.isInteger(v) ? v : v.toFixed(1)}</span>
  );
}

function Box({ children, erro }) {
  return (
    <div style={{
      padding: 40, textAlign: "center", fontStyle: "italic", borderRadius: 12,
      border: `1px dashed ${erro ? T.red : T.border}`, background: T.card,
      color: erro ? T.red : T.muted,
    }}>{children}</div>
  );
}

const th = (a) => ({ padding: "10px 11px", textAlign: a, fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: T.muted, fontWeight: 600 });
const td = () => ({ padding: "10px 11px", verticalAlign: "middle" });
const inp = { padding: "9px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgSoft, color: T.ink, fontSize: 13, width: "100%" };
const btnGold = () => ({ background: T.gold, color: "#1a1407", border: "none", padding: "9px 14px", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" });
const btnGhost = () => ({ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, padding: "9px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer" });
