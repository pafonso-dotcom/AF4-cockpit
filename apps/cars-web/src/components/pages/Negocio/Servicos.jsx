import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, Edit3, Check, Wrench, X, ChevronDown, ChevronRight, DollarSign, TrendingUp, Repeat, Pause, Play, Receipt, HardHat, FileText, MessageCircle, AlertTriangle, Sparkles } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, uid, todayISO } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import { abrirWhatsApp } from "../../../lib/whatsapp.js";
import { toPDF } from "../../../lib/exportRelatorio.js";
import PageHeader from "../../ui/PageHeader.jsx";
import Field from "../../ui/Field.jsx";
import Modal from "../../ui/Modal.jsx";

// Catálogo pronto de serviços típicos de agência (CRM, tráfego pago, etc).
// Usado pelo botão "Serviços de agência" pra pré-popular o catálogo.
const SERVICOS_AGENCIA = [
  { nome: "Gestão de CRM", descricao: "Implantação e gestão mensal de CRM", precoSugerido: 1500, custoBase: 0 },
  { nome: "Tráfego Pago (Gestão)", descricao: "Gestão de campanhas (Meta/Google Ads) — fee mensal", precoSugerido: 1500, custoBase: 0 },
  { nome: "Social Media", descricao: "Planejamento e gestão de redes sociais", precoSugerido: 1200, custoBase: 0 },
  { nome: "Criação de Conteúdo", descricao: "Pacote mensal de posts/criativos", precoSugerido: 900, custoBase: 0 },
  { nome: "Landing Page", descricao: "Criação de página de captura/venda", precoSugerido: 1800, custoBase: 0 },
  { nome: "Criação de Site", descricao: "Site institucional ou e-commerce", precoSugerido: 3500, custoBase: 0 },
  { nome: "SEO", descricao: "Otimização para buscadores — fee mensal", precoSugerido: 1200, custoBase: 0 },
  { nome: "Automação / Funil", descricao: "Automação de marketing e funil de vendas", precoSugerido: 1500, custoBase: 0 },
  { nome: "Consultoria de Marketing", descricao: "Consultoria estratégica (hora/mês)", precoSugerido: 800, custoBase: 0 },
];

/**
 * Serviços do módulo Negócio.
 *
 * Catálogo: { id, nome, descricao, precoSugerido, custoBase, ativo }
 * Venda:    { id, servicoId?, servicosIds?[], nome, data, valor, custo,
 *             clienteId?, veiculoId?, contaDestino, obs }
 *
 * Vendas com servicoId/servicosIds nulos = avulsa (nome livre).
 * Receita entra na Caixa do Negócio virtual (não cria transação em Finanças).
 * Despesa do prestador em contratos recorrentes CONTINUA hitando Finanças
 * (dinheiro real sai da conta do usuário).
 */
