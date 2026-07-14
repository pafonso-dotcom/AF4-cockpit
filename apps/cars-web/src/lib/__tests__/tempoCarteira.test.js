import { describe, it, expect } from "vitest";
import { tempoDeCarteira } from "../tempoCarteira.js";

describe("tempoDeCarteira", () => {
  it("anos e meses", () => {
    expect(tempoDeCarteira("2025-03-12", "2026-07-14")).toBe("há 1 ano e 4 meses");
    expect(tempoDeCarteira("2024-01-10", "2026-07-14")).toBe("há 2 anos e 6 meses");
  });
  it("ano exato (sem meses)", () => {
    expect(tempoDeCarteira("2025-07-14", "2026-07-14")).toBe("há 1 ano");
  });
  it("só meses", () => {
    expect(tempoDeCarteira("2026-01-05", "2026-07-14")).toBe("há 6 meses");
    expect(tempoDeCarteira("2026-06-14", "2026-07-14")).toBe("há 1 mês");
  });
  it("dias e hoje", () => {
    expect(tempoDeCarteira("2026-07-01", "2026-07-14")).toBe("há 13 dias");
    expect(tempoDeCarteira("2026-07-13", "2026-07-14")).toBe("há 1 dia");
    expect(tempoDeCarteira("2026-07-14", "2026-07-14")).toBe("hoje");
  });
  it("respeita o dia do mês (ainda não fechou o mês)", () => {
    expect(tempoDeCarteira("2026-06-20", "2026-07-14")).toBe("há 24 dias"); // < 1 mês
  });
  it("data futura ou vazia → string vazia", () => {
    expect(tempoDeCarteira("2027-01-01", "2026-07-14")).toBe("");
    expect(tempoDeCarteira("", "2026-07-14")).toBe("");
    expect(tempoDeCarteira(null, "2026-07-14")).toBe("");
  });
});
