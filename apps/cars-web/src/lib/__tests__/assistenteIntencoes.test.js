import { describe, it, expect } from "vitest";
import { detectarIntencao, responder, valorFalado, acharPorNome } from "../assistenteIntencoes.js";
import { partesPatrimonio, totalPatrimonio, COMP_PADRAO } from "../patrimonio.js";
import { faturaEmAberto } from "../cartaoFatura.js";

const cartoes = [
  { id: "c1", nome: "XP Visa Infinite", vencimento: 15 },
  { id: "c2", nome: "Itaú Click", vencimento: 4 },
  { id: "c3", nome: "Mercado Livre", vencimento: 10 },
];
const contas = [
  { id: "k1", nome: "AF4-BANCO", saldo: 1500.5, previsto: 900 },
  { id: "k2", nome: "Itaú Personnalité", saldo: 320 },
  { id: "k3", nome: "XP Investe", saldo: 10000 },
];
const faturas = { c1: { valor: 8000.33, mes: "2026-10" }, c2: { valor: 0, mes: "2026-10", paga: true }, c3: { valor: 450, mes: "2026-10" } };
const ctx = {
  cartoes, contas,
  faturaDe: (c) => faturas[c.id],
  possoGastar: { porDia: 119.38, semana: 835.63, sobraMes: 3700.65, fura: false },
  aPagar: { total: 25000, pagarMes: 6000, prox7: { total: 1200, count: 2, top: [
    { desc: "Luz", valor: 700, venc: "2026-10-03" }, { desc: "Água", valor: 500, venc: "2026-10-05" }] } },
  patrimonio: -20839.15,
};

describe("assistente · intenções", () => {
  it("cartão pelo nome (frase falada)", () => {
    const r = responder("qual o valor do cartão XP?", ctx);
    expect(r.intencao.tipo).toBe("cartao");
    expect(r.texto).toBe("A fatura do XP Visa Infinite de outubro está em R$ 8.000,33, vence dia 15.");
    expect(r.fala).toContain("8.000 reais e 33 centavos");
  });
  it("sigla falada 'xis pê' e nome com acento/sem acento", () => {
    expect(detectarIntencao("fatura do xis pê", ctx).alvo.id).toBe("c1");
    expect(detectarIntencao("quanto ta a fatura do mercado livre", ctx).alvo.id).toBe("c3");
  });
  it("mesmo nome em conta e cartão: palavra-chave decide", () => {
    expect(detectarIntencao("saldo da conta itau", ctx)).toMatchObject({ tipo: "conta", alvo: { id: "k2" } });
    expect(detectarIntencao("fatura do itau", ctx)).toMatchObject({ tipo: "cartao", alvo: { id: "c2" } });
    expect(detectarIntencao("saldo da xp", ctx)).toMatchObject({ tipo: "conta", alvo: { id: "k3" } });
  });
  it("fatura paga e conta com prévia da planilha", () => {
    expect(responder("cartão itaú", ctx).texto).toMatch(/já está paga/);
    const r = responder("saldo do af4 banco", ctx);
    expect(r.texto).toBe("O saldo da AF4-BANCO é R$ 1.500,50. Com a planilha, a previsão é R$ 900,00.");
  });
  it("tolera erro de 1 letra no reconhecimento", () => {
    expect(acharPorNome("saldo do personalite", contas)?.id).toBe("k2");
  });
  it("posso gastar, a pagar, vencimentos, patrimônio", () => {
    expect(responder("quanto posso gastar hoje", ctx).texto).toBe("Hoje você pode gastar R$ 119,38 (R$ 835,63 na semana).");
    expect(responder("quanto tenho a pagar esse mês", ctx).texto).toMatch(/^A pagar neste mês: R\$ 6\.000,00/);
    expect(responder("quanto eu devo", ctx).intencao.tipo).toBe("aPagar");
    expect(responder("o que vence essa semana", ctx).texto).toMatch(/vencem 2 contas: R\$ 1\.200,00\. Luz R\$ 700,00 \(3\/10\)/);
    const p = responder("qual meu patrimônio", ctx);
    expect(p.texto).toBe("Seu patrimônio total é -R$ 20.839,15.");
    expect(p.fala).toBe("Seu patrimônio total é menos 20.839 reais e 15 centavos.");
  });
  it("caixa furando avisa o dia", () => {
    const r = responder("posso gastar hoje?", { ...ctx, possoGastar: { fura: true, sobraMes: -50, primeiroNegativo: "2026-10-12" } });
    expect(r.texto).toMatch(/fura dia 12\/10/);
    expect(r.fala).toMatch(/dia 12 de outubro/);
  });
  it("cartões em geral e frase desconhecida", () => {
    expect(responder("quanto estão as faturas dos cartões", ctx).texto).toMatch(/^Faturas em aberto: R\$ 8\.450,33 em 2 cartões/);
    expect(responder("me conta uma piada", ctx).ok).toBe(false);
    expect(responder("", ctx).ok).toBe(false);
  });
  it("valorFalado", () => {
    expect(valorFalado(1)).toBe("1 real");
    expect(valorFalado(0.5)).toBe("50 centavos");
    expect(valorFalado(1234.01)).toBe("1.234 reais e 1 centavo");
  });
});

