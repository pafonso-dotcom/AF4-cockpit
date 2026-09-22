/**
 * Módulo Voos — lógica pura (testável, sem rede).
 *
 * - simplificarOfertas: JSON do Amadeus → ofertas amigáveis (preço, cias,
 *   horários, ESCALAS destacadas com duração da conexão);
 * - aplicarFiltros: só direto · companhias · janela de horário de saída;
 * - analisarTendencias: calendário de preços → mês mais barato + % de
 *   desconto de cada mês vs a mediana;
 * - monitores de preço: deveChecarAgora (horários do dia configurados) e
 *   registrarChecagem (histórico + dispara quando atinge o alvo).
 */

// Aeroportos comuns pro seletor (IATA — digitação livre também vale).
export const AEROPORTOS = [
  { code: "GRU", nome: "São Paulo · Guarulhos" },
  { code: "CGH", nome: "São Paulo · Congonhas" },
  { code: "VCP", nome: "Campinas · Viracopos" },
  { code: "GIG", nome: "Rio · Galeão" },
  { code: "SDU", nome: "Rio · Santos Dumont" },
  { code: "BSB", nome: "Brasília" },
  { code: "CNF", nome: "Belo Horizonte · Confins" },
  { code: "POA", nome: "Porto Alegre" },
  { code: "CWB", nome: "Curitiba" },
  { code: "FLN", nome: "Florianópolis" },
  { code: "SSA", nome: "Salvador" },
  { code: "REC", nome: "Recife" },
  { code: "FOR", nome: "Fortaleza" },
  { code: "NAT", nome: "Natal" },
  { code: "MCZ", nome: "Maceió" },
  { code: "LIS", nome: "Lisboa" },
  { code: "OPO", nome: "Porto (PT)" },
  { code: "MAD", nome: "Madri" },
  { code: "BCN", nome: "Barcelona" },
  { code: "CDG", nome: "Paris · CDG" },
  { code: "LHR", nome: "Londres · Heathrow" },
  { code: "FCO", nome: "Roma" },
  { code: "MIA", nome: "Miami" },
  { code: "MCO", nome: "Orlando" },
  { code: "JFK", nome: "Nova York · JFK" },
  { code: "EZE", nome: "Buenos Aires" },
  { code: "SCL", nome: "Santiago" },
];

export const CIAS = {
  LA: "LATAM", G3: "GOL", AD: "Azul", TP: "TAP", IB: "Iberia", AF: "Air France",
  KL: "KLM", LH: "Lufthansa", BA: "British", AA: "American", DL: "Delta",
  UA: "United", EK: "Emirates", QR: "Qatar", TK: "Turkish", AV: "Avianca",
  AR: "Aerolíneas", CM: "Copa", AZ: "ITA", LX: "Swiss", UX: "Air Europa",
};
export const nomeCia = (code) => CIAS[code] || code;

// "PT6H35M" → minutos
export function duracaoMin(iso = "") {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso);
  if (!m) return 0;
  return (Number(m[1]) || 0) * 60 + (Number(m[2]) || 0);
}
export const fmtDuracao = (min) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;

const hhmm = (isoDt = "") => (isoDt.split("T")[1] || "").slice(0, 5);

// Um itinerário (ida OU volta) → segmentos + escalas com tempo de conexão.
function mapItinerario(it) {
  const segs = (it.segments || []).map(s => ({
    de: s.departure?.iataCode, para: s.arrival?.iataCode,
    saida: s.departure?.at || "", chegada: s.arrival?.at || "",
    cia: s.carrierCode, voo: `${s.carrierCode}${s.number}`,
  }));
  const escalas = [];
  for (let i = 0; i < segs.length - 1; i++) {
    const espera = Math.max(0, Math.round((new Date(segs[i + 1].saida) - new Date(segs[i].chegada)) / 60000));
    escalas.push({ aeroporto: segs[i].para, esperaMin: espera });
  }
  return {
    duracaoMin: duracaoMin(it.duration),
    segmentos: segs,
    paradas: Math.max(0, segs.length - 1),
    escalas,
    saida: segs[0]?.saida || "", chegada: segs[segs.length - 1]?.chegada || "",
    horaSaida: hhmm(segs[0]?.saida), horaChegada: hhmm(segs[segs.length - 1]?.chegada),
  };
}

