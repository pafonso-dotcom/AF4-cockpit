import { describe, it, expect } from "vitest";
import { parseOFX, parseDataBR, parseValorBR, autoMapCSV } from "../importExport.js";

describe("parseDataBR", () => {
  it("parses DD/MM/YYYY", () => {
    expect(parseDataBR("15/01/2024")).toBe("2024-01-15");
  });
  it("parses DD/MM/YY", () => {
    expect(parseDataBR("15/01/24")).toBe("2024-01-15");
  });
  it("returns ISO if already ISO", () => {
    expect(parseDataBR("2024-01-15")).toBe("2024-01-15");
  });
  it("returns null for invalid", () => {
    expect(parseDataBR("não é data")).toBeNull();
  });
});

describe("parseValorBR", () => {
  it("parses with comma decimal", () => {
    expect(parseValorBR("1.234,56")).toBeCloseTo(1234.56);
  });
  it("parses with dot decimal", () => {
    expect(parseValorBR("1234.56")).toBeCloseTo(1234.56);
  });
  it("strips currency prefix", () => {
    expect(parseValorBR("R$ 100,00")).toBeCloseTo(100);
  });
  it("handles negative", () => {
    expect(parseValorBR("-100,50")).toBeCloseTo(-100.5);
  });
});

describe("autoMapCSV", () => {
  it("maps common Portuguese headers", () => {
    const map = autoMapCSV(["Data", "Descrição", "Valor", "Categoria"]);
    expect(map.data).toBe("Data");
    expect(map.descricao).toBe("Descrição");
    expect(map.valor).toBe("Valor");
    expect(map.categoria).toBe("Categoria");
  });
  it("maps English variants", () => {
    const map = autoMapCSV(["date", "description", "amount"]);
    expect(map.data).toBe("date");
    expect(map.descricao).toBe("description");
    expect(map.valor).toBe("amount");
  });
});

describe("parseOFX", () => {
  it("parses basic OFX SGML", () => {
    const ofx = `
<OFX>
  <BANKMSGSRSV1>
    <STMTTRN>
      <TRNTYPE>DEBIT
      <DTPOSTED>20240115
      <TRNAMT>-150.00
      <FITID>123
      <MEMO>Mercado
    </STMTTRN>
    <STMTTRN>
      <TRNTYPE>CREDIT
      <DTPOSTED>20240120
      <TRNAMT>3000.00
      <FITID>124
      <MEMO>Salario
    </STMTTRN>
  </BANKMSGSRSV1>
</OFX>`;
    const result = parseOFX(ofx);
    expect(result).toHaveLength(2);
    expect(result[0].valor).toBeCloseTo(150);
    expect(result[0].tipo).toBe("despesa");
    expect(result[0].descricao).toBe("Mercado");
    expect(result[0].data).toBe("2024-01-15");
  });

  it("returns empty array for non-OFX input", () => {
    expect(parseOFX("not ofx at all")).toEqual([]);
  });
});
