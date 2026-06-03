/* ============================================================
   INTELIGÊNCIA FINANCEIRA · análise comportamental sem servidor
   - Detecção de assinaturas recorrentes
   - Score financeiro comportamental
   - Cashflow preditivo (média móvel)
   - Insights automáticos
   Tudo localmente, sem API externa.
   ============================================================ */

/* ---------- DETECÇÃO DE ASSINATURAS ---------- */

const KEYWORDS_ASSINATURA = [
  "netflix", "spotify", "amazon prime", "disney", "globoplay", "hbo", "max ",
  "apple", "google", "youtube", "icloud",
  "adobe", "microsoft", "office 365", "chatgpt", "openai", "claude", "anthropic",
  "academia", "smart fit", "bodytech", "selfit",
  "uber one", "ifood pro", "ifood club",
  "tinder", "deezer", "audible",
];

/**
 * Detecta assinaturas analisando transações recorrentes (mesma descrição, valor próximo,
 * com periodicidade ~30 dias).
 *
 * Estratégia:
 * 1. Agrupa por descrição normalizada.
 * 2. Para cada grupo com 2+ ocorrências, verifica se aparecem em meses diferentes.
 * 3. Estima valor médio + frequência (mensal/anual).
 * 4. Boost de confiança se a descrição bate com lista de serviços conhecidos.
 */
export const detectarAssinaturas = (transacoes) => {
  if (!Array.isArray(transacoes) || transacoes.length === 0) return [];

  // Só despesas
  const despesas = transacoes.filter(t => t.tipo === "despesa" && t.descricao && t.valor);

  const grupos = {};
  despesas.forEach(t => {
    const key = t.descricao.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 50);
    (grupos[key] = grupos[key] || []).push(t);
  });

  const assinaturas = [];
  Object.entries(grupos).forEach(([key, items]) => {
    if (items.length < 2) return;

    // Conferir se aparecem em meses diferentes (anti-falso-positivo)
    const meses = new Set(items.map(t => (t.data || "").slice(0, 7)).filter(Boolean));
    if (meses.size < 2) return;

    // Valores próximos (variação < 30%)
    const valores = items.map(t => Number(t.valor));
    const avg = valores.reduce((s, v) => s + v, 0) / valores.length;
    const variacao = (Math.max(...valores) - Math.min(...valores)) / avg;
    if (variacao > 0.3) return; // valores muito diferentes — provavelmente não é assinatura

    // Detecta se bate com serviço conhecido (boost de confiança)
    const knownMatch = KEYWORDS_ASSINATURA.find(kw => key.includes(kw));

    // Última ocorrência
    const ultima = items.reduce((latest, t) => t.data > latest.data ? t : latest, items[0]);

    // Estima frequência (mensal vs outra)
    const datas = items.map(t => new Date(t.data)).filter(d => !isNaN(d)).sort((a, b) => a - b);
    let frequencia = "mensal";
    if (datas.length >= 2) {
      const intervalos = [];
      for (let i = 1; i < datas.length; i++) {
        intervalos.push((datas[i] - datas[i - 1]) / (1000 * 60 * 60 * 24));
      }
      const intMedio = intervalos.reduce((s, v) => s + v, 0) / intervalos.length;
      if (intMedio > 300) frequencia = "anual";
      else if (intMedio > 75) frequencia = "trimestral";
      else if (intMedio > 45) frequencia = "bimestral";
    }

    assinaturas.push({
      descricao: items[0].descricao, // versão original
      valorMedio: avg,
      ocorrencias: items.length,
      meses: meses.size,
      ultimaData: ultima.data,
      categoria: items[items.length - 1].categoria,
      conta: items[items.length - 1].conta,
      frequencia,
      conhecida: !!knownMatch,
      valorAnualizado: frequencia === "anual" ? avg
        : frequencia === "mensal" ? avg * 12
        : frequencia === "bimestral" ? avg * 6
        : avg * 4,
    });
  });

  // Ordena: conhecidas primeiro, depois maior valor anualizado
  return assinaturas.sort((a, b) => {
    if (a.conhecida !== b.conhecida) return b.conhecida - a.conhecida;
    return b.valorAnualizado - a.valorAnualizado;
  });
};

/* ---------- SCORE FINANCEIRO COMPORTAMENTAL ---------- */

