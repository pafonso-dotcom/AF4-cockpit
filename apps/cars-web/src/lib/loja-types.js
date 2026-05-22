/* ============================================================
   LOJA TYPES · status, helpers e seeds para cheques e leads
   ============================================================ */

export const STATUS_LEAD = {
  NOVO: "NOVO",
  EM_ATENDIMENTO: "EM_ATENDIMENTO",
  NEGOCIACAO: "NEGOCIACAO",
  APROV_FINANCIAMENTO: "APROV_FINANCIAMENTO",
  FECHADO: "FECHADO",
  PERDIDO: "PERDIDO",
};

export const STATUS_CHEQUE = {
  AGUARDANDO: "AGUARDANDO",
  DISPONIVEL: "DISPONIVEL",
  COMPENSADO: "COMPENSADO",
  DEVOLVIDO: "DEVOLVIDO",
};

export const CANAL_LEAD = ["WhatsApp", "Instagram", "Facebook", "OLX", "Webmotors", "Indicação", "Site", "Outros"];

/** Cheques próximos do vencimento (dentro de `dias` dias). */
export const chequesProximos = (cheques = [], dias = 7, ref = new Date()) => {
  const limite = new Date(ref);
  limite.setDate(limite.getDate() + dias);
  return (cheques || []).filter(c => {
    if (!c || c.status === "COMPENSADO" || c.status === "DEVOLVIDO") return false;
    if (!c.dataBomPara) return false;
    const d = new Date(c.dataBomPara);
    return d >= ref && d <= limite;
  });
};

/** Cheques cuja data já passou e não foram compensados. */
export const chequesVencidos = (cheques = [], ref = new Date()) => {
  const refStr = ref.toISOString().slice(0, 10);
  return (cheques || []).filter(c => {
    if (!c || c.status === "COMPENSADO" || c.status === "DEVOLVIDO") return false;
    return c.dataBomPara && c.dataBomPara < refStr;
  });
};

export const seedCheques = [];
export const seedLeads = [];
