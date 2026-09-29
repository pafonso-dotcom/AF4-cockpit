/**
 * 💸 "Posso gastar hoje?" (Safe-to-Spend, 2026-09-29) — o número único
 * dos apps de 2026: quanto dá pra gastar HOJE sem furar o mês.
 *
 * Conta: projeta o caixa até o FIM DO MÊS só com o que está AGENDADO
 * (fixas, parcelas, dívidas, a receber — SEM a estimativa de variáveis,
 * porque o dia a dia é justamente o que este número vai guiar). A sobra
 * projetada dividida pelos dias que faltam é o "posso gastar por dia".
 * Puro e testável.
 */
import { montarFluxoCaixa } from "./fluxoCaixa.js";

/**
 * @returns {{
 *  porDia: number, semana: number, sobraMes: number, diasRestantes: number,
 *  fura: boolean, primeiroNegativo: string|null, saldoInicial: number
 * }} porDia/semana ficam 0 quando a sobra é negativa (fura = true).
 */
export function calcularPossoGastar(state = {}, escopo = "tudo", hoje = new Date()) {
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const diasRestantes = Math.max(1, fimMes.getDate() - hoje.getDate() + 1); // inclui hoje
  const f = montarFluxoCaixa(state, escopo, diasRestantes - 1, hoje, { estimarVariaveis: false });
  const sobraMes = f.saldoFinal;
  // Se o caixa fura ANTES do fim do mês, gastar zero já é otimista —
  // o número vira 0 e o card avisa o dia do buraco.
  const fura = sobraMes <= 0 || !!f.primeiroNegativo;
  const porDia = fura ? 0 : sobraMes / diasRestantes;
  return {
    porDia,
    semana: fura ? 0 : porDia * Math.min(7, diasRestantes),
    sobraMes,
    diasRestantes,
    fura,
    primeiroNegativo: f.primeiroNegativo,
    saldoInicial: f.saldoInicial,
  };
}
