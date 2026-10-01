import React, { useEffect, useRef, useState } from "react";
import { Mic, X, Volume2, VolumeX, Send, Sparkles } from "lucide-react";
import { T } from "../lib/theme.js";
import { responder } from "../lib/assistenteIntencoes.js";
import { faturaEmAberto, mesAtualKey } from "../lib/cartaoFatura.js";
import { resumoAPagar } from "../lib/aPagar.js";
import { calcularPossoGastar } from "../lib/possoGastar.js";
import { filtrarPorEscopo } from "../lib/escopo.js";
import { lerCompCfg, partesPatrimonio, totalPatrimonio } from "../lib/patrimonio.js";
import { perguntarAoClaude, buildContext } from "../lib/aiChat.js";

/**
 * 🎙 Assistente de voz (2026-10-01) — consulta rápida por voz.
 * Abre pelo 🎙 do cabeçalho (evento "af4:assistente-abrir", disparado no
 * PRÓPRIO toque: o iPhone só libera microfone e fala dentro do gesto).
 * Fase 1: intenções locais (lib/assistenteIntencoes.js), nada sai do
 * aparelho. Fase 2: o que não casar pode ir pra IA (botão explícito).
 */
export const ABRIR_ASSISTENTE = "af4:assistente-abrir";
const MUDO_KEY = "af4:assistente-mudo:v1";

const SR = typeof window !== "undefined" ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

