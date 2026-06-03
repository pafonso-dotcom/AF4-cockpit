/**
 * Cliente do scanner de recibo via Worker /api/recibo (Claude Vision).
 *
 * A chave da Anthropic vive no Worker (nunca no app). Aqui a gente só:
 *   1) comprime a foto no cliente (canvas → ~1024px, JPEG) pra baixar custo/upload,
 *   2) manda pro endpoint com o PIN (se configurado),
 *   3) devolve o recibo já normalizado pelo Worker.
 *
 * PIN opcional: guardado em localStorage "af4:recibo-pin" (Configurações → APIs).
 */

const ENDPOINT = "/api/recibo";
const PIN_KEY = "af4:recibo-pin";
const MAX_DIM = 1024;       // maior lado da imagem enviada
const JPEG_QUALITY = 0.82;

export function getReciboPin() {
  try { return (localStorage.getItem(PIN_KEY) || "").trim(); } catch { return ""; }
}
export function setReciboPin(v) {
  try { localStorage.setItem(PIN_KEY, (v || "").trim()); } catch {}
}

/**
 * Comprime um File de imagem: redimensiona pro maior lado = MAX_DIM e
 * reencoda como JPEG. Retorna { base64, mediaType }. base64 sem prefixo data:.
 * Faz fallback pro arquivo original se o canvas falhar (ex.: HEIC sem suporte).
 */
export async function comprimirImagem(file, maxDim = MAX_DIM) {
  const dataUrl = await lerComoDataURL(file);
  try {
    const img = await carregarImagem(dataUrl);
    const escala = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * escala));
    const h = Math.max(1, Math.round(img.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const jpeg = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    return { base64: jpeg.split(",")[1], mediaType: "image/jpeg" };
  } catch {
    // Fallback: manda o original (só funciona pra tipos que o Claude aceita).
    const mediaType = file.type && /image\/(jpeg|png|webp|gif)/.test(file.type) ? file.type : "image/jpeg";
    return { base64: dataUrl.split(",")[1], mediaType };
  }
}

/**
 * Extrai o recibo de uma foto via Worker. Lança Error com mensagem amigável.
 * Retorna { loja, cnpj, data, valor, tipo, categoriaSugerida, subcategoria,
 *           pagamento, itens[], confianca, alerta }.
 */
export async function extrairReciboViaWorker({ file, categorias = [] }) {
  if (!file) throw new Error("Selecione uma imagem.");
  const { base64, mediaType } = await comprimirImagem(file);

  const headers = { "Content-Type": "application/json" };
  const pin = getReciboPin();
  if (pin) headers["x-recibo-pin"] = pin;

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({ imageBase64: base64, mediaType, categorias }),
    });
  } catch {
    throw new Error("Sem conexão com o servidor. Tente de novo.");
  }

  let body = null;
  try { body = await res.json(); } catch {}

  if (!res.ok) {
    if (res.status === 401) throw new Error("PIN do recibo inválido ou ausente. Configure em Configurações → APIs.");
    if (res.status === 413) throw new Error("Foto muito grande. Tente uma imagem menor.");
    if (res.status === 422) throw new Error("Não consegui ler o recibo. Tente uma foto mais nítida e bem enquadrada.");
    if (res.status === 500) throw new Error("Servidor sem chave configurada. Avise o administrador.");
    throw new Error(body?.error || `Falha ao processar (${res.status}).`);
  }
  if (!body?.recibo) throw new Error("Resposta inesperada do servidor.");
  return body.recibo;
}

// ---- helpers ----
function lerComoDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error("Falha ao ler a imagem."));
    r.readAsDataURL(file);
  });
}
function carregarImagem(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Imagem inválida."));
    img.src = src;
  });
}
