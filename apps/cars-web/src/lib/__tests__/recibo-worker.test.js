import { describe, it, expect } from "vitest";
import { handleRecibo, _internal } from "../../../../../worker/recibo.js";

// Helpers pra montar request/env/fetch falsos.
const makeReq = (body, { method = "POST", pin } = {}) => ({
  method,
  headers: { get: (h) => (h.toLowerCase() === "x-recibo-pin" ? (pin ?? null) : null) },
  json: async () => body,
});

const okClaude = (input) => async () => ({
  ok: true,
  json: async () => ({ content: [{ type: "tool_use", name: "extrair_recibo", input }] }),
});

const img = "QUJDRA=="; // base64 curto qualquer

describe("handleRecibo", () => {
  it("405 se não for POST", async () => {
    const r = await handleRecibo(makeReq({}, { method: "GET" }), { ANTHROPIC_API_KEY: "k" });
    expect(r.status).toBe(405);
  });

  it("500 sem ANTHROPIC_API_KEY", async () => {
    const r = await handleRecibo(makeReq({ imageBase64: img }), {});
    expect(r.status).toBe(500);
  });

  it("401 quando RECIBO_PIN configurado e header errado", async () => {
    const r = await handleRecibo(
      makeReq({ imageBase64: img }, { pin: "errado" }),
      { ANTHROPIC_API_KEY: "k", RECIBO_PIN: "1234" }
    );
    expect(r.status).toBe(401);
  });

  it("passa quando o PIN bate", async () => {
    const r = await handleRecibo(
      makeReq({ imageBase64: img }, { pin: "1234" }),
      { ANTHROPIC_API_KEY: "k", RECIBO_PIN: "1234" },
      okClaude({ valor: 100, tipo: "despesa", categoriaSugerida: "Alimentação", confianca: 90 })
    );
    expect(r.status).toBe(200);
  });

  it("400 sem imageBase64", async () => {
    const r = await handleRecibo(makeReq({}), { ANTHROPIC_API_KEY: "k" });
    expect(r.status).toBe(400);
  });

  it("400 com mediaType não suportado", async () => {
    const r = await handleRecibo(makeReq({ imageBase64: img, mediaType: "image/tiff" }), { ANTHROPIC_API_KEY: "k" });
    expect(r.status).toBe(400);
  });

  it("422 quando o modelo não devolve tool_use", async () => {
    const semTool = async () => ({ ok: true, json: async () => ({ content: [{ type: "text", text: "nada" }] }) });
    const r = await handleRecibo(makeReq({ imageBase64: img }), { ANTHROPIC_API_KEY: "k" }, semTool);
    expect(r.status).toBe(422);
  });

  it("502 quando a API de visão falha", async () => {
    const erro = async () => ({ ok: false, status: 500, text: async () => "boom" });
    const r = await handleRecibo(makeReq({ imageBase64: img }), { ANTHROPIC_API_KEY: "k" }, erro);
    expect(r.status).toBe(502);
  });

  it("normaliza e devolve o recibo no sucesso", async () => {
    const r = await handleRecibo(
      makeReq({ imageBase64: img, categorias: ["Alimentação"] }),
      { ANTHROPIC_API_KEY: "k" },
      okClaude({ valor: -42.5, tipo: "lixo", categoriaSugerida: "", confianca: 150, data: "31/05/2026", itens: [{ descricao: "Pão" }, { valor: 5 }] })
    );
    expect(r.status).toBe(200);
    const body = JSON.parse(await r.text());
    expect(body.ok).toBe(true);
    expect(body.recibo.valor).toBe(42.5);            // abs
    expect(body.recibo.tipo).toBe("despesa");        // fallback de enum
    expect(body.recibo.categoriaSugerida).toBe("Outros"); // vazio → Outros
    expect(body.recibo.confianca).toBe(100);         // clamp 0..100
    expect(body.recibo.data).toBe("");               // data fora do formato ISO → vazia
    expect(body.recibo.itens).toHaveLength(1);       // item sem descrição é descartado
  });
});

describe("recibo _internal", () => {
  it("base64Bytes estima o tamanho corretamente", () => {
    // "QUJDRA==" decodifica em 4 bytes ("ABCD")
    expect(_internal.base64Bytes("QUJDRA==")).toBe(4);
  });
  it("usa o modelo Haiku", () => {
    expect(_internal.MODEL).toContain("haiku");
  });
});
