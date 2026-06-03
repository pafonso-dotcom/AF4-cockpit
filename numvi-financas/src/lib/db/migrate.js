/**
 * lib/db/migrate.js · migração one-shot do localStorage pra novas tabelas Supabase.
 *
 * Estratégia: ESPELHAMENTO GRADUAL (não cutover total).
 * - Roda dry-run primeiro pra reportar o que vai ser feito
 * - Upsert idempotente (pode rodar várias vezes sem duplicar)
 * - Não pára se uma linha falha — agrega erros e retorna no fim
 * - Resolve FKs por NOME usando mapeamentos construídos durante a migração
 *
 * Cobertura V1: contas + categorias (com self-ref).
 * Próximas iterações cobrem o restante das 25 entidades.
 *
 * Uso:
 *   import { migrarTudo } from "@/lib/db/migrate.js";
 *   const dados = await loadAll();
 *   const resultado = await migrarTudo(dados, { dryRun: true });
 *   console.log(resultado);
 */
import { supabase } from "../supabase.js";
import { getSession } from "../supabase.js";

/* ============================================================
   API PRINCIPAL
   ============================================================ */

/**
 * Executa migração das entidades suportadas.
 *
 * @param {Object} dados - snapshot do localStorage (loadAll() result)
 * @param {Object} opts
 * @param {boolean} opts.dryRun - se true, só simula (não escreve no banco)
 * @param {Function} opts.onProgress - cb({tabela, total, atual, status, msg})
 * @param {string[]} opts.somenteTabelas - se setado, migra só essas tabelas
 *
 * @returns {Promise<{ok: boolean, resultados, mapeamentos, erros}>}
 */
export async function migrarTudo(dados, opts = {}) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const session = await getSession();
  if (!session?.user) throw new Error("Login obrigatório pra migrar.");

  const userId = session.user.id;
  const { dryRun = true, onProgress = noop, somenteTabelas = null } = opts;

  const ctx = {
    userId,
    dryRun,
    onProgress,
    erros: [],
    mapeamentos: criarMapeamentosVazios(),
    snapshot: dados,  // dispo pra migradores especiais (compromissos lê devedores+dividas)
  };

  const resultados = {};

  // Ordem de migração: respeita dependências (sem FK) → (com FK)
  const ordemMigracao = [
    // Sem dependências
    { tabela: "contas",       fn: migrarContas },
    { tabela: "categorias",   fn: migrarCategorias },  // self-ref
    { tabela: "cartoes",      fn: migrarCartoes },
    { tabela: "ativos",       fn: migrarAtivos },
    { tabela: "metas",        fn: migrarMetas },
    { tabela: "agenda",       fn: migrarAgenda },
    { tabela: "tarefas",      fn: migrarTarefas },
    { tabela: "compras",      fn: migrarCompras },
    { tabela: "ideias",       fn: migrarIdeias },

    // Com FK
    { tabela: "fixas",         fn: migrarFixas },           // → categorias, contas
    { tabela: "parcelamentos", fn: migrarParcelamentos },   // → cartoes, categorias
    { tabela: "compromissos",  fn: migrarCompromissos },    // → categorias, contas (consolida devedores+dividas)
    { tabela: "transacoes",    fn: migrarTransacoes },      // → contas, categorias, ativos, cartoes, parcelamentos, fixas

    // Próximas iterações (V3): fixa_ocorrencias, objetivos_carteira, carteiras_modelo,
    // proventos_recebidos, provento_movimentos, trade_*, habitos+check_ins, diario,
    // perfis, user_preferences, api_keys
  ];

  for (const step of ordemMigracao) {
    if (somenteTabelas && !somenteTabelas.includes(step.tabela)) continue;
    onProgress({ tabela: step.tabela, status: "iniciando", msg: `Iniciando ${step.tabela}…` });
    try {
      resultados[step.tabela] = await step.fn(dados[step.tabela] || [], ctx);
    } catch (e) {
      ctx.erros.push({ tabela: step.tabela, item: "(geral)", erro: e.message });
      resultados[step.tabela] = { total: 0, ok: 0, erro: 0, abortado: true, msg: e.message };
    }
  }

  return {
    ok: ctx.erros.length === 0,
    dryRun,
    resultados,
    mapeamentos: serializeMapeamentos(ctx.mapeamentos),
    erros: ctx.erros,
  };
}

