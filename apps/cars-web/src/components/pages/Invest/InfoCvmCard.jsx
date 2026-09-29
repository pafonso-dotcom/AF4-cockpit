import React, { useState } from "react";
import { FileText, ExternalLink } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { CARD_SHADOW } from "../../../lib/styles.js";
import { getPerfilAtivo } from "../../../lib/brapi.js";

/* ==================== Informações & relatórios CVM ====================
   Morava no Painel do Invest; movido pra CARTEIRA a pedido (2026-09-29) —
   é onde se olha ativo por ativo. Extraído pra arquivo próprio. */
// Perfil oficial (brapi ?modules=summaryProfile) do papel escolhido + links
// diretos pros documentos oficiais (RAD/FNET da CVM) e páginas de consulta.
const KEY_PERFIS = "af4:perfil-ativo:v1";
export default function InfoCvmCard({ ativos = [] }) {
  const elegiveis = (ativos || []).filter(a => ["acao", "fii", "stock", "reit", "etf"].includes((a.tipo || "").toLowerCase()));
  const [ticker, setTicker] = useState(() => (elegiveis[0]?.ticker || "").toUpperCase());
  const [perfis, setPerfis] = useState(() => { try { return JSON.parse(localStorage.getItem(KEY_PERFIS) || "{}") || {}; } catch { return {}; } });
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState("");
  const perfil = perfis[ticker] || null;
  const ativoSel = elegiveis.find(a => (a.ticker || "").toUpperCase() === ticker);
  const ehFii = (ativoSel?.tipo || "").toLowerCase() === "fii";

  async function buscar() {
    if (!ticker) return;
    setBuscando(true); setErro("");
    try {
      const p = await getPerfilAtivo(ticker);
      if (!p) throw new Error("A brapi não devolveu o perfil desse ticker.");
      const novo = { ...perfis, [ticker]: { ...p, atualizadoEm: new Date().toISOString() } };
      setPerfis(novo);
      try { localStorage.setItem(KEY_PERFIS, JSON.stringify(novo)); } catch {}
    } catch (e) { setErro(e.message || "Falha ao buscar o perfil."); }
    finally { setBuscando(false); }
  }

  const links = ticker ? [
    ehFii
      ? { label: "Relatórios CVM (FNET)", url: "https://fnet.bmfbovespa.com.br/fnet/publico/abrirGerenciadorDocumentosCVM" }
      : { label: "Relatórios CVM (RAD)", url: "https://www.rad.cvm.gov.br/ENET/frmConsultaExternaCVM.aspx" },
    { label: "Fatos relevantes", url: `https://www.google.com/search?q=${encodeURIComponent(ticker + " fato relevante CVM")}` },
    { label: "StatusInvest", url: `https://statusinvest.com.br/${ehFii ? "fundos-imobiliarios" : "acoes"}/${ticker.toLowerCase()}` },
    ...(perfil?.site ? [{ label: "Site / RI", url: perfil.site }] : []),
  ] : [];

  return (
    <div className="ip-card" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 10, boxShadow: CARD_SHADOW }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <FileText size={15} style={{ color: T.gold }} />
        <div style={{ fontFamily: T.serif, fontSize: 13.5, fontWeight: 600 }}>Informações & Relatórios CVM</div>
        <select value={ticker} onChange={e => setTicker(e.target.value)}
                style={{ marginLeft: "auto", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 12, padding: "7px 10px", color: T.ink, fontSize: 12.5, fontFamily: "inherit", maxWidth: 180 }}>
          {elegiveis.map(a => <option key={a.id || a.ticker} value={(a.ticker || "").toUpperCase()}>{(a.ticker || "").toUpperCase()}</option>)}
        </select>
        <button onClick={buscar} disabled={buscando || !ticker}
                style={{ background: T.gold, color: "#fff", border: "none", borderRadius: 12, padding: "7px 13px", fontSize: 12, fontWeight: 700, cursor: buscando ? "wait" : "pointer", opacity: buscando ? 0.7 : 1 }}>
          {buscando ? "Buscando…" : perfil ? "Atualizar" : "Buscar informações"}
        </button>
      </div>

      {erro && <div style={{ fontSize: 12, color: T.red, marginBottom: 8 }}>{erro}</div>}

      {perfil ? (
        <>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12, color: T.muted, marginBottom: 8 }}>
            <span><b style={{ color: T.ink }}>{perfil.nome || ticker}</b></span>
            {perfil.setor && <span>Setor: <b style={{ color: T.ink }}>{perfil.setor}</b></span>}
            {perfil.industria && <span>Segmento: <b style={{ color: T.ink }}>{perfil.industria}</b></span>}
            {perfil.cidade && <span>{perfil.cidade}</span>}
            {perfil.funcionarios != null && <span>{Number(perfil.funcionarios).toLocaleString("pt-BR")} funcionários</span>}
          </div>
          {perfil.resumo && (
            <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.55, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {perfil.resumo}
            </div>
          )}
        </>
      ) : !erro && (
        <div style={{ fontSize: 12, color: T.faint, fontStyle: "italic", marginBottom: 10 }}>
          Escolha um papel e clique em "Buscar informações" — setor, segmento e descrição oficiais via brapi.
        </div>
      )}

      {links.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {links.map(l => (
            <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
               style={{ display: "inline-flex", alignItems: "center", gap: 5, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 999, padding: "4px 11px", fontSize: 11.5, color: T.gold, textDecoration: "none", fontWeight: 600 }}>
              <ExternalLink size={11} /> {l.label}
            </a>
          ))}
        </div>
      )}
      {perfil?.atualizadoEm && (
        <div style={{ fontSize: 10, color: T.faint, marginTop: 8 }}>
          Perfil atualizado em {new Date(perfil.atualizadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · fonte: brapi.
        </div>
      )}
    </div>
  );
}
