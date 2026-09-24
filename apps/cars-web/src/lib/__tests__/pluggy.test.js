import { describe, it, expect, beforeEach } from "vitest";
import { prepararImportPluggy, detectarDuplicatasCartao, pareceParcela } from "../pluggy.js";
import { handlePluggy, _resetAuthPluggy } from "../../../../../worker/pluggy.js";

/* ===================== lib (pura) ===================== */

describe("prepararImportPluggy — conversão + dedup idempotente", () => {
  const tx = (pluggyId, data, valor, tipo = "despesa", descricao = "PIX") =>
    ({ pluggyId, data, valor, tipo, descricao });

  it("converte pro shape do app com origem/pluggyId e conta vinculada", () => {
    const { novas } = prepararImportPluggy([tx("p1", "2026-09-20", 150)], [], "ITAU-paulo");
    expect(novas.length).toBe(1);
    expect(novas[0]).toMatchObject({
      descricao: "PIX", tipo: "despesa", conta: "ITAU-paulo", data: "2026-09-20",
      valor: 150, compensado: true, origem: "pluggy", pluggyId: "p1",
    });
    expect(novas[0]._duplicada).toBe(false);
  });

  it("idempotência: quem já existe por pluggyId é PULADO (2ª sync importa 0)", () => {
    const existentes = [{ id: "x", pluggyId: "p1", data: "2026-09-20", valor: 150, tipo: "despesa", conta: "ITAU" }];
    const { novas, jaImportadas } = prepararImportPluggy([tx("p1", "2026-09-20", 150)], existentes, "ITAU");
    expect(novas).toEqual([]);
    expect(jaImportadas).toBe(1);
  });

  it("lançamento MANUAL igual (data|valor|tipo) marca _duplicada mas não descarta", () => {
    const existentes = [{ id: "m", data: "2026-09-20", valor: 150, tipo: "despesa", conta: "ITAU" }];
    const { novas } = prepararImportPluggy([tx("p9", "2026-09-20", 150)], existentes, "ITAU");
    expect(novas.length).toBe(1);
    expect(novas[0]._duplicada).toBe(true);
  });

  it("cartão: vira compra avulsa (cartaoId, sem conta, pendente) e descarta receitas", () => {
    const cartao = { id: "card1", nome: "Itaú Platinum" };
    const { novas } = prepararImportPluggy([
      tx("c1", "2026-09-20", 89.9, "despesa", "iFood"),
      tx("c2", "2026-09-21", 5000, "receita", "Pagamento fatura"), // pagamento/estorno: fora
    ], [], "", cartao);
    expect(novas.length).toBe(1);
    expect(novas[0]).toMatchObject({
      descricao: "iFood", tipo: "despesa", conta: "", cartaoId: "card1",
      valor: 89.9, compensado: false, origem: "pluggy", pluggyId: "c1",
    });
  });
});

describe("pareceParcela — extrato do cartão × parcelamentos lançados", () => {
  const PARC = { id: "pc1", cartaoId: "c1", descricao: "Magazine Luiza Geladeira", valorParcela: 250, totalParcelas: 10, categoria: "Casa" };

  it("casa pelo padrão N/total + valor da parcela", () => {
    expect(pareceParcela({ cartaoId: "c1", descricao: "MAGALU 03/10", valor: 250 }, [PARC])).toBe(PARC);
  });
  it("casa por descrição similar mesmo sem o N/total", () => {
    expect(pareceParcela({ cartaoId: "c1", descricao: "MAGAZINE LUIZA", valor: 250 }, [PARC])).toBe(PARC);
  });
  it("não casa com valor diferente, cartão diferente ou total divergente", () => {
    expect(pareceParcela({ cartaoId: "c1", descricao: "MAGALU 03/10", valor: 300 }, [PARC])).toBe(null);
    expect(pareceParcela({ cartaoId: "c2", descricao: "MAGALU 03/10", valor: 250 }, [PARC])).toBe(null);
    expect(pareceParcela({ cartaoId: "c1", descricao: "LOJA X 03/12", valor: 250 }, [PARC])).toBe(null);
  });

  it("prepararImportPluggy (cartão) marca a parcela como duplicada com o motivo", () => {
    const { novas } = prepararImportPluggy(
      [{ pluggyId: "p1", data: "2026-09-10", valor: 250, tipo: "despesa", descricao: "MAGALU 03/10" }],
      [], "", { id: "c1", nome: "Itaú" }, [PARC]);
    expect(novas[0]._duplicada).toBe(true);
    expect(novas[0]._dupParcela).toBe("Magazine Luiza Geladeira");
  });

  it("detectarDuplicatasCartao acha parcelas importadas: 1 por mês por parcelamento", () => {
    const tx = (id, data, desc = "MAGALU 04/10") =>
      ({ id, origem: "pluggy", cartaoId: "c1", tipo: "despesa", valor: 250, data, descricao: desc });
    const pares = detectarDuplicatasCartao(
      [tx("s1", "2026-08-10"), tx("s2", "2026-09-10"), tx("s3", "2026-09-12")], 45, [PARC]);
    expect(pares.length).toBe(2); // ago + set (a 3ª do mesmo mês não conta)
    expect(pares[0].manter.descricao).toContain("Parcelamento: Magazine Luiza Geladeira");
  });
});

