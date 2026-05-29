import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, Edit3, Check, Wrench, X, ChevronDown, ChevronRight, DollarSign, TrendingUp, Repeat, Pause, Play, Receipt, Users, FileText, MessageCircle, AlertTriangle, Sparkles } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, uid, todayISO } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import { abrirWhatsApp } from "../../../lib/whatsapp.js";
import { toPDF, toCSV } from "../../../lib/exportRelatorio.js";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import PageHeader from "../../ui/PageHeader.jsx";
import ControleAnualServicos from "./ControleAnualServicos.jsx";
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
  instaladores = [], setInstaladores,
  bancos = [], setBancos,
  caixaNegocio = { saldo: 0, historico: [] }, setCaixaNegocio,
  hidden,
}) {
  const [servicoForm, setServicoForm] = useState(null);
  const [bancoForm, setBancoForm] = useState(null);
  const [lancamentoForm, setLancamentoForm] = useState(null);
  const [bancoExpandido, setBancoExpandido] = useState(true);
  const [vendaForm, setVendaForm] = useState(null);
  const [contratoForm, setContratoForm] = useState(null);
  const [instaladorForm, setInstaladorForm] = useState(null);
  const [filtroVendas, setFiltroVendas] = useState("mes"); // mes | tudo
  const [catalogoExpandido, setCatalogoExpandido] = useState(true);
  const [contratosExpandido, setContratosExpandido] = useState(true);
  const [instaladoresExpandido, setInstaladoresExpandido] = useState(true);
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [relatorioAba, setRelatorioAba] = useState("clientes");
  const [anualExpandido, setAnualExpandido] = useState(false);
  const [faturaDoc, setFaturaDoc] = useState(null); // venda/fatura aberta no modal de PDF
  const [cobrancasAberto, setCobrancasAberto] = useState(false); // painel de cobrança em massa
  const [pagarForm, setPagarForm] = useState(null); // modal de recebimento c/ data de pagamento manual
  const [financeiroExpandido, setFinanceiroExpandido] = useState(false);
  const [finPeriodo, setFinPeriodo] = useState("ano"); // mes | 3m | ano | tudo
  const [finBusca, setFinBusca] = useState("");
  const [finPdfAberto, setFinPdfAberto] = useState(false);

  // Mês corrente YYYY-MM — usado pra controle de repasse e relatório.
  const mesCorrente = new Date().toISOString().slice(0, 7);

  // Migração/seed: o Banco do Serviço precisa de ao menos uma conta. Se estiver
  // vazio, cria a "Caixa" já com o saldo que existia na Caixa do Negócio antiga
  // (preserva o dinheiro de quem já usava o módulo).
  useEffect(() => {
    if (typeof setBancos !== "function") return;
    if ((bancos || []).length > 0) return;
    setBancos([{ id: uid(), nome: "Caixa", saldo: Number(caixaNegocio?.saldo || 0) }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bancos]);

  // Conta padrão (recebimento/saída quando nenhuma é escolhida) = a primeira.
  const bancoPadraoId = (bancos || [])[0]?.id || null;
  const nomeBanco = (id) => (bancos || []).find(b => b.id === id)?.nome || "—";

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

  // Cobranças em aberto agrupadas por CLIENTE — alimenta o painel de cobrança
  // em massa. Quem não tem cliente vinculado cai em um grupo "Sem cliente".
  const cobrancasPorCliente = useMemo(() => {
    const pend = (vendas || []).filter(v => v.pago === false);
    const map = {};
    pend.forEach(v => {
      const key = v.clienteId || "__sem__";
      const g = (map[key] = map[key] || { clienteId: v.clienteId || null, itens: [], total: 0 });
      g.itens.push(v);
      g.total += Number(v.valor || 0);
    });
    const grupos = Object.values(map).map(g => ({
      ...g,
      cliente: clientes.find(c => c.id === g.clienteId) || null,
      itens: g.itens.sort((a, b) => (a.data || "").localeCompare(b.data || "")),
    })).sort((a, b) => b.total - a.total);
    const totalGeral = grupos.reduce((s, g) => s + g.total, 0);
    const qtdGeral = pend.length;
    return { grupos, totalGeral, qtdGeral };
  }, [vendas, clientes]);

  // Financeiro: movimentações da Caixa do Negócio (entradas de receita +
  // saídas de repasse), filtradas por período/busca, com totais e série mensal.
  const financeiro = useMemo(() => {
    const hist = (caixaNegocio?.historico) || [];
    const hoje = new Date();
    const limite = (() => {
      if (finPeriodo === "tudo") return null;
      const d = new Date(hoje);
      if (finPeriodo === "mes") d.setDate(1);
      else if (finPeriodo === "3m") d.setMonth(d.getMonth() - 2, 1);
      else if (finPeriodo === "ano") d.setMonth(0, 1); // início do ano
      return d.toISOString().slice(0, 10);
    })();
    const q = finBusca.trim().toLowerCase();

    const movs = hist
      .filter(h => !limite || (h.data || "") >= limite)
      .filter(h => !q || (h.descricao || "").toLowerCase().includes(q))
      .sort((a, b) => (b.data || "").localeCompare(a.data || "") || (b.ts || "").localeCompare(a.ts || ""));

    let entradas = 0, saidas = 0;
    const porMes = {};
    movs.forEach(h => {
      const v = Number(h.valor || 0);
      const mes = (h.data || "").slice(0, 7);
      if (!mes) return;
      const m = (porMes[mes] = porMes[mes] || { mes, receita: 0, despesa: 0 });
      if (v >= 0) { entradas += v; m.receita += v; }
      else { saidas += -v; m.despesa += -v; }
    });
    const serie = Object.values(porMes)
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .map(m => ({ ...m, label: `${m.mes.slice(5)}/${m.mes.slice(2, 4)}`, lucro: m.receita - m.despesa }));

    return { movs, entradas, saidas, resultado: entradas - saidas, serie, saldoAtual: Number(caixaNegocio?.saldo || 0) };
  }, [caixaNegocio, finPeriodo, finBusca]);

  const periodoLabel = { mes: "Este mês", "3m": "Últimos 3 meses", ano: "Este ano", tudo: "Tudo" }[finPeriodo] || "";

  const exportarFinanceiroCSV = () => {
    if (financeiro.movs.length === 0) { toast.error("Sem movimentações no período."); return; }
    const tipoLabel = (t) => ({
      "venda-servico": "Receita · venda", "fatura-recorrente": "Receita · fatura",
      "pago-instalador": "Repasse colaborador", "custo-servico": "Custo/prestador",
      "ajuste-entrada": "Entrada manual", "ajuste-saida": "Saída manual",
    }[t] || t);
    const rows = financeiro.movs.map(h => ({
      Data: (h.data || "").split("-").reverse().join("/"),
      Tipo: tipoLabel(h.tipo),
      Descrição: h.descricao || "",
      Entrada: Number(h.valor || 0) > 0 ? Number(h.valor).toFixed(2).replace(".", ",") : "",
      Saída: Number(h.valor || 0) < 0 ? (-Number(h.valor)).toFixed(2).replace(".", ",") : "",
    }));
    toCSV(rows, `financeiro-servicos-${finPeriodo}.csv`);
    toast.success("CSV exportado.");
  };

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
  // Atalho: abre o form de novo serviço já com o nome pré-preenchido (presets CRM/Tráfego/App).
  const abrirServicoComNome = (nome) => setServicoForm({
    id: null, nome, descricao: "",
    precoSugerido: "", custoBase: "", ativo: true,
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

  /* ---------- Colaboradores (CRUD) ---------- */
  // Colaborador = quem executa o serviço (CRM, tráfego, app) e recebe um repasse
  // que sai do Caixa do Negócio (não toca Finanças). Diferente do Cliente, que paga.
  const abrirInstaladorNovo = () => setInstaladorForm({
    id: null, nome: "", telefone: "", obs: "", ativo: true,
  });
  const abrirInstaladorEditar = (i) => setInstaladorForm({ ...i });

  const salvarInstalador = () => {
    const nome = (instaladorForm.nome || "").trim();
    if (!nome) { toast.error("Informe o nome do colaborador."); return; }
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
    // Quantas vendas/faturas usam esse colaborador? Avisa antes de excluir.
    const usos = (vendas || []).filter(v => v.instaladorId === i.id).length;
    const ok = await confirm({
      title: `Excluir ${i.nome}?`,
      body: usos > 0
        ? `Esse colaborador está vinculado a ${usos} venda(s)/fatura(s). Os registros continuam mas perdem o vínculo. Continuar?`
        : `O cadastro de ${i.nome} será removido.`,
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    setInstaladores(instaladores.filter(x => x.id !== i.id));
    toast.success("Colaborador removido.");
  };

  // Marca/desmarca o repasse do mês corrente como pago ao colaborador.
  // Pagar = SAÍDA do Banco do Serviço (debita o acumulado do mês da conta padrão).
  // Desmarcar devolve à conta o valor exato que havia saído.
  const togglePagarInstalador = (inst) => {
    if (typeof setInstaladores !== "function") return;
    const pagos = inst.repassesPagos || [];
    const jaPago = pagos.includes(mesCorrente);
    const totalMes = saldoMesPorInstalador[inst.id] || 0;
    const novos = jaPago
      ? pagos.filter(m => m !== mesCorrente)
      : [...pagos, mesCorrente];
    setInstaladores(instaladores.map(i =>
      i.id === inst.id ? { ...i, repassesPagos: novos } : i
    ));

    if (jaPago) {
      // Desmarcar: devolve ao(s) banco(s) o que saiu p/ este colaborador no mês.
      const hist = (caixaNegocio?.historico) || [];
      const doMes = hist.filter(h => h.tipo === "pago-instalador" && h.instaladorId === inst.id && h.repasseMes === mesCorrente);
      if (doMes.length) {
        const net = doMes.reduce((s, h) => s + Number(h.valor || 0), 0); // negativo
        const porBanco = {};
        doMes.forEach(h => { if (h.bancoId) porBanco[h.bancoId] = (porBanco[h.bancoId] || 0) + Number(h.valor || 0); });
        if (typeof setBancos === "function") {
          setBancos(prev => prev.map(b => porBanco[b.id] ? { ...b, saldo: (Number(b.saldo) || 0) - porBanco[b.id] } : b));
        }
        if (typeof setCaixaNegocio === "function") {
          setCaixaNegocio(prev => ({
            saldo: (prev?.saldo || 0) - net,
            historico: ((prev?.historico) || []).filter(h => !(h.tipo === "pago-instalador" && h.instaladorId === inst.id && h.repasseMes === mesCorrente)),
          }));
        }
      }
      toast.success(`Repasse de ${inst.nome} (${mesCorrente}) desmarcado — devolvido ao Banco do Serviço.`);
    } else {
      if (totalMes > 0) {
        lancar({ bancoId: bancoPadraoId, tipo: "pago-instalador", data: todayISO(),
                 descricao: `Repasse a ${inst.nome} · ${mesCorrente}`, valor: -totalMes,
                 instaladorId: inst.id, repasseMes: mesCorrente });
      }
      toast.success(`Repasse de ${fmt(totalMes)} a ${inst.nome} pago — debitado do Banco do Serviço.`);
    }
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
    instaladorId: "",
    valorInstalador: "",
    bancoRecebimento: bancoPadraoId,
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

  /* ---------- Helpers do Banco do Serviço ---------- */
  // Lança 1 movimento numa conta do Banco do Serviço: ajusta o saldo da conta,
  // o total (caixaNegocio.saldo) e registra no histórico (extrato do Financeiro).
  // valor: + entrada / − saída. Tudo independente das Finanças do cockpit.
  const lancar = (mov) => {
    const valor = Number(mov.valor || 0);
    const bancoId = mov.bancoId || bancoPadraoId;
    if (bancoId && typeof setBancos === "function") {
      setBancos(prev => prev.map(b => b.id === bancoId ? { ...b, saldo: (Number(b.saldo) || 0) + valor } : b));
    }
    if (typeof setCaixaNegocio === "function") {
      setCaixaNegocio(prev => ({
        saldo: (prev?.saldo || 0) + valor,
        historico: [{
          id: uid(),
          tipo: mov.tipo,
          data: mov.data || todayISO(),
          descricao: mov.descricao || "",
          valor,
          bancoId: bancoId || null,
          ...(mov.vendaId ? { vendaId: mov.vendaId } : {}),
          ...(mov.contratoId ? { contratoId: mov.contratoId } : {}),
          ...(mov.instaladorId ? { instaladorId: mov.instaladorId } : {}),
          ...(mov.repasseMes ? { repasseMes: mov.repasseMes } : {}),
          ts: new Date().toISOString(),
        }, ...((prev?.historico) || [])],
      }));
    }
  };

  // Venda/fatura PAGA: a receita entra na conta de recebimento e, se houver
  // custo (pago ao prestador), sai do mesmo banco. Nada toca Finanças/Contas.
  const aplicarReceitaCaixa = (v, descricaoReceita) => {
    const bancoId = v.bancoRecebimento || bancoPadraoId;
    lancar({ bancoId, tipo: v.contratoId ? "fatura-recorrente" : "venda-servico",
             data: v.pagoEm || v.data, descricao: descricaoReceita,
             valor: Number(v.valor || 0), vendaId: v.id, contratoId: v.contratoId });
    const custo = Number(v.custo || 0);
    if (custo > 0) {
      lancar({ bancoId, tipo: "custo-servico",
               data: v.pagoEm || v.data, descricao: `Custo/prestador · ${v.nome}`,
               valor: -custo, vendaId: v.id, contratoId: v.contratoId });
    }
  };

  // Desfaz TODOS os lançamentos de uma venda/fatura (receita + custo), repondo
  // o saldo de cada conta afetada. Lê o histórico atual p/ saber os bancos.
  const reverterReceitaCaixa = (v) => {
    const hist = (caixaNegocio?.historico) || [];
    const daVenda = hist.filter(h => h.vendaId === v.id);
    if (daVenda.length === 0) return;
    const net = daVenda.reduce((s, h) => s + Number(h.valor || 0), 0);
    const porBanco = {};
    daVenda.forEach(h => { if (h.bancoId) porBanco[h.bancoId] = (porBanco[h.bancoId] || 0) + Number(h.valor || 0); });
    if (typeof setBancos === "function") {
      setBancos(prev => prev.map(b => porBanco[b.id] ? { ...b, saldo: (Number(b.saldo) || 0) - porBanco[b.id] } : b));
    }
    if (typeof setCaixaNegocio === "function") {
      setCaixaNegocio(prev => ({
        saldo: (prev?.saldo || 0) - net,
        historico: ((prev?.historico) || []).filter(h => h.vendaId !== v.id),
      }));
    }
  };

  // Marcar fatura como PAGA: receita (e custo) entram/saem do Banco do Serviço.
  // A data do pagamento é livre (default = hoje); cai na Caixa nessa data.
  const marcarFaturaPaga = (v, pagoEm = todayISO()) => {
    const cliente = clientes.find(c => c.id === v.clienteId);
    const vPago = { ...v, pago: true, pagoEm };
    setVendas((vendas || []).map(x => x.id === v.id ? vPago : x));
    aplicarReceitaCaixa(vPago, `${v.nome}${cliente ? ` · ${cliente.nome}` : ""}`);
    toast.success(`Pagamento de ${fmt(v.valor)} recebido · ${v.nome}`);
  };

  // Abre o modal de recebimento para escolher a data do pagamento (default hoje).
  const abrirPagarVenda = (v) => setPagarForm({ tipo: "single", venda: v, data: todayISO() });
  const abrirReceberTudo = (grupo) => setPagarForm({ tipo: "grupo", grupo, data: todayISO() });

  // Confirma o recebimento usando a data informada manualmente no modal.
  const confirmarPagamento = () => {
    if (!pagarForm) return;
    const pagoEm = pagarForm.data || todayISO();
    if (pagarForm.tipo === "grupo") {
      aplicarReceberTudo(pagarForm.grupo, pagoEm);
    } else {
      marcarFaturaPaga(pagarForm.venda, pagoEm);
    }
    setPagarForm(null);
  };

  // Voltar para PENDENTE: tira a receita (e custo) do Banco do Serviço.
  const marcarFaturaNaoPaga = async (v) => {
    const ok = await confirm({
      title: `Marcar "${v.nome}" como não paga?`,
      body: `A receita de ${fmt(v.valor)} sai do Banco do Serviço${Number(v.custo || 0) > 0 ? " (e o custo do prestador é desfeito)" : ""}. A cobrança volta a ficar pendente.`,
      confirmLabel: "Marcar pendente",
    });
    if (!ok) return;
    reverterReceitaCaixa(v);
    setVendas((vendas || []).map(x => x.id === v.id ? { ...x, pago: false, pagoEm: null } : x));
    toast.success("Cobrança marcada como pendente.");
  };

  /* ---------- Cobrança / recibo por WhatsApp ---------- */
  const enviarCobrancaWhatsApp = (v) => {
    const cliente = clientes.find(c => c.id === v.clienteId);
    if (!cliente) { toast.error("Vincule um cliente à venda para enviar a cobrança."); return; }
    const ref = v.faturaRef
      ? (v.faturaRef.length === 4 ? `Ano ${v.faturaRef}` : `${v.faturaRef.slice(5)}/${v.faturaRef.slice(0, 4)}`)
      : (v.data ? v.data.split("-").reverse().join("/") : "");
    const msg = v.pago
      ? `Olá ${cliente.nome}! ✅\n\nRecibo do serviço *${v.nome}*${ref ? ` (${ref})` : ""}.\nValor: *${fmt(v.valor)}* — PAGO${v.pagoEm ? ` em ${v.pagoEm.split("-").reverse().join("/")}` : ""}.\n\nObrigado pela parceria!`
      : `Olá ${cliente.nome}! 👋\n\nSegue a cobrança do serviço *${v.nome}*${ref ? ` referente a ${ref}` : ""}.\nValor: *${fmt(v.valor)}*.\n\nPode confirmar o pagamento? Qualquer dúvida estou à disposição. Obrigado!`;
    abrirWhatsApp(cliente.telefone, msg);
  };

  // Cobrança consolidada por cliente (mensagem única com todos os itens em aberto).
  const cobrarClienteWhatsApp = (grupo) => {
    if (!grupo.cliente) { toast.error("Cliente sem cadastro — vincule um cliente para cobrar."); return; }
    const linhas = grupo.itens.map(v => {
      const ref = v.faturaRef
        ? (v.faturaRef.length === 4 ? `Ano ${v.faturaRef}` : `${v.faturaRef.slice(5)}/${v.faturaRef.slice(0, 4)}`)
        : (v.data ? v.data.split("-").reverse().join("/") : "");
      return `• ${v.nome}${ref ? ` (${ref})` : ""} — ${fmt(v.valor)}`;
    }).join("\n");
    const msg = grupo.itens.length === 1
      ? `Olá ${grupo.cliente.nome}! 👋\n\nSegue a cobrança em aberto:\n${linhas}\n\nPode confirmar o pagamento? Obrigado!`
      : `Olá ${grupo.cliente.nome}! 👋\n\nSegue o resumo das suas cobranças em aberto:\n${linhas}\n\n*Total: ${fmt(grupo.total)}*\n\nPode confirmar o pagamento? Obrigado!`;
    abrirWhatsApp(grupo.cliente.telefone, msg);
  };

  // Marca TODAS as cobranças de um cliente como pagas de uma vez, na data
  // de pagamento informada manualmente (default = hoje, vinda do modal).
  const aplicarReceberTudo = (grupo, pagoEm = todayISO()) => {
    const ids = new Set(grupo.itens.map(i => i.id));
    // Um único setVendas em lote; os efeitos de caixa usam updaters funcionais.
    setVendas((vendas || []).map(x => ids.has(x.id) ? { ...x, pago: true, pagoEm } : x));
    grupo.itens.forEach(v => {
      const vPago = { ...v, pago: true, pagoEm };
      aplicarReceitaCaixa(vPago, `${v.nome}${grupo.cliente ? ` · ${grupo.cliente.nome}` : ""}`);
    });
    toast.success(`${fmt(grupo.total)} recebido de ${grupo.cliente?.nome || "cliente"}.`);
  };

  /* ---------- Banco do Serviço (contas próprias) ---------- */
  const abrirBancoNovo = () => setBancoForm({ id: null, nome: "", saldo: "" });
  const abrirBancoEditar = (b) => setBancoForm({ ...b, saldo: String(b.saldo ?? "") });
  const salvarBanco = () => {
    const nome = (bancoForm.nome || "").trim();
    if (!nome) { toast.error("Informe o nome da conta."); return; }
    const saldo = Number(bancoForm.saldo) || 0;
    if (bancoForm.id) {
      setBancos((bancos || []).map(b => b.id === bancoForm.id ? { ...b, nome, saldo } : b));
      toast.success("Conta atualizada.");
    } else {
      setBancos([...(bancos || []), { id: uid(), nome, saldo }]);
      toast.success(`Conta ${nome} criada.`);
    }
    setBancoForm(null);
  };
  const excluirBanco = async (b) => {
    if ((bancos || []).length <= 1) { toast.error("Mantenha ao menos uma conta no Banco do Serviço."); return; }
    const ok = await confirm({
      title: `Excluir a conta "${b.nome}"?`,
      body: `Saldo atual: ${fmt(b.saldo || 0)}. As movimentações antigas continuam no extrato. Continuar?`,
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    setBancos((bancos || []).filter(x => x.id !== b.id));
    toast.success("Conta removida.");
  };

  // Lançamento manual de entrada/saída numa conta (aporte, despesa avulsa, etc).
  const abrirLancamento = (tipo) => setLancamentoForm({ tipo, bancoId: bancoPadraoId, valor: "", descricao: "", data: todayISO() });
  const salvarLancamento = () => {
    const valorNum = Number(lancamentoForm.valor) || 0;
    if (valorNum <= 0) { toast.error("Informe um valor positivo."); return; }
    if (!lancamentoForm.bancoId) { toast.error("Selecione a conta."); return; }
    const ent = lancamentoForm.tipo === "entrada";
    lancar({
      bancoId: lancamentoForm.bancoId,
      tipo: ent ? "ajuste-entrada" : "ajuste-saida",
      data: lancamentoForm.data,
      descricao: (lancamentoForm.descricao || "").trim() || (ent ? "Entrada manual" : "Saída manual"),
      valor: ent ? valorNum : -valorNum,
    });
    toast.success(ent ? "Entrada lançada no Banco do Serviço." : "Saída lançada no Banco do Serviço.");
    setLancamentoForm(null);
  };

  // Estorna um lançamento do extrato. Se for de uma venda/fatura, desfaz o
  // recebimento inteiro (cobrança volta a pendente). Se for repasse, devolve e
  // reabre o repasse do mês. Se for manual, só remove e ajusta o saldo da conta.
  const estornarMovimento = async (h) => {
    const venda = h.vendaId ? (vendas || []).find(v => v.id === h.vendaId) : null;
    const ok = await confirm({
      title: "Estornar lançamento?",
      body: venda
        ? `Este lançamento faz parte da venda "${venda.nome}". Estornar desfaz o recebimento inteiro — a cobrança volta a ficar pendente.`
        : `O lançamento de ${fmt(Math.abs(Number(h.valor || 0)))} será removido e o saldo da conta ajustado.`,
      danger: true, confirmLabel: "Estornar",
    });
    if (!ok) return;

    if (venda) {
      reverterReceitaCaixa(venda);
      setVendas((vendas || []).map(v => v.id === venda.id ? { ...v, pago: false, pagoEm: null } : v));
      toast.success("Recebimento estornado — a cobrança voltou a pendente.");
      return;
    }

    // Repasse a colaborador: reabre o repasse do mês ao remover.
    if (h.tipo === "pago-instalador" && h.instaladorId && h.repasseMes && typeof setInstaladores === "function") {
      setInstaladores(prev => prev.map(i => i.id === h.instaladorId
        ? { ...i, repassesPagos: (i.repassesPagos || []).filter(m => m !== h.repasseMes) }
        : i));
    }
    // Remove o movimento e ajusta saldo da conta + total.
    if (h.bancoId && typeof setBancos === "function") {
      setBancos(prev => prev.map(b => b.id === h.bancoId ? { ...b, saldo: (Number(b.saldo) || 0) - Number(h.valor || 0) } : b));
    }
    if (typeof setCaixaNegocio === "function") {
      setCaixaNegocio(prev => ({
        saldo: (prev?.saldo || 0) - Number(h.valor || 0),
        historico: ((prev?.historico) || []).filter(x => x.id !== h.id),
      }));
    }
    toast.success("Lançamento estornado.");
  };

  const confirmarVenda = () => {
    const nome = (vendaForm.nome || "").trim();
    const valor = Number(vendaForm.valor);
    // Custo único = repasse ao colaborador; venda avulsa não tem campo de custo.
    const custo = 0;
    if (!nome) { toast.error("Informe o nome do serviço."); return; }
    if (!Number.isFinite(valor) || valor <= 0) { toast.error("Valor inválido."); return; }

    const cliente = clientes.find(c => c.id === vendaForm.clienteId);
    const partes = [nome];
    if (cliente) partes.push(cliente.nome);

    const servicosIds = vendaForm.servicosIds || [];
    const primaryServicoId = servicosIds[0] || null;

    // Colaborador opcional: guarda o vínculo + valor a repassar. O repasse NÃO
    // sai do Caixa agora — fica pendente e só sai quando você clicar em "Pagar".
    const valorInst = Number(vendaForm.valorInstalador) || 0;
    const temInstalador = !!vendaForm.instaladorId && valorInst > 0;

    const bancoRecebimento = vendaForm.bancoRecebimento || bancoPadraoId;
    const novaVenda = {
      id: uid(),
      servicoId: primaryServicoId, // retrocompat
      servicosIds,
      nome,
      data: vendaForm.data,
      valor, custo,
      clienteId: vendaForm.clienteId || null,
      veiculoId: null,
      instaladorId: temInstalador ? vendaForm.instaladorId : null,
      valorInstalador: temInstalador ? valorInst : 0,
      contaDestino: "Caixa do Negócio",
      bancoRecebimento,
      pago: true,             // venda avulsa = recebida na hora
      pagoEm: vendaForm.data,
      obs: (vendaForm.obs || "").trim(),
    };

    // Venda avulsa entra paga: receita (e custo, se houver) movimentam o Banco
    // do Serviço na conta de recebimento. Nada toca Finanças/Contas do cockpit.
    aplicarReceitaCaixa(novaVenda, `Serviço · ${partes.join(" · ")}`);

    setVendas([novaVenda, ...vendas]);
    setVendaForm(null);
    const lucro = valor - custo - (temInstalador ? valorInst : 0);
    toast.success(`Serviço registrado · lucro ${fmt(lucro)}${temInstalador ? " (repasse ao colaborador fica pendente)" : ""}`);
  };

  const estornarVenda = async (v) => {
    const isCaixaVirtual = v.contaDestino === "Caixa do Negócio";
    // Contrato: basta ter contratoId (faturaRef pode faltar em registros legados).
    const ehDeContrato = !!v.contratoId;
    const foiPago = v.pago !== false; // legacy/avulsa sem campo = considerado pago
    const ok = await confirm({
      title: `Estornar ${ehDeContrato ? "fatura" : "venda"} de ${v.nome}?`,
      body: !foiPago
        ? `A cobrança pendente de ${fmt(v.valor)} será removida${ehDeContrato ? " e o contrato volta a permitir gerar a fatura desse mês" : ""}.`
        : isCaixaVirtual
          ? `A venda de ${fmt(v.valor)} será removida da Caixa do Negócio${ehDeContrato ? " e o contrato volta a permitir gerar a fatura desse mês" : ""}.`
          : `A venda de ${fmt(v.valor)} será removida, o saldo de ${v.contaDestino} ajustado e a transação no Finanças removida.`,
      danger: true, confirmLabel: "Estornar",
    });
    if (!ok) return;

    // Só reverte dinheiro se a venda/fatura tinha sido efetivamente paga.
    // Tudo no Banco do Serviço (receita + custo), nada toca Finanças.
    if (foiPago) reverterReceitaCaixa(v);

    // Se a venda veio de um contrato recorrente, reabilita o "Gerar fatura"
    // desse mês — limpa ultimaFaturaRef. Robusto: limpa se bate com a fatura
    // estornada OU com a competência atual OU se a venda não tinha faturaRef
    // (registros legados) — assim o botão "Gerar fatura" sempre reabilita.
    if (ehDeContrato && typeof setContratos === "function") {
      setContratos((contratos || []).map(c => {
        if (c.id !== v.contratoId) return c;
        const refHoje = refAtual(c.recorrencia);
        const deveLimpar = !v.faturaRef
          || c.ultimaFaturaRef === v.faturaRef
          || c.ultimaFaturaRef === refHoje;
        return deveLimpar ? { ...c, ultimaFaturaRef: null } : c;
      }));
    }

    setVendas(vendas.filter(x => x.id !== v.id));
    toast.success(ehDeContrato
      ? "Venda estornada — você já pode gerar a fatura desse mês de novo."
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
    bancoRecebimento: bancoPadraoId,
    recorrencia: "mensal", // mensal | anual
    dataInicio: todayISO(),
    duracaoMeses: "", // vazio = indeterminado
    instaladorId: "",
    valorInstalador: "",
    obs: "",
    ativo: true,
  });

  const abrirContratoEditar = (c) => {
    setContratoForm({
      ...c,
      servicosIds: c.servicosIds || (c.servicoId ? [c.servicoId] : []),
      valor: String(c.valor ?? ""),
      custo: String(c.custo ?? ""),
      bancoRecebimento: c.bancoRecebimento || bancoPadraoId,
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
    if (!nome) { toast.error("Informe o nome do contrato."); return; }
    if (!contratoForm.clienteId) { toast.error("Selecione um cliente."); return; }
    if (!Number.isFinite(valor) || valor <= 0) { toast.error("Valor inválido."); return; }

    const duracaoMesesN = parseInt(contratoForm.duracaoMeses, 10);
    const valorInstN = Number(contratoForm.valorInstalador) || 0;
    const temInstalador = !!contratoForm.instaladorId && valorInstN > 0;
    const dados = {
      ...contratoForm,
      // O custo do contrato agora é só o repasse ao colaborador (campo único).
      nome, valor, custo: 0,
      servicosIds: contratoForm.servicosIds || [],
      bancoRecebimento: contratoForm.bancoRecebimento || bancoPadraoId,
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
    // move agora — receita (e custo) só entram no Banco do Serviço quando você
    // marcar como paga. Snapshot do banco de recebimento e do custo.
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
      bancoRecebimento: c.bancoRecebimento || bancoPadraoId,
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
            {cobrancasPorCliente.qtdGeral > 0 && (
              <button onClick={() => setCobrancasAberto(true)}
                      title="Ver e cobrar todas as faturas em aberto"
                      style={{
                        background: `${T.red}18`, border: `1px solid ${T.red}`, color: T.red,
                        padding: "8px 14px", borderRadius: 6, cursor: "pointer",
                        fontFamily: T.sans, fontSize: 12, fontWeight: 600,
                        display: "inline-flex", alignItems: "center", gap: 6,
                      }}>
                <AlertTriangle size={14} /> Cobranças ({cobrancasPorCliente.qtdGeral})
              </button>
            )}
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

      {/* CONTROLE ANUAL · A RECEBER E A PAGAR */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: 14, marginBottom: 14,
      }}>
        <button onClick={() => setAnualExpandido(v => !v)}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0,
                         display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: T.gold }}>
            {anualExpandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span className="label-eyebrow">📅 Controle anual · a receber e a pagar</span>
        </button>
        {anualExpandido && (
          <div style={{ marginTop: 12 }}>
            <ControleAnualServicos
              vendas={vendas}
              contratos={contratos}
              instaladores={instaladores}
              hidden={hidden}
            />
          </div>
        )}
      </div>

      {/* BANCO DO SERVIÇO · contas próprias */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: 14, marginBottom: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <button onClick={() => setBancoExpandido(v => !v)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0,
                           display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: T.gold }}>
              {bancoExpandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span className="label-eyebrow">🏦 Banco do Serviço ({(bancos || []).length} conta{(bancos || []).length !== 1 ? "s" : ""})</span>
          </button>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="num" style={{ fontSize: 13, color: T.gold, fontWeight: 600 }}>
              Total: {hidden ? "•••" : fmt((bancos || []).reduce((s, b) => s + Number(b.saldo || 0), 0))}
            </span>
            <button onClick={abrirBancoNovo}
              style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted,
                       padding: "5px 10px", borderRadius: 5, cursor: "pointer", fontSize: 10,
                       letterSpacing: ".05em", textTransform: "uppercase" }}>
              <Plus size={11} className="inline mr-1" /> Conta
            </button>
          </div>
        </div>

        {bancoExpandido && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <button onClick={() => abrirLancamento("entrada")} className="btn-ghost" style={{ fontSize: 11, color: T.green, borderColor: T.green }}>
                + Entrada
              </button>
              <button onClick={() => abrirLancamento("saida")} className="btn-ghost" style={{ fontSize: 11, color: T.red, borderColor: T.red }}>
                − Saída
              </button>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              {(bancos || []).map(b => (
                <div key={b.id} style={{
                  display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center",
                  padding: "8px 10px", borderRadius: 5, background: T.bgSoft,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{b.nome}</span>
                  <span className="num" style={{ fontSize: 13, fontWeight: 600, color: Number(b.saldo || 0) >= 0 ? T.gold : T.red }}>
                    {hidden ? "•••" : fmt(b.saldo || 0)}
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => abrirBancoEditar(b)} title="Editar" style={btnIcon()}><Edit3 size={12} /></button>
                    <button onClick={() => excluirBanco(b)} title="Excluir" style={btnIcon({ color: T.red })}><Trash2 size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FINANCEIRO · CAIXA DO NEGÓCIO */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: 14, marginBottom: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <button onClick={() => setFinanceiroExpandido(v => !v)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0,
                           display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: T.gold }}>
              {financeiroExpandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <DollarSign size={14} style={{ color: T.gold }} />
            <span className="label-eyebrow">Financeiro · Caixa do Negócio</span>
          </button>
          <span className="num" style={{ fontSize: 13, color: T.gold, fontWeight: 600 }}>
            Saldo: {hidden ? "•••" : fmt(financeiro.saldoAtual)}
          </span>
        </div>

        {financeiroExpandido && (
          <div style={{ marginTop: 12 }}>
            {/* Controles */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 4 }}>
                {[{ id: "mes", l: "Mês" }, { id: "3m", l: "3 meses" }, { id: "ano", l: "Ano" }, { id: "tudo", l: "Tudo" }].map(o => (
                  <button key={o.id} onClick={() => setFinPeriodo(o.id)}
                    style={{
                      padding: "5px 12px", fontSize: 10.5, letterSpacing: ".04em", textTransform: "uppercase",
                      borderRadius: 5, cursor: "pointer", fontWeight: 600,
                      background: finPeriodo === o.id ? `${T.gold}22` : "transparent",
                      border: `1px solid ${finPeriodo === o.id ? T.gold : T.border}`,
                      color: finPeriodo === o.id ? T.gold : T.muted,
                    }}>
                    {o.l}
                  </button>
                ))}
              </div>
              <input value={finBusca} onChange={e => setFinBusca(e.target.value)}
                     placeholder="Buscar na descrição…"
                     style={{ flex: 1, minWidth: 140, padding: "6px 10px", fontSize: 12,
                              background: T.bg, color: T.ink, border: `1px solid ${T.border}`, borderRadius: 5 }} />
              <button onClick={exportarFinanceiroCSV} className="btn-ghost" style={{ fontSize: 11 }}>
                <FileText size={12} className="inline mr-1" /> CSV
              </button>
              <button onClick={() => setFinPdfAberto(true)} className="btn-ghost" style={{ fontSize: 11 }}>
                <FileText size={12} className="inline mr-1" /> PDF
              </button>
            </div>

            {/* Totais do período */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
              <FinTotal label="Entradas" valor={financeiro.entradas} cor={T.green} hidden={hidden} />
              <FinTotal label="Saídas (repasses)" valor={financeiro.saidas} cor={T.red} hidden={hidden} />
              <FinTotal label="Resultado" valor={financeiro.resultado} cor={financeiro.resultado >= 0 ? T.green : T.red} hidden={hidden} />
            </div>

            {/* Gráfico mensal receita x despesa */}
            {financeiro.serie.length > 0 ? (
              <div style={{ width: "100%", height: 200, marginBottom: 12 }}>
                <ResponsiveContainer>
                  <BarChart data={financeiro.serie} margin={{ top: 6, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid stroke={T.border} strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: T.muted, fontSize: 10 }} stroke={T.border} />
                    <YAxis tick={{ fill: T.muted, fontSize: 10 }} stroke={T.border}
                           tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                    <Tooltip
                      contentStyle={{ background: T.card, border: `1px solid ${T.border}`, fontSize: 11, color: T.ink }}
                      formatter={(v, k) => [fmt(v), k === "receita" ? "Receita" : "Despesa"]} />
                    <Legend wrapperStyle={{ fontSize: 11 }} formatter={(k) => k === "receita" ? "Receita" : "Despesa"} />
                    <Bar dataKey="receita" fill={T.green} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="despesa" fill={T.red} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ padding: 18, fontSize: 12, color: T.faint, fontStyle: "italic", textAlign: "center" }}>
                Sem movimentações no período.
              </div>
            )}

            {/* Extrato */}
            {financeiro.movs.length > 0 && (
              <div style={{ border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
                {financeiro.movs.slice(0, 200).map((h, i) => {
                  const v = Number(h.valor || 0);
                  const entrada = v >= 0;
                  return (
                    <div key={h.id || i} style={{
                      display: "grid", gridTemplateColumns: "58px 1fr auto 28px", gap: 10, alignItems: "center",
                      padding: "7px 10px", borderTop: i === 0 ? "none" : `1px solid ${T.border}`,
                      background: i % 2 ? T.bgSoft : "transparent",
                    }}>
                      <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.faint }}>
                        {(h.data || "").split("-").reverse().slice(0, 2).join("/")}
                      </span>
                      <span style={{ fontSize: 12, color: T.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {h.descricao || (entrada ? "Receita" : "Repasse")}
                      </span>
                      <span className="num" style={{ fontSize: 12.5, fontWeight: 600, color: entrada ? T.green : T.red }}>
                        {entrada ? "+" : "−"} {hidden ? "•••" : fmt(Math.abs(v))}
                      </span>
                      <button onClick={() => estornarMovimento(h)} title="Estornar lançamento"
                              style={{
                                background: "transparent", border: "none", cursor: "pointer",
                                color: T.muted, padding: 2, display: "grid", placeItems: "center",
                                fontSize: 13, lineHeight: 1,
                              }}>
                        ↩
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
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
            <div style={{ padding: 18, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: T.faint, fontStyle: "italic", marginBottom: 12 }}>
                Catálogo vazio. Crie seus serviços (CRM, Tráfego Pago, App…) pra acelerar contratos e vendas.
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {["CRM", "Tráfego Pago", "App"].map(nome => (
                  <button key={nome} onClick={() => abrirServicoComNome(nome)}
                    style={{
                      background: `${T.gold}22`, border: `1px solid ${T.gold}66`,
                      color: T.gold, padding: "6px 14px", borderRadius: 100, cursor: "pointer",
                      fontSize: 11.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5,
                    }}>
                    <Plus size={12} /> {nome}
                  </button>
                ))}
              </div>
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
                          const nomeInst = inst?.nome || "colaborador";
                          return (
                            <span title={`Pago a ${nomeInst} a cada fatura: ${fmt(valorInstContrato)}`}>
                              🧑‍💻 {nomeInst} · {hidden ? "•••" : `${fmt(valorInstContrato)}/fatura`}
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

      {/* COLABORADORES */}
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
            <Users size={14} style={{ color: T.gold }} />
            <span className="label-eyebrow">
              Colaboradores ({(instaladores || []).filter(i => i.ativo !== false).length} ativos)
            </span>
          </button>
          <button onClick={abrirInstaladorNovo}
            style={{
              background: "transparent", border: `1px solid ${T.border}`,
              color: T.muted, padding: "5px 10px", borderRadius: 5, cursor: "pointer",
              fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase",
            }}>
            <Plus size={11} className="inline mr-1" /> Novo colaborador
          </button>
        </div>

        {instaladoresExpandido && (
          (instaladores || []).length === 0 ? (
            <div style={{ padding: 18, fontSize: 12, color: T.faint, fontStyle: "italic", textAlign: "center" }}>
              Nenhum colaborador cadastrado. Use pra registrar quem executa o serviço (CRM, tráfego, app) e quanto recebe (sai do Caixa do Negócio).
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
                                title="Marcar repasse do mês como pago ao colaborador"
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
                      instalador={v.instaladorId ? instaladores.find(i => i.id === v.instaladorId) : null}
                      servicos={servicos}
                      hidden={hidden}
                      onMarcarPago={() => abrirPagarVenda(v)}
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
                     placeholder="Ex.: Gestão de tráfego" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Valor (R$)" required>
                <input type="number" step="0.01" value={vendaForm.valor}
                       onChange={e => setVendaForm({ ...vendaForm, valor: e.target.value })} />
              </Field>
              <Field label="Data" required>
                <input type="date" value={vendaForm.data}
                       onChange={e => setVendaForm({ ...vendaForm, data: e.target.value })} />
              </Field>
            </div>
            <Field label="Cliente">
              <select value={vendaForm.clienteId}
                      onChange={e => setVendaForm({ ...vendaForm, clienteId: e.target.value })}>
                <option value="">— sem cliente vinculado —</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Colaborador (opcional)" hint="Quem executou o serviço">
                <select value={vendaForm.instaladorId || ""}
                        onChange={e => setVendaForm({ ...vendaForm, instaladorId: e.target.value })}>
                  <option value="">— sem colaborador —</option>
                  {instaladores.filter(i => i.ativo !== false).map(i => (
                    <option key={i.id} value={i.id}>{i.nome}</option>
                  ))}
                </select>
              </Field>
              <Field label="Repasse ao colaborador (R$)" hint="Sai do Banco do Serviço (ao pagar o repasse)">
                <input type="number" step="0.01" value={vendaForm.valorInstalador || ""}
                       onChange={e => setVendaForm({ ...vendaForm, valorInstalador: e.target.value })}
                       placeholder="0,00"
                       disabled={!vendaForm.instaladorId} />
              </Field>
            </div>
            <Field label="Conta de recebimento (Banco do Serviço)">
              <select value={vendaForm.bancoRecebimento || ""}
                      onChange={e => setVendaForm({ ...vendaForm, bancoRecebimento: e.target.value })}>
                {(bancos || []).length === 0 && <option value="">Caixa</option>}
                {(bancos || []).map(b => (
                  <option key={b.id} value={b.id}>{b.nome} · {fmt(b.saldo || 0)}</option>
                ))}
              </select>
            </Field>
            <div style={{
              padding: "10px 12px", marginBottom: 4, borderRadius: 6,
              background: `${T.gold}11`, border: `1px solid ${T.gold}33`,
              fontSize: 12, color: T.muted,
            }}>
              <span style={{ color: T.muted }}>Recebe em:</span>{" "}
              <strong style={{ color: T.gold }}>→ {nomeBanco(vendaForm.bancoRecebimento || bancoPadraoId)} (Banco do Serviço)</strong>
              <div style={{ fontSize: 10.5, color: T.faint, marginTop: 3, fontStyle: "italic" }}>
                Tudo no Banco do Serviço, independente das Finanças do cockpit.
                {vendaForm.instaladorId && Number(vendaForm.valorInstalador) > 0 && (
                  <> Repasse ao colaborador fica pendente e só sai quando você clicar em "Pagar".</>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Valor (R$)" required>
              <input type="number" step="0.01" value={contratoForm.valor}
                     onChange={e => setContratoForm({ ...contratoForm, valor: e.target.value })}
                     placeholder="200" />
            </Field>
            <Field label="Recorrência" required>
              <select value={contratoForm.recorrencia}
                      onChange={e => setContratoForm({ ...contratoForm, recorrencia: e.target.value })}>
                <option value="mensal">Mensal</option>
                <option value="anual">Anual</option>
              </select>
            </Field>
          </div>
          <Field label="Conta de recebimento (Banco do Serviço)">
            <select value={contratoForm.bancoRecebimento || ""}
                    onChange={e => setContratoForm({ ...contratoForm, bancoRecebimento: e.target.value })}>
              {(bancos || []).length === 0 && <option value="">Caixa</option>}
              {(bancos || []).map(b => (
                <option key={b.id} value={b.id}>{b.nome}</option>
              ))}
            </select>
          </Field>
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
            <Field label="Colaborador (opcional)" hint="Quem executa o serviço a cada fatura">
              <select value={contratoForm.instaladorId || ""}
                      onChange={e => setContratoForm({ ...contratoForm, instaladorId: e.target.value })}>
                <option value="">— sem colaborador —</option>
                {instaladores.filter(i => i.ativo !== false).map(i => (
                  <option key={i.id} value={i.id}>{i.nome}</option>
                ))}
              </select>
            </Field>
            <Field label="Repasse ao colaborador (R$/fatura)" hint="Sai do Caixa do Negócio a cada faturamento">
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
                <> Repasse ao colaborador acumula como "a pagar" e só sai do Caixa quando você clicar em "Pagar" no mês.</>
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
            💡 Ao <strong style={{ color: T.ink }}>receber</strong> a fatura, a receita entra na conta escolhida do <strong style={{ color: T.ink }}>Banco do Serviço</strong> e o <strong style={{ color: T.ink }}>pago ao prestador</strong> sai da mesma conta. Nada toca as Finanças do cockpit.
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

      {/* MODAL: colaborador */}
      {instaladorForm && (
        <Modal title={instaladorForm.id ? "Editar colaborador" : "Novo colaborador"}
               onClose={() => setInstaladorForm(null)}>
          <Field label="Nome" required>
            <input value={instaladorForm.nome}
                   onChange={e => setInstaladorForm({ ...instaladorForm, nome: e.target.value })}
                   placeholder="Ex.: Gabriel" autoFocus />
          </Field>
          <Field label="Telefone">
            <input value={instaladorForm.telefone}
                   onChange={e => setInstaladorForm({ ...instaladorForm, telefone: e.target.value })}
                   placeholder="(00) 00000-0000" />
          </Field>
          <Field label="Observações">
            <textarea value={instaladorForm.obs} rows={2}
                      onChange={e => setInstaladorForm({ ...instaladorForm, obs: e.target.value })}
                      placeholder="Função (tráfego, CRM, dev), faixa de valor, contexto..."
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
              nome: inst?.nome || "(colaborador removido)",
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
              {[{ id: "clientes", l: "Clientes" }, { id: "instaladores", l: "Colaboradores" }].map(o => (
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
                  Nenhum serviço com colaborador em {refLabel}.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Colaborador</th>
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

      {/* MODAL: financeiro em PDF */}
      {finPdfAberto && (
        <FinanceiroDocModal
          financeiro={financeiro}
          periodoLabel={periodoLabel}
          onClose={() => setFinPdfAberto(false)}
        />
      )}

      {/* MODAL: conta do Banco do Serviço */}
      {bancoForm && (
        <Modal title={bancoForm.id ? "Editar conta" : "Nova conta do Banco do Serviço"}
               onClose={() => setBancoForm(null)}>
          <Field label="Nome da conta" required>
            <input value={bancoForm.nome} autoFocus
                   onChange={e => setBancoForm({ ...bancoForm, nome: e.target.value })}
                   placeholder="Ex.: Caixa · Conta PIX · Banco Inter" />
          </Field>
          <Field label="Saldo atual (R$)" hint="Saldo inicial / atual desta conta">
            <input type="number" step="0.01" value={bancoForm.saldo}
                   onChange={e => setBancoForm({ ...bancoForm, saldo: e.target.value })}
                   placeholder="0,00" />
          </Field>
          <div className="flex gap-3 justify-end mt-6">
            <button className="btn-ghost" onClick={() => setBancoForm(null)}>Cancelar</button>
            <button className="btn-gold" onClick={salvarBanco}>
              <Check size={13} className="inline mr-1" /> {bancoForm.id ? "Salvar" : "Criar conta"}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL: lançamento manual (entrada/saída) */}
      {lancamentoForm && (
        <Modal title={lancamentoForm.tipo === "entrada" ? "Nova entrada" : "Nova saída"}
               onClose={() => setLancamentoForm(null)}>
          <Field label="Conta" required>
            <select value={lancamentoForm.bancoId || ""}
                    onChange={e => setLancamentoForm({ ...lancamentoForm, bancoId: e.target.value })}>
              {(bancos || []).map(b => (
                <option key={b.id} value={b.id}>{b.nome} · {fmt(b.saldo || 0)}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Valor (R$)" required>
              <input type="number" step="0.01" value={lancamentoForm.valor} autoFocus
                     onChange={e => setLancamentoForm({ ...lancamentoForm, valor: e.target.value })}
                     placeholder="0,00" />
            </Field>
            <Field label="Data" required>
              <input type="date" value={lancamentoForm.data}
                     onChange={e => setLancamentoForm({ ...lancamentoForm, data: e.target.value })} />
            </Field>
          </div>
          <Field label="Descrição">
            <input value={lancamentoForm.descricao}
                   onChange={e => setLancamentoForm({ ...lancamentoForm, descricao: e.target.value })}
                   placeholder={lancamentoForm.tipo === "entrada" ? "Ex.: Aporte, reembolso…" : "Ex.: Despesa, ferramenta, taxa…"} />
          </Field>
          <div className="flex gap-3 justify-end mt-6">
            <button className="btn-ghost" onClick={() => setLancamentoForm(null)}>Cancelar</button>
            <button className="btn-gold" onClick={salvarLancamento}>
              <Check size={13} className="inline mr-1" /> Lançar
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL: cobrança em massa (cobranças em aberto por cliente) */}
      {cobrancasAberto && (
        <Modal title={`Cobranças em aberto · ${fmt(cobrancasPorCliente.totalGeral)}`}
               onClose={() => setCobrancasAberto(false)} wide>
          {cobrancasPorCliente.grupos.length === 0 ? (
            <div style={{ padding: 28, fontSize: 13, color: T.faint, fontStyle: "italic", textAlign: "center" }}>
              🎉 Nenhuma cobrança em aberto — tudo recebido!
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>
                {cobrancasPorCliente.qtdGeral} cobrança{cobrancasPorCliente.qtdGeral !== 1 ? "s" : ""} pendente{cobrancasPorCliente.qtdGeral !== 1 ? "s" : ""},
                totalizando <strong style={{ color: T.red }}>{hidden ? "•••" : fmt(cobrancasPorCliente.totalGeral)}</strong> a receber.
              </div>
              <div style={{ display: "grid", gap: 10, maxHeight: "60vh", overflowY: "auto" }}>
                {cobrancasPorCliente.grupos.map((g, gi) => (
                  <div key={g.clienteId || `sem-${gi}`} style={{
                    background: T.bgSoft, border: `1px solid ${T.border}`,
                    borderLeft: `3px solid ${T.red}`, borderRadius: 8, padding: 12,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>
                          {g.cliente?.nome || "Sem cliente vinculado"}
                        </div>
                        <div style={{ fontSize: 11, color: T.muted }}>
                          {g.itens.length} cobrança{g.itens.length !== 1 ? "s" : ""} · {g.cliente?.telefone || "sem telefone"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span className="num" style={{ fontSize: 15, fontWeight: 700, color: T.red }}>
                          {hidden ? "•••" : fmt(g.total)}
                        </span>
                        <button onClick={() => cobrarClienteWhatsApp(g)}
                                disabled={!g.cliente}
                                title={g.cliente ? "Cobrar no WhatsApp (mensagem com todos os itens)" : "Cliente sem cadastro"}
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  background: g.cliente ? "#25D366" : T.border, border: "none",
                                  color: "#fff", padding: "0 10px", height: 30, borderRadius: 5,
                                  cursor: g.cliente ? "pointer" : "not-allowed",
                                  fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase",
                                  opacity: g.cliente ? 1 : 0.5,
                                }}>
                          <MessageCircle size={12} /> Cobrar
                        </button>
                        <button onClick={() => abrirReceberTudo(g)}
                                title="Marcar todas as cobranças deste cliente como pagas"
                                style={{
                                  display: "inline-flex", alignItems: "center", gap: 4,
                                  background: T.green, border: "none", color: "#fff",
                                  padding: "0 10px", height: 30, borderRadius: 5, cursor: "pointer",
                                  fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase",
                                }}>
                          <Check size={12} /> Receber tudo
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 4 }}>
                      {g.itens.map(v => {
                        const ref = v.faturaRef
                          ? (v.faturaRef.length === 4 ? `Ano ${v.faturaRef}` : `${v.faturaRef.slice(5)}/${v.faturaRef.slice(0, 4)}`)
                          : (v.data ? v.data.split("-").reverse().slice(0, 2).join("/") : "");
                        return (
                          <div key={v.id} style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                            fontSize: 12, color: T.muted, paddingTop: 4, borderTop: `1px dashed ${T.border}`,
                          }}>
                            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {v.nome}{ref ? ` · ${ref}` : ""}
                            </span>
                            <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                              <span className="num" style={{ color: T.ink, fontWeight: 600 }}>{hidden ? "•••" : fmt(v.valor)}</span>
                              <button onClick={() => abrirPagarVenda(v)} title="Marcar esta como paga"
                                      style={btnIcon({ color: T.green, minWidth: 26, minHeight: 26, padding: 3 })}>
                                <Check size={12} />
                              </button>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="flex gap-3 justify-end mt-6">
            <button className="btn-ghost" onClick={() => setCobrancasAberto(false)}>Fechar</button>
          </div>
        </Modal>
      )}

      {/* MODAL: receber pagamento — data do pagamento livre p/ digitar manualmente */}
      {pagarForm && (() => {
        const ehGrupo = pagarForm.tipo === "grupo";
        const total = ehGrupo
          ? Number(pagarForm.grupo?.total || 0)
          : Number(pagarForm.venda?.valor || 0);
        const titulo = ehGrupo
          ? `Receber ${fmt(total)} de ${pagarForm.grupo?.cliente?.nome || "cliente"}`
          : `Receber ${fmt(total)} · ${pagarForm.venda?.nome || ""}`;
        const descricao = ehGrupo
          ? `${pagarForm.grupo?.itens?.length || 0} cobrança(s) serão marcadas como pagas e a receita entra na Caixa do Negócio na data informada.`
          : "A receita entra na Caixa do Negócio na data informada abaixo.";
        return (
          <Modal title="Receber pagamento" onClose={() => setPagarForm(null)}>
            <div style={{ fontSize: 13, color: T.ink, fontWeight: 600, marginBottom: 4 }}>{titulo}</div>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>{descricao}</div>
            <Field label="Data do pagamento" required hint="Pode ser anterior ou posterior a hoje.">
              <input type="date" value={pagarForm.data} autoFocus
                     onChange={e => setPagarForm({ ...pagarForm, data: e.target.value })} />
            </Field>
            <div className="flex gap-3 justify-end mt-6">
              <button className="btn-ghost" onClick={() => setPagarForm(null)}>Cancelar</button>
              <button className="btn-gold" onClick={confirmarPagamento} disabled={!pagarForm.data}>
                <Check size={13} className="inline mr-1" /> {ehGrupo ? "Receber tudo" : "Receber"}
              </button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

function VendaRow({ venda: v, cliente, instalador, servicos = [], hidden,
                   onMarcarPago, onMarcarNaoPago, onCobrar, onPDF, onEstornar }) {
  // Lucro: além de custo, desconta também o repasse ao colaborador (saída
  // virtual da Caixa). Backward-compat: vendas sem colaborador → valorInst 0.
  const valorInst = Number(v.valorInstalador || 0);
  const lucro = Number(v.valor || 0) - Number(v.custo || 0) - valorInst;
  // Retrocompat: vendas antigas com servicoId; vendas novas com servicosIds[]
  const servicosVinc = v.servicosIds || (v.servicoId ? [v.servicoId] : []);
  const qtdServicos = servicosVinc.length;
  // Chip do colaborador: só renderiza se a venda tem instaladorId — não
  // depende de o cadastro ainda existir (fallback pra "colaborador").
  const temInstalador = !!v.instaladorId && valorInst > 0;
  const nomeInst = instalador?.nome || (temInstalador ? "colaborador" : "");
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
          {temInstalador && (
            <span title={`Repasse a ${nomeInst}: ${fmt(valorInst)} (sai do Caixa do Negócio)`}>
              🧑‍💻 {nomeInst} · {hidden ? "•••" : `repasse ${fmt(valorInst)}`}
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

          <div style={{
            display: "inline-block", marginBottom: 16, padding: "4px 12px", borderRadius: 4,
            fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase",
            background: pendente ? "#fde2e2" : "#dcf5e3", color: pendente ? "#b42318" : "#137a3b",
            border: `1px solid ${pendente ? "#f0a9a3" : "#9ad9b3"}`,
          }}>
            {pendente ? "● Pagamento pendente" : `✓ Pago${v.pagoEm ? ` em ${v.pagoEm.split("-").reverse().join("/")}` : ""}`}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "#888", marginBottom: 4 }}>Cobrar de</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{cliente?.nome || "Cliente não informado"}</div>
            {cliente?.doc && <div style={{ fontSize: 12, color: "#555" }}>{cliente.doc}</div>}
            {cliente?.email && <div style={{ fontSize: 12, color: "#555" }}>{cliente.email}</div>}
            {cliente?.telefone && <div style={{ fontSize: 12, color: "#555" }}>{cliente.telefone}</div>}
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 6, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{v.nome}</div>
            {itens.length > 0 && (
              <ul style={{ margin: "0 0 8px 18px", padding: 0, fontSize: 12.5, color: "#444" }}>
                {itens.map((nome, i) => <li key={i}>{nome}</li>)}
              </ul>
            )}
            {v.obs && <div style={{ fontSize: 11.5, color: "#777", fontStyle: "italic", marginBottom: 8 }}>{v.obs}</div>}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#222" }}>
              <span style={{ color: "#666" }}>Competência</span>
              <span style={{ fontWeight: 600 }}>{refLabel}</span>
            </div>
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

function FinTotal({ label, valor, cor, hidden }) {
  return (
    <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 10px" }}>
      <div style={{ fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, marginBottom: 3 }}>
        {label}
      </div>
      <div className="num" style={{ fontSize: 16, fontWeight: 700, color: cor }}>
        {hidden ? "•••" : fmt(valor)}
      </div>
    </div>
  );
}

// Documento imprimível do financeiro (resumo + série mensal + extrato).
// Portal direto no body pra que o toPDF (print-only-this) isole só este card.
function FinanceiroDocModal({ financeiro, periodoLabel, onClose }) {
  const empresa = (() => {
    try { return localStorage.getItem("af4:empresa-nome") || "Âncora"; }
    catch { return "Âncora"; }
  })();
  const tipoLabel = (t) => ({
    "venda-servico": "Receita · venda", "fatura-recorrente": "Receita · fatura",
    "pago-instalador": "Repasse colaborador", "custo-servico": "Custo/prestador",
    "ajuste-entrada": "Entrada manual", "ajuste-saida": "Saída manual",
  }[t] || t);
  const emissao = new Date().toLocaleDateString("pt-BR");

  const content = (
    <div className="modal-overlay-bg" onClick={onClose}
         style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.6)",
                  display: "grid", placeItems: "center", padding: 20, overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()}
           style={{ width: "min(680px, 100%)", maxHeight: "92vh", overflowY: "auto", background: "#fff", borderRadius: 10 }}>
        <div id="financeiro-doc-print" style={{ padding: 28, color: "#111", background: "#fff", fontFamily: "Georgia, serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #111", paddingBottom: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{empresa}</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>Financeiro · Caixa do Negócio</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 11, color: "#666" }}>
              <div>Período: {periodoLabel}</div>
              <div>Emissão: {emissao}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 24, marginBottom: 16, fontSize: 13 }}>
            <div><span style={{ color: "#666" }}>Entradas:</span> <strong style={{ color: "#137a3b" }}>{fmt(financeiro.entradas)}</strong></div>
            <div><span style={{ color: "#666" }}>Saídas:</span> <strong style={{ color: "#b42318" }}>{fmt(financeiro.saidas)}</strong></div>
            <div><span style={{ color: "#666" }}>Resultado:</span> <strong>{fmt(financeiro.resultado)}</strong></div>
            <div><span style={{ color: "#666" }}>Saldo Caixa:</span> <strong>{fmt(financeiro.saldoAtual)}</strong></div>
          </div>

          {financeiro.serie.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                  <th style={{ textAlign: "left", padding: "5px 6px", color: "#666" }}>Mês</th>
                  <th style={{ textAlign: "right", padding: "5px 6px", color: "#666" }}>Receita</th>
                  <th style={{ textAlign: "right", padding: "5px 6px", color: "#666" }}>Despesa</th>
                  <th style={{ textAlign: "right", padding: "5px 6px", color: "#666" }}>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {financeiro.serie.map(m => (
                  <tr key={m.mes} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "5px 6px" }}>{m.label}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right", color: "#137a3b" }}>{fmt(m.receita)}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right", color: "#b42318" }}>{fmt(m.despesa)}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 600 }}>{fmt(m.lucro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "#888", marginBottom: 6 }}>Extrato</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ccc" }}>
                <th style={{ textAlign: "left", padding: "4px 6px", color: "#666" }}>Data</th>
                <th style={{ textAlign: "left", padding: "4px 6px", color: "#666" }}>Tipo</th>
                <th style={{ textAlign: "left", padding: "4px 6px", color: "#666" }}>Descrição</th>
                <th style={{ textAlign: "right", padding: "4px 6px", color: "#666" }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {financeiro.movs.map((h, i) => {
                const v = Number(h.valor || 0);
                return (
                  <tr key={h.id || i} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "4px 6px" }}>{(h.data || "").split("-").reverse().join("/")}</td>
                    <td style={{ padding: "4px 6px" }}>{tipoLabel(h.tipo)}</td>
                    <td style={{ padding: "4px 6px" }}>{h.descricao || ""}</td>
                    <td style={{ padding: "4px 6px", textAlign: "right", color: v >= 0 ? "#137a3b" : "#b42318" }}>
                      {v >= 0 ? "+" : "−"} {fmt(Math.abs(v))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ fontSize: 11, color: "#999", textAlign: "center", borderTop: "1px solid #eee", marginTop: 12, paddingTop: 10 }}>
            {empresa} · Financeiro do Caixa do Negócio · {emissao}
          </div>
        </div>

        <div className="no-print" style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "14px 28px 22px" }}>
          <button className="btn-ghost" onClick={onClose}>Fechar</button>
          <button className="btn-gold" onClick={() => toPDF("financeiro-doc-print")}>
            <FileText size={13} className="inline mr-1" /> Imprimir / PDF
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(content, document.body);
}
