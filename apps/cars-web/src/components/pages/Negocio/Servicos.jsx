import React, { useMemo, useState } from "react";
import { Plus, Trash2, Edit3, Check, Wrench, X, ChevronDown, ChevronRight, DollarSign, TrendingUp, Repeat, Pause, Play, Receipt } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, uid, todayISO } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import PageHeader from "../../ui/PageHeader.jsx";
import Field from "../../ui/Field.jsx";
import Modal from "../../ui/Modal.jsx";

/**
 * Serviços do módulo Negócio.
 *
 * Catálogo: { id, nome, descricao, precoSugerido, custoBase, ativo }
 * Venda:    { id, servicoId?, nome, data, valor, custo,
 *             clienteId?, veiculoId?, contaDestino, obs }
 *
 * Vendas com servicoId nulo = avulsa (nome livre, sem catálogo).
 * Cria receita no Finanças automaticamente; estornar reverte tudo.
 */
export default function Servicos({
  servicos = [], setServicos,
  vendas = [], setVendas,
  contratos = [], setContratos,
  clientes = [],
  veiculos = [],
  contas = [], setContas,
  transacoes = [], setTransacoes,
  categorias = [],
  hidden,
}) {
  const [servicoForm, setServicoForm] = useState(null);
  const [vendaForm, setVendaForm] = useState(null);
  const [contratoForm, setContratoForm] = useState(null);
  const [filtroVendas, setFiltroVendas] = useState("mes"); // mes | tudo
  const [catalogoExpandido, setCatalogoExpandido] = useState(true);
  const [contratosExpandido, setContratosExpandido] = useState(true);

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
    const vMes = (vendas || []).filter(v => (v.data || "").startsWith(mesISO));
    const receita = vMes.reduce((s, v) => s + Number(v.valor || 0), 0);
    const custo = vMes.reduce((s, v) => s + Number(v.custo || 0), 0);
    return {
      catalogo: ativos.length,
      vendidosMes: vMes.length,
      receitaMes: receita,
      lucroMes: receita - custo,
    };
  }, [vendas, ativos]);

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

  /* ---------- Venda ---------- */
  const abrirVendaNova = () => setVendaForm({
    id: null,
    servicoId: ativos[0]?.id || "",
    nome: ativos[0]?.nome || "",
    data: todayISO(),
    valor: String(ativos[0]?.precoSugerido ?? ""),
    custo: String(ativos[0]?.custoBase ?? ""),
    clienteId: "",
    veiculoId: "",
    contaDestino: contas[0]?.nome || "",
    obs: "",
  });

  // Quando troca o serviço do catálogo, auto-preenche nome/preço/custo
  const onTrocarServicoCatalogo = (servicoId) => {
    if (!servicoId) {
      setVendaForm({ ...vendaForm, servicoId: "", nome: "" });
      return;
    }
    const s = servicos.find(x => x.id === servicoId);
    if (s) {
      setVendaForm({
        ...vendaForm,
        servicoId,
        nome: s.nome,
        valor: String(s.precoSugerido ?? ""),
        custo: String(s.custoBase ?? ""),
      });
    }
  };

  const confirmarVenda = () => {
    const nome = (vendaForm.nome || "").trim();
    const valor = Number(vendaForm.valor);
    const custo = Number(vendaForm.custo) || 0;
    if (!nome) { toast.error("Informe o nome do serviço."); return; }
    if (!Number.isFinite(valor) || valor <= 0) { toast.error("Valor inválido."); return; }
    if (!vendaForm.contaDestino) { toast.error("Selecione a conta destino."); return; }

    const conta = contas.find(c => c.nome === vendaForm.contaDestino);
    if (!conta) { toast.error("Conta não encontrada."); return; }

    const cliente = clientes.find(c => c.id === vendaForm.clienteId);
    const veiculo = veiculos.find(x => x.id === vendaForm.veiculoId);
    const partes = [nome];
    if (cliente) partes.push(cliente.nome);
    if (veiculo) partes.push(`${veiculo.modelo}${veiculo.placa ? ` ${veiculo.placa}` : ""}`);

    const novaVenda = {
      id: uid(),
      servicoId: vendaForm.servicoId || null,
      nome,
      data: vendaForm.data,
      valor, custo,
      clienteId: vendaForm.clienteId || null,
      veiculoId: vendaForm.veiculoId || null,
      contaDestino: vendaForm.contaDestino,
      obs: (vendaForm.obs || "").trim(),
    };

    // Cria receita no Finanças
    const catServ = categorias.find(c => c.tipo === "receita" && /serv|negocio/i.test(c.nome))?.nome
                 || categorias.find(c => c.tipo === "receita")?.nome
                 || "Outros";
    setTransacoes([{
      id: uid(),
      tipo: "receita",
      descricao: `Serviço · ${partes.join(" · ")}`,
      categoria: catServ,
      conta: vendaForm.contaDestino,
      data: vendaForm.data,
      valor,
      compensado: true,
      fixa: false,
      obs: `Venda automática do módulo Negócio (serviço ${novaVenda.id})`,
    }, ...transacoes]);

    setContas(contas.map(c => c.id === conta.id
      ? { ...c, saldo: (parseFloat(c.saldo) || 0) + valor } : c));

    setVendas([novaVenda, ...vendas]);
    setVendaForm(null);
    const lucro = valor - custo;
    toast.success(`Serviço registrado · lucro ${fmt(lucro)}`);
  };

  const estornarVenda = async (v) => {
    const ok = await confirm({
      title: `Estornar venda de ${v.nome}?`,
      body: `A venda de ${fmt(v.valor)} será removida, o saldo de ${v.contaDestino} ajustado e a transação no Finanças removida.`,
      danger: true, confirmLabel: "Estornar",
    });
    if (!ok) return;

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

    setVendas(vendas.filter(x => x.id !== v.id));
    toast.success("Venda estornada.");
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
    servicoId: "",
    nome: "",
    valor: "",
    custo: "",
    contaPagamento: "",
    pagarAoFaturar: false,
    recorrencia: "mensal", // mensal | anual
    dataInicio: todayISO(),
    contaDestino: contas[0]?.nome || "",
    obs: "",
    ativo: true,
  });

  const abrirContratoEditar = (c) => {
    const custoNum = Number(c.custo) || 0;
    setContratoForm({
      ...c,
      valor: String(c.valor ?? ""),
      custo: String(c.custo ?? ""),
      contaPagamento: c.contaPagamento || "",
      pagarAoFaturar: c.pagarAoFaturar !== undefined ? c.pagarAoFaturar : (custoNum > 0),
    });
  };

  const onContratoTrocarServico = (servicoId) => {
    if (!servicoId) {
      setContratoForm({ ...contratoForm, servicoId: "", nome: "" });
      return;
    }
    const s = servicos.find(x => x.id === servicoId);
    if (s) {
      setContratoForm({
        ...contratoForm,
        servicoId,
        nome: s.nome,
        valor: String(s.precoSugerido ?? ""),
        custo: String(s.custoBase ?? ""),
      });
    }
  };

  const salvarContrato = () => {
    const nome = (contratoForm.nome || "").trim();
    const valor = Number(contratoForm.valor);
    const custo = Number(contratoForm.custo) || 0;
    if (!nome) { toast.error("Informe o nome do contrato."); return; }
    if (!contratoForm.clienteId) { toast.error("Selecione um cliente."); return; }
    if (!Number.isFinite(valor) || valor <= 0) { toast.error("Valor inválido."); return; }
    if (!contratoForm.contaDestino) { toast.error("Selecione a conta destino."); return; }

    const dados = {
      ...contratoForm,
      nome, valor, custo,
      contaPagamento: contratoForm.contaPagamento || "",
      pagarAoFaturar: !!contratoForm.pagarAoFaturar && !!contratoForm.contaPagamento && custo > 0,
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
  const gerarFatura = (c) => {
    const ref = refAtual(c.recorrencia);
    if (c.ultimaFaturaRef === ref) {
      toast.error(`Fatura de ${ref} já foi gerada.`);
      return;
    }
    const conta = contas.find(co => co.nome === c.contaDestino);
    if (!conta) { toast.error(`Conta "${c.contaDestino}" não existe mais. Edite o contrato.`); return; }

    const cliente = clientes.find(cl => cl.id === c.clienteId);
    const refLabel = c.recorrencia === "anual" ? `Ano ${ref}` : `${ref.slice(5)}/${ref.slice(0, 4)}`;

    const novaVenda = {
      id: uid(),
      servicoId: c.servicoId || null,
      contratoId: c.id,
      nome: `${c.nome} · ${refLabel}`,
      data: todayISO(),
      valor: Number(c.valor || 0),
      custo: Number(c.custo || 0),
      clienteId: c.clienteId || null,
      veiculoId: null,
      contaDestino: c.contaDestino,
      obs: `Fatura recorrente · ref ${ref}`,
    };

    const catServ = categorias.find(cat => cat.tipo === "receita" && /serv|negocio|aluguel|recorr/i.test(cat.nome))?.nome
                 || categorias.find(cat => cat.tipo === "receita")?.nome
                 || "Outros";

    const novasTransacoes = [{
      id: uid(),
      tipo: "receita",
      descricao: `${c.nome}${cliente ? ` · ${cliente.nome}` : ""} · ${refLabel}`,
      categoria: catServ,
      conta: c.contaDestino,
      data: todayISO(),
      valor: Number(c.valor || 0),
      compensado: true,
      fixa: false,
      obs: `Fatura recorrente do módulo Negócio (serviço ${novaVenda.id})`,
    }];

    // Pagamento ao prestador (despesa automática)
    const custoNum = Number(c.custo || 0);
    const deveGerarDespesa = c.pagarAoFaturar && c.contaPagamento && custoNum > 0;
    const contaPag = deveGerarDespesa ? contas.find(co => co.nome === c.contaPagamento) : null;
    if (deveGerarDespesa && !contaPag) {
      toast.error(`Conta de pagamento "${c.contaPagamento}" não existe mais. Despesa não foi criada.`);
    }
    if (deveGerarDespesa && contaPag) {
      const catDesp = categorias.find(cat => cat.tipo === "despesa" && /serv|saas|software|ferramenta|negocio/i.test(cat.nome))?.nome
                   || categorias.find(cat => cat.tipo === "despesa")?.nome
                   || "Outros";
      novasTransacoes.push({
        id: uid(),
        tipo: "despesa",
        descricao: `Pago a prestador · ${c.nome} · ${refLabel}`,
        categoria: catDesp,
        conta: c.contaPagamento,
        data: todayISO(),
        valor: custoNum,
        compensado: true,
        fixa: false,
        obs: `Pagamento ao prestador · contrato recorrente (serviço ${novaVenda.id})`,
      });
    }

    setTransacoes([...novasTransacoes, ...transacoes]);

    // Ajustes de saldo: receita na contaDestino, despesa na contaPagamento
    setContas(contas.map(co => {
      let novoSaldo = parseFloat(co.saldo) || 0;
      if (co.id === conta.id) novoSaldo += Number(c.valor || 0);
      if (deveGerarDespesa && contaPag && co.id === contaPag.id) novoSaldo -= custoNum;
      return (co.id === conta.id || (deveGerarDespesa && contaPag && co.id === contaPag.id))
        ? { ...co, saldo: novoSaldo }
        : co;
    }));

    setVendas([novaVenda, ...vendas]);
    setContratos((contratos || []).map(x => x.id === c.id ? { ...x, ultimaFaturaRef: ref } : x));
    if (deveGerarDespesa && contaPag) {
      toast.success(`Fatura ${refLabel} gerada (receita + despesa) · ${fmt(c.valor)}`);
    } else {
      toast.success(`Fatura ${refLabel} gerada · ${fmt(c.valor)}`);
    }
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
        sub="Catálogo de serviços com preço/custo + histórico de vendas. Cada venda cria receita no Finanças automaticamente."
        action={
          <button onClick={abrirVendaNova} className="btn-gold">
            <Plus size={14} className="inline mr-1.5" /> Registrar venda
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-4" style={{ background: T.border }}>
        <Kpi label="Catálogo" valor={String(kpi.catalogo)} sub="ativos" cor={T.ink} icon={Wrench} />
        <Kpi label="Vendidos no mês" valor={String(kpi.vendidosMes)} cor={T.gold} />
        <Kpi label="Receita do mês" valor={hidden ? "•••••" : fmt(kpi.receitaMes)} cor={T.gold} icon={DollarSign} />
        <Kpi label="Lucro do mês"
             valor={hidden ? "•••••" : fmt(kpi.lucroMes)}
             cor={kpi.lucroMes >= 0 ? T.green : T.red}
             icon={TrendingUp} />
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
          <button onClick={abrirServicoNovo}
            style={{
              background: "transparent", border: `1px solid ${T.border}`,
              color: T.muted, padding: "5px 10px", borderRadius: 5, cursor: "pointer",
              fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase",
            }}>
            <Plus size={11} className="inline mr-1" /> Novo serviço
          </button>
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
                        {inativo && (
                          <span style={{ fontSize: 9, padding: "1px 6px", background: T.border,
                                         color: T.muted, borderRadius: 3, letterSpacing: ".1em", textTransform: "uppercase" }}>
                            Pausado
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {cliente && <span>👤 {cliente.nome}</span>}
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
                      hidden={hidden}
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
        const lucro = valor - custo;
        return (
          <Modal title="Registrar venda de serviço" onClose={() => setVendaForm(null)}>
            <Field label="Serviço do catálogo">
              <select value={vendaForm.servicoId}
                      onChange={e => onTrocarServicoCatalogo(e.target.value)}>
                <option value="">— avulso (nome livre) —</option>
                {ativos.map(s => (
                  <option key={s.id} value={s.id}>{s.nome} · {fmt(s.precoSugerido)}</option>
                ))}
              </select>
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
            <Field label="Conta que recebe" required>
              <select value={vendaForm.contaDestino}
                      onChange={e => setVendaForm({ ...vendaForm, contaDestino: e.target.value })}>
                <option value="">Selecione…</option>
                {contas.map(c => (
                  <option key={c.id} value={c.nome}>{c.nome} · {fmt(c.saldo || 0)}</option>
                ))}
              </select>
            </Field>
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
            Use pra cobrar serviços que se repetem todo mês (CRM, tráfego pago, app, aluguel, mensalidade…). Cada faturamento cria uma receita no Finanças.
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
          <Field label="Serviço do catálogo (opcional)">
            <select value={contratoForm.servicoId}
                    onChange={e => onContratoTrocarServico(e.target.value)}>
              <option value="">— digitar nome livre —</option>
              {servicos.filter(s => s.ativo !== false).map(s => (
                <option key={s.id} value={s.id}>{s.nome} · {fmt(s.precoSugerido)}</option>
              ))}
            </select>
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
            <Field label="Conta que recebe" required>
              <select value={contratoForm.contaDestino}
                      onChange={e => setContratoForm({ ...contratoForm, contaDestino: e.target.value })}>
                <option value="">Selecione…</option>
                {contas.map(c => (
                  <option key={c.id} value={c.nome}>{c.nome}</option>
                ))}
              </select>
            </Field>
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
            💡 <strong style={{ color: T.ink }}>Pago ao prestador</strong> + <strong style={{ color: T.ink }}>Criar despesa ao faturar</strong> geram automaticamente a despesa no Finanças junto com a receita.
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
    </div>
  );
}

function VendaRow({ venda: v, cliente, veiculo, hidden, onEstornar }) {
  const lucro = Number(v.valor || 0) - Number(v.custo || 0);
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${T.green}`,
      borderRadius: 8, padding: 12,
      display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: 12, alignItems: "center",
    }}>
      <div style={{ color: T.faint, fontFamily: T.mono, fontSize: 11 }}>
        {v.data.split("-").reverse().slice(0, 2).join("/")}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, color: T.ink, fontWeight: 500 }}>{v.nome}</div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {cliente && <span>👤 {cliente.nome}</span>}
          {veiculo && <span>🚗 {veiculo.modelo}{veiculo.placa ? ` (${veiculo.placa})` : ""}</span>}
          <span>→ {v.contaDestino}</span>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="num" style={{ color: T.gold, fontWeight: 600 }}>{hidden ? "•••" : fmt(v.valor)}</div>
        <div className="num" style={{ fontSize: 10, color: lucro >= 0 ? T.green : T.red }}>
          lucro {lucro >= 0 ? "+" : ""}{hidden ? "•••" : fmt(lucro)}
        </div>
      </div>
      <button onClick={onEstornar} title="Estornar"
              style={btnIcon({ color: T.red })}>
        ↩
      </button>
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
