import React, { useState, useRef, useEffect, useMemo } from "react";
import { Mic, MicOff, Keyboard, PhoneOff, Send, Brain, X, Trash2 } from "lucide-react";
import { toast } from "../lib/toast.js";
import { montarContextoJarbas, montarPromptAudio, montarPromptTexto, montarPromptWeb } from "../lib/jarbas.js";
import { falar, pararFala } from "../lib/tts.js";
import { criarMonitorFala } from "../lib/vad.js";
import JarbasOrbe from "./JarbasOrbe.jsx";

// Paleta CINEMATOGRÁFICA fixa da chamada (independe do tema do app).
const HUD = {
  fundo: "#04141c",
  grade: "rgba(77,208,225,.06)",
  ciano: "#4dd0e1",
  texto: "#d7f4fa",
  sub: "#7fa8b5",
  card: "rgba(10,42,54,.72)",
  borda: "rgba(77,208,225,.35)",
  vermelho: "#ff5c72",
};

/**
 * JARBAS — a tela ÚNICA do assistente (o modal antigo de chat foi removido,
 * pedido 2026-09-22): conversa de voz contínua com VAD + barge-in, e uma
 * barrinha de texto embutida (⌨️) pra quem preferir digitar.
 *
 * PERFORMANCE: o nível do mic NÃO passa pelo React — vai direto pra CSS var
 * `--jnivel` no wrapper do orbe (zero re-render por frame de áudio).
 */
