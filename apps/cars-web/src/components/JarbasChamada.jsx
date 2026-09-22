import React, { useState, useRef, useEffect, useMemo } from "react";
import { Mic, MicOff, Keyboard, PhoneOff, Send } from "lucide-react";
import { toast } from "../lib/toast.js";
import { montarContextoJarbas, montarPromptAudio, PROMPT_JARBAS } from "../lib/jarbas.js";
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
export default function JarbasChamada({ dados = {}, apiKeys = {}, msgs = [], setMsgs, onEncerrar }) {
  const [fase, setFase] = useState("iniciando"); // iniciando|ouvindo|pensando|voz|falando|mudo|erro
  const [ultima, setUltima] = useState(null);    // {pergunta, resposta}
  const [teclado, setTeclado] = useState(false);
  const [texto, setTexto] = useState("");

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

  const registrar = (pergunta, resposta) => {
    setUltima({ pergunta, resposta });
    setMsgs(prev => [...prev,
      ...(pergunta ? [{ role: "user", texto: pergunta }] : []),
      ...(resposta ? [{ role: "jarbas", texto: resposta }] : []),
    ]);
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
      const pergunta = (r?.transcricao || "").trim();
      const resposta = (r?.resposta || "").trim();
      if (!pergunta && !resposta) { comecarAOuvir(); return; }
      registrar(pergunta, resposta); // texto aparece NA HORA
      if (!resposta) { comecarAOuvir(); return; }
      await falarResposta(resposta);
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
      const { gerarTextoGemini } = await import("../lib/gemini.js");
      const conversa = msgsRef.current.slice(-6).map(m => `${m.role === "user" ? "Paulo" : "Jarbas"}: ${m.texto}`).join("\n");
      const resposta = (await gerarTextoGemini(
        `${PROMPT_JARBAS}\n\n${contexto}\n\n${conversa ? conversa + "\n" : ""}Paulo: ${p}\nJarbas:`,
        { apiKey: geminiKey, temperature: 0.4, maxOutputTokens: 400 },
      ) || "").trim();
      if (!vivoRef.current) return;
      registrar(p, resposta || "Não consegui montar a resposta.");
      if (resposta) await falarResposta(resposta);
      else comecarAOuvir();
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
    voz: "Preparando a voz…",
    falando: "Jarbas falando — pode interromper",
    mudo: "Microfone mudo",
    erro: "Sem microfone",
  }[fase] || "";
  const faseOrbe = { ouvindo: "ouvindo", pensando: "pensando", processar: "pensando", voz: "pensando", falando: "falando", mudo: "mudo" }[fase] || "idle";

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
      display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 24px 30px",
    }}>
      <div style={{ fontSize: 12, color: HUD.sub, fontWeight: 700, letterSpacing: ".28em", textTransform: "uppercase" }}>
        J·A·R·B·A·S
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, width: "100%", minHeight: 0 }}>
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
            {ultima.resposta && (
              <div style={{ alignSelf: "flex-start", maxWidth: "88%", fontSize: 13, color: HUD.texto, background: HUD.card, border: `1px solid ${HUD.borda}`, borderRadius: 14, padding: "8px 12px" }}>
                {ultima.resposta}
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
