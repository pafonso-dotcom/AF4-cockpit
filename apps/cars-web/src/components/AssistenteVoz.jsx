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
import { categoriaAuto } from "../lib/autoCategorizar.js";

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
/** Fala e resolve quando terminar (ou por tempo, se o onend não vier — iOS). */
function falar(texto, mudo) {
  return new Promise((resolve) => {
    try {
      if (mudo || !window.speechSynthesis || !texto) { resolve(); return; }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = "pt-BR";
      const v = vozPtBR();
      if (v) u.voice = v;
      u.rate = 1.05;
      u.volume = 1;
      let feito = false;
      const fim = () => { if (!feito) { feito = true; resolve(); } };
      u.onend = fim; u.onerror = fim;
      setTimeout(fim, 2500 + texto.length * 85);
      // speak() logo após cancel() às vezes é descartado no Safari.
      setTimeout(() => { try { window.speechSynthesis.speak(u); } catch { fim(); } }, 120);
    } catch { resolve(); }
  });
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
  const [pendente, setPendente] = useState(null); // lançamento aguardando confirmação
  const [mudo, setMudo] = useState(() => { try { return localStorage.getItem(MUDO_KEY) === "1"; } catch { return false; } });
  const mudoRef = useRef(mudo); mudoRef.current = mudo;
  const recRef = useRef(null);
  const vaziasRef = useRef(0);
  // Modo conversa: depois de responder volta a ouvir sozinho até este horário
  // (cada pergunta renova 1 min). Sem perguntas, desliga.
  const conversaAteRef = useRef(0);
  const abertoRef = useRef(false); abertoRef.current = aberto;
  const [conversa, setConversa] = useState(false);
  const JANELA = 60000;
  const renovarConversa = () => { conversaAteRef.current = Date.now() + JANELA; setConversa(true); };
  const conversaViva = () => abertoRef.current && Date.now() < conversaAteRef.current;
  const encerrarConversa = () => { conversaAteRef.current = 0; setConversa(false); };
  // Responde falando e, no modo conversa, volta a ouvir ao terminar.
  const responderEOuvir = async (fala, continuar = true) => {
    await falar(fala, mudoRef.current);
    if (continuar && conversaViva()) setTimeout(() => { if (conversaViva()) ouvirRef.current?.(true); }, 600);
    else if (!conversaViva()) encerrarConversa();
  };
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
      categorias: d.categorias || [], historico: d.transacoes || [], categoriaAuto,
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
    renovarConversa();
    let r;
    try { r = responder(f, montarContexto()); } catch (e) { r = { ok: false }; }
    setPendente(null);
    if (r.ok && r.lancamento) {
      const l = r.lancamento;
      setPendente({ ...l, valor: String(l.valor).replace(".", ","),
        destinoKey: l.destino ? `${l.destino.tipo}:${l.destino.item.id}` : "" });
      setResposta({ ok: true, texto: r.texto });
      encerrarConversa(); // revisão do lançamento é no toque
      falar(r.fala, mudoRef.current);
    } else if (r.ok && r.nav) {
      setResposta({ ok: true, texto: r.texto });
      encerrarConversa();
      falar(r.fala, mudoRef.current);
      try { dadosRef.current.onNavegar?.(r.nav); } catch {}
      setTimeout(() => { pararOuvir(); setAberto(false); }, 700);
    } else if (r.ok) {
      setResposta({ ok: true, texto: r.texto });
      responderEOuvir(r.fala);
    } else {
      setResposta({ ok: false, texto: "Não achei isso nas respostas rápidas. Posso perguntar à IA?" });
      responderEOuvir("Não achei isso nas respostas rápidas. Pode perguntar de outro jeito, ou tocar em perguntar à IA.");
    }
  };

  const pararOuvir = () => { const r = recRef.current; recRef.current = null; try { r?.abort(); } catch {} setOuvindo(false); };

  const ouvir = (auto = false) => {
    if (!auto) { destravarFala(); renovarConversa(); vaziasRef.current = 0; }
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
    // Safari/iPhone quase nunca marca o resultado como final e não encerra
    // sozinho no silêncio: guardamos o último texto ouvido e encerramos após
    // ~1,3 s sem palavra nova; aí a pergunta é o que foi ouvido até ali.
    let texto = "";
    let tSilencio = null;
    let tSemNada = null;
    let entregue = false;
    const inicio = Date.now();
    const entregar = () => {
      if (entregue) return;
      entregue = true;
      clearTimeout(tSilencio); clearTimeout(tSemNada);
      if (recRef.current === rec) recRef.current = null;
      setOuvindo(false);
      const f = texto.trim();
      if (f) { vaziasRef.current = 0; processar(f); return; }
      // Nada ouvido. Na conversa tenta de novo, mas sem loop: 2 vazias
      // seguidas (ou o microfone fechando na hora) desligam a conversa.
      vaziasRef.current += 1;
      const rapido = Date.now() - inicio < 1200;
      if (auto && conversaViva() && vaziasRef.current < 2 && !rapido && erro !== "not-allowed" && erro !== "service-not-allowed")
        setTimeout(() => { if (conversaViva() && !recRef.current) ouvirRef.current?.(true); }, 400);
      else encerrarConversa();
    };
    const encerrarEscuta = () => {
      try { rec.stop(); } catch {}
      setTimeout(entregar, 1500); // se o onend não vier
    };
    rec.onresult = (ev) => {
      const t = Array.from(ev.results).map(r => r[0]?.transcript || "").join("");
      if (t.trim()) texto = t;
      setParcial(texto);
      clearTimeout(tSemNada);
      clearTimeout(tSilencio);
      tSilencio = setTimeout(encerrarEscuta, 1300);
      if (Array.from(ev.results).some(r => r.isFinal) && !rec.continuous) tSilencio = setTimeout(encerrarEscuta, 400);
    };
    // Ninguém falou em 8 s: encerra.
    tSemNada = setTimeout(encerrarEscuta, 8000);
    let erro = null;
    rec.onerror = (ev) => {
      const e = ev?.error;
      erro = e;
      if (auto && (e === "no-speech" || e === "aborted")) return;
      if (auto && (e === "not-allowed" || e === "service-not-allowed")) { encerrarConversa(); return; }
      if (e === "not-allowed" || e === "service-not-allowed") {
        setAviso("Sem permissão de microfone aqui — use o 🎤 do teclado no campo abaixo (ou libere o microfone nos Ajustes).");
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e === "no-speech") {
        if (!texto.trim()) setAviso("Não ouvi nada — toque na bolha e fale de novo.");
      } else if (e && e !== "aborted") {
        setAviso(`Falha no reconhecimento (${e}). Tente de novo ou digite abaixo.`);
      }
    };
    rec.onend = () => {
      if (entregue) return;
      if (recRef.current !== rec && !texto.trim()) { entregue = true; clearTimeout(tSilencio); clearTimeout(tSemNada); return; } // abortado
      entregar();
    };
    recRef.current = rec;
    try { rec.start(); setOuvindo(true); }
    catch {
      setOuvindo(false); recRef.current = null;
      if (auto) encerrarConversa();
      else setAviso("Não consegui abrir o microfone — use o 🎤 do teclado abaixo.");
    }
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
    encerrarConversa();
    pararOuvir();
    try { window.speechSynthesis?.cancel(); } catch {}
    setAberto(false);
  };

  const confirmarLancamento = () => {
    const p = pendente;
    const valor = Number(String(p.valor).replace(/\./g, "").replace(",", "."));
    if (!(valor > 0)) { setAviso("Valor inválido."); return; }
    const [tipoDest, idDest] = String(p.destinoKey || "").split(":");
    const d = dadosRef.current;
    const item = tipoDest === "cartao" ? (d.cartoes || []).find(c => c.id === idDest)
      : tipoDest === "conta" ? (d.contas || []).find(c => c.id === idDest) : null;
    if (!item) { setAviso("Escolha a conta ou o cartão."); return; }
    try {
      d.onLancar?.({ tipo: p.tipo, valor, descricao: (p.descricao || "").trim() || "Lançamento por voz",
        categoria: p.categoria || "Outros", data: p.data, destino: { tipo: tipoDest, item } });
    } catch { setAviso("Não consegui lançar."); return; }
    setPendente(null);
    setAviso("");
    const txt = `Lançado: ${p.descricao} ${p.tipo === "receita" ? "+" : "−"}R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ${tipoDest === "cartao" ? "no cartão" : "na conta"} ${item.nome}.`;
    setResposta({ ok: true, texto: "✅ " + txt });
    renovarConversa();
    responderEOuvir("Lançado.");
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
      renovarConversa();
      responderEOuvir(r);
    } catch (e) {
      setResposta({ ok: false, texto: e?.message || "A IA não respondeu agora." });
    } finally {
      setPensando(false);
    }
  };

  if (!aberto) return null;

  const d = props;
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
          <button onClick={() => (ouvindo ? (encerrarConversa(), pararOuvir()) : ouvir())} aria-label={ouvindo ? "Parar de ouvir" : "Falar"}
                  className={ouvindo ? "assistente-mic ouvindo" : "assistente-mic"}
                  style={{ "--bolha": ouvindo ? T.red : T.gold }}>
            <Mic size={32} strokeWidth={2.2} style={{ position: "relative", zIndex: 1, filter: "drop-shadow(0 1px 2px rgba(0,0,0,.35))" }} />
          </button>
          <div style={{ fontSize: 13, color: T.muted, minHeight: 18, textAlign: "center" }}>
            {ouvindo ? (parcial ? `“${parcial}”` : (pergunta ? "Pode perguntar de novo…" : "Ouvindo… pode falar")) : pensando ? "Pensando…" : pergunta ? `“${pergunta}”` : "Toque no microfone e pergunte"}
          </div>
          {conversa && (
            <div style={{ fontSize: 11.5, color: T.green, fontWeight: 600 }}>● conversa ligada — pode emendar outra pergunta</div>
          )}
        </div>

        {aviso && <div style={{ fontSize: 12.5, color: T.gold, background: `${T.gold}14`, border: `1px solid ${T.gold}44`, borderRadius: 10, padding: "8px 10px", marginBottom: 10 }}>{aviso}</div>}

        {resposta && !(ouvindo && parcial) && (
          <div style={{ marginBottom: 12, textAlign: "center" }}>
            <div style={{ margin: "0 auto", textAlign: "center", background: resposta.ok ? `${T.gold}16` : T.bgSoft, border: `1px solid ${resposta.ok ? T.gold + "55" : T.border}`,
                          borderRadius: 14, padding: "12px 14px", fontSize: 17, lineHeight: 1.4, fontWeight: resposta.ok ? 600 : 400, whiteSpace: "pre-wrap" }}>
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

        {pendente && !ouvindo && (() => {
          const inp = { width: "100%", fontSize: 16, padding: "8px 10px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.bg, color: T.ink, boxSizing: "border-box" };
          const lbl = { fontSize: 11, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 3, display: "block" };
          const cats = (d.categorias || []).filter(c => c?.nome && (!c.tipo || c.tipo === pendente.tipo)).map(c => c.nome);
          return (
            <div style={{ border: `1.5px solid ${T.gold}`, borderRadius: 14, padding: 12, marginBottom: 12, background: `${T.gold}0c` }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {["despesa", "receita"].map(tp => (
                  <button key={tp} onClick={() => setPendente(p => ({ ...p, tipo: tp, destinoKey: tp === "receita" && p.destinoKey.startsWith("cartao") ? "" : p.destinoKey }))}
                          style={{ flex: 1, padding: "7px 0", borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: 13,
                                   border: `1px solid ${pendente.tipo === tp ? (tp === "despesa" ? T.red : T.green) : T.border}`,
                                   background: pendente.tipo === tp ? `${tp === "despesa" ? T.red : T.green}1c` : "transparent",
                                   color: pendente.tipo === tp ? (tp === "despesa" ? T.red : T.green) : T.muted }}>
                    {tp === "despesa" ? "− Despesa" : "+ Receita"}
                  </button>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label><span style={lbl}>Valor (R$)</span>
                  <input inputMode="decimal" value={pendente.valor} onChange={e => setPendente(p => ({ ...p, valor: e.target.value }))} style={inp} /></label>
                <label><span style={lbl}>Data</span>
                  <input type="date" value={pendente.data} onChange={e => setPendente(p => ({ ...p, data: e.target.value }))} style={inp} /></label>
                <label style={{ gridColumn: "1 / -1" }}><span style={lbl}>Descrição</span>
                  <input value={pendente.descricao} onChange={e => setPendente(p => ({ ...p, descricao: e.target.value }))} style={inp} /></label>
                <label><span style={lbl}>Categoria</span>
                  <select value={pendente.categoria} onChange={e => setPendente(p => ({ ...p, categoria: e.target.value }))} style={inp}>
                    {[...new Set([pendente.categoria, ...cats])].map(n => <option key={n} value={n}>{n}</option>)}
                  </select></label>
                <label><span style={lbl}>Onde</span>
                  <select value={pendente.destinoKey} onChange={e => setPendente(p => ({ ...p, destinoKey: e.target.value }))}
                          style={{ ...inp, borderColor: pendente.destinoKey ? T.border : T.gold }}>
                    <option value="">Escolher…</option>
                    {pendente.tipo === "despesa" && (d.cartoes || []).length > 0 && (
                      <optgroup label="Cartões">{(d.cartoes || []).map(c => <option key={c.id} value={`cartao:${c.id}`}>💳 {c.nome}</option>)}</optgroup>
                    )}
                    <optgroup label="Contas">{(d.contas || []).map(c => <option key={c.id} value={`conta:${c.id}`}>🏦 {c.nome}</option>)}</optgroup>
                  </select></label>
              </div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 8 }}>
                {String(pendente.destinoKey).startsWith("cartao") ? "Entra na fatura do cartão (a pagar)." : pendente.destinoKey ? "Entra como pago e já mexe no saldo da conta." : "Escolha onde lançar."}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => { setPendente(null); setResposta({ ok: false, texto: "Lançamento cancelado." }); }}
                        style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${T.border}`, background: "transparent", color: T.muted, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
                <button onClick={confirmarLancamento}
                        style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: T.gold, color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 15 }}>✓ Confirmar lançamento</button>
              </div>
            </div>
          );
        })()}

        {/* Campo de texto só aparece quando o microfone falha (ditado do teclado). */}
        {aviso && <form onSubmit={(e) => { e.preventDefault(); const f = texto; setTexto(""); processar(f); }}
              style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input ref={inputRef} value={texto} onChange={(e) => setTexto(e.target.value)}
                 placeholder="…ou digite / dite pelo teclado" enterKeyHint="send"
                 style={{ flex: 1, minWidth: 0, fontSize: 16, padding: "10px 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.bg, color: T.ink }} />
          <button type="submit" aria-label="Perguntar"
                  style={{ width: 44, borderRadius: 10, border: "none", background: T.gold, color: "#fff", display: "grid", placeItems: "center", cursor: "pointer" }}>
            <Send size={17} />
          </button>
        </form>}
      </div>
      <style>{`
        /* Bolha de água (pedido 2026-10-01): vidro transparente com reflexo,
           brilho de borda e a cor do estado só "tingindo" a água. */
        .assistente-mic {
          position: relative; width: 84px; height: 84px; border-radius: 50%; cursor: pointer;
          display: grid; place-items: center; color: #fff;
          border: 1px solid rgba(255,255,255,.45);
          background:
            radial-gradient(circle at 32% 26%, rgba(255,255,255,.85) 0 7%, rgba(255,255,255,.25) 13%, transparent 24%),
            radial-gradient(circle at 70% 78%, rgba(255,255,255,.22) 0 10%, transparent 26%),
            radial-gradient(circle at 50% 55%, color-mix(in srgb, var(--bolha) 22%, transparent) 0%, color-mix(in srgb, var(--bolha) 38%, transparent) 62%, color-mix(in srgb, var(--bolha) 70%, transparent) 100%);
          box-shadow:
            inset 0 -8px 16px color-mix(in srgb, var(--bolha) 45%, transparent),
            inset 0 6px 12px rgba(255,255,255,.28),
            inset 0 0 0 1px rgba(255,255,255,.12),
            0 10px 26px color-mix(in srgb, var(--bolha) 35%, transparent);
          -webkit-backdrop-filter: blur(6px) saturate(1.4);
          backdrop-filter: blur(6px) saturate(1.4);
          transition: transform .15s ease;
        }
        .assistente-mic:active { transform: scale(.94); }
        .assistente-mic::after {
          content: ""; position: absolute; inset: -6px; border-radius: 50%;
          border: 2px solid color-mix(in srgb, var(--bolha) 55%, transparent); opacity: 0;
        }
        .assistente-mic.ouvindo { animation: assistenteBolha 1.6s ease-in-out infinite; }
        .assistente-mic.ouvindo::after { animation: assistenteOnda 1.6s ease-out infinite; }
        @keyframes assistenteBolha { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06, 1.04); } }
        @keyframes assistenteOnda { 0% { transform: scale(.92); opacity: .8; } 100% { transform: scale(1.35); opacity: 0; } }
      `}</style>
    </div>
  );
}
