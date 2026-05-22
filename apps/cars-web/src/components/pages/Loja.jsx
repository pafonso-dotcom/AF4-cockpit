import React, { useState, useMemo, useEffect } from "react";
import {
  TrendingUp, Users, BarChart3, Plus, Edit3, Trash2,
  DollarSign, Calendar, AlertTriangle, Package,
} from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, fmtN, uid, todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import {
  STATUS_VEICULO, CATEGORIA_VEICULO, FONTE_COMPRA, BANCOS_FINANCIAMENTO,
  calcularKPIs, calcularMix, desviosMix, calcularMargem, diasEmEstoque,
} from "../../lib/lojaCarros.js";
import PageHeader from "../ui/PageHeader.jsx";
import StatCard from "../ui/StatCard.jsx";
import Field from "../ui/Field.jsx";
import Modal from "../ui/Modal.jsx";
import ReciboVenda from "./Loja/ReciboVenda.jsx";

export default function Loja({
  veiculos, setVeiculos,
  vendas, setVendas,
  clientes, setClientes,
  cheques = [], setCheques,
  hidden,
  subtabExterno,
  onEfetivarCompraTroca,
}) {
  const [subtabInterno, setSubtabInterno] = useState("dashboard");
  const subtab = subtabExterno || subtabInterno;
  const setSubtab = subtabExterno ? () => {} : setSubtabInterno;
  const hideInternalNav = !!subtabExterno;

  const subtabs = [
    { id: "dashboard", label: "Painel",   icon: BarChart3 },
    { id: "estoque",   label: "Estoque",  icon: Package },
    { id: "vendas",    label: "Vendas",   icon: TrendingUp },
    { id: "clientes",  label: "Clientes", icon: Users },
  ];

  return (
    <div className="fade-up py-8">
      {!hideInternalNav && (
        <>
          <PageHeader
            eyebrow="AF4 · Comercial"
            title="Loja de Veículos"
            subtitle="Estoque, vendas, clientes e indicadores comerciais"
          />

          <div className="flex gap-1 mb-8 overflow-x-auto -mx-2 px-2">
            {subtabs.map(st => {
              const Icon = st.icon;
              const active = subtab === st.id;
              return (
                <button key={st.id} onClick={() => setSubtab(st.id)}
                  aria-label={`Aba ${st.label}`}
                  style={{
                    background: active ? T.cardHi : "transparent",
                    color: active ? T.gold : T.muted,
                    border: `1px solid ${active ? T.gold : T.border}`,
                    padding: "10px 16px", display: "flex", alignItems: "center", gap: 8,
                    fontFamily: T.sans, fontSize: 11, letterSpacing: "0.12em",
                    textTransform: "uppercase", fontWeight: 500, whiteSpace: "nowrap",
                    cursor: "pointer",
                  }}>
                  <Icon size={14} /> {st.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {subtab === "dashboard" && (
        <PainelLoja veiculos={veiculos} vendas={vendas} hidden={hidden} setSubtab={setSubtab} />
      )}
      {subtab === "estoque" && (
        <EstoquePanel veiculos={veiculos} setVeiculos={setVeiculos} hidden={hidden} />
      )}
      {subtab === "vendas" && (
        <VendasPanel
          vendas={vendas} setVendas={setVendas}
          veiculos={veiculos} setVeiculos={setVeiculos}
          clientes={clientes} setClientes={setClientes}
          cheques={cheques} setCheques={setCheques}
          hidden={hidden}
          onEfetivarCompraTroca={onEfetivarCompraTroca}
        />
      )}
      {subtab === "clientes" && (
        <ClientesPanel clientes={clientes} setClientes={setClientes} vendas={vendas} />
      )}
    </div>
  );
}

/* ================== PAINEL ================== */
function PainelLoja({ veiculos, vendas, hidden, setSubtab }) {
  const kpis = useMemo(() => calcularKPIs(veiculos, vendas), [veiculos, vendas]);
  const mix = useMemo(() => calcularMix(veiculos), [veiculos]);
  const desvios = useMemo(() => desviosMix(veiculos), [veiculos]);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <StatCard label="Em Estoque" value={String(kpis.emEstoque)} accent={T.gold} icon={Package}
                  sub={hidden ? "•••••" : fmt(kpis.valorEstoque) + " investidos"} />
        <StatCard label="Vendidos" value={String(kpis.vendidos)} accent={T.green} icon={TrendingUp}
                  sub={hidden ? "•••••" : "Ticket: " + fmt(kpis.ticketMedio)} />
        <StatCard label="Margem Média" value={kpis.margemMedia.toFixed(1) + "%"}
                  accent={kpis.margemMedia >= 10 ? T.green : T.gold} icon={DollarSign}
                  sub={kpis.margemMedia >= 10 ? "Saudável" : "Abaixo do ideal"} />
        <StatCard label="Giro Estoque" value={kpis.giroEstoque.toFixed(0) + " d"}
                  accent={kpis.giroEstoque <= 45 ? T.green : T.red} icon={Calendar}
                  sub={kpis.giroEstoque <= 45 ? "Dentro da meta" : "Acima de 45 dias"} />
      </div>

      {/* Alertas */}
      {(kpis.parados > 0 || kpis.comissoesPendentes > 0) && (
        <div className="mb-8 space-y-3">
          {kpis.parados > 0 && (
            <div style={{
              background: `${T.red}11`, border: `1px solid ${T.red}`,
              padding: 14, display: "flex", gap: 10, alignItems: "flex-start",
            }}>
              <AlertTriangle size={18} style={{ color: T.red, flexShrink: 0, marginTop: 2 }} />
              <div className="flex-1">
                <div style={{ color: T.red, fontSize: 13, fontWeight: 600 }}>
                  {kpis.parados} veículo{kpis.parados !== 1 ? "s" : ""} em estoque há mais de 45 dias
                </div>
                <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
                  Considere revisar o preço, criar campanha ou repassar.
                  {kpis.veiculosParados.slice(0, 3).map(v => (
                    <span key={v.id} style={{ marginLeft: 8, color: T.ink }}>
                      · {v.marca} {v.modelo} ({diasEmEstoque(v)}d)
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => setSubtab("estoque")}
                style={{
                  background: T.red, color: "#fff", border: "none", padding: "6px 12px",
                  fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
                  cursor: "pointer", flexShrink: 0,
                }}>
                Ver estoque
              </button>
            </div>
          )}
          {kpis.comissoesPendentes > 0 && (
            <div style={{
              background: `${T.gold}11`, border: `1px solid ${T.gold}`,
              padding: 14, display: "flex", gap: 10, alignItems: "center",
            }}>
              <DollarSign size={18} style={{ color: T.gold, flexShrink: 0 }} />
              <div className="flex-1" style={{ color: T.gold, fontSize: 13 }}>
                Comissões pendentes: <strong className="num">{hidden ? "•••" : fmt(kpis.comissoesPendentes)}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mix de estoque */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }} className="mb-8">
        <div className="label-eyebrow mb-4">Composição do Estoque vs Mix Ideal</div>
        <p style={{ color: T.muted, fontSize: 12, marginBottom: 16, fontStyle: "italic" }}>
          Recomendação de mercado: Hatch 40% · SUV 35% · Sedan 15% · Picape 10%
        </p>
        <div className="space-y-3">
          {desvios.map(d => {
            const cor = Math.abs(d.desvio) <= 10 ? T.green : Math.abs(d.desvio) <= 20 ? T.gold : T.red;
            return (
              <div key={d.categoria}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: T.ink, fontWeight: 500 }}>{d.label}</span>
                  <span style={{ color: T.muted }}>
                    <span style={{ color: T.ink }}>{d.atual.toFixed(0)}%</span> / ideal {d.ideal}%
                    {d.desvio !== 0 && (
                      <span style={{ color: cor, marginLeft: 8 }}>
                        ({d.desvio > 0 ? "+" : ""}{d.desvio.toFixed(0)}%)
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ position: "relative", height: 8, background: T.bgSoft }}>
                  <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${d.atual}%`, background: cor, opacity: 0.7 }} />
                  <div style={{
                    position: "absolute", left: `${d.ideal}%`, top: -2,
                    width: 2, height: 12, background: T.ink,
                  }} title={`Ideal: ${d.ideal}%`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

/* ================== ESTOQUE ================== */
function EstoquePanel({ veiculos, setVeiculos, hidden }) {
  const [form, setForm] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [filter, setFilter] = useState("ativos");

  // "ativos" = estoque + reservado (esconde vendidos — eles ficam na aba Vendas)
  // "estoque" = só estoque
  // "reservado" = só reservados
  // "vendidos" = só vendidos (para ver histórico)
  const filtered = filter === "ativos"
    ? veiculos.filter(v => v.status === "estoque" || v.status === "reservado")
    : veiculos.filter(v => v.status === filter);

  const save = () => {
    const errs = {};
    if (!form.marca?.trim()) errs.marca = "Marca obrigatória";
    if (!form.modelo?.trim()) errs.modelo = "Modelo obrigatório";
    if (!form.valorCompra || parseFloat(form.valorCompra) <= 0) errs.valorCompra = "Valor de compra obrigatório";
    if (form.km && parseFloat(form.km) < 0) errs.km = "KM inválida";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }

    const data = {
      ...form,
      ano: parseInt(form.ano) || new Date().getFullYear(),
      anoModelo: parseInt(form.anoModelo) || parseInt(form.ano) || new Date().getFullYear(),
      km: parseFloat(form.km) || 0,
      valorCompra: parseFloat(form.valorCompra),
      valorVenda: parseFloat(form.valorVenda) || parseFloat(form.valorCompra) * 1.15,
    };
    if (form.id && veiculos.find(v => v.id === form.id)) {
      setVeiculos(veiculos.map(v => v.id === form.id ? data : v));
      toast.success(`${data.marca} ${data.modelo} atualizado.`);
    } else {
      setVeiculos([...veiculos, { ...data, id: uid() }]);
      toast.success(`${data.marca} ${data.modelo} adicionado ao estoque.`);
    }
    setForm(null);
    setFormErrors({});
  };

  const novoVeiculo = () => {
    setForm({
      marca: "", modelo: "",
      ano: new Date().getFullYear(),
      anoModelo: new Date().getFullYear(),
      placa: "", cor: "", km: 0,
      combustivel: "Flex", cambio: "Manual",
      categoria: "hatch",
      valorCompra: "", valorVenda: "",
      dataCompra: todayISO(),
      fonteCompra: FONTE_COMPRA[0],
      status: "estoque",
      obs: "", fotos: [],
    });
    setFormErrors({});
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {[{ v: "ativos", l: "🚗 Ativos" }, { v: "estoque", l: "Disponíveis" }, { v: "reservado", l: "Reservados" },
            { v: "vendido", l: "Vendidos (histórico)" }, { v: "repasse", l: "Repasse" }].map(t => (
            <button key={t.v} onClick={() => setFilter(t.v)}
              style={{
                padding: "6px 14px", border: `1px solid ${filter === t.v ? T.gold : T.border}`,
                background: filter === t.v ? `${T.gold}22` : "transparent",
                color: filter === t.v ? T.gold : T.muted,
                fontFamily: T.sans, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
                cursor: "pointer",
              }}>{t.l}</button>
          ))}
        </div>
      </div>

      <div style={{
        background: `${T.gold}11`,
        border: `1px dashed ${T.gold}55`,
        padding: "10px 14px",
        marginBottom: 14,
        fontSize: 11.5,
        color: T.muted,
        lineHeight: 1.5,
        borderRadius: 6,
      }}>
        ⓘ Veículos entram no estoque automaticamente via <strong style={{ color: T.gold }}>Aba “Compra”</strong>
        {" "}(novo veículo comprado) ou via <strong style={{ color: T.gold }}>Troca em Venda</strong>
        {" "}(quando o cliente entrega um carro como parte do pagamento).
        Para cadastrar manualmente, utilize a aba <strong style={{ color: T.gold }}>Compra</strong>.
      </div>

      {filtered.length === 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 60, textAlign: "center", color: T.muted, fontStyle: "italic" }}>
          Nenhum veículo nessa categoria.
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(v => {
          const st = STATUS_VEICULO[v.status] || STATUS_VEICULO.estoque;
          const cat = CATEGORIA_VEICULO[v.categoria] || CATEGORIA_VEICULO.outro;
          const dias = diasEmEstoque(v);
          const isParado = v.status === "estoque" && dias > 45;
          return (
            <div key={v.id} style={{ background: T.card, border: `1px solid ${T.border}`, padding: 16 }}>
              <div className="flex justify-between items-start mb-3">
                <div className="min-w-0 flex-1">
                  <div style={{ color: T.ink, fontFamily: T.serif, fontSize: 18, fontWeight: 500 }} className="truncate">
                    {v.marca} {v.modelo}
                  </div>
                  <div style={{ color: T.muted, fontSize: 12 }}>
                    {v.ano}/{v.anoModelo} · {v.cor} · {fmtN(v.km, 0)} km
                  </div>
                  {v.placa && <div style={{ color: T.faint, fontSize: 10, fontFamily: T.sans, letterSpacing: "0.1em", marginTop: 2 }}>{v.placa.toUpperCase()}</div>}
                </div>
                <span style={{
                  background: st.bg, color: st.cor, padding: "3px 8px",
                  fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
                  whiteSpace: "nowrap", flexShrink: 0,
                }}>
                  {st.label}
                </span>
              </div>

              <div style={{ paddingTop: 10, borderTop: `1px solid ${T.border}` }} className="space-y-2 mb-3">
                <div className="flex justify-between text-xs">
                  <span style={{ color: T.muted }}>Categoria</span>
                  <span style={{ color: T.ink }}>{cat.label}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: T.muted }}>Compra</span>
                  <span className="num" style={{ color: T.ink }}>{hidden ? "•••" : fmt(v.valorCompra)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: T.muted }}>Anunciado</span>
                  <span className="num" style={{ color: T.gold, fontWeight: 600 }}>{hidden ? "•••" : fmt(v.valorVenda)}</span>
                </div>
                {v.status === "estoque" && (
                  <div className="flex justify-between text-xs">
                    <span style={{ color: T.muted }}>Em estoque</span>
                    <span style={{ color: isParado ? T.red : T.muted, fontWeight: isParado ? 600 : 400 }}>
                      {dias} dia{dias !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setForm(v); setFormErrors({}); }}
                  aria-label={`Editar ${v.marca} ${v.modelo}`}
                  style={{ flex: 1, background: T.bgSoft, border: `1px solid ${T.border}`, color: T.muted, padding: "6px 10px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
                  <Edit3 size={11} className="inline mr-1" /> Editar
                </button>
                <button onClick={async () => {
                          const ok = await confirm({
                            title: `Remover ${v.marca} ${v.modelo}?`,
                            body: "Vendas registradas para este veículo continuarão existindo.",
                            danger: true, confirmLabel: "Remover",
                          });
                          if (!ok) return;
                          const backup = veiculos;
                          setVeiculos(veiculos.filter(x => x.id !== v.id));
                          toast.success(`${v.marca} ${v.modelo} removido.`, {
                            action: { label: "Desfazer", onClick: () => setVeiculos(backup) },
                          });
                        }}
                        aria-label={`Excluir ${v.marca} ${v.modelo}`}
                        style={{ background: "transparent", border: `1px solid ${T.red}`, color: T.red, padding: "6px 10px", cursor: "pointer" }}>
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {form && (
        <Modal title={form.id ? "Editar Veículo" : "Novo Veículo"} onClose={() => setForm(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Marca" required error={formErrors.marca}>
              <input value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} placeholder="Ex.: Hyundai" />
            </Field>
            <Field label="Modelo" required error={formErrors.modelo}>
              <input value={form.modelo} onChange={e => setForm({ ...form, modelo: e.target.value })} placeholder="Ex.: HB20" />
            </Field>
            <Field label="Ano">
              <input type="number" value={form.ano} onChange={e => setForm({ ...form, ano: e.target.value })} />
            </Field>
            <Field label="Ano modelo">
              <input type="number" value={form.anoModelo} onChange={e => setForm({ ...form, anoModelo: e.target.value })} />
            </Field>
            <Field label="Placa">
              <input value={form.placa} onChange={e => setForm({ ...form, placa: e.target.value.toUpperCase() })} placeholder="ABC1D23" maxLength={8} />
            </Field>
            <Field label="Cor">
              <input value={form.cor} onChange={e => setForm({ ...form, cor: e.target.value })} placeholder="Ex.: Prata" />
            </Field>
            <Field label="KM" error={formErrors.km}>
              <input type="number" value={form.km} onChange={e => setForm({ ...form, km: e.target.value })} />
            </Field>
            <Field label="Categoria">
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                {Object.entries(CATEGORIA_VEICULO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Combustível">
              <select value={form.combustivel} onChange={e => setForm({ ...form, combustivel: e.target.value })}>
                {["Flex", "Gasolina", "Diesel", "Elétrico", "Híbrido", "GNV"].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Câmbio">
              <select value={form.cambio} onChange={e => setForm({ ...form, cambio: e.target.value })}>
                {["Manual", "Automático", "CVT", "Automatizado"].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Valor de compra (R$)" required error={formErrors.valorCompra}>
              <input type="number" step="0.01" value={form.valorCompra} onChange={e => setForm({ ...form, valorCompra: e.target.value })} />
            </Field>
            <Field label="Valor anunciado (R$)" hint="Se vazio, usa compra + 15%">
              <input type="number" step="0.01" value={form.valorVenda} onChange={e => setForm({ ...form, valorVenda: e.target.value })} />
            </Field>
            <Field label="Data da compra">
              <input type="date" value={form.dataCompra} onChange={e => setForm({ ...form, dataCompra: e.target.value })} />
            </Field>
            <Field label="Fonte da compra">
              <select value={form.fonteCompra} onChange={e => setForm({ ...form, fonteCompra: e.target.value })}>
                {FONTE_COMPRA.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Status">
            <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              {Object.entries(STATUS_VEICULO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
          <Field label="Observações" hint="IPVA, revisões, particularidades">
            <textarea value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} rows={3}
                      style={{ resize: "vertical", minHeight: 70, fontFamily: T.body, fontSize: 15 }} />
          </Field>
          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={save}>Salvar</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ================== VENDAS ================== */
function VendasPanel({ vendas, setVendas, veiculos, setVeiculos, clientes, setClientes, cheques, setCheques, hidden, onEfetivarCompraTroca }) {
  const [form, setForm] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [reciboVenda, setReciboVenda] = useState(null); // ★ recibo após salvar

  // ★ Atalho rápido global: abre modal de nova venda ao receber evento
  useEffect(() => {
    const handler = () => novaVenda();
    window.addEventListener("af4:open-new-venda", handler);
    return () => window.removeEventListener("af4:open-new-venda", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = () => {
    const errs = {};
    if (!form.veiculoId) errs.veiculoId = "Selecione o veículo";
    if (!form.clienteId && !form.clienteNome?.trim()) errs.clienteId = "Informe o cliente";
    if (!form.valorVenda || parseFloat(form.valorVenda) <= 0) errs.valorVenda = "Valor de venda obrigatório";
    if (!form.dataVenda) errs.dataVenda = "Data obrigatória";

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }

    // Se cliente novo, cria
    let clienteId = form.clienteId;
    if (!clienteId && form.clienteNome) {
      const novoCliente = {
        id: uid(),
        nome: form.clienteNome.trim(),
        telefone: form.clienteTelefone || "",
        email: "", cidade: "", obs: "",
      };
      setClientes([...clientes, novoCliente]);
      clienteId = novoCliente.id;
    }

    // Calcula lucro líquido (persiste para exibir no painel sem recalcular)
    const veicAtual = veiculos.find(v => v.id === form.veiculoId);
    const totalDespVenda = Array.isArray(form.despesasVenda)
      ? form.despesasVenda.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0)
      : (parseFloat(form.despesas) || 0);
    const valorTrocaNum = parseFloat(form.valorTroca) || 0;
    const comissaoNum = parseFloat(form.comissao) || 0;
    const margem = veicAtual
      ? calcularMargem(veicAtual, parseFloat(form.valorVenda), totalDespVenda, comissaoNum, valorTrocaNum)
      : { absoluta: 0, percentual: 0 };

    const data = {
      ...form,
      clienteId,
      valorVenda: parseFloat(form.valorVenda),
      despesas: totalDespVenda, // mantém compat
      despesasVenda: (form.despesasVenda || []).map(d => ({ ...d, valor: parseFloat(d.valor) || 0 })),
      entrada: parseFloat(form.entrada) || 0,
      parcelas: parseInt(form.parcelas) || 0,
      comissao: comissaoNum,
      valorTroca: valorTrocaNum,
      // Persistir lucro pra performance no painel
      lucroLiquido: margem.absoluta,
      margem: { absoluta: margem.absoluta, percentual: margem.percentual },
    };
    delete data.clienteNome;
    delete data.clienteTelefone;

    const vendaAnterior = form.id ? vendas.find(v => v.id === form.id) : null;
    const isNova = !vendaAnterior;

    // gerar id de venda (mantém o existente em edições)
    const vendaId = vendaAnterior ? vendaAnterior.id : uid();
    data.id = vendaId;

    if (vendaAnterior) {
      setVendas(vendas.map(v => v.id === vendaId ? data : v));
    } else {
      setVendas([data, ...vendas]);
    }

    // Veículo trocou? (relevante apenas em edições)
    const veiculoAnteriorId = vendaAnterior ? vendaAnterior.veiculoId : null;
    const veiculoMudou = isNova || veiculoAnteriorId !== data.veiculoId;

    // Marca veículo como vendido (e reverte o anterior quando trocou)
    setVeiculos(prev => {
      let next = prev;
      if (veiculoMudou) {
        next = next.map(v => {
          if (veiculoAnteriorId && v.id === veiculoAnteriorId) return { ...v, status: "estoque" };
          if (v.id === data.veiculoId) return { ...v, status: "vendido", dataVenda: data.dataVenda };
          return v;
        });
      }

      // Se veio veículo em troca, adiciona ao estoque
      if (form.formaPagamento === "troca" || form.formaPagamento === "misto") {
        if (form.trocaVeiculo && valorTrocaNum > 0 && !form.trocaVeiculo.id) {
          const t = form.trocaVeiculo;
          const veicTroca = {
            id: uid(),
            marca: (t.marca || "").toUpperCase(),
            modelo: t.modelo || "",
            cor: "—", corHex: "#888",
            ano: parseInt(t.ano) || new Date().getFullYear(),
            anoModelo: parseInt(t.ano) || new Date().getFullYear(),
            km: parseInt(t.km) || 0,
            placa: t.placa || "",
            combustivel: "flex", cambio: "manual",
            valorCompra: valorTrocaNum,
            valorFipe: null,
            valorVenda: Math.round(valorTrocaNum * 1.15), // sugestão: 15% acima
            valorMinimo: valorTrocaNum,
            categoria: "outro",
            status: "estoque",
            dataEntrada: data.dataVenda,
            fornecedor: `Troca · venda ${data.dataVenda}`,
            dataCompra: data.dataVenda,
            formaCompra: "troca",
            origem: "troca",
            vendaOrigemId: vendaId,
            origemTroca: { vendaId, clienteId },
            despesasEntrada: [],
            obs: t.obs || `Recebido em troca da venda ${data.dataVenda}.`,
          };
          // marca o veículo de troca como já registrado para não duplicar em edições
          form.trocaVeiculo.id = veicTroca.id;
          data.trocaVeiculo = { ...form.trocaVeiculo };
          next = [...next, veicTroca];
        }
      }
      return next;
    });

    // Se veio cheques recebidos, adiciona à carteira (apenas os ainda não registrados)
    if ((form.formaPagamento === "cheques" || form.formaPagamento === "misto") && (form.chequesRecebidos || []).length > 0 && setCheques) {
      const novosCheques = (form.chequesRecebidos || [])
        .filter(c => parseFloat(c.valor) > 0 && !c.registrado)
        .map(c => {
          c.registrado = true;
          return {
            id: uid(),
            numero: c.numero || "",
            emitente: c.emitente || form.clienteNome || "",
            banco: c.banco || "",
            agencia: c.agencia || "",
            conta: c.conta || "",
            data: c.data || data.dataVenda,
            valor: parseFloat(c.valor) || 0,
            parcela: c.parcela || "",
            status: "aguardando",
            origemVendaId: vendaId,
            obs: `Recebido na venda ${data.dataVenda}`,
          };
        });
      if (novosCheques.length > 0) {
        setCheques(prev => [...(prev || []), ...novosCheques]);
      }
    }

    toast.success(
      isNova
        ? `Venda registrada · Lucro líquido: ${fmt(margem.absoluta)} (${margem.percentual.toFixed(1)}%)`
        : "Venda atualizada."
    );

    // ★ Abre recibo automaticamente em venda nova
    if (isNova) {
      const clienteRecibo = clientes.find(c => c.id === data.clienteId)
        || (form.clienteNome ? { nome: form.clienteNome, telefone: form.clienteTelefone } : null);
      setTimeout(() => setReciboVenda({ venda: data, veiculo: veicAtual, cliente: clienteRecibo }), 250);
    }
    setForm(null);
    setFormErrors({});
  };

  const novaVenda = () => {
    setForm({
      veiculoId: "",
      clienteId: "", clienteNome: "", clienteTelefone: "",
      dataVenda: todayISO(),
      valorVenda: "",
      despesas: 0,                  // legacy: total simples (mantido pra retrocompat)
      despesasVenda: [],            // novo: lista detalhada de despesas na venda
      formaPagamento: "financiamento",
      banco: BANCOS_FINANCIAMENTO[0],
      parcelas: 48, entrada: "",
      // Cheques recebidos como parte do pagamento
      chequesRecebidos: [],         // [{ id, numero, emitente, banco, data, valor, parcela }]
      // Veículo recebido em troca
      trocaVeiculo: null,           // { marca, modelo, ano, placa, km, valorAvaliacao, obs }
      valorTroca: 0,
      comissao: "", comissaoPaga: false,
      vendedor: "",
      obs: "",
    });
    setFormErrors({});
  };

  const veiculosDisponiveis = veiculos.filter(v => v.status === "estoque" || v.status === "reservado");

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={novaVenda} className="btn-gold flex items-center gap-2">
          <Plus size={16} /> Nova Venda
        </button>
      </div>

      {vendas.length === 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 60, textAlign: "center", color: T.muted, fontStyle: "italic" }}>
          Nenhuma venda registrada.
        </div>
      )}

      <div style={{ background: T.card, border: `1px solid ${T.border}` }} className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: 800 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Veículo", "Cliente", "Data", "Valor", "Pagamento", "Lucro", "Comissão", "Ações"].map((h, i) => (
                <th key={h} style={{ color: T.muted, padding: "12px 16px", textAlign: i >= 3 && i <= 6 ? "right" : "left",
                                     fontFamily: T.sans, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vendas.map(v => {
              const veic = veiculos.find(x => x.id === v.veiculoId);
              const cliente = clientes.find(c => c.id === v.clienteId);
              // Usa lucroLiquido persistido; recalcula se não tem (vendas legadas)
              let lucroAbs = typeof v.lucroLiquido === "number" ? v.lucroLiquido : null;
              let lucroPct = v.margem?.percentual ?? null;
              if ((lucroAbs == null || lucroPct == null) && veic) {
                const m = calcularMargem(veic, v.valorVenda, v.despesas, v.comissao, v.valorTroca);
                lucroAbs = m.absoluta;
                lucroPct = m.percentual;
              }
              const lucroCor = lucroPct == null ? T.muted : lucroPct >= 10 ? T.green : lucroPct >= 5 ? T.gold : T.red;
              return (
                <tr key={v.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ color: T.ink, fontSize: 14 }}>
                      {veic ? `${veic.marca} ${veic.modelo}` : <em style={{ color: T.muted }}>removido</em>}
                    </div>
                    {veic && <div style={{ color: T.muted, fontSize: 11 }}>{veic.ano} · {veic.placa}</div>}
                  </td>
                  <td style={{ padding: "12px 16px", color: T.ink, fontSize: 13 }}>
                    {cliente?.nome || <em style={{ color: T.muted }}>—</em>}
                  </td>
                  <td className="num" style={{ padding: "12px 16px", textAlign: "right", color: T.muted, fontSize: 12 }}>{v.dataVenda}</td>
                  <td className="num" style={{ padding: "12px 16px", textAlign: "right", color: T.gold, fontWeight: 600 }}>{hidden ? "•••" : fmt(v.valorVenda)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: T.muted, fontSize: 11 }}>
                    {v.formaPagamento === "financiamento" ? `${v.banco} · ${v.parcelas}×` :
                     v.formaPagamento === "vista" ? "À vista" :
                     v.formaPagamento === "cheques" ? `Cheques (${(v.chequesRecebidos || []).length}×)` :
                     v.formaPagamento === "troca" ? `Troca · ${fmt(v.valorTroca || 0)}` :
                     v.formaPagamento === "misto" ? "Misto" :
                     "Cartão/Outro"}
                  </td>
                  <td className="num" style={{ padding: "12px 16px", textAlign: "right", color: lucroCor, fontSize: 12, fontWeight: 600 }}>
                    {lucroAbs == null ? "—" : (
                      <>
                        {hidden ? "•••" : fmt(lucroAbs)}
                        <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.7 }}>
                          {lucroPct != null ? `${lucroPct.toFixed(1)}%` : ""}
                        </div>
                      </>
                    )}
                  </td>
                  <td className="num" style={{ padding: "12px 16px", textAlign: "right", color: v.comissaoPaga ? T.green : T.gold, fontSize: 12 }}>
                    {hidden ? "•••" : fmt(v.comissao || 0)} {v.comissaoPaga ? "✓" : "·"}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <button onClick={() => { setForm(v); setFormErrors({}); }}
                            aria-label="Editar venda"
                            style={{ color: T.muted, padding: 4, background: "transparent", border: "none", cursor: "pointer" }}>
                      <Edit3 size={12} />
                    </button>
                    <button onClick={async () => {
                              const ok = await confirm({
                                title: "Excluir venda?",
                                body: "O veículo voltará para estoque automaticamente.",
                                danger: true, confirmLabel: "Excluir",
                              });
                              if (!ok) return;
                              const backupVendas = vendas;
                              const backupVeiculos = veiculos;
                              setVendas(vendas.filter(x => x.id !== v.id));
                              if (veic) setVeiculos(veiculos.map(x => x.id === veic.id ? { ...x, status: "estoque" } : x));
                              toast.success("Venda excluída.", {
                                action: { label: "Desfazer", onClick: () => { setVendas(backupVendas); setVeiculos(backupVeiculos); } },
                              });
                            }}
                            aria-label="Excluir venda"
                            style={{ color: T.red, padding: 4, background: "transparent", border: "none", cursor: "pointer" }}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {form && (() => {
        const veicSelecionado = veiculos.find(v => v.id === form.veiculoId);
        const valorNum = parseFloat(form.valorVenda) || 0;
        const totalDespesasVenda = Array.isArray(form.despesasVenda)
          ? form.despesasVenda.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0)
          : (parseFloat(form.despesas) || 0);
        const valorTrocaNum = parseFloat(form.valorTroca) || 0;
        const comissaoNum = parseFloat(form.comissao) || 0;
        const margemPrev = veicSelecionado && valorNum
          ? calcularMargem(veicSelecionado, valorNum, totalDespesasVenda, comissaoNum, valorTrocaNum)
          : null;

        const addDespVenda = () => setForm({
          ...form,
          despesasVenda: [...(form.despesasVenda || []), { id: uid(), tipo: "Comissão extra", descricao: "", valor: "", data: todayISO() }],
        });
        const updDespVenda = (id, patch) => setForm({
          ...form,
          despesasVenda: (form.despesasVenda || []).map(d => d.id === id ? { ...d, ...patch } : d),
        });
        const rmDespVenda = (id) => setForm({
          ...form,
          despesasVenda: (form.despesasVenda || []).filter(d => d.id !== id),
        });

        const addCheque = () => setForm({
          ...form,
          chequesRecebidos: [...(form.chequesRecebidos || []), {
            id: uid(), numero: "", emitente: form.clienteNome || "",
            banco: "", data: todayISO(), valor: "", parcela: "",
          }],
        });
        const updCheque = (id, patch) => setForm({
          ...form,
          chequesRecebidos: (form.chequesRecebidos || []).map(c => c.id === id ? { ...c, ...patch } : c),
        });
        const rmCheque = (id) => setForm({
          ...form,
          chequesRecebidos: (form.chequesRecebidos || []).filter(c => c.id !== id),
        });
        const totalCheques = (form.chequesRecebidos || []).reduce((s, c) => s + (parseFloat(c.valor) || 0), 0);

        return (
          <Modal title={form.id ? "Editar Venda" : "Nova Venda"} onClose={() => setForm(null)}>
            <Field label="Veículo" required error={formErrors.veiculoId}>
              <select value={form.veiculoId} onChange={e => {
                const id = e.target.value;
                const v = veiculos.find(x => x.id === id);
                setForm({ ...form, veiculoId: id, valorVenda: form.valorVenda || (v?.valorVenda?.toString() || "") });
              }}>
                <option value="">Selecione…</option>
                {form.id && !veiculosDisponiveis.find(v => v.id === form.veiculoId) && veicSelecionado && (
                  <option value={veicSelecionado.id}>{veicSelecionado.marca} {veicSelecionado.modelo} · {veicSelecionado.placa} (vendido)</option>
                )}
                {veiculosDisponiveis.map(v => (
                  <option key={v.id} value={v.id}>{v.marca} {v.modelo} · {v.ano} · {v.placa || "sem placa"} · {fmt(v.valorVenda)}</option>
                ))}
              </select>
            </Field>

            {!form.id && (
              <Field label="Cliente" required error={formErrors.clienteId}
                     hint="Selecione existente ou preencha nome + telefone para criar novo">
                <select value={form.clienteId} onChange={e => setForm({ ...form, clienteId: e.target.value, clienteNome: "" })}>
                  <option value="">Selecione cliente existente ou crie abaixo…</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}{c.telefone ? ` · ${c.telefone}` : ""}</option>)}
                </select>
              </Field>
            )}

            {!form.id && !form.clienteId && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome do novo cliente">
                  <input value={form.clienteNome} onChange={e => setForm({ ...form, clienteNome: e.target.value })} />
                </Field>
                <Field label="Telefone">
                  <input value={form.clienteTelefone} onChange={e => setForm({ ...form, clienteTelefone: e.target.value })} placeholder="(11) 9..." />
                </Field>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Data da venda" required error={formErrors.dataVenda}>
                <input type="date" value={form.dataVenda} onChange={e => setForm({ ...form, dataVenda: e.target.value })} />
              </Field>
              <Field label="Valor da venda (R$)" required error={formErrors.valorVenda}>
                <input type="number" step="0.01" value={form.valorVenda} onChange={e => setForm({ ...form, valorVenda: e.target.value })} />
              </Field>
              <Field label="Despesas adicionais (R$)" hint="Gasolina, desbloqueio, polimento, etc.">
                <input type="number" step="0.01" value={form.despesas} onChange={e => setForm({ ...form, despesas: e.target.value })} />
              </Field>
              <Field label="Forma de pagamento">
                <select value={form.formaPagamento} onChange={e => setForm({ ...form, formaPagamento: e.target.value })}>
                  <option value="vista">À vista</option>
                  <option value="financiamento">Financiamento</option>
                  <option value="cartao">Cartão / Outro</option>
                  <option value="cheques">Cheques</option>
                  <option value="troca">Troca de veículo</option>
                  <option value="misto">Misto (combinado)</option>
                </select>
              </Field>
              {(form.formaPagamento === "financiamento" || form.formaPagamento === "misto") && (
                <>
                  <Field label="Banco">
                    <select value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })}>
                      {BANCOS_FINANCIAMENTO.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </Field>
                  <Field label="Parcelas">
                    <input type="number" min="1" max="72" value={form.parcelas} onChange={e => setForm({ ...form, parcelas: e.target.value })} />
                  </Field>
                  <Field label="Entrada (R$)">
                    <input type="number" step="0.01" value={form.entrada} onChange={e => setForm({ ...form, entrada: e.target.value })} />
                  </Field>
                </>
              )}
              <Field label="Comissão do vendedor (R$)">
                <input type="number" step="0.01" value={form.comissao} onChange={e => setForm({ ...form, comissao: e.target.value })} />
              </Field>
              <Field label="Vendedor">
                <input value={form.vendedor} onChange={e => setForm({ ...form, vendedor: e.target.value })} />
              </Field>
            </div>

            {/* ===== CHEQUES recebidos ===== */}
            {(form.formaPagamento === "cheques" || form.formaPagamento === "misto") && (
              <div style={{ marginTop: 12, padding: 14, border: `1px solid ${T.border}`, borderRadius: 8, background: T.bgSoft }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <strong style={{ fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: T.gold }}>
                    Cheques recebidos · Total {fmt(totalCheques)}
                  </strong>
                  <button type="button" onClick={addCheque} className="btn-ghost" style={{ padding: "5px 11px", fontSize: 11 }}>
                    + Cheque
                  </button>
                </div>
                {(form.chequesRecebidos || []).length === 0 ? (
                  <div style={{ fontSize: 11, color: T.faint, fontStyle: "italic", textAlign: "center", padding: 10 }}>
                    Nenhum cheque adicionado. Os cheques cadastrados aqui vão automaticamente para a carteira (Loja → Cheques).
                  </div>
                ) : (form.chequesRecebidos || []).map(c => (
                  <div key={c.id} style={{ display: "grid", gridTemplateColumns: "0.7fr 1.3fr 0.9fr 0.7fr 0.7fr 0.5fr auto", gap: 5, marginBottom: 6 }}>
                    <input value={c.numero} onChange={e => updCheque(c.id, { numero: e.target.value })} placeholder="Nº" />
                    <input value={c.emitente} onChange={e => updCheque(c.id, { emitente: e.target.value })} placeholder="Emitente" />
                    <input value={c.banco} onChange={e => updCheque(c.id, { banco: e.target.value })} placeholder="Banco" />
                    <input type="date" value={c.data} onChange={e => updCheque(c.id, { data: e.target.value })} />
                    <input type="number" step="0.01" value={c.valor} onChange={e => updCheque(c.id, { valor: e.target.value })} placeholder="Valor" />
                    <input value={c.parcela} onChange={e => updCheque(c.id, { parcela: e.target.value })} placeholder="1/3" />
                    <button onClick={() => rmCheque(c.id)} style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer" }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* ===== TROCA de veículo ===== */}
            {(form.formaPagamento === "troca" || form.formaPagamento === "misto") && (
              <div style={{ marginTop: 12, padding: 14, border: `1px solid ${T.border}`, borderRadius: 8, background: T.bgSoft }}>
                <strong style={{ fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: T.gold, marginBottom: 10, display: "block" }}>
                  Veículo recebido em troca
                </strong>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <Field label="Marca">
                    <input value={form.trocaVeiculo?.marca || ""}
                           onChange={e => setForm({ ...form, trocaVeiculo: { ...(form.trocaVeiculo || {}), marca: e.target.value } })}
                           placeholder="HONDA" />
                  </Field>
                  <Field label="Modelo">
                    <input value={form.trocaVeiculo?.modelo || ""}
                           onChange={e => setForm({ ...form, trocaVeiculo: { ...(form.trocaVeiculo || {}), modelo: e.target.value } })}
                           placeholder="Civic LX" />
                  </Field>
                  <Field label="Ano">
                    <input value={form.trocaVeiculo?.ano || ""}
                           onChange={e => setForm({ ...form, trocaVeiculo: { ...(form.trocaVeiculo || {}), ano: e.target.value } })}
                           placeholder="2018" />
                  </Field>
                  <Field label="Placa">
                    <input value={form.trocaVeiculo?.placa || ""}
                           onChange={e => setForm({ ...form, trocaVeiculo: { ...(form.trocaVeiculo || {}), placa: e.target.value.toUpperCase() } })}
                           placeholder="ABC-1D23" />
                  </Field>
                  <Field label="KM">
                    <input type="number" value={form.trocaVeiculo?.km || ""}
                           onChange={e => setForm({ ...form, trocaVeiculo: { ...(form.trocaVeiculo || {}), km: e.target.value } })}
                           placeholder="65000" />
                  </Field>
                  <Field label="Valor avaliação (R$) ★">
                    <input type="number" step="0.01" value={form.valorTroca || ""}
                           onChange={e => setForm({ ...form, valorTroca: e.target.value })}
                           placeholder="35000" />
                  </Field>
                </div>
                <Field label="Observações da troca">
                  <input value={form.trocaVeiculo?.obs || ""}
                         onChange={e => setForm({ ...form, trocaVeiculo: { ...(form.trocaVeiculo || {}), obs: e.target.value } })}
                         placeholder="Estado de conservação, opcionais, débitos…" />
                </Field>
                <div style={{ fontSize: 10.5, color: T.faint, fontStyle: "italic", marginTop: 6 }}>
                  ⓘ O veículo da troca entra automaticamente no Estoque com o valor de avaliação como custo de compra.
                </div>

                {/* Banner: efetivar compra do veículo da troca */}
                {onEfetivarCompraTroca && form.trocaVeiculo?.marca?.trim()
                  && form.trocaVeiculo?.modelo?.trim()
                  && parseFloat(form.valorTroca) > 0 && (
                  <div style={{
                    marginTop: 12, padding: "12px 14px",
                    background: `linear-gradient(135deg, ${T.gold}22, ${T.gold}11)`,
                    border: `1px solid ${T.gold}66`, borderRadius: 8,
                    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                  }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 13, color: T.gold, fontWeight: 600 }}>
                        🚗 Efetivar compra do {form.trocaVeiculo.marca} {form.trocaVeiculo.modelo}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                        Abre o fluxo de compra pré-preenchido · adiciona despesas de entrada (vistoria, polimento, documentação...)
                      </div>
                    </div>
                    <button type="button"
                      onClick={() => onEfetivarCompraTroca({
                        marca: form.trocaVeiculo.marca,
                        modelo: form.trocaVeiculo.modelo,
                        ano: form.trocaVeiculo.ano,
                        placa: form.trocaVeiculo.placa,
                        km: form.trocaVeiculo.km,
                        cor: form.trocaVeiculo.cor,
                        valorCompra: parseFloat(form.valorTroca) || 0,
                        fornecedor: form.clienteNome || "",
                        formaCompra: "troca",
                        obs: form.trocaVeiculo.obs || "",
                      })}
                      style={{
                        background: T.gold, color: T.bg,
                        border: "none", borderRadius: 7,
                        padding: "9px 14px", fontSize: 11.5, fontWeight: 600,
                        letterSpacing: ".05em", cursor: "pointer", whiteSpace: "nowrap",
                      }}>
                      → Efetivar compra
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ===== DESPESAS DA VENDA ===== */}
            <div style={{ marginTop: 12, padding: 14, border: `1px solid ${T.border}`, borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <strong style={{ fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: T.gold }}>
                  Despesas da venda · Total {fmt(totalDespesasVenda)}
                </strong>
                <button type="button" onClick={addDespVenda} className="btn-ghost" style={{ padding: "5px 11px", fontSize: 11 }}>
                  + Despesa
                </button>
              </div>
              {(form.despesasVenda || []).length === 0 ? (
                <div style={{ fontSize: 11, color: T.faint, fontStyle: "italic", textAlign: "center", padding: 8 }}>
                  Sem despesas adicionais. Use pra lançar comissão extra, despachante, transferência, etc.
                </div>
              ) : (form.despesasVenda || []).map(d => (
                <div key={d.id} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 1fr 1fr auto", gap: 5, marginBottom: 6 }}>
                  <select value={d.tipo} onChange={e => updDespVenda(d.id, { tipo: e.target.value })}>
                    <option>Comissão extra</option>
                    <option>Despachante</option>
                    <option>Transferência</option>
                    <option>Polimento final</option>
                    <option>Reparo pós-venda</option>
                    <option>Bonificação</option>
                    <option>Marketing</option>
                    <option>Outros</option>
                  </select>
                  <input value={d.descricao} onChange={e => updDespVenda(d.id, { descricao: e.target.value })} placeholder="Descrição" />
                  <input type="number" step="0.01" value={d.valor} onChange={e => updDespVenda(d.id, { valor: e.target.value })} placeholder="Valor" />
                  <input type="date" value={d.data} onChange={e => updDespVenda(d.id, { data: e.target.value })} />
                  <button onClick={() => rmDespVenda(d.id)} style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer" }}>✕</button>
                </div>
              ))}
            </div>

            {margemPrev && (
              <div style={{
                background: margemPrev.percentual >= 10 ? `${T.green}11` : `${T.gold}11`,
                border: `1px solid ${margemPrev.percentual >= 10 ? T.green : T.gold}`,
                padding: 12, marginTop: 12, fontSize: 12, borderRadius: 8,
              }}>
                <div style={{ fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted, marginBottom: 8 }}>
                  Cálculo do lucro
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 4 }}>
                  <span style={{ color: T.muted }}>Valor da venda:</span>
                  <span className="num" style={{ textAlign: "right" }}>{fmt(valorNum)}</span>
                  {valorTrocaNum > 0 && <>
                    <span style={{ color: T.muted }}>+ Veículo recebido em troca:</span>
                    <span className="num" style={{ textAlign: "right" }}>{fmt(valorTrocaNum)}</span>
                  </>}
                  <span style={{ color: T.muted, borderTop: `1px solid ${T.border}`, paddingTop: 4, marginTop: 2 }}>− Custo do veículo:</span>
                  <span className="num" style={{ textAlign: "right", borderTop: `1px solid ${T.border}`, paddingTop: 4, marginTop: 2 }}>−{fmt(margemPrev.custoTotal)}</span>
                  {margemPrev.despEntrada > 0 && (
                    <span style={{ color: T.faint, fontSize: 10, gridColumn: "1 / -1", paddingLeft: 12 }}>
                      (inclui {fmt(margemPrev.despEntrada)} de despesas de entrada)
                    </span>
                  )}
                  {totalDespesasVenda > 0 && <>
                    <span style={{ color: T.muted }}>− Despesas da venda:</span>
                    <span className="num" style={{ textAlign: "right" }}>−{fmt(totalDespesasVenda)}</span>
                  </>}
                  {comissaoNum > 0 && <>
                    <span style={{ color: T.muted }}>− Comissão vendedor:</span>
                    <span className="num" style={{ textAlign: "right" }}>−{fmt(comissaoNum)}</span>
                  </>}
                  <span style={{ fontWeight: 600, color: margemPrev.percentual >= 10 ? T.green : T.gold, borderTop: `2px solid ${T.border}`, paddingTop: 6, marginTop: 4 }}>
                    = Lucro líquido:
                  </span>
                  <span className="num" style={{
                    textAlign: "right", fontWeight: 700, fontSize: 14,
                    color: margemPrev.percentual >= 10 ? T.green : T.gold,
                    borderTop: `2px solid ${T.border}`, paddingTop: 6, marginTop: 4,
                  }}>
                    {fmt(margemPrev.absoluta)} <span style={{ fontSize: 11, fontWeight: 400 }}>({margemPrev.percentual.toFixed(1)}%)</span>
                  </span>
                </div>
                <div style={{ fontSize: 10.5, marginTop: 8, color: T.muted, fontStyle: "italic" }}>
                  {margemPrev.percentual < 5 && "⚠ Abaixo do giro rápido (5%)"}
                  {margemPrev.percentual >= 5 && margemPrev.percentual < 10 && "Giro rápido"}
                  {margemPrev.percentual >= 10 && margemPrev.percentual < 15 && "Margem média saudável"}
                  {margemPrev.percentual >= 15 && "Margem premium ✦"}
                </div>
              </div>
            )}

            <Field label="Observações">
              <textarea value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} rows={2}
                        style={{ resize: "vertical", minHeight: 60, fontFamily: T.body, fontSize: 15 }} />
            </Field>
            <label className="flex items-center gap-2 mb-4" style={{ color: T.muted, fontSize: 13 }}>
              <input type="checkbox" checked={form.comissaoPaga} onChange={e => setForm({ ...form, comissaoPaga: e.target.checked })} />
              Comissão já paga ao vendedor
            </label>
            <div className="flex gap-3">
              <button className="btn-gold" onClick={save}>{form.id ? "Atualizar" : "Registrar Venda"}</button>
              <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
            </div>
          </Modal>
        );
      })()}

      {/* ★ Recibo automático após nova venda */}
      {reciboVenda && (
        <ReciboVenda
          venda={reciboVenda.venda}
          veiculo={reciboVenda.veiculo}
          cliente={reciboVenda.cliente}
          onClose={() => setReciboVenda(null)}
        />
      )}
    </>
  );
}

/* ================== CLIENTES ================== */
function ClientesPanel({ clientes, setClientes, vendas }) {
  const [form, setForm] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const save = () => {
    const errs = {};
    if (!form.nome?.trim()) errs.nome = "Nome obrigatório";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }
    if (form.id && clientes.find(c => c.id === form.id)) {
      setClientes(clientes.map(c => c.id === form.id ? form : c));
      toast.success("Cliente atualizado.");
    } else {
      setClientes([...clientes, { ...form, id: uid() }]);
      toast.success(`${form.nome} adicionado.`);
    }
    setForm(null);
    setFormErrors({});
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => { setForm({ nome: "", telefone: "", email: "", cidade: "", obs: "" }); setFormErrors({}); }}
                className="btn-gold flex items-center gap-2">
          <Plus size={16} /> Novo Cliente
        </button>
      </div>

      {clientes.length === 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 60, textAlign: "center", color: T.muted, fontStyle: "italic" }}>
          Nenhum cliente cadastrado. Clientes também são criados automaticamente ao registrar vendas.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {clientes.map(c => {
          const vendasCliente = vendas.filter(v => v.clienteId === c.id);
          const totalCompras = vendasCliente.reduce((s, v) => s + Number(v.valorVenda || 0), 0);
          return (
            <div key={c.id} style={{ background: T.card, border: `1px solid ${T.border}`, padding: 16 }}>
              <div className="flex justify-between items-start mb-2">
                <div className="min-w-0 flex-1">
                  <div style={{ color: T.ink, fontFamily: T.serif, fontSize: 16, fontWeight: 500 }}>{c.nome}</div>
                  {c.telefone && <div style={{ color: T.muted, fontSize: 12 }}>{c.telefone}</div>}
                  {c.email && <div style={{ color: T.muted, fontSize: 12 }}>{c.email}</div>}
                  {c.cidade && <div style={{ color: T.faint, fontSize: 11 }}>{c.cidade}</div>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setForm(c); setFormErrors({}); }}
                          aria-label={`Editar ${c.nome}`}
                          style={{ color: T.muted, padding: 4, background: "transparent", border: "none", cursor: "pointer" }}>
                    <Edit3 size={12} />
                  </button>
                  <button onClick={async () => {
                            const ok = await confirm({ title: `Excluir ${c.nome}?`, danger: true, confirmLabel: "Excluir" });
                            if (!ok) return;
                            const backup = clientes;
                            setClientes(clientes.filter(x => x.id !== c.id));
                            toast.success("Cliente excluído.", { action: { label: "Desfazer", onClick: () => setClientes(backup) } });
                          }}
                          aria-label={`Excluir ${c.nome}`}
                          style={{ color: T.red, padding: 4, background: "transparent", border: "none", cursor: "pointer" }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {vendasCliente.length > 0 && (
                <div style={{ paddingTop: 10, borderTop: `1px solid ${T.border}`, marginTop: 10 }}>
                  <div style={{ color: T.gold, fontSize: 11, fontFamily: T.sans, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {vendasCliente.length} compra{vendasCliente.length !== 1 ? "s" : ""} · {fmt(totalCompras)}
                  </div>
                </div>
              )}
              {c.obs && (
                <div style={{ color: T.muted, fontSize: 12, fontStyle: "italic", marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${T.border}` }}>
                  {c.obs}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {form && (
        <Modal title={form.id ? "Editar Cliente" : "Novo Cliente"} onClose={() => setForm(null)}>
          <Field label="Nome" required error={formErrors.nome}>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone">
              <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(11) 9..." />
            </Field>
            <Field label="E-mail">
              <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Cidade">
            <input value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} />
          </Field>
          <Field label="Observações" hint="Interesse, preferências, histórico…">
            <textarea value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} rows={3}
                      style={{ resize: "vertical", minHeight: 70, fontFamily: T.body, fontSize: 15 }} />
          </Field>
          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={save}>Salvar</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </>
  );
}
