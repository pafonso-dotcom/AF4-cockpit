import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Keyboard, PhoneOff } from "lucide-react";
import { T } from "../lib/theme.js";
import { toast } from "../lib/toast.js";
import { montarPromptAudio } from "../lib/jarbas.js";
import { falar, pararFala } from "../lib/tts.js";
import { criarMonitorFala } from "../lib/vad.js";

/**
 * JARBAS · MODO CONVERSA — chamada de voz contínua, sem apertar botão.
 *
 * Loop: 🎙 ouvindo (VAD detecta o fim da tua fala e envia sozinho) →
 * 🧠 pensando (Gemini transcreve + responde) → 🔊 falando (TTS) → ouvindo.
 * BARGE-IN: falar por cima da resposta (mais alto, ≥0,5s) cala o Jarbas
 * na hora — o eco do alto-falante não passa do limiar.
 */
export default function JarbasChamada({ contexto, geminiKey, msgs, setMsgs, onVoltarChat, onEncerrar }) {
  const [fase, setFase] = useState("iniciando"); // iniciando|ouvindo|pensando|falando|mudo|erro
  const [nivel, setNivel] = useState(0);
  const [ultima, setUltima] = useState(null); // {pergunta, resposta}

  const streamRef = useRef(null);
  const monitorRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const faseRef = useRef("iniciando");
  const msgsRef = useRef(msgs);
  const inicioFalaTtsRef = useRef(0);
  const vivoRef = useRef(true);
  msgsRef.current = msgs;

  const irPara = (f) => { faseRef.current = f; setFase(f); };

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
    faseRef.current = "processar"; // sinal pro onstop processar
    setFase("pensando");
    monitorRef.current?.pausar();
    try { recorderRef.current?.state === "recording" && recorderRef.current.stop(); } catch {}
  };

  const processarTurno = async (blob) => {
    if (!vivoRef.current) return;
    if (!blob || blob.size < 1500) { comecarAOuvir(); return; } // ruído/toque
    irPara("pensando");
    try {
      const { fileToBase64, gerarJSONGeminiComAudio } = await import("../lib/gemini.js");
      const base64 = await fileToBase64(blob);
      const r = await gerarJSONGeminiComAudio(
        montarPromptAudio(contexto, msgsRef.current),
        base64, blob.type || "audio/webm", { apiKey: geminiKey, maxOutputTokens: 700 },
      );
      if (!vivoRef.current) return;
      const pergunta = (r?.transcricao || "").trim();
      const resposta = (r?.resposta || "").trim();
      if (!pergunta && !resposta) { comecarAOuvir(); return; }
      setUltima({ pergunta, resposta });
      setMsgs(prev => [...prev,
        ...(pergunta ? [{ role: "user", texto: pergunta }] : []),
        ...(resposta ? [{ role: "jarbas", texto: resposta }] : []),
      ]);
      if (!resposta) { comecarAOuvir(); return; }
      // FALANDO — VAD fica de olho pra barge-in
      irPara("falando");
      inicioFalaTtsRef.current = performance.now();
      monitorRef.current?.setModo("falando");
      monitorRef.current?.retomar();
      await falar(resposta, { geminiKey });
      if (vivoRef.current && faseRef.current === "falando") comecarAOuvir();
    } catch (e) {
      if (!vivoRef.current) return;
      toast.error(e.message || "Erro na conversa — voltei a te ouvir.");
      comecarAOuvir();
    }
  };

  // Boot da chamada: 1 getUserMedia (com cancelamento de eco) + monitor VAD.
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
          aoNivel: (rms) => setNivel(rms),
          aoTerminarFala: () => encerrarTurnoDeFala(),
          aoFalaSustentada: () => {
            // BARGE-IN: ignora o comecinho da fala do Jarbas (ataque do áudio)
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
      faseRef.current = "mudo"; setFase("mudo"); setNivel(0);
    }
  };

  // ----- visual -----
  const corFase = fase === "ouvindo" ? T.gold : fase === "falando" ? T.green : fase === "mudo" ? T.red : T.muted;
  const rotulo = {
    iniciando: "Conectando o microfone…",
    ouvindo: "Pode falar — eu envio quando você pausar",
    pensando: "Pensando…",
    falando: "Jarbas falando — pode interromper",
    mudo: "Microfone mudo",
    erro: "Sem microfone",
  }[fase];
  const escala = fase === "ouvindo" ? 1 + Math.min(nivel * 3.2, 0.55) : 1;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 600, background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", padding: "56px 24px 34px" }}>
      <div style={{ fontSize: 13, color: T.muted, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>Jarbas · conversa</div>

      {/* Orbe */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, width: "100%" }}>
        <div style={{
          width: 148, height: 148, borderRadius: "50%",
          background: `radial-gradient(circle at 34% 30%, ${corFase}66, ${corFase}22 60%, transparent 75%)`,
          border: `2px solid ${corFase}`,
          boxShadow: `0 0 ${18 + nivel * 220}px ${corFase}55`,
          transform: `scale(${escala})`,
          transition: fase === "ouvindo" ? "transform .09s linear" : "transform .5s ease",
          animation: fase === "pensando" ? "jarbas-respira 1.6s ease-in-out infinite"
                   : fase === "falando" ? "jarbas-ondula 1.1s ease-in-out infinite" : "none",
          display: "grid", placeItems: "center",
        }}>
          <span style={{ fontSize: 46 }} aria-hidden>🤖</span>
        </div>
        <div style={{ fontSize: 15.5, fontWeight: 700, color: T.ink, textAlign: "center" }}>{rotulo}</div>

        {/* Última troca */}
        {ultima && (
          <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", gap: 6 }}>
            {ultima.pergunta && (
              <div style={{ alignSelf: "flex-end", maxWidth: "88%", fontSize: 12.5, color: T.muted, background: `${T.gold}12`, border: `1px solid ${T.gold}44`, borderRadius: 14, padding: "7px 12px" }}>
                {ultima.pergunta}
              </div>
            )}
            {ultima.resposta && (
              <div style={{ alignSelf: "flex-start", maxWidth: "88%", fontSize: 13, color: T.ink, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "8px 12px" }}>
                {ultima.resposta}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controles */}
      <div style={{ display: "flex", gap: 22, alignItems: "center" }}>
        <button onClick={toggleMudo} title={fase === "mudo" ? "Reativar microfone" : "Mutar"}
          style={{ width: 56, height: 56, borderRadius: "50%", background: fase === "mudo" ? `${T.red}22` : T.card, border: `1px solid ${fase === "mudo" ? T.red : T.border}`, color: fase === "mudo" ? T.red : T.ink, cursor: "pointer", display: "grid", placeItems: "center" }}>
          {fase === "mudo" ? <MicOff size={21} /> : <Mic size={21} />}
        </button>
        <button onClick={() => { onEncerrar(); }} title="Encerrar conversa"
          style={{ width: 68, height: 68, borderRadius: "50%", background: T.red, border: "none", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", boxShadow: `0 6px 22px ${T.red}66` }}>
          <PhoneOff size={26} />
        </button>
        <button onClick={() => { onVoltarChat(); }} title="Voltar pro chat de texto"
          style={{ width: 56, height: 56, borderRadius: "50%", background: T.card, border: `1px solid ${T.border}`, color: T.ink, cursor: "pointer", display: "grid", placeItems: "center" }}>
          <Keyboard size={21} />
        </button>
      </div>

      <style>{`
        @keyframes jarbas-respira { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes jarbas-ondula { 0%,100% { transform: scale(1); } 25% { transform: scale(1.05); } 60% { transform: scale(0.98); } }
      `}</style>
    </div>
  );
}
