// Watchlist padrão de criptos para o AF4 Trade.

export const WATCHLIST_DEFAULT = [
  { symbol: "BTCUSDT",  display: "BTC/USDT",  name: "Bitcoin",   icon: "₿" },
  { symbol: "ETHUSDT",  display: "ETH/USDT",  name: "Ethereum",  icon: "Ξ" },
  { symbol: "SOLUSDT",  display: "SOL/USDT",  name: "Solana",    icon: "◎" },
  { symbol: "BNBUSDT",  display: "BNB/USDT",  name: "BNB",       icon: "B" },
  { symbol: "XRPUSDT",  display: "XRP/USDT",  name: "Ripple",    icon: "X" },
  { symbol: "ADAUSDT",  display: "ADA/USDT",  name: "Cardano",   icon: "A" },
  { symbol: "AVAXUSDT", display: "AVAX/USDT", name: "Avalanche", icon: "A" },
  { symbol: "DOTUSDT",  display: "DOT/USDT",  name: "Polkadot",  icon: "•" },
  { symbol: "MATICUSDT",display: "MATIC/USDT",name: "Polygon",   icon: "M" },
  { symbol: "LINKUSDT", display: "LINK/USDT", name: "Chainlink", icon: "L" },
  { symbol: "DOGEUSDT", display: "DOGE/USDT", name: "Dogecoin",  icon: "D" },
  { symbol: "LTCUSDT",  display: "LTC/USDT",  name: "Litecoin",  icon: "Ł" },
  { symbol: "ATOMUSDT", display: "ATOM/USDT", name: "Cosmos",    icon: "A" },
  { symbol: "NEARUSDT", display: "NEAR/USDT", name: "Near",      icon: "N" },
  { symbol: "ARBUSDT",  display: "ARB/USDT",  name: "Arbitrum",  icon: "A" },
];

export function getWatchlist(tradeWatchlist) {
  return Array.isArray(tradeWatchlist) && tradeWatchlist.length
    ? tradeWatchlist
    : WATCHLIST_DEFAULT;
}
