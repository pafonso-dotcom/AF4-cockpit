import React, { useMemo, useState } from "react";
import { Plus, Trash2, Edit3, Check, Car, Package, DollarSign, ChevronDown, ChevronRight, TrendingUp, Search } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { KpiInline as Kpi } from "../../ui/KpiCard.jsx";
import { fmt, uid, todayISO } from "../../../lib/format.js";
import { API } from "../../../lib/api.js";
import { toast } from "../../../lib/toast.js";

/**
 * Extrai marca/modelo/ano/cor de uma resposta de consulta de placa, de forma
 * tolerante: achata o objeto (até 3 níveis) e procura por nomes de campo
 * comuns (PT/EN). Funciona com formatos diferentes de API sem mapeamento fixo.
 */
function mapearPlaca(data) {
  const flat = {};
  const walk = (o, depth) => {
    if (!o || typeof o !== "object" || depth > 3) return;
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === "object") walk(v, depth + 1);
      else if (flat[k.toLowerCase()] == null) flat[k.toLowerCase()] = v;
    }
  };
  walk(data, 0);
  const pick = (...keys) => {
    for (const k of keys) { const v = flat[k]; if (v != null && String(v).trim() !== "") return String(v).trim(); }
    return "";
  };
  return {
    marca: pick("marca", "fabricante", "marcamodelo", "marca_modelo", "brand"),
    modelo: pick("modelo", "submodelo", "versao", "model"),
    ano: pick("anomodelo", "ano_modelo", "ano", "anofabricacao", "ano_fabricacao", "year"),
    cor: pick("cor", "corveiculo", "cor_veiculo", "color"),
  };
}
import { confirm } from "../../../lib/confirm.js";
import PageHeader from "../../ui/PageHeader.jsx";
import Field from "../../ui/Field.jsx";
import Modal from "../../ui/Modal.jsx";

/**
 * Veículos do módulo Negócio.
 *
 * Veículo (estoque):
 *   { id, placa, modelo, marca, ano, cor, custoEntrada,
 *     custosExtra: [{id, desc, valor, data}], dataEntrada,
 *     fornecedor, obs, vendido, vendaId? }
 *
 * Venda:
 *   { id, veiculoId, dataVenda, valorVenda, custoTotal,
 *     clienteId, contaDestino, obs }
 *
 * Integração com Finanças:
 *   - Venda alimenta a "Caixa do Negócio" virtual (saldo + histórico).
 *     NÃO cria mais transação em Finanças.
 *   - Vendas antigas (com conta de Finanças) seguem visíveis na lista —
 *     contaDestino fica salvo como "Caixa do Negócio" pra novas vendas.
 *   - Custos extras NÃO criam transação por padrão (registra só no veículo);
 *     trade-off: simplifica MVP, evita duplicar lançamento se o user já
 *     registrou a despesa em Finanças.
 */
