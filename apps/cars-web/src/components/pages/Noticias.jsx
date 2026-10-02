import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw, Settings, Play, Square, SkipForward, ThumbsUp, ThumbsDown, ExternalLink, X } from "lucide-react";
import { T } from "../../lib/theme.js";
import {
  TEMAS, lerPrefs, salvarPrefs, buscarNoticias, montarBriefing, registrarGosto,
  haQuanto, rotuloTema, lerVistas, marcarVistas,
} from "../../lib/noticias.js";
import { useLeitorVoz } from "../../lib/useLeitorVoz.js";
import PageHeader from "../ui/PageHeader.jsx";
import Modal from "../ui/Modal.jsx";

/** Hook compartilhado (tela + card do Painel): busca ao abrir, prefs, gostos. */
export function useBriefing() {
  const [prefs, setPrefsSt] = useState(lerPrefs);
  const [resultados, setResultados] = useState(null);
  const [estado, setEstado] = useState("carregando"); // carregando | ok | erro
  const [ts, setTs] = useState(null);
  const setPrefs = (p) => { setPrefsSt(p); salvarPrefs(p); };
  const carregar = async (forcar = false) => {
    setEstado("carregando");
    try {
      const r = await buscarNoticias(prefs, { forcar });
      setResultados(r.resultados); setTs(r.ts); setEstado("ok");
    } catch { setEstado("erro"); }
  };
  useEffect(() => { carregar(false); }, [JSON.stringify([prefs.temas, prefs.palavras])]); // eslint-disable-line react-hooks/exhaustive-deps
  const itens = useMemo(() => resultados ? montarBriefing(resultados, prefs) : [], [resultados, prefs]);
  const falhas = (resultados || []).filter(r => r.erro).length;
  return { prefs, setPrefs, itens, estado, ts, carregar, falhas };
}

// Em voz só o título (pedido 2026-10-02: não precisa dizer a fonte).
const manchete = (n) => `${n.titulo}.`;

export function PlayerManchetes({ itens, leitor, rotulo = "Ouvir manchetes", max = 10 }) {
  if (!leitor.ok || !itens.length) return null;
  const lista = itens.slice(0, max);
  return leitor.lendo ? (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 11.5, color: T.gold, fontWeight: 700 }}>🔊 {leitor.atual + 1}/{lista.length}</span>
      <button className="btn-ghost" onClick={leitor.pular} style={{ padding: "6px 10px", fontSize: 11 }} aria-label="Próxima"><SkipForward size={13} /></button>
      <button className="btn-ghost" onClick={leitor.parar} style={{ padding: "6px 10px", fontSize: 11 }} aria-label="Parar"><Square size={13} /></button>
    </span>
  ) : (
    <button className="btn-gold" onClick={() => leitor.ler(["Suas manchetes de agora.", ...lista.map(manchete)])} style={{ padding: "7px 12px", fontSize: 11 }}>
      <Play size={12} className="inline mr-1" /> {rotulo}
    </button>
  );
}

function CardNoticia({ n, lida, lendoEsta, onGosto, onLer, onAbrir }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="card-vivo" style={{ display: "flex", gap: 12, padding: 12, borderRadius: 16, background: T.card, border: `1px solid ${lendoEsta ? T.gold : T.border}`, opacity: lida ? 0.72 : 1 }}>
      {n.imagem && (
        <img src={n.imagem} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }}
             style={{ width: 92, height: 72, objectFit: "cover", borderRadius: 12, flexShrink: 0, background: T.bgSoft }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: T.muted, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontWeight: 700, color: T.gold }}>{rotuloTema(n.tema)}</span>
          <span>· {n.fonte}</span><span>· {haQuanto(n.horas)}</span>
          {!lida && <span style={{ fontSize: 9.5, fontWeight: 800, color: "#0d1f1b", background: "#4DD9C0", borderRadius: 99, padding: "1px 6px" }}>NOVA</span>}
        </div>
        <button onClick={() => setAberto(a => !a)} style={{ all: "unset", cursor: "pointer", display: "block", fontSize: 14.5, fontWeight: 700, color: T.ink, lineHeight: 1.3, marginTop: 4 }}>
          {n.titulo}
        </button>
        {n.resumo && (
          <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.45, marginTop: 4, ...(aberto ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }) }}>
            {n.resumo}
          </div>
        )}
        <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
          <button onClick={onLer} title="Ouvir esta" className="btn-ghost" style={{ padding: "4px 9px", fontSize: 11 }}>🔊</button>
          <button onClick={() => onGosto(1)} title="Quero mais assim" className="btn-ghost" style={{ padding: "4px 9px", fontSize: 11 }}><ThumbsUp size={12} /></button>
          <button onClick={() => onGosto(-1)} title="Menos assim" className="btn-ghost" style={{ padding: "4px 9px", fontSize: 11 }}><ThumbsDown size={12} /></button>
          <a href={n.link} target="_blank" rel="noopener noreferrer" onClick={onAbrir} className="btn-ghost" style={{ padding: "4px 10px", fontSize: 11, textDecoration: "none", marginLeft: "auto" }}>
            Ler matéria <ExternalLink size={11} className="inline" />
          </a>
        </div>
      </div>
    </div>
  );
}

