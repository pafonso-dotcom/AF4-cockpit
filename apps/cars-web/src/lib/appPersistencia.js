// Hidratação do estado a partir dos dados persistidos (e seeds quando não há
// nada salvo). Extraído do App.jsx para isolar a camada de dados — a lista de
// campos persistidos e suas migrações/defaults vivem aqui, num lugar só.
//
// `S` é o objeto de setters do App ({ setContas, setCategorias, ... }). As
// funções abaixo são uma relocação literal do que estava no App, então o
// comportamento é idêntico.
import {
  seedContas, seedCategorias, seedTransacoes, seedAtivos, seedMetas,
  seedCartoes, seedParcelamentos, seedDevedores, seedDividas,
} from "./seeds.js";
import { THEMES } from "./theme.js";
import { migrarEscoposAuto } from "./escopo.js";
import { migrarNegocioLojas } from "./negocioLojas.js";

// Aplica os dados carregados (com defaults/migrações) nos setters do App.
export function aplicarDadosCarregados(data, S) {
  S.setContas(data.contas || seedContas);
  S.setCategorias((data.categorias || seedCategorias).map(c => ({ ...c, limite: c.limite ?? null })));
  S.setTransacoes((data.transacoes || seedTransacoes).map(t => ({
    ...t,
    compensado: t.compensado ?? true,
    obs: t.obs ?? "",
    fixa: t.fixa ?? false,
    vencimento: t.vencimento ?? null,
  })));
  S.setAtivos(data.ativos || seedAtivos);
  S.setMetas(data.metas || seedMetas);
  S.setNotas(data.notas || []);
  S.setCartoes(data.cartoes || seedCartoes);
  // Migrate parcelamentos: convert cartaoNome → cartaoId
  const cartoesData = data.cartoes || seedCartoes;
  S.setParcelamentos((data.parcelamentos || seedParcelamentos).map(p => {
    if (!p.cartaoId && p.cartaoNome) {
      const c = cartoesData.find(x => x.nome === p.cartaoNome);
      if (c) return { ...p, cartaoId: c.id };
    }
    return p;
  }));
  S.setDevedores(data.devedores || seedDevedores);
  S.setDividas(data.dividas || seedDividas);
  S.setCheques(data.cheques || []);
  // Migração silenciosa: se backup antigo não tem essas chaves, vira []
  S.setFixas(data.fixas || []);
  S.setFixaOcorrencias(data.fixaOcorrencias || []);
  S.setAgenda(data.agenda || []);
  S.setHabitos(data.habitos || []);
  S.setDiario(data.diario || []);
  S.setCompras(data.compras || []);
  S.setIdeias(data.ideias || []);
  S.setTarefas(data.tarefas || []);
  S.setSugestoes(data.sugestoes || []);
  S.setLembretes(data.lembretes || []);
  S.setConversaHistorico(data.conversaHistorico || []);
  S.setExerciciosDB(prev => {
    if (data.exerciciosDB && data.exerciciosDB.length > 0) return data.exerciciosDB;
    return prev;
  });
  S.setTreinoTemplates(data.treinoTemplates || []);
  S.setTreinos(data.treinos || []);
  S.setPatrimonioHistorico(data.patrimonioHistorico || []);
  S.setNegocioVeiculos(data.negocioVeiculos || []);
  S.setNegocioVendasVeiculos(data.negocioVendasVeiculos || []);
  S.setNegocioServicos(data.negocioServicos || []);
  S.setNegocioVendasServicos(data.negocioVendasServicos || []);
  S.setNegocioContratos(data.negocioContratos || []);
  S.setNegocioClientes(data.negocioClientes || []);
  S.setNegocioInstaladores(data.negocioInstaladores || []);
  S.setObjetivosCarteira(data.objetivosCarteira || []);
  S.setCarteirasModeloCustom(data.carteirasModeloCustom || []);
  if (data.modeloAtivoId) S.setModeloAtivoId(data.modeloAtivoId);
  S.setCarteiraProventos(data.carteiraProventos || { saldo: 0, historico: [] });
  S.setCaixaNegocio(data.caixaNegocio || { saldo: 0, historico: [] });
  S.setNegocioBancos(data.negocioBancos || []);
  // Financeiro por loja: migra (cria "Loja 1" e atribui lojaId aos itens sem).
  const _nl = migrarNegocioLojas(data);
  S.setNegocioLojas(_nl.negocioLojas);
  S.setNegocioLojaAtiva(_nl.negocioLojaAtiva);
  S.setNegocioFinContas(_nl.negocioFinContas);
  S.setNegocioFinCategorias(data.negocioFinCategorias || []);
  S.setNegocioFinDespesasFixas(_nl.negocioFinDespesasFixas);
  S.setNegocioFinDespesasVar(_nl.negocioFinDespesasVar);
  S.setNegocioRecebimentos(_nl.negocioRecebimentos);
  S.setProventosRecebidos(data.proventosRecebidos || {});
  S.setProventosIgnorados(data.proventosIgnorados || {});
  S.setProventosManuais(data.proventosManuais || []);
  S.setTradeWatchlist(data.tradeWatchlist || []);
  S.setTradeHistorico(data.tradeHistorico || []);
  S.setTradeAnalisesIdV(data.tradeAnalisesIdV || []);
  S.setTradeOnboardingVisto(!!data.tradeOnboardingVisto);
  if (data.themeId && THEMES[data.themeId]) S.setThemeId(data.themeId);
  // Migração one-shot: marca contas/categorias antigas com escopo detectado
  setTimeout(() => {
    migrarEscoposAuto(
      { contas: data.contas, categorias: data.categorias },
      { setContas: S.setContas, setCategorias: S.setCategorias }
    );
  }, 100);
}

