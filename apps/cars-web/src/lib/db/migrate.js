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
  };

  const resultados = {};

  // Ordem de migração: respeita dependências (sem FK) → (com FK)
  const ordemMigracao = [
    { tabela: "contas",     fn: migrarContas },
    { tabela: "categorias", fn: migrarCategorias },
    // próximos PRs:
    // { tabela: "cartoes",       fn: migrarCartoes },
    // { tabela: "ativos",        fn: migrarAtivos },
    // { tabela: "fixas",         fn: migrarFixas },
    // { tabela: "transacoes",    fn: migrarTransacoes },
    // ...
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