/* ============================================================
   MIGRADORES POR ENTIDADE
   ============================================================ */

/**
 * Migra contas.
 * Upsert por (user_id, nome). Mapeamento construído: nome → uuid.
 */
async function migrarContas(contas, ctx) {
  const { userId, dryRun, onProgress, erros, mapeamentos } = ctx;
  const total = (contas || []).length;
  let ok = 0;
  let pulados = 0;

  if (total === 0) {
    onProgress({ tabela: "contas", total: 0, atual: 0, status: "vazio", msg: "Sem contas pra migrar." });
    return { total: 0, ok: 0, erro: 0, pulados: 0 };
  }

  for (let i = 0; i < total; i++) {
    const c = contas[i];
    onProgress({ tabela: "contas", total, atual: i + 1, status: "processando", msg: c.nome });

    if (!c.nome?.trim()) {
      erros.push({ tabela: "contas", item: `(linha ${i})`, erro: "Nome vazio" });
      pulados++;
      continue;
    }

    const row = {
      user_id: userId,
      nome: c.nome.trim(),
      instituicao: c.instituicao || null,
      tipo: normalizarConta(c.tipo),
      escopo: normalizarEscopo(c.escopo),
      saldo: numero(c.saldo, 0),
      saldo_inicial: c.saldoInicial != null ? numero(c.saldoInicial, null) : null,
      cor: c.cor || null,
      ordem: c.ordem ?? null,
    };

    if (dryRun) {
      mapeamentos.contas.set(c.nome.trim(), `dryrun-${c.id || i}`);
      ok++;
      continue;
    }

    try {
      const { data, error } = await supabase
        .from("contas")
        .upsert(row, { onConflict: "user_id,nome" })
        .select("id, nome")
        .single();
      if (error) throw error;
      mapeamentos.contas.set(data.nome, data.id);
      ok++;
    } catch (e) {
      erros.push({ tabela: "contas", item: c.nome, erro: e.message });
    }
  }

  return { total, ok, erro: total - ok - pulados, pulados };
}

/**
 * Migra categorias (suporta self-ref).
 * 2 passadas: primeiro raízes (parent_id NULL), depois filhos.
 * Resolve parent_id por NOME do pai (pode vir como `parentName`, `parent`, ou `parentId` → busca nome via lookup).
 */