describe("detectarDuplicatasCartao — pluggy × fatura/manual", () => {
  const t = (id, origem, cartaoId, valor, data, extra = {}) =>
    ({ id, origem, cartaoId, valor, data, tipo: "despesa", descricao: id, ...extra });

  it("casa mesmo valor com datas próximas (fatura usa vencimento) e remove só a cópia da Pluggy", () => {
    const pares = detectarDuplicatasCartao([
      t("plg1", "pluggy", "c1", 89.9, "2026-09-02"),
      t("fat1", "fatura-itau", "c1", 89.9, "2026-09-28"), // mesma compra, data do vencimento
      t("plg2", "pluggy", "c1", 40, "2026-09-05"),        // sem par → fica
      t("man1", "compra-manual", "c2", 89.9, "2026-09-02"), // outro cartão → não casa
      t("pgto", "fatura-pagamento", "c1", 89.9, "2026-09-02"), // pagamento nunca conta
    ]);
    expect(pares.length).toBe(1);
    expect(pares[0].remover.id).toBe("plg1");
    expect(pares[0].manter.id).toBe("fat1");
  });

  it("cada existente pareia com no máximo UMA da Pluggy (a de data mais próxima)", () => {
    const pares = detectarDuplicatasCartao([
      t("plgA", "pluggy", "c1", 50, "2026-09-10"),
      t("plgB", "pluggy", "c1", 50, "2026-09-11"),
      t("fatX", "fatura-itau", "c1", 50, "2026-09-10"),
    ]);
    expect(pares.length).toBe(1);
    expect(pares[0].remover.id).toBe("plgA");
  });

  it("fora da janela de dias não casa", () => {
    const pares = detectarDuplicatasCartao([
      t("plg1", "pluggy", "c1", 30, "2026-01-01"),
      t("fat1", "fatura-itau", "c1", 30, "2026-06-01"),
    ]);
    expect(pares).toEqual([]);
  });
});

/* ===================== worker (fetchImpl fake) ===================== */

