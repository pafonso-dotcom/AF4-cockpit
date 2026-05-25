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
