import { describe, it, expect } from "vitest";
import { linhasParaCSV, criarZip, montarArquivosCSV } from "../exportCSV.js";

describe("linhasParaCSV", () => {
  it("gera cabeçalho com a união das chaves e separador ;", () => {
    const csv = linhasParaCSV([
      { id: 1, nome: "Nubank", saldo: 1234.56 },
      { id: 2, nome: "Itaú", moeda: "USD" },
    ]);
    const linhas = csv.trim().split("\r\n");
    expect(linhas[0]).toBe("id;nome;saldo;moeda");
    expect(linhas[1]).toBe("1;Nubank;1234,56;");
    expect(linhas[2]).toBe("2;Itaú;;USD");
  });

  it("usa vírgula decimal em números e sim/não em booleanos", () => {
    const csv = linhasParaCSV([{ valor: 10.5, pago: true, aberto: false }]);
    expect(csv).toContain("10,5;sim;não");
  });

  it("escapa aspas, ponto-e-vírgula e quebras de linha", () => {
    const csv = linhasParaCSV([{ desc: 'mercado; "extra"\nlinha 2' }]);
    expect(csv.trim().split("\r\n")[0]).toBe("desc");
    expect(csv).toContain('"mercado; ""extra""\nlinha 2"');
  });

  it("serializa objetos/arrays aninhados como JSON numa célula", () => {
    const csv = linhasParaCSV([{ id: 1, tags: ["a", "b"] }]);
    expect(csv).toContain('"[""a"",""b""]"');
  });

  it("coleção de primitivos vira coluna única 'valor'", () => {
    const csv = linhasParaCSV(["PETR4", "VALE3"]);
    expect(csv).toBe("valor\r\nPETR4\r\nVALE3\r\n");
  });

  it("retorna vazio pra array vazio, null ou não-array", () => {
    expect(linhasParaCSV([])).toBe("");
    expect(linhasParaCSV(null)).toBe("");
    expect(linhasParaCSV({ nao: "array" })).toBe("");
  });
});

describe("criarZip", () => {
  it("produz um ZIP válido (assinaturas local, central e fim)", () => {
    const zip = criarZip([
      { nome: "pasta/a.csv", conteudo: "id;nome\r\n1;x\r\n" },
      { nome: "pasta/b.csv", conteudo: "y" },
    ]);
    const sig = (off) => zip[off] | (zip[off + 1] << 8) | (zip[off + 2] << 16) | (zip[off + 3] << 24);
    // Primeiro local file header: PK\x03\x04
    expect(sig(0) >>> 0).toBe(0x04034b50);
    // End of central directory: PK\x05\x06 nos últimos 22 bytes
    expect(sig(zip.length - 22) >>> 0).toBe(0x06054b50);
    // Nº de entradas no diretório central = 2
    expect(zip[zip.length - 22 + 8]).toBe(2);
    // Diretório central presente: PK\x01\x02 em algum lugar
    const bytes = Array.from(zip);
    const temCentral = bytes.some((_, i) =>
      bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x01 && bytes[i + 3] === 0x02);
    expect(temCentral).toBe(true);
  });

  it("marca permissão 755 nos arquivos com executavel: true", () => {
    const zip = criarZip([{ nome: "iniciar.command", conteudo: "#!/bin/bash\n", executavel: true }]);
    // acha a entrada do diretório central e lê os external attrs (offset 38)
    let i = 0;
    while (!(zip[i] === 0x50 && zip[i + 1] === 0x4b && zip[i + 2] === 0x01 && zip[i + 3] === 0x02)) i++;
    const attrs = (zip[i + 38] | (zip[i + 39] << 8) | (zip[i + 40] << 16) | (zip[i + 41] << 24)) >>> 0;
    expect((attrs >>> 16) & 0o777).toBe(0o755);
  });
});

describe("montarArquivosCSV", () => {
  const dados = {
    contas: [{ id: 1, nome: "Nubank" }],
    transacoes: [{ id: 1, desc: "mercado", valor: 50 }],
    cartoes: [],
    ativos: [{ ticker: "PETR4", qtd: 100 }],
    negocioClientes: [{ nome: "Carla" }],
    metas: [{ titulo: "Viagem" }],
    colecaoDesconhecida: [{ x: 1 }],
    _savedAt: 123,
    themeId: "dark",
  };

  it("organiza cada coleção na pasta da sua área", () => {
    const arqs = montarArquivosCSV(dados, "raiz");
    const nomes = arqs.map(a => a.nome);
    expect(nomes).toContain("raiz/financeiro/contas.csv");
    expect(nomes).toContain("raiz/financeiro/transacoes.csv");
    expect(nomes).toContain("raiz/investimentos/ativos-carteira.csv");
    expect(nomes).toContain("raiz/negocio/clientes.csv");
    expect(nomes).toContain("raiz/pessoal/metas.csv");
    expect(nomes).toContain("raiz/leia-me.txt");
  });

  it("coleção fora do catálogo cai em outros/; vazias e escalares ficam de fora", () => {
    const nomes = montarArquivosCSV(dados, "raiz").map(a => a.nome);
    expect(nomes).toContain("raiz/outros/colecaoDesconhecida.csv");
    expect(nomes.some(n => n.includes("cartoes"))).toBe(false);
    expect(nomes.some(n => n.includes("themeId") || n.includes("_savedAt"))).toBe(false);
  });

  it("todo CSV começa com BOM UTF-8", () => {
    const arqs = montarArquivosCSV(dados, "raiz").filter(a => a.nome.endsWith(".csv"));
    expect(arqs.length).toBeGreaterThan(0);
    for (const a of arqs) expect(a.conteudo.startsWith("﻿")).toBe(true);
  });
});
