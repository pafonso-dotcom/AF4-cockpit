import { describe, it, expect } from "vitest";
import { fmt, fmtN, fmtP, uid, todayISO, simulateTick } from "../format.js";

describe("format helpers", () => {
  describe("fmt (currency)", () => {
    it("formats Brazilian Real by default", () => {
      expect(fmt(1234.56)).toMatch(/R\$\s?1\.234,56/);
    });
    it("handles zero and null", () => {
      expect(fmt(0)).toMatch(/R\$\s?0,00/);
      expect(fmt(null)).toMatch(/R\$\s?0,00/);
      expect(fmt(undefined)).toMatch(/R\$\s?0,00/);
    });
    it("handles negative", () => {
      expect(fmt(-100)).toMatch(/-?R\$\s?100,00/);
    });
  });

  describe("fmtN (number)", () => {
    it("uses 2 decimals by default", () => {
      expect(fmtN(1234.5)).toBe("1.234,50");
    });
    it("respects custom decimals", () => {
      expect(fmtN(1.123456, 4)).toBe("1,1235");
    });
  });

  describe("fmtP (percentage)", () => {
    it("adds + for positive", () => {
      expect(fmtP(5.5)).toBe("+5,50%");
    });
    it("keeps minus for negative", () => {
      expect(fmtP(-3.2)).toBe("-3,20%");
    });
    it("handles zero with +", () => {
      expect(fmtP(0)).toBe("+0,00%");
    });
  });

  describe("uid", () => {
    it("returns a non-empty string", () => {
      expect(uid()).toMatch(/^.+$/);
    });
    it("generates unique values", () => {
      const ids = new Set();
      for (let i = 0; i < 1000; i++) ids.add(uid());
      expect(ids.size).toBe(1000);
    });
  });

  describe("todayISO", () => {
    it("returns YYYY-MM-DD format", () => {
      expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("simulateTick", () => {
    it("stays within volatility bounds", () => {
      for (let i = 0; i < 100; i++) {
        const result = simulateTick(100, 0.02);
        expect(result).toBeGreaterThan(97);
        expect(result).toBeLessThan(103);
      }
    });
    it("never returns below 0.01", () => {
      const result = simulateTick(0.01, 0.99);
      expect(result).toBeGreaterThanOrEqual(0.01);
    });
  });
});