export default function JarbasChamada({ dados = {}, apiKeys = {}, msgs = [], setMsgs, onEncerrar, onMemorizar, onEsquecer }) {
  const [fase, setFase] = useState("iniciando"); // iniciando|ouvindo|pensando|web|voz|falando|mudo|erro
  const [ultima, setUltima] = useState(null);    // {pergunta, resposta, destaques, fontes}
  const [teclado, setTeclado] = useState(false);
  const [texto, setTexto] = useState("");
  const [memoriasOpen, setMemoriasOpen] = useState(false);

  const geminiKey = apiKeys.gemini || (() => { try { return localStorage.getItem("af4:gemini-key") || ""; } catch { return ""; } })();
  const contexto = useMemo(() => {
    try { return montarContextoJarbas(dados); } catch { return "(contexto indisponível)"; }
  }, [dados]);

  const streamRef = useRef(null);
  const monitorRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const faseRef = useRef("iniciando");
  const msgsRef = useRef(msgs);
  const vivoRef = useRef(true);
  const orbeWrapRef = useRef(null);
  msgsRef.current = msgs;

  const irPara = (f) => { faseRef.current = f; setFase(f); };
  const setNivelCss = (v) => { orbeWrapRef.current?.style.setProperty("--jnivel", String(v)); };

  const registrar = (pergunta, resposta, extra = {}) => {
    setUltima({ pergunta, resposta, destaques: extra.destaques || [], fontes: extra.fontes || [] });
    setMsgs(prev => [...prev,
      ...(pergunta ? [{ role: "user", texto: pergunta }] : []),
      ...(resposta ? [{ role: "jarbas", texto: resposta, ...extra }] : []),
    ]);
  };

  /**
   * Trata a resposta JSON do Jarbas (áudio OU texto):
   * destaques → valores POR ESCRITO na tela · memorizar → memória permanente
   * · buscaWeb → 2ª chamada com Google Search (fontes na tela).
   */
  const tratarResposta = async (pergunta, r) => {
    const resposta = (r?.resposta || "").trim();
    const destaques = Array.isArray(r?.destaques) ? r.destaques.slice(0, 4) : [];
    if (r?.memorizar && onMemorizar) {
      onMemorizar(String(r.memorizar).trim());
      toast.success("🧠 Guardei na memória.");
    }
    if (r?.buscaWeb) {
      // mostra a pergunta e vai pra web — sem falar o "deixa eu ver" (mais rápido)
      if (pergunta) setMsgs(prev => [...prev, { role: "user", texto: pergunta }]);
      setUltima({ pergunta, resposta: "", destaques: [], fontes: [] });
      irPara("web");
      try {
        const { gerarTextoGeminiComBusca } = await import("../lib/gemini.js");
        const w = await gerarTextoGeminiComBusca(montarPromptWeb(String(r.buscaWeb)), { apiKey: geminiKey, maxOutputTokens: 500 });
        if (!vivoRef.current) return;
        const respostaWeb = (w.texto || "").trim() || "Não achei nada conclusivo na busca.";
        registrar("", respostaWeb, { fontes: w.fontes });
        await falarResposta(respostaWeb);
      } catch (e) {
        if (!vivoRef.current) return;
        toast.error(e.message || "A busca na internet falhou.");
        comecarAOuvir();
      }
      return;
    }
    if (!pergunta && !resposta) { comecarAOuvir(); return; }
    registrar(pergunta, resposta, { destaques }); // texto (e valores) na tela NA HORA
    if (resposta) await falarResposta(resposta);
    else comecarAOuvir();
  };

  // Fala a resposta: fase "voz" (gerando áudio) → aoIniciar → "falando".
  const falarResposta = async (resposta) => {
    irPara("voz");
    setNivelCss(0);
    await falar(resposta, {
      geminiKey,
      aoIniciar: () => {
        if (!vivoRef.current) return;
        irPara("falando");
        inicioFalaTtsRef.current = performance.now();
        monitorRef.current?.setModo("falando");
        monitorRef.current?.retomar();
      },
    });
    if (vivoRef.current && (faseRef.current === "falando" || faseRef.current === "voz")) comecarAOuvir();
  };
  const inicioFalaTtsRef = useRef(0);

  const comecarAOuvir = () => {
    if (!vivoRef.current || !streamRef.current) return;
    const candidatos = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
    const mime = candidatos.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || "";
    const mr = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : {});
    recorderRef.current = mr;
    chunksRef.current = [];
    mr.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
      if (faseRef.current === "processar") processarTurno(blob);
    };
    mr.start();
    monitorRef.current?.setModo("ouvindo");
    monitorRef.current?.retomar();
    irPara("ouvindo");
  };

  const encerrarTurnoDeFala = () => {
    if (faseRef.current !== "ouvindo") return;
    faseRef.current = "processar";
    setFase("pensando");
    setNivelCss(0);
    monitorRef.current?.pausar();
    try { recorderRef.current?.state === "recording" && recorderRef.current.stop(); } catch {}
  };

  const processarTurno = async (blob) => {
    if (!vivoRef.current) return;
    if (!blob || blob.size < 1500) { comecarAOuvir(); return; }
    irPara("pensando");
    try {
      const { fileToBase64, gerarJSONGeminiComAudio } = await import("../lib/gemini.js");
      const base64 = await fileToBase64(blob);
      const r = await gerarJSONGeminiComAudio(
        montarPromptAudio(contexto, msgsRef.current),
        base64, blob.type || "audio/webm", { apiKey: geminiKey, maxOutputTokens: 400 },
      );
      if (!vivoRef.current) return;
      await tratarResposta((r?.transcricao || "").trim(), r);
    } catch (e) {
      if (!vivoRef.current) return;
      toast.error(e.message || "Erro na conversa — voltei a te ouvir.");
      comecarAOuvir();
    }
  };

  // Pergunta DIGITADA (barrinha ⌨️) — responde e fala igual.
  const enviarTexto = async () => {
    const p = texto.trim();
    if (!p || faseRef.current === "pensando" || faseRef.current === "voz") return;
    setTexto("");
    pararFala();
    monitorRef.current?.pausar();
    try { recorderRef.current?.state === "recording" && recorderRef.current.stop(); } catch {}
    irPara("pensando");
    try {
      const { gerarJSONGemini } = await import("../lib/gemini.js");
      const r = await gerarJSONGemini(
        montarPromptTexto(contexto, msgsRef.current, p),
        { apiKey: geminiKey, temperature: 0.4, maxOutputTokens: 400 },
      );
      if (!vivoRef.current) return;
      await tratarResposta(p, r);
    } catch (e) {
      if (!vivoRef.current) return;
      toast.error(e.message || "Erro ao perguntar.");
      comecarAOuvir();
    }
  };

  // Boot: 1 getUserMedia + monitor VAD (nível vai pra CSS var, sem re-render).
  useEffect(() => {
    vivoRef.current = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (!vivoRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        monitorRef.current = criarMonitorFala(stream, {
          aoNivel: (rms) => setNivelCss(faseRef.current === "ouvindo" ? Math.min(rms * 3, 1) : 0),
          aoTerminarFala: () => encerrarTurnoDeFala(),
          aoFalaSustentada: () => {
            if (faseRef.current !== "falando") return;
            if (performance.now() - inicioFalaTtsRef.current < 400) return;
            pararFala();
            comecarAOuvir();
          },
        });
        comecarAOuvir();
      } catch {
        irPara("erro");
        toast.error("Não consegui acessar o microfone — verifica a permissão.");
      }
    })();
    return () => {
      vivoRef.current = false;
      pararFala();
      try { recorderRef.current?.state === "recording" && recorderRef.current.stop(); } catch {}
      monitorRef.current?.destruir();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gesto/botão VOLTAR do sistema fecha SÓ o Jarbas (não sai do app):
  // empurra um estado no histórico ao abrir; popstate → encerrar. Se fechar
  // pelo botão, consome o estado no cleanup pra não deixar rastro.
  const fechouPeloHistoricoRef = useRef(false);
  useEffect(() => {
    try { window.history.pushState({ jarbas: 1 }, ""); } catch {}
    const aoVoltar = () => { fechouPeloHistoricoRef.current = true; onEncerrar(); };
    window.addEventListener("popstate", aoVoltar);
    return () => {
      window.removeEventListener("popstate", aoVoltar);
      if (!fechouPeloHistoricoRef.current) { try { window.history.back(); } catch {} }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMudo = () => {
    if (faseRef.current === "mudo") {
      comecarAOuvir();
    } else {
      pararFala();
      monitorRef.current?.pausar();
      try { recorderRef.current?.state === "recording" && recorderRef.current.stop(); } catch {}
      faseRef.current = "mudo"; setFase("mudo"); setNivelCss(0);
    }
  };

  const rotulo = {
    iniciando: "Inicializando sistemas…",
    ouvindo: "Pode falar — eu envio quando você pausar",
    pensando: "Processando…",
    processar: "Processando…",
    web: "🌐 Pesquisando na internet…",
    voz: "Preparando a voz…",
    falando: "Jarbas falando — pode interromper",
    mudo: "Microfone mudo",
    erro: "Sem microfone",
  }[fase] || "";
  const faseOrbe = { ouvindo: "ouvindo", pensando: "pensando", processar: "pensando", web: "pensando", voz: "pensando", falando: "falando", mudo: "mudo" }[fase] || "idle";

  const btnRedondo = (extra = {}) => ({
    width: 56, height: 56, borderRadius: "50%", background: HUD.card,
    border: `1px solid ${HUD.borda}`, color: HUD.texto, cursor: "pointer",
    display: "grid", placeItems: "center", ...extra,
  });

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 600,
      background: `
        linear-gradient(${HUD.grade} 1px, transparent 1px),
        linear-gradient(90deg, ${HUD.grade} 1px, transparent 1px),
        radial-gradient(circle at 50% 32%, #0a2e3c 0%, ${HUD.fundo} 62%)`,
      backgroundSize: "34px 34px, 34px 34px, cover",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "56px 24px calc(22px + env(safe-area-inset-bottom, 12px))",
    }}>
      <div style={{ fontSize: 12, color: HUD.sub, fontWeight: 700, letterSpacing: ".28em", textTransform: "uppercase" }}>
        J·A·R·B·A·S
      </div>

      {/* ← VOLTAR — sempre visível no topo (usuário ficava "preso" na tela) */}
      <button onClick={onEncerrar} title="Voltar pro aplicativo"
        style={{ position: "absolute", top: 48, left: 18, display: "inline-flex", alignItems: "center", gap: 6,
                 padding: "9px 16px", borderRadius: 100, background: HUD.card, border: `1px solid ${HUD.borda}`,
                 color: HUD.texto, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
        ← Voltar
      </button>

      {/* 🧠 memórias — canto superior direito */}
      <button onClick={() => setMemoriasOpen(true)} title="O que o Jarbas lembra de você"
        style={{ position: "absolute", top: 48, right: 18, width: 40, height: 40, borderRadius: "50%",
                 background: HUD.card, border: `1px solid ${HUD.borda}`, color: HUD.ciano, cursor: "pointer",
                 display: "grid", placeItems: "center" }}>
        <Brain size={17} />
      </button>

      {/* Painel de memórias */}
      {memoriasOpen && (
        <div style={{ position: "absolute", inset: 0, zIndex: 5, background: "rgba(4,20,28,.9)", display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }}
             onClick={() => setMemoriasOpen(false)}>
          <div onClick={e => e.stopPropagation()}
               style={{ width: "min(440px, 100%)", maxHeight: "70vh", overflowY: "auto", background: HUD.card, border: `1px solid ${HUD.borda}`, borderRadius: 18, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: HUD.texto }}>🧠 Memórias do Jarbas</div>
              <button onClick={() => setMemoriasOpen(false)} style={{ background: "none", border: "none", color: HUD.sub, cursor: "pointer", padding: 4 }}><X size={16} /></button>
            </div>
            {(dados.memorias || []).length === 0 ? (
              <p style={{ fontSize: 12.5, color: HUD.sub }}>
                Nada guardado ainda. É só falar: <em>"Jarbas, lembra que…"</em> — meta, preferência, qualquer coisa — e eu guardo pra sempre (sincroniza nos teus aparelhos).
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(dados.memorias || []).map(m => (
                  <div key={m.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(77,208,225,.06)", border: `1px solid ${HUD.borda}`, borderRadius: 12, padding: "8px 10px" }}>
                    <span style={{ flex: 1, fontSize: 12.5, color: HUD.texto, lineHeight: 1.4 }}>{m.texto}</span>
                    <button onClick={() => onEsquecer?.(m.id)} title="Esquecer"
                      style={{ background: "none", border: "none", color: HUD.vermelho, cursor: "pointer", padding: 3, flexShrink: 0 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Coluna central ROLÁVEL — resposta longa nunca empurra os controles pra fora */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "safe center", gap: 24, width: "100%", minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "8px 0" }}>
        <div ref={orbeWrapRef} style={{ "--jnivel": 0 }}>
          <JarbasOrbe size={200} fase={faseOrbe} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: HUD.texto, textAlign: "center", textShadow: `0 0 12px ${HUD.ciano}44` }}>
          {rotulo}
        </div>

        {ultima && (
          <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 6 }}>
            {ultima.pergunta && (
              <div style={{ alignSelf: "flex-end", maxWidth: "88%", fontSize: 12.5, color: HUD.sub, background: "rgba(255,209,102,.08)", border: "1px solid rgba(255,209,102,.3)", borderRadius: 14, padding: "7px 12px" }}>
                {ultima.pergunta}
              </div>
            )}
            {/* VALORES POR ESCRITO — cartões com o número grande */}
            {ultima.destaques?.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: ultima.destaques.length > 1 ? "1fr 1fr" : "1fr", gap: 8 }}>
                {ultima.destaques.map((d, i) => (
                  <div key={i} style={{ background: HUD.card, border: `1px solid ${HUD.ciano}66`, borderRadius: 14, padding: "10px 14px" }}>
                    <div style={{ fontSize: 10, color: HUD.sub, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>{String(d?.rotulo ?? "")}</div>
                    <div className="num" style={{ fontSize: 20, fontWeight: 800, color: HUD.texto, textShadow: `0 0 14px ${HUD.ciano}55` }}>{String(d?.valor ?? "")}</div>
                  </div>
                ))}
              </div>
            )}
            {ultima.resposta && (
              <div style={{ alignSelf: "flex-start", maxWidth: "88%", fontSize: 13, color: HUD.texto, background: HUD.card, border: `1px solid ${HUD.borda}`, borderRadius: 14, padding: "8px 12px" }}>
                {ultima.resposta}
              </div>
            )}
            {/* FONTES da busca na internet */}
            {ultima.fontes?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ultima.fontes.map((f, i) => (
                  <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                     style={{ fontSize: 10.5, color: HUD.ciano, background: "rgba(77,208,225,.08)", border: `1px solid ${HUD.borda}`, borderRadius: 100, padding: "3px 10px", textDecoration: "none", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    🌐 {String(f?.titulo ?? "")}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Barrinha de texto (⌨️) */}
      {teclado && (
        <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 460, marginBottom: 16 }}>
          <input autoFocus value={texto} onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") enviarTexto(); }}
            placeholder="Digita a pergunta…"
            style={{ flex: 1, fontSize: 13.5, padding: "11px 14px", border: `1px solid ${HUD.borda}`, borderRadius: 100, background: HUD.card, color: HUD.texto, outline: "none" }} />
          <button onClick={enviarTexto} style={btnRedondo({ width: 46, height: 46, background: HUD.ciano, color: "#04141c", border: "none" })}>
            <Send size={17} />
          </button>
        </div>
      )}

      {/* Controles */}
      <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
        <button onClick={toggleMudo} title={fase === "mudo" ? "Reativar microfone" : "Mutar"}
          style={btnRedondo(fase === "mudo" ? { background: "rgba(255,92,114,.16)", border: `1px solid ${HUD.vermelho}`, color: HUD.vermelho } : {})}>
          {fase === "mudo" ? <MicOff size={21} /> : <Mic size={21} />}
        </button>
        <button onClick={onEncerrar} title="Encerrar"
          style={{ width: 68, height: 68, borderRadius: "50%", background: HUD.vermelho, border: "none", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", boxShadow: `0 6px 26px ${HUD.vermelho}66` }}>
          <PhoneOff size={26} />
        </button>
        <button onClick={() => setTeclado(v => !v)} title="Digitar em vez de falar"
          style={btnRedondo(teclado ? { border: `1px solid ${HUD.ciano}`, color: HUD.ciano } : {})}>
          <Keyboard size={21} />
        </button>
      </div>
    </div>
  );
}
