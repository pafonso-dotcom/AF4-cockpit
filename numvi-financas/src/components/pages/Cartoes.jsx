import React, { useState, useMemo } from "react";
import { CreditCard, Calendar, TrendingUp, TrendingDown, Plus, Trash2, Edit3, Check, Repeat, ChevronDown, ChevronUp } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, fmtN, uid, todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import { BANK_BRANDS } from "../../data/banks.js";
import PageHeader from "../ui/PageHeader.jsx";
import Field from "../ui/Field.jsx";
import StatCard from "../ui/StatCard.jsx";
import Modal from "../ui/Modal.jsx";
import SecaoColapsavel from "../ui/SecaoColapsavel.jsx";

// ===== Helpers compartilhados de parcelas =====
// Mantidos no nível do módulo pra que o cálculo do "valor a pagar" do cartão
// use EXATAMENTE a mesma regra da lista de parcelas (match por id OU nome,
// valor da parcela = valorParcela ?? valorTotal/totalParcelas). Assim o total
// sempre bate com o que aparece na tela.
const normNomeCartao = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const valorDaParcela = (p) =>
  Number(p.valorParcela || (p.valorTotal && p.totalParcelas ? p.valorTotal / p.totalParcelas : 0)) || 0;
function parcelasAtivasDoCartao(cartao, parcelamentos = []) {
  return parcelamentos.filter(p => {
    if ((p.parcelasPagas?.length || 0) >= p.totalParcelas) return false;
    if (p.cartaoId === cartao.id) return true;
    if (normNomeCartao(p.cartaoNome) === normNomeCartao(cartao.nome)) return true;
    return false;
  });
}
// Mês corrente no formato YYYY-MM (chave de competência).
const mesAtualKey = () => todayISO().slice(0, 7);
// Mês em que a parcela N cai. Se tem dataPrimeira, soma (N-1) meses;
// senão usa dataCompra + 1 mês. Retorna Date ou null se não há base.
function dataDaParcela(p, n) {
  const base = p.dataPrimeira || p.dataCompra;
  if (!base) return null;
  const [y, m, d] = base.split("-").map(Number);
  const startMonth = p.dataPrimeira ? m : m + 1;
  return new Date(y, startMonth - 1 + (n - 1), d);
}
// Fatura do mês = só as parcelas que VENCEM neste mês (monthKey) e que AINDA
// não estão marcadas como pagas. Assim, depois de pagar/antecipar a fatura,
// o valor deixa de aparecer como "a pagar" (antes somava 1 parcela de cada
// parcelamento em curso, ignorando data e pagamento).
function faturaMensalDoCartao(cartao, parcelamentos = [], monthKey = mesAtualKey()) {
  return parcelasAtivasDoCartao(cartao, parcelamentos).reduce((s, p) => {
    const pagas = new Set(p.parcelasPagas || []);
    let devido = 0;
    for (let n = 1; n <= (p.totalParcelas || 0); n++) {
      if (pagas.has(n)) continue;
      const dt = dataDaParcela(p, n);
      if (!dt) continue;
      if (`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}` === monthKey) {
        devido += valorDaParcela(p);
      }
    }
    return s + devido;
  }, 0);
}
// Valor a pagar do mês COMPLETO: se há fatura importada (que já soma à vista +
// fixas + parcelas) e não está paga, usa o valor dela; senão, só as parcelas
// do mês que ainda não foram pagas.
function valorAPagarMes(cartao, parcelamentos = [], monthKey = mesAtualKey()) {
  if (cartao.faturaImportada && cartao.faturaImportada.paga) return 0;
  const fiTotal = cartao.faturaImportada ? Number(cartao.faturaImportada.valorTotal) || 0 : 0;
  return fiTotal > 0 ? fiTotal : faturaMensalDoCartao(cartao, parcelamentos, monthKey);
}

