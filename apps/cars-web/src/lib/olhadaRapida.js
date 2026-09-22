/**
 * Modo "olhada rápida" — item 5 do estudo mobile (2026-09-22).
 *
 * Tela cheia que aparece na PRIMEIRA abertura do dia no celular:
 * saudação, saldo em contas e o Resumo do dia em formato grande.
 * Desliza pra cima (ou toca no botão) e entra no app normal.
 *
 * Aqui fica só a lógica pura (testável); o visual vive no Dashboard.
 */

// localStorage: guarda o ISO do último dia em que a olhada foi vista.
export const OLHADA_KEY = "af4:olhada-vista:v1";

// ISO local (não UTC — perto da meia-noite o dia do usuário é o que vale).
export function hojeISOLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Mostra só uma vez por dia: se o valor salvo já é o hoje, não mostra.
export function deveMostrarOlhada(ultimaVista, hojeISO) {
  return ultimaVista !== hojeISO;
}

const DIAS_SEMANA = [
  "domingo", "segunda-feira", "terça-feira", "quarta-feira",
  "quinta-feira", "sexta-feira", "sábado",
];
const MESES_EXT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// "segunda-feira · 22 de setembro"
export function dataPorExtenso(d = new Date()) {
  return `${DIAS_SEMANA[d.getDay()]} · ${d.getDate()} de ${MESES_EXT[d.getMonth()]}`;
}