export default function Veiculos({
  veiculos = [], setVeiculos,
  vendas = [], setVendas,
  clientes = [],
  contas = [], setContas,
  transacoes = [], setTransacoes,
  categorias = [],
  caixaNegocio = { saldo: 0, historico: [] }, setCaixaNegocio,
  hidden,
}) {
  const [form, setForm] = useState(null);       // novo/edita veículo
  const [buscandoPlaca, setBuscandoPlaca] = useState(false);
  const [custoForm, setCustoForm] = useState(null); // novo custo extra
  const [vendaForm, setVendaForm] = useState(null);
  const [filter, setFilter] = useState("estoque"); // estoque | vendidos | todos
  const [expanded, setExpanded] = useState(new Set());

  const toggleExp = (id) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const custoTotalDe = (v) =>
    Number(v.custoEntrada || 0)
    + (v.custosExtra || []).reduce((s, c) => s + Number(c.valor || 0), 0);

  const vendaPorVeiculoId = useMemo(() => {
    const m = {};
    (vendas || []).forEach(vd => { if (vd.veiculoId) m[vd.veiculoId] = vd; });
    return m;
  }, [vendas]);

  const listaFiltrada = useMemo(() => {
    const lista = veiculos.filter(v => {
      if (filter === "estoque") return !v.vendido;
      if (filter === "vendidos") return !!v.vendido;
      return true;
    });
    return [...lista].sort((a, b) => (b.dataEntrada || "").localeCompare(a.dataEntrada || ""));
  }, [veiculos, filter]);

  const kpi = useMemo(() => {
    const emEstoque = veiculos.filter(v => !v.vendido);
    const custoEstoque = emEstoque.reduce((s, v) => s + custoTotalDe(v), 0);
    const hoje = new Date();
    const mesISO = hoje.toISOString().slice(0, 7);
    const vendasMes = (vendas || []).filter(v => (v.dataVenda || "").startsWith(mesISO));
    const lucroMes = vendasMes.reduce((s, v) =>
      s + (Number(v.valorVenda || 0) - Number(v.custoTotal || 0)), 0);
    const receitaMes = vendasMes.reduce((s, v) => s + Number(v.valorVenda || 0), 0);
    return {
      emEstoque: emEstoque.length,
      custoEstoque,
      vendidosMes: vendasMes.length,
      receitaMes,
      lucroMes,
    };
  }, [veiculos, vendas]);

  /* ---------- Veículo (CRUD) ---------- */
  const abrirNovo = () => setForm({
    id: null, placa: "", marca: "", modelo: "", ano: "", cor: "",
    custoEntrada: "", dataEntrada: todayISO(), fornecedor: "", obs: "",
    custosExtra: [], vendido: false,
  });
  const abrirEditar = (v) => setForm({
    ...v,
    custoEntrada: String(v.custoEntrada ?? ""),
    ano: String(v.ano ?? ""),
  });

  // Consulta a placa (via Worker /api/placa → APIBrasil) e autopreenche
  // marca/modelo/ano/cor no formulário.
  const buscarPlaca = async () => {
    const placa = (form?.placa || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (placa.length < 7) { toast.error("Digite a placa completa (ex.: ABC1D23)."); return; }
    setBuscandoPlaca(true);
    try {
      const data = await API.consultarPlaca(placa);
      const m = mapearPlaca(data);
      if (!m.marca && !m.modelo && !m.ano && !m.cor) {
        toast.info("Consulta feita, mas não reconheci os campos — preencha manualmente.");
      } else {
        setForm(f => ({
          ...f,
          marca: m.marca || f.marca,
          modelo: m.modelo || f.modelo,
          ano: m.ano ? String(parseInt(m.ano, 10) || m.ano) : f.ano,
          cor: m.cor || f.cor,
        }));
        toast.success("Dados da placa preenchidos.");
      }
    } catch (e) {
      toast.error("Falha na consulta: " + (e.message || "erro"));
    }
    setBuscandoPlaca(false);
  };

  const salvar = () => {
    const placa = (form.placa || "").trim().toUpperCase();
    const modelo = (form.modelo || "").trim();
    const custo = Number(form.custoEntrada);
    if (!modelo) { toast.error("Informe o modelo."); return; }
    if (!Number.isFinite(custo) || custo <= 0) { toast.error("Custo de entrada inválido."); return; }

    const dados = {
      ...form,
      placa, modelo,
      marca: (form.marca || "").trim(),
      ano: form.ano ? Number(form.ano) : null,
      cor: (form.cor || "").trim(),
      fornecedor: (form.fornecedor || "").trim(),
      obs: (form.obs || "").trim(),
      custoEntrada: custo,
    };
    if (form.id) {
      setVeiculos(veiculos.map(v => v.id === form.id ? dados : v));
      toast.success(`${modelo} ${placa || ""} atualizado.`);
    } else {
      setVeiculos([{
        ...dados, id: uid(), vendido: false, custosExtra: [],
      }, ...veiculos]);
      toast.success(`${modelo} cadastrado em estoque.`);
    }
    setForm(null);
  };

  const excluirVeiculo = async (v) => {
    if (v.vendido) {
      toast.error("Veículo vendido. Estorne a venda antes de excluir.");
      return;
    }
    const ok = await confirm({
      title: `Excluir ${v.modelo} ${v.placa || ""}?`,
      body: "O cadastro será removido do estoque. Custos extras associados também somem.",
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    setVeiculos(veiculos.filter(x => x.id !== v.id));
    toast.success("Veículo removido.");
  };

  /* ---------- Custos extras ---------- */
  const abrirCusto = (v) => setCustoForm({
    veiculoId: v.id, desc: "", valor: "", data: todayISO(),
  });
  const salvarCusto = () => {
    const desc = (custoForm.desc || "").trim();
    const valor = Number(custoForm.valor);
    if (!desc) { toast.error("Descreva o custo."); return; }
    if (!Number.isFinite(valor) || valor <= 0) { toast.error("Valor inválido."); return; }
    setVeiculos(veiculos.map(v => v.id === custoForm.veiculoId
      ? { ...v, custosExtra: [...(v.custosExtra || []), {
          id: uid(), desc, valor, data: custoForm.data,
        }] }
      : v));
    setCustoForm(null);
    toast.success("Custo adicionado.");
  };
  const removerCusto = (v, custoId) => {
    setVeiculos(veiculos.map(x => x.id === v.id
      ? { ...x, custosExtra: (x.custosExtra || []).filter(c => c.id !== custoId) }
      : x));
  };

  /* ---------- Venda ---------- */
  const abrirVenda = (v) => setVendaForm({
    veiculoId: v.id,
    dataVenda: todayISO(),
    valorVenda: "",
    clienteId: clientes[0]?.id || "",
    obs: "",
  });
  const confirmarVenda = () => {
    const v = veiculos.find(x => x.id === vendaForm.veiculoId);
    if (!v) return;
    const valor = Number(vendaForm.valorVenda);
    if (!Number.isFinite(valor) || valor <= 0) { toast.error("Valor de venda inválido."); return; }

    const custoTotal = custoTotalDe(v);
    const clienteNome = clientes.find(c => c.id === vendaForm.clienteId)?.nome || "Cliente não informado";

    const novaVenda = {
      id: uid(),
      veiculoId: v.id,
      dataVenda: vendaForm.dataVenda,
      valorVenda: valor,
      custoTotal,
      clienteId: vendaForm.clienteId || null,
      contaDestino: "Caixa do Negócio",
      obs: (vendaForm.obs || "").trim(),
    };

    // Receita agora vai pra Caixa do Negócio virtual (não toca em Finanças)
    if (typeof setCaixaNegocio === "function") {
      setCaixaNegocio(prev => ({
        saldo: (prev?.saldo || 0) + valor,
        historico: [{
          id: uid(),
          tipo: "venda-veiculo",
          data: vendaForm.dataVenda,
          descricao: `Venda ${v.modelo}${v.placa ? ` (${v.placa})` : ""} · ${clienteNome}`,
          valor,
          custo: custoTotal,
          vendaId: novaVenda.id,
          veiculoId: v.id,
          ts: new Date().toISOString(),
        }, ...((prev?.historico) || [])],
      }));
    }

    setVendas([novaVenda, ...vendas]);
    setVeiculos(veiculos.map(x => x.id === v.id ? { ...x, vendido: true, vendaId: novaVenda.id } : x));

    setVendaForm(null);
    const lucro = valor - custoTotal;
    toast.success(`Venda registrada · lucro ${fmt(lucro)}`);
  };

  const estornarVenda = async (v) => {
    const vd = vendaPorVeiculoId[v.id];
    if (!vd) return;
    const isCaixaVirtual = vd.contaDestino === "Caixa do Negócio";
    const ok = await confirm({
      title: `Estornar venda de ${v.modelo}?`,
      body: isCaixaVirtual
        ? `A venda de ${fmt(vd.valorVenda)} será removida da Caixa do Negócio e o veículo volta pro estoque.`
        : `A venda de ${fmt(vd.valorVenda)} será removida, o saldo da conta ${vd.contaDestino} ajustado e o veículo volta pro estoque. A transação criada no Finanças também será removida.`,
      danger: true, confirmLabel: "Estornar",
    });
    if (!ok) return;

    if (isCaixaVirtual) {
      // Venda nova: estorna na Caixa do Negócio virtual
      if (typeof setCaixaNegocio === "function") {
        setCaixaNegocio(prev => ({
          saldo: (prev?.saldo || 0) - Number(vd.valorVenda || 0),
          historico: ((prev?.historico) || []).filter(h => h.vendaId !== vd.id),
        }));
      }
    } else {
      // Venda antiga (com conta de Finanças): mantém comportamento legado
      // Remove transação correspondente
      setTransacoes(transacoes.filter(t => !(
        t.conta === vd.contaDestino &&
        t.valor === vd.valorVenda &&
        t.tipo === "receita" &&
        t.data === vd.dataVenda &&
        (t.obs || "").includes(`veículo ${v.id}`)
      )));

      // Ajusta saldo da conta
      const conta = contas.find(c => c.nome === vd.contaDestino);
      if (conta) {
        setContas(contas.map(c => c.id === conta.id
          ? { ...c, saldo: (parseFloat(c.saldo) || 0) - Number(vd.valorVenda || 0) }
          : c));
      }
    }

    setVendas(vendas.filter(x => x.id !== vd.id));
    setVeiculos(veiculos.map(x => x.id === v.id ? { ...x, vendido: false, vendaId: null } : x));
    toast.success("Venda estornada.");
  };

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Negócio · Veículos"
        title="Veículos"
        sub="Entrada e estoque, custos extras (despachante, vistoria, conserto) e registro de venda — receita entra na Caixa do Negócio."
        action={
          <button onClick={abrirNovo} className="btn-gold">
            <Plus size={14} className="inline mr-1.5" /> Novo veículo
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-4" style={{ background: T.border }}>
        <Kpi label="Em estoque" valor={String(kpi.emEstoque)} sub={hidden ? "•••" : fmt(kpi.custoEstoque)} cor={T.ink} icon={Package} />
        <Kpi label="Vendidos no mês" valor={String(kpi.vendidosMes)} cor={T.gold} icon={Car} />
        <Kpi label="Receita do mês" valor={hidden ? "•••••" : fmt(kpi.receitaMes)} cor={T.gold} icon={DollarSign} />
        <Kpi label="Lucro do mês"
             valor={hidden ? "•••••" : fmt(kpi.lucroMes)}
             cor={kpi.lucroMes >= 0 ? T.green : T.red}
             icon={TrendingUp} />
      </div>

      {/* Filtro */}
      <div className="flex gap-2 flex-wrap mb-4">
        {[
          { id: "estoque", l: "Em estoque" },
          { id: "vendidos", l: "Vendidos" },
          { id: "todos", l: "Todos" },
        ].map(o => (
          <button key={o.id} onClick={() => setFilter(o.id)}
            style={{
              padding: "8px 16px",
              border: `1px solid ${filter === o.id ? T.gold : T.border}`,
              background: filter === o.id ? `${T.gold}22` : "transparent",
              color: filter === o.id ? T.gold : T.muted,
              fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
              borderRadius: 5, cursor: "pointer",
            }}>
            {o.l}
          </button>
        ))}
      </div>

      {/* Lista */}
      {listaFiltrada.length === 0 ? (
        <div style={{
          background: T.card, border: `1px dashed ${T.border}`, borderRadius: 16,
          padding: 60, textAlign: "center", color: T.muted, fontStyle: "italic",
        }}>
          <Car size={28} style={{ color: T.muted, marginBottom: 10 }} />
          <div>
            {veiculos.length === 0
              ? "Nenhum veículo cadastrado. Clique em \"Novo veículo\" pra começar."
              : "Nada nesse filtro."}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {listaFiltrada.map(v => (
            <VeiculoCard
              key={v.id}
              veiculo={v}
              venda={vendaPorVeiculoId[v.id]}
              cliente={clientes.find(c => c.id === vendaPorVeiculoId[v.id]?.clienteId)}
              custoTotal={custoTotalDe(v)}
              expandido={expanded.has(v.id)}
              onToggle={() => toggleExp(v.id)}
              hidden={hidden}
              onEditar={() => abrirEditar(v)}
              onExcluir={() => excluirVeiculo(v)}
              onAddCusto={() => abrirCusto(v)}
              onRemoverCusto={(cid) => removerCusto(v, cid)}
              onVender={() => abrirVenda(v)}
              onEstornar={() => estornarVenda(v)}
            />
          ))}
        </div>
      )}

      {/* MODAL: novo/editar veículo */}
      {form && (
        <Modal title={form.id ? "Editar veículo" : "Novo veículo"} onClose={() => setForm(null)}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Placa">
              <div style={{ display: "flex", gap: 6 }}>
                <input value={form.placa} onChange={e => setForm({ ...form, placa: e.target.value })}
                       onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); buscarPlaca(); } }}
                       placeholder="ABC1D23" autoFocus style={{ flex: 1, minWidth: 0 }} />
                <button type="button" onClick={buscarPlaca} disabled={buscandoPlaca}
                        title="Buscar dados pela placa"
                        style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "0 12px",
                                 background: T.gold, color: T.dark ? "#1a1a1a" : "#fff", border: "none", borderRadius: 8,
                                 fontSize: 11, fontWeight: 600, cursor: buscandoPlaca ? "wait" : "pointer", whiteSpace: "nowrap" }}>
                  <Search size={13} />{buscandoPlaca ? "…" : "Buscar"}
                </button>
              </div>
            </Field>
            <Field label="Marca">
              <input value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })}
                     placeholder="VW" />
            </Field>
            <Field label="Modelo" required>
              <input value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })}
                     placeholder="Gol 1.0" />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Ano">
              <input type="number" value={form.ano}
                     onChange={e => setForm({ ...form, ano: e.target.value })}
                     placeholder="2020" />
            </Field>
            <Field label="Cor">
              <input value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })}
                     placeholder="Branco" />
            </Field>
            <Field label="Data de entrada">
              <input type="date" value={form.dataEntrada}
                     onChange={e => setForm({ ...form, dataEntrada: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Custo de entrada (R$)" required>
              <input type="number" step="0.01" value={form.custoEntrada}
                     onChange={e => setForm({ ...form, custoEntrada: e.target.value })}
                     placeholder="35000" />
            </Field>
            <Field label="Fornecedor">
              <input value={form.fornecedor}
                     onChange={e => setForm({ ...form, fornecedor: e.target.value })}
                     placeholder="Leilão / Loja / Particular" />
            </Field>
          </div>
          <Field label="Observações">
            <textarea value={form.obs} rows={2}
                      onChange={e => setForm({ ...form, obs: e.target.value })}
                      placeholder="Notas internas..."
                      style={{ resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <div className="flex gap-3 justify-end mt-6">
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn-gold" onClick={salvar}>
              <Check size={13} className="inline mr-1" />
              {form.id ? "Salvar" : "Cadastrar"}
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL: custo extra */}
      {custoForm && (
        <Modal title="Adicionar custo extra" onClose={() => setCustoForm(null)}>
          <Field label="Descrição" required>
            <input value={custoForm.desc}
                   onChange={e => setCustoForm({ ...custoForm, desc: e.target.value })}
                   placeholder="Ex.: Despachante, vistoria, conserto motor..." autoFocus />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Valor (R$)" required>
              <input type="number" step="0.01" value={custoForm.valor}
                     onChange={e => setCustoForm({ ...custoForm, valor: e.target.value })}
                     placeholder="350" />
            </Field>
            <Field label="Data">
              <input type="date" value={custoForm.data}
                     onChange={e => setCustoForm({ ...custoForm, data: e.target.value })} />
            </Field>
          </div>
          <div style={{
            background: `${T.muted}11`, padding: 10, borderRadius: 11, fontSize: 11.5,
            color: T.muted, fontStyle: "italic", marginTop: 4,
          }}>
            Esse custo soma no custo total do veículo (afeta o lucro da venda). Não cria
            transação no Finanças automaticamente — registre a despesa lá manualmente se
            já saiu do caixa.
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <button className="btn-ghost" onClick={() => setCustoForm(null)}>Cancelar</button>
            <button className="btn-gold" onClick={salvarCusto}>Adicionar</button>
          </div>
        </Modal>
      )}

      {/* MODAL: venda */}
      {vendaForm && (() => {
        const v = veiculos.find(x => x.id === vendaForm.veiculoId);
        if (!v) return null;
        const custoTotal = custoTotalDe(v);
        const valor = Number(vendaForm.valorVenda) || 0;
        const lucro = valor - custoTotal;
        return (
          <Modal title={`Vender ${v.modelo}${v.placa ? ` (${v.placa})` : ""}`}
                 onClose={() => setVendaForm(null)}>
            <div style={{ padding: 10, background: T.bgSoft, borderRadius: 11, marginBottom: 14, fontSize: 12 }}>
              <Row label="Custo total acumulado" value={fmt(custoTotal)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Valor de venda (R$)" required>
                <input type="number" step="0.01" value={vendaForm.valorVenda}
                       onChange={e => setVendaForm({ ...vendaForm, valorVenda: e.target.value })}
                       placeholder="42000" autoFocus />
              </Field>
              <Field label="Data da venda" required>
                <input type="date" value={vendaForm.dataVenda}
                       onChange={e => setVendaForm({ ...vendaForm, dataVenda: e.target.value })} />
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
            <div style={{
              padding: "10px 12px", marginBottom: 4, borderRadius: 11,
              background: `${T.gold}11`, border: `1px solid ${T.gold}33`,
              fontSize: 12, color: T.muted,
            }}>
              <span style={{ color: T.muted }}>Recebe em:</span>{" "}
              <strong style={{ color: T.gold }}>→ Caixa do Negócio</strong>
              <div style={{ fontSize: 10.5, color: T.faint, marginTop: 3, fontStyle: "italic" }}>
                Valor entra na Caixa virtual do Negócio (não cria transação em Finanças).
              </div>
            </div>
            <Field label="Observações">
              <textarea value={vendaForm.obs} rows={2}
                        onChange={e => setVendaForm({ ...vendaForm, obs: e.target.value })}
                        style={{ resize: "vertical", fontFamily: "inherit" }} />
            </Field>
            {valor > 0 && (
              <div style={{
                padding: 12, marginTop: 4, borderRadius: 11,
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
    </div>
  );
}

function VeiculoCard({
  veiculo: v, venda, cliente, custoTotal,
  expandido, onToggle, hidden,
  onEditar, onExcluir, onAddCusto, onRemoverCusto, onVender, onEstornar,
}) {
  const lucro = venda ? (Number(venda.valorVenda || 0) - Number(venda.custoTotal || 0)) : 0;
  const lucroPct = (venda && venda.custoTotal > 0) ? (lucro / venda.custoTotal) * 100 : 0;

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${v.vendido ? T.green : T.gold}`,
      borderRadius: 14, padding: 14,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <button onClick={onToggle} style={{
          background: "transparent", border: "none", cursor: "pointer",
          padding: 0, textAlign: "left", flex: 1, minWidth: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: T.gold }}>
              {expandido ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>
              {v.marca} {v.modelo}{v.ano ? ` ${v.ano}` : ""}
            </span>
            {v.placa && (
              <span style={{
                fontSize: 10, padding: "2px 7px", borderRadius: 4,
                background: T.bgSoft, color: T.muted, fontFamily: T.mono,
                letterSpacing: ".05em",
              }}>
                {v.placa}
              </span>
            )}
            {v.vendido && (
              <span style={{
                fontSize: 9, padding: "2px 7px", borderRadius: 4,
                background: `${T.green}22`, color: T.green,
                letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700,
              }}>
                Vendido
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 6, fontSize: 11.5, color: T.muted, flexWrap: "wrap" }}>
            {v.cor && <span>{v.cor}</span>}
            <span>Custo total: <strong style={{ color: T.ink, fontVariantNumeric: "tabular-nums" }}>{hidden ? "•••" : fmt(custoTotal)}</strong></span>
            {v.vendido && venda && (
              <>
                <span>Vendido por <strong style={{ color: T.gold, fontVariantNumeric: "tabular-nums" }}>{hidden ? "•••" : fmt(venda.valorVenda)}</strong></span>
                <span style={{ color: lucro >= 0 ? T.green : T.red, fontWeight: 600 }}>
                  Lucro {lucro >= 0 ? "+" : ""}{hidden ? "•••" : fmt(lucro)} ({lucroPct.toFixed(1)}%)
                </span>
              </>
            )}
          </div>
        </button>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {!v.vendido && (
            <button onClick={onVender} title="Registrar venda"
                    style={{
                      background: T.gold, color: T.bg, border: "none",
                      padding: "6px 12px", borderRadius: 5, cursor: "pointer",
                      fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
                    }}>
              Vender
            </button>
          )}
          {v.vendido && (
            <button onClick={onEstornar} title="Estornar venda"
                    style={btnIcon({ color: T.red })}>
              ↩
            </button>
          )}
          <button onClick={onEditar} title="Editar"
                  style={btnIcon()}>
            <Edit3 size={14} />
          </button>
          <button onClick={onExcluir} title="Excluir"
                  style={btnIcon({ color: T.red })}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Detalhes expandidos: custos extras + venda + cliente + obs */}
      {expandido && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${T.border}` }}>
          {v.fornecedor && (
            <Row label="Fornecedor" value={v.fornecedor} />
          )}
          {v.dataEntrada && (
            <Row label="Entrada" value={v.dataEntrada.split("-").reverse().join("/")} />
          )}
          <Row label="Custo de entrada" value={hidden ? "•••" : fmt(v.custoEntrada || 0)} />

          <div style={{ marginTop: 10, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="label-eyebrow">Custos extras</div>
            {!v.vendido && (
              <button onClick={onAddCusto}
                style={{
                  background: "transparent", border: `1px solid ${T.border}`,
                  color: T.muted, padding: "3px 8px", borderRadius: 4, cursor: "pointer",
                  fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase",
                }}>
                + Adicionar
              </button>
            )}
          </div>
          {(v.custosExtra || []).length === 0 ? (
            <div style={{ fontSize: 11, color: T.faint, fontStyle: "italic", padding: "6px 0" }}>
              Nenhum custo extra.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 4 }}>
              {v.custosExtra.map(c => (
                <div key={c.id} style={{
                  display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 10,
                  fontSize: 12, alignItems: "center", padding: "6px 8px",
                  background: T.bgSoft, borderRadius: 5,
                }}>
                  <span style={{ color: T.faint, fontFamily: T.mono, fontSize: 10.5 }}>
                    {(c.data || "").slice(8, 10)}/{(c.data || "").slice(5, 7)}
                  </span>
                  <span style={{ color: T.ink }}>{c.desc}</span>
                  <span className="num" style={{ color: T.muted }}>{hidden ? "•••" : fmt(c.valor)}</span>
                  {!v.vendido && (
                    <button onClick={() => onRemoverCusto(c.id)}
                            style={{
                              background: "transparent", border: "none", color: T.red,
                              cursor: "pointer", padding: 2,
                            }}>
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {v.vendido && venda && (
            <div style={{ marginTop: 14, padding: 10, background: `${T.green}11`, borderRadius: 11, border: `1px solid ${T.green}33` }}>
              <div className="label-eyebrow" style={{ marginBottom: 6, color: T.green }}>Venda</div>
              <Row label="Data" value={venda.dataVenda.split("-").reverse().join("/")} />
              <Row label="Valor" value={hidden ? "•••" : fmt(venda.valorVenda)} />
              {cliente && <Row label="Cliente" value={cliente.nome} />}
              <Row label="Conta destino" value={venda.contaDestino} />
              {venda.obs && <Row label="Obs" value={venda.obs} />}
            </div>
          )}

          {v.obs && (
            <div style={{
              marginTop: 10, fontSize: 12, color: T.muted, fontStyle: "italic",
              padding: 8, background: T.bgSoft, borderRadius: 5,
            }}>
              {v.obs}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
      <span style={{ color: "var(--tm)" }}>{label}:</span>
      <span style={{ color: "var(--tx)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

const btnIcon = (overrides = {}) => ({
  background: "transparent", border: "1px solid var(--bd)",
  color: "var(--tm)", padding: 8, borderRadius: 5, cursor: "pointer",
  minWidth: 36, minHeight: 36, display: "grid", placeItems: "center",
  ...overrides,
});
