import { describe, it, expect } from "vitest";
import { calendarioProventos } from "../invest-metrics.js";

const hoje = new Date(2026, 6, 4); // 04/07/2026

describe("calendarioProventos com proventos reais (brapi)", () => {
  const ativos = [{ ticker: "KNCR11", tipo: "fii", qtd: 100, preco: 107.66 }];

  it("anunciado dentro da janela entra com a cota REAL e flag real", () => {
    const historicoReal = {
      KNCR11: [
        { pagamento: "2026-07-14", valor: 1.10 },  // anunciado, futuro
        { pagamento: "2026-06-13", valor: 1.07 },  // passado (fora da janela do calendário)
      ],
    };
    const lista = calendarioProventos(ativos, hoje, historicoReal);
    const jul = lista.find(p => p.data === "2026-07-14");
    expect(jul).toBeTruthy();
    expect(jul.valorPorCota).toBeCloseTo(1.10, 5);
    expect(jul.total).toBeCloseTo(110, 5);
    expect(jul.real).toBe(true);
    expect(jul.tipo).toBe("Rendimento");
  });

  it("FII projeta meses sem anúncio usando a ÚLTIMA cota real (estimado)", () => {
    const historicoReal = {
      KNCR11: [
        { pagamento: "2026-07-14", valor: 1.10 },
        { pagamento: "2026-06-13", valor: 1.07 },
      ],
    };
    const lista = calendarioProventos(ativos, hoje, historicoReal);
    const ago = lista.find(p => p.data.startsWith("2026-08"));
    const set = lista.find(p => p.data.startsWith("2026-09"));
    expect(ago).toBeTruthy();
    expect(ago.valorPorCota).toBeCloseTo(1.10, 5); // última cota real, não pseudo
    expect(ago.estimado).toBe(true);
    expect(ago.data).toBe("2026-08-14"); // mesmo dia do último pagamento
    expect(set.valorPorCota).toBeCloseTo(1.10, 5);
  });

  it("ação com histórico real: só anunciados, sem projeção sintética", () => {
    const acao = [{ ticker: "WEGE3", tipo: "acao", qtd: 20, preco: 46.68 }];
    const historicoReal = { WEGE3: [{ pagamento: "2026-08-15", valor: 0.12 }] };
    const lista = calendarioProventos(acao, hoje, historicoReal);
    expect(lista).toHaveLength(1);
    expect(lista[0].data).toBe("2026-08-15");
    expect(lista[0].valorPorCota).toBeCloseTo(0.12, 5);
    expect(lista[0].real).toBe(true);
  });

  it("sem histórico real cai no comportamento legado (estimativa)", () => {
    const lista = calendarioProventos(ativos, hoje, {});
    expect(lista.length).toBeGreaterThan(0);
    lista.forEach(p => {
      expect(p.real).toBeFalsy();
      expect(p.total).toBeCloseTo(p.valorPorCota * p.qtd, 5);
    });
  });
});