async function migrarCategorias(categorias, ctx) {
  const { userId, dryRun, onProgress, erros, mapeamentos } = ctx;
  const total = (categorias || []).length;

  if (total === 0) {
    onProgress({ tabela: "categorias", total: 0, atual: 0, status: "vazio", msg: "Sem categorias pra migrar." });
    return { total: 0, ok: 0, erro: 0, pulados: 0 };
  }

  // Separa raízes de filhas
  const isFilho = (c) => !!c.parentId || !!c.parentName || !!c.parent;
  const raizes = (categorias || []).filter(c => !isFilho(c));
  const filhos = (categorias || []).filter(isFilho);

  let ok = 0;
  let pulados = 0;
  let atual = 0;

  // PASSADA 1: raízes
  for (const c of raizes) {
    atual++;
    onProgress({ tabela: "categorias", total, atual, status: "raízes", msg: c.nome });

    if (!c.nome?.trim() || !c.tipo) {
      erros.push({ tabela: "categorias", item: `(linha)`, erro: "Nome ou tipo faltando" });
      pulados++;
      continue;
    }

    const row = {
      user_id: userId,
      nome: c.nome.trim(),
      tipo: c.tipo,
      cor: c.cor || null,
      limite: c.limite != null ? numero(c.limite, null) : null,
      escopo: normalizarEscopo(c.escopo),
      parent_id: null,
    };

    if (dryRun) {
      mapeamentos.categorias.set(c.nome.trim(), `dryrun-cat-${c.id || atual}`);
      ok++;
      continue;
    }

    try {
      const { data, error } = await supabase
        .from("categorias")
        .upsert(row, { onConflict: "user_id,nome,parent_id" })
        .select("id, nome")
        .single();
      if (error) throw error;
      mapeamentos.categorias.set(data.nome, data.id);
      ok++;
    } catch (e) {
      erros.push({ tabela: "categorias", item: c.nome, erro: e.message });
    }
  }

  // PASSADA 2: filhos (com lookup do parent_id)
  // Como o nome do pai pode estar em diferentes campos, normaliza:
  const lookupNomePaiNoSnapshot = (c) => {
    if (c.parentName) return c.parentName;
    if (c.parent) return c.parent;
    if (c.parentId) {
      const pai = categorias.find(x => x.id === c.parentId);
      return pai?.nome;
    }
    return null;
  };

  for (const c of filhos) {
    atual++;
    onProgress({ tabela: "categorias", total, atual, status: "filhos", msg: c.nome });

    if (!c.nome?.trim() || !c.tipo) {
      erros.push({ tabela: "categorias", item: `(linha)`, erro: "Nome ou tipo faltando" });
      pulados++;
      continue;
    }

    const nomePai = lookupNomePaiNoSnapshot(c);
    const parentUuid = nomePai ? mapeamentos.categorias.get(nomePai) : null;

    if (nomePai && !parentUuid) {
      erros.push({
        tabela: "categorias",
        item: c.nome,
        erro: `Pai "${nomePai}" não foi migrado ou não existe nas raízes`,
      });
      pulados++;
      continue;
    }

    const row = {
      user_id: userId,
      nome: c.nome.trim(),
      tipo: c.tipo,
      cor: c.cor || null,
      limite: c.limite != null ? numero(c.limite, null) : null,
      escopo: normalizarEscopo(c.escopo),
      parent_id: dryRun ? null : parentUuid,
    };

    if (dryRun) {
      mapeamentos.categorias.set(c.nome.trim(), `dryrun-cat-f-${c.id || atual}`);
      ok++;
      continue;
    }

    try {
      const { data, error } = await supabase
        .from("categorias")
        .upsert(row, { onConflict: "user_id,nome,parent_id" })
        .select("id, nome")
        .single();
      if (error) throw error;
      mapeamentos.categorias.set(data.nome, data.id);
      ok++;
    } catch (e) {
      erros.push({ tabela: "categorias", item: c.nome, erro: e.message });
    }
  }

  return { total, ok, erro: total - ok - pulados, pulados };
}

/* ============================================================
   CARTOES, ATIVOS — standalone (sem FK pra resolver)
   ============================================================ */

async function migrarCartoes(cartoes, ctx) {
  return await migrarLote("cartoes", cartoes, ctx, {
    chaveMapa: "cartoes",
    chaveBusca: "id",                // mapeia ID legado → UUID novo (não usa nome porque pode duplicar)
    onConflict: "user_id,nome",
    montar: (c) => ({
      user_id: ctx.userId,
      nome: c.nome,
      banco: c.banco || "outro",
      bandeira_custom: c.bandeiraCustom || null,
      limite: numero(c.limite, 0),
      vencimento: clamp(c.vencimento ?? 5, 1, 31),
      fechamento: clamp(c.fechamento ?? 28, 1, 31),
      tipo: c.tipo || "principal",
      ativo: c.ativo !== false,
      tags: Array.isArray(c.tags) ? c.tags : [],
    }),
    valido: (c) => !!c.nome?.trim(),
    rotuloErro: (c) => c.nome || "(sem nome)",
  });
}

