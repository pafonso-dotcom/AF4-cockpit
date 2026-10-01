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

describe("assistente · lançamento por voz", () => {
  const hoje = new Date(2026, 9, 1); // 01/10/2026
  const cats = [{ nome: "Mercado", tipo: "despesa" }, { nome: "Combustível", tipo: "despesa" }, { nome: "Salário", tipo: "receita" }];
  const c2 = { ...ctx, categorias: cats, hoje };
  it("despesa no cartão com categoria do cadastro", () => {
    const r = responder("lança 50 reais de mercado no itaú", c2);
    expect(r.lancamento).toMatchObject({ tipo: "despesa", valor: 50, descricao: "Mercado", categoria: "Mercado", data: "2026-10-01" });
    expect(r.lancamento.destino.tipo).toBe("cartao");
    expect(r.lancamento.destino.item.id).toBe("c2");
    expect(r.texto).toBe("Despesa de R$ 50,00 — Mercado no cartão Itaú Click, hoje. Confere e confirma.");
  });
  it("centavos, ontem, conta explícita", () => {
    const r = responder("gastei 32,90 com gasolina na conta itaú ontem", c2);
    expect(r.lancamento).toMatchObject({ valor: 32.9, descricao: "Gasolina", data: "2026-09-30" });
    expect(r.lancamento.destino).toMatchObject({ tipo: "conta", item: { id: "k2" } });
    expect(responder("anota R$ 1.250,00 de aluguel", c2).lancamento.valor).toBe(1250);
    expect(responder("lança 2 mil de reforma", c2).lancamento.valor).toBe(2000);
    expect(responder("paguei 50 reais e 90 centavos de farmácia", c2).lancamento.valor).toBe(50.9);
  });
  it("receita vai pra conta, nunca pro cartão", () => {
    const r = responder("recebi 3000 de salário na af4 banco", c2);
    expect(r.lancamento).toMatchObject({ tipo: "receita", valor: 3000, categoria: "Salário" });
    expect(r.lancamento.destino.item.id).toBe("k1");
  });
  it("sem destino e sem valor", () => {
    expect(responder("lança 80 de padaria", c2).lancamento.destino).toBe(null);
    expect(responder("lança mercado", c2).texto).toMatch(/Não peguei o valor/);
    expect(responder("dia 28 lancei", c2).lancamento).toBeUndefined();
  });
  it("data 'dia N' no futuro vira mês passado", () => {
    expect(responder("lança 10 de café dia 28", c2).lancamento.data).toBe("2026-09-28");
  });
});

describe("patrimônio · dólar convertido", () => {
  it("Stocks/REITs entram convertidos quando há dólar; sem dólar, valem 0", () => {
    const base = { contas: [{ saldo: 1000 }], ativos: [{ tipo: "stock", qtd: 2, preco: 100 }, { tipo: "acao", qtd: 1, preco: 50 }] };
    const com = partesPatrimonio({ ...base, usdRate: 5 });
    expect(com.find(p => p.k === "investUS").valor).toBe(1000);
    expect(totalPatrimonio(com, COMP_PADRAO)).toBe(1000 + 50 + 1000);
    expect(totalPatrimonio(com, { ...COMP_PADRAO, investUS: false })).toBe(1050);
    expect(partesPatrimonio(base).find(p => p.k === "investUS").valor).toBe(0);
  });
});
