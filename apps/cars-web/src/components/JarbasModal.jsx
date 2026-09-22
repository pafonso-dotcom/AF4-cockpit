import React, { useState, useRef, useEffect, useMemo } from "react";
import { Mic, Square, Send, X, Volume2, VolumeX, Bot, Phone } from "lucide-react";
import { T } from "../lib/theme.js";
import { toast } from "../lib/toast.js";
import { montarContextoJarbas, PROMPT_JARBAS, montarPromptAudio, SUGESTOES_JARBAS } from "../lib/jarbas.js";
import { falar, pararFala } from "../lib/tts.js";
import JarbasChamada from "./JarbasChamada.jsx";

const SOM_KEY = "af4:jarbas-som";

/**
 * JARBAS — chat de voz/texto global sobre TODOS os dados do app.
 * Voz: MediaRecorder → Gemini (transcreve + responde em 1 chamada).
 * Texto: Anthropic (se houver chave) com fallback Gemini.
 * Fala: lib/tts.js (Gemini TTS → nativo).
 */
export default function JarbasModal({ dados = {}, apiKeys = {}, userName = "", onClose }) {
  const [msgs, setMsgs] = useState([]); // {role: "user"|"jarbas", texto}
  const [texto, setTexto] = useState("");
  const [pensando, setPensando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [chamada, setChamada] = useState(false); // Modo Conversa contínua
  const [som, setSom] = useState(() => { try { return localStorage.getItem(SOM_KEY) !== "0"; } catch { return true; } });

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const fimRef = useRef(null);

  const geminiKey = apiKeys.gemini || (() => { try { return localStorage.getItem("af4:gemini-key") || ""; } catch { return ""; } })();
  const contexto = useMemo(() => {
    try { return montarContextoJarbas(dados); } catch { return "(contexto indisponível)"; }
  }, [dados]);

  useEffect(() => () => pararFala(), []);
  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, pensando]);

  const toggleSom = () => setSom(v => {
    const nv = !v;
    try { localStorage.setItem(SOM_KEY, nv ? "1" : "0"); } catch {}
    if (!nv) pararFala();
    return nv;
  });

  const responder = (resposta) => {
    setMsgs(prev => [...prev, { role: "jarbas", texto: resposta }]);
    if (som) falar(resposta, { geminiKey });
  };

  // ---- Pergunta por TEXTO ----
  const enviarTexto = async (pergunta) => {
    const p = (pergunta ?? texto).trim();
    if (!p || pensando) return;
    setTexto("");
    setMsgs(prev => [...prev, { role: "user", texto: p }]);
    setPensando(true);
    try {
      let resposta = "";
      const historico = msgs.map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.texto }));
      if (apiKeys.anthropic) {
        try {
          const { perguntarAoClaude } = await import("../lib/aiChat.js");
          resposta = await perguntarAoClaude({
            apiKey: apiKeys.anthropic, pergunta: p, historico,
            contextoDados: `${PROMPT_JARBAS}\n\n${contexto}`,
          });
        } catch { /* cai no Gemini */ }
      }
      if (!resposta) {
        if (!geminiKey) throw new Error("Configura uma chave de IA (Gemini ou Anthropic) em Configurações → APIs.");
        const { gerarTextoGemini } = await import("../lib/gemini.js");
        const conversa = msgs.slice(-6).map(m => `${m.role === "user" ? "Paulo" : "Jarbas"}: ${m.texto}`).join("\n");
        resposta = await gerarTextoGemini(
          `${PROMPT_JARBAS}\n\n${contexto}\n\n${conversa ? conversa + "\n" : ""}Paulo: ${p}\nJarbas:`,
          { apiKey: geminiKey, temperature: 0.4, maxOutputTokens: 500 },
        );
      }
      responder((resposta || "").trim() || "Não consegui montar a resposta. Tenta de novo?");
    } catch (e) {
      toast.error(e.message || "Erro ao falar com o Jarbas.");
    } finally {
      setPensando(false);
    }
  };

  // ---- Pergunta por VOZ (padrão do VoiceTransacao) ----
  const gravar = async () => {
    if (!geminiKey) { toast.error("A voz do Jarbas usa o Gemini — configura a chave em Configurações → APIs."); return; }
    if (!navigator.mediaDevices?.getUserMedia) { toast.error("Seu navegador não suporta gravação de áudio."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const candidatos = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      const mime = candidatos.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || "";
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      mediaRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        setGravando(false);
        if (blob.size < 1200) return; // toque acidental
        setPensando(true);
        try {
          const { fileToBase64, gerarJSONGeminiComAudio } = await import("../lib/gemini.js");
          const base64 = await fileToBase64(blob);
          const r = await gerarJSONGeminiComAudio(
            montarPromptAudio(contexto, msgs),
            base64, mr.mimeType || "audio/webm", { apiKey: geminiKey, maxOutputTokens: 700 },
          );
          if (r?.transcricao) setMsgs(prev => [...prev, { role: "user", texto: r.transcricao }]);
          responder((r?.resposta || "").trim() || "Não entendi o áudio — tenta falar de novo, mais perto do microfone.");
        } catch (e) {
          toast.error(e.message || "Erro ao processar o áudio.");
        } finally {
          setPensando(false);
        }
      };
      mr.start();
      pararFala();
      setGravando(true);
    } catch {
      toast.error("Não consegui acessar o microfone — verifica a permissão.");
    }
  };
  const pararGravacao = () => { if (mediaRef.current?.state === "recording") mediaRef.current.stop(); };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
         onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: "min(560px, 100%)", height: "min(78vh, 640px)", background: T.bg, borderRadius: "20px 20px 0 0",
                 border: `1px solid ${T.border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Cabeçalho */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: `1px solid ${T.border}`, background: T.card }}>
          <Bot size={20} style={{ color: T.gold }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.ink }}>Jarbas</div>
            <div style={{ fontSize: 10.5, color: T.muted }}>{pensando ? "pensando…" : gravando ? "ouvindo…" : "seu assistente pessoal"}</div>
          </div>
          <button onClick={() => {
            if (!geminiKey) { toast.error("O Modo Conversa usa o Gemini — configura a chave em Configurações → APIs."); return; }
            pararFala(); setChamada(true);
          }} title="Modo Conversa — voz contínua, sem apertar botão"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: `${T.green}18`, border: `1px solid ${T.green}`, borderRadius: 100, padding: "6px 12px", color: T.green, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <Phone size={13} /> Conversar
          </button>
          <button onClick={toggleSom} title={som ? "Silenciar respostas" : "Falar respostas"}
            style={{ background: "none", border: "none", color: som ? T.gold : T.muted, cursor: "pointer", padding: 6 }}>
            {som ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button onClick={() => { pararFala(); onClose(); }} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Mensagens */}
        <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {msgs.length === 0 && (
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <div style={{ fontSize: 14.5, color: T.ink, fontWeight: 700, marginBottom: 4 }}>
                Às ordens{userName ? `, ${userName}` : ""}. 🤖
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>
                Toca em <strong style={{ color: T.green }}>Conversar</strong> pra um papo contínuo por voz, usa o microfone avulso, ou uma sugestão:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
                {SUGESTOES_JARBAS.map(s => (
                  <button key={s} onClick={() => enviarTexto(s)}
                    style={{ fontSize: 12.5, color: T.gold, background: `${T.gold}10`, border: `1px solid ${T.gold}55`, borderRadius: 100, padding: "7px 14px", cursor: "pointer" }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "84%", padding: "9px 13px", borderRadius: 16, fontSize: 13.5, lineHeight: 1.45,
              background: m.role === "user" ? `${T.gold}18` : T.card,
              border: `1px solid ${m.role === "user" ? `${T.gold}55` : T.border}`, color: T.ink,
              whiteSpace: "pre-wrap",
            }}>
              {m.texto}
            </div>
          ))}
          {pensando && <div style={{ alignSelf: "flex-start", fontSize: 12, color: T.muted, padding: "4px 8px" }}>Jarbas está pensando…</div>}
          <div ref={fimRef} />
        </div>

        {/* Entrada */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px 14px", borderTop: `1px solid ${T.border}`, background: T.card }}>
          <input value={texto} onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") enviarTexto(); }}
            placeholder="Pergunta algo… (saldo, cartão, o que vence)"
            style={{ flex: 1, fontSize: 13.5, padding: "10px 12px", border: `1px solid ${T.border}`, borderRadius: 100, background: T.bg, color: T.ink, outline: "none" }} />
          {texto.trim() ? (
            <button onClick={() => enviarTexto()} disabled={pensando}
              style={{ width: 44, height: 44, borderRadius: "50%", background: T.gold, border: "none", color: "#1a1a1a", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>
              <Send size={17} />
            </button>
          ) : (
            <button onClick={gravando ? pararGravacao : gravar} disabled={pensando}
              title={gravando ? "Parar e enviar" : "Falar com o Jarbas"}
              style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0, cursor: "pointer", display: "grid", placeItems: "center",
                       background: gravando ? T.red : T.gold, border: "none", color: "#1a1a1a",
                       animation: gravando ? "pulse 1.2s infinite" : "none" }}>
              {gravando ? <Square size={18} style={{ color: "#fff" }} /> : <Mic size={20} />}
            </button>
          )}
        </div>
        <style>{`@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }`}</style>
      </div>

      {/* MODO CONVERSA — chamada de voz contínua */}
      {chamada && (
        <JarbasChamada
          contexto={contexto}
          geminiKey={geminiKey}
          msgs={msgs}
          setMsgs={setMsgs}
          onVoltarChat={() => setChamada(false)}
          onEncerrar={() => setChamada(false)}
        />
      )}
    </div>
  );
}
