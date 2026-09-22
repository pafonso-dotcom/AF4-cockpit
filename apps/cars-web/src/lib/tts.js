/**
 * TTS do Jarbas — fala textos em PT-BR com custo zero.
 *
 * 1ª opção: Gemini TTS (gemini-2.5-flash-preview-tts) — MESMA chave grátis do
 * Gemini já configurada; devolve PCM 24kHz base64, que embrulhamos num WAV.
 * Fallback silencioso: speechSynthesis nativo do navegador (voz "Luciana" no
 * iPhone), que é grátis, offline e sempre existe.
 *
 * Navegadores só tocam áudio após um gesto do usuário — sempre chame `falar`
 * a partir de um clique/toque.
 */

const MODELO_TTS = "gemini-2.5-flash-preview-tts";
const VOZ_GEMINI = "Kore"; // voz neutra e clara em PT-BR
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

let audioAtual = null;

// Tira emoji/markdown/asteriscos pra fala ficar natural. Pura (testável).
export function limparParaFala(texto = "") {
  return String(texto)
    .replace(/[*_`#>|]/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // remove emojis e símbolos pictográficos
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

// PCM 16-bit mono base64 → Blob WAV tocável (header de 44 bytes). Pura.
export function pcmParaWav(base64, sampleRate = 24000) {
  const bin = atob(base64);
  const pcm = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) pcm[i] = bin.charCodeAt(i);
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const escrever = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  escrever(0, "RIFF"); v.setUint32(4, 36 + pcm.length, true); escrever(8, "WAVE");
  escrever(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  escrever(36, "data"); v.setUint32(40, pcm.length, true);
  return new Blob([header, pcm], { type: "audio/wav" });
}

async function falarGemini(texto, geminiKey) {
  const res = await fetch(`${ENDPOINT}/${MODELO_TTS}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: texto }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOZ_GEMINI } } },
      },
    }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}`);
  const data = await res.json();
  const b64 = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
  if (!b64) throw new Error("TTS sem áudio");
  const url = URL.createObjectURL(pcmParaWav(b64));
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audioAtual = audio;
    audio.onended = () => { URL.revokeObjectURL(url); if (audioAtual === audio) audioAtual = null; resolve(); };
    audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error("play falhou")); };
    audio.play().catch(reject);
  });
}

function falarNativo(texto) {
  return new Promise((resolve) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return resolve();
      synth.cancel();
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = "pt-BR";
      const vozes = synth.getVoices() || [];
      u.voice = vozes.find(v => /luciana/i.test(v.name))
        || vozes.find(v => v.lang === "pt-BR")
        || vozes.find(v => (v.lang || "").startsWith("pt"))
        || null;
      u.rate = 1.02;
      u.onend = resolve;
      u.onerror = resolve;
      synth.speak(u);
    } catch { resolve(); }
  });
}

/**
 * Fala o texto. Tenta Gemini TTS (se houver chave); qualquer falha (cota do
 * dia, offline, formato) cai na voz nativa sem incomodar o usuário.
 */
export async function falar(texto, { geminiKey } = {}) {
  const limpo = limparParaFala(texto);
  if (!limpo) return;
  pararFala();
  if (geminiKey) {
    try { await falarGemini(limpo, geminiKey); return; }
    catch { /* cai no nativo */ }
  }
  await falarNativo(limpo);
}

export function pararFala() {
  try { window.speechSynthesis?.cancel(); } catch {}
  try { if (audioAtual) { audioAtual.pause(); audioAtual = null; } } catch {}
}
