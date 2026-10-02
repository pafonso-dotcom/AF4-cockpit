import { describe, it, expect } from "vitest";
import { linksBuscaVoos } from "../buscaVoos.js";

describe("busca de voos sem cadastro", () => {
  it("com códigos IATA gera Google, Skyscanner e Kayak", () => {
    const l = linksBuscaVoos({ origem: "gru", destino: "LIS", ida: "2026-11-12", volta: "2026-11-22", adultos: 3 });
    expect(l.map(x => x.id)).toEqual(["google", "skyscanner", "kayak"]);
    expect(l[1].url).toBe("https://www.skyscanner.com.br/transporte/passagens-aereas/gru/lis/261112/261122/?adultsv2=3");
    expect(l[2].url).toBe("https://www.kayak.com.br/flights/GRU-LIS/2026-11-12/2026-11-22/3adults");
  });
  it("destino por nome de cidade: só Google", () => {
    const l = linksBuscaVoos({ origem: "GRU", destino: "Lisboa, Portugal", ida: "2026-11-12" });
    expect(l.map(x => x.id)).toEqual(["google"]);
    expect(decodeURIComponent(l[0].url)).toContain("Voos de GRU para Lisboa, Portugal em 2026-11-12 só ida");
  });
});