function InteressesModal({ prefs, setPrefs, onClose }) {
  const [palavra, setPalavra] = useState("");
  const alternar = (id) => setPrefs({ ...prefs, temas: prefs.temas.includes(id) ? prefs.temas.filter(x => x !== id) : [...prefs.temas, id] });
  const addPalavra = () => { const p = palavra.trim(); if (!p || prefs.palavras.includes(p)) return; setPrefs({ ...prefs, palavras: [...prefs.palavras, p] }); setPalavra(""); };
  const chip = (on) => ({ padding: "8px 12px", borderRadius: 99, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? T.gold : T.border}`, background: on ? `${T.gold}22` : "transparent", color: on ? T.ink : T.muted });
  return (
    <Modal title="📰 Seus interesses" onClose={onClose} wide>
      <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 10 }}>Escolha os temas — o app traz só isso.</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {TEMAS.map(t => <button key={t.id} style={chip(prefs.temas.includes(t.id))} onClick={() => alternar(t.id)}>{t.icone} {t.label}</button>)}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 6 }}>🔎 Palavras-chave</div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>Empresas, times, lugares… ex.: Petrobras, Porto, Tesla.</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input value={palavra} onChange={e => setPalavra(e.target.value)} onKeyDown={e => e.key === "Enter" && addPalavra()} placeholder="Digite e aperte Enter" style={{ flex: "1 1 auto", minWidth: 0, width: "auto" }} />
        <button className="btn-gold" onClick={addPalavra} style={{ padding: "8px 14px", flex: "0 0 auto", width: "auto" }}>Adicionar</button>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
        {prefs.palavras.map(p => (
          <span key={p} style={{ ...chip(true), display: "inline-flex", alignItems: "center", gap: 6 }}>
            {p}<button onClick={() => setPrefs({ ...prefs, palavras: prefs.palavras.filter(x => x !== p) })} aria-label={`Tirar ${p}`} style={{ all: "unset", cursor: "pointer", display: "grid" }}><X size={12} /></button>
          </span>
        ))}
      </div>
      {prefs.fontesBloq.length > 0 && (<>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 6 }}>🚫 Fontes ocultas</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {prefs.fontesBloq.map(f => (
            <button key={f} style={chip(false)} onClick={() => setPrefs({ ...prefs, fontesBloq: prefs.fontesBloq.filter(x => x !== f) })}>{f} · mostrar de novo</button>
          ))}
        </div>
      </>)}
    </Modal>
  );
}

export default function Noticias() {
  const { prefs, setPrefs, itens, estado, ts, carregar, falhas } = useBriefing();
  const [filtro, setFiltro] = useState("todos");
  const [config, setConfig] = useState(false);
  const [vistas, setVistas] = useState(lerVistas);
  const leitor = useLeitorVoz();
  const lista = filtro === "todos" ? itens : itens.filter(n => n.tema === filtro);
  const temasPresentes = useMemo(() => [...new Set(itens.map(n => n.tema))], [itens]);
  const novas = itens.filter(n => !vistas.has(n.link)).length;

  // Ao sair da tela, o que foi exibido conta como visto (próxima abertura mostra só o "NOVA" de verdade).
  useEffect(() => () => marcarVistas(itens.slice(0, 40).map(n => n.link)), [itens]);

  const gosto = (n, d) => {
    let p = registrarGosto(prefs, n, d);
    if (d < 0 && (p.gostos["fonte:" + n.fonte] || 0) <= -3 && !p.fontesBloq.includes(n.fonte)) p = { ...p, fontesBloq: [...p.fontesBloq, n.fonte] };
    setPrefs(p);
  };

  return (
    <div className="fade-up py-8">
      <PageHeader eyebrow="Agenda" title="Notícias"
        sub="Só os temas que você escolheu — leitura rápida e manchetes em voz alta."
        action={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <PlayerManchetes itens={lista} leitor={leitor} />
            <button className="btn-ghost" onClick={() => carregar(true)} title="Atualizar"><RefreshCw size={13} className={estado === "carregando" ? "spin" : ""} /></button>
            <button className="btn-ghost" onClick={() => setConfig(true)}><Settings size={13} className="inline mr-1" /> Interesses</button>
          </div>
        } />

      <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>
        {estado === "carregando" ? "Buscando novidades…" : estado === "erro" ? "⚠ Não consegui buscar agora (sem internet?). Toque em atualizar." :
          `${novas} novidade${novas === 1 ? "" : "s"} · ${itens.length} no total${ts ? ` · atualizado às ${new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}${falhas ? ` · ${falhas} fonte(s) fora do ar` : ""}`}
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 12 }}>
        {["todos", ...temasPresentes].map(t => (
          <button key={t} onClick={() => setFiltro(t)}
                  style={{ padding: "6px 12px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                           border: `1px solid ${filtro === t ? T.gold : T.border}`, background: filtro === t ? `${T.gold}22` : "transparent", color: filtro === t ? T.ink : T.muted }}>
            {t === "todos" ? "Tudo" : rotuloTema(t)}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lista.map((n, i) => (
          <CardNoticia key={n.link} n={n} lida={vistas.has(n.link)} lendoEsta={leitor.lendo && leitor.atual === i + 1}
                       onGosto={(d) => gosto(n, d)}
                       onLer={() => leitor.ler([manchete(n), n.resumo].filter(Boolean))}
                       onAbrir={() => { marcarVistas([n.link]); setVistas(lerVistas()); }} />
        ))}
        {estado === "ok" && !lista.length && (
          <div style={{ textAlign: "center", padding: 30, color: T.muted, fontSize: 13 }}>Nada novo nos seus temas agora. Que tal adicionar palavras-chave em "Interesses"?</div>
        )}
      </div>
      {config && <InteressesModal prefs={prefs} setPrefs={setPrefs} onClose={() => setConfig(false)} />}
      <style>{`.spin { animation: girar 1s linear infinite; } @keyframes girar { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
