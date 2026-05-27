/* ============================================================
   LOTOFÁCIL · regras e constantes do jogo
   ============================================================ */

export const LOTOFACIL = {
  totalNumeros: 25,
  numerosPorJogo: 15,
  faixasDePremio: [11, 12, 13, 14, 15],
  precoAposta: 3.5, // R$ por aposta simples (15 números)
};

export const NUMEROS = Array.from({ length: LOTOFACIL.totalNumeros }, (_, i) => i + 1);

export const PRIMOS = [2, 3, 5, 7, 11, 13, 17, 19, 23];
export const FIBONACCI = [1, 2, 3, 5, 8, 13, 21];
export const MOLDURA = [1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 24, 25];
export const MIOLO = NUMEROS.filter(n => !MOLDURA.includes(n));

/** Custo (R$) de uma aposta com `k` números (combinatória) */
export function custoAposta(k) {
  if (k < 15 || k > 20) return 0;
  const combos = combinacoes(k, 15);
  return +(combos * LOTOFACIL.precoAposta).toFixed(2);
}

export function combinacoes(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** Conta acertos entre uma aposta e o sorteio */
export function contarAcertos(aposta, sorteio) {
  const set = new Set(sorteio);
  let n = 0;
  for (const x of aposta) if (set.has(x)) n++;
  return n;
}

/** Valida que um jogo está bem formado (15 números únicos entre 1–25) */
export function validarJogo(jogo) {
  if (!Array.isArray(jogo) || jogo.length !== LOTOFACIL.numerosPorJogo) return false;
  const set = new Set(jogo);
  if (set.size !== jogo.length) return false;
  return jogo.every(n => Number.isInteger(n) && n >= 1 && n <= LOTOFACIL.totalNumeros);
}

/** Resumo estatístico de um jogo (pares, primos, soma, moldura) */
export function analisarJogo(jogo) {
  const pares = jogo.filter(n => n % 2 === 0).length;
  const primos = jogo.filter(n => PRIMOS.includes(n)).length;
  const fib = jogo.filter(n => FIBONACCI.includes(n)).length;
  const moldura = jogo.filter(n => MOLDURA.includes(n)).length;
  const miolo = jogo.filter(n => MIOLO.includes(n)).length;
  const soma = jogo.reduce((a, b) => a + b, 0);
  return { pares, impares: 15 - pares, primos, fib, moldura, miolo, soma };
}

/**
 * Faixas estatisticamente típicas extraídas da análise de 3197 concursos
 * (ver data/RELATORIO-EXECUTIVO.md). Cobrem ~70-80% dos sorteios reais.
 */
export const FAIXAS_TIPICAS = {
  pares:    { min: 6, max: 9 },   // moda 7 (31%), 7-8 cobre 56%, 6-9 cobre 89%
  soma:     { min: 170, max: 220 },// 70% dos sorteios caem aqui
  primos:   { min: 4, max: 7 },   // 5-6 cobre 60%, 4-7 cobre 91%
  moldura:  { min: 8, max: 11 },  // 9-10 cobre 61%, 8-11 cobre 90%
};

/** Verifica se um jogo cai dentro das faixas estatisticamente típicas */
export function dentroDasFaixas(jogo, faixas = FAIXAS_TIPICAS) {
  const a = analisarJogo(jogo);
  return (
    a.pares    >= faixas.pares.min    && a.pares    <= faixas.pares.max &&
    a.soma     >= faixas.soma.min     && a.soma     <= faixas.soma.max &&
    a.primos   >= faixas.primos.min   && a.primos   <= faixas.primos.max &&
    a.moldura  >= faixas.moldura.min  && a.moldura  <= faixas.moldura.max
  );
}

/**
 * Parse permissivo de jogo digitado pelo usuário. Aceita:
 *   "1 2 3 4 5 ... 15"        (espaços)
 *   "1,2,3,4,5,...,15"        (vírgulas)
 *   "01-02-03-...-15"         (hífens, zeros à esquerda)
 *   "1, 2, 03, 04 5  6\n7..." (qualquer mix)
 * Retorna { ok, jogo, erros }. Não modifica o input.
 */
export function parseJogo(input) {
  const erros = [];
  const tokens = String(input).split(/[^\d]+/).filter(Boolean);
  if (!tokens.length) return { ok: false, jogo: [], erros: ["digite as 15 dezenas"] };

  const nums = tokens.map(t => Number(t));
  if (nums.some(n => !Number.isInteger(n) || n < 1 || n > 25)) {
    erros.push("dezenas devem ser inteiros entre 1 e 25");
  }
  const set = new Set(nums);
  if (set.size !== nums.length) erros.push("há dezenas repetidas");
  if (nums.length !== LOTOFACIL.numerosPorJogo) {
    erros.push(`esperava 15 dezenas, recebeu ${nums.length}`);
  }
  if (erros.length) return { ok: false, jogo: [], erros };

  return { ok: true, jogo: [...set].sort((a, b) => a - b), erros: [] };
}

/**
 * Confere um jogo contra um sorteio: pontos, dezenas acertadas e erradas.
 */
export function conferir(jogo, sorteio) {
  const setS = new Set(sorteio);
  const acertadas = jogo.filter(n => setS.has(n));
  const erradas = jogo.filter(n => !setS.has(n));
  return {
    pontos: acertadas.length,
    acertadas: acertadas.sort((a, b) => a - b),
    erradas: erradas.sort((a, b) => a - b),
    premiavel: acertadas.length >= 11,
  };
}
