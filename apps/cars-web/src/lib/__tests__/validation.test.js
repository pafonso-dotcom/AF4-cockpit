import { describe, it, expect } from "vitest";
import { v, schemas, validate } from "../validation.js";

describe("validation primitives", () => {
  describe("v.string", () => {
    it("rejects empty when required", () => {
      const r = v.string()("");
      expect(r.ok).toBe(false);
    });
    it("accepts empty when not required", () => {
      const r = v.string({ required: false })("");
      expect(r.ok).toBe(true);
    });
    it("trims whitespace", () => {
      const r = v.string()("  hello  ");
      expect(r.value).toBe("hello");
    });
    it("enforces min/max length", () => {
      expect(v.string({ min: 5 })("abc").ok).toBe(false);
      expect(v.string({ max: 3 })("abcdef").ok).toBe(false);
    });
  });

  describe("v.number", () => {
    it("parses BR-style decimal", () => {
      expect(v.number()("1234,56").value).toBeCloseTo(1234.56);
    });
    it("rejects non-numeric strings", () => {
      expect(v.number()("abc").ok).toBe(false);
    });
    it("enforces integer", () => {
      expect(v.number({ integer: true })(1.5).ok).toBe(false);
      expect(v.number({ integer: true })(2).ok).toBe(true);
    });
    it("enforces min/max", () => {
      expect(v.number({ min: 0 })(-1).ok).toBe(false);
      expect(v.number({ max: 10 })(11).ok).toBe(false);
    });
  });

  describe("v.enum", () => {
    it("accepts valid values", () => {
      expect(v.enum(["a", "b"])("a").ok).toBe(true);
    });
    it("rejects invalid values", () => {
      expect(v.enum(["a", "b"])("c").ok).toBe(false);
    });
  });

  describe("v.date", () => {
    it("accepts YYYY-MM-DD", () => {
      expect(v.date()("2024-01-15").ok).toBe(true);
    });
    it("rejects bad format", () => {
      expect(v.date()("15/01/2024").ok).toBe(false);
    });
  });
});

describe("schemas via validate()", () => {
  it("validates a complete transaction", () => {
    const r = validate(schemas.transacao, {
      descricao: "Aluguel",
      valor: 2200,
      tipo: "despesa",
      categoria: "Moradia",
      conta: "Principal",
      data: "2024-01-15",
      obs: "",
      fixa: true,
      vencimento: 5,
    });
    expect(r.ok).toBe(true);
    expect(r.value.fixa).toBe(true);
  });

  it("rejects transaction with negative value", () => {
    const r = validate(schemas.transacao, {
      descricao: "X", valor: -10, tipo: "despesa",
      categoria: "C", conta: "A", data: "2024-01-15",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.valor).toBeDefined();
  });

  it("rejects cartao with vencimento out of range", () => {
    const r = validate(schemas.cartao, {
      nome: "Bradesco", banco: "bradesco",
      limite: 1000, vencimento: 32, fechamento: 28, tipo: "principal",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.vencimento).toBeDefined();
  });

  it("makes optional fields really optional", () => {
    const r = validate(schemas.devedor, {
      nome: "Ana", valor: 100, quando: "2024-01-15",
      // oque and combinado omitted
    });
    expect(r.ok).toBe(true);
  });
});