async function migrarAtivos(ativos, ctx) {
  return await migrarLote("ativos", ativos, ctx, {
    chaveMapa: "ativos",
    chaveBusca: "ticker",
    onConflict: "user_id,ticker",
    montar: (a) => ({
      user_id: ctx.userId,
      ticker: (a.ticker || "").toUpperCase(),
      nome: a.nome || null,
      tipo: a.tipo || "outro",
      segmento: a.segmento || null,
      qtd: numero(a.qtd, 0),
      pm: numero(a.pm, 0),
      preco: numero(a.preco, 0),
      base: a.base != null ? numero(a.base, null) : null,
      variacao_24h: numero(a.variacao24h, 0),
      ultima_atualizacao: a.ultimaAtt || null,
      realtime: !!a.realtime,
      fonte_cotacao: a.fonteCotacao || null,
    }),
    valido: (a) => !!a.ticker?.trim(),
    rotuloErro: (a) => a.ticker || "(sem ticker)",
  });
}

/* ============================================================
   METAS, AGENDA, TAREFAS, COMPRAS, IDEIAS — standalone
   ============================================================ */

async function migrarMetas(metas, ctx) {
  return await migrarLote("metas", metas, ctx, {
    onConflict: "id",
    montar: (m) => ({
      id: m.id || undefined,
      user_id: ctx.userId,
      nome: m.nome,
      alvo: numero(m.alvo, 0),
      atual: numero(m.atual, 0),
      prazo_meses: parseInt(m.prazo, 10) || 12,
      aporte_mensal: numero(m.aporte, 0),
      taxa_mensal: numero(m.taxa, 0.85),
      concluida: !!m.concluida,
      concluida_em: m.concluidaEm || null,
    }),
    valido: (m) => !!m.nome?.trim(),
    rotuloErro: (m) => m.nome,
  });
}

async function migrarAgenda(eventos, ctx) {
  return await migrarLote("agenda", eventos, ctx, {
    onConflict: "id",
    montar: (e) => ({
      id: e.id || undefined,
      user_id: ctx.userId,
      titulo: e.titulo || "(sem título)",
      descricao: e.descricao || null,
      data: e.data,
      horario: e.horario || null,
      duracao_minutos: e.duracao != null ? parseInt(e.duracao, 10) : null,
      categoria: ["compromisso", "viagem", "lembrete", "pessoal", "evento"].includes(e.categoria)
        ? e.categoria : "compromisso",
      local: e.local || null,
      link: e.link || null,
      status: ["agendado", "feito", "cancelado"].includes(e.status) ? e.status : "agendado",
      pinned: !!e.pinned,
    }),
    valido: (e) => !!e.titulo && !!e.data,
    rotuloErro: (e) => e.titulo || "(sem título)",
  });
}

async function migrarTarefas(tarefas, ctx) {
  return await migrarLote("tarefas", tarefas, ctx, {
    onConflict: "id",
    montar: (t) => ({
      id: t.id || undefined,
      user_id: ctx.userId,
      titulo: t.titulo,
      descricao: t.descricao || null,
      prioridade: ["alta", "media", "baixa"].includes(t.prioridade) ? t.prioridade : "media",
      projeto: t.projeto || null,
      prazo: t.prazo || null,
      concluida: !!t.concluida,
      concluida_em: t.concluidaEm || null,
    }),
    valido: (t) => !!t.titulo?.trim(),
    rotuloErro: (t) => t.titulo,
  });
}

