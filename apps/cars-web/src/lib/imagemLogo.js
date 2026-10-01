/**
 * Prepara a imagem escolhida pra virar logo de conta (dataURL pequeno).
 * Foto/print do iPhone passa fácil de 200 KB e pode vir em HEIC: em vez de
 * recusar, reduz pra no máx. 160 px e regrava em PNG (JPEG se ficar grande).
 * GIF/WebP até 400 KB vão como estão, pra manter a animação.
 */
const LADO = 160;

const lerDataURL = (file) => new Promise((ok, erro) => {
  const r = new FileReader();
  r.onload = () => ok(r.result);
  r.onerror = () => erro(new Error("Não consegui ler o arquivo."));
  r.readAsDataURL(file);
});

export async function prepararLogo(file) {
  if (!file) throw new Error("Nenhuma imagem escolhida.");
  const tipo = String(file.type || "").toLowerCase();
  if ((tipo === "image/gif" || tipo === "image/webp") && file.size <= 400 * 1024) return lerDataURL(file);

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => erro(new Error("Formato de imagem não suportado — tente PNG ou JPG."));
      i.src = url;
    });
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const esc = Math.min(1, LADO / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * esc)), ch = Math.max(1, Math.round(h * esc));
    const canvas = document.createElement("canvas");
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, cw, ch);
    let out = canvas.toDataURL("image/png");
    if (out.length > 150 * 1024) {
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, cw, ch);
      out = canvas.toDataURL("image/jpeg", 0.85);
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}
