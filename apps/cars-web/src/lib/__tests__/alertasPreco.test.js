import { describe, it, expect } from "vitest";
import { alertasDisparados, filtrarNovos, marcarNotificados, chaveAlerta } from "../alertasPreco.js";

const ativo = (over = {}) => ({ ticker: "HGRE11", preco: 110, realtime: true, ...over });

describe("alertasDisparados", () => {
  it("dispara acima (>=) e abaixo (<=) só com cotação real", () => {
    const r = alertasDisparados([
      ativo({ alertaAcima: 105 }),                       // 110 >= 105 → dispara
      ativo({ ticker: "XPML11", preco: 90, alertaAbaixo: 95 }), // 90 <= 95 → dispara
      ativo({ ticker: "KNCR11", preco: 100, alertaAcima: 105 }), // não cruzou
      ativo({ ticker: "SEMREAL", alertaAcima: 1, realtime: false }), // sem cotação real
    ]);
    expect(r.map(a => `${a.ticker}:${a.dir}`)).toEqual(["HGRE11:acima", "XPML11:abaixo"]);
    expect(r[0].alvo).toBe(105);
    expect(r[0].preco).toBe(110);
  });

  it("mesmo ativo pode disparar as duas direções (faixa invertida) e ignora alvo 0/ausente", () => {
    expect(alertasDisparados([ativo({ alertaAcima: 0, alertaAbaixo: 0 })])).toEqual([]);
    expect(alertasDisparados([ativo({})])).toEqual([]);
    const r = alertasDisparados([ativo({ alertaAcima: 100, alertaAbaixo: 120 })]);
    expect(r.length).toBe(2);
  });
});

describe("dedupe diário (filtrarNovos + marcarNotificados)", () => {
  it("não repete o aviso no mesmo dia, mas repete no dia seguinte", () => {
    const alertas = alertasDisparados([ativo({ alertaAcima: 105 })]);
    let notif = {};
    expect(filtrarNovos(alertas, notif, "2026-09-18").length).toBe(1);
    notif = marcarNotificados(alertas, notif, "2026-09-18");
    expect(notif[chaveAlerta(alertas[0])]).toBe("2026-09-18");
    expect(filtrarNovos(alertas, notif, "2026-09-18").length).toBe(0);
    expect(filtrarNovos(alertas, notif, "2026-09-19").length).toBe(1);
  });
});
