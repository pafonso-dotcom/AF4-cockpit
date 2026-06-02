// Gera o apple-touch-icon do Numvi (PNG 512x512) sem dependências externas.
// Desenha fundo grafite + anel dourado + "N", rasteriza com supersampling
// e codifica o PNG na mão (zlib nativo). Rode: node scripts/gen-icon.mjs
import zlib from "node:zlib";
import { writeFileSync } from "node:fs";

const OUT = new URL("../public/apple-touch-icon.png", import.meta.url);
const SIZE = 512;
const SS = 3;                 // supersampling (antialias)
const W = SIZE * SS, H = SIZE * SS;

// paleta
const BG = [0x23, 0x27, 0x2e];
const GOLD_HI = [0xf4, 0xd4, 0x7c];
const GOLD_LO = [0xb8, 0x90, 0x2e];

// espaço de desenho 64x64 (igual ao SVG) → escala pro canvas
const U = W / 64;
const cx = 32, cy = 32, rOut = 24.6, rIn = 21.4; // anel (r=23, stroke 3.2)

// polígono do "N" (mesmos vértices do path do SVG)
const N = [
  [23,43],[23,21],[27.5,21],[37,35],[37,21],[41,21],[41,43],[36.5,43],[27,29],[27,43],
];
function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
// dourado interpolado pela diagonal (canto sup-esq → inf-dir)
function gold(ux, uy) {
  const t = Math.max(0, Math.min(1, ((ux - 12) + (uy - 10)) / 84));
  return [
    Math.round(GOLD_HI[0] + (GOLD_LO[0] - GOLD_HI[0]) * t),
    Math.round(GOLD_HI[1] + (GOLD_LO[1] - GOLD_HI[1]) * t),
    Math.round(GOLD_HI[2] + (GOLD_LO[2] - GOLD_HI[2]) * t),
  ];
}

// rasteriza em RGBA
const px = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const ux = x / U, uy = y / U;            // coords no espaço 64
    const dist = Math.hypot(ux - cx, uy - cy);
    const isRing = dist <= rOut && dist >= rIn;
    const isN = inPoly(ux, uy, N);
    let c = BG;
    if (isRing || isN) c = gold(ux, uy);
    const i = (y * W + x) * 4;
    px[i] = c[0]; px[i+1] = c[1]; px[i+2] = c[2]; px[i+3] = 255;
  }
}

// downsample SSxSS → SIZE (box filter)
const out = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    let r=0,g=0,b=0,a=0;
    for (let dy=0; dy<SS; dy++) for (let dx=0; dx<SS; dx++) {
      const i = ((y*SS+dy)*W + (x*SS+dx)) * 4;
      r+=px[i]; g+=px[i+1]; b+=px[i+2]; a+=px[i+3];
    }
    const n = SS*SS, o = (y*SIZE+x)*4;
    out[o]=Math.round(r/n); out[o+1]=Math.round(g/n); out[o+2]=Math.round(b/n); out[o+3]=Math.round(a/n);
  }
}

// --- encode PNG ---
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, data])) >>> 0, 0);
  return Buffer.concat([len, tb, data, crc]);
}
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n=0; n<256; n++){ let c=n; for(let k=0;k<8;k++) c = c&1 ? 0xedb88320 ^ (c>>>1) : c>>>1; t[n]=c>>>0; }
  return t;
})();
function crc32(buf){ let c=0xffffffff; for(let i=0;i<buf.length;i++) c=CRC_TABLE[(c^buf[i])&0xff]^(c>>>8); return (c^0xffffffff)>>>0; }

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE,0); ihdr.writeUInt32BE(SIZE,4);
ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0; // 8-bit RGBA

// scanlines com filtro 0
const raw = Buffer.alloc(SIZE * (SIZE*4 + 1));
for (let y=0; y<SIZE; y++){
  raw[y*(SIZE*4+1)] = 0;
  out.copy(raw, y*(SIZE*4+1)+1, y*SIZE*4, (y+1)*SIZE*4);
}
const idat = zlib.deflateSync(raw, { level: 9 });
const png = Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(OUT, png);
console.log("apple-touch-icon.png gerado:", png.length, "bytes");
