import { describe, it, expect } from "vitest";
import { montarResumoDia } from "../resumoDia.js";

const HOJE = new Date(2026, 8, 21); // 21/09/2026

describe("montarResumoDia", () => {
  it("avisa o que vence hoje (1 conta com nome; várias com contagem)", () => {
    const um = montarResumoDia({
      despesasMes: [{ descricao: "BOA BOLA", valor: 2544, data: "2026-09-21", status: "pendente" }],
      hoje: HOJE, fmt: v => `R$${v}`,
    });
    expect(um[0].texto).toContain("BOA BOLA");
    const varios = montarResumoDia({
      despesasMes: [
        { descricao: "A", valor: 100, data: "2026-09-21", status: "pendente" },
        { descricao: "B", valor: 50, data: "2026-09-21", status: "atrasada" },
        { descricao: "paga hoje", valor: 999, data: "2026-09-21", status: "paga" }, // fora
        { descricao: "amanhã", valor: 999, data: "2026-09-22", status: "pendente" }, // fora
      ],
      hoje: HOJE, fmt: v => `R$${v}`,
    });
    expect(varios[0].texto).toContain("2 contas");
    expect(varios[0].texto).toContain("R$150");
  });

  it("avisa o que tem A RECEBER hoje (devedores do dia, valor em aberto)", () => {
    const um = montarResumoDia({
      devedores: [
        { nome: "Jorge", valor: 500, valorRecebido: 100, vencimento: "2026-09-21" },
        { nome: "amanhã", valor: 900, vencimento: "2026-09-22" },            // fora
        { nome: "recebido", valor: 300, recebido: true, vencimento: "2026-09-21" }, // fora
        { nome: "quitado", valor: 200, valorRecebido: 200, vencimento: "2026-09-21" }, // fora
      ],
      hoje: HOJE, fmt: v => `R$${v}`,
    });
    expect(um[0].cor).toBe("green");
    expect(um[0].texto).toContain("A receber hoje: Jorge");
    expect(um[0].texto).toContain("R$400");
    const varios = montarResumoDia({
      devedores: [
        { nome: "A", valor: 100, vencimento: "2026-09-21" },
        { nome: "B", valor: 50, vencimento: "2026-09-21" },
      ],
      hoje: HOJE, fmt: v => `R$${v}`,
    });
    expect(varios[0].texto).toContain("2 depósitos");
    expect(varios[0].texto).toContain("R$150");
  });

  it("avisa cartão fechando em até 2 dias (hoje/amanhã), ignora os distantes", () => {
    const r = montarResumoDia({
      cartoes: [
        { nome: "Itaú", fechamento: 21 },   // hoje
        { nome: "XP", fechamento: 22 },     // amanhã
        { nome: "ML", fechamento: 29 },     // longe
      ],
      hoje: HOJE,
    });
    expect(r.some(a => a.texto.includes("Itaú fecha HOJE"))).toBe(true);
    expect(r.some(a => a.texto.includes("XP fecha amanhã"))).toBe(true);
    expect(r.some(a => a.texto.includes("ML"))).toBe(false);
  });

  it("orçamento ≥90% avisa; estourado fica vermelho; e limita a 4 avisos", () => {
    const r = montarResumoDia({
      orcamentos: [{ nome: "Lazer", pct: 112 }, { nome: "Mercado", pct: 91 }],
      alertasHoje: ["HGRE11", "PETR4"],
      hoje: HOJE,
    });
    const orc = r.find(a => a.icone === "📊");
    expect(orc.texto).toContain("ESTOUROU");
    expect(orc.cor).toBe("red");
    expect(r.find(a => a.icone === "🔔").texto).toContain("HGRE11");
    expect(r.length).toBeLessThanOrEqual(4);
  });

  it("dia tranquilo: nenhum aviso", () => {
    expect(montarResumoDia({ hoje: HOJE })).toEqual([]);
  });
});