/**
 * Calcula um score 0-1000 baseado em vários fatores comportamentais.
 *
 * Componentes (peso somando 1000):
 * - 200: Receita > Despesa nos últimos 90 dias (positivo)
 * - 200: % da renda gasta em cartão (<30% = bom)
 * - 150: Diversificação de gastos (não concentrado em 1 categoria)
 * - 150: Capacidade de investimento (% renda investida)
 * - 150: Reserva de emergência (meses de despesa cobertos)
 * - 150: Disciplina (% transações compensadas no prazo)
 */
export const calcularScore = (transacoes, contas, ativos, cartoes, parcelamentos, metas) => {
  const hoje = new Date();
  const ha90dias = new Date(hoje); ha90dias.setDate(ha90dias.getDate() - 90);
  const isoHa90 = ha90dias.toISOString().slice(0, 10);

  const tx90 = transacoes.filter(t => t.data >= isoHa90);
  const receitas = tx90.filter(t => t.tipo === "receita").reduce((s, t) => s + Number(t.valor || 0), 0);
  const despesas = tx90.filter(t => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor || 0), 0);
  const rendaMensal = receitas / 3;
  const despesaMensal = despesas / 3;

  let score = 0;
  const breakdown = [];

  // 1. Fluxo positivo (200)
  if (rendaMensal > 0) {
    const ratio = (receitas - despesas) / receitas;
    const pts = Math.max(0, Math.min(200, ratio * 1000));
    score += pts;
    breakdown.push({ label: "Fluxo de caixa positivo", pts: Math.round(pts), max: 200,
      hint: receitas > despesas ? "Você gasta menos do que ganha" : "Suas despesas superam receitas — atenção" });
  }

  // 2. Uso de cartão (200) — quanto menos % da renda em cartão, melhor
  const totalUsadoCartao = parcelamentos.reduce((s, p) => {
    const pagas = p.parcelasPagas?.length || 0;
    const restantes = (p.totalParcelas || 0) - pagas;
    return s + (p.valorTotal / (p.totalParcelas || 1)) * restantes;
  }, 0);
  const cartaoRatio = rendaMensal > 0 ? totalUsadoCartao / (rendaMensal * 6) : 1; // % de 6 meses de renda
  const cartaoPts = Math.max(0, Math.min(200, (1 - cartaoRatio) * 200));
  score += cartaoPts;
  breakdown.push({ label: "Controle de cartão de crédito", pts: Math.round(cartaoPts), max: 200,
    hint: cartaoRatio < 0.3 ? "Saudável" : cartaoRatio < 0.6 ? "Atenção" : "Endividamento alto" });

  // 3. Diversificação de gastos (150)
  const catGastos = {};
  tx90.filter(t => t.tipo === "despesa").forEach(t => {
    catGastos[t.categoria || "Outros"] = (catGastos[t.categoria || "Outros"] || 0) + Number(t.valor || 0);
  });
  const totalCats = Object.values(catGastos).reduce((s, v) => s + v, 0);
  const maxCat = Math.max(...Object.values(catGastos), 0);
  const concentr = totalCats > 0 ? maxCat / totalCats : 1;
  const diverPts = Math.max(0, Math.min(150, (1 - concentr) * 200));
  score += diverPts;
  breakdown.push({ label: "Diversificação de gastos", pts: Math.round(diverPts), max: 150,
    hint: concentr < 0.4 ? "Bom equilíbrio" : "Gastos concentrados em 1 categoria" });

  // 4. Capacidade de investimento (150)
  const valorAtivos = ativos.reduce((s, a) => s + (a.qtd || 0) * (a.preco || 0), 0);
  const investRatio = rendaMensal > 0 ? Math.min(1, valorAtivos / (rendaMensal * 12)) : 0;
  const investPts = Math.min(150, investRatio * 150);
  score += investPts;
  breakdown.push({ label: "Capacidade de investimento", pts: Math.round(investPts), max: 150,
    hint: investRatio > 0.5 ? "Boa reserva investida" : "Aumente seus aportes" });

  // 5. Reserva de emergência (150)
  const saldoLiquido = contas.reduce((s, c) => s + Number(c.saldo || 0), 0);
  const mesesCobertos = despesaMensal > 0 ? saldoLiquido / despesaMensal : 0;
  const reservaPts = Math.min(150, (mesesCobertos / 6) * 150);
  score += reservaPts;
  breakdown.push({ label: "Reserva de emergência", pts: Math.round(reservaPts), max: 150,
    hint: mesesCobertos >= 6 ? "Excelente (6+ meses cobertos)"
      : mesesCobertos >= 3 ? `${mesesCobertos.toFixed(1)} meses — quase lá`
      : `Apenas ${mesesCobertos.toFixed(1)} meses cobertos` });

  // 6. Disciplina (150) — % transações compensadas no prazo
  const txComData = transacoes.filter(t => t.data);
  const compensadas = txComData.filter(t => t.compensado).length;
  const disciplina = txComData.length > 0 ? compensadas / txComData.length : 0;
  const discPts = disciplina * 150;
  score += discPts;
  breakdown.push({ label: "Disciplina (transações compensadas)", pts: Math.round(discPts), max: 150,
    hint: disciplina > 0.85 ? "Muito disciplinado" : "Algumas transações pendentes" });

  const total = Math.round(score);
  let nivel = "Iniciante";
  let cor = "#94A3B8";
  if (total >= 800) { nivel = "Excelente"; cor = "#10B981"; }
  else if (total >= 650) { nivel = "Bom"; cor = "#22C55E"; }
  else if (total >= 500) { nivel = "Regular"; cor = "#F59E0B"; }
  else if (total >= 300) { nivel = "Atenção"; cor = "#F97316"; }
  else { nivel = "Crítico"; cor = "#EF4444"; }

  return { total, nivel, cor, breakdown, rendaMensal, despesaMensal };
};