async function migrarCompras(compras, ctx) {
  return await migrarLote("compras", compras, ctx, {
    onConflict: "id",
    montar: (c) => ({
      id: c.id || undefined,
      user_id: ctx.userId,
      nome: c.nome,
      categoria: ["mercado", "farmacia", "casa", "tech", "outros"].includes(c.categoria)
        ? c.categoria : "mercado",
      preco: c.preco != null ? numero(c.preco, null) : null,
      qtd: parseInt(c.qtd, 10) || 1,
      checked: !!c.checked,
    }),
    valido: (c) => !!c.nome?.trim(),
    rotuloErro: (c) => c.nome,
  });
}

async function migrarIdeias(ideias, ctx) {
  return await migrarLote("ideias", ideias, ctx, {
    onConflict: "id",
    montar: (i) => ({
      id: i.id || undefined,
      user_id: ctx.userId,
      texto: i.texto,
      pinned: !!i.pinned,
    }),
    valido: (i) => !!i.texto?.trim(),
    rotuloErro: (i) => (i.texto || "").slice(0, 30),
  });
}

/* ============================================================
   FIXAS, PARCELAMENTOS — com FK pra categorias / contas / cartoes
   ============================================================ */

async function migrarFixas(fixas, ctx) {
  return await migrarLote("fixas", fixas, ctx, {
    chaveMapa: "fixas",
    chaveBusca: "id",
    onConflict: "id",
    montar: (f) => ({
      id: f.id || undefined,
      user_id: ctx.userId,
      descricao: f.descricao || "(sem descrição)",
      valor: numero(f.valor, 0),
      categoria_id: lookupUuidPorNome(ctx.mapeamentos.categorias, f.categoria),
      conta_padrao_id: lookupUuidPorNome(ctx.mapeamentos.contas, f.contaPadrao),
      dia_vencimento: clamp(f.diaVencimento ?? 1, 1, 31),
      inicio_em: f.inicioEm || null,
      termino_em: f.terminoEm || null,
      ativa: f.ativa !== false,
    }),
    valido: (f) => !!f.descricao?.trim(),
    rotuloErro: (f) => f.descricao,
  });
}

async function migrarParcelamentos(parcelamentos, ctx) {
  return await migrarLote("parcelamentos", parcelamentos, ctx, {
    onConflict: "id",
    montar: (p) => {
      // Em snapshot legado o cartão pode estar como cartaoId (já uuid) ou cartaoNome
      let cartaoUuid = null;
      if (p.cartaoId) {
        // cartaoId no snapshot é o uuid LEGADO; mapa busca pelo ID legado
        // Mas migrarCartoes mapeou por ID — fallback pra nome se não achar
        cartaoUuid = ctx.mapeamentos.cartoes.get(p.cartaoId);
      }
      if (!cartaoUuid && p.cartaoNome) {
        // Se mapeamento por nome falhar, busca scanning os mapeamentos
        // (já que cartoes foi indexado por ID, não nome — vamos buscar manualmente)
        // Pra simplificar V2, deixamos null se não conseguir mapear
      }
      return {
        id: p.id || undefined,
        user_id: ctx.userId,
        cartao_id: cartaoUuid,
        categoria_id: lookupUuidPorNome(ctx.mapeamentos.categorias, p.categoria),
        descricao: p.descricao,
        valor_total: numero(p.valorTotal, 0),
        total_parcelas: parseInt(p.totalParcelas, 10) || 1,
        data_compra: p.dataCompra || new Date().toISOString().slice(0, 10),
        data_primeira_parcela: p.dataPrimeira || null,
        parcelas_pagas: Array.isArray(p.parcelasPagas) ? p.parcelasPagas : [],
      };
    },
    valido: (p) => !!p.descricao?.trim() && p.totalParcelas > 0,
    rotuloErro: (p) => p.descricao,
  });
}

/* ============================================================
   COMPROMISSOS — consolida devedores + dividas
   ============================================================ */

