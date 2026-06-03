import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Sparkles, CheckCircle2, AlertCircle, RotateCcw, Play, Pause } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, uid, todayISO } from "../../lib/format.js";
import { gerarJSONGeminiComAudio } from "../../lib/gemini.js";
import { audit } from "../../lib/auditLog.js";
import { toast } from "../../lib/toast.js";
import Modal from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";

/**
 * Modal de transação por voz.
 * Grava áudio do microfone → manda pro Gemini → extrai campos → usuário revisa → salva.
 */
export default function VoiceTransacao({ contas, categorias, transacoes, setTransacoes, onClose }) {
  const [step, setStep] = useState("idle"); // idle | recording | recorded | processing | review
  const [erro, setErro] = useState("");
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [duracao, setDuracao] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [forma, setForma] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const inicioRef = useRef(null);
  const audioRef = useRef(null);

  const temGeminiKey = true; // IA via servidor (Worker /api/gemini)

  const iniciar = async () => {
    setErro("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setErro("Seu navegador não suporta gravação de áudio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Detecta o melhor MIME pra cada navegador (iOS Safari → mp4, Chrome → webm)
      const candidatos = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
      const tipoSuportado = candidatos.find(t => {
        try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
      }) || "";

      const mr = new MediaRecorder(stream, tipoSuportado ? { mimeType: tipoSuportado } : {});
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const tipo = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: tipo });
        setAudioBlob(blob);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(blob));
        setStep("recorded");
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      };

      mr.start();
      inicioRef.current = Date.now();
      setDuracao(0);
      setStep("recording");
      timerRef.current = setInterval(() => {
        setDuracao(Math.floor((Date.now() - inicioRef.current) / 1000));
      }, 250);
    } catch (e) {
      setErro("Não consegui acessar o microfone. Verifique se você deu permissão.");
    }
  };

  const parar = () => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const refazer = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuracao(0);
    setForma(null);
    setErro("");
    setStep("idle");
  };

  const processar = async () => {
    if (!audioBlob) return;
    if (!temGeminiKey) {
      setErro("Configure a chave Gemini em Configurações → APIs (1.500 análises/dia grátis).");
      return;
    }
    setErro("");
    setStep("processing");
    try {
      const base64 = await blobToBase64(audioBlob);
      const result = await transcrever(base64, audioBlob.type || "audio/webm", { contas, categorias });

      setForma({
        tipo: result.tipo || "despesa",
        descricao: result.descricao || "",
        valor: String(result.valor ?? 0).replace(".", ","),
        data: result.data || todayISO(),
        categoria: result.categoria || "Outros",
        conta: result.conta || contas[0]?.nome || "",
        obs: "",
      });
      setStep("review");
    } catch (err) {
      setErro(err.message || "Falha ao processar.");
      setStep("recorded");
    }
  };

  const confirmar = () => {
    if (!forma.descricao || !forma.valor) { toast.error("Descrição e valor obrigatórios."); return; }
    const valorNum = parseFloat(String(forma.valor).replace(",", ".")) || 0;
    if (valorNum <= 0) { toast.error("Valor inválido."); return; }
    const tx = {
      id: uid(), tipo: forma.tipo, descricao: forma.descricao,
      valor: valorNum, data: forma.data,
      categoria: forma.categoria,
      conta: forma.conta, compensado: true, fixa: false,
      obs: (forma.obs || "") + " · Transação por voz (Gemini)",
    };
    setTransacoes([tx, ...transacoes]);
    audit.create("transação", forma.descricao, tx.id, { ...tx, fonte: "voz" });
    toast.success(`✓ ${forma.descricao} · ${fmt(valorNum)} registrada!`);
    onClose();
  };

  const toggleTocar = () => {
    if (!audioRef.current) return;
    if (tocando) audioRef.current.pause();
    else audioRef.current.play();
  };

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title="Transação por voz · Gemini" onClose={onClose} wide>
      {step === "idle" && (
        <div style={{ padding: "20px 0", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: T.muted, marginBottom: 18, maxWidth: 480, margin: "0 auto 18px" }}>
            Toque no microfone e fale algo como:<br />
            <em style={{ color: T.ink }}>"Comprei pão por quinze reais no Pão de Açúcar hoje"</em><br />
            <em style={{ color: T.ink }}>"Recebi 4500 de salário da empresa ontem"</em>
          </p>
          <BotaoMic onClick={iniciar} />
          <div style={{ marginTop: 10, fontSize: 11, color: T.faint }}>
            Toque pra começar a gravar
          </div>
        </div>
      )}

      {step === "recording" && (
        <div style={{ padding: "20px 0", textAlign: "center" }}>
          <BotaoMic gravando onClick={parar} />
          <div style={{ marginTop: 16, fontFamily: T.mono, fontSize: 22, color: T.red, letterSpacing: ".05em" }}>
            ● {fmtDuracao(duracao)}
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: T.muted }}>
            Toque pra parar
          </div>
        </div>
      )}

      {step === "recorded" && audioUrl && (
        <div style={{ padding: "10px 0" }}>
          <div style={{
            background: T.bgSoft, borderRadius: 10, padding: 16,
            display: "flex", alignItems: "center", gap: 14, marginBottom: 16,
          }}>
            <button onClick={toggleTocar} style={{
              background: T.gold, color: T.bg, border: "none",
              width: 44, height: 44, borderRadius: "50%",
              display: "grid", placeItems: "center", cursor: "pointer", flexShrink: 0,
            }} aria-label={tocando ? "Pausar" : "Ouvir gravação"}>
              {tocando ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
                Gravação · {fmtDuracao(duracao)}
              </div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                {(audioBlob.size / 1024).toFixed(1)} KB · {audioBlob.type}
              </div>
            </div>
            <audio ref={audioRef} src={audioUrl}
              onPlay={() => setTocando(true)}
              onPause={() => setTocando(false)}
              onEnded={() => setTocando(false)}
              style={{ display: "none" }} />
          </div>
          <div className="flex gap-3 flex-wrap">
            <button className="btn-gold" onClick={processar} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={13} /> Processar com Gemini
            </button>
            <button className="btn-ghost" onClick={refazer} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <RotateCcw size={13} /> Gravar de novo
            </button>
          </div>
          {erro && <ErroBox texto={erro} />}
        </div>
      )}

      {step === "processing" && (
        <div style={{ padding: 40, textAlign: "center" }}>
          <Sparkles size={36} className="spin" style={{ color: T.gold, marginBottom: 14 }} />
          <h3 style={{ fontFamily: T.serif, fontSize: 20, color: T.ink, marginBottom: 6 }}>Transcrevendo…</h3>
          <p style={{ fontSize: 12, color: T.muted }}>O Gemini está ouvindo e extraindo os dados.</p>
        </div>
      )}

      {step === "review" && forma && (
        <>
          <div style={{
            padding: 12, marginBottom: 14, background: `${T.green}11`,
            border: `1px solid ${T.green}`, borderRadius: 7,
            display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.green,
          }}>
            <CheckCircle2 size={14} /> Dados extraídos! Revise e ajuste se precisar.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Descrição *">
              <input type="text" value={forma.descricao}
                onChange={e => setForma({ ...forma, descricao: e.target.value })} />
            </Field>
            <Field label="Valor (R$) *">
              <input type="text" inputMode="decimal" value={forma.valor}
                onChange={e => setForma({ ...forma, valor: e.target.value })} />
            </Field>
            <Field label="Data">
              <input type="date" value={forma.data}
                onChange={e => setForma({ ...forma, data: e.target.value })} />
            </Field>
            <Field label="Tipo">
              <select value={forma.tipo} onChange={e => setForma({ ...forma, tipo: e.target.value })}>
                <option value="despesa">Despesa</option>
                <option value="receita">Receita</option>
              </select>
            </Field>
            <Field label="Categoria">
              <select value={forma.categoria} onChange={e => setForma({ ...forma, categoria: e.target.value })}>
                {categorias.filter(c => c.tipo === forma.tipo).map(c => (
                  <option key={c.id} value={c.nome}>{c.nome}</option>
                ))}
                {!categorias.some(c => c.nome === forma.categoria) && (
                  <option value={forma.categoria}>{forma.categoria} (sugerida)</option>
                )}
              </select>
            </Field>
            <Field label="Conta">
              <select value={forma.conta} onChange={e => setForma({ ...forma, conta: e.target.value })}>
                {contas.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex gap-3 mt-6 flex-wrap">
            <button className="btn-gold" onClick={confirmar} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={13} /> Criar transação
            </button>
            <button className="btn-ghost" onClick={refazer} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <RotateCcw size={13} /> Outra gravação
            </button>
            <button className="btn-ghost" onClick={onClose} style={{ marginLeft: "auto" }}>Cancelar</button>
          </div>
        </>
      )}

      {step !== "review" && step !== "recorded" && erro && <ErroBox texto={erro} />}
    </Modal>
  );
}

