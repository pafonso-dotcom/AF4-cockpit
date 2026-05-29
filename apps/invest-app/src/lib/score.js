// Engine de scoring (0-100) baseado em RSI + MACD + Volume + Tendência.

export function calcularScore({ rsi, macd, volumeChange, trend }) {
  let score = 0;
  const breakdown = {};

  if (rsi !== null && rsi !== undefined) {
    if (rsi >= 40 && rsi <= 65) { score += 20; breakdown.rsi = "neutro saudável"; }
    else if (rsi > 65 && rsi <= 75) { score += 14; breakdown.rsi = "forte (atenção sobrecompra)"; }
    else if (rsi >= 25 && rsi < 40) { score += 12; breakdown.rsi = "fraco mas recuperando"; }
    else if (rsi > 75) { score += 4; breakdown.rsi = "sobrecomprado"; }
    else if (rsi < 25) { score += 4; breakdown.rsi = "sobrevendido"; }
  }

  if (macd) {
    if (macd.macd > 0 && macd.histogram > 0) { score += 20; breakdown.macd = "alta confirmada"; }
    else if (macd.macd > 0) { score += 12; breakdown.macd = "alta enfraquecendo"; }
    else if (macd.histogram > 0) { score += 10; breakdown.macd = "reversão para alta"; }
    else { score += 3; breakdown.macd = "baixa"; }
  }

  if (volumeChange !== null && volumeChange !== undefined) {
    if (volumeChange > 30) { score += 25; breakdown.volume = `+${volumeChange.toFixed(0)}% (forte)`; }
    else if (volumeChange > 10) { score += 18; breakdown.volume = `+${volumeChange.toFixed(0)}% (acima)`; }
    else if (volumeChange > -10) { score += 10; breakdown.volume = `${volumeChange.toFixed(0)}% (médio)`; }
    else { score += 3; breakdown.volume = `${volumeChange.toFixed(0)}% (fraco)`; }
  }

  if (trend === "alta") { score += 25; breakdown.trend = "alta"; }
  else if (trend === "neutro") { score += 12; breakdown.trend = "lateral"; }
  else { score += 4; breakdown.trend = "baixa"; }

  return { score: Math.round(score), breakdown };
}

export function direcaoSinal({ rsi, macd, trend }) {
  const votos = [];
  if (rsi != null) votos.push(rsi > 50 ? "long" : rsi < 50 ? "short" : "neutro");
  if (macd) votos.push(macd.macd > 0 ? "long" : "short");
  votos.push(trend === "alta" ? "long" : trend === "baixa" ? "short" : "neutro");
  const c = { long: 0, short: 0, neutro: 0 };
  votos.forEach(v => c[v]++);
  if (c.long > c.short && c.long >= c.neutro) return "long";
  if (c.short > c.long && c.short >= c.neutro) return "short";
  return "neutro";
}

export function confiancaSinal(score) {
  if (score >= 70) return "alta";
  if (score >= 50) return "moderada";
  return "baixa";
}