function vozPtBR() {
  try {
    const vs = window.speechSynthesis?.getVoices?.() || [];
    const pt = vs.filter(v => /^pt[-_]BR/i.test(v.lang));
    return pt.find(v => /luciana|felipe|google|premium|enhanced/i.test(v.name)) || pt[0] || null;
  } catch { return null; }
}
function falar(texto, mudo) {
  try {
    if (mudo || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "pt-BR";
    const v = vozPtBR();
    if (v) u.voice = v;
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  } catch {}
}
// iOS: a 1ª fala precisa nascer num toque — destrava com uma fala muda.
function destravarFala() {
  try {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {}
}
const semMarkdown = (s) => String(s || "").replace(/[*_#`>]+/g, "").replace(/\n{2,}/g, "\n").trim();

export default function AssistenteVoz(props) {
  const dadosRef = useRef(props);
  dadosRef.current = props;
  const [aberto, setAberto] = useState(false);
  const [ouvindo, setOuvindo] = useState(false);
  const [parcial, setParcial] = useState("");
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState(null); // { texto, ok, ia? }
  const [aviso, setAviso] = useState("");
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [mudo, setMudo] = useState(() => { try { return localStorage.getItem(MUDO_KEY) === "1"; } catch { return false; } });
  const mudoRef = useRef(mudo); mudoRef.current = mudo;
  const recRef = useRef(null);
  const inputRef = useRef(null);

  const montarContexto = () => {
    const d = dadosRef.current;
    const escopo = d.escopoAtivo || "tudo";
    const contasRaw = d.contas || [];
    const contasEsc = filtrarPorEscopo(contasRaw, escopo);
    const setContas = new Set(contasEsc.map(c => c.nome));
    const transacoesEsc = escopo === "tudo" ? (d.transacoes || []) : (d.transacoes || []).filter(t => t.conta && setContas.has(t.conta));
    const aPagar = resumoAPagar({ dividas: d.dividas, fixas: d.fixas, fixaOcorrencias: d.fixaOcorrencias, parcelamentos: d.parcelamentos, transacoes: d.transacoes }, new Date());
    let possoGastar = null;
    try {
      possoGastar = calcularPossoGastar({
        transacoes: transacoesEsc, contas: contasEsc, fixas: d.fixas, fixaOcorrencias: d.fixaOcorrencias,
        parcelamentos: d.parcelamentos, dividas: d.dividas, devedores: d.devedores, cartoes: d.cartoes, cheques: d.cheques,
      }, escopo);
    } catch {}
    const partes = partesPatrimonio({
      contas: contasRaw, ativos: d.ativos, carteiraProventos: d.carteiraProventos, devedores: d.devedores,
      cheques: d.cheques, aPagarTotal: aPagar.total, escopo,
    });
    const pl = d.planilhaLivre || [];
    const contas = contasRaw.map(c => {
      if (!c.planilha) return c;
      const res = pl.filter(l => l.contaId === c.id).reduce((s, l) => s + (l.tipo === "entrada" ? 1 : -1) * (Number(l.valor) || 0), 0);
      return { ...c, previsto: (Number(c.saldo) || 0) + res };
    });
    const mk = mesAtualKey();
    return {
      cartoes: d.cartoes || [], contas,
      faturaDe: (c) => faturaEmAberto(c, d.parcelamentos || [], d.transacoes || [], mk),
      possoGastar, aPagar,
      patrimonio: totalPatrimonio(partes, lerCompCfg()),
    };
  };

  const processar = (frase) => {
    const f = String(frase || "").trim();
    if (!f) return;
    setPergunta(f);
    setParcial("");
    let r;
    try { r = responder(f, montarContexto()); } catch (e) { r = { ok: false }; }
    if (r.ok) {
      setResposta({ ok: true, texto: r.texto });
      falar(r.fala, mudoRef.current);
    } else {
      setResposta({ ok: false, texto: "Não achei isso nas respostas rápidas. Posso perguntar à IA?" });
      falar("Não achei isso nas respostas rápidas. Quer que eu pergunte à inteligência artificial?", mudoRef.current);
    }
  };

  const pararOuvir = () => { try { recRef.current?.abort(); } catch {} recRef.current = null; setOuvindo(false); };

  const ouvir = () => {
    destravarFala();
    setAviso("");
    if (!SR) {
      setAviso("Microfone direto não funciona neste navegador — toque no campo abaixo e use o 🎤 do teclado.");
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }
    pararOuvir();
    try { window.speechSynthesis?.cancel(); } catch {}
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let final = "";
    rec.onresult = (ev) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0]?.transcript || "";
        if (ev.results[i].isFinal) final += t; else interim += t;
      }
      setParcial(final || interim);
    };
    rec.onerror = (ev) => {
      const e = ev?.error;
      if (e === "not-allowed" || e === "service-not-allowed") {
        setAviso("Sem permissão de microfone aqui — use o 🎤 do teclado no campo abaixo (ou libere o microfone nos Ajustes).");
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e === "no-speech") {
        setAviso("Não ouvi nada — toque no 🎙 e fale de novo.");
      } else if (e && e !== "aborted") {
        setAviso(`Falha no reconhecimento (${e}). Tente de novo ou digite abaixo.`);
      }
    };
    rec.onend = () => {
      setOuvindo(false);
      recRef.current = null;
      if (final.trim()) processar(final);
    };
    recRef.current = rec;
    try { rec.start(); setOuvindo(true); }
    catch { setOuvindo(false); setAviso("Não consegui abrir o microfone — use o 🎤 do teclado abaixo."); }
  };
  const ouvirRef = useRef(ouvir); ouvirRef.current = ouvir;

  useEffect(() => {
    // Abre E começa a ouvir no mesmo toque (dispatchEvent é síncrono).
    const abrir = () => { setAberto(true); setResposta(null); setPergunta(""); ouvirRef.current(); };
    window.addEventListener(ABRIR_ASSISTENTE, abrir);
    return () => window.removeEventListener(ABRIR_ASSISTENTE, abrir);
  }, []);
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e) => { if (e.key === "Escape") fechar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  const fechar = () => {
    pararOuvir();
    try { window.speechSynthesis?.cancel(); } catch {}
    setAberto(false);
  };

  const perguntarIA = async () => {
    const d = dadosRef.current;
    const apiKey = d.apiKeys?.anthropic;
    if (!apiKey) {
      setResposta({ ok: false, texto: "Pra perguntas livres preciso da chave Anthropic (Configurações → APIs)." });
      return;
    }
    destravarFala();
    setPensando(true);
    try {
      const ctx = montarContexto();
      const extra = [
        `Patrimônio total (card do Painel): ${ctx.patrimonio.toFixed(2)}`,
        `A pagar em aberto: ${ctx.aPagar.total.toFixed(2)} · neste mês: ${ctx.aPagar.pagarMes.toFixed(2)}`,
        ctx.possoGastar ? `Pode gastar hoje: ${ctx.possoGastar.porDia.toFixed(2)} (sobra do mês ${ctx.possoGastar.sobraMes.toFixed(2)})` : "",
        "Faturas em aberto: " + ctx.cartoes.map(c => `${c.nome} ${ctx.faturaDe(c).valor.toFixed(2)}`).join("; "),
        "Saldos: " + ctx.contas.map(c => `${c.nome} ${(Number(c.saldo) || 0).toFixed(2)}${c.moeda && c.moeda !== "BRL" ? " " + c.moeda : ""}`).join("; "),
      ].filter(Boolean).join("\n");
      const contextoDados = buildContext(d) + "\n\nRESUMO DO PAINEL:\n" + extra +
        "\n\nResponda em no máximo 2 frases curtas, sem markdown — a resposta será FALADA em voz alta.";
      const r = semMarkdown(await perguntarAoClaude({ apiKey, pergunta, contextoDados }));
      setResposta({ ok: true, ia: true, texto: r });
      falar(r, mudoRef.current);
    } catch (e) {
      setResposta({ ok: false, texto: e?.message || "A IA não respondeu agora." });
    } finally {
      setPensando(false);
    }
  };

  if (!aberto) return null;

  const d = props;
  const cart0 = (d.cartoes || [])[0]?.nome;
  const conta0 = ((d.contas || []).find(c => c.planilha) || (d.contas || [])[0])?.nome;
  const sugestoes = [
    cart0 && `Fatura do ${cart0}`,
    "Quanto posso gastar hoje?",
    "O que vence essa semana?",
    conta0 && `Saldo da ${conta0}`,
    "Quanto tenho a pagar este mês?",
    "Qual meu patrimônio?",
  ].filter(Boolean);

  const chip = { fontSize: 12.5, padding: "6px 11px", borderRadius: 100, background: T.bgSoft, border: `1px solid ${T.border}`, color: T.ink, cursor: "pointer", whiteSpace: "nowrap" };

  return (
    <div onClick={fechar} style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} className="assistente-sheet"
           style={{ width: "100%", maxWidth: 520, background: T.card, color: T.ink, borderRadius: "20px 20px 0 0",
                    padding: "14px 16px calc(18px + env(safe-area-inset-bottom, 0))", boxShadow: "0 -10px 30px rgba(0,0,0,.35)",
                    maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>🎙 Assistente</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => { const v = !mudo; setMudo(v); try { localStorage.setItem(MUDO_KEY, v ? "1" : "0"); } catch {} if (v) try { window.speechSynthesis?.cancel(); } catch {} }}
                    aria-label={mudo ? "Ligar voz da resposta" : "Silenciar voz da resposta"} title={mudo ? "Resposta só na tela" : "Resposta falada"}
                    style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${T.border}`, background: T.bgSoft, color: mudo ? T.muted : T.gold, display: "grid", placeItems: "center", cursor: "pointer" }}>
              {mudo ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button onClick={fechar} aria-label="Fechar assistente"
                    style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${T.border}`, background: T.bgSoft, color: T.muted, display: "grid", placeItems: "center", cursor: "pointer" }}>
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "6px 0 12px" }}>
          <button onClick={() => (ouvindo ? pararOuvir() : ouvir())} aria-label={ouvindo ? "Parar de ouvir" : "Falar"}
                  className={ouvindo ? "assistente-mic ouvindo" : "assistente-mic"}
                  style={{ width: 76, height: 76, borderRadius: "50%", border: "none", cursor: "pointer",
                           background: ouvindo ? T.red : T.gold, color: "#fff", display: "grid", placeItems: "center",
                           boxShadow: `0 6px 18px ${ouvindo ? T.red : T.gold}66` }}>
            <Mic size={32} />
          </button>
          <div style={{ fontSize: 13, color: T.muted, minHeight: 18, textAlign: "center" }}>
            {ouvindo ? (parcial ? `“${parcial}”` : "Ouvindo… pode falar") : pensando ? "Pensando…" : "Toque no microfone e pergunte"}
          </div>
        </div>

        {aviso && <div style={{ fontSize: 12.5, color: T.gold, background: `${T.gold}14`, border: `1px solid ${T.gold}44`, borderRadius: 10, padding: "8px 10px", marginBottom: 10 }}>{aviso}</div>}

        {pergunta && !ouvindo && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <div style={{ maxWidth: "85%", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: "14px 14px 4px 14px", padding: "8px 12px", fontSize: 14 }}>{pergunta}</div>
          </div>
        )}
        {resposta && !ouvindo && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ maxWidth: "92%", background: resposta.ok ? `${T.gold}16` : T.bgSoft, border: `1px solid ${resposta.ok ? T.gold + "55" : T.border}`,
                          borderRadius: "14px 14px 14px 4px", padding: "10px 13px", fontSize: 16, lineHeight: 1.4, fontWeight: resposta.ok ? 600 : 400, whiteSpace: "pre-wrap" }}>
              {resposta.ia && <span style={{ fontSize: 11, color: T.muted, fontWeight: 700, display: "block", marginBottom: 3 }}>✨ IA</span>}
              {resposta.texto}
            </div>
            {!resposta.ok && pergunta && !resposta.ia && (
              <button onClick={perguntarIA} disabled={pensando}
                      style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "none", background: T.gold, color: "#fff", fontWeight: 700, cursor: "pointer", opacity: pensando ? 0.6 : 1 }}>
                <Sparkles size={15} /> {pensando ? "Perguntando…" : "Perguntar à IA"}
              </button>
            )}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); const f = texto; setTexto(""); processar(f); }}
              style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input ref={inputRef} value={texto} onChange={(e) => setTexto(e.target.value)}
                 placeholder="…ou digite / dite pelo teclado" enterKeyHint="send"
                 style={{ flex: 1, minWidth: 0, fontSize: 16, padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.bg, color: T.ink }} />
          <button type="submit" aria-label="Perguntar"
                  style={{ width: 44, borderRadius: 10, border: "none", background: T.gold, color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}>
            <Send size={17} />
          </button>
        </form>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {sugestoes.map(s => <button key={s} onClick={() => processar(s)} style={chip}>{s}</button>)}
        </div>
      </div>
      <style>{`
        .assistente-mic.ouvindo { animation: assistentePulso 1.2s ease-in-out infinite; }
        @keyframes assistentePulso { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
      `}</style>
    </div>
  );
}
