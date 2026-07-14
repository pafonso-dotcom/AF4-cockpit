// Tempo desde a data de criação/compra de um ativo, em PT-BR.
// Ex.: "há 1 ano e 3 meses", "há 5 meses", "há 12 dias", "hoje".
// refISO opcional (data de referência) só pra teste — em produção usa hoje.

const soData = (v) => new Date(`${String(v || "").slice(0, 10)}T00:00:00`);

export function tempoDeCarteira(criadoEmISO, refISO) {
  if (!criadoEmISO) return "";
  const ini = soData(criadoEmISO);
  const ref = refISO ? soData(refISO) : new Date();
  if (isNaN(ini.getTime()) || isNaN(ref.getTime())) return "";

  let meses = (ref.getFullYear() - ini.getFullYear()) * 12 + (ref.getMonth() - ini.getMonth());
  if (ref.getDate() < ini.getDate()) meses -= 1;
  if (meses < 0) return ""; // data futura → não mostra

  if (meses === 0) {
    const dias = Math.floor((ref.getTime() - ini.getTime()) / 86400000);
    if (dias <= 0) return "hoje";
    return `há ${dias} ${dias === 1 ? "dia" : "dias"}`;
  }

  const anos = Math.floor(meses / 12);
  const m = meses % 12;
  const partes = [];
  if (anos > 0) partes.push(`${anos} ${anos === 1 ? "ano" : "anos"}`);
  if (m > 0) partes.push(`${m} ${m === 1 ? "mês" : "meses"}`);
  return `há ${partes.join(" e ")}`;
}