async function migrarCompromissos(_naoUsado, ctx) {
  // Esta função é especial: lê DOIS arrays do snapshot (devedores e dividas)
  // e funde num só. ctx.snapshotOriginal pra acesso, ou via dados passados.
  // Como não temos acesso direto, precisamos receber os arrays do orquestrador.
  // Workaround: usa ctx.snapshot que injetamos abaixo.
  const devedores = (ctx.snapshot?.devedores || []).map(d => ({ ...d, _tipo: "receber" }));
  const dividas = (ctx.snapshot?.dividas || []).map(d => ({ ...d, _tipo: "pagar" }));
  const todos = [...devedores, ...dividas];

  if (todos.length === 0) {
    ctx.onProgress({ tabela: "compromissos", total: 0, atual: 0, status: "vazio", msg: "Sem devedores/dividas." });
    return { total: 0, ok: 0, erro: 0, pulados: 0 };
  }

  return await migrarLote("compromissos", todos, ctx, {
    onConflict: "id",
    montar: (c) => ({
      id: c.id || undefined,
      user_id: ctx.userId,
      tipo: c._tipo,
      nome: c.nome || "(sem nome)",
      credor: c.credor || null,
      telefone: c.telefone || null,
      descricao: c.descricao || c.obs || null,
      combinado: c.combinado || null,
      valor: numero(c.valor, 0),
      vencimento: c.vencimento || null,
      categoria_id: lookupUuidPorNome(ctx.mapeamentos.categorias, c.categoria),
      status: (c.recebido || c.pago) ? "baixado" : "aberto",
      data_baixa: c.dataRecebimento || c.dataPagamento || null,
      conta_baixa_id: lookupUuidPorNome(ctx.mapeamentos.contas, c.contaRecebimento || c.contaPagamento),
      grupo_parcelamento_id: c.grupoParcelamento || null,
      parcela_numero: parseParcela(c.parcela)?.atual ?? null,
      parcela_total: parseParcela(c.parcela)?.total ?? null,
    }),
    valido: (c) => !!c.nome,
    rotuloErro: (c) => `${c._tipo}:${c.nome}`,
  });
}

/* ============================================================
   TRANSACOES — resolve várias FKs
   ============================================================ */

async function migrarTransacoes(transacoes, ctx) {
  return await migrarLote("transacoes", transacoes, ctx, {
    onConflict: "id",
    montar: (t) => ({
      id: t.id || undefined,
      user_id: ctx.userId,
      tipo: t.tipo === "receita" ? "receita" : "despesa",
      descricao: t.descricao || "(sem descrição)",
      valor: Math.abs(numero(t.valor, 0)),
      data: t.data,
      vencimento: t.vencimento || null,
      conta_id: lookupUuidPorNome(ctx.mapeamentos.contas, t.conta),
      categoria_id: lookupUuidPorNome(ctx.mapeamentos.categorias, t.categoria),
      ativo_id: null,         // V3: resolver por ticker presente na descrição
      cartao_id: null,        // V3: idem
      parcelamento_id: null,  // V3
      fixa_id: null,          // V3
      compensado: t.compensado !== false,
      fixa: !!t.fixa,
      obs: t.obs || null,
    }),
    valido: (t) => !!t.descricao && t.data && t.valor != null,
    rotuloErro: (t) => `${t.data} ${t.descricao}`,
  });
}

/* ============================================================
   HELPERS
   ============================================================ */

function criarMapeamentosVazios() {
  return {
    contas: new Map(),
    categorias: new Map(),
    cartoes: new Map(),
    ativos: new Map(),
    fixas: new Map(),
    parcelamentos: new Map(),
  };
}

function serializeMapeamentos(maps) {
  const out = {};
  for (const [k, m] of Object.entries(maps)) {
    out[k] = Object.fromEntries(m);
  }
  return out;
}

function numero(v, fallback = 0) {
  if (v == null || v === "") return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? fallback : n;
}

const TIPOS_CONTA_VALIDOS = ["corrente", "poupanca", "investimento", "cripto", "carteira", "credito"];
function normalizarConta(tipo) {
  const t = (tipo || "").toLowerCase().trim();
  return TIPOS_CONTA_VALIDOS.includes(t) ? t : "corrente";
}

