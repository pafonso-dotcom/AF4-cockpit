// Indicadores técnicos clássicos: RSI, EMA, MACD, Volume Change, Trend (cruzamento EMA).

export function calcRSI(closes, period = 14) {
  if (!Array.isArray(closes) || closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

export function calcEMA(values, period) {
  if (!Array.isArray(values) || values.length < period) return null;
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

export function calcMACD(closes) {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  if (ema12 === null || ema26 === null) return null;
  const macd = ema12 - ema26;
  return { macd, histogram: macd };
}

export function calcVolumeChange(volumes) {
  if (!Array.isArray(volumes) || volumes.length < 21) return null;
  const ultimo = volumes[volumes.length - 1];
  const media20 = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
  if (media20 === 0) return 0;
  return ((ultimo - media20) / media20) * 100;
}

export function calcTrend(closes) {
  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, 50);
  if (ema20 == null || ema50 == null) return "neutro";
  const diff = ((ema20 - ema50) / ema50) * 100;
  if (diff > 1.5) return "alta";
  if (diff < -1.5) return "baixa";
  return "neutro";
}
