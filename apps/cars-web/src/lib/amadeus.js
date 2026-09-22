/**
 * Cliente da API Amadeus Self-Service (plano GRATUITO, ambiente de teste).
 *
 * O usuário cria uma conta grátis em developers.amadeus.com, gera API Key +
 * API Secret e cola em Configurações → APIs (ficam em apiKeys.amadeusKey /
 * apiKeys.amadeusSecret, sincronizados na conta como as demais chaves).
 *
 * Endpoints usados pelo módulo Voos:
 *  - POST /v1/security/oauth2/token       → token (cache até expirar)
 *  - GET  /v2/shopping/flight-offers      → busca de voos (preço, escalas...)
 *  - GET  /v1/shopping/flight-dates       → calendário de preços (tendências)
 *
 * Ambiente de teste: cota mensal gratuita e cobertura parcial de rotas —
 * rotas grandes (GRU, GIG, LIS, MIA...) funcionam bem.
 */

const BASE = "https://test.api.amadeus.com";

let _token = null; // { valor, expiraEm }

async function obterToken(key, secret) {
  if (_token && Date.now() < _token.expiraEm - 30_000) return _token.valor;
  const res = await fetch(`${BASE}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(key)}&client_secret=${encodeURIComponent(secret)}`,
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Chave/Secret do Amadeus inválidos — confira em Configurações → APIs.");
    throw new Error(`Amadeus: falha no login (HTTP ${res.status}).`);
  }
  const data = await res.json();
  _token = { valor: data.access_token, expiraEm: Date.now() + (Number(data.expires_in) || 1700) * 1000 };
  return _token.valor;
}

async function getAmadeus(caminho, params, { key, secret }) {
  if (!key || !secret) throw new Error("Configure a API do Amadeus em Configurações → APIs (é grátis).");
  const token = await obterToken(key, secret);
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ""))
  ).toString();
  const res = await fetch(`${BASE}${caminho}?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) { _token = null; throw new Error("Sessão do Amadeus expirou — tenta de novo."); }
  if (res.status === 429) throw new Error("Limite de buscas do plano grátis atingido — tenta mais tarde.");
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detalhe = data?.errors?.[0]?.detail || data?.errors?.[0]?.title || `HTTP ${res.status}`;
    throw new Error(`Amadeus: ${detalhe}`);
  }
  return data;
}

/**
 * Busca de ofertas de voo.
 * @param {object} p { origem, destino, dataIda, dataVolta?, adultos=1, semEscala=false, max=30 }
 */
export async function buscarVoos(p, creds) {
  return getAmadeus("/v2/shopping/flight-offers", {
    originLocationCode: (p.origem || "").toUpperCase(),
    destinationLocationCode: (p.destino || "").toUpperCase(),
    departureDate: p.dataIda,
    returnDate: p.dataVolta || undefined,
    adults: p.adultos || 1,
    nonStop: p.semEscala ? "true" : undefined,
    currencyCode: "BRL",
    max: p.max || 30,
  }, creds);
}

/**
 * Calendário de preços (datas mais baratas) — base das tendências por mês.
 * Cobertura parcial no ambiente de teste; erros viram mensagem amigável.
 */
export async function calendarioPrecos(p, creds) {
  return getAmadeus("/v1/shopping/flight-dates", {
    origin: (p.origem || "").toUpperCase(),
    destination: (p.destino || "").toUpperCase(),
    oneWay: p.somenteIda ? "true" : undefined,
    nonStop: p.semEscala ? "true" : undefined,
    viewBy: "DATE",
  }, creds);
}

// Teste rápido das credenciais (usado no botão "Testar" das Configurações).
export async function pingAmadeus(key, secret) {
  try {
    await obterToken(key, secret);
    return { ok: true, resposta: "Conectado! Chaves válidas." };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}