export default function Cartoes({ cartoes, setCartoes, parcelamentos, setParcelamentos, contas, setContas, transacoes, setTransacoes, fixas = [], setFixas, fixaOcorrencias = [], setFixaOcorrencias, categorias, hidden, onCartaoClick, cartaoAtivo }) {
  const [form, setForm] = useState(null);
  const [parcForm, setParcForm] = useState(null);
  const [pagFatura, setPagFatura] = useState(null); // { cartaoId, valor, contaNome, data }
  const [pagErrors, setPagErrors] = useState({});
  const [expandedCart, setExpandedCart] = useState(() => new Set());
  const toggleExpandedCart = (id) => {
    setExpandedCart(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // Grupos de parcelamentos por cartão (colapsáveis). Override manual; padrão:
  // só o primeiro cartão com compras fica aberto, os demais recolhidos.
  const [parcGrupoOverride, setParcGrupoOverride] = useState({});
  const toggleParcGrupo = (key, abertoPadrao) =>
    setParcGrupoOverride(prev => ({ ...prev, [key]: !(key in prev ? prev[key] : abertoPadrao) }));

  // Used limit per card from active installments
  const usedByCard = useMemo(() => {
    const map = {};
    parcelamentos.forEach(p => {
      const pagas = p.parcelasPagas?.length || 0;
      const restantes = (p.totalParcelas || 0) - pagas;
      const valorParcela = (p.valorTotal || 0) / (p.totalParcelas || 1);
      const aberto = valorParcela * restantes;
      map[p.cartaoId] = (map[p.cartaoId] || 0) + aberto;
    });
    return map;
  }, [parcelamentos]);

  const totalUsado = Object.values(usedByCard).reduce((s, v) => s + v, 0);

  const [formErrors, setFormErrors] = useState({});
  const [parcErrors, setParcErrors] = useState({});

  const saveCard = () => {
    const errs = {};
    if (!form.nome?.trim()) errs.nome = "Nome do cartão obrigatório";
    if (!form.limite || parseFloat(form.limite) <= 0) errs.limite = "Limite deve ser positivo";
    const venc = parseInt(form.vencimento);
    if (isNaN(venc) || venc < 1 || venc > 31) errs.vencimento = "Dia entre 1 e 31";
    const fech = parseInt(form.fechamento);
    if (isNaN(fech) || fech < 1 || fech > 31) errs.fechamento = "Dia entre 1 e 31";

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }

    const data = { ...form, limite: parseFloat(form.limite), vencimento: venc, fechamento: fech };
    if (form.id && cartoes.find(c => c.id === form.id)) {
      setCartoes(cartoes.map(c => c.id === form.id ? data : c));
      toast.success(`${data.nome} atualizado.`);
    } else {
      setCartoes([...cartoes, { ...data, id: uid() }]);
      toast.success(`Cartão "${data.nome}" criado.`);
    }
    setForm(null);
    setFormErrors({});
  };

  const saveParc = () => {
    const errs = {};
    if (!parcForm.descricao?.trim()) errs.descricao = "Descrição obrigatória";
    if (!parcForm.valorTotal || parseFloat(parcForm.valorTotal) <= 0) errs.valorTotal = "Valor total deve ser positivo";
    const tp = parseInt(parcForm.totalParcelas);
    if (isNaN(tp) || tp < 1 || tp > 360) errs.totalParcelas = "Entre 1 e 360 parcelas";
    if (!parcForm.cartaoId) errs.cartaoId = "Escolha um cartão";

    setParcErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }

    const data = {
      ...parcForm,
      valorTotal: parseFloat(parcForm.valorTotal),
      totalParcelas: tp,
      parcelasPagas: parcForm.parcelasPagas || [],
    };
    if (parcForm.id && parcelamentos.find(p => p.id === parcForm.id)) {
      setParcelamentos(parcelamentos.map(p => p.id === parcForm.id ? data : p));
    } else {
      setParcelamentos([...parcelamentos, { ...data, id: uid() }]);
    }
    setParcForm(null);
  };

  const toggleParcela = (parc, num) => {
    const set = new Set(parc.parcelasPagas || []);
    if (set.has(num)) set.delete(num); else set.add(num);
    setParcelamentos(parcelamentos.map(p => p.id === parc.id ? { ...p, parcelasPagas: Array.from(set).sort((a,b)=>a-b) } : p));
  };

  // ============================
  // Pagamento de fatura
  // ============================
  // Pré-preenche o modal com a soma das parcelas do mês corrente que AINDA não estão marcadas como pagas.
  // Calcula as parcelas (não pagas) de um cartão que vencem na competência (YYYY-MM).
  const parcelasDaCompetencia = (cartaoId, monthKey) => {
    const [cy, cm] = monthKey.split("-").map(Number);
    let valorSugerido = 0;
    const parcelasDoMes = [];
    parcelamentos.filter(p => p.cartaoId === cartaoId).forEach(p => {
      const valorParcela = p.valorTotal / p.totalParcelas;
      for (let n = 1; n <= p.totalParcelas; n++) {
        const dt = dataDaParcela(p, n);
        if (!dt) continue;
        if (dt.getFullYear() === cy && dt.getMonth() + 1 === cm) {
          if (!(p.parcelasPagas || []).includes(n)) {
            valorSugerido += valorParcela;
            parcelasDoMes.push({ parcId: p.id, parcDescricao: p.descricao, parcN: n, valor: valorParcela });
          }
        }
      }
    });
    return { valorSugerido, parcelasDoMes };
  };

  const openPagamento = (cartao) => {
    const now = new Date();
    // Se há fatura importada em aberto, paga por ELA (valor real da fatura) e
    // na competência dela; senão, cai no modelo de parcelas do mês corrente.
    const fi = cartao.faturaImportada && !cartao.faturaImportada.paga ? cartao.faturaImportada : null;
    const monthKey = fi?.competencia
      || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const { valorSugerido, parcelasDoMes } = parcelasDaCompetencia(cartao.id, monthKey);
    const valor = fi ? Number(fi.valorTotal).toFixed(2)
      : (valorSugerido > 0 ? valorSugerido.toFixed(2) : "");
    setPagFatura({
      cartaoId: cartao.id,
      cartaoNome: cartao.nome,
      valor,
      contaNome: contas?.[0]?.nome || "",
      data: todayISO(),
      monthKey,
      parcelasDoMes,
      faturaImportada: !!fi,
    });
    setPagErrors({});
  };

  // Troca a competência (mês) da fatura e recalcula valor + parcelas cobertas.
  const mudarCompetenciaPagamento = (monthKey) => {
    setPagFatura(prev => {
      if (!prev) return prev;
      const { valorSugerido, parcelasDoMes } = parcelasDaCompetencia(prev.cartaoId, monthKey);
      return { ...prev, monthKey, parcelasDoMes, valor: valorSugerido > 0 ? valorSugerido.toFixed(2) : prev.valor };
    });
  };

  // Limpa lançamentos de fatura criados pelo modelo antigo: cópias de parcela
  // (que agora vivem no parcelamento) e pagamentos que cobriram 0 parcelas.
  const limparDuplicadosFatura = async () => {
    const ehParcelaImportada = (t) => (t.origem || "").startsWith("fatura-") && /^Parcela\s/.test(t.obs || "");
    const ehPagamentoVazio = (t) => /Pagamento de fatura — 0 parcela/.test(t.obs || "");
    const alvos = (transacoes || []).filter(t => ehParcelaImportada(t) || ehPagamentoVazio(t));
    if (alvos.length === 0) { toast.info("Nenhum lançamento de fatura duplicado encontrado."); return; }
    const ok = await confirm({
      title: `Limpar ${alvos.length} lançamento(s) de fatura?`,
      body: "Remove as cópias de parcela criadas por importações antigas (as parcelas continuam no parcelamento) e pagamentos de fatura que cobriram 0 parcelas. Os saldos das contas afetadas são ajustados.",
      danger: true, confirmLabel: "Limpar",
    });
    if (!ok) return;
    const ajustes = {};
    alvos.forEach(t => { if (t.conta) ajustes[t.conta] = (ajustes[t.conta] || 0) + Number(t.valor || 0); });
    const ids = new Set(alvos.map(t => t.id));
    const backup = transacoes;
    setTransacoes((transacoes || []).filter(t => !ids.has(t.id)));
    if (Object.keys(ajustes).length && typeof setContas === "function") {
      setContas((contas || []).map(c => ajustes[c.nome] ? { ...c, saldo: (Number(c.saldo) || 0) + ajustes[c.nome] } : c));
    }
    toast.success(`${alvos.length} lançamento(s) de fatura removido(s).`, {
      action: { label: "Desfazer", onClick: () => setTransacoes(backup) },
    });
  };

  // Exclui TUDO que veio da importação da fatura DESTE cartão: transações à
  // vista, parcelamentos, fixas (+ ocorrências pendentes) e zera a fatura
  // importada. Identifica pela tag origem "fatura-<banco>" (transações e
  // parcelamentos) e pelo obs "Importado da fatura <banco>" (fixas).
  // Não toca em lançamentos criados à mão. Saldos das contas são devolvidos.
  const normTxt = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const excluirLancamentosDaFatura = async (cartao) => {
    // Origens "fatura-*" amarradas a este cartão (via cartaoId).
    const origens = new Set();
    (parcelamentos || []).forEach(p => {
      if (p.cartaoId === cartao.id && typeof p.origem === "string" && p.origem.startsWith("fatura-")) origens.add(p.origem);
    });
    (transacoes || []).forEach(t => {
      if (t.cartaoId === cartao.id && typeof t.origem === "string" && t.origem.startsWith("fatura-")) origens.add(t.origem);
    });
    // Bancos candidatos (casar fixas/1ª-tx sem cartaoId): nome e banco do cartão + os já achados.
    const bancosNorm = [...new Set([
      ...[...origens].map(o => o.replace(/^fatura-/, "")),
      cartao.nome, cartao.banco,
    ])].map(normTxt).filter(Boolean);

    const origemCasaFatura = (origem) => {
      if (typeof origem !== "string" || !origem.startsWith("fatura-")) return false;
      if (origens.has(origem)) return true;
      const b = normTxt(origem.replace(/^fatura-/, ""));
      return bancosNorm.some(x => x && (b.includes(x) || x.includes(b)));
    };
    const obsCasaFatura = (obs) => {
      const o = normTxt(obs);
      if (!o.startsWith("importado da fatura")) return false;
      return bancosNorm.some(x => x && o.includes(x));
    };

    const txAlvo = (transacoes || []).filter(t =>
      (t.cartaoId === cartao.id && typeof t.origem === "string" && t.origem.startsWith("fatura-"))
      || origemCasaFatura(t.origem)
      || obsCasaFatura(t.obs));
    const parcAlvo = (parcelamentos || []).filter(p =>
      p.cartaoId === cartao.id && typeof p.origem === "string" && p.origem.startsWith("fatura-"));
    const fixaAlvo = (fixas || []).filter(f =>
      origemCasaFatura(f.origem) || obsCasaFatura(f.obs));

    const total = txAlvo.length + parcAlvo.length + fixaAlvo.length;
    if (total === 0 && !cartao.faturaImportada) {
      toast.info("Nenhum lançamento de fatura encontrado para este cartão.");
      return;
    }

    const ok = await confirm({
      title: `Excluir lançamentos da fatura de "${cartao.nome}"?`,
      body: `Remove ${txAlvo.length} transação(ões), ${parcAlvo.length} parcelamento(s) e ${fixaAlvo.length} fixa(s) que vieram da importação da fatura${cartao.faturaImportada ? ", e zera a fatura importada" : ""}. Ocorrências de fixa já pagas e lançamentos criados à mão são preservados. Saldos das contas são devolvidos.`,
      danger: true, confirmLabel: "Excluir tudo",
    });
    if (!ok) return;

    // Backups para Desfazer
    const backupTx = transacoes, backupParc = parcelamentos, backupFixas = fixas,
          backupOcc = fixaOcorrencias, backupContas = contas, backupCartoes = cartoes;

    // Devolve saldo das contas tocadas pelas transações removidas
    const ajustes = {};
    txAlvo.forEach(t => { if (t.conta) ajustes[t.conta] = (ajustes[t.conta] || 0) + Number(t.valor || 0); });

    const txIds = new Set(txAlvo.map(t => t.id));
    const parcIds = new Set(parcAlvo.map(p => p.id));
    const fixaIds = new Set(fixaAlvo.map(f => f.id));

    if (typeof setTransacoes === "function") setTransacoes((transacoes || []).filter(t => !txIds.has(t.id)));
    if (typeof setParcelamentos === "function") setParcelamentos((parcelamentos || []).filter(p => !parcIds.has(p.id)));
    if (typeof setFixas === "function") setFixas((fixas || []).filter(f => !fixaIds.has(f.id)));
    if (typeof setFixaOcorrencias === "function") {
      // Mantém só as ocorrências de fixas que SOBREVIVEM. Assim remove as das
      // fixas apagadas (inclusive pagas) e também purga órfãs antigas — pra não
      // continuarem aparecendo no controle anual.
      const fixasVivas = new Set((fixas || []).filter(f => !fixaIds.has(f.id)).map(f => f.id));
      setFixaOcorrencias((fixaOcorrencias || []).filter(o => fixasVivas.has(o.fixaId)));
    }
    if (Object.keys(ajustes).length && typeof setContas === "function") {
      setContas((contas || []).map(c => ajustes[c.nome] ? { ...c, saldo: (Number(c.saldo) || 0) + ajustes[c.nome] } : c));
    }
    if (cartao.faturaImportada && typeof setCartoes === "function") {
      setCartoes((cartoes || []).map(c => c.id === cartao.id ? { ...c, faturaImportada: null } : c));
    }

    toast.success(`Lançamentos da fatura de ${cartao.nome} removidos (${total}).`, {
      duration: 6000,
      action: {
        label: "Desfazer",
        onClick: () => {
          setTransacoes(backupTx); setParcelamentos(backupParc);
          if (setFixas) setFixas(backupFixas);
          if (setFixaOcorrencias) setFixaOcorrencias(backupOcc);
          setContas(backupContas); setCartoes(backupCartoes);
        },
      },
    });
  };

  const executarPagamento = () => {
    if (!pagFatura) return;
    const errs = {};
    const v = parseFloat(pagFatura.valor);
    if (!pagFatura.valor || isNaN(v) || v <= 0) errs.valor = "Valor deve ser positivo";
    if (!pagFatura.contaNome) errs.contaNome = "Selecione a conta";
    if (!pagFatura.data) errs.data = "Informe a data";

    setPagErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }

    const cartao = cartoes.find(c => c.id === pagFatura.cartaoId);
    const conta = contas?.find(c => c.nome === pagFatura.contaNome);
    if (!cartao || !conta) {
      toast.error("Cartão ou conta não encontrados.");
      return;
    }

    // Backups para Desfazer
    const backupContas = contas;
    const backupTransacoes = transacoes;
    const backupParcelamentos = parcelamentos;

    // Itens à vista da fatura importada entram PENDENTES na importação. Ao pagar,
    // viram "pagos" e o débito acontece aqui (como transferência) — sem criar uma
    // despesa consolidada nova (as despesas reais são os próprios itens),
    // evitando duplicar nas transações. Faturas não importadas mantêm o modelo.
    const ehImportada = !!pagFatura.faturaImportada;
    const idsPagar = ehImportada
      ? new Set(
          (transacoes || [])
            .filter(t =>
              !t.compensado &&
              t.cartaoId === pagFatura.cartaoId &&
              String(t.origem || "").startsWith("fatura-") &&
              String(t.data || "").slice(0, 7) === pagFatura.monthKey
            )
            .map(t => t.id)
        )
      : new Set();

    // 1. Cria a transação do PAGAMENTO da fatura (a "baixa" visível na conta).
    //    Para fatura importada ela é uma transferência (origem "fatura-pagamento")
    //    e NÃO conta como despesa — os itens importados é que são as despesas.
    const novaTransacao = {
      id: uid(),
      tipo: "despesa",
      descricao: `Pagamento fatura ${cartao.nome} · ${pagFatura.monthKey}`,
      valor: v,
      categoria: categorias?.find(c => /cart[ãa]o|fatura/i.test(c.nome))?.nome || categorias?.filter(c => c.tipo === "despesa")?.[0]?.nome || "Outros",
      conta: conta.nome,
      data: pagFatura.data,
      compensado: true,
      cartaoId: pagFatura.cartaoId,
      ...(ehImportada ? { origem: "fatura-pagamento", faturaCompetencia: pagFatura.monthKey } : {}),
      obs: ehImportada
        ? "Pagamento da fatura (baixa) — os itens importados é que contam como despesa"
        : `Pagamento de fatura — ${pagFatura.parcelasDoMes.length} parcela(s) cobertas`,
    };

    // 2. Debita conta
    setContas(contas.map(c => c.id === conta.id ? { ...c, saldo: c.saldo - v } : c));

    // 3. Marca parcelas como pagas
    const parcelasPorParcId = {};
    pagFatura.parcelasDoMes.forEach(pp => {
      (parcelasPorParcId[pp.parcId] = parcelasPorParcId[pp.parcId] || []).push(pp.parcN);
    });
    setParcelamentos(parcelamentos.map(p => {
      if (!parcelasPorParcId[p.id]) return p;
      const newPagas = new Set([...(p.parcelasPagas || []), ...parcelasPorParcId[p.id]]);
      return { ...p, parcelasPagas: Array.from(newPagas).sort((a, b) => a - b) };
    }));

    // Se era a fatura importada, marca como paga (some o botão, vira "paga").
    if (pagFatura.faturaImportada) {
      setCartoes(cartoes.map(c => c.id === pagFatura.cartaoId && c.faturaImportada
        ? { ...c, faturaImportada: { ...c.faturaImportada, paga: true } }
        : c));
    }

    // 4. Aplica nas transações: adiciona a baixa (pagamento) e, na importada,
    //    marca também os itens da fatura como pagos.
    if (ehImportada) {
      setTransacoes([
        novaTransacao,
        ...(transacoes || []).map(t =>
          idsPagar.has(t.id) ? { ...t, compensado: true } : t),
      ]);
    } else {
      setTransacoes([novaTransacao, ...transacoes]);
    }

    setPagFatura(null);
    setPagErrors({});
    toast.success(`Fatura de ${cartao.nome} paga: ${fmt(v)}.`, {
      duration: 6000,
      action: {
        label: "Desfazer",
        onClick: () => {
          setContas(backupContas);
          setTransacoes(backupTransacoes);
          setParcelamentos(backupParcelamentos);
        },
      },
    });
  };

  // Estorna o pagamento de uma fatura importada: devolve o valor à conta,
  // remove a baixa, volta os itens a pendentes, desmarca as parcelas do mês e
  // marca a fatura como NÃO paga. Os lançamentos importados são mantidos.
  const estornarFatura = async (cartao) => {
    const fi = cartao?.faturaImportada;
    if (!fi || !fi.paga) { toast.info("Esta fatura não está paga."); return; }
    const comp = fi.competencia;

    // Baixa(s) do pagamento desta fatura (origem fatura-pagamento + cartão + competência).
    const pagamentos = (transacoes || []).filter(t =>
      t.origem === "fatura-pagamento" && t.cartaoId === cartao.id &&
      (t.faturaCompetencia === comp || String(t.data || "").slice(0, 7) === comp));
    const totalDevolver = pagamentos.reduce((s, t) => s + (Number(t.valor) || 0), 0);

    const ok = await confirm({
      title: `Estornar pagamento da fatura de ${cartao.nome}?`,
      body: `Devolve ${fmt(totalDevolver)} à conta, volta os itens a pendentes e marca a fatura como NÃO paga. Os lançamentos importados são mantidos.`,
      danger: true, confirmLabel: "Estornar",
    });
    if (!ok) return;

    const backup = { contas, transacoes, parcelamentos, cartoes };

    // 1. Devolve o valor à(s) conta(s) da baixa e remove a baixa.
    const ajustes = {};
    pagamentos.forEach(t => { if (t.conta) ajustes[t.conta] = (ajustes[t.conta] || 0) + (Number(t.valor) || 0); });
    if (Object.keys(ajustes).length && typeof setContas === "function") {
      setContas((contas || []).map(c => ajustes[c.nome] ? { ...c, saldo: (Number(c.saldo) || 0) + ajustes[c.nome] } : c));
    }
    const pagIds = new Set(pagamentos.map(t => t.id));

    // 2. Volta os itens importados deste cartão/competência a PENDENTES e remove a baixa.
    setTransacoes((transacoes || [])
      .filter(t => !pagIds.has(t.id))
      .map(t => (
        String(t.origem || "").startsWith("fatura-") && t.origem !== "fatura-pagamento" &&
        t.cartaoId === cartao.id && String(t.data || "").slice(0, 7) === comp
      ) ? { ...t, compensado: false } : t));

    // 3. Desmarca as parcelas do mês que tinham sido pagas pela fatura.
    const { parcelasDoMes } = parcelasDaCompetencia(cartao.id, comp);
    const porParc = {};
    parcelasDoMes.forEach(pp => { (porParc[pp.parcId] = porParc[pp.parcId] || []).push(pp.parcN); });
    if (Object.keys(porParc).length) {
      setParcelamentos((parcelamentos || []).map(p => {
        if (!porParc[p.id]) return p;
        const rem = new Set(porParc[p.id]);
        return { ...p, parcelasPagas: (p.parcelasPagas || []).filter(n => !rem.has(n)) };
      }));
    }

    // 4. Marca a fatura como NÃO paga (volta o botão "Pagar fatura").
    setCartoes((cartoes || []).map(c => c.id === cartao.id && c.faturaImportada
      ? { ...c, faturaImportada: { ...c.faturaImportada, paga: false } }
      : c));

    toast.success(`Pagamento da fatura de ${cartao.nome} estornado · ${fmt(totalDevolver)} devolvido.`, {
      duration: 6000,
      action: {
        label: "Desfazer", onClick: () => {
          setContas(backup.contas); setTransacoes(backup.transacoes);
          setParcelamentos(backup.parcelamentos); setCartoes(backup.cartoes);
        },
      },
    });
  };

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Capítulo III"
        title="Cartões"
        sub="Limites, fechamentos e parcelamentos sob controle."
        action={
          <div className="flex gap-2 flex-wrap">
            <button className="btn-ghost" onClick={limparDuplicadosFatura}
                    title="Remove cópias de parcela e pagamentos vazios criados por importações antigas">
              <Trash2 size={12} className="inline mr-2" />Limpar duplicados
            </button>
            <button className="btn-ghost" onClick={() => setParcForm({ id: null, descricao: "", dataCompra: todayISO(), dataPrimeira: todayISO(), cartaoId: cartoes[0]?.id || "", valorTotal: "", totalParcelas: "", categoria: "", escopo: "pessoal", parcelasPagas: [] })}>
              <Plus size={12} className="inline mr-2" />Parcelamento
            </button>
            <button className="btn-gold" onClick={() => setForm({ id: null, nome: "", banco: "outro", limite: "", vencimento: 5, fechamento: 28, tipo: "principal", tags: [], ativo: true })}>
              <Plus size={14} className="inline mr-2" />Novo Cartão
            </button>
          </div>
        }
      />

      {/* Stats — sem limite (a pedido): foco no que se paga no mês */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-px mb-8" style={{ background: T.border }}>
        <StatCard label="A pagar no mês" value={hidden ? "•••••" : fmt(cartoes.reduce((s, c) => s + valorAPagarMes(c, parcelamentos), 0))} accent={T.gold} icon={CreditCard} sub={`${cartoes.length} cartões`} />
        <StatCard label="Comprometido (total)" value={hidden ? "•••••" : fmt(totalUsado)} accent={T.red} icon={TrendingDown} sub="soma de todas as parcelas" />
        <StatCard label="Parcelamentos ativos" value={String(parcelamentos.filter(p => (p.parcelasPagas?.length || 0) < p.totalParcelas).length)}
                  accent={T.blue} icon={Repeat} />
      </div>

      {/* Lista de cartões — recolhida por padrão */}
      <SecaoColapsavel idKey="cartoes-lista" titulo="Meus cartões" count={cartoes.length} defaultAberto={false}>
      {/* Visual cards · empilhados verticalmente (lista) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 12,
        marginBottom: 30,
      }}>
        {cartoes.map(c => {
          // If c.banco is "custom", use c.bandeiraCustom; otherwise look up in BANK_BRANDS
          const brand = c.banco === "custom" && c.bandeiraCustom
            ? c.bandeiraCustom
            : (BANK_BRANDS[c.banco] || BANK_BRANDS.outro);
          const parcAtivas = parcelasAtivasDoCartao(c, parcelamentos);
          // "Restante" = tudo que ainda falta pagar (todas as parcelas em aberto).
          const usado = parcAtivas.reduce((s, p) => {
            const restantes = (p.totalParcelas || 0) - (p.parcelasPagas?.length || 0);
            return s + valorDaParcela(p) * restantes;
          }, 0);
          const exp = expandedCart.has(c.id);
          const ativaCard = cartaoAtivo?.id === c.id;
          // Valor a pagar do MÊS = fatura importada (à vista + fixas + parcelas)
          // se houver e não estiver paga; senão, soma das parcelas do mês.
          const fiPaga = !!(c.faturaImportada && c.faturaImportada.paga);
          const parcelasMes = faturaMensalDoCartao(c, parcelamentos);
          const aPagar = valorAPagarMes(c, parcelamentos);
          // Diferença = compras à vista + fixas da fatura (o que não é parcela).
          const extrasMes = Math.max(0, aPagar - parcelasMes);
          return (
            <div key={c.id}
                 style={{
                   background: ativaCard ? `${T.gold}10` : T.card,
                   border: `1px solid ${ativaCard ? T.gold : T.border}`,
                   borderLeft: `4px solid ${brand.bg}`,
                   borderRadius: 6, overflow: "hidden",
                   transition: "all .15s",
                 }}>
              {/* Linha principal — pai */}
              <div onClick={() => onCartaoClick && onCartaoClick({ ...c, usado, faturaAtual: aPagar })}
                   style={{
                     display: "flex", alignItems: "center", gap: 10,
                     padding: "10px 12px",
                     cursor: onCartaoClick ? "pointer" : "default",
                   }}>
                <CreditCard size={16} style={{ color: T.muted, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                  <div style={{ fontSize: 10, color: T.muted }}>
                    {fiPaga
                      ? <span style={{ color: T.green }}>Fatura do mês paga</span>
                      : aPagar > 0
                        ? <>A pagar <span className="num" style={{ color: T.gold, fontWeight: 600 }}>{hidden ? "•••" : fmt(aPagar)}</span>{usado > 0 && <> · Restante <span className="num">{hidden ? "•••" : fmt(usado)}</span></>}</>
                        : <span>Sem fatura no mês</span>}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); toggleExpandedCart(c.id); }}
                        aria-label={exp ? "Recolher" : "Mais ações"}
                        style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", padding: 4, lineHeight: 0 }}>
                  <ChevronDown size={16} style={{ transform: exp ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                </button>
              </div>
              {/* Filhos — expandido */}
              {exp && (
                <div style={{ padding: "8px 12px 10px", borderTop: `1px dashed ${T.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, flexWrap: "wrap", gap: 6 }}>
                    <span><Calendar size={11} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />Vence <strong style={{ color: T.ink }}>{c.vencimento}</strong></span>
                    <span>Fecha <strong style={{ color: T.ink }}>{c.fechamento || "—"}</strong></span>
                    {fiPaga
                      ? <span>Fatura do mês <strong style={{ color: T.green }}>paga</strong></span>
                      : aPagar > 0 && (
                        <span>Fatura do mês <strong style={{ color: T.gold }} className="num">{hidden ? "•••" : fmt(aPagar)}</strong> · a pagar</span>
                      )}
                  </div>
                  <ParcelasDoCartao
                    cartao={c}
                    parcelamentos={parcelamentos}
                    extras={extrasMes}
                    brand={{ ...brand, fg: T.ink }}
                    hidden={hidden}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    {aPagar > 0 ? (
                      <button onClick={(e) => { e.stopPropagation(); openPagamento(c); }}
                              style={{
                                flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: 600,
                                letterSpacing: ".05em", textTransform: "uppercase",
                                borderRadius: 4, background: T.gold,
                                border: "none", color: T.bg, cursor: "pointer",
                              }}>
                        Pagar fatura
                      </button>
                    ) : fiPaga ? (
                      <button onClick={(e) => { e.stopPropagation(); estornarFatura(c); }}
                        title="Estornar o pagamento desta fatura"
                        style={{
                          flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: 700,
                          letterSpacing: ".05em", textTransform: "uppercase",
                          borderRadius: 4, background: `${T.green}22`, border: `1px solid ${T.green}`,
                          color: T.green, cursor: "pointer",
                          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                        }}>
                        <Check size={11} /> Paga · estornar
                      </button>
                    ) : null}
                    <button onClick={(e) => { e.stopPropagation(); setForm(c); }}
                            style={{
                              flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: 600,
                              letterSpacing: ".05em", textTransform: "uppercase",
                              borderRadius: 4, background: "transparent",
                              border: `1px solid ${T.border}`, color: T.muted, cursor: "pointer",
                              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                            }}>
                      <Edit3 size={11} /> Editar
                    </button>
                    <button onClick={async (e) => {
                                e.stopPropagation();
                                const ok = await confirm({
                                  title: `Excluir "${c.nome}"?`, danger: true, confirmLabel: "Excluir",
                                  body: "Parcelamentos vinculados perderão a referência.",
                                });
                                if (!ok) return;
                                setCartoes(cartoes.filter(x => x.id !== c.id));
                                toast.success(`${c.nome} excluído.`);
                              }}
                            style={{
                              flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: 600,
                              letterSpacing: ".05em", textTransform: "uppercase",
                              borderRadius: 4, background: "transparent",
                              border: `1px solid ${T.red}33`, color: T.red, cursor: "pointer",
                              display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                            }}>
                      <Trash2 size={11} /> Excluir
                    </button>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); excluirLancamentosDaFatura(c); }}
                          title="Remove transações, parcelamentos e fixas que vieram da importação da fatura deste cartão"
                          style={{
                            width: "100%", marginTop: 6, padding: "5px 8px", fontSize: 9.5, fontWeight: 600,
                            letterSpacing: ".05em", textTransform: "uppercase",
                            borderRadius: 4, background: "transparent",
                            border: `1px dashed ${T.red}55`, color: T.red, cursor: "pointer",
                            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                          }}>
                    <Trash2 size={11} /> Excluir lançamentos da fatura
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {cartoes.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 text-center py-12" style={{ color: T.muted, fontStyle: "italic" }}>
            Nenhum cartão cadastrado.
          </div>
        )}
      </div>
      </SecaoColapsavel>

      {/* Parcelamentos table */}
      <section style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }}>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <div>
            <div className="label-eyebrow">Parcelamentos</div>
            <h3 style={{ fontFamily: T.serif, fontSize: 24, color: T.ink, marginTop: 4, fontWeight: 600 }}>
              Compras parceladas em curso
            </h3>
          </div>
        </div>
        {parcelamentos.length === 0 ? (
          <div className="py-8 text-center" style={{ color: T.muted, fontStyle: "italic" }}>
            Nenhum parcelamento cadastrado. Toque em "Parcelamento" no topo para adicionar.
          </div>
        ) : (
          <div className="space-y-4">
            {(() => {
              // Agrupa parcelamentos por cartão (na ordem dos cartões; "Outros" no fim).
              const grupos = [];
              const idxPorChave = {};
              const chaveDe = (p) => p.cartaoId || `nome:${p.cartaoNome || "—"}`;
              cartoes.forEach(c => { idxPorChave[c.id] = grupos.length; grupos.push({ chave: c.id, cartao: c, nome: c.nome, itens: [] }); });
              parcelamentos.forEach(p => {
                const ch = chaveDe(p);
                if (!(ch in idxPorChave)) {
                  idxPorChave[ch] = grupos.length;
                  grupos.push({ chave: ch, cartao: null, nome: p.cartaoNome || "Cartão removido", itens: [] });
                }
                grupos[idxPorChave[ch]].itens.push(p);
              });
              const comItens = grupos.filter(g => g.itens.length > 0);
              return comItens.map(grupo => {
                // Total que FALTA pagar no grupo (restante = parcelas ainda não pagas).
                const totalGrupo = grupo.itens.reduce((s, p) => {
                  const valorParc = p.valorParcela || (p.totalParcelas ? (Number(p.valorTotal) || 0) / p.totalParcelas : 0);
                  const pagas = (p.parcelasPagas || []).length;
                  const restantes = Math.max(0, (p.totalParcelas || 0) - pagas);
                  return s + valorParc * restantes;
                }, 0);
                const abertoPadrao = false; // sempre começa fechado
                const aberto = grupo.chave in parcGrupoOverride ? parcGrupoOverride[grupo.chave] : abertoPadrao;
                return (
                  <div key={grupo.chave}>
                    {/* Cabeçalho do cartão (clicável: recolhe/expande as compras) */}
                    <div onClick={() => toggleParcGrupo(grupo.chave, abertoPadrao)}
                         style={{
                           display: "flex", justifyContent: "space-between", alignItems: "center",
                           padding: "10px 12px", background: T.bgSoft, border: `1px solid ${T.border}`,
                           cursor: "pointer", gap: 8,
                         }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <ChevronDown size={15} style={{ color: T.muted, transform: aberto ? "none" : "rotate(-90deg)", transition: "transform .15s", flexShrink: 0 }} />
                        <CreditCard size={14} style={{ color: T.gold, flexShrink: 0 }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{grupo.nome}</span>
                        <span style={{ fontSize: 11, color: T.faint }}>· {grupo.itens.length} {grupo.itens.length === 1 ? "compra" : "compras"}</span>
                      </span>
                      <span className="num" style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: "nowrap" }}>
                        {hidden ? "•••" : fmt(totalGrupo)} <span style={{ fontSize: 9.5, color: T.faint, fontWeight: 500 }}>a pagar</span>
                      </span>
                    </div>
                    {/* Compras do cartão (escondidas quando recolhido) */}
                    {aberto && (
                    <div className="space-y-2" style={{ marginTop: 6 }}>
                    {grupo.itens.map(p => {
              const valorParcela = p.valorTotal / p.totalParcelas;
              const pagas = p.parcelasPagas?.length || 0;
              const pctPago = (pagas / p.totalParcelas) * 100;
              const restante = p.valorTotal - (pagas * valorParcela);
              return (
                <div key={p.id} style={{ background: T.bgSoft, border: `1px solid ${T.border}`, padding: 10 }}>
                  <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div style={{ color: T.ink, fontSize: 14, fontWeight: 600 }}>{p.descricao}</div>
                      <div className="flex gap-2 mt-1 flex-wrap text-xs" style={{ color: T.muted }}>
                        <span style={{ background: `${T.gold}22`, color: T.gold, padding: "2px 8px", letterSpacing: "0.1em", textTransform: "uppercase", fontSize: 10, fontWeight: 500 }}>
                          {cartoes.find(c => c.id === p.cartaoId)?.nome || p.cartaoNome || "Cartão removido"}
                        </span>
                        <span className="num">Compra {p.dataCompra}</span>
                        <span>·</span>
                        <span className="num">1ª parc {p.dataPrimeira}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="num" style={{ color: T.ink, fontSize: 14.5, fontWeight: 600 }}>
                        {hidden ? "•••" : fmt(p.valorTotal)}
                      </div>
                      <div className="num text-xs" style={{ color: T.muted }}>
                        {p.totalParcelas}× de {hidden ? "•••" : fmt(valorParcela)}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setParcForm(p)} style={{ color: T.muted, padding: 4 }}>
                        <Edit3 size={14} />
                      </button>
                      <button onClick={async () => {
                                const ok = await confirm({
                                  title: `Excluir "${p.descricao}"?`,
                                  danger: true, confirmLabel: "Excluir",
                                });
                                if (ok) {
                                  setParcelamentos(parcelamentos.filter(x => x.id !== p.id));
                                  toast.success(`${p.descricao} excluído.`);
                                }
                              }}
                              style={{ color: T.red, padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex justify-between text-xs mb-1" style={{ color: T.muted }}>
                    <span>{pagas} de {p.totalParcelas} pagas</span>
                    <span className="num">Restam {hidden ? "•••" : fmt(restante)}</span>
                  </div>
                  <div style={{ background: T.border, height: 6, marginBottom: 12 }}>
                    <div style={{ width: `${pctPago}%`, background: T.green, height: "100%", transition: "width 0.6s" }} />
                  </div>

                  {/* Parcela checkboxes — verde paga · amarelo atual · cinza futura */}
                  <div className="parcelas-grid" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {Array.from({ length: p.totalParcelas }, (_, i) => i + 1).map(num => {
                      const paga = (p.parcelasPagas || []).includes(num);
                      // Calcula data de cada parcela usando o mesmo helper da fatura
                      let dataParcela = "";
                      let isAtual = false;
                      const dt = dataDaParcela(p, num);
                      if (dt) {
                        const y = dt.getFullYear();
                        const mo = String(dt.getMonth() + 1).padStart(2, "0");
                        const d = String(dt.getDate()).padStart(2, "0");
                        dataParcela = `${y}-${mo}-${d}`;
                        const hojeYM = new Date().toISOString().slice(0, 7);
                        isAtual = dataParcela.startsWith(hojeYM) && !paga;
                      }
                      const cor = paga ? T.green : isAtual ? T.gold : T.border;
                      const bg  = paga ? T.green : isAtual ? `${T.gold}22` : "transparent";
                      const fg  = paga ? T.bg    : isAtual ? T.gold        : T.muted;
                      return (
                        <button key={num} onClick={() => toggleParcela(p, num)}
                          title={`Parcela ${num}ª · ${dataParcela ? `vence ${dataParcela.slice(8,10)}/${dataParcela.slice(5,7)}/${dataParcela.slice(0,4)} · ` : ""}${fmt(valorParcela)}${isAtual ? " · ATUAL" : ""}`}
                          style={{
                            minWidth: 54, minHeight: 48, padding: "9px 6px",
                            background: bg, color: fg,
                            border: `1px solid ${cor}`,
                            borderRadius: 8,
                            cursor: "pointer",
                            display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            fontFamily: T.mono, fontWeight: 600,
                          }}>
                          <div style={{ fontSize: 15 }}>{paga ? "✅" : isAtual ? "⏰" : "⬜"}</div>
                          <div style={{ fontSize: 9, marginTop: 2, letterSpacing: ".05em", textTransform: "uppercase" }}>
                            {num}ª {isAtual ? "· hoje" : ""}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
                    </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}
      </section>

      {/* Card form modal */}
      {form && (
        <Modal title={form.id ? "Editar Cartão" : "Novo Cartão"} onClose={() => setForm(null)}>
          <Field label="Nome do cartão" required error={formErrors.nome}>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Bradesco Click" />
          </Field>
          <Field label="Banco / Bandeira">
            <select value={form.banco} onChange={e => {
              const v = e.target.value;
              setForm({
                ...form,
                banco: v,
                bandeiraCustom: v === "custom"
                  ? (form.bandeiraCustom || { nome: form.nome || "Personalizado", bg: `linear-gradient(135deg, ${T.gold} 0%, ${T.goldHi || "#8a7140"} 100%)`, fg: "#ffffff", cor1: T.gold, cor2: "#8a7140", fgColor: "#ffffff" })
                  : form.bandeiraCustom,
              });
            }}>
              {Object.entries(BANK_BRANDS).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
              <option value="custom">✨ Bandeira personalizada…</option>
            </select>
          </Field>

          {/* Custom brand editor */}
          {form.banco === "custom" && (
            <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, padding: 14, marginTop: -8, marginBottom: 16 }}>
              <div className="label-eyebrow mb-3">Personalizar bandeira</div>
              <Field label="Nome a exibir">
                <input value={form.bandeiraCustom?.nome || ""}
                       onChange={e => setForm({ ...form, bandeiraCustom: { ...form.bandeiraCustom, nome: e.target.value } })}
                       placeholder="Ex.: Will Bank · BTG · Empresarial" />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Cor 1 (escura)">
                  <input type="color" value={form.bandeiraCustom?.cor1 || "#c9a96b"}
                         onChange={e => {
                           const cor1 = e.target.value;
                           const cor2 = form.bandeiraCustom?.cor2 || "#8a7140";
                           setForm({
                             ...form,
                             bandeiraCustom: {
                               ...form.bandeiraCustom,
                               cor1,
                               bg: `linear-gradient(135deg, ${cor1} 0%, ${cor2} 100%)`,
                             },
                           });
                         }}
                         style={{ width: "100%", height: 44, padding: 2, cursor: "pointer" }} />
                </Field>
                <Field label="Cor 2 (clara)">
                  <input type="color" value={form.bandeiraCustom?.cor2 || "#8a7140"}
                         onChange={e => {
                           const cor1 = form.bandeiraCustom?.cor1 || "#c9a96b";
                           const cor2 = e.target.value;
                           setForm({
                             ...form,
                             bandeiraCustom: {
                               ...form.bandeiraCustom,
                               cor2,
                               bg: `linear-gradient(135deg, ${cor1} 0%, ${cor2} 100%)`,
                             },
                           });
                         }}
                         style={{ width: "100%", height: 44, padding: 2, cursor: "pointer" }} />
                </Field>
                <Field label="Texto">
                  <input type="color" value={form.bandeiraCustom?.fgColor || "#ffffff"}
                         onChange={e => setForm({
                           ...form,
                           bandeiraCustom: {
                             ...form.bandeiraCustom,
                             fgColor: e.target.value,
                             fg: e.target.value,
                           },
                         })}
                         style={{ width: "100%", height: 44, padding: 2, cursor: "pointer" }} />
                </Field>
              </div>
              {/* Live preview */}
              <div style={{
                marginTop: 12, padding: 14, height: 90, borderRadius: 8,
                background: form.bandeiraCustom?.bg || "transparent",
                color: form.bandeiraCustom?.fgColor || "#fff",
                display: "flex", flexDirection: "column", justifyContent: "space-between",
              }}>
                <div style={{ fontSize: 9, opacity: 0.6, letterSpacing: "0.25em", textTransform: "uppercase" }}>Pré-visualização</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{form.bandeiraCustom?.nome || "Bandeira"}</div>
              </div>
            </div>
          )}
          <Field label="Limite (R$)" required error={formErrors.limite}>
            <input type="number" step="0.01" value={form.limite} onChange={e => setForm({ ...form, limite: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dia do vencimento" required error={formErrors.vencimento}>
              <input type="number" min="1" max="31" value={form.vencimento} onChange={e => setForm({ ...form, vencimento: e.target.value })} />
            </Field>
            <Field label="Dia do fechamento" required error={formErrors.fechamento}>
              <input type="number" min="1" max="31" value={form.fechamento} onChange={e => setForm({ ...form, fechamento: e.target.value })} />
            </Field>
          </div>
          <Field label="Tipo">
            <div className="grid grid-cols-2 gap-2">
              {[{ v: "principal", l: "Principal" }, { v: "reserva", l: "Reserva" }].map(opt => (
                <button key={opt.v} type="button" onClick={() => setForm({ ...form, tipo: opt.v })}
                  style={{
                    padding: 12, border: `1px solid ${form.tipo === opt.v ? T.gold : T.border}`,
                    background: form.tipo === opt.v ? `${T.gold}22` : "transparent",
                    color: form.tipo === opt.v ? T.gold : T.muted,
                    fontSize: 13, fontWeight: 500, letterSpacing: "0.05em",
                  }}>{opt.l}</button>
              ))}
            </div>
          </Field>
          <Field label="Benefícios (separados por vírgula)">
            <input value={(form.tags || []).join(", ")} onChange={e => setForm({ ...form, tags: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                   placeholder="Acumula pontos, Sala VIP, Cashback…" />
          </Field>
          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={saveCard}>Salvar</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* Parcelamento form modal */}
      {parcForm && (
        <Modal title={parcForm.id ? "Editar Parcelamento" : "Novo Parcelamento"} onClose={() => setParcForm(null)}>
          <Field label="Descrição" required error={parcErrors.descricao}>
            <input value={parcForm.descricao} onChange={e => setParcForm({ ...parcForm, descricao: e.target.value })} placeholder="Ex.: iPhone 15" />
          </Field>
          <Field label="Cartão" required error={parcErrors.cartaoId}>
            <select value={parcForm.cartaoId} onChange={e => setParcForm({ ...parcForm, cartaoId: e.target.value })}>
              <option value="">Selecione…</option>
              {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Categoria" hint="Como você quer ver essa parcela nos relatórios">
            <select value={parcForm.categoria || ""} onChange={e => setParcForm({ ...parcForm, categoria: e.target.value })}>
              <option value="">Sem categoria</option>
              {(categorias || []).filter(c => c.tipo !== "receita").map(c => (
                <option key={c.id} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          </Field>
          <Field label="Escopo" hint="Pessoal ou Negócio — separa nas estatísticas">
            <select value={parcForm.escopo || "pessoal"} onChange={e => setParcForm({ ...parcForm, escopo: e.target.value })}>
              <option value="pessoal">👤 Pessoal</option>
              <option value="negocio">🏢 Negócio</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data da compra">
              <input type="date" value={parcForm.dataCompra} onChange={e => setParcForm({ ...parcForm, dataCompra: e.target.value })} />
            </Field>
            <Field label="Data 1ª parcela">
              <input type="date" value={parcForm.dataPrimeira} onChange={e => setParcForm({ ...parcForm, dataPrimeira: e.target.value })} />
            </Field>
            <Field label="Valor total (R$)" required error={parcErrors.valorTotal}>
              <input type="number" step="0.01" value={parcForm.valorTotal} onChange={e => setParcForm({ ...parcForm, valorTotal: e.target.value })} />
            </Field>
            <Field label="Nº de parcelas" required error={parcErrors.totalParcelas}>
              <input type="number" min="2" max="360" value={parcForm.totalParcelas} onChange={e => setParcForm({ ...parcForm, totalParcelas: e.target.value })} />
            </Field>
          </div>
          {parcForm.valorTotal && parcForm.totalParcelas && (
            <div style={{ color: T.gold, fontSize: 13, fontStyle: "italic", marginTop: 8 }} className="num">
              {parcForm.totalParcelas}× de {fmt((parseFloat(parcForm.valorTotal) || 0) / (parseInt(parcForm.totalParcelas) || 1))}
            </div>
          )}
          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={saveParc}>Salvar</button>
            <button className="btn-ghost" onClick={() => setParcForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* Pagamento de Fatura modal */}
      {pagFatura && (() => {
        const cartao = cartoes.find(c => c.id === pagFatura.cartaoId);
        const conta = contas?.find(c => c.nome === pagFatura.contaNome);
        const valorNum = parseFloat(pagFatura.valor) || 0;
        const saldoAtual = conta?.saldo ?? 0;
        const saldoPos = saldoAtual - valorNum;
        return (
          <Modal title={`Pagar fatura · ${cartao?.nome || "?"}`} onClose={() => setPagFatura(null)}>
            <div style={{
              background: T.bgSoft, border: `1px solid ${T.border}`,
              padding: 14, marginBottom: 16,
            }}>
              <div className="flex justify-between items-center mb-2" style={{ gap: 8 }}>
                <span className="label-eyebrow">Competência da fatura</span>
                <input type="month" value={pagFatura.monthKey}
                       onChange={e => mudarCompetenciaPagamento(e.target.value)}
                       style={{ background: T.bg, color: T.ink, border: `1px solid ${T.border}`, borderRadius: 5, padding: "3px 8px", fontSize: 12 }} />
              </div>
              {pagFatura.parcelasDoMes.length === 0 ? (
                <div style={{ color: T.muted, fontSize: 13, fontStyle: "italic" }}>
                  Nenhuma parcela em aberto neste mês — você pode pagar um valor livre.
                </div>
              ) : (
                <div style={{ fontSize: 12, color: T.muted, maxHeight: 140, overflowY: "auto" }}>
                  {pagFatura.parcelasDoMes.map((pp, i) => (
                    <div key={i} className="flex justify-between" style={{ padding: "3px 0", borderBottom: i < pagFatura.parcelasDoMes.length - 1 ? `1px dashed ${T.border}` : "none" }}>
                      <span>{pp.parcDescricao} · {pp.parcN}ª</span>
                      <span className="num">{fmt(pp.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Field label="Valor a pagar (R$)" required error={pagErrors.valor}
                   hint={pagFatura.parcelasDoMes.length > 0 ? "Sugerido: soma das parcelas em aberto deste mês" : "Pagamento livre"}>
              <input type="number" step="0.01"
                     value={pagFatura.valor}
                     onChange={e => setPagFatura({ ...pagFatura, valor: e.target.value })} />
            </Field>
            <Field label="Pagar com" required error={pagErrors.contaNome}>
              <select value={pagFatura.contaNome} onChange={e => setPagFatura({ ...pagFatura, contaNome: e.target.value })}>
                <option value="">Selecione…</option>
                {contas?.map(c => <option key={c.id} value={c.nome}>{c.nome} · saldo {fmt(c.saldo)}</option>)}
              </select>
            </Field>
            <Field label="Data do pagamento" required error={pagErrors.data}>
              <input type="date" value={pagFatura.data} onChange={e => setPagFatura({ ...pagFatura, data: e.target.value })} />
            </Field>
            {conta && valorNum > 0 && (
              <div style={{
                background: saldoPos < 0 ? `${T.red}11` : `${T.green}11`,
                border: `1px solid ${saldoPos < 0 ? T.red : T.green}`,
                padding: 10, marginTop: 6, fontSize: 12,
                color: saldoPos < 0 ? T.red : T.green,
              }}>
                {saldoPos < 0 ? "⚠ " : "✓ "}
                Saldo de {conta.nome} após pagamento: <strong className="num">{fmt(saldoPos)}</strong>
              </div>
            )}
            <div style={{ background: `${T.gold}11`, border: `1px solid ${T.gold}`, padding: 10, marginTop: 8, fontSize: 11, color: T.muted, fontStyle: "italic" }}>
              ✓ Ao confirmar: cria uma despesa em Transações, debita {pagFatura.contaNome || "a conta"} e marca as parcelas listadas como pagas.
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-gold" onClick={executarPagamento}>Confirmar Pagamento</button>
              <button className="btn-ghost" onClick={() => setPagFatura(null)}>Cancelar</button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

/* ============================================================
   ParcelasDoCartao — bloco colapsável dentro do card de cartão.
   Mostra parcelamentos ativos com progressbar.
   ============================================================ */
function ParcelasDoCartao({ cartao, parcelamentos = [], extras = 0, brand, hidden }) {
  const [aberto, setAberto] = useState(false);

  // Match por cartaoId OU por nome normalizado
  const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const ativos = parcelamentos.filter(p => {
    if ((p.parcelasPagas?.length || 0) >= p.totalParcelas) return false;
    if (p.cartaoId === cartao.id) return true;
    if (norm(p.cartaoNome) === norm(cartao.nome)) return true;
    return false;
  });

  const extrasValor = Number(extras) || 0;
  if (ativos.length === 0 && extrasValor <= 0) return null;

  // Total do mês = parcelas (uma de cada) + compras à vista/fixas da fatura.
  const totalParcelas = ativos.reduce((s, p) => s + valorDaParcela(p), 0);
  const totalMes = totalParcelas + extrasValor;

  return (
    <div style={{
      borderTop: "1px solid rgba(255,255,255,0.1)",
      padding: "6px 14px",
    }}
      onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setAberto(!aberto)}
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          width: "100%", padding: "4px 0",
          color: brand.fg, opacity: 0.85,
          fontSize: 10, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase",
          display: "flex", alignItems: "center", gap: 4, justifyContent: "space-between",
        }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <CreditCard size={11} /> {ativos.length} parcelamento{ativos.length === 1 ? "" : "s"} ativo{ativos.length === 1 ? "" : "s"}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ opacity: 0.95 }}>{hidden ? "•••" : fmt(totalMes)}/mês</span>
          {aberto ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </button>

      {aberto && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingBottom: 8 }}>
          {ativos.map(p => {
            const pagas = p.parcelasPagas?.length || 0;
            const total = p.totalParcelas;
            const pct = total > 0 ? (pagas / total) * 100 : 0;
            const valorParc = valorDaParcela(p);
            return (
              <div key={p.id} style={{
                background: "rgba(0,0,0,0.25)", padding: "6px 8px", borderRadius: 5,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, marginBottom: 3, color: brand.fg }}>
                  <span style={{ fontWeight: 600, opacity: 0.95 }}>{p.descricao}</span>
                  <span style={{ opacity: 0.85 }}>
                    {pagas}/{total} · {hidden ? "•••" : fmt(valorParc)}
                  </span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.15)", height: 3, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ background: brand.fg, opacity: 0.9, width: `${pct}%`, height: "100%" }} />
                </div>
              </div>
            );
          })}
          {/* Compras à vista + fixas da fatura (o que não é parcela) */}
          {extrasValor > 0 && (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 8px", borderRadius: 5, background: "rgba(0,0,0,0.18)",
              fontSize: 10.5, color: brand.fg,
            }}>
              <span style={{ fontWeight: 600, opacity: 0.95 }}>Compras à vista + fixas</span>
              <span className="num" style={{ opacity: 0.9 }}>{hidden ? "•••" : fmt(extrasValor)}</span>
            </div>
          )}
          {/* TOTAL no final da lista */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: 2, paddingTop: 6, borderTop: `1px solid rgba(255,255,255,0.15)`,
            fontSize: 11.5, fontWeight: 700, color: brand.fg,
          }}>
            <span style={{ letterSpacing: ".04em", textTransform: "uppercase" }}>Total da fatura (mês)</span>
            <span className="num">{hidden ? "•••" : fmt(totalMes)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