// JSON do flight-offers → lista de ofertas simples, ordenadas por preço.
export function simplificarOfertas(json) {
  const dicts = json?.dictionaries || {};
  return (json?.data || []).map(o => {
    const itinerarios = (o.itineraries || []).map(mapItinerario);
    const cias = Array.from(new Set(itinerarios.flatMap(i => i.segmentos.map(s => s.cia))));
    return {
      id: o.id,
      preco: Number(o.price?.grandTotal || o.price?.total) || 0,
      moeda: o.price?.currency || "BRL",
      cias,
      ciasNomes: cias.map(c => dicts.carriers?.[c] || nomeCia(c)),
      itinerarios,
      paradasMax: Math.max(...itinerarios.map(i => i.paradas), 0),
      assentosRestantes: o.numberOfBookableSeats,
    };
  }).sort((a, b) => a.preco - b.preco);
}

// Filtros de tela: { semEscala, cias:[], janela: ""|"manha"|"tarde"|"noite" }
export function aplicarFiltros(ofertas, f = {}) {
  const dentroJanela = (hora) => {
    if (!f.janela) return true;
    const h = Number((hora || "").slice(0, 2));
    if (f.janela === "manha") return h >= 5 && h < 12;
    if (f.janela === "tarde") return h >= 12 && h < 18;
    if (f.janela === "noite") return h >= 18 || h < 5;
    return true;
  };
  return (ofertas || []).filter(o =>
    (!f.semEscala || o.paradasMax === 0) &&
    (!f.cias?.length || o.cias.some(c => f.cias.includes(c))) &&
    dentroJanela(o.itinerarios[0]?.horaSaida)
  );
}

const MES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Calendário de preços → tendências: menor preço por mês, mês mais barato e
 * % de desconto de cada mês vs a MEDIANA (positivo = mais barato que o comum).
 */
export function analisarTendencias(json) {
  const porMes = {};
  (json?.data || []).forEach(d => {
    const preco = Number(d.price?.total) || 0;
    const mes = (d.departureDate || "").slice(0, 7); // YYYY-MM
    if (!mes || !preco) return;
    if (!porMes[mes] || preco < porMes[mes].preco) porMes[mes] = { mes, preco, data: d.departureDate };
  });
  const meses = Object.values(porMes).sort((a, b) => a.mes.localeCompare(b.mes));
  if (!meses.length) return { meses: [], maisBarato: null };
  const precos = [...meses.map(m => m.preco)].sort((a, b) => a - b);
  const mediana = precos[Math.floor(precos.length / 2)];
  const comDesconto = meses.map(m => ({
    ...m,
    rotulo: `${MES_PT[Number(m.mes.slice(5, 7)) - 1]}/${m.mes.slice(2, 4)}`,
    descontoPct: mediana > 0 ? Math.round((1 - m.preco / mediana) * 100) : 0,
  }));
  const maisBarato = comDesconto.reduce((a, b) => (b.preco < a.preco ? b : a), comDesconto[0]);
  return { meses: comDesconto, maisBarato, mediana };
}

/* ===================== Monitores de preço ===================== */

// O monitor tem horários fixos de checagem (ex.: ["08:00","20:00"]). Deve
// checar se ALGUM horário de hoje já passou e a última checagem foi antes dele.
export function deveChecarAgora(monitor, agora = new Date()) {
  const horarios = monitor?.horariosChecagem?.length ? monitor.horariosChecagem : ["08:00", "20:00"];
  const ultima = monitor?.ultimaChecagem ? new Date(monitor.ultimaChecagem) : null;
  for (const h of horarios) {
    const [hh, mm] = h.split(":").map(Number);
    const slot = new Date(agora);
    slot.setHours(hh || 0, mm || 0, 0, 0);
    if (slot <= agora && (!ultima || ultima < slot)) return true;
  }
  return false;
}

/**
 * Registra o preço de uma checagem no monitor (histórico limitado a 60) e
 * diz se ATINGIU O ALVO agora (só dispara na transição, pra não repetir aviso).
 */
export function registrarChecagem(monitor, preco, agora = new Date()) {
  const historico = [...(monitor.historico || []), { em: agora.toISOString(), preco }].slice(-60);
  const melhorPreco = Math.min(preco, monitor.melhorPreco || Infinity);
  const estavaAcima = !(Number(monitor.ultimoPreco) > 0) || Number(monitor.ultimoPreco) > Number(monitor.alvo || 0);
  const atingiuAlvo = Number(monitor.alvo) > 0 && preco <= Number(monitor.alvo) && estavaAcima;
  return {
    monitor: {
      ...monitor,
      historico, melhorPreco,
      ultimoPreco: preco,
      ultimaChecagem: agora.toISOString(),
      alvoAtingidoEm: atingiuAlvo ? agora.toISOString() : monitor.alvoAtingidoEm || null,
    },
    atingiuAlvo,
  };
}