/* ---------- CASHFLOW PREDITIVO ---------- */

/**
 * Projeta saldo dos próximos 3 meses baseado em:
 * - média de receitas dos últimos 3 meses
 * - média de despesas dos últimos 3 meses
 * - despesas fixas conhecidas
 */
export const projetarCashflow = (transacoes, contas, mesesAFrente = 3) => {
  const hoje = new Date();
  const meses = [];
  for (let i = 1; i <= mesesAFrente; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    meses.push({
      ano: d.getFullYear(),
      mes: d.getMonth() + 1,
      mesKey: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      nome: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    });
  }

  // Média móvel últimos 3 meses
  const ha90 = new Date(hoje); ha90.setMonth(ha90.getMonth() - 3);
  const tx90 = transacoes.filter(t => t.data && new Date(t.data) >= ha90 && new Date(t.data) <= hoje);
  const receitasMedia = tx90.filter(t => t.tipo === "receita").reduce((s, t) => s + Number(t.valor || 0), 0) / 3;
  const despesasMedia = tx90.filter(t => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor || 0), 0) / 3;

  // Despesas fixas conhecidas
  const fixas = transacoes.filter(t => t.fixa && !t.recurringOf);

  // Saldo atual
  let saldoCorrente = contas.reduce((s, c) => s + Number(c.saldo || 0), 0);

  const projecao = meses.map(m => {
    // Fixas previstas pra esse mês (não dupliquem se já materializadas)
    const fixasPrevistas = fixas.reduce((s, f) => s + Number(f.valor || 0) * (f.tipo === "receita" ? 1 : -1), 0);
    const fluxoBase = receitasMedia - despesasMedia;
    saldoCorrente = saldoCorrente + fluxoBase;
    return {
      ...m,
      receitas: receitasMedia,
      despesas: despesasMedia,
      fluxo: fluxoBase,
      saldo: saldoCorrente,
      fixasPrevistas,
    };
  });

  return projecao;
};

/* ---------- INSIGHTS ---------- */

/**
 * Gera insights automáticos a partir dos dados (sem usar IA externa).
 */
