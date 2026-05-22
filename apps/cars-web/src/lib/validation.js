/* ============================================================
   VALIDATION · schemas leves para entrada de dados
   Sem dependência externa (Zod) — implementação minimalista no estilo.
   ============================================================ */

// ─────────────────────────────────────────────────────────────────────────
// Tipos primitivos
// ─────────────────────────────────────────────────────────────────────────

const ok = (value) => ({ ok: true, value });
const fail = (message) => ({ ok: false, error: message });

export const v = {
  string: ({ min = 0, max = 1000, required = true } = {}) => (val) => {
    if (val == null || val === "") {
      if (required) return fail("Campo obrigatório");
      return ok("");
    }
    if (typeof val !== "string") val = String(val);
    val = val.trim();
    if (val.length < min) return fail(`Mínimo ${min} caracteres`);
    if (val.length > max) return fail(`Máximo ${max} caracteres`);
    return ok(val);
  },

  number: ({ min = -Infinity, max = Infinity, required = true, integer = false } = {}) => (val) => {
    if (val == null || val === "") {
      if (required) return fail("Campo obrigatório");
      return ok(null);
    }
    const n = typeof val === "number" ? val : parseFloat(String(val).replace(",", "."));
    if (isNaN(n)) return fail("Não é um número válido");
    if (integer && !Number.isInteger(n)) return fail("Deve ser número inteiro");
    if (n < min) return fail(`Valor mínimo: ${min}`);
    if (n > max) return fail(`Valor máximo: ${max}`);
    return ok(n);
  },

  enum: (values, { required = true } = {}) => (val) => {
    if (val == null || val === "") {
      if (required) return fail("Selecione uma opção");
      return ok(null);
    }
    if (!values.includes(val)) return fail(`Valor inválido (deve ser um de: ${values.join(", ")})`);
    return ok(val);
  },

  date: ({ required = true } = {}) => (val) => {
    if (val == null || val === "") {
      if (required) return fail("Data obrigatória");
      return ok(null);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) return fail("Formato de data inválido (esperado YYYY-MM-DD)");
    const d = new Date(val);
    if (isNaN(d.getTime())) return fail("Data inválida");
    return ok(val);
  },

  bool: () => (val) => ok(!!val),

  // Optional aliases
  optional: (validator) => (val) => {
    if (val == null || val === "") return ok(null);
    return validator(val);
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Schemas das principais entidades do app
// ─────────────────────────────────────────────────────────────────────────

export const schemas = {
  transacao: {
    descricao: v.string({ min: 1, max: 200 }),
    valor: v.number({ min: 0.01, max: 99999999 }),
    tipo: v.enum(["receita", "despesa"]),
    categoria: v.string({ min: 1 }),
    conta: v.string({ min: 1 }),
    data: v.date(),
    obs: v.string({ required: false, max: 500 }),
    fixa: v.bool(),
    vencimento: v.optional(v.number({ min: 1, max: 31, integer: true })),
  },

  conta: {
    nome: v.string({ min: 1, max: 60 }),
    saldo: v.number({ min: -99999999, max: 99999999 }),
    cor: v.string({ min: 1 }),
  },

  categoria: {
    nome: v.string({ min: 1, max: 60 }),
    tipo: v.enum(["receita", "despesa"]),
    cor: v.string({ min: 1 }),
    limite: v.optional(v.number({ min: 0, max: 99999999 })),
  },

  cartao: {
    nome: v.string({ min: 1, max: 60 }),
    banco: v.string({ min: 1 }),
    limite: v.number({ min: 0, max: 99999999 }),
    vencimento: v.number({ min: 1, max: 31, integer: true }),
    fechamento: v.number({ min: 1, max: 31, integer: true }),
    tipo: v.enum(["principal", "reserva"]),
  },

  parcelamento: {
    descricao: v.string({ min: 1, max: 200 }),
    cartaoNome: v.string({ min: 1 }),
    valorTotal: v.number({ min: 0.01 }),
    totalParcelas: v.number({ min: 1, max: 360, integer: true }),
    dataCompra: v.date(),
    dataPrimeira: v.date(),
  },

  devedor: {
    nome: v.string({ min: 1, max: 60 }),
    valor: v.number({ min: 0.01 }),
    quando: v.date(),
    oque: v.string({ required: false, max: 200 }),
    combinado: v.string({ required: false, max: 200 }),
  },

  divida: {
    descricao: v.string({ min: 1, max: 200 }),
    paraQuem: v.string({ min: 1, max: 100 }),
    valor: v.number({ min: 0.01 }),
    parcelasRestantes: v.number({ min: 1, max: 360, integer: true }),
    data: v.date(),
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Validador de objeto contra um schema
// ─────────────────────────────────────────────────────────────────────────

/**
 * Valida um objeto contra um schema.
 * Retorna { ok: true, value: cleanData } ou { ok: false, errors: { campo: msg } }.
 */
export const validate = (schema, data) => {
  const cleaned = {};
  const errors = {};
  let hasError = false;

  for (const [key, validator] of Object.entries(schema)) {
    const result = validator(data?.[key]);
    if (!result.ok) {
      errors[key] = result.error;
      hasError = true;
    } else {
      cleaned[key] = result.value;
    }
  }

  if (hasError) return { ok: false, errors };
  return { ok: true, value: cleaned };
};