// Primeiro uso (sem nada salvo): popula com seeds.
export function aplicarSeeds(S) {
  S.setContas(seedContas);
  S.setCategorias(seedCategorias);
  S.setTransacoes(seedTransacoes);
  S.setAtivos(seedAtivos);
  S.setMetas(seedMetas);
  S.setCartoes(seedCartoes);
  S.setParcelamentos(seedParcelamentos.map(p => {
    if (!p.cartaoId && p.cartaoNome) {
      const c = seedCartoes.find(x => x.nome === p.cartaoNome);
      if (c) return { ...p, cartaoId: c.id };
    }
    return p;
  }));
  S.setDevedores(seedDevedores);
  S.setDividas(seedDividas);
  S.setCheques([]);
  S.setFixas([]);
  S.setFixaOcorrencias([]);
  S.setAgenda([]);
  S.setHabitos([]);
  S.setDiario([]);
  S.setCompras([]);
  S.setIdeias([]);
  S.setTarefas([]);
  S.setSugestoes([]);
  S.setPatrimonioHistorico([]);
  S.setNegocioVeiculos([]);
  S.setNegocioVendasVeiculos([]);
  S.setNegocioServicos([]);
  S.setNegocioVendasServicos([]);
  S.setNegocioContratos([]);
  S.setNegocioClientes([]);
  S.setNegocioInstaladores([]);
  S.setObjetivosCarteira([]);
  S.setCarteirasModeloCustom([]);
  S.setCarteiraProventos({ saldo: 0, historico: [] });
  S.setCaixaNegocio({ saldo: 0, historico: [] });
  S.setNegocioBancos([]);
  S.setNegocioFinContas([]);
  S.setNegocioFinCategorias([]);
  S.setNegocioFinDespesasFixas([]);
  S.setNegocioFinDespesasVar([]);
  const _seedLojas = migrarNegocioLojas({});
  S.setNegocioLojas(_seedLojas.negocioLojas);
  S.setNegocioLojaAtiva(_seedLojas.negocioLojaAtiva);
  S.setNegocioRecebimentos([]);
  S.setProventosRecebidos({});
  S.setProventosIgnorados({});
  S.setProventosManuais([]);
  S.setTradeWatchlist([]);
  S.setTradeHistorico([]);
  S.setTradeAnalisesIdV([]);
  S.setTradeOnboardingVisto(false);
}
