// Formata número como preço em reais: 89900 -> "R$ 89.900"
export function fmtPreco(valor) {
  const n = Number(valor) || 0;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

// Formata quilometragem: 38000 -> "38.000 km"
export function fmtKm(km) {
  if (km == null || km === "") return null;
  const n = Number(km);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return "0 km";
  return `${n.toLocaleString("pt-BR")} km`;
}
