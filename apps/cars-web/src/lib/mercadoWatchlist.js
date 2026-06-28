// Watchlist de mercado (ações/FIIs) — papéis acompanhados.
// Liga o Pesquisador de mercado → Construtor de mercado.
// Persistido localmente. Cada item: { symbol, name, peso }.
//   - symbol: ticker (ex.: "PETR4")
//   - name: nome amigável (preenchido na pesquisa)
//   - peso: peso-alvo % na carteira (0 até definir no Construtor)

const KEY = "af4:mercado-watchlist:v1";

const normSym = (s = "") => String(s).trim().toUpperCase();

export function carregarWatchlist() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => x && x.symbol) : [];
  } catch {
    return [];
  }
}

export function salvarWatchlist(lista) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lista || []));
  } catch {
    /* localStorage cheio/indisponível: silencioso */
  }
}

export function adicionarPapel(lista, { symbol, name = "" }) {
  const sym = normSym(symbol);
  if (!sym) return lista;
  if (lista.some((x) => normSym(x.symbol) === sym)) return lista; // já existe
  return [...lista, { symbol: sym, name, peso: 0 }];
}

export function removerPapel(lista, symbol) {
  const sym = normSym(symbol);
  return lista.filter((x) => normSym(x.symbol) !== sym);
}

export function definirPeso(lista, symbol, peso) {
  const sym = normSym(symbol);
  const p = Math.max(0, Number(peso) || 0);
  return lista.map((x) => (normSym(x.symbol) === sym ? { ...x, peso: p } : x));
}

// Soma dos pesos-alvo (pra mostrar quanto falta/sobra de 100%).
export function somaPesos(lista) {
  return (lista || []).reduce((s, x) => s + (Number(x.peso) || 0), 0);
}

// Normaliza os pesos pra somarem 100% (mantém proporção). Se soma=0, distribui igual.
export function normalizarPesos(lista) {
  const total = somaPesos(lista);
  if (!lista.length) return lista;
  if (total <= 0) {
    const igual = 100 / lista.length;
    return lista.map((x) => ({ ...x, peso: Math.round(igual * 100) / 100 }));
  }
  return lista.map((x) => ({ ...x, peso: Math.round(((Number(x.peso) || 0) / total) * 10000) / 100 }));
}
