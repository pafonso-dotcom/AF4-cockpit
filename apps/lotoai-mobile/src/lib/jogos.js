/* ============================================================
   REGISTRY DE JOGOS · Lotofácil + Mega-Sena
   ─────────────────────────────────────────────────────────────
   Constantes específicas por jogo: tamanho do volante, dezenas
   por aposta, faixas de prêmio, preço, conjuntos especiais
   (primos, fibonacci, moldura), endpoint da API, etc.

   Mantém funções utilitárias agnósticas que recebem o `game`
   como parâmetro.
   ============================================================ */

const PRIMOS_25 = [2, 3, 5, 7, 11, 13, 17, 19, 23];
const PRIMOS_60 = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59];
const FIB_25 = [1, 2, 3, 5, 8, 13, 21];
const FIB_60 = [1, 2, 3, 5, 8, 13, 21, 34, 55];

export const JOGOS = {
  lotofacil: {
    id: "lotofacil",
    nome: "Lotofácil",
    nomeCurto: "Lotofácil",
    cor: "#7c5cff",
    accent: "from-accent to-indigo-700",
    totalNumeros: 25,
    numerosPorJogo: 15,
    apostaMin: 15,
    apostaMax: 20,
    faixasDePremio: [11, 12, 13, 14, 15],
    premiavel: 11,
    precoAposta: 3.5,
    primos: PRIMOS_25,
    fibonacci: FIB_25,
    moldura: [1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 24, 25],
    apiPath: "lotofacil",
    historicoPath: "concursos.json",
    coveringsPath: "coverings.json",
    premioMedio: { 11: 6, 12: 12, 13: 30, 14: 2000, 15: 1500000 },
    diasSorteio: "seg, ter, qua, qui, sex, sáb",
    faixasTipicas: {
      pares:   { min: 6, max: 9 },
      soma:    { min: 170, max: 220 },
      primos:  { min: 4, max: 7 },
      moldura: { min: 8, max: 11 },
    },
  },
  megasena: {
    id: "megasena",
    nome: "Mega-Sena",
    nomeCurto: "Mega-Sena",
    cor: "#22c55e",
    accent: "from-green-500 to-emerald-700",
    totalNumeros: 60,
    numerosPorJogo: 6,
    apostaMin: 6,
    apostaMax: 20,
    faixasDePremio: [4, 5, 6],
    premiavel: 4,
    precoAposta: 5.0,
    primos: PRIMOS_60,
    fibonacci: FIB_60,
    moldura: null, // não aplica
    apiPath: "megasena",
    historicoPath: "megasena.json",
    coveringsPath: "coverings-mega.json",
    premioMedio: { 4: 950, 5: 53000, 6: 50000000 },
    diasSorteio: "qua, sáb",
    faixasTipicas: {
      pares:  { min: 2, max: 4 },
      soma:   { min: 130, max: 220 },
      primos: { min: 1, max: 3 },
    },
  },
};

export const JOGOS_LISTA = Object.values(JOGOS);

export function jogoOuPadrao(id) {
  return JOGOS[id] || JOGOS.lotofacil;
}

/* ============================================================
   FUNÇÕES UTILITÁRIAS · todas recebem `game` como parâmetro
   ============================================================ */

export function numerosDoJogo(game) {
  return Array.from({ length: game.totalNumeros }, (_, i) => i + 1);
}

export function combinacoes(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** Custo (R$) de uma aposta com `k` números */
export function custoAposta(k, game) {
  if (k < game.apostaMin || k > game.apostaMax) return 0;
  const combos = combinacoes(k, game.numerosPorJogo);
  return +(combos * game.precoAposta).toFixed(2);
}

/** Conta acertos entre uma aposta e o sorteio */
export function contarAcertos(aposta, sorteio) {
  const set = new Set(sorteio);
  let n = 0;
  for (const x of aposta) if (set.has(x)) n++;
  return n;
}

/** Valida que um jogo está bem formado */
export function validarJogo(jogo, game) {
  if (!Array.isArray(jogo) || jogo.length !== game.numerosPorJogo) return false;
  const set = new Set(jogo);
  if (set.size !== jogo.length) return false;
  return jogo.every(n => Number.isInteger(n) && n >= 1 && n <= game.totalNumeros);
}

/** Resumo estatístico de um jogo */
export function analisarJogo(jogo, game) {
  const pares = jogo.filter(n => n % 2 === 0).length;
  const primosSet = new Set(game.primos);
  const fibSet = new Set(game.fibonacci);
  const molduraSet = game.moldura ? new Set(game.moldura) : null;

  const primos = jogo.filter(n => primosSet.has(n)).length;
  const fib = jogo.filter(n => fibSet.has(n)).length;
  const moldura = molduraSet ? jogo.filter(n => molduraSet.has(n)).length : 0;
  const miolo = molduraSet ? game.numerosPorJogo - moldura : 0;
  const soma = jogo.reduce((a, b) => a + b, 0);

  return {
    pares,
    impares: game.numerosPorJogo - pares,
    primos,
    fib,
    moldura,
    miolo,
    soma,
  };
}

/** Verifica se um jogo cai dentro das faixas típicas do jogo ativo */
export function dentroDasFaixas(jogo, game, faixas) {
  const f = faixas || game.faixasTipicas;
  if (!f) return true;
  const a = analisarJogo(jogo, game);
  if (f.pares   && (a.pares   < f.pares.min   || a.pares   > f.pares.max))   return false;
  if (f.soma    && (a.soma    < f.soma.min    || a.soma    > f.soma.max))    return false;
  if (f.primos  && (a.primos  < f.primos.min  || a.primos  > f.primos.max))  return false;
  if (f.moldura && (a.moldura < f.moldura.min || a.moldura > f.moldura.max)) return false;
  return true;
}

/** Parser permissivo de jogo digitado pelo usuário */
export function parseJogo(input, game) {
  const erros = [];
  const tokens = String(input).split(/[^\d]+/).filter(Boolean);
  if (!tokens.length) return { ok: false, jogo: [], erros: ["digite as dezenas"] };

  const nums = tokens.map(t => Number(t));
  if (nums.some(n => !Number.isInteger(n) || n < 1 || n > game.totalNumeros)) {
    erros.push(`dezenas devem ser inteiros entre 1 e ${game.totalNumeros}`);
  }
  const set = new Set(nums);
  if (set.size !== nums.length) erros.push("há dezenas repetidas");
  if (nums.length !== game.numerosPorJogo) {
    erros.push(`esperava ${game.numerosPorJogo} dezenas, recebeu ${nums.length}`);
  }
  if (erros.length) return { ok: false, jogo: [], erros };

  return { ok: true, jogo: [...set].sort((a, b) => a - b), erros: [] };
}

/** Confere um jogo contra um sorteio */
export function conferir(jogo, sorteio, game) {
  const setS = new Set(sorteio);
  const acertadas = jogo.filter(n => setS.has(n));
  const erradas = jogo.filter(n => !setS.has(n));
  return {
    pontos: acertadas.length,
    acertadas: acertadas.sort((a, b) => a - b),
    erradas: erradas.sort((a, b) => a - b),
    premiavel: acertadas.length >= game.premiavel,
  };
}