const ESCOPOS_VALIDOS = ["pessoal", "negocio", "tudo"];
function normalizarEscopo(esc) {
  const e = (esc || "").toLowerCase().trim();
  return ESCOPOS_VALIDOS.includes(e) ? e : "pessoal";
}

function noop() {}

function clamp(n, min, max) {
  const v = parseInt(n, 10);
  if (isNaN(v)) return min;
  return Math.max(min, Math.min(max, v));
}

/** Parse "1/3" → {atual: 1, total: 3}. Null se formato inválido. */
function parseParcela(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return null;
  return { atual: parseInt(m[1], 10), total: parseInt(m[2], 10) };
}

/** Busca uuid via mapeamento de nome → uuid. Retorna null se não encontrado/vazio. */
function lookupUuidPorNome(mapa, nome) {
  if (!nome || !mapa) return null;
  return mapa.get(String(nome).trim()) || null;
}

/**
 * Migrador genérico de lote.
 * Encapsula o loop padrão: progress, validação, dry-run, upsert, mapeamento, erro.
 *
 * @param {string} tabela - nome da tabela
 * @param {Array} items - array de items do snapshot
 * @param {Object} ctx - contexto (userId, dryRun, onProgress, erros, mapeamentos, snapshot)
 * @param {Object} opts
 * @param {string} opts.onConflict - chave de upsert (ex.: "user_id,nome")
 * @param {string} [opts.chaveMapa] - se setado, salva no mapeamento (ex.: "contas")
 * @param {string} [opts.chaveBusca] - nome OU id (chave do snapshot pra usar no mapa, default "nome")
 * @param {function} opts.montar - (item) => row pro banco
 * @param {function} opts.valido - (item) => bool — pula se false
 * @param {function} [opts.rotuloErro] - (item) => label pra reportar em erro
 *
 * @returns {Promise<{total, ok, erro, pulados}>}
 */
async function migrarLote(tabela, items, ctx, opts) {
  const { dryRun, onProgress, erros, mapeamentos } = ctx;
  const { onConflict, montar, valido, chaveMapa, chaveBusca = "nome", rotuloErro = (x) => x?.id || "(?)" } = opts;
  const total = (items || []).length;
  let ok = 0;
  let pulados = 0;

  if (total === 0) {
    onProgress({ tabela, total: 0, atual: 0, status: "vazio", msg: `Sem ${tabela} pra migrar.` });
    return { total: 0, ok: 0, erro: 0, pulados: 0 };
  }

  for (let i = 0; i < total; i++) {
    const item = items[i];
    onProgress({ tabela, total, atual: i + 1, status: "processando", msg: String(rotuloErro(item)).slice(0, 50) });

    if (!valido(item)) {
      erros.push({ tabela, item: rotuloErro(item), erro: "Validação falhou" });
      pulados++;
      continue;
    }

    const row = montar(item);

    if (dryRun) {
      if (chaveMapa) {
        const k = item[chaveBusca] || rotuloErro(item);
        mapeamentos[chaveMapa].set(String(k).trim(), `dryrun-${tabela}-${i}`);
      }
      ok++;
      continue;
    }

    try {
      const { data, error } = await supabase
        .from(tabela)
        .upsert(row, { onConflict })
        .select(`id${chaveBusca ? `, ${chaveBusca}` : ""}`)
        .single();
      if (error) throw error;
      if (chaveMapa && data) {
        const k = data[chaveBusca] ?? row[chaveBusca];
        if (k != null) mapeamentos[chaveMapa].set(String(k).trim(), data.id);
      }
      ok++;
    } catch (e) {
      erros.push({ tabela, item: rotuloErro(item), erro: e.message });
    }
  }

  return { total, ok, erro: total - ok - pulados, pulados };
}
