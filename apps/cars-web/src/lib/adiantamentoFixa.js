// Helper puro pro ADIANTAMENTO de contas fixas: dado o mês-base ("YYYY-MM"),
// quantos meses adiantar e o dia de vencimento da fixa, devolve os próximos N
// meses (não inclui o base) com seus vencimentos — pra materializar/pagar as
// ocorrências futuras de uma vez.
export function proximosMesesFixa(mesBase, n, diaVenc = 1) {
  const [y, m] = String(mesBase || "").split("-").map(Number);
  if (!y || !m) return [];
  const dia = Math.min(Math.max(parseInt(diaVenc, 10) || 1, 1), 28);
  const qtd = Math.max(0, Math.min(60, Math.floor(Number(n) || 0)));
  const out = [];
  for (let i = 1; i <= qtd; i++) {
    const d = new Date(y, (m - 1) + i, 1);
    const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ mes, dataVencimento: `${mes}-${String(dia).padStart(2, "0")}` });
  }
  return out;
}