const ENV_OK = { PLUGGY_CLIENT_ID: "cid", PLUGGY_CLIENT_SECRET: "cs", PLUGGY_PIN: "1234" };
const req = (caminho, { method = "GET", pin = "1234", body } = {}) =>
  new Request(`https://app.local/api/pluggy/${caminho}`, {
    method,
    headers: pin ? { "x-pluggy-pin": pin, "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
const resposta = (obj, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(obj), { status }));

beforeEach(() => _resetAuthPluggy());

describe("worker /api/pluggy — proteção", () => {
  it("501 sem secrets configurados", async () => {
    const r = await handlePluggy(req("contas?itemId=1"), {}, () => { throw new Error("não deve chamar"); });
    expect(r.status).toBe(501);
  });

  it("401 sem PIN ou com PIN errado", async () => {
    const r1 = await handlePluggy(req("contas?itemId=1", { pin: "" }), ENV_OK, () => {});
    expect(r1.status).toBe(401);
    const r2 = await handlePluggy(req("contas?itemId=1", { pin: "9999" }), ENV_OK, () => {});
    expect(r2.status).toBe(401);
  });
});

describe("worker /api/pluggy — rotas", () => {
  it("contas: autentica, cacheia o apiKey e devolve BANK + CREDIT (com tipoConta)", async () => {
    let auths = 0;
    const fake = (url) => {
      if (url.endsWith("/auth")) { auths++; return resposta({ apiKey: "k" }); }
      if (url.includes("/accounts")) return resposta({ results: [
        { id: "a1", type: "BANK", name: "Conta Corrente", balance: 1234.56, currencyCode: "BRL", institution: { name: "Itaú" } },
        { id: "c1", type: "CREDIT", name: "Cartão Visa", balance: -500 },
        { id: "x1", type: "INVESTMENT", name: "CDB", balance: 10 }, // fora do escopo
      ] });
      throw new Error("url inesperada: " + url);
    };
    const r = await handlePluggy(req("contas?itemId=item1"), ENV_OK, fake);
    const data = await r.json();
    expect(data.ok).toBe(true);
    expect(data.contas).toEqual([
      { id: "a1", nome: "Conta Corrente", banco: "Itaú", numero: "", saldo: 1234.56, moeda: "BRL", tipoConta: "banco" },
      { id: "c1", nome: "Cartão Visa", banco: "", numero: "", saldo: -500, moeda: "BRL", tipoConta: "cartao" },
    ]);
    // 2ª chamada usa o apiKey cacheado (auth só 1x)
    await handlePluggy(req("contas?itemId=item1"), ENV_OK, fake);
    expect(auths).toBe(1);
  });

  it("transacoes: usa /v2 com cursor (next literal) e converte type/sinal em tipo", async () => {
    const urls = [];
    const fake = (url) => {
      urls.push(url);
      if (url.endsWith("/auth")) return resposta({ apiKey: "k" });
      // cursor base64 com caracteres encodados — tem que ser colado como veio
      if (url.includes("after=abc%3D%3D")) return resposta({ results: [
        { id: "rec", date: "2026-09-21T10:00:00Z", description: "Salário", amount: 5000, type: "CREDIT" },
      ], next: null });
      if (url.includes("/v2/transactions")) return resposta({ results: [
        { id: "t0", date: "2026-09-20T10:00:00Z", description: "Mercado", amount: -50, type: "DEBIT" },
        { id: "t1", date: "2026-09-20T11:00:00Z", description: "Pix", amount: 30 }, // sem type → sinal
      ], next: "?accountId=a1&after=abc%3D%3D" });
      throw new Error("url inesperada: " + url);
    };
    const r = await handlePluggy(req("transacoes?accountId=a1&from=2026-09-01"), ENV_OK, fake);
    const data = await r.json();
    expect(data.ok).toBe(true);
    expect(data.truncado).toBe(false);
    expect(data.transacoes.length).toBe(3);
    expect(data.transacoes[0]).toMatchObject({ pluggyId: "t0", data: "2026-09-20", tipo: "despesa", valor: 50 });
    expect(data.transacoes[1]).toMatchObject({ pluggyId: "t1", tipo: "receita", valor: 30 });
    expect(data.transacoes[2]).toMatchObject({ pluggyId: "rec", tipo: "receita", valor: 5000 });
    // 1ª página usa dateFrom (v2), e a 2ª cola o next SEM re-encodar
    expect(urls.some(u => u.includes("/v2/transactions?accountId=a1&dateFrom=2026-09-01"))).toBe(true);
    expect(urls.some(u => u.endsWith("/v2/transactions?accountId=a1&after=abc%3D%3D"))).toBe(true);
  });

  it("conectar: POST cria item no conector 200 e devolve itemId", async () => {
    let corpoEnviado = null;
    const fake = (url, opts) => {
      if (url.endsWith("/auth")) return resposta({ apiKey: "k" });
      if (url.endsWith("/items")) { corpoEnviado = JSON.parse(opts.body); return resposta({ id: "item-novo", status: "UPDATING" }); }
      throw new Error("url inesperada: " + url);
    };
    const r = await handlePluggy(req("conectar", { method: "POST", body: { usuario: "a@b.c", senha: "s" } }), ENV_OK, fake);
    const data = await r.json();
    expect(data).toMatchObject({ ok: true, itemId: "item-novo" });
    expect(corpoEnviado.connectorId).toBe(200);
    expect(corpoEnviado.parameters).toEqual({ user: "a@b.c", password: "s" });
  });
});
