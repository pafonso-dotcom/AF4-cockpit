/* ============================================================
   RESUMO DO DIA · uma olhada e o dia está decidido

   Junta, numa lista curta de avisos, o que o app já sabe:
   - o que VENCE HOJE (despesas pendentes com data de hoje)
   - cartão que FECHA em até 2 dias (última chance de comprar
     nesta fatura)
   - orçamento de categoria em ≥90% (ou estourado)
   - alertas de preço que dispararam hoje
   - proventos ainda pendentes no mês (lib/proventosPrevistos.js)

   Puro: recebe os dados prontos e devolve [{ icone, texto, cor }].
   Quem monta os dados é o Dashboard.
   ============================================================ */

const diaLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function montarResumoDia({
  despesasMes = [],        // itens de getDespesasDoMes (mês corrente)
  devedores = [],          // a receber — pro aviso "A receber hoje"
  cartoes = [],
  orcamentos = [],         // saída de calcOrcamentoComGastos
  alertasHoje = [],        // tickers que dispararam hoje
  proventosMes = null,     // { total, qtd } de proventosPendentesDoMes
  backupAtraso = null,     // { dias } de backupNuvemAtraso (null = em dia/desligado)
  cambioDefasado = 0,      // nº de contas de contasCambioDefasado
  agendaHoje = null,       // { eventos, lembretes, tarefas } do dia (Agenda)
  fmt = (v) => String(v),
  hoje = new Date(),
} = {}) {
  const avisos = [];
  const hojeISO = diaLocal(hoje);

  // 1) Vence hoje
  const vencemHoje = (despesasMes || []).filter(d => d && d.status !== "paga" && String(d.data || "").slice(0, 10) === hojeISO);
  if (vencemHoje.length) {
    const total = vencemHoje.reduce((s, d) => s + (Number(d.valor) || 0), 0);
    const nome = vencemHoje[0]?.descricao || "conta";
    avisos.push({
      icone: "⏰", cor: "red",
      texto: vencemHoje.length === 1
        ? `Vence hoje: ${nome} (${fmt(total)})`
        : `Vencem hoje: ${vencemHoje.length} contas (${fmt(total)})`,
    });
  }

  // 1¼) A receber hoje — devedores com vencimento no dia (valor em aberto).
  const recebemHoje = (devedores || []).filter(d =>
    d && !d.recebido && String(d.vencimento || "").slice(0, 10) === hojeISO
    && ((Number(d.valor) || 0) - (Number(d.valorRecebido) || 0)) > 0);
  if (recebemHoje.length) {
    const total = recebemHoje.reduce((s, d) => s + ((Number(d.valor) || 0) - (Number(d.valorRecebido) || 0)), 0);
    avisos.push({
      icone: "💰", cor: "green",
      texto: recebemHoje.length === 1
        ? `A receber hoje: ${recebemHoje[0]?.nome || "depósito"} (${fmt(total)})`
        : `A receber hoje: ${recebemHoje.length} depósitos (${fmt(total)})`,
    });
  }

  // 1½) Agenda de hoje — compromissos, lembretes e tarefas do dia (a Agenda
  // ficou enxuta; o Painel avisa o que tem pra hoje).
  if (agendaHoje) {
    const partes = [];
    if (agendaHoje.eventos > 0) partes.push(`${agendaHoje.eventos} compromisso${agendaHoje.eventos === 1 ? "" : "s"}`);
    if (agendaHoje.lembretes > 0) partes.push(`${agendaHoje.lembretes} lembrete${agendaHoje.lembretes === 1 ? "" : "s"}`);
    if (agendaHoje.tarefas > 0) partes.push(`${agendaHoje.tarefas} tarefa${agendaHoje.tarefas === 1 ? "" : "s"}`);
    if (partes.length) {
      avisos.push({ icone: "📌", cor: "gold", texto: `Hoje na agenda: ${partes.join(" · ")}` });
    }
  }

  // 2) Cartão fechando (hoje, amanhã ou depois de amanhã)
  (cartoes || []).forEach(c => {
    const fech = Number(c?.fechamento);
    if (!(fech >= 1 && fech <= 31)) return;
    const alvo = new Date(hoje.getFullYear(), hoje.getMonth() + (hoje.getDate() > fech ? 1 : 0), Math.min(fech, 28));
    const dias = Math.round((alvo - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 86400000);
    if (dias >= 0 && dias <= 2) {
      avisos.push({
        icone: "💳", cor: "gold",
        texto: `${c.nome} fecha ${dias === 0 ? "HOJE" : dias === 1 ? "amanhã" : "em 2 dias"} — compras depois vão pra próxima fatura`,
      });
    }
  });

  // 3) Orçamento apertado (pior categoria ≥90%)
  const apertadas = (orcamentos || []).filter(o => o && o.pct >= 90);
  if (apertadas.length) {
    const pior = apertadas[0]; // já vem ordenado por % desc
    avisos.push({
      icone: "📊", cor: pior.pct >= 100 ? "red" : "gold",
      texto: pior.pct >= 100
        ? `Orçamento de ${pior.nome} ESTOUROU (${Math.round(pior.pct)}%)`
        : `Orçamento de ${pior.nome} em ${Math.round(pior.pct)}%`,
    });
  }

  // 3½) Backup na nuvem atrasado — silêncio aqui já escondeu backup quebrado
  if (backupAtraso) {
    avisos.push({
      icone: "☁️", cor: "gold",
      texto: backupAtraso.dias == null
        ? "Backup na nuvem nunca enviou — confira o token em Configurações → Backup"
        : `Backup na nuvem há ${backupAtraso.dias} dia${backupAtraso.dias === 1 ? "" : "s"} sem enviar — veja Configurações → Backup`,
    });
  }

  // 3¾) Câmbio defasado — total em R$ pode estar errado sem ninguém saber
  if (Number(cambioDefasado) > 0) {
    avisos.push({
      icone: "💱", cor: "gold",
      texto: `Câmbio de ${cambioDefasado} conta${cambioDefasado === 1 ? "" : "s"} do exterior defasado — o total em R$ pode estar velho (abra Contas)`,
    });
  }

  // 4) Alertas de preço de hoje
  if ((alertasHoje || []).length) {
    avisos.push({
      icone: "🔔", cor: "green",
      texto: `Alerta de preço: ${alertasHoje.slice(0, 3).join(", ")}${alertasHoje.length > 3 ? "…" : ""} no alvo`,
    });
  }

  const out = avisos.slice(0, 4);

  // 5) Proventos previstos — informativo, entra por último (avisos urgentes
  // têm prioridade nas 4 vagas; este é um extra sempre visível quando existe).
  if (proventosMes && Number(proventosMes.total) > 0) {
    out.push({
      icone: "💰", cor: "green",
      texto: `Proventos previstos: ${fmt(proventosMes.total)} ainda este mês (${proventosMes.qtd} pagamento${proventosMes.qtd === 1 ? "" : "s"})`,
    });
  }

  return out;
}

/** Tickers cujo alerta de preço disparou HOJE (lido do dedupe em localStorage). */
export function alertasDisparadosHoje(hoje = new Date()) {
  try {
    const notif = JSON.parse(localStorage.getItem("af4:alertas-preco:v1") || "{}");
    const hojeISO = diaLocal(hoje);
    const tickers = new Set();
    Object.entries(notif).forEach(([chave, dia]) => {
      if (dia === hojeISO) tickers.add(String(chave).split("|")[0]);
    });
    return [...tickers];
  } catch { return []; }
}
