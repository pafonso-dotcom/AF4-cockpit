import { describe, it, expect } from "vitest";
import {
  ASSET_CLASS_LABELS,
  ASSET_CLASS_COLORS,
  PROVENTO_REGEX,
} from "../invest-constants.js";

describe("ASSET_CLASS_LABELS", () => {
  it("has all known classes", () => {
    expect(ASSET_CLASS_LABELS.acao).toBe("Ações BR");
    expect(ASSET_CLASS_LABELS.fii).toBe("FIIs");
    expect(ASSET_CLASS_LABELS.stock).toBe("Stocks US");
    expect(ASSET_CLASS_LABELS.reit).toBe("REITs");
    expect(ASSET_CLASS_LABELS.etf).toBe("ETFs");
    expect(ASSET_CLASS_LABELS.cripto).toBe("Cripto");
    expect(ASSET_CLASS_LABELS.tesouro).toBe("Tesouro");
    expect(ASSET_CLASS_LABELS.cdb).toBe("CDB");
    expect(ASSET_CLASS_LABELS.outro).toBe("Outros");
  });
});

describe("ASSET_CLASS_COLORS", () => {
  it("has a color for each known class", () => {
    for (const k of Object.keys(ASSET_CLASS_LABELS)) {
      expect(ASSET_CLASS_COLORS[k]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
  it("rf is cyan (not aligned with tesouro green)", () => {
    expect(ASSET_CLASS_COLORS.rf).toBe("#06b6d4");
    expect(ASSET_CLASS_COLORS.rf).not.toBe(ASSET_CLASS_COLORS.tesouro);
  });
});

describe("PROVENTO_REGEX", () => {
  it("matches common provento descriptions", () => {
    expect(PROVENTO_REGEX.test("Provento KNRI11")).toBe(true);
    expect(PROVENTO_REGEX.test("Dividendo ITSA4")).toBe(true);
    expect(PROVENTO_REGEX.test("Rendimento MXRF11")).toBe(true);
    expect(PROVENTO_REGEX.test("JCP Banco do Brasil")).toBe(true);
    expect(PROVENTO_REGEX.test("Juros sobre capital próprio")).toBe(true);
  });
  it("does not match unrelated descriptions", () => {
    expect(PROVENTO_REGEX.test("Compra de ações")).toBe(false);
    expect(PROVENTO_REGEX.test("Pagamento boleto")).toBe(false);
  });
  it("does NOT match plain 'juros' without 'sobre'", () => {
    expect(PROVENTO_REGEX.test("Juros de empréstimo")).toBe(false);
    expect(PROVENTO_REGEX.test("Pagamento de juros bancários")).toBe(false);
  });
  it("does NOT match jcp as part of a larger word", () => {
    expect(PROVENTO_REGEX.test("Compra jcpenney")).toBe(false);
  });
  it("still matches 'juros sobre' variants", () => {
    expect(PROVENTO_REGEX.test("Juros sobre capital próprio")).toBe(true);
    expect(PROVENTO_REGEX.test("JCP da Vale")).toBe(true); // jcp at word boundary
  });
});
