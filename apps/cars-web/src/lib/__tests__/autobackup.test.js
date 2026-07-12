import { describe, it, expect } from "vitest";
import { ehDeHoje, idsAExcluir, listarBackups, criarBackup } from "../autobackup.js";

describe("autobackup — helpers puros", () => {
  it("ehDeHoje: mesmo dia = true, outro dia = false", () => {
    const agora = new Date("2026-07-12T15:00:00").getTime();
    expect(ehDeHoje(new Date("2026-07-12T02:00:00").getTime(), agora)).toBe(true);
    expect(ehDeHoje(new Date("2026-07-11T23:00:00").getTime(), agora)).toBe(false);
  });

  it("idsAExcluir: mantém os últimos `max`, remove os mais antigos", () => {
    expect(idsAExcluir([1, 2, 3], 5)).toEqual([]);          // abaixo do limite
    expect(idsAExcluir([5, 1, 3, 2, 4], 3)).toEqual([1, 2]); // remove os 2 menores
    expect(idsAExcluir([1, 2, 3, 4], 4)).toEqual([]);        // exatamente no limite
  });

  it("degrada pra no-op sem IndexedDB (ambiente node) sem lançar", async () => {
    await expect(listarBackups()).resolves.toEqual([]);
    await expect(criarBackup({ a: 1 }, "teste")).resolves.toBe(false);
  });
});
