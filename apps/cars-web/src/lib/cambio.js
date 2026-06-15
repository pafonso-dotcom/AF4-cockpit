// Câmbio das contas do exterior.
// Cada conta do exterior guarda uma `cotacao` (R$ por 1 unidade da moeda),
// que o usuário define e pode atualizar ao vivo. A conversão pra BRL é
// determinística (saldo × cotacao), então funciona offline e é testável.
import { getCurrencies } from "./brapi.js";

// Saldo da conta em BRL. Real: saldo direto. Exterior: saldo × cotacao.
export function saldoContaBRL(c) {
  if (!c) return 0;
  const saldo = Number(c.saldo) || 0;
  if (!c.moeda || c.moeda === "BRL") return saldo;
  return saldo * (Number(c.cotacao) || 0);
}

// Soma de várias contas convertidas pra BRL.
export function somaContasBRL(contas = []) {
  return (contas || []).reduce((s, c) => s + saldoContaBRL(c), 0);
}

// Conta do exterior sem cotação definida (precisa de atenção pra entrar no total).
export function semCotacao(c) {
  return c && c.moeda && c.moeda !== "BRL" && !(Number(c.cotacao) > 0);
}

// Busca a cotação ao vivo (R$ por 1 unidade da moeda). null se indisponível.
export async function buscarCotacao(moeda) {
  if (!moeda || moeda === "BRL") return 1;
  try {
    const pares = await getCurrencies([`${moeda}-BRL`]);
    const m = (pares || []).find(c => c.from === moeda && c.to === "BRL");
    return m && m.price > 0 ? Number(m.price) : null;
  } catch {
    return null;
  }
}