export default function Servicos({
  servicos = [], setServicos,
  vendas = [], setVendas,
  contratos = [], setContratos,
  clientes = [],
  veiculos = [],
  instaladores = [], setInstaladores,
  contas = [], setContas,
  transacoes = [], setTransacoes,
  categorias = [],
  caixaNegocio = { saldo: 0, historico: [] }, setCaixaNegocio,
  hidden,
}) {
  const [servicoForm, setServicoForm] = useState(null);
  const [vendaForm, setVendaForm] = useState(null);
  const [contratoForm, setContratoForm] = useState(null);
  const [instaladorForm, setInstaladorForm] = useState(null);
  const [filtroVendas, setFiltroVendas] = useState("mes"); // mes | tudo
  const [catalogoExpandido, setCatalogoExpandido] = useState(true);
  const [contratosExpandido, setContratosExpandido] = useState(true);
  const [instaladoresExpandido, setInstaladoresExpandido] = useState(true);
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [relatorioAba, setRelatorioAba] = useState("clientes");
  const [faturaDoc, setFaturaDoc] = useState(null); // venda/fatura aberta no modal de PDF

  // Mês corrente YYYY-MM — usado pra controle de repasse e relatório.
  const mesCorrente = new Date().toISOString().slice(0, 7);

  const ativos = useMemo(
    () => servicos.filter(s => s.ativo !== false),
    [servicos]
  );

  const vendasFiltradas = useMemo(() => {
    const lista = [...(vendas || [])];
    if (filtroVendas === "mes") {
      const mesISO = new Date().toISOString().slice(0, 7);
      return lista.filter(v => (v.data || "").startsWith(mesISO))
        .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    }
    return lista.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [vendas, filtroVendas]);

  const kpi = useMemo(() => {
    const mesISO = new Date().toISOString().slice(0, 7);
    // Receita do mês = só o que foi efetivamente PAGO (recebido) no período.
    const vMes = (vendas || []).filter(v => (v.data || "").startsWith(mesISO));
    const recebidasMes = vMes.filter(v => v.pago !== false);
    const receita = recebidasMes.reduce((s, v) => s + Number(v.valor || 0), 0);
    const custo = recebidasMes.reduce((s, v) => s + Number(v.custo || 0), 0);
    // A receber = faturas pendentes (não pagas), de qualquer período.
    const aReceber = (vendas || [])
      .filter(v => v.pago === false)
      .reduce((s, v) => s + Number(v.valor || 0), 0);
    return {
      catalogo: ativos.length,
      vendidosMes: vMes.length,
      receitaMes: receita,
      lucroMes: receita - custo,
      aReceber,
    };
  }, [vendas, ativos]);

  // Faturas pendentes (cobranças em aberto) agrupadas por contrato — alimenta
  // o selo "Inadimplente" e o total a receber de cada contrato.
  const pendentesPorContrato = useMemo(() => {
    const map = {};
    (vendas || []).forEach(v => {
      if (!v.contratoId || v.pago !== false) return;
      const e = (map[v.contratoId] = map[v.contratoId] || { qtd: 0, total: 0 });
      e.qtd++;
      e.total += Number(v.valor || 0);
    });
    return map;
  }, [vendas]);

  // Saldo do mês por instalador: soma de valorInstalador das vendas do mês corrente
  // onde instaladorId === id. Backward-compat: vendas antigas sem campos seguem em 0.
  const saldoMesPorInstalador = useMemo(() => {
    const mesISO = new Date().toISOString().slice(0, 7);
    const map = {};
    (vendas || []).forEach(v => {
      if (!v.instaladorId) return;
      if (!(v.data || "").startsWith(mesISO)) return;
      const val = Number(v.valorInstalador || 0);
      if (!Number.isFinite(val) || val <= 0) return;
      map[v.instaladorId] = (map[v.instaladorId] || 0) + val;
    });
    return map;
  }, [vendas]);

  // Relatório do mês corrente. `vendas` já agrega vendas avulsas + faturas de
  // contratos (gerarFatura insere a fatura em `vendas` com contratoId), então
  // somar `vendas` cobre toda a receita do período sem perder nada.
  const relatorioMes = useMemo(() => {
    const mesISO = new Date().toISOString().slice(0, 7);
    const doMes = (vendas || []).filter(v => (v.data || "").startsWith(mesISO));
    // Por cliente: receita gerada no mês (vendas avulsas + faturas de contrato).
    const porCliente = {};
    doMes.forEach(v => {
      if (!v.clienteId) return;
      const c = (porCliente[v.clienteId] = porCliente[v.clienteId] || { qtd: 0, total: 0 });
      c.qtd++;
      c.total += Number(v.valor || 0);
    });
    // Por instalador: nº de serviços + valor a receber no mês.
    const porInstalador = {};
    doMes.forEach(v => {
      if (!v.instaladorId) return;
      const val = Number(v.valorInstalador || 0);
      if (!(val > 0)) return;
      const i = (porInstalador[v.instaladorId] = porInstalador[v.instaladorId] || { qtd: 0, total: 0 });
      i.qtd++;
      i.total += val;
    });
    return { porCliente, porInstalador, mesISO };
  }, [vendas]);

  /* ---------- Catálogo ---------- */
  const abrirServicoNovo = () => setServicoForm({
    id: null, nome: "", descricao: "",
    precoSugerido: "", custoBase: "", ativo: true,
  });
  const abrirServicoEditar = (s) => setServicoForm({
    ...s,
    precoSugerido: String(s.precoSugerido ?? ""),
    custoBase: String(s.custoBase ?? ""),
  });

  const salvarServico = () => {
    const nome = (servicoForm.nome || "").trim();
    const preco = Number(servicoForm.precoSugerido);
    const custo = Number(servicoForm.custoBase) || 0;
    if (!nome) { toast.error("Informe o nome do serviço."); return; }
    if (!Number.isFinite(preco) || preco <= 0) { toast.error("Preço sugerido inválido."); return; }
    const dados = {
      ...servicoForm,
      nome,
      descricao: (servicoForm.descricao || "").trim(),
      precoSugerido: preco,
      custoBase: custo,
      ativo: servicoForm.ativo !== false,
    };
    if (servicoForm.id) {
      setServicos(servicos.map(s => s.id === servicoForm.id ? dados : s));
      toast.success(`${nome} atualizado.`);
    } else {
      setServicos([{ ...dados, id: uid() }, ...servicos]);
      toast.success(`${nome} adicionado ao catálogo.`);
    }
    setServicoForm(null);
  };

  const excluirServico = async (s) => {
    const usado = (vendas || []).some(v => v.servicoId === s.id);
    const ok = await confirm({
      title: `Excluir ${s.nome}?`,
      body: usado
        ? "Este serviço foi usado em vendas. As vendas continuam registradas mas perdem o vínculo. Continuar?"
        : "O serviço será removido do catálogo.",
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    setServicos(servicos.filter(x => x.id !== s.id));
    toast.success("Serviço removido.");
  };

  const toggleAtivo = (s) => {
    setServicos(servicos.map(x => x.id === s.id ? { ...x, ativo: !(x.ativo !== false) } : x));
  };

  // Pré-popula o catálogo com serviços típicos de agência (CRM, tráfego, etc).
  // Só adiciona os que ainda não existem (compara por nome, sem acento/caixa).
  const seedServicosAgencia = async () => {
    const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
    const existentes = new Set((servicos || []).map(s => norm(s.nome)));
    const novos = SERVICOS_AGENCIA.filter(s => !existentes.has(norm(s.nome)));
    if (novos.length === 0) {
      toast.info("Todos os serviços de agência já estão no catálogo.");
      return;
    }
    const ok = await confirm({
      title: `Adicionar ${novos.length} serviço${novos.length !== 1 ? "s" : ""} de agência?`,
      body: `Vou incluir no catálogo: ${novos.map(s => s.nome).join(", ")}. Você pode editar preço/custo depois.`,
      confirmLabel: "Adicionar",
    });
    if (!ok) return;
    const criados = novos.map(s => ({ ...s, id: uid(), ativo: true }));
    setServicos([...criados, ...servicos]);
    toast.success(`${criados.length} serviço${criados.length !== 1 ? "s" : ""} de agência adicionado${criados.length !== 1 ? "s" : ""}.`);
  };

  /* ---------- Instaladores (CRUD) ---------- */
  // Instalador = pessoa que executa o serviço e recebe um pagamento que sai do
  // Caixa do Negócio (não toca Finanças). Diferente do Cliente, que paga.
  const abrirInstaladorNovo = () => setInstaladorForm({
    id: null, nome: "", telefone: "", obs: "", ativo: true,
  });
  const abrirInstaladorEditar = (i) => setInstaladorForm({ ...i });

  const salvarInstalador = () => {
    const nome = (instaladorForm.nome || "").trim();
    if (!nome) { toast.error("Informe o nome do instalador."); return; }
    if (typeof setInstaladores !== "function") { setInstaladorForm(null); return; }
    const dados = {
      ...instaladorForm,
      nome,
      telefone: (instaladorForm.telefone || "").trim(),
      obs: (instaladorForm.obs || "").trim(),
      ativo: instaladorForm.ativo !== false,
    };
    if (instaladorForm.id) {
      setInstaladores(instaladores.map(x => x.id === instaladorForm.id ? dados : x));
      toast.success(`${nome} atualizado.`);
    } else {
      setInstaladores([{ ...dados, id: uid(), criadoEm: new Date().toISOString() }, ...instaladores]);
      toast.success(`${nome} cadastrado.`);
    }
    setInstaladorForm(null);
  };

  const excluirInstalador = async (i) => {
    if (typeof setInstaladores !== "function") return;
    // Quantas vendas/faturas usam esse instalador? Avisa antes de excluir.
    const usos = (vendas || []).filter(v => v.instaladorId === i.id).length;
    const ok = await confirm({
      title: `Excluir ${i.nome}?`,
      body: usos > 0
        ? `Esse instalador está vinculado a ${usos} venda(s)/fatura(s). Os registros continuam mas perdem o vínculo. Continuar?`
        : `O cadastro de ${i.nome} será removido.`,
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    setInstaladores(instaladores.filter(x => x.id !== i.id));
    toast.success("Instalador removido.");
  };

  // Marca/desmarca o repasse do mês corrente como efetivamente pago ao
  // instalador. NÃO mexe no Caixa do Negócio — o valorInstalador já saiu por
  // venda; isto é só um controle de quitação ("já repassei o acumulado?").
  const togglePagarInstalador = (inst) => {
    if (typeof setInstaladores !== "function") return;
    const pagos = inst.repassesPagos || [];
    const jaPago = pagos.includes(mesCorrente);
    const novos = jaPago
      ? pagos.filter(m => m !== mesCorrente)
      : [...pagos, mesCorrente];
    setInstaladores(instaladores.map(i =>
      i.id === inst.id ? { ...i, repassesPagos: novos } : i
    ));
    toast.success(jaPago
      ? `Repasse de ${inst.nome} (${mesCorrente}) desmarcado.`
      : `Repasse de ${fmt(saldoMesPorInstalador[inst.id] || 0)} a ${inst.nome} marcado como pago.`);
  };

  /* ---------- Venda ---------- */
  const abrirVendaNova = () => setVendaForm({
    id: null,
    servicosIds: [],
    nome: "",
    data: todayISO(),
    valor: "",
    custo: "",
    clienteId: "",
    veiculoId: "",
    instaladorId: "",
    valorInstalador: "",
    obs: "",
  });

  // Adiciona serviço do catálogo à venda avulsa. Reaproveita padrão do contrato.
  const onVendaAdicionarServico = (servicoId) => {
    if (!servicoId || !vendaForm) return;
    if ((vendaForm.servicosIds || []).includes(servicoId)) return;
    const novosIds = [...(vendaForm.servicosIds || []), servicoId];
    const escolhidos = novosIds.map(id => servicos.find(s => s.id === id)).filter(Boolean);
    const somaValor = escolhidos.reduce((s, x) => s + (Number(x.precoSugerido) || 0), 0);
    const somaCusto = escolhidos.reduce((s, x) => s + (Number(x.custoBase) || 0), 0);
    const nomesJoined = escolhidos.map(x => x.nome).join(", ");
    const nomeAtual = (vendaForm.nome || "").trim();
    const nomeAnteriorAuto = (vendaForm.servicosIds || [])
      .map(id => servicos.find(s => s.id === id))
      .filter(Boolean)
      .map(x => x.nome)
      .join(", ");
    const novoNome = (!nomeAtual || nomeAtual === nomeAnteriorAuto) ? nomesJoined : nomeAtual;
    setVendaForm({
      ...vendaForm,
      servicosIds: novosIds,
      nome: novoNome,
      valor: String(somaValor),
      custo: String(somaCusto),
    });
  };

  const onVendaRemoverServico = (servicoId) => {
    if (!vendaForm) return;
    const novosIds = (vendaForm.servicosIds || []).filter(id => id !== servicoId);
    const escolhidos = novosIds.map(id => servicos.find(s => s.id === id)).filter(Boolean);
    const somaValor = escolhidos.reduce((s, x) => s + (Number(x.precoSugerido) || 0), 0);
    const somaCusto = escolhidos.reduce((s, x) => s + (Number(x.custoBase) || 0), 0);
    const nomesJoined = escolhidos.map(x => x.nome).join(", ");
    const nomeAtual = (vendaForm.nome || "").trim();
    const nomeAnteriorAuto = (vendaForm.servicosIds || [])
      .map(id => servicos.find(s => s.id === id))
      .filter(Boolean)
      .map(x => x.nome)
      .join(", ");
    const novoNome = (nomeAtual === nomeAnteriorAuto) ? nomesJoined : nomeAtual;
    setVendaForm({
      ...vendaForm,
      servicosIds: novosIds,
      nome: novoNome,
      ...(novosIds.length > 0 ? { valor: String(somaValor), custo: String(somaCusto) } : {}),
    });
  };

  /* ---------- Helpers de caixa (receita + prestador) ---------- */
  // Centralizam os efeitos financeiros de uma venda/fatura, pra que tanto a
  // venda avulsa quanto o "marcar fatura como paga" usem o mesmo caminho.

  // Receita entra na Caixa do Negócio; se há instalador, paga do mesmo caixa.
  const aplicarReceitaCaixa = (v, descricaoReceita) => {
    if (typeof setCaixaNegocio !== "function") return;
    const valorInst = Number(v.valorInstalador || 0);
    const temInst = !!v.instaladorId && valorInst > 0;
    const inst = temInst ? instaladores.find(i => i.id === v.instaladorId) : null;
    const dataMov = v.pagoEm || v.data || todayISO();
    setCaixaNegocio(prev => {
      const entradaReceita = {
        id: uid(),
        tipo: v.contratoId ? "fatura-recorrente" : "venda-servico",
        data: dataMov,
        descricao: descricaoReceita,
        valor: Number(v.valor || 0),
        custo: Number(v.custo || 0),
        vendaId: v.id,
        ...(v.contratoId ? { contratoId: v.contratoId } : {}),
        ts: new Date().toISOString(),
      };
      let novoSaldo = (prev?.saldo || 0) + Number(v.valor || 0);
      let novoHist = [entradaReceita, ...((prev?.historico) || [])];
      if (temInst) {
        novoSaldo -= valorInst;
        novoHist = [{
          id: uid(), tipo: "pago-instalador", data: dataMov,
          descricao: `Pago a ${inst?.nome || "instalador"} · ${v.nome}`,
          valor: -valorInst, vendaId: v.id,
          ...(v.contratoId ? { contratoId: v.contratoId } : {}),
          instaladorId: v.instaladorId, ts: new Date().toISOString(),
        }, ...novoHist];
      }
      return { saldo: novoSaldo, historico: novoHist };
    });
  };

  // Desfaz o que aplicarReceitaCaixa fez (remove lançamentos da venda do caixa).
  const reverterReceitaCaixa = (v) => {
    if (typeof setCaixaNegocio !== "function") return;
    const valorInst = Number(v.valorInstalador || 0);
    setCaixaNegocio(prev => ({
      // +valorInst porque o pago-instalador foi saída negativa; estornar devolve.
      saldo: (prev?.saldo || 0) - Number(v.valor || 0) + valorInst,
      historico: ((prev?.historico) || []).filter(h => h.vendaId !== v.id),
    }));
  };

  // Despesa do prestador em Finanças (dinheiro real saindo). Só faturas com
  // pagarAoFaturar + conta + custo > 0. Os dados ficam gravados na própria
  // fatura (snapshot) pra funcionar mesmo se o contrato mudar depois.
  const aplicarDespesaPrestador = (v) => {
    const custoNum = Number(v.custo || 0);
    if (!(v.pagarAoFaturar && v.contaPagamento && custoNum > 0)) return;
    if (typeof setTransacoes !== "function") return;
    const contaPag = contas.find(co => co.nome === v.contaPagamento);
    if (!contaPag) {
      toast.error(`Conta "${v.contaPagamento}" não existe mais. Despesa do prestador não criada.`);
      return;
    }
    const catDesp = categorias.find(cat => cat.tipo === "despesa" && /serv|saas|software|ferramenta|negocio/i.test(cat.nome))?.nome
                 || categorias.find(cat => cat.tipo === "despesa")?.nome
                 || "Outros";
    const despesa = {
      id: uid(), tipo: "despesa",
      descricao: `Pago a prestador · ${v.nome}`,
      categoria: catDesp, conta: v.contaPagamento,
      data: v.pagoEm || todayISO(), valor: custoNum,
      compensado: true, fixa: false,
      obs: `Pagamento ao prestador · contrato recorrente (serviço ${v.id})`,
    };
    setTransacoes([despesa, ...transacoes]);
    if (typeof setContas === "function") {
      setContas(contas.map(co => co.id === contaPag.id
        ? { ...co, saldo: (parseFloat(co.saldo) || 0) - custoNum }
        : co));
    }
  };

  // Desfaz a despesa do prestador (remove transação + devolve saldo).
  const reverterDespesaPrestador = (v) => {
    if (typeof setTransacoes !== "function") return;
    const desp = (transacoes || []).find(t =>
      t.tipo === "despesa" && (t.obs || "").includes(`serviço ${v.id}`));
    if (!desp) return;
    setTransacoes(transacoes.filter(t => t.id !== desp.id));
    const contaDesp = contas.find(co => co.nome === desp.conta);
    if (contaDesp && typeof setContas === "function") {
      setContas(contas.map(co => co.id === contaDesp.id
        ? { ...co, saldo: (parseFloat(co.saldo) || 0) + Number(desp.valor || 0) }
        : co));
    }
  };

  /* ---------- Marcar fatura paga / não paga ---------- */
  // Marcar PAGO: registra a data, joga a receita na Caixa do Negócio e (se
  // configurado) gera a despesa do prestador. Marcar NÃO PAGO desfaz tudo.
  const marcarFaturaPaga = (v) => {
    const cliente = clientes.find(c => c.id === v.clienteId);
    const pagoEm = todayISO();
    const vPago = { ...v, pago: true, pagoEm };
    setVendas((vendas || []).map(x => x.id === v.id ? vPago : x));
    aplicarReceitaCaixa(vPago, `${v.nome}${cliente ? ` · ${cliente.nome}` : ""}`);
    aplicarDespesaPrestador(vPago);
    toast.success(`Pagamento de ${fmt(v.valor)} recebido · ${v.nome}`);
  };

  const marcarFaturaNaoPaga = async (v) => {
    const ok = await confirm({
      title: `Marcar "${v.nome}" como não paga?`,
      body: `A receita de ${fmt(v.valor)} sai da Caixa do Negócio${v.pagarAoFaturar ? " e a despesa do prestador é desfeita" : ""}. A cobrança volta a ficar pendente.`,
      confirmLabel: "Marcar pendente",
    });
    if (!ok) return;
    reverterReceitaCaixa(v);
    reverterDespesaPrestador(v);
    setVendas((vendas || []).map(x => x.id === v.id ? { ...x, pago: false, pagoEm: null } : x));
    toast.success("Cobrança marcada como pendente.");
  };

  /* ---------- Cobrança / recibo por WhatsApp ---------- */
  const refLabelVenda = (v) => {
    if (v.faturaRef) {
      return v.faturaRef.length === 4 ? `Ano ${v.faturaRef}` : `${v.faturaRef.slice(5)}/${v.faturaRef.slice(0, 4)}`;
    }
    return v.data ? v.data.split("-").reverse().join("/") : "";
  };

  const enviarCobrancaWhatsApp = (v) => {
    const cliente = clientes.find(c => c.id === v.clienteId);
    if (!cliente) { toast.error("Vincule um cliente à venda para enviar a cobrança."); return; }
    const ref = refLabelVenda(v);
    const msg = v.pago
      ? `Olá ${cliente.nome}! ✅\n\nRecibo do serviço *${v.nome}*${ref ? ` (${ref})` : ""}.\nValor: *${fmt(v.valor)}* — PAGO${v.pagoEm ? ` em ${v.pagoEm.split("-").reverse().join("/")}` : ""}.\n\nObrigado pela parceria!`
      : `Olá ${cliente.nome}! 👋\n\nSegue a cobrança do serviço *${v.nome}*${ref ? ` referente a ${ref}` : ""}.\nValor: *${fmt(v.valor)}*.\n\nPode confirmar o pagamento? Qualquer dúvida estou à disposição. Obrigado!`;
    abrirWhatsApp(cliente.telefone, msg);
  };

  const confirmarVenda = () => {
    const nome = (vendaForm.nome || "").trim();
    const valor = Number(vendaForm.valor);
    const custo = Number(vendaForm.custo) || 0;
    if (!nome) { toast.error("Informe o nome do serviço."); return; }
    if (!Number.isFinite(valor) || valor <= 0) { toast.error("Valor inválido."); return; }

    const cliente = clientes.find(c => c.id === vendaForm.clienteId);
    const veiculo = veiculos.find(x => x.id === vendaForm.veiculoId);
    const partes = [nome];
    if (cliente) partes.push(cliente.nome);
    if (veiculo) partes.push(`${veiculo.modelo}${veiculo.placa ? ` ${veiculo.placa}` : ""}`);

    const servicosIds = vendaForm.servicosIds || [];
    const primaryServicoId = servicosIds[0] || null;

    // Instalador opcional: só registra saída se setou nome + valor > 0
    const valorInst = Number(vendaForm.valorInstalador) || 0;
    const temInstalador = !!vendaForm.instaladorId && valorInst > 0;

    const novaVenda = {
      id: uid(),
      servicoId: primaryServicoId, // retrocompat
      servicosIds,
      nome,
      data: vendaForm.data,
      valor, custo,
      clienteId: vendaForm.clienteId || null,
      veiculoId: vendaForm.veiculoId || null,
      instaladorId: temInstalador ? vendaForm.instaladorId : null,
      valorInstalador: temInstalador ? valorInst : 0,
      contaDestino: "Caixa do Negócio",
      pago: true,            // venda avulsa = recebida na hora
      pagoEm: vendaForm.data,
      obs: (vendaForm.obs || "").trim(),
    };

    // Venda avulsa entra paga: receita (e pago-instalador) vão pra Caixa agora.
    aplicarReceitaCaixa(novaVenda, `Serviço · ${partes.join(" · ")}`);

    setVendas([novaVenda, ...vendas]);
    setVendaForm(null);
    const lucro = valor - custo - (temInstalador ? valorInst : 0);
    toast.success(`Serviço registrado · lucro ${fmt(lucro)}${temInstalador ? " (após pago instalador)" : ""}`);
  };

  const estornarVenda = async (v) => {
    const isCaixaVirtual = v.contaDestino === "Caixa do Negócio";
    const valorInst = Number(v.valorInstalador || 0);
    const temInst = !!v.instaladorId && valorInst > 0;
    const ehDeContrato = !!v.contratoId && !!v.faturaRef;
    const foiPago = v.pago !== false; // legacy/avulsa sem campo = considerado pago
    const ok = await confirm({
      title: `Estornar ${ehDeContrato ? "fatura" : "venda"} de ${v.nome}?`,
      body: !foiPago
        ? `A cobrança pendente de ${fmt(v.valor)} será removida${ehDeContrato ? " e o contrato volta a permitir gerar a fatura desse mês" : ""}.`
        : isCaixaVirtual
          ? `A venda de ${fmt(v.valor)} será removida da Caixa do Negócio${temInst ? " (incluindo o pago ao instalador)" : ""}${ehDeContrato ? " e o contrato volta a permitir gerar a fatura desse mês" : ""}.`
          : `A venda de ${fmt(v.valor)} será removida, o saldo de ${v.contaDestino} ajustado e a transação no Finanças removida.`,
      danger: true, confirmLabel: "Estornar",
    });
    if (!ok) return;

    // Só reverte dinheiro se a venda/fatura tinha sido efetivamente paga.
    if (foiPago) {
      if (isCaixaVirtual) {
        reverterReceitaCaixa(v);
      } else {
        // Venda antiga (legacy, com conta de Finanças): comportamento original
        setTransacoes(transacoes.filter(t => !(
          t.conta === v.contaDestino &&
          t.valor === v.valor &&
          t.tipo === "receita" &&
          t.data === v.data &&
          (t.obs || "").includes(`serviço ${v.id}`)
        )));
        const conta = contas.find(c => c.nome === v.contaDestino);
        if (conta) {
          setContas(contas.map(c => c.id === conta.id
            ? { ...c, saldo: (parseFloat(c.saldo) || 0) - Number(v.valor || 0) }
            : c));
        }
      }
      // Reverte a despesa do prestador no Finanças, se foi gerada pra esta venda.
      reverterDespesaPrestador(v);
    }

    // Se a venda veio de um contrato recorrente, reabilita o "Gerar fatura"
    // desse mês — reseta ultimaFaturaRef se ainda aponta pra esta fatura.
    if (ehDeContrato && typeof setContratos === "function") {
      setContratos((contratos || []).map(c =>
        (c.id === v.contratoId && c.ultimaFaturaRef === v.faturaRef)
          ? { ...c, ultimaFaturaRef: null }
          : c
      ));
    }

    setVendas(vendas.filter(x => x.id !== v.id));
    toast.success(ehDeContrato
      ? "Estornada — você já pode gerar a fatura desse mês de novo."
      : "Venda estornada.");
  };

  /* ---------- Contratos recorrentes (CRM, tráfego, app, etc) ---------- */

  // Referência da competência atual conforme a recorrência
  const refAtual = (recorrencia) => {
    const d = new Date();
    if (recorrencia === "anual") return String(d.getFullYear());
    return d.toISOString().slice(0, 7); // mensal: YYYY-MM
  };

  const abrirContratoNovo = () => setContratoForm({
    id: null,
    clienteId: clientes[0]?.id || "",
    servicosIds: [],
    nome: "",
    valor: "",
    custo: "",
    contaPagamento: "",
    pagarAoFaturar: false,
    recorrencia: "mensal", // mensal | anual
    dataInicio: todayISO(),
    duracaoMeses: "", // vazio = indeterminado
    instaladorId: "",
    valorInstalador: "",
    obs: "",
    ativo: true,
  });

  const abrirContratoEditar = (c) => {
    const custoNum = Number(c.custo) || 0;
    setContratoForm({
      ...c,
      servicosIds: c.servicosIds || (c.servicoId ? [c.servicoId] : []),
      valor: String(c.valor ?? ""),
      custo: String(c.custo ?? ""),
      contaPagamento: c.contaPagamento || "",
      pagarAoFaturar: c.pagarAoFaturar !== undefined ? c.pagarAoFaturar : (custoNum > 0),
      duracaoMeses: c.duracaoMeses ? String(c.duracaoMeses) : "",
      instaladorId: c.instaladorId || "",
      valorInstalador: c.valorInstalador ? String(c.valorInstalador) : "",
    });
  };

  // Recalcula valor/custo/nome auto-preenchidos a partir do array de serviços selecionados.
  // Soma preçoSugerido/custoBase de cada serviço; nome vira "s1, s2, s3" (só se nome estiver vazio).
  const onContratoAdicionarServico = (servicoId) => {
    if (!servicoId || !contratoForm) return;
    if ((contratoForm.servicosIds || []).includes(servicoId)) return;
    const novosIds = [...(contratoForm.servicosIds || []), servicoId];
    const escolhidos = novosIds.map(id => servicos.find(s => s.id === id)).filter(Boolean);
    const somaValor = escolhidos.reduce((s, x) => s + (Number(x.precoSugerido) || 0), 0);
    const somaCusto = escolhidos.reduce((s, x) => s + (Number(x.custoBase) || 0), 0);
    const nomesJoined = escolhidos.map(x => x.nome).join(", ");
    const nomeAtual = (contratoForm.nome || "").trim();
    // Auto-preenche nome só se vazio ou se já era a versão auto-gerada anterior
    const nomeAnteriorAuto = (contratoForm.servicosIds || [])
      .map(id => servicos.find(s => s.id === id))
      .filter(Boolean)
      .map(x => x.nome)
      .join(", ");
    const novoNome = (!nomeAtual || nomeAtual === nomeAnteriorAuto) ? nomesJoined : nomeAtual;
    setContratoForm({
      ...contratoForm,
      servicosIds: novosIds,
      nome: novoNome,
      valor: String(somaValor),
      custo: String(somaCusto),
    });
  };

  const onContratoRemoverServico = (servicoId) => {
    if (!contratoForm) return;
    const novosIds = (contratoForm.servicosIds || []).filter(id => id !== servicoId);
    const escolhidos = novosIds.map(id => servicos.find(s => s.id === id)).filter(Boolean);
    const somaValor = escolhidos.reduce((s, x) => s + (Number(x.precoSugerido) || 0), 0);
    const somaCusto = escolhidos.reduce((s, x) => s + (Number(x.custoBase) || 0), 0);
    const nomesJoined = escolhidos.map(x => x.nome).join(", ");
    const nomeAtual = (contratoForm.nome || "").trim();
    const nomeAnteriorAuto = (contratoForm.servicosIds || [])
      .map(id => servicos.find(s => s.id === id))
      .filter(Boolean)
      .map(x => x.nome)
      .join(", ");
    const novoNome = (nomeAtual === nomeAnteriorAuto) ? nomesJoined : nomeAtual;
    setContratoForm({
      ...contratoForm,
      servicosIds: novosIds,
      nome: novoNome,
      // Se ainda há serviços, recalcula valor/custo; se ficou vazio, mantém valores que estavam (não zera)
      ...(novosIds.length > 0 ? { valor: String(somaValor), custo: String(somaCusto) } : {}),
    });
  };

  const salvarContrato = () => {
    const nome = (contratoForm.nome || "").trim();
    const valor = Number(contratoForm.valor);
    const custo = Number(contratoForm.custo) || 0;
    if (!nome) { toast.error("Informe o nome do contrato."); return; }
    if (!contratoForm.clienteId) { toast.error("Selecione um cliente."); return; }
    if (!Number.isFinite(valor) || valor <= 0) { toast.error("Valor inválido."); return; }

    const duracaoMesesN = parseInt(contratoForm.duracaoMeses, 10);
    const valorInstN = Number(contratoForm.valorInstalador) || 0;
    const temInstalador = !!contratoForm.instaladorId && valorInstN > 0;
    const dados = {
      ...contratoForm,
      nome, valor, custo,
      servicosIds: contratoForm.servicosIds || [],
      contaPagamento: contratoForm.contaPagamento || "",
      pagarAoFaturar: !!contratoForm.pagarAoFaturar && !!contratoForm.contaPagamento && custo > 0,
      duracaoMeses: Number.isFinite(duracaoMesesN) && duracaoMesesN > 0 ? duracaoMesesN : null,
      instaladorId: temInstalador ? contratoForm.instaladorId : null,
      valorInstalador: temInstalador ? valorInstN : 0,
      contaDestino: "Caixa do Negócio",
      obs: (contratoForm.obs || "").trim(),
    };
    if (contratoForm.id) {
      setContratos((contratos || []).map(c => c.id === contratoForm.id ? dados : c));
      toast.success("Contrato atualizado.");
    } else {
      setContratos([{ ...dados, id: uid(), ultimaFaturaRef: null, criadoEm: new Date().toISOString() }, ...(contratos || [])]);
      toast.success("Contrato criado.");
    }
    setContratoForm(null);
  };

  const excluirContrato = async (c) => {
    const ok = await confirm({
      title: `Excluir contrato "${c.nome}"?`,
      body: "As faturas já geradas continuam registradas, mas o contrato some daqui.",
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    setContratos((contratos || []).filter(x => x.id !== c.id));
    toast.success("Contrato removido.");
  };

  const toggleContratoAtivo = (c) => {
    setContratos((contratos || []).map(x => x.id === c.id ? { ...x, ativo: !(x.ativo !== false) } : x));
  };

  // Gera fatura (= venda) referente à competência atual. Skip se já gerou.
  // Receita entra na Caixa do Negócio virtual; despesa do prestador (se configurada)
  // continua hitando Finanças porque é dinheiro real saindo.
  const gerarFatura = (c) => {
    const ref = refAtual(c.recorrencia);
    if (c.ultimaFaturaRef === ref) {
      toast.error(`Fatura de ${ref} já foi gerada.`);
      return;
    }
    // Contrato com duração fixa — bloqueia faturas após o fim
    if (c.duracaoMeses && c.dataInicio) {
      const inicio = new Date(c.dataInicio + "T00:00:00");
      const fim = new Date(inicio); fim.setMonth(fim.getMonth() + c.duracaoMeses);
      if (new Date() >= fim) {
        const fimLabel = `${String(fim.getMonth() + 1).padStart(2, "0")}/${fim.getFullYear()}`;
        toast.error(`Contrato encerrado em ${fimLabel}.`);
        return;
      }
    }

    const refLabel = c.recorrencia === "anual" ? `Ano ${ref}` : `${ref.slice(5)}/${ref.slice(0, 4)}`;

    // Retrocompat: contratos antigos usam servicoId; novos usam servicosIds[]
    const servicosVinc = c.servicosIds || (c.servicoId ? [c.servicoId] : []);
    const primaryServicoId = servicosVinc[0] || c.servicoId || null;
    const valorReceita = Number(c.valor || 0);

    // Instalador no contrato (opcional): copia pra venda gerada pra que
    // saldoMesPorInstalador, chips e estorno funcionem do mesmo jeito que
    // venda avulsa.
    const valorInstContrato = Number(c.valorInstalador || 0);
    const temInstalador = !!c.instaladorId && valorInstContrato > 0;

    // A fatura nasce como COBRANÇA PENDENTE (pago:false). Nada de dinheiro se
    // move agora — receita na Caixa e despesa do prestador só acontecem quando
    // você marcar como paga. Snapshot de contaPagamento/pagarAoFaturar pra que
    // o "marcar pago" funcione mesmo se o contrato mudar depois.
    const novaVenda = {
      id: uid(),
      servicoId: primaryServicoId,
      servicosIds: servicosVinc,
      contratoId: c.id,
      faturaRef: ref,
      nome: `${c.nome} · ${refLabel}`,
      data: todayISO(),
      valor: valorReceita,
      custo: Number(c.custo || 0),
      clienteId: c.clienteId || null,
      veiculoId: null,
      instaladorId: temInstalador ? c.instaladorId : null,
      valorInstalador: temInstalador ? valorInstContrato : 0,
      contaDestino: "Caixa do Negócio",
      contaPagamento: c.contaPagamento || "",
      pagarAoFaturar: !!c.pagarAoFaturar && !!c.contaPagamento && Number(c.custo || 0) > 0,
      pago: false,
      pagoEm: null,
      obs: `Fatura recorrente · ref ${ref}`,
    };

    setVendas([novaVenda, ...vendas]);
    setContratos((contratos || []).map(x => x.id === c.id ? { ...x, ultimaFaturaRef: ref } : x));
    toast.success(`Fatura ${refLabel} gerada · cobrança pendente de ${fmt(c.valor)}`);
  };

  const gerarFaturasPendentes = () => {
    const ativos = (contratos || []).filter(c => c.ativo !== false);
    if (ativos.length === 0) { toast.error("Nenhum contrato ativo."); return; }
    const pendentes = ativos.filter(c => c.ultimaFaturaRef !== refAtual(c.recorrencia));
    if (pendentes.length === 0) { toast.error("Todas as faturas do período já foram geradas."); return; }
    pendentes.forEach(gerarFatura);
  };

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Negócio · Serviços"
        title="Serviços"
        sub="Catálogo de serviços com preço/custo + histórico de vendas. Receita entra na Caixa do Negócio (não toca em Finanças)."
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => { setRelatorioAba("clientes"); setRelatorioAberto(true); }}
                    className="btn-ghost">
              <Receipt size={14} className="inline mr-1.5" /> Relatório do mês
            </button>
            <button onClick={abrirVendaNova} className="btn-gold">
              <Plus size={14} className="inline mr-1.5" /> Registrar venda
            </button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px mb-4" style={{ background: T.border }}>
        <Kpi label="Catálogo" valor={String(kpi.catalogo)} sub="ativos" cor={T.ink} icon={Wrench} />
        <Kpi label="Vendidos no mês" valor={String(kpi.vendidosMes)} cor={T.gold} />
        <Kpi label="Recebido no mês" valor={hidden ? "•••••" : fmt(kpi.receitaMes)} cor={T.gold} icon={DollarSign} />
        <Kpi label="Lucro do mês"
             valor={hidden ? "•••••" : fmt(kpi.lucroMes)}
             cor={kpi.lucroMes >= 0 ? T.green : T.red}
             icon={TrendingUp} />
        <Kpi label="A receber"
             valor={hidden ? "•••••" : fmt(kpi.aReceber)}
             sub={kpi.aReceber > 0 ? "cobranças em aberto" : "tudo em dia"}
             cor={kpi.aReceber > 0 ? T.red : T.green}
             icon={AlertTriangle} />
      </div>

      {/* CATÁLOGO */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: 14, marginBottom: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <button onClick={() => setCatalogoExpandido(v => !v)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0,
                           display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: T.gold }}>
              {catalogoExpandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span className="label-eyebrow">Catálogo de serviços ({servicos.length})</span>
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={seedServicosAgencia}
              title="Adicionar serviços típicos de agência (CRM, tráfego pago, social media...)"
              style={{
                background: `${T.gold}18`, border: `1px solid ${T.gold}66`,
                color: T.gold, padding: "5px 10px", borderRadius: 5, cursor: "pointer",
                fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase",
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
              <Sparkles size={11} /> Serviços de agência
            </button>
            <button onClick={abrirServicoNovo}
              style={{
                background: "transparent", border: `1px solid ${T.border}`,
                color: T.muted, padding: "5px 10px", borderRadius: 5, cursor: "pointer",
                fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase",
              }}>
              <Plus size={11} className="inline mr-1" /> Novo serviço
            </button>
          </div>
        </div>

        {catalogoExpandido && (
          servicos.length === 0 ? (
            <div style={{ padding: 18, fontSize: 12, color: T.faint, fontStyle: "italic", textAlign: "center" }}>
              Catálogo vazio. Crie serviços (lavagem, mecânica, polimento, etc) pra acelerar o cadastro de vendas.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {servicos.map(s => (
                <div key={s.id} style={{
                  display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 10,
                  alignItems: "center", padding: "8px 10px", borderRadius: 5,
                  background: T.bgSoft, opacity: s.ativo === false ? 0.55 : 1,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
                      {s.nome}
                      {s.ativo === false && (
                        <span style={{ fontSize: 9, marginLeft: 8, padding: "1px 6px", background: T.border,
                                       color: T.muted, borderRadius: 3, letterSpacing: ".1em", textTransform: "uppercase" }}>
                          Inativo
                        </span>
                      )}
                    </div>
                    {s.descricao && (
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{s.descricao}</div>
                    )}
                  </div>
                  <span className="num" style={{ fontSize: 12, color: T.gold, fontWeight: 600 }}>
                    {fmt(s.precoSugerido)}
                  </span>
                  <span className="num" style={{ fontSize: 11, color: T.muted }}>
                    custo {fmt(s.custoBase || 0)}
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => toggleAtivo(s)}
                            title={s.ativo === false ? "Ativar" : "Desativar"}
                            style={btnIcon({ fontSize: 10 })}>
                      {s.ativo === false ? "↻" : "⊘"}
                    </button>
                    <button onClick={() => abrirServicoEditar(s)} title="Editar" style={btnIcon()}>
                      <Edit3 size={12} />
                    </button>
                    <button onClick={() => excluirServico(s)} title="Excluir" style={btnIcon({ color: T.red })}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* CONTRATOS RECORRENTES */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: 14, marginBottom: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <button onClick={() => setContratosExpandido(v => !v)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0,
                           display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: T.gold }}>
              {contratosExpandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <Repeat size={14} style={{ color: T.gold }} />
            <span className="label-eyebrow">
              Contratos recorrentes ({(contratos || []).filter(c => c.ativo !== false).length} ativos)
            </span>
          </button>
          <div style={{ display: "flex", gap: 6 }}>
            {(contratos || []).filter(c => c.ativo !== false).length > 0 && (
              <button onClick={gerarFaturasPendentes}
                style={{
                  background: T.gold, color: T.bg, border: "none",
                  padding: "5px 12px", borderRadius: 5, cursor: "pointer",
                  fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
                  display: "inline-flex", alignItems: "center", gap: 5,
                }}>
                <Receipt size={11} /> Gerar faturas do período
              </button>
            )}
            <button onClick={abrirContratoNovo}
              style={{
                background: "transparent", border: `1px solid ${T.border}`,
                color: T.muted, padding: "5px 10px", borderRadius: 5, cursor: "pointer",
                fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase",
              }}>
              <Plus size={11} className="inline mr-1" /> Novo contrato
            </button>
          </div>
        </div>

        {contratosExpandido && (
          (contratos || []).length === 0 ? (
            <div style={{ padding: 18, fontSize: 12, color: T.faint, fontStyle: "italic", textAlign: "center" }}>
              Nenhum contrato recorrente. Use pra CRM, tráfego pago, app, aluguel, mensalidades, qualquer serviço que se repita.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {(contratos || []).map(c => {
                const cliente = clientes.find(cl => cl.id === c.clienteId);
                const ref = refAtual(c.recorrencia);
                const faturadoEsteMes = c.ultimaFaturaRef === ref;
                const inativo = c.ativo === false;
                const pend = pendentesPorContrato[c.id] || null; // cobranças em aberto
                // Retrocompat: contratos antigos só têm servicoId; agora usamos servicosIds[]
                const servicosVinculados = c.servicosIds || (c.servicoId ? [c.servicoId] : []);
                const qtdServicos = servicosVinculados.length;
                // Duração fixa: calcula data fim e status (em curso / encerrado)
                let duracaoInfo = null;
                if (c.duracaoMeses && c.dataInicio) {
                  const inicio = new Date(c.dataInicio + "T00:00:00");
                  const fim = new Date(inicio); fim.setMonth(fim.getMonth() + c.duracaoMeses);
                  const agora = new Date();
                  const encerrado = agora >= fim;
                  const mesesDecorridos = Math.max(0, Math.floor((agora - inicio) / (1000 * 60 * 60 * 24 * 30.44)));
                  const restantes = Math.max(0, c.duracaoMeses - mesesDecorridos);
                  const fimLabel = `${String(fim.getMonth() + 1).padStart(2, "0")}/${fim.getFullYear()}`;
                  duracaoInfo = { encerrado, restantes, fimLabel, total: c.duracaoMeses };
                }
                return (
                  <div key={c.id} style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto auto",
                    gap: 10, alignItems: "center", padding: "10px 12px", borderRadius: 6,
                    background: T.bgSoft, opacity: inativo ? 0.55 : 1,
                    borderLeft: `3px solid ${faturadoEsteMes ? T.green : T.gold}`,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{c.nome}</span>
                        <span style={{
                          fontSize: 9, padding: "1px 6px", borderRadius: 3,
                          background: `${T.gold}22`, color: T.gold,
                          letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700,
                        }}>
                          {c.recorrencia === "anual" ? "Anual" : "Mensal"}
                        </span>
                        {qtdServicos > 1 && (
                          <span style={{
                            fontSize: 9, padding: "1px 6px", borderRadius: 3,
                            background: T.border, color: T.muted,
                            letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700,
                          }}
                          title={servicosVinculados
                            .map(id => servicos.find(s => s.id === id)?.nome)
                            .filter(Boolean)
                            .join(", ")}>
                            +{qtdServicos} serviços
                          </span>
                        )}
                        {inativo && (
                          <span style={{ fontSize: 9, padding: "1px 6px", background: T.border,
                                         color: T.muted, borderRadius: 3, letterSpacing: ".1em", textTransform: "uppercase" }}>
                            Pausado
                          </span>
                        )}
                        {duracaoInfo && (
                          <span style={{
                            fontSize: 9, padding: "1px 6px", borderRadius: 3,
                            background: duracaoInfo.encerrado ? `${T.red}22` : `${T.blue || "#60a5fa"}22`,
                            color: duracaoInfo.encerrado ? T.red : (T.blue || "#60a5fa"),
                            letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700,
                          }} title={`${duracaoInfo.total} meses · encerra em ${duracaoInfo.fimLabel}`}>
                            {duracaoInfo.encerrado
                              ? `Encerrado ${duracaoInfo.fimLabel}`
                              : `${duracaoInfo.restantes}/${duracaoInfo.total} meses restantes`}
                          </span>
                        )}
                        {pend && (
                          <span style={{
                            fontSize: 9, padding: "1px 6px", borderRadius: 3,
                            background: `${T.red}22`, color: T.red,
                            letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700,
                          }} title={`${pend.qtd} cobrança(s) em aberto · ${fmt(pend.total)} a receber`}>
                            ● Inadimplente · {hidden ? "•••" : fmt(pend.total)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {cliente && <span>👤 {cliente.nome}</span>}
                        {(() => {
                          // Chip do instalador do contrato: aparece se há vínculo
                          // + valor configurado. Cada fatura gerada vai pagar
                          // esse valor do Caixa do Negócio.
                          const valorInstContrato = Number(c.valorInstalador || 0);
                          if (!c.instaladorId || valorInstContrato <= 0) return null;
                          const inst = (instaladores || []).find(i => i.id === c.instaladorId);
                          const nomeInst = inst?.nome || "instalador";
                          return (
                            <span title={`Pago a ${nomeInst} a cada fatura: ${fmt(valorInstContrato)}`}>
                              👷 {nomeInst} · {hidden ? "•••" : `${fmt(valorInstContrato)}/fatura`}
                            </span>
                          );
                        })()}
                        <span>→ {c.contaDestino}</span>
                        {c.ultimaFaturaRef && (
                          <span style={{ color: faturadoEsteMes ? T.green : T.muted }}>
                            Última: {c.recorrencia === "anual" ? c.ultimaFaturaRef : `${c.ultimaFaturaRef.slice(5)}/${c.ultimaFaturaRef.slice(0, 4)}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="num" style={{ fontSize: 13, color: T.gold, fontWeight: 600 }}>
                      {hidden ? "•••" : fmt(c.valor)}
                    </span>
                    <button onClick={() => gerarFatura(c)}
                            disabled={faturadoEsteMes || inativo}
                            title={faturadoEsteMes ? "Já gerada no período" : "Gerar fatura agora"}
                            style={{
                              ...btnIcon(),
                              minWidth: 32, minHeight: 32,
                              opacity: (faturadoEsteMes || inativo) ? 0.4 : 1,
                              cursor: (faturadoEsteMes || inativo) ? "not-allowed" : "pointer",
                            }}>
                      <Receipt size={12} />
                    </button>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => toggleContratoAtivo(c)}
                              title={inativo ? "Reativar" : "Pausar"}
                              style={btnIcon()}>
                        {inativo ? <Play size={12} /> : <Pause size={12} />}
                      </button>
                      <button onClick={() => abrirContratoEditar(c)} title="Editar" style={btnIcon()}>
                        <Edit3 size={12} />
                      </button>
                      <button onClick={() => excluirContrato(c)} title="Excluir" style={btnIcon({ color: T.red })}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* INSTALADORES */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: 14, marginBottom: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <button onClick={() => setInstaladoresExpandido(v => !v)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0,
                           display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: T.gold }}>
              {instaladoresExpandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <HardHat size={14} style={{ color: T.gold }} />
            <span className="label-eyebrow">
              Instaladores ({(instaladores || []).filter(i => i.ativo !== false).length} ativos)
            </span>
          </button>
          <button onClick={abrirInstaladorNovo}
            style={{
              background: "transparent", border: `1px solid ${T.border}`,
              color: T.muted, padding: "5px 10px", borderRadius: 5, cursor: "pointer",
              fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase",
            }}>
            <Plus size={11} className="inline mr-1" /> Novo instalador
          </button>
        </div>

        {instaladoresExpandido && (
          (instaladores || []).length === 0 ? (
            <div style={{ padding: 18, fontSize: 12, color: T.faint, fontStyle: "italic", textAlign: "center" }}>
              Nenhum instalador cadastrado. Use pra registrar quem executa o serviço e quanto recebe (sai do Caixa do Negócio).
            </div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {(instaladores || []).map(i => {
                const saldoMes = saldoMesPorInstalador[i.id] || 0;
                const inativo = i.ativo === false;
                // Repasse do mês: já marcado como pago? (backward-compat: sem
                // repassesPagos => pendente). Só faz sentido se há saldo > 0.
                const repassePago = (i.repassesPagos || []).includes(mesCorrente);
                return (
                  <div key={i.id} style={{
                    display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 10,
                    alignItems: "center", padding: "8px 10px", borderRadius: 5,
                    background: T.bgSoft, opacity: inativo ? 0.55 : 1,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{i.nome}</span>
                        {inativo && (
                          <span style={{ fontSize: 9, padding: "1px 6px", background: T.border,
                                         color: T.muted, borderRadius: 3, letterSpacing: ".1em", textTransform: "uppercase" }}>
                            Inativo
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {i.telefone && <span>📞 {i.telefone}</span>}
                        {i.obs && <span style={{ fontStyle: "italic" }}>{i.obs}</span>}
                      </div>
                      {saldoMes > 0 && (
                        <div style={{
                          fontSize: 10.5, marginTop: 3, fontWeight: 600,
                          color: repassePago ? T.green : T.gold,
                        }}>
                          {repassePago
                            ? `Repasse de ${mesCorrente} quitado`
                            : `Repasse de ${mesCorrente} pendente`}
                        </div>
                      )}
                    </div>
                    <span className="num" title="Total pago no mês corrente"
                          style={{ fontSize: 12, color: saldoMes > 0 ? T.gold : T.muted, fontWeight: 600 }}>
                      {hidden ? "•••" : `${fmt(saldoMes)}/mês`}
                    </span>
                    {/* Controle de quitação do repasse do mês (não toca o caixa) */}
                    {saldoMes > 0 ? (
                      repassePago ? (
                        <button onClick={() => togglePagarInstalador(i)}
                                title="Repasse do mês marcado como pago — clique pra desmarcar"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  background: `${T.green}22`, border: `1px solid ${T.green}66`,
                                  color: T.green, padding: "4px 10px", borderRadius: 5, cursor: "pointer",
                                  fontSize: 10, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
                                }}>
                          <Check size={11} /> Pago
                        </button>
                      ) : (
                        <button onClick={() => togglePagarInstalador(i)}
                                title="Marcar repasse do mês como pago ao instalador"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  background: T.gold, border: "none",
                                  color: T.bg, padding: "4px 10px", borderRadius: 5, cursor: "pointer",
                                  fontSize: 10, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
                                }}>
                          <Check size={11} /> Pagar
                        </button>
                      )
                    ) : (
                      <span />
                    )}
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => abrirInstaladorEditar(i)} title="Editar" style={btnIcon()}>
                        <Edit3 size={12} />
                      </button>
                      <button onClick={() => excluirInstalador(i)} title="Excluir" style={btnIcon({ color: T.red })}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* VENDAS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div className="label-eyebrow">Vendas</div>
        <div className="flex gap-2">
          {[{ id: "mes", l: "Este mês" }, { id: "tudo", l: "Tudo" }].map(o => (
            <button key={o.id} onClick={() => setFiltroVendas(o.id)}
              style={{
                padding: "5px 12px", fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase",
                borderRadius: 5, cursor: "pointer", fontWeight: 600,
                background: filtroVendas === o.id ? `${T.gold}22` : "transparent",
                border: `1px solid ${filtroVendas === o.id ? T.gold : T.border}`,
                color: filtroVendas === o.id ? T.gold : T.muted,
              }}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {vendasFiltradas.length === 0 ? (
        <div style={{
          background: T.card, border: `1px dashed ${T.border}`, borderRadius: 10,
          padding: 60, textAlign: "center", color: T.muted, fontStyle: "italic",
        }}>
          <Wrench size={28} style={{ color: T.muted, marginBottom: 10 }} />
          <div>
            {vendas.length === 0
              ? "Nenhuma venda registrada. Clique em \"Registrar venda\" pra começar."
              : "Sem vendas no período selecionado."}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {vendasFiltradas.map(v => (
            <VendaRow key={v.id} venda={v}
                      cliente={clientes.find(c => c.id === v.clienteId)}
                      veiculo={veiculos.find(x => x.id === v.veiculoId)}
                      instalador={v.instaladorId ? instaladores.find(i => i.id === v.instaladorId) : null}
                      servicos={servicos}
                      hidden={hidden}
                      onMarcarPago={() => marcarFaturaPaga(v)}
                      onMarcarNaoPago={() => marcarFaturaNaoPaga(v)}
                      onCobrar={() => enviarCobrancaWhatsApp(v)}
                      onPDF={() => setFaturaDoc(v)}
                      onEstornar={() => estornarVenda(v)} />
          ))}
        </div>
      )}

      {/* MODAL: serviço (catálogo) */}
      {servicoForm && (
        <Modal title={servicoForm.id ? "Editar serviço" : "Novo serviço no catálogo"}
               onClose={() => setServicoForm(null)}>
          <Field label="Nome" required>
            <input value={servicoForm.nome}
                   onChange={e => setServicoForm({ ...servicoForm, nome: e.target.value })}
                   placeholder="Ex.: Lavagem completa" autoFocus />
          </Field>
          <Field label="Descrição">
            <textarea value={servicoForm.descricao} rows={2}
                      onChange={e => setServicoForm({ ...servicoForm, descricao: e.target.value })}
                      placeholder="Detalhes do que está incluído..."
                      style={{ resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Preço sugerido (R$)" required>
              <input type="number" step="0.01" value={servicoForm.precoSugerido}
                     onChange={e => setServicoForm({ ...servicoForm, precoSugerido: e.target.value })}
                     placeholder="80" />
            </Field>
            <Field label="Custo base (R$)">
              <input type="number" step="0.01" value={servicoForm.custoBase}
                     onChange={e => setServicoForm({ ...servicoForm, custoBase: e.target.value })}
                     placeholder="20" />
            </Field>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={servicoForm.ativo !== false}
                   onChange={e => setServicoForm({ ...servicoForm, ativo: e.target.checked })}
                   style={{ width: 16, height: 16, accentColor: T.gold }} />
            <span style={{ fontSize: 12.5, color: T.muted }}>
              Ativo no catálogo (aparece na hora de registrar venda)
            </span>
          </label>
          <div className="flex gap-3 justify-end mt-6">
            <button className="btn-ghost" onClick={() => setServicoForm(null)}>Cancelar</button>
            <button className="btn-gold" onClick={salvarServico}>
              <Check size={13} className="inline mr-1" />
              {servicoForm.id ? "Salvar" : "Adicionar"}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL: registrar venda */}
      {vendaForm && (() => {
        const valor = Number(vendaForm.valor) || 0;
        const custo = Number(vendaForm.custo) || 0;
        const valorInst = vendaForm.instaladorId ? (Number(vendaForm.valorInstalador) || 0) : 0;
        const lucro = valor - custo - valorInst;
        return (
          <Modal title="Registrar venda de serviço" onClose={() => setVendaForm(null)}>
            <Field label="Serviços do catálogo (opcional, múltiplos)" hint="Adicione 1 ou mais serviços; valor/custo somam automaticamente.">
              <div>
                {(vendaForm.servicosIds || []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                    {(vendaForm.servicosIds || []).map(id => {
                      const s = servicos.find(x => x.id === id);
                      const nome = s?.nome || `(serviço removido · ${id.slice(0, 6)})`;
                      return (
                        <span key={id} style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "3px 4px 3px 9px", borderRadius: 12,
                          background: `${T.gold}22`, border: `1px solid ${T.gold}66`,
                          fontSize: 11.5, color: T.ink, fontWeight: 500,
                        }}>
                          {nome}
                          <button type="button" onClick={() => onVendaRemoverServico(id)}
                                  title="Remover serviço"
                                  style={{
                                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                                    background: "transparent", border: "none", cursor: "pointer",
                                    color: T.muted, padding: 0, width: 16, height: 16, borderRadius: 8,
                                  }}>
                            <X size={11} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <select value=""
                        onChange={e => { onVendaAdicionarServico(e.target.value); }}>
                  <option value="">+ adicionar serviço do catálogo…</option>
                  {servicos
                    .filter(s => s.ativo !== false && !(vendaForm.servicosIds || []).includes(s.id))
                    .map(s => (
                      <option key={s.id} value={s.id}>{s.nome} · {fmt(s.precoSugerido)}</option>
                    ))}
                </select>
              </div>
            </Field>
            <Field label="Nome do serviço" required>
              <input value={vendaForm.nome}
                     onChange={e => setVendaForm({ ...vendaForm, nome: e.target.value })}
                     placeholder="Ex.: Lavagem completa" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Valor (R$)" required>
                <input type="number" step="0.01" value={vendaForm.valor}
                       onChange={e => setVendaForm({ ...vendaForm, valor: e.target.value })} />
              </Field>
              <Field label="Custo (R$)">
                <input type="number" step="0.01" value={vendaForm.custo}
                       onChange={e => setVendaForm({ ...vendaForm, custo: e.target.value })} />
              </Field>
              <Field label="Data" required>
                <input type="date" value={vendaForm.data}
                       onChange={e => setVendaForm({ ...vendaForm, data: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Cliente">
                <select value={vendaForm.clienteId}
                        onChange={e => setVendaForm({ ...vendaForm, clienteId: e.target.value })}>
                  <option value="">— sem cliente vinculado —</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </Field>
              <Field label="Veículo (opcional)">
                <select value={vendaForm.veiculoId}
                        onChange={e => setVendaForm({ ...vendaForm, veiculoId: e.target.value })}>
                  <option value="">— nenhum —</option>
                  {veiculos.filter(x => !x.vendido).map(x => (
                    <option key={x.id} value={x.id}>
                      {x.modelo}{x.placa ? ` (${x.placa})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Instalador (opcional)" hint="Quem executou o serviço">
                <select value={vendaForm.instaladorId || ""}
                        onChange={e => setVendaForm({ ...vendaForm, instaladorId: e.target.value })}>
                  <option value="">— sem instalador —</option>
                  {instaladores.filter(i => i.ativo !== false).map(i => (
                    <option key={i.id} value={i.id}>{i.nome}</option>
                  ))}
                </select>
              </Field>
              <Field label="Pago ao instalador (R$)" hint="Sai do Caixa do Negócio">
                <input type="number" step="0.01" value={vendaForm.valorInstalador || ""}
                       onChange={e => setVendaForm({ ...vendaForm, valorInstalador: e.target.value })}
                       placeholder="0,00"
                       disabled={!vendaForm.instaladorId} />
              </Field>
            </div>
            <div style={{
              padding: "10px 12px", marginBottom: 4, borderRadius: 6,
              background: `${T.gold}11`, border: `1px solid ${T.gold}33`,
              fontSize: 12, color: T.muted,
            }}>
              <span style={{ color: T.muted }}>Recebe em:</span>{" "}
              <strong style={{ color: T.gold }}>→ Caixa do Negócio</strong>
              <div style={{ fontSize: 10.5, color: T.faint, marginTop: 3, fontStyle: "italic" }}>
                Valor entra na Caixa virtual do Negócio (não cria transação em Finanças).
                {vendaForm.instaladorId && Number(vendaForm.valorInstalador) > 0 && (
                  <> Pagamento ao instalador sai do mesmo caixa.</>
                )}
              </div>
            </div>
            <Field label="Observações">
              <textarea value={vendaForm.obs} rows={2}
                        onChange={e => setVendaForm({ ...vendaForm, obs: e.target.value })}
                        style={{ resize: "vertical", fontFamily: "inherit" }} />
            </Field>
            {valor > 0 && (
              <div style={{
                padding: 12, marginTop: 4, borderRadius: 6,
                background: lucro >= 0 ? `${T.green}11` : `${T.red}11`,
                border: `1px solid ${lucro >= 0 ? T.green : T.red}33`,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: T.muted }}>Lucro previsto:</span>
                  <strong className="num" style={{ color: lucro >= 0 ? T.green : T.red }}>
                    {lucro >= 0 ? "+" : ""}{fmt(lucro)}
                  </strong>
                </div>
              </div>
            )}
            <div className="flex gap-3 justify-end mt-6">
              <button className="btn-ghost" onClick={() => setVendaForm(null)}>Cancelar</button>
              <button className="btn-gold" onClick={confirmarVenda}>
                <Check size={13} className="inline mr-1" /> Confirmar venda
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* MODAL: contrato recorrente */}
      {contratoForm && (
        <Modal title={contratoForm.id ? "Editar contrato" : "Novo contrato recorrente"}
               onClose={() => setContratoForm(null)}>
          <div style={{ fontSize: 12, color: T.muted, marginBottom: 12, fontStyle: "italic" }}>
            Use pra cobrar serviços que se repetem todo mês (CRM, tráfego pago, app, aluguel, mensalidade…). Cada faturamento entra na Caixa do Negócio.
          </div>
          <Field label="Cliente" required>
            <select value={contratoForm.clienteId}
                    onChange={e => setContratoForm({ ...contratoForm, clienteId: e.target.value })}>
              <option value="">Selecione…</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </Field>
          <Field label="Serviços do catálogo (opcional, múltiplos)" hint="Adicione 1 ou mais serviços; valor/custo somam automaticamente.">
            <div>
              {(contratoForm.servicosIds || []).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                  {(contratoForm.servicosIds || []).map(id => {
                    const s = servicos.find(x => x.id === id);
                    const nome = s?.nome || `(serviço removido · ${id.slice(0, 6)})`;
                    return (
                      <span key={id} style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "3px 4px 3px 9px", borderRadius: 12,
                        background: `${T.gold}22`, border: `1px solid ${T.gold}66`,
                        fontSize: 11.5, color: T.ink, fontWeight: 500,
                      }}>
                        {nome}
                        <button type="button" onClick={() => onContratoRemoverServico(id)}
                                title="Remover serviço"
                                style={{
                                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                                  background: "transparent", border: "none", cursor: "pointer",
                                  color: T.muted, padding: 0, width: 16, height: 16, borderRadius: 8,
                                }}>
                          <X size={11} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <select value=""
                      onChange={e => { onContratoAdicionarServico(e.target.value); }}>
                <option value="">+ adicionar serviço do catálogo…</option>
                {servicos
                  .filter(s => s.ativo !== false && !(contratoForm.servicosIds || []).includes(s.id))
                  .map(s => (
                    <option key={s.id} value={s.id}>{s.nome} · {fmt(s.precoSugerido)}</option>
                  ))}
              </select>
            </div>
          </Field>
          <Field label="Nome do serviço/contrato" required>
            <input value={contratoForm.nome}
                   onChange={e => setContratoForm({ ...contratoForm, nome: e.target.value })}
                   placeholder="Ex.: CRM mensal · Tráfego pago · App XYZ" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Valor (R$)" required>
              <input type="number" step="0.01" value={contratoForm.valor}
                     onChange={e => setContratoForm({ ...contratoForm, valor: e.target.value })}
                     placeholder="200" />
            </Field>
            <Field label="Pago ao prestador (R$)">
              <input type="number" step="0.01" value={contratoForm.custo}
                     onChange={e => {
                       const novoCusto = e.target.value;
                       const custoNum = Number(novoCusto) || 0;
                       setContratoForm({
                         ...contratoForm,
                         custo: novoCusto,
                         // Se desligou (custo 0), desativa pagarAoFaturar
                         pagarAoFaturar: custoNum > 0 ? contratoForm.pagarAoFaturar : false,
                       });
                     }}
                     placeholder="50" />
            </Field>
            <Field label="Recorrência" required>
              <select value={contratoForm.recorrencia}
                      onChange={e => setContratoForm({ ...contratoForm, recorrencia: e.target.value })}>
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
              </select>
            </Field>
          </div>
          {Number(contratoForm.custo) > 0 && (
            <div style={{
              padding: 10, marginTop: 4, borderRadius: 6,
              background: T.bgSoft, border: `1px solid ${T.border}`,
            }}>
              <Field label="Conta pagamento (de onde sai o pagamento ao prestador)">
                <select value={contratoForm.contaPagamento}
                        onChange={e => {
                          const novaConta = e.target.value;
                          setContratoForm({
                            ...contratoForm,
                            contaPagamento: novaConta,
                            // Se limpou a conta, desliga o auto-pagamento
                            pagarAoFaturar: novaConta ? contratoForm.pagarAoFaturar : false,
                          });
                        }}>
                  <option value="">— sem pagamento automático —</option>
                  {contas.map(c => (
                    <option key={c.id} value={c.nome}>{c.nome} · {fmt(c.saldo || 0)}</option>
                  ))}
                </select>
              </Field>
              {contratoForm.contaPagamento && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, cursor: "pointer" }}>
                  <input type="checkbox" checked={!!contratoForm.pagarAoFaturar}
                         onChange={e => setContratoForm({ ...contratoForm, pagarAoFaturar: e.target.checked })}
                         style={{ width: 16, height: 16, accentColor: T.gold }} />
                  <span style={{ fontSize: 12.5, color: T.muted }}>
                    Criar despesa ao faturar (desconta {fmt(Number(contratoForm.custo) || 0)} de {contratoForm.contaPagamento})
                  </span>
                </label>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Data de início">
              <input type="date" value={contratoForm.dataInicio}
                     onChange={e => setContratoForm({ ...contratoForm, dataInicio: e.target.value })} />
            </Field>
            <Field label="Duração (meses)" hint="Vazio = sem prazo definido">
              <input type="number" min="1" step="1" value={contratoForm.duracaoMeses || ""}
                     onChange={e => setContratoForm({ ...contratoForm, duracaoMeses: e.target.value })}
                     placeholder="ex.: 12" />
            </Field>
          </div>
          {(() => {
            const meses = parseInt(contratoForm.duracaoMeses, 10);
            if (!Number.isFinite(meses) || meses <= 0 || !contratoForm.dataInicio) return null;
            const inicio = new Date(contratoForm.dataInicio + "T00:00:00");
            const fim = new Date(inicio); fim.setMonth(fim.getMonth() + meses);
            const fimLabel = `${String(fim.getMonth() + 1).padStart(2, "0")}/${fim.getFullYear()}`;
            const valorMensal = Number(contratoForm.valor) || 0;
            const total = valorMensal * meses;
            return (
              <div style={{
                marginTop: -6, marginBottom: 4, padding: "8px 10px",
                background: `${T.blue || "#60a5fa"}11`, border: `1px solid ${T.blue || "#60a5fa"}33`,
                borderRadius: 6, fontSize: 11.5, color: T.muted,
              }}>
                📅 Encerra em <strong style={{ color: T.ink }}>{fimLabel}</strong>
                {" · "}Total previsto: <strong className="num" style={{ color: T.ink }}>{fmt(total)}</strong>
              </div>
            );
          })()}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Instalador (opcional)" hint="Quem executa o serviço a cada fatura">
              <select value={contratoForm.instaladorId || ""}
                      onChange={e => setContratoForm({ ...contratoForm, instaladorId: e.target.value })}>
                <option value="">— sem instalador —</option>
                {instaladores.filter(i => i.ativo !== false).map(i => (
                  <option key={i.id} value={i.id}>{i.nome}</option>
                ))}
              </select>
            </Field>
            <Field label="Pago ao instalador (R$/fatura)" hint="Sai do Caixa do Negócio a cada faturamento">
              <input type="number" step="0.01" value={contratoForm.valorInstalador || ""}
                     onChange={e => setContratoForm({ ...contratoForm, valorInstalador: e.target.value })}
                     placeholder="0,00"
                     disabled={!contratoForm.instaladorId} />
            </Field>
          </div>
          <div style={{
            padding: "10px 12px", marginTop: 4, borderRadius: 6,
            background: `${T.gold}11`, border: `1px solid ${T.gold}33`,
            fontSize: 12, color: T.muted,
          }}>
            <span style={{ color: T.muted }}>Recebe em:</span>{" "}
            <strong style={{ color: T.gold }}>→ Caixa do Negócio</strong>
            <div style={{ fontSize: 10.5, color: T.faint, marginTop: 3, fontStyle: "italic" }}>
              Receita entra na Caixa virtual do Negócio (não cria transação em Finanças).
              {contratoForm.instaladorId && Number(contratoForm.valorInstalador) > 0 && (
                <> Pagamento ao instalador sai do mesmo caixa a cada fatura.</>
              )}
            </div>
          </div>
          <Field label="Observações">
            <textarea value={contratoForm.obs} rows={2}
                      onChange={e => setContratoForm({ ...contratoForm, obs: e.target.value })}
                      placeholder="Detalhes do contrato, escopo, link..."
                      style={{ resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={contratoForm.ativo !== false}
                   onChange={e => setContratoForm({ ...contratoForm, ativo: e.target.checked })}
                   style={{ width: 16, height: 16, accentColor: T.gold }} />
            <span style={{ fontSize: 12.5, color: T.muted }}>
              Ativo (entra no "Gerar faturas do período")
            </span>
          </label>
          <div style={{
            marginTop: 10, padding: "8px 10px", borderRadius: 6,
            background: `${T.gold}11`, border: `1px solid ${T.gold}33`,
            fontSize: 11.5, color: T.muted, lineHeight: 1.5,
          }}>
            💡 <strong style={{ color: T.ink }}>Pago ao prestador</strong> + <strong style={{ color: T.ink }}>Criar despesa ao faturar</strong> gera a despesa em Finanças (a receita vai pra Caixa do Negócio).
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <button className="btn-ghost" onClick={() => setContratoForm(null)}>Cancelar</button>
            <button className="btn-gold" onClick={salvarContrato}>
              <Check size={13} className="inline mr-1" />
              {contratoForm.id ? "Salvar" : "Criar contrato"}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL: instalador */}
      {instaladorForm && (
        <Modal title={instaladorForm.id ? "Editar instalador" : "Novo instalador"}
               onClose={() => setInstaladorForm(null)}>
          <Field label="Nome" required>
            <input value={instaladorForm.nome}
                   onChange={e => setInstaladorForm({ ...instaladorForm, nome: e.target.value })}
                   placeholder="Ex.: Paulo" autoFocus />
          </Field>
          <Field label="Telefone">
            <input value={instaladorForm.telefone}
                   onChange={e => setInstaladorForm({ ...instaladorForm, telefone: e.target.value })}
                   placeholder="(00) 00000-0000" />
          </Field>
          <Field label="Observações">
            <textarea value={instaladorForm.obs} rows={2}
                      onChange={e => setInstaladorForm({ ...instaladorForm, obs: e.target.value })}
                      placeholder="Especialidade, faixa de valor habitual, contexto..."
                      style={{ resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={instaladorForm.ativo !== false}
                   onChange={e => setInstaladorForm({ ...instaladorForm, ativo: e.target.checked })}
                   style={{ width: 16, height: 16, accentColor: T.gold }} />
            <span style={{ fontSize: 12.5, color: T.muted }}>
              Ativo (aparece como opção em novas vendas/contratos)
            </span>
          </label>
          <div className="flex gap-3 justify-end mt-6">
            <button className="btn-ghost" onClick={() => setInstaladorForm(null)}>Cancelar</button>
            <button className="btn-gold" onClick={salvarInstalador}>
              <Check size={13} className="inline mr-1" />
              {instaladorForm.id ? "Salvar" : "Cadastrar"}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL: relatório do mês (clientes + instaladores) */}
      {relatorioAberto && (() => {
        const refLabel = `${relatorioMes.mesISO.slice(5)}/${relatorioMes.mesISO.slice(0, 4)}`;
        // Clientes ordenados por receita desc
        const linhasClientes = Object.entries(relatorioMes.porCliente)
          .map(([clienteId, d]) => ({
            id: clienteId,
            nome: clientes.find(c => c.id === clienteId)?.nome || "(cliente removido)",
            qtd: d.qtd,
            total: d.total,
          }))
          .sort((a, b) => b.total - a.total);
        const totalClientesQtd = linhasClientes.reduce((s, l) => s + l.qtd, 0);
        const totalClientesValor = linhasClientes.reduce((s, l) => s + l.total, 0);
        // Instaladores ordenados por total desc
        const linhasInstaladores = Object.entries(relatorioMes.porInstalador)
          .map(([instId, d]) => {
            const inst = (instaladores || []).find(i => i.id === instId);
            return {
              id: instId,
              nome: inst?.nome || "(instalador removido)",
              qtd: d.qtd,
              total: saldoMesPorInstalador[instId] || d.total,
              pago: (inst?.repassesPagos || []).includes(mesCorrente),
            };
          })
          .sort((a, b) => b.total - a.total);
        const totalInstQtd = linhasInstaladores.reduce((s, l) => s + l.qtd, 0);
        const totalInstValor = linhasInstaladores.reduce((s, l) => s + l.total, 0);

        const thStyle = {
          textAlign: "left", padding: "7px 8px", fontSize: 10,
          letterSpacing: ".08em", textTransform: "uppercase", color: T.muted,
          borderBottom: `1px solid ${T.border}`, fontWeight: 700,
        };
        const tdStyle = { padding: "7px 8px", fontSize: 12.5, color: T.ink, borderBottom: `1px solid ${T.border}` };
        const numTd = { ...tdStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" };

        return (
          <Modal title={`Relatório de ${refLabel}`} onClose={() => setRelatorioAberto(false)}>
            {/* Abas */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {[{ id: "clientes", l: "Clientes" }, { id: "instaladores", l: "Instaladores" }].map(o => (
                <button key={o.id} onClick={() => setRelatorioAba(o.id)}
                  style={{
                    padding: "6px 16px", fontSize: 11, letterSpacing: ".05em", textTransform: "uppercase",
                    borderRadius: 6, cursor: "pointer", fontWeight: 700,
                    background: relatorioAba === o.id ? `${T.gold}22` : "transparent",
                    border: `1px solid ${relatorioAba === o.id ? T.gold : T.border}`,
                    color: relatorioAba === o.id ? T.gold : T.muted,
                  }}>
                  {o.l}
                </button>
              ))}
            </div>

            {relatorioAba === "clientes" ? (
              linhasClientes.length === 0 ? (
                <div style={{ padding: 28, fontSize: 12.5, color: T.faint, fontStyle: "italic", textAlign: "center" }}>
                  Nenhuma venda/fatura com cliente vinculado em {refLabel}.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Cliente</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Vendas/faturas</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasClientes.map(l => (
                      <tr key={l.id}>
                        <td style={tdStyle}>{l.nome}</td>
                        <td style={numTd} className="num">{l.qtd}</td>
                        <td style={{ ...numTd, color: T.gold, fontWeight: 600 }} className="num">
                          {hidden ? "•••" : fmt(l.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ ...tdStyle, fontWeight: 700, borderBottom: "none" }}>Total geral</td>
                      <td style={{ ...numTd, fontWeight: 700, borderBottom: "none" }} className="num">{totalClientesQtd}</td>
                      <td style={{ ...numTd, fontWeight: 700, color: T.gold, borderBottom: "none" }} className="num">
                        {hidden ? "•••" : fmt(totalClientesValor)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )
            ) : (
              linhasInstaladores.length === 0 ? (
                <div style={{ padding: 28, fontSize: 12.5, color: T.faint, fontStyle: "italic", textAlign: "center" }}>
                  Nenhum serviço com instalador em {refLabel}.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Instalador</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Serviços</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>A receber</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasInstaladores.map(l => (
                      <tr key={l.id}>
                        <td style={tdStyle}>{l.nome}</td>
                        <td style={numTd} className="num">{l.qtd}</td>
                        <td style={{ ...numTd, color: T.gold, fontWeight: 600 }} className="num">
                          {hidden ? "•••" : fmt(l.total)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          <span style={{
                            fontSize: 9.5, padding: "2px 8px", borderRadius: 4, fontWeight: 700,
                            letterSpacing: ".05em", textTransform: "uppercase",
                            background: l.pago ? `${T.green}22` : `${T.gold}22`,
                            color: l.pago ? T.green : T.gold,
                          }}>
                            {l.pago ? "Pago" : "Pendente"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ ...tdStyle, fontWeight: 700, borderBottom: "none" }}>Total</td>
                      <td style={{ ...numTd, fontWeight: 700, borderBottom: "none" }} className="num">{totalInstQtd}</td>
                      <td style={{ ...numTd, fontWeight: 700, color: T.gold, borderBottom: "none" }} className="num">
                        {hidden ? "•••" : fmt(totalInstValor)}
                      </td>
                      <td style={{ ...tdStyle, borderBottom: "none" }} />
                    </tr>
                  </tfoot>
                </table>
              )
            )}

            <div className="flex gap-3 justify-end mt-6">
              <button className="btn-ghost" onClick={() => setRelatorioAberto(false)}>Fechar</button>
            </div>
          </Modal>
        );
      })()}

      {/* MODAL: fatura / recibo em PDF */}
      {faturaDoc && (
        <FaturaDocModal
          venda={faturaDoc}
          cliente={clientes.find(c => c.id === faturaDoc.clienteId)}
          servicos={servicos}
          onClose={() => setFaturaDoc(null)}
        />
      )}
    </div>
  );
}

// Documento imprimível de fatura/recibo. Renderiza via portal direto no body
// pra que o helper toPDF (print-only-this) isole só este card na impressão.
function FaturaDocModal({ venda: v, cliente, servicos = [], onClose }) {
  const empresa = (() => {
    try { return localStorage.getItem("af4:empresa-nome") || "Âncora"; }
    catch { return "Âncora"; }
  })();
  const pendente = v.pago === false;
  const numero = String(v.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
  const refLabel = v.faturaRef
    ? (v.faturaRef.length === 4 ? `Ano ${v.faturaRef}` : `${v.faturaRef.slice(5)}/${v.faturaRef.slice(0, 4)}`)
    : (v.data ? v.data.split("-").reverse().join("/") : "—");
  const servicosVinc = v.servicosIds || (v.servicoId ? [v.servicoId] : []);
  const itens = servicosVinc.map(id => servicos.find(s => s.id === id)?.nome).filter(Boolean);
  const dataEmissao = (v.data || todayISO()).split("-").reverse().join("/");

  const linha = (label, valor) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#222" }}>
      <span style={{ color: "#666" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{valor}</span>
    </div>
  );

  const content = (
    <div className="modal-overlay-bg" onClick={onClose}
         style={{
           position: "fixed", inset: 0, zIndex: 1000,
           background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center",
           padding: 20, overflowY: "auto",
         }}>
      <div onClick={e => e.stopPropagation()}
           style={{ width: "min(560px, 100%)", maxHeight: "92vh", overflowY: "auto",
                    background: "#fff", borderRadius: 10 }}>
        {/* Documento (isolado na impressão) */}
        <div id="fatura-doc-print" style={{ padding: 28, color: "#111", background: "#fff", fontFamily: "Georgia, serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #111", paddingBottom: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{empresa}</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>Prestação de serviços</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                {pendente ? "Fatura" : "Recibo"}
              </div>
              <div style={{ fontSize: 11, color: "#666" }}>Nº {numero}</div>
              <div style={{ fontSize: 11, color: "#666" }}>Emissão: {dataEmissao}</div>
            </div>
          </div>

          {/* Status */}
          <div style={{
            display: "inline-block", marginBottom: 16, padding: "4px 12px", borderRadius: 4,
            fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase",
            background: pendente ? "#fde2e2" : "#dcf5e3", color: pendente ? "#b42318" : "#137a3b",
            border: `1px solid ${pendente ? "#f0a9a3" : "#9ad9b3"}`,
          }}>
            {pendente ? "● Pagamento pendente" : `✓ Pago${v.pagoEm ? ` em ${v.pagoEm.split("-").reverse().join("/")}` : ""}`}
          </div>

          {/* Cliente */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "#888", marginBottom: 4 }}>Cobrar de</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{cliente?.nome || "Cliente não informado"}</div>
            {cliente?.doc && <div style={{ fontSize: 12, color: "#555" }}>{cliente.doc}</div>}
            {cliente?.email && <div style={{ fontSize: 12, color: "#555" }}>{cliente.email}</div>}
            {cliente?.telefone && <div style={{ fontSize: 12, color: "#555" }}>{cliente.telefone}</div>}
          </div>

          {/* Detalhes */}
          <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{v.nome}</div>
            {itens.length > 0 && (
              <ul style={{ margin: "0 0 8px 18px", padding: 0, fontSize: 12.5, color: "#444" }}>
                {itens.map((nome, i) => <li key={i}>{nome}</li>)}
              </ul>
            )}
            {v.obs && <div style={{ fontSize: 11.5, color: "#777", fontStyle: "italic", marginBottom: 8 }}>{v.obs}</div>}
            {linha("Competência", refLabel)}
            <div style={{ borderTop: "1px solid #eee", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: 22, fontWeight: 700 }}>{fmt(v.valor)}</span>
            </div>
          </div>

          <div style={{ fontSize: 11, color: "#999", textAlign: "center", borderTop: "1px solid #eee", paddingTop: 10 }}>
            Documento gerado por {empresa} · {dataEmissao}
          </div>
        </div>

        {/* Ações (não imprimem) */}
        <div className="no-print" style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "14px 28px 22px" }}>
          <button className="btn-ghost" onClick={onClose}>Fechar</button>
          <button className="btn-gold" onClick={() => toPDF("fatura-doc-print")}>
            <FileText size={13} className="inline mr-1" /> Imprimir / PDF
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(content, document.body);
}

function VendaRow({ venda: v, cliente, veiculo, instalador, servicos = [], hidden,
                   onMarcarPago, onMarcarNaoPago, onCobrar, onPDF, onEstornar }) {
  // Lucro: além de custo, desconta também o valor pago ao instalador (saída
  // virtual da Caixa). Backward-compat: vendas sem instalador → valorInst 0.
  const valorInst = Number(v.valorInstalador || 0);
  const lucro = Number(v.valor || 0) - Number(v.custo || 0) - valorInst;
  // Retrocompat: vendas antigas com servicoId; vendas novas com servicosIds[]
  const servicosVinc = v.servicosIds || (v.servicoId ? [v.servicoId] : []);
  const qtdServicos = servicosVinc.length;
  // Chip do instalador: só renderiza se a venda tem instaladorId — não
  // depende de o cadastro ainda existir (fallback pra obscuro "instalador").
  const temInstalador = !!v.instaladorId && valorInst > 0;
  const nomeInst = instalador?.nome || (temInstalador ? "instalador" : "");
  const pendente = v.pago === false; // cobrança em aberto
  const corBorda = pendente ? T.red : T.green;
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${corBorda}`,
      borderRadius: 8, padding: 12,
      display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 12, alignItems: "center",
    }}>
      <div style={{ color: T.faint, fontFamily: T.mono, fontSize: 11 }}>
        {v.data.split("-").reverse().slice(0, 2).join("/")}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, color: T.ink, fontWeight: 500 }}>{v.nome}</span>
          {/* Selo de status de pagamento (cobrança) */}
          <span style={{
            fontSize: 9, padding: "1px 7px", borderRadius: 3, fontWeight: 700,
            letterSpacing: ".08em", textTransform: "uppercase",
            background: pendente ? `${T.red}22` : `${T.green}22`,
            color: pendente ? T.red : T.green,
          }}>
            {pendente ? "Pendente" : "Pago"}
          </span>
          {qtdServicos > 1 && (
            <span style={{
              fontSize: 9, padding: "1px 6px", borderRadius: 3,
              background: T.border, color: T.muted,
              letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700,
            }}
            title={servicosVinc
              .map(id => servicos.find(s => s.id === id)?.nome)
              .filter(Boolean)
              .join(", ")}>
              +{qtdServicos} serviços
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {cliente && <span>👤 {cliente.nome}</span>}
          {veiculo && <span>🚗 {veiculo.modelo}{veiculo.placa ? ` (${veiculo.placa})` : ""}</span>}
          {temInstalador && (
            <span title={`Pago a ${nomeInst}: ${fmt(valorInst)} (sai do Caixa do Negócio)`}>
              👷 {nomeInst} · {hidden ? "•••" : `pago ${fmt(valorInst)}`}
            </span>
          )}
          {!pendente && v.pagoEm && (
            <span style={{ color: T.green }}>✓ pago em {v.pagoEm.split("-").reverse().join("/")}</span>
          )}
          <span>→ {v.contaDestino}</span>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="num" style={{ color: T.gold, fontWeight: 600 }}>{hidden ? "•••" : fmt(v.valor)}</div>
        <div className="num" style={{ fontSize: 10, color: lucro >= 0 ? T.green : T.red }}>
          lucro {lucro >= 0 ? "+" : ""}{hidden ? "•••" : fmt(lucro)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {pendente ? (
          <button onClick={onMarcarPago} title="Marcar como pago (entra na Caixa do Negócio)"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: T.green, border: "none", color: "#fff",
                    padding: "0 10px", height: 32, borderRadius: 5, cursor: "pointer",
                    fontSize: 10, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
                  }}>
            <Check size={12} /> Receber
          </button>
        ) : (
          <button onClick={onMarcarNaoPago} title="Desfazer recebimento (sai da Caixa)"
                  style={btnIcon({ color: T.green })}>
            <Check size={13} />
          </button>
        )}
        <button onClick={onCobrar} title={pendente ? "Enviar cobrança no WhatsApp" : "Enviar recibo no WhatsApp"}
                style={btnIcon({ color: "#25D366" })}>
          <MessageCircle size={13} />
        </button>
        <button onClick={onPDF} title="Gerar fatura/recibo em PDF" style={btnIcon()}>
          <FileText size={13} />
        </button>
        <button onClick={onEstornar} title="Estornar" style={btnIcon({ color: T.red })}>
          ↩
        </button>
      </div>
    </div>
  );
}

function Kpi({ label, valor, sub, cor, icon: Icon }) {
  return (
    <div style={{ background: T.card, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted }}>
          {label}
        </div>
        {Icon && <Icon size={14} style={{ color: cor || T.gold, opacity: 0.7 }} />}
      </div>
      <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: cor || T.ink, fontVariantNumeric: "tabular-nums" }}>
        {valor}
      </div>
      {sub && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

const btnIcon = (overrides = {}) => ({
  background: "transparent", border: "1px solid var(--bd)",
  color: "var(--tm)", padding: 6, borderRadius: 5, cursor: "pointer",
  minWidth: 32, minHeight: 32, display: "grid", placeItems: "center",
  ...overrides,
});
