/**
 * WhatsApp Business · templates de mensagem editáveis.
 *
 * Cada template tem variáveis tipo {nome}, {valor}, {data} que são
 * substituídas no momento do envio. O usuário pode editar os templates
 * em Configurações → WhatsApp.
 *
 * NÃO usa API do WhatsApp Business (que exige aprovação e BSP).
 * Usa o protocolo wa.me que abre o WhatsApp/Web/Desktop.
 */

const KEY = "af4:wa-templates:v1";

const DEFAULTS = {
  cobranca: `Oi {nome}, tudo bem? 👋

Passando pra lembrar do valor combinado: {valor} venceu em {data}.

Se já pagou, me manda só o comprovante que aqui ainda consta em aberto.

Abraço!`,

  lembreteCheque: `Boa tarde {nome}!

Lembrando que o cheque Nº {numero} de {valor} vence em {data}.

Qualquer coisa, me avisa.`,

  reciboVenda: `🚗 *Recibo de venda*

*Comprador:* {nome}
*Veículo:* {veiculo}
*Valor:* {valor}
*Pagamento:* {pagamento}
*Data:* {data}

Obrigado pela confiança! Qualquer dúvida, estou à disposição.`,

  agradecimentoVenda: `{nome}, foi um prazer fechar negócio com você! 🤝

Qualquer suporte com o {veiculo}, pode me chamar.

Boa estrada e até a próxima!`,

  followUpLead: `Olá {nome}!

Você demonstrou interesse no {veiculo}, certo?

Tô passando pra ver se ainda tá no radar — temos algumas novidades que talvez te interessem.

Quando puder, me dá um sinal!`,

  agendamentoVisita: `Olá {nome}!

Confirmando nossa conversa: você passa aqui em {data} para ver o {veiculo}.

📍 Endereço: [Endereço da loja]
📞 Telefone: [Telefone]

Qualquer mudança, me avisa!`,

  cobrancaDivida: `Oi {nome},

Tô tentando organizar minhas pendências aqui e vi que tem um valor de {valor} comigo, com vencimento em {data}.

Pode me confirmar se já compensou ou se ainda tá pendente?

Valeu!`,
};

const safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

export function getTemplates() {
  return safe(() => {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  }, { ...DEFAULTS });
}

export function setTemplate(id, texto) {
  const cur = getTemplates();
  cur[id] = texto;
  safe(() => localStorage.setItem(KEY, JSON.stringify(cur)));
}

export function resetTemplates() {
  safe(() => localStorage.removeItem(KEY));
}

export function getDefaults() {
  return { ...DEFAULTS };
}

/** Substitui {variavel} no template */
export function interpolar(template, dados) {
  if (!template) return "";
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = dados[key];
    return v == null ? `{${key}}` : String(v);
  });
}

/** Limpa telefone e abre wa.me com texto preenchido */
export function abrirWhatsApp(telefone, mensagem) {
  const tel = (telefone || "").replace(/\D/g, "");
  const texto = encodeURIComponent(mensagem);
  const url = tel
    ? `https://wa.me/55${tel}?text=${texto}`
    : `https://wa.me/?text=${texto}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Helpers para usar de qualquer lugar do app */
export const whatsapp = {
  /** Cobrar devedor atrasado */
  cobrarDevedor: (devedor) => {
    const tmpl = getTemplates().cobranca;
    const msg = interpolar(tmpl, {
      nome: devedor.nome,
      valor: formatBRL(devedor.valor),
      data: formatData(devedor.vencimento),
    });
    abrirWhatsApp(devedor.telefone, msg);
  },

  /** Lembrar emitente de cheque próximo */
  lembrarCheque: (cheque) => {
    const tmpl = getTemplates().lembreteCheque;
    const msg = interpolar(tmpl, {
      nome: cheque.emitente,
      numero: cheque.numero || "—",
      valor: formatBRL(cheque.valor),
      data: formatData(cheque.data),
    });
    abrirWhatsApp(cheque.telefone, msg);
  },

  /** Mandar recibo de venda */
  recibo: (venda, veiculo, cliente, formaPagamento) => {
    const tmpl = getTemplates().reciboVenda;
    const msg = interpolar(tmpl, {
      nome: cliente?.nome || venda.clienteNome || "Cliente",
      veiculo: veiculo ? `${veiculo.marca} ${veiculo.modelo}` : "—",
      valor: formatBRL(venda.valorVenda),
      pagamento: formaPagamento || venda.formaPagamento || "—",
      data: formatData(venda.dataVenda),
    });
    abrirWhatsApp(cliente?.telefone, msg);
  },

  /** Agradecer cliente após venda */
  agradecer: (venda, veiculo, cliente) => {
    const tmpl = getTemplates().agradecimentoVenda;
    const msg = interpolar(tmpl, {
      nome: cliente?.nome || venda.clienteNome || "Cliente",
      veiculo: veiculo ? `${veiculo.marca} ${veiculo.modelo}` : "—",
    });
    abrirWhatsApp(cliente?.telefone, msg);
  },

  /** Follow-up de lead */
  followUp: (lead) => {
    const tmpl = getTemplates().followUpLead;
    const msg = interpolar(tmpl, {
      nome: lead.nome,
      veiculo: lead.veiculoInteresse || "veículo de interesse",
    });
    abrirWhatsApp(lead.telefone, msg);
  },

  /** Confirmar agendamento de visita */
  agendarVisita: (lead, data) => {
    const tmpl = getTemplates().agendamentoVisita;
    const msg = interpolar(tmpl, {
      nome: lead.nome,
      veiculo: lead.veiculoInteresse || "veículo",
      data: formatData(data),
    });
    abrirWhatsApp(lead.telefone, msg);
  },

  /** Cobrar dívida pessoal */
  cobrarDivida: (divida) => {
    const tmpl = getTemplates().cobrancaDivida;
    const msg = interpolar(tmpl, {
      nome: divida.nome,
      valor: formatBRL(divida.valor),
      data: formatData(divida.vencimento),
    });
    abrirWhatsApp(divida.telefone, msg);
  },
};

function formatBRL(v) {
  try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0); }
  catch { return `R$ ${v}`; }
}

function formatData(d) {
  if (!d) return "—";
  try {
    const date = new Date(d + (d.length === 10 ? "T00:00:00" : ""));
    return date.toLocaleDateString("pt-BR");
  } catch { return d; }
}