/* ============ subcomponentes ============ */

function BotaoMic({ onClick, gravando }) {
  return (
    <button
      onClick={onClick}
      aria-label={gravando ? "Parar gravação" : "Iniciar gravação"}
      style={{
        background: gravando ? T.red : T.gold,
        color: T.bg, border: "none",
        width: 96, height: 96, borderRadius: "50%",
        display: "grid", placeItems: "center",
        cursor: "pointer",
        boxShadow: gravando
          ? `0 0 0 12px ${T.red}22, 0 0 0 24px ${T.red}11`
          : `0 8px 24px -8px ${T.gold}88`,
        transition: "all .2s ease",
        margin: "0 auto",
      }}
    >
      {gravando ? <Square size={32} fill={T.bg} /> : <Mic size={36} />}
    </button>
  );
}

function ErroBox({ texto }) {
  return (
    <div style={{
      marginTop: 14, padding: 10, background: `${T.red}22`, color: T.red,
      border: `1px solid ${T.red}`, borderRadius: 6, fontSize: 12,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <AlertCircle size={14} /> {texto}
    </div>
  );
}

/* ============ helpers ============ */

function fmtDuracao(seg) {
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function transcrever(base64, mimeType, { contas, categorias }) {
  const hoje = todayISO();
  const dataDescr = new Date().toLocaleDateString("pt-BR");

  const categoriasTxt = categorias.length > 0
    ? `\nCategorias disponíveis: ${categorias.map(c => c.nome).join(", ")}.`
    : "";
  const contasTxt = contas.length > 0
    ? `\nContas disponíveis: ${contas.map(c => c.nome).join(", ")}.`
    : "";

  const prompt = `Esta é uma gravação de áudio em português onde o usuário descreve uma transação financeira. Transcreva e extraia os dados em JSON:

{
  "tipo": "despesa" ou "receita",
  "descricao": "estabelecimento ou descrição curta",
  "valor": número decimal sem aspas (ex: 15.50),
  "data": "YYYY-MM-DD",
  "categoria": "uma das disponíveis ou Outros",
  "conta": "nome da conta se mencionada explicitamente, ou null"
}

Regras:
- tipo: "despesa" se ele gastou/pagou/comprou; "receita" se recebeu/ganhou
- valor: traduza por extenso pra número. Ex: "quinze reais" → 15, "vinte e dois e cinquenta" → 22.50, "mil e duzentos" → 1200
- data: se disser "hoje" use ${hoje}; "ontem" use o dia anterior. Se não mencionar, use ${hoje}. Hoje é ${dataDescr}.
- categoria: escolha entre as disponíveis (ou "Outros" se nenhuma se encaixa)${categoriasTxt}${contasTxt}

Retorne SOMENTE o JSON, sem markdown, sem comentários.`;

  return gerarJSONGeminiComAudio(prompt, base64, mimeType, { maxOutputTokens: 512 });
}
