import { describe, it, expect } from "vitest";
import { hojeISOLocal, deveMostrarOlhada, dataPorExtenso } from "../olhadaRapida.js";

describe("olhadaRapida", () => {
  it("hojeISOLocal usa o fuso local com zero à esquerda", () => {
    expect(hojeISOLocal(new Date(2026, 8, 22))).toBe("2026-09-22");
    expect(hojeISOLocal(new Date(2026, 0, 3))).toBe("2026-01-03");
  });

  it("deveMostrarOlhada só na primeira abertura do dia", () => {
    expect(deveMostrarOlhada(null, "2026-09-22")).toBe(true);
    expect(deveMostrarOlhada("2026-09-21", "2026-09-22")).toBe(true);
    expect(deveMostrarOlhada("2026-09-22", "2026-09-22")).toBe(false);
  });

  it("dataPorExtenso em pt-BR", () => {
    // 22/09/2026 é uma terça-feira
    expect(dataPorExtenso(new Date(2026, 8, 22))).toBe("terça-feira · 22 de setembro");
    expect(dataPorExtenso(new Date(2026, 0, 1))).toBe("quinta-feira · 1 de janeiro");
  });
});
