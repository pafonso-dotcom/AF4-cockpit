import { describe, it, expect } from "vitest";
import { avaliarVad, estadoInicialVad, VAD_DEFAULTS } from "../vad.js";

// Roda uma sequência de frames [nivel, duraçãoMs] e devolve os eventos.
function rodar(frames, modo = "ouvindo", opts = {}) {
  let estado = estadoInicialVad(0);
  let agora = 0;
  const eventos = [];
  for (const [nivel, dur] of frames) {
    for (let t = 0; t < dur; t += 50) {
      agora += 50;
      const r = avaliarVad(estado, nivel, agora, modo, opts);
      estado = r.estado;
      if (r.terminouFala) { eventos.push("fim"); estado = estadoInicialVad(agora); }
      if (r.falaSustentada) { eventos.push("barge"); estado = estadoInicialVad(agora); }
    }
  }
  return eventos;
}

describe("vad — modo ouvindo (detecção de turno)", () => {
  it("silêncio puro nunca dispara", () => {
    expect(rodar([[0.01, 5000]])).toEqual([]);
  });

  it("fala + 1,4s de silêncio dispara o fim do turno", () => {
    expect(rodar([[0.10, 800], [0.01, 2000]])).toEqual(["fim"]);
  });

  it("estalo curto (menos que minFalaMs) não vale como fala", () => {
    expect(rodar([[0.10, 150], [0.01, 3000]])).toEqual([]);
  });

  it("pausa curta no meio da frase NÃO corta (silêncio < 1,4s)", () => {
    expect(rodar([[0.10, 600], [0.01, 700], [0.10, 600], [0.01, 2000]])).toEqual(["fim"]);
  });
});

describe("vad — modo falando (barge-in)", () => {
  it("eco/ruído abaixo do limiar alto não interrompe", () => {
    expect(rodar([[VAD_DEFAULTS.limiarFala + 0.01, 3000]], "falando")).toEqual([]);
  });

  it("fala alta mas CURTA não interrompe; sustentada interrompe", () => {
    expect(rodar([[0.15, 300], [0.01, 500]], "falando")).toEqual([]);
    expect(rodar([[0.15, 900]], "falando")).toEqual(["barge"]);
  });
});