describe("patrimônio · fonte única", () => {
  it("soma partes e respeita composição", () => {
    const partes = partesPatrimonio({
      contas: [{ saldo: 1000 }, { saldo: 500, foraPatrimonio: true }, { saldo: 10, moeda: "USD", cotacao: 5 }],
      ativos: [{ tipo: "acao", qtd: 10, preco: 20 }, { tipo: "stock", qtd: 1, preco: 999 }],
      carteiraProventos: { saldo: 30 },
      devedores: [{ valor: 100, valorRecebido: 40 }, { valor: 50, recebido: true }],
      cheques: [{ status: "aguardando", valor: 70 }, { status: "compensado", valor: 1 }],
      aPagarTotal: 300,
    });
    expect(totalPatrimonio(partes, COMP_PADRAO)).toBe(1050 + 30 + 200 + 60 + 70 - 300);
    expect(totalPatrimonio(partes, { ...COMP_PADRAO, apagar: false })).toBe(1410);
  });
});

describe("fatura em aberto · fonte única", () => {
  it("importada aberta manda; senão parcelas+avulsas do mês", () => {
    const c = { id: "x", nome: "XP", fechamento: 5, faturaImportada: { valorTotal: 800, competencia: "2026-11", paga: false } };
    expect(faturaEmAberto(c, [], [], "2026-10")).toEqual({ valor: 800, mes: "2026-11", paga: false });
    const c2 = { id: "y", nome: "Y", fechamento: 5 };
    const tx = [{ cartaoId: "y", tipo: "despesa", valor: 50, data: "2026-10-02" }];
    const parc = [{ cartaoId: "y", totalParcelas: 3, valorParcela: 100, dataPrimeira: "2026-10-10", parcelasPagas: [] }];
    expect(faturaEmAberto(c2, parc, tx, "2026-10").valor).toBe(150);
    const c3 = { id: "z", faturaImportada: { valorTotal: 900, competencia: "2026-10", paga: true } };
    expect(faturaEmAberto(c3, [], [], "2026-10")).toEqual({ valor: 0, mes: "2026-10", paga: true });
  });
});

describe("assistente · navegação por voz", () => {
  it("abre telas por apelido", () => {
    expect(responder("abre os cartões", ctx).nav.destino.tab).toBe("cartoes");
    expect(responder("vai pra tela de voos", ctx).nav.destino.tab).toBe("voos");
    expect(responder("me leva para as viagens", ctx).nav.destino.tab).toBe("voos");
    expect(responder("abre as contas fixas", ctx).nav.destino.tab).toBe("fixas");
    expect(responder("abrir configurações", ctx).nav.destino).toMatchObject({ modulo: "config", tab: "cfg-aparencia" });
    expect(responder("abre o painel", ctx).texto).toBe("Abrindo Painel.");
  });
  it("abre conta ou cartão pelo nome", () => {
    expect(responder("abre a conta af4 banco", ctx).nav.conta.id).toBe("k1");
    expect(responder("abre o cartão itaú", ctx).nav.cartao.id).toBe("c2");
    expect(responder("abre a conta itaú", ctx).nav.conta.id).toBe("k2");
    expect(responder("vai no mercado livre", ctx).nav.cartao.id).toBe("c3");
  });
  it("sem verbo de abrir continua sendo consulta", () => {
    expect(responder("fatura do itaú", ctx).intencao.tipo).toBe("cartao");
    expect(responder("abre uma janela pro céu", ctx).ok).toBe(false);
  });
});