export const gerarInsights = (transacoes, contas, ativos, cartoes, parcelamentos) => {
  const insights = [];
  const hoje = new Date();
  const ha30 = new Date(hoje); ha30.setDate(ha30.getDate() - 30);
  const iso30 = ha30.toISOString().slice(0, 10);
  const ha60 = new Date(hoje); ha60.setDate(ha60.getDate() - 60);
  const iso60 = ha60.toISOString().slice(0, 10);

  const tx30 = transacoes.filter(t => t.data >= iso30);
  const tx60a30 = transacoes.filter(t => t.data >= iso60 && t.data < iso30);

  const receitasMensal = tx30.filter(t => t.tipo === "receita").reduce((s, t) => s + Number(t.valor || 0), 0);
  const despesasMensal = tx30.filter(t => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor || 0), 0);

  // 1. Delivery — comparação mês a mês
  const delivery30 = tx30.filter(t =>
    /ifood|rappi|delivery|uber eats|james|pedidos ya/i.test(t.descricao || "") ||
    /delivery|alimenta/i.test(t.categoria || "")
  ).reduce((s, t) => s + Number(t.valor || 0), 0);
  const delivery60 = tx60a30.filter(t =>
    /ifood|rappi|delivery|uber eats|james|pedidos ya/i.test(t.descricao || "") ||
    /delivery|alimenta/i.test(t.categoria || "")
  ).reduce((s, t) => s + Number(t.valor || 0), 0);
  if (delivery30 > 100 && delivery60 > 0) {
    const variacao = ((delivery30 - delivery60) / delivery60) * 100;
    if (variacao > 20) {
      insights.push({
        tipo: "alerta",
        titulo: `Gastos com delivery subiram ${variacao.toFixed(0)}% nos últimos 30 dias`,
        descricao: `Você gastou R$ ${delivery30.toFixed(2)} em delivery — R$ ${(delivery30 - delivery60).toFixed(2)} a mais que o mês anterior.`,
        prioridade: variacao > 50 ? "alta" : "media",
      });
    }
  }

  // 2. Fatura de cartão > 30% da renda
  const usoCartao = parcelamentos.reduce((s, p) => {
    const pagas = p.parcelasPagas?.length || 0;
    const restantes = (p.totalParcelas || 0) - pagas;
    return s + (p.valorTotal / (p.totalParcelas || 1)) * restantes;
  }, 0);
  if (receitasMensal > 0 && usoCartao / receitasMensal > 0.3) {
    insights.push({
      tipo: "alerta",
      titulo: "Cartão de crédito acima de 30% da renda",
      descricao: `Total em aberto no cartão é ${((usoCartao / receitasMensal) * 100).toFixed(0)}% da sua renda mensal.`,
      prioridade: "alta",
    });
  }

  // 3. Saldo de emergência insuficiente
  const saldoTotal = contas.reduce((s, c) => s + Number(c.saldo || 0), 0);
  if (despesasMensal > 0) {
    const meses = saldoTotal / despesasMensal;
    if (meses < 3) {
      insights.push({
        tipo: "atencao",
        titulo: `Reserva de emergência cobre apenas ${meses.toFixed(1)} meses`,
        descricao: "O ideal é manter de 6 a 12 meses de despesas em conta de liquidez imediata.",
        prioridade: meses < 1 ? "alta" : "media",
      });
    } else if (meses >= 6) {
      insights.push({
        tipo: "positivo",
        titulo: `Reserva de emergência cobrindo ${meses.toFixed(0)} meses`,
        descricao: "Você está em uma posição confortável. Considere investir parte do excedente.",
        prioridade: "baixa",
      });
    }
  }

  // 4. Categoria dominante
  const catGastos = {};
  tx30.filter(t => t.tipo === "despesa").forEach(t => {
    const cat = t.categoria || "Outros";
    catGastos[cat] = (catGastos[cat] || 0) + Number(t.valor || 0);
  });
  const totalGastos = Object.values(catGastos).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(catGastos).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0 && totalGastos > 0) {
    const [topCat, topVal] = sorted[0];
    const pct = (topVal / totalGastos) * 100;
    if (pct > 40 && topCat !== "Outros") {
      insights.push({
        tipo: "info",
        titulo: `${pct.toFixed(0)}% dos gastos estão em "${topCat}"`,
        descricao: `Categoria dominante: R$ ${topVal.toFixed(2)} dos R$ ${totalGastos.toFixed(2)} totais no último mês.`,
        prioridade: "media",
      });
    }
  }

  // 5. Carteira de investimentos sub-utilizada
  const valorAtivos = ativos.reduce((s, a) => s + (a.qtd || 0) * (a.preco || 0), 0);
  if (saldoTotal > 0 && valorAtivos < saldoTotal * 0.3 && saldoTotal > despesasMensal * 6) {
    insights.push({
      tipo: "oportunidade",
      titulo: "Excesso de caixa parado",
      descricao: `Você tem R$ ${(saldoTotal - despesasMensal * 6).toFixed(2)} acima da reserva ideal. Considere investir em renda fixa de liquidez diária.`,
      prioridade: "media",
    });
  }

  return insights;
};
