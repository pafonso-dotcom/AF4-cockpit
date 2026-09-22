import { describe, it, expect } from "vitest";
import { montarBomDia, montarContextoJarbas, saudacaoHora } from "../jarbas.js";
import { limparParaFala, pcmParaWav } from "../tts.js";

const fmt = (v) => `R$ ${Number(v).toFixed(2)}`;

describe("jarbas — bom-dia local", () => {
  it("monta a fala com nome, data, saldo e avisos", () => {
    const t = montarBomDia({
      userName: "Paulo", totalContas: 5000,
      resumoDia: [{ icone: "💸", texto: "Vence hoje: BOA BOLA R$ 2.544", cor: "red" }],
      fmt, data: new Date(2026, 8, 22, 8, 0),
    });
    expect(t).toContain("Bom dia, Paulo");
    expect(t).toContain("terça-feira");
    expect(t).toContain("R$ 5000.00");
    expect(t).toContain("Vence hoje: BOA BOLA");
    expect(t).toContain("é só perguntar");
  });

  it("modo oculto (totalContas null) não fala o saldo; sem avisos vira dia tranquilo", () => {
    const t = montarBomDia({ userName: "Paulo", totalContas: null, resumoDia: [], fmt, data: new Date(2026, 8, 22, 20, 0) });
    expect(t).toContain("Boa noite, Paulo");
    expect(t).not.toContain("saldo");
    expect(t).toContain("Dia tranquilo");
  });

  it("saudação segue a hora", () => {
    expect(saudacaoHora(7)).toBe("Bom dia");
    expect(saudacaoHora(14)).toBe("Boa tarde");
    expect(saudacaoHora(21)).toBe("Boa noite");
  });
});

describe("jarbas — contexto completo", () => {
  it("inclui contas por nome, cartões com fatura pendente e agenda de hoje", () => {
    const hojeISO = new Date().toISOString().slice(0, 10);
    const ctx = montarContextoJarbas({
      contas: [{ nome: "Itaú", saldo: 1200 }, { nome: "Nubank", saldo: 300 }],
      cartoes: [{ nome: "Itaú Click", limite: 8000, diaFechamento: 28 }],
      transacoes: [
        { tipo: "despesa", valor: 250, cartao: "Itaú Click", compensado: false, data: hojeISO, categoria: "Mercado" },
      ],
      tarefas: [{ titulo: "Pagar IPVA", prazo: hojeISO, concluida: false }],
    });
    expect(ctx).toContain("Itaú: R$ 1200.00");
    expect(ctx).toContain("Nubank: R$ 300.00");
    expect(ctx).toContain("Itaú Click");
    expect(ctx).toContain("fatura pendente R$ 250.00");
    expect(ctx).toContain("fecha dia 28");
    expect(ctx).toContain('tarefa "Pagar IPVA"');
  });
});

describe("tts — utilitários puros", () => {
  it("limparParaFala tira emoji e markdown", () => {
    expect(limparParaFala("**Saldo**: R$ 100 💰 [ver](http://x)")).toBe("Saldo : R$ 100 ver");
  });

  it("pcmParaWav gera blob WAV com header de 44 bytes", () => {
    const base64 = btoa(String.fromCharCode(...new Uint8Array([0, 0, 255, 127])));
    const blob = pcmParaWav(base64, 24000);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + 4);
  });
});
