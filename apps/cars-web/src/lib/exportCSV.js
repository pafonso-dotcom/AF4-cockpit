/* ============================================================
   EXPORT CSV · backup completo em CSV, um arquivo por tipo de dado

   Gera um ZIP com uma pasta raiz (af4-backup-AAAA-MM-DD/) e
   subpastas por área (financeiro/, investimentos/, negocio/,
   pessoal/, outros/), cada coleção do estado num .csv próprio:
   contas.csv, transacoes.csv, cartoes.csv, etc.

   O ZIP é escrito à mão no formato STORE (sem compressão) pra não
   adicionar dependência — CSV de dados pessoais é pequeno.
   Cada CSV leva BOM UTF-8 e separador ";" (Excel pt-BR).
   ============================================================ */

/* ---------- CSV ---------- */

// Valor de célula → texto CSV. Números saem com vírgula decimal
// (Excel pt-BR); objetos/arrays aninhados viram JSON numa célula só.
function celula(v) {
  if (v == null) return "";
  if (typeof v === "number") return String(v).replace(".", ",");
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "object") v = JSON.stringify(v);
  v = String(v);
  if (/[";\n\r]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
  return v;
}

// Array de objetos (ou primitivos) → CSV com cabeçalho = união das chaves.
export function linhasParaCSV(rows) {
  if (!Array.isArray(rows) || !rows.length) return "";
  // Coleção de primitivos (ex.: lista de tickers ignorados) → coluna única.
  if (rows.every(r => r == null || typeof r !== "object")) {
    return "valor\r\n" + rows.map(r => celula(r)).join("\r\n") + "\r\n";
  }
  const cols = [];
  for (const r of rows) {
    if (r && typeof r === "object") {
      for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
    }
  }
  const linhas = [cols.map(celula).join(";")];
  for (const r of rows) {
    linhas.push(cols.map(c => celula(r && typeof r === "object" ? r[c] : "")).join(";"));
  }
  return linhas.join("\r\n") + "\r\n";
}

/* ---------- ZIP (método STORE, sem compressão) ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// [{ nome: "pasta/arquivo.csv", conteudo: string|Uint8Array, executavel?: bool }]
// → bytes de um .zip. `executavel` marca permissão 755 (Unix) no arquivo,
// pra scripts .command/.sh saírem rodáveis após extrair no Mac/Linux.
export function criarZip(arquivos) {
  const enc = new TextEncoder();
  const agora = new Date();
  // Data/hora no formato MS-DOS usado pelo ZIP
  const dosTime = (agora.getHours() << 11) | (agora.getMinutes() << 5) | (agora.getSeconds() >> 1);
  const dosDate = ((agora.getFullYear() - 1980) << 9) | ((agora.getMonth() + 1) << 5) | agora.getDate();

  const locais = [];   // local header + dados de cada arquivo
  const centrais = []; // entradas do diretório central
  let offset = 0;

  for (const arq of arquivos) {
    const nome = enc.encode(arq.nome);
    const dados = arq.conteudo instanceof Uint8Array ? arq.conteudo : enc.encode(arq.conteudo);
    const crc = crc32(dados);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // assinatura local file header
    local.setUint16(4, 20, true);         // versão mínima
    local.setUint16(6, 0x0800, true);     // flag: nome em UTF-8
    local.setUint16(8, 0, true);          // método 0 = STORE
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, dados.length, true); // comprimido (= original no STORE)
    local.setUint32(22, dados.length, true); // original
    local.setUint16(26, nome.length, true);
    local.setUint16(28, 0, true);         // extra

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true); // assinatura central directory
    central.setUint16(4, 0x031e, true);     // version made by: Unix (pra permissões)
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, dosTime, true);
    central.setUint16(14, dosDate, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, dados.length, true);
    central.setUint32(24, dados.length, true);
    central.setUint16(28, nome.length, true);
    // permissões Unix nos 16 bits altos: 100755 (executável) ou 100644
    central.setUint32(38, (arq.executavel ? 0o100755 : 0o100644) << 16, true);
    central.setUint32(42, offset, true); // offset do local header

    locais.push(new Uint8Array(local.buffer), nome, dados);
    centrais.push(new Uint8Array(central.buffer), nome);
    offset += 30 + nome.length + dados.length;
  }

  const tamCentral = centrais.reduce((s, b) => s + b.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true); // assinatura end of central directory
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, offset, true);

  const partes = [...locais, ...centrais, new Uint8Array(fim.buffer)];
  const total = partes.reduce((s, b) => s + b.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const b of partes) { out.set(b, pos); pos += b.length; }
  return out;
}

/* ---------- Catálogo: chave do estado → pasta/arquivo ---------- */

const CATALOGO = [
  ["financeiro", [
    ["contas", "contas"],
    ["categorias", "categorias"],
    ["transacoes", "transacoes"],
    ["cartoes", "cartoes"],
    ["parcelamentos", "parcelamentos"],
    ["devedores", "a-receber-devedores"],
    ["dividas", "dividas"],
    ["cheques", "cheques"],
    ["fixas", "despesas-fixas"],
    ["fixaOcorrencias", "despesas-fixas-ocorrencias"],
    ["agenda", "agenda"],
    ["compras", "lista-de-compras"],
  ]],
  ["investimentos", [
    ["ativos", "ativos-carteira"],
    ["objetivosCarteira", "objetivos-carteira"],
    ["carteirasModeloCustom", "carteiras-modelo"],
    ["carteiraProventos", "carteira-proventos"],
    ["proventosRecebidos", "proventos-recebidos"],
    ["proventosManuais", "proventos-manuais"],
    ["proventosIgnorados", "proventos-ignorados"],
    ["tradeWatchlist", "trade-watchlist"],
    ["tradeHistorico", "trade-historico"],
    ["patrimonioHistorico", "patrimonio-historico"],
  ]],
  ["negocio", [
    ["negocioVeiculos", "veiculos"],
    ["negocioVendasVeiculos", "vendas-veiculos"],
    ["negocioServicos", "servicos"],
    ["negocioVendasServicos", "vendas-servicos"],
    ["negocioContratos", "contratos"],
    ["negocioClientes", "clientes"],
    ["negocioInstaladores", "instaladores"],
    ["negocioBancos", "bancos"],
    ["negocioRecebimentos", "recebimentos"],
    ["negocioLojas", "lojas"],
    ["negocioFinContas", "fin-contas"],
    ["negocioFinCategorias", "fin-categorias"],
    ["negocioFinDespesasFixas", "fin-despesas-fixas"],
    ["negocioFinDespesasVar", "fin-despesas-variaveis"],
  ]],
  ["pessoal", [
    ["metas", "metas"],
    ["notas", "notas"],
    ["habitos", "habitos"],
    ["diario", "diario"],
    ["ideias", "ideias"],
    ["tarefas", "tarefas"],
    ["lembretes", "lembretes"],
    ["sugestoes", "sugestoes"],
    ["treinos", "treinos"],
    ["treinoTemplates", "treino-modelos"],
  ]],
];

// Monta a lista de arquivos do ZIP a partir do estado completo do app.
// Só entra coleção que é array com pelo menos 1 item; o que não estiver
// no catálogo cai em outros/<chave>.csv pra nada ficar de fora.
export function montarArquivosCSV(dados, raiz) {
  const arquivos = [];
  const usadas = new Set();
  const BOM = "﻿";

  for (const [pasta, itens] of CATALOGO) {
    for (const [chave, nomeArq] of itens) {
      usadas.add(chave);
      const csv = linhasParaCSV(dados?.[chave]);
      if (csv) arquivos.push({ nome: `${raiz}/${pasta}/${nomeArq}.csv`, conteudo: BOM + csv });
    }
  }
  for (const chave of Object.keys(dados || {})) {
    if (usadas.has(chave) || chave.startsWith("_")) continue;
    const csv = linhasParaCSV(dados[chave]);
    if (csv) arquivos.push({ nome: `${raiz}/outros/${chave}.csv`, conteudo: BOM + csv });
  }

  arquivos.push({
    nome: `${raiz}/leia-me.txt`,
    conteudo:
      `Backup em CSV do Afinanças — gerado em ${new Date().toLocaleString("pt-BR")}\n\n` +
      `Cada pasta agrupa uma área do app e cada arquivo .csv é um tipo de dado\n` +
      `(contas, transações, cartões, etc.). Separador ";" — abre direto no Excel.\n\n` +
      `Atenção: este formato é para consulta/planilha. Para RESTAURAR os dados\n` +
      `no app, use o backup completo em JSON (Configurações → Backup).\n`,
  });
  return arquivos;
}

// Gera e baixa o ZIP com todos os CSVs.
export function exportarBackupCSV(dados) {
  const raiz = `af4-backup-${new Date().toISOString().slice(0, 10)}`;
  const arquivos = montarArquivosCSV(dados, raiz);
  const zip = criarZip(arquivos);
  const blob = new Blob([zip], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${raiz}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  return arquivos.length - 1; // qtd de CSVs (sem contar o leia-me)
}
