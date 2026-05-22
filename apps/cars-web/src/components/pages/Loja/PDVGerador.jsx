import React, { useState, useMemo } from "react";
import { T } from "../../../lib/theme.js";
import { fmt, uid } from "../../../lib/format.js";
import { Printer, Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "../../../lib/toast.js";

/**
 * Gerador de PDV — Proposta de Negociação de Veículos
 * Reproduz fielmente o modelo da AF4 Motors (com tabelas de Usados,
 * Troco/Devoluções, Resumo de Pagamento e assinaturas).
 */
export default function PDVGerador({ veiculos = [], vendas = [], clientes = [], onVoltar }) {
  // ===== EMPRESA (dados fixos da AF4) =====
  const [empresa, setEmpresa] = useState({
    codigo: "E00050",
    nome: "AFONSO AF4 *",
    cnpj: "46.167.067/0001-16",
    fone: "15-997408971",
  });

  // ===== PROPOSTA =====
  const [proposta, setProposta] = useState({
    numero: String(Date.now()).slice(-6).padStart(6, "0"),
    emissao: todayISOFmt(),
    validade: addDaysFmt(30),
    vendedorCodigo: "V00002",
    vendedorNome: "ANDERSON KID",
    aprovacaoData: todayISOFmt(),
    aprovacaoVendedor: "V00002",
    pagina: "1 de 1",
    codigoFormulario: "VEIM05P",
  });

  // ===== CLIENTE =====
  const [cliente, setCliente] = useState({
    codigo: "C00001",
    nome: "",
    endereco: "",
    bairro: "",
    cep: "",
    cidade: "",
    uf: "SP",
    cpfCnpj: "",
    rgIe: "",
    foneCom: "",
    foneRes: "",
    foneCel: "",
    foneCon: "",
    email: "",
  });

  // ===== VEÍCULO À VENDA =====
  const [veiculo, setVeiculo] = useState({
    ficha: "",
    nome: "",
    marca: "",
    tipo: "Usado",
    cor: "",
    corCodigo: "",
    corInterna: "",
    fabMod: "",
    portas: "00",
    combustivel: "",
    chassi: "",
    placa: "",
    cFab: "",
    valorVenda: "",
  });

  // ===== USADOS (carros entrando como parte do pagamento) =====
  const [usados, setUsados] = useState([]);
  const novoUsado = () => setUsados([...usados, {
    id: uid(), modelo: "", fabMod: "", portas: "", placa: "", renavam: "",
    cor: "", combustivel: "", marca: "", motor: "", opcionais: "",
    valorTabela: "", valorAvaliacao: "",
  }]);
  const removeUsado = (id) => setUsados(usados.filter(u => u.id !== id));
  const updateUsado = (id, patch) => setUsados(usados.map(u => u.id === id ? { ...u, ...patch } : u));

  // ===== TROCO / DEVOLUÇÕES =====
  const [trocos, setTrocos] = useState([]);
  const novoTroco = () => setTrocos([...trocos, { id: uid(), tipo: "01", descricao: "DEVOLUCAO TROCO", obs: "", responsavel: "", valor: "" }]);
  const removeTroco = (id) => setTrocos(trocos.filter(t => t.id !== id));
  const updateTroco = (id, patch) => setTrocos(trocos.map(t => t.id === id ? { ...t, ...patch } : t));

  // ===== OBSERVAÇÕES =====
  const [observacoes, setObservacoes] = useState("");

  // ===== RESUMO DE PAGAMENTO (alguns calculados) =====
  const [pagto, setPagto] = useState({
    aVista: "",
    prazoParcelado: "",
    leasing: "",
    financiamento: "",
    consorcio: "",
    desconto: "",
  });

  // ===== CÁLCULOS =====
  const totaisCalculados = useMemo(() => {
    const valorVenda = parseFloat(veiculo.valorVenda) || 0;
    const trocaUsados = usados.reduce((s, u) => s + (parseFloat(u.valorAvaliacao) || 0), 0);
    const aVista          = parseFloat(pagto.aVista)         || 0;
    const prazoParcelado  = parseFloat(pagto.prazoParcelado) || 0;
    const leasing         = parseFloat(pagto.leasing)        || 0;
    const financiamento   = parseFloat(pagto.financiamento)  || 0;
    const consorcio       = parseFloat(pagto.consorcio)      || 0;
    const desconto        = parseFloat(pagto.desconto)       || 0;
    const totalPago = aVista + prazoParcelado + leasing + financiamento + consorcio + trocaUsados;
    const trocoDevol = trocos.reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const valorTotalNF = valorVenda - desconto;
    return { valorVenda, aVista, prazoParcelado, leasing, financiamento, consorcio, trocaUsados, totalPago, trocoDevol, desconto, valorTotalNF };
  }, [veiculo.valorVenda, usados, pagto, trocos]);

  // ===== IMPRESSÃO =====
  const imprimir = () => {
    const html = renderPdvHtml({ empresa, proposta, cliente, veiculo, usados, trocos, observacoes, totaisCalculados });
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) {
      toast.error("Pop-up bloqueado. Libere os pop-ups deste site para imprimir o PDV.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  };

  // ===== AUTOPREENCHER DE UMA VENDA EXISTENTE =====
  const [vendaSelecionada, setVendaSelecionada] = useState("");
  const preencherDeVenda = (vId) => {
    const v = vendas.find(x => x.id === vId);
    if (!v) return;
    const veic = veiculos.find(vc => vc.id === v.veiculoId);
    const cli  = clientes.find(c => c.id === v.clienteId);
    if (veic) {
      setVeiculo({
        ...veiculo,
        ficha: veic.id?.slice(-6) || "",
        nome: `${veic.modelo || ""} ${veic.versao || ""}`.trim(),
        marca: veic.marca || "",
        cor: veic.cor || "",
        fabMod: `${veic.anoFab || ""}/${veic.anoMod || ""}`,
        combustivel: veic.combustivel || "",
        chassi: veic.chassi || "",
        placa: veic.placa || "",
        valorVenda: String(v.valorVenda || veic.precoAnunciado || ""),
      });
    }
    if (cli) {
      setCliente({
        ...cliente,
        codigo: cli.id?.slice(-6) || "C00001",
        nome: cli.nome || "",
        cpfCnpj: cli.cpf || cli.cnpj || "",
        endereco: cli.endereco || "",
        cidade: cli.cidade || "",
        foneCel: cli.telefone || "",
        email: cli.email || "",
      });
    }
    setVendaSelecionada(vId);
  };

  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      <button onClick={onVoltar} className="btn-back" style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 12px", borderRadius: 7,
        background: "transparent", border: `1px solid ${T.border}`,
        color: T.muted, fontSize: 11, cursor: "pointer", marginBottom: 14,
      }}>
        <ArrowLeft size={14} /> Voltar para Relatórios
      </button>

      <div className="eb">Loja AF4 · Documentos</div>
      <h1 className="h1">Gerador de <em>PDV.</em></h1>
      <p className="hs">Proposta de Negociação de Veículos · idêntico ao modelo da AF4 Motors. Preencha e imprima.</p>

      {/* Autopreencher a partir de venda existente */}
      {vendas.length > 0 && (
        <div className="fb" style={{ marginTop: 18 }}>
          <h4>Preencher a partir de uma venda registrada</h4>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={vendaSelecionada}
                    onChange={e => preencherDeVenda(e.target.value)}
                    style={{ minWidth: 280, padding: "9px 11px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 7, color: T.ink, fontSize: 13 }}>
              <option value="">— Selecione uma venda —</option>
              {vendas.map(v => {
                const vec = veiculos.find(x => x.id === v.veiculoId);
                const cli = clientes.find(x => x.id === v.clienteId);
                return <option key={v.id} value={v.id}>
                  {`#${(v.id || "").slice(-4)} · ${vec?.marca || ""} ${vec?.modelo || ""} · ${cli?.nome || "cliente"} · ${fmt(v.valorVenda || 0)}`}
                </option>;
              })}
            </select>
            <span style={{ fontSize: 11, color: T.muted, fontStyle: "italic" }}>
              Os campos abaixo são preenchidos automaticamente. Você ainda pode editar tudo.
            </span>
          </div>
        </div>
      )}

      {/* EMPRESA + PROPOSTA */}
      <Section title="Empresa & Proposta">
        <Row>
          <FF label="Empresa código"><input value={empresa.codigo} onChange={e => setEmpresa({...empresa, codigo: e.target.value})} /></FF>
          <FF label="Razão social" wide><input value={empresa.nome} onChange={e => setEmpresa({...empresa, nome: e.target.value})} /></FF>
          <FF label="CNPJ"><input value={empresa.cnpj} onChange={e => setEmpresa({...empresa, cnpj: e.target.value})} /></FF>
          <FF label="Telefone"><input value={empresa.fone} onChange={e => setEmpresa({...empresa, fone: e.target.value})} /></FF>
        </Row>
        <Row>
          <FF label="Proposta nº"><input value={proposta.numero} onChange={e => setProposta({...proposta, numero: e.target.value})} /></FF>
          <FF label="Emissão"><input value={proposta.emissao} onChange={e => setProposta({...proposta, emissao: e.target.value})} placeholder="dd/mm/aaaa" /></FF>
          <FF label="Validade"><input value={proposta.validade} onChange={e => setProposta({...proposta, validade: e.target.value})} placeholder="dd/mm/aaaa" /></FF>
          <FF label="Vendedor código"><input value={proposta.vendedorCodigo} onChange={e => setProposta({...proposta, vendedorCodigo: e.target.value})} /></FF>
          <FF label="Vendedor nome" wide><input value={proposta.vendedorNome} onChange={e => setProposta({...proposta, vendedorNome: e.target.value})} /></FF>
        </Row>
      </Section>

      {/* CLIENTE */}
      <Section title="Dados do Cliente">
        <Row>
          <FF label="Código"><input value={cliente.codigo} onChange={e => setCliente({...cliente, codigo: e.target.value})} /></FF>
          <FF label="Nome completo" wide={2}><input value={cliente.nome} onChange={e => setCliente({...cliente, nome: e.target.value})} /></FF>
          <FF label="CPF/CNPJ"><input value={cliente.cpfCnpj} onChange={e => setCliente({...cliente, cpfCnpj: e.target.value})} /></FF>
          <FF label="RG / I.E"><input value={cliente.rgIe} onChange={e => setCliente({...cliente, rgIe: e.target.value})} /></FF>
        </Row>
        <Row>
          <FF label="Endereço" wide={2}><input value={cliente.endereco} onChange={e => setCliente({...cliente, endereco: e.target.value})} /></FF>
          <FF label="Bairro"><input value={cliente.bairro} onChange={e => setCliente({...cliente, bairro: e.target.value})} /></FF>
          <FF label="CEP"><input value={cliente.cep} onChange={e => setCliente({...cliente, cep: e.target.value})} /></FF>
          <FF label="Cidade"><input value={cliente.cidade} onChange={e => setCliente({...cliente, cidade: e.target.value})} /></FF>
          <FF label="UF"><input value={cliente.uf} maxLength={2} onChange={e => setCliente({...cliente, uf: e.target.value.toUpperCase()})} /></FF>
        </Row>
        <Row>
          <FF label="Fone Com."><input value={cliente.foneCom} onChange={e => setCliente({...cliente, foneCom: e.target.value})} /></FF>
          <FF label="Fone Res."><input value={cliente.foneRes} onChange={e => setCliente({...cliente, foneRes: e.target.value})} /></FF>
          <FF label="Fone Cel."><input value={cliente.foneCel} onChange={e => setCliente({...cliente, foneCel: e.target.value})} /></FF>
          <FF label="Fone Cont."><input value={cliente.foneCon} onChange={e => setCliente({...cliente, foneCon: e.target.value})} /></FF>
          <FF label="E-mail" wide={2}><input type="email" value={cliente.email} onChange={e => setCliente({...cliente, email: e.target.value})} /></FF>
        </Row>
      </Section>

      {/* VEÍCULO À VENDA */}
      <Section title="Dados do Veículo proposto para Venda">
        <Row>
          <FF label="Ficha"><input value={veiculo.ficha} onChange={e => setVeiculo({...veiculo, ficha: e.target.value})} /></FF>
          <FF label="Veículo" wide={2}><input value={veiculo.nome} onChange={e => setVeiculo({...veiculo, nome: e.target.value})} placeholder="Ex: XRE 300 ABS" /></FF>
          <FF label="Marca"><input value={veiculo.marca} onChange={e => setVeiculo({...veiculo, marca: e.target.value})} placeholder="Ex: HONDA" /></FF>
          <FF label="Tipo">
            <select value={veiculo.tipo} onChange={e => setVeiculo({...veiculo, tipo: e.target.value})}>
              <option>Usado</option>
              <option>Novo</option>
              <option>Seminovo</option>
            </select>
          </FF>
        </Row>
        <Row>
          <FF label="Cor"><input value={veiculo.corCodigo} onChange={e => setVeiculo({...veiculo, corCodigo: e.target.value})} placeholder="Cód." style={{maxWidth:60}} /></FF>
          <FF label="Cor descrição"><input value={veiculo.cor} onChange={e => setVeiculo({...veiculo, cor: e.target.value})} placeholder="VERMELHA" /></FF>
          <FF label="Cor interna"><input value={veiculo.corInterna} onChange={e => setVeiculo({...veiculo, corInterna: e.target.value})} /></FF>
          <FF label="Fab/Mod"><input value={veiculo.fabMod} onChange={e => setVeiculo({...veiculo, fabMod: e.target.value})} placeholder="2022/2022" /></FF>
          <FF label="Portas"><input value={veiculo.portas} onChange={e => setVeiculo({...veiculo, portas: e.target.value})} /></FF>
          <FF label="Combustível"><input value={veiculo.combustivel} onChange={e => setVeiculo({...veiculo, combustivel: e.target.value})} placeholder="Álcool e Gasolina" /></FF>
        </Row>
        <Row>
          <FF label="Chassi" wide={2}><input value={veiculo.chassi} onChange={e => setVeiculo({...veiculo, chassi: e.target.value})} /></FF>
          <FF label="Placa"><input value={veiculo.placa} onChange={e => setVeiculo({...veiculo, placa: e.target.value})} /></FF>
          <FF label="C.Fab"><input value={veiculo.cFab} onChange={e => setVeiculo({...veiculo, cFab: e.target.value})} /></FF>
          <FF label="Valor de venda (R$) ★"><input type="number" step="0.01" value={veiculo.valorVenda} onChange={e => setVeiculo({...veiculo, valorVenda: e.target.value})} placeholder="28000.00" /></FF>
        </Row>
      </Section>

      {/* USADOS */}
      <Section title="(+) Usados na troca">
        <div style={{ marginBottom: 12 }}>
          <button onClick={novoUsado} className="btn-gold" style={{ padding: "8px 14px", fontSize: 11 }}>
            <Plus size={12} style={{ display: "inline", marginRight: 4 }} /> Adicionar veículo usado
          </button>
        </div>
        {usados.length === 0 ? (
          <div style={{ padding: 16, color: T.muted, fontSize: 12, fontStyle: "italic", textAlign: "center" }}>
            Nenhum veículo usado entrando na troca.
          </div>
        ) : usados.map((u, i) => (
          <div key={u.id} style={{ background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <strong style={{ fontSize: 11, color: T.muted, letterSpacing: ".15em", textTransform: "uppercase" }}>Veículo usado #{i + 1}</strong>
              <button onClick={() => removeUsado(u.id)} style={{ color: T.red, background: "transparent", border: "none", cursor: "pointer" }}><Trash2 size={14} /></button>
            </div>
            <Row>
              <FF label="Marca"><input value={u.marca} onChange={e => updateUsado(u.id, { marca: e.target.value })} placeholder="CHERY" /></FF>
              <FF label="Modelo" wide={2}><input value={u.modelo} onChange={e => updateUsado(u.id, { modelo: e.target.value })} placeholder="CITROEN C3 GLX 1.4" /></FF>
              <FF label="Fab/Mod"><input value={u.fabMod} onChange={e => updateUsado(u.id, { fabMod: e.target.value })} placeholder="2009/2009" /></FF>
              <FF label="Portas"><input value={u.portas} onChange={e => updateUsado(u.id, { portas: e.target.value })} /></FF>
            </Row>
            <Row>
              <FF label="Placa"><input value={u.placa} onChange={e => updateUsado(u.id, { placa: e.target.value })} /></FF>
              <FF label="Renavam"><input value={u.renavam} onChange={e => updateUsado(u.id, { renavam: e.target.value })} /></FF>
              <FF label="Cor"><input value={u.cor} onChange={e => updateUsado(u.id, { cor: e.target.value })} /></FF>
              <FF label="Combustível"><input value={u.combustivel} onChange={e => updateUsado(u.id, { combustivel: e.target.value })} /></FF>
            </Row>
            <Row>
              <FF label="Motor"><input value={u.motor} onChange={e => updateUsado(u.id, { motor: e.target.value })} /></FF>
              <FF label="Opcionais" wide={2}><input value={u.opcionais} onChange={e => updateUsado(u.id, { opcionais: e.target.value })} placeholder="COMPLETO" /></FF>
              <FF label="Valor Tabela (R$)"><input type="number" step="0.01" value={u.valorTabela} onChange={e => updateUsado(u.id, { valorTabela: e.target.value })} /></FF>
              <FF label="Valor Avaliação (R$)"><input type="number" step="0.01" value={u.valorAvaliacao} onChange={e => updateUsado(u.id, { valorAvaliacao: e.target.value })} /></FF>
            </Row>
          </div>
        ))}
        {usados.length > 0 && (
          <div style={{ textAlign: "right", padding: "8px 14px", fontSize: 13, fontWeight: 500 }}>
            Total dos usados: <span style={{ color: T.green, fontVariantNumeric: "tabular-nums" }}>{fmt(totaisCalculados.trocaUsados)}</span>
          </div>
        )}
      </Section>

      {/* TROCO / DEVOLUÇÕES */}
      <Section title="(−) Troco / Devoluções ao cliente">
        <div style={{ marginBottom: 12 }}>
          <button onClick={novoTroco} className="btn-gold" style={{ padding: "8px 14px", fontSize: 11 }}>
            <Plus size={12} style={{ display: "inline", marginRight: 4 }} /> Adicionar troco/devolução
          </button>
        </div>
        {trocos.length === 0 ? (
          <div style={{ padding: 16, color: T.muted, fontSize: 12, fontStyle: "italic", textAlign: "center" }}>
            Nenhum troco ou devolução.
          </div>
        ) : trocos.map((t, i) => (
          <Row key={t.id}>
            <FF label="Tipo"><input value={t.tipo} onChange={e => updateTroco(t.id, { tipo: e.target.value })} placeholder="01" style={{maxWidth:50}} /></FF>
            <FF label="Descrição" wide={2}><input value={t.descricao} onChange={e => updateTroco(t.id, { descricao: e.target.value })} placeholder="DEVOLUCAO TROCO" /></FF>
            <FF label="OBS"><input value={t.obs} onChange={e => updateTroco(t.id, { obs: e.target.value })} /></FF>
            <FF label="Responsável"><input value={t.responsavel} onChange={e => updateTroco(t.id, { responsavel: e.target.value })} /></FF>
            <FF label="Valor (R$)"><input type="number" step="0.01" value={t.valor} onChange={e => updateTroco(t.id, { valor: e.target.value })} /></FF>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 4 }}>
              <button onClick={() => removeTroco(t.id)} style={{ color: T.red, background: "transparent", border: "none", cursor: "pointer", padding: 6 }}>
                <Trash2 size={14} />
              </button>
            </div>
          </Row>
        ))}
      </Section>

      {/* PAGAMENTO */}
      <Section title="Resumo de Pagamento">
        <Row>
          <FF label="À vista (R$)"><input type="number" step="0.01" value={pagto.aVista} onChange={e => setPagto({...pagto, aVista: e.target.value})} /></FF>
          <FF label="Prazo/Parcelado (R$)"><input type="number" step="0.01" value={pagto.prazoParcelado} onChange={e => setPagto({...pagto, prazoParcelado: e.target.value})} /></FF>
          <FF label="Leasing (R$)"><input type="number" step="0.01" value={pagto.leasing} onChange={e => setPagto({...pagto, leasing: e.target.value})} /></FF>
          <FF label="Financiamento (R$)"><input type="number" step="0.01" value={pagto.financiamento} onChange={e => setPagto({...pagto, financiamento: e.target.value})} /></FF>
          <FF label="Consórcio (R$)"><input type="number" step="0.01" value={pagto.consorcio} onChange={e => setPagto({...pagto, consorcio: e.target.value})} /></FF>
          <FF label="Desconto (R$)"><input type="number" step="0.01" value={pagto.desconto} onChange={e => setPagto({...pagto, desconto: e.target.value})} /></FF>
        </Row>
        <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14, marginTop: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 13 }}>
            <span>Valor Venda Veículo:</span><span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(totaisCalculados.valorVenda)}</span>
            <span style={{ color: T.muted }}>+ Troca Usados:</span><span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: T.muted }}>{fmt(totaisCalculados.trocaUsados)}</span>
            <span style={{ color: T.muted }}>+ À vista + Parcelas + Leasing + Financ. + Consórcio:</span>
            <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: T.muted }}>{fmt(totaisCalculados.totalPago - totaisCalculados.trocaUsados)}</span>
            <strong>Total Pago (+):</strong><strong style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(totaisCalculados.totalPago)}</strong>
            <span style={{ color: T.red }}>− Troco/Devol:</span><span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: T.red }}>{fmt(totaisCalculados.trocoDevol)}</span>
            <span style={{ color: T.red }}>− Desconto:</span><span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: T.red }}>{fmt(totaisCalculados.desconto)}</span>
            <strong style={{ color: T.gold, borderTop: `1px solid ${T.border}`, paddingTop: 6, marginTop: 4 }}>Valor Total NF (=):</strong>
            <strong style={{ color: T.gold, textAlign: "right", fontVariantNumeric: "tabular-nums", borderTop: `1px solid ${T.border}`, paddingTop: 6, marginTop: 4 }}>
              {fmt(totaisCalculados.valorTotalNF)}
            </strong>
          </div>
        </div>
      </Section>

      {/* OBSERVAÇÕES */}
      <Section title="Observações">
        <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)}
                  rows={3}
                  placeholder="Ex: repasse pardal c3 e palio 30,000"
                  style={{ width: "100%", padding: 11, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 7, color: T.ink, fontSize: 13, fontFamily: T.body, resize: "vertical" }} />
      </Section>

      {/* AÇÃO */}
      <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button onClick={onVoltar} className="btn-ghost">Cancelar</button>
        <button onClick={imprimir} className="btn-gold" style={{ fontSize: 13, padding: "12px 22px" }}>
          <Printer size={14} style={{ display: "inline", marginRight: 8 }} />
          Visualizar e Imprimir
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   HELPERS
   ============================================================ */

function todayISOFmt() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}
function addDaysFmt(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
}

function Section({ title, children }) {
  return (
    <div className="fb" style={{ marginTop: 18 }}>
      <h4>{title}</h4>
      {children}
    </div>
  );
}
function Row({ children }) {
  return <div className="fr" style={{ marginBottom: 8 }}>{children}</div>;
}
function FF({ label, wide, children }) {
  const span = wide === 2 ? "1 / span 2" : wide ? "1 / span 2" : "auto";
  return (
    <div className="ff" style={{ gridColumn: span }}>
      <label>{label}</label>
      {children}
    </div>
  );
}

/* ============================================================
   RENDERIZAÇÃO DO PDV EM HTML (idêntico ao modelo AF4)
   ============================================================ */
function renderPdvHtml({ empresa, proposta, cliente, veiculo, usados, trocos, observacoes, totaisCalculados }) {
  const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const usadosRows = usados.map(u => `
    <table class="usado-tbl">
      <tr>
        <td class="lbl">Modelo</td><td>${esc(u.modelo)}</td>
        <td class="lbl">Fab/Mod</td><td>${esc(u.fabMod)}</td>
        <td class="lbl">N.Ps</td><td>${esc(u.portas)}</td>
        <td class="lbl">Placa</td><td>${esc(u.placa)}</td>
        <td class="lbl">Renavam</td><td>${esc(u.renavam)}</td>
        <td class="lbl">Cor</td><td>${esc(u.cor)}</td>
        <td class="lbl combustivel">Combustível</td><td>${esc(u.combustivel)}</td>
      </tr>
      <tr>
        <td class="lbl">Marca</td><td>${esc(u.marca)}</td>
        <td class="lbl">Motor</td><td>${esc(u.motor)}</td>
        <td class="lbl">Opcionais</td><td colspan="3">${esc(u.opcionais)}</td>
        <td class="lbl">Valor de Tabela</td><td class="num">${brl(u.valorTabela)}</td>
        <td class="lbl">Valor Avaliação</td><td class="num bold">${brl(u.valorAvaliacao)}</td>
      </tr>
    </table>`).join("");

  const trocosRows = trocos.length === 0
    ? ""
    : `<table class="trocos">
        <thead><tr><th>Tipo</th><th>Descrição</th><th>OBS</th><th>Responsável</th><th class="num">Valor</th></tr></thead>
        <tbody>
          ${trocos.map(t => `<tr>
            <td>${esc(t.tipo)}</td>
            <td>${esc(t.descricao)}</td>
            <td>${esc(t.obs)}</td>
            <td>${esc(t.responsavel)}</td>
            <td class="num">${brl(t.valor)}</td>
          </tr>`).join("")}
          <tr class="total"><td colspan="4" class="num">Total</td><td class="num bold">${brl(totaisCalculados.trocoDevol)}</td></tr>
        </tbody>
      </table>`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>PDV ${proposta.numero} · ${cliente.nome || "Cliente"}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #000; padding: 12mm; background: #fff; }
.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1.5px solid #000; padding-bottom: 6px; margin-bottom: 10px; }
.logo { font-family: "Arial Black", sans-serif; font-size: 28pt; line-height: 1; }
.title { text-align: center; font-size: 14pt; font-weight: bold; flex: 1; padding-top: 6px; }
.meta { text-align: right; font-size: 8pt; line-height: 1.4; }
.box { border: 1.5px solid #000; padding: 5px 8px; margin-bottom: 4px; }
.box-title { font-weight: bold; font-size: 9pt; margin-bottom: 4px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; font-size: 8.5pt; }
.grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 16px; font-size: 8.5pt; }
.field { display: flex; gap: 4px; }
.field b { font-weight: bold; min-width: max-content; }
.section-title { font-weight: bold; font-size: 10pt; margin: 8px 0 4px; }
.subsection { font-weight: bold; font-size: 9pt; font-style: italic; margin: 4px 0; }
table { width: 100%; border-collapse: collapse; font-size: 8pt; }
.usado-tbl { margin-bottom: 6px; border: 1px solid #000; }
.usado-tbl td { padding: 3px 6px; border-right: 1px solid #888; vertical-align: top; }
.usado-tbl td.lbl { font-weight: bold; background: #f0f0f0; font-size: 7.5pt; }
.usado-tbl td.num { text-align: right; }
.usado-tbl td.bold { font-weight: bold; }
.trocos { border: 1px solid #000; margin-top: 6px; }
.trocos th, .trocos td { padding: 4px 6px; border: 1px solid #888; }
.trocos th { background: #f0f0f0; text-align: left; }
.trocos .num { text-align: right; }
.trocos .total td { font-weight: bold; background: #f0f0f0; }
.bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 12px; }
.obs-box { border: 1px solid #000; padding: 6px; min-height: 80px; font-size: 8.5pt; }
.resumo-tbl { border: 1px solid #000; }
.resumo-tbl td { padding: 3px 8px; border-bottom: 1px solid #ccc; }
.resumo-tbl td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
.resumo-tbl tr.total td { font-weight: bold; border-top: 1.5px solid #000; background: #f0f0f0; padding: 6px 8px; font-size: 10pt; }
.signs { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px; padding-top: 6px; }
.sign { text-align: center; font-size: 8.5pt; }
.sign-line { border-top: 1px solid #000; padding-top: 4px; margin: 30px 16px 0; }
.sign-label { font-weight: bold; margin-bottom: 30px; }
.num { text-align: right; font-variant-numeric: tabular-nums; }
.bold { font-weight: bold; }
@media print { body { padding: 8mm; } @page { size: A4; margin: 0; } }
</style></head>
<body>
<div class="header">
  <div class="logo">AF4</div>
  <div class="title">Proposta de Negociação de Veículos</div>
  <div class="meta">
    Página ${proposta.pagina}<br>
    ${proposta.emissao} ${new Date().toLocaleTimeString("pt-BR").slice(0,5)}<br>
    Validade da Proposta: ${proposta.validade}<br>
    * ${proposta.codigoFormulario} *
  </div>
</div>

<div class="box">
  <div class="grid3">
    <div class="field"><b>Empresa:</b> ${esc(empresa.codigo)} ${esc(empresa.nome)}</div>
    <div class="field"><b>CNPJ:</b> ${esc(empresa.cnpj)}</div>
    <div class="field" style="text-align:right; justify-content: flex-end;">${esc(empresa.fone)}</div>
  </div>
</div>

<div class="box">
  <div class="box-title">Dados da Proposta</div>
  <div class="grid3">
    <div class="field"><b>Proposta Nº:</b> ${esc(proposta.numero)}</div>
    <div class="field"><b>Emissão:</b> ${esc(proposta.emissao)}</div>
    <div class="field"><b>Valor Venda:</b> ${brl(totaisCalculados.valorVenda)}</div>
    <div class="field"><b>Vendedor:</b> ${esc(proposta.vendedorCodigo)} ${esc(proposta.vendedorNome)}</div>
    <div class="field"><b>Aprovação:</b> ${esc(proposta.aprovacaoData)} ${esc(proposta.aprovacaoVendedor)}</div>
    <div></div>
  </div>
</div>

<div class="box">
  <div class="box-title">Dados do Cliente</div>
  <div class="grid2">
    <div class="field"><b>Nome:</b> ${esc(cliente.nome)}${cliente.codigo ? "-" + esc(cliente.codigo) : ""}</div>
    <div class="field"><b>Endereço:</b> ${esc(cliente.endereco)}</div>
    <div class="field"><b>Bairro:</b> ${esc(cliente.bairro)}</div>
    <div class="field"><b>CEP:</b> ${esc(cliente.cep)} <b style="margin-left:8px">Cidade:</b> ${esc(cliente.cidade)}-${esc(cliente.uf)}</div>
    <div class="field"><b>CPF/CGC:</b> ${esc(cliente.cpfCnpj)} <b style="margin-left:8px">RG/I.E:</b> ${esc(cliente.rgIe)}</div>
    <div class="field"><b>Fone(COM):</b>${esc(cliente.foneCom)} <b style="margin-left:8px">Fone(RES):</b>${esc(cliente.foneRes)}</div>
    <div class="field"><b>Fone(CEL):</b> ${esc(cliente.foneCel)} <b style="margin-left:8px">Fone(CON):</b>${esc(cliente.foneCon)}</div>
    <div class="field"><b>EMAIL:</b> ${esc(cliente.email)}</div>
  </div>
</div>

<div class="box">
  <div class="box-title">Dados do Veículo proposto para Venda</div>
  <div class="grid3">
    <div class="field"><b>Ficha:</b> ${esc(veiculo.ficha)}</div>
    <div class="field"><b>Veículo:</b> ${esc(veiculo.nome)}</div>
    <div class="field"><b>Marca:</b> ${esc(veiculo.marca)} <span style="margin-left:8px"><b>Tipo:</b> ${esc(veiculo.tipo)}</span></div>
    <div class="field"><b>Cor:</b> ${esc(veiculo.corCodigo)} ${esc(veiculo.cor)}</div>
    <div class="field"><b>Cor Interna:</b> ${esc(veiculo.corInterna)}</div>
    <div class="field"><b>Fab/Mod:</b> ${esc(veiculo.fabMod)} <span style="margin-left:8px"><b>${esc(veiculo.portas)} Portas</b></span></div>
    <div class="field"><b>Comb:</b> ${esc(veiculo.combustivel)}</div>
    <div class="field"><b>Chassi:</b> ${esc(veiculo.chassi)}</div>
    <div class="field"><b>Placa:</b> ${esc(veiculo.placa)} <span style="margin-left:8px"><b>C.Fab:</b> ${esc(veiculo.cFab)}</span></div>
  </div>
</div>

<div class="section-title">Condições de Pagamento</div>

${usados.length > 0 ? `<div class="subsection">(+) USADOS</div>${usadosRows}
<div style="text-align:right; font-weight:bold; padding: 4px 8px;">${brl(totaisCalculados.trocaUsados)}</div>` : ""}

${trocos.length > 0 ? `<div class="subsection">(−) TROCO / DEVOLUÇÕES AO CLIENTE</div>${trocosRows}` : ""}

<div class="bottom">
  <div>
    <div class="box-title">Observações</div>
    <div class="obs-box">${esc(observacoes).replace(/\n/g, "<br>")}</div>
  </div>
  <div>
    <div class="box-title">Resumo de Pagamento</div>
    <table class="resumo-tbl">
      <tr><td>Valor Venda Veículo:</td><td>${brl(totaisCalculados.valorVenda)}</td></tr>
      <tr><td>A Vista:</td><td>${brl(totaisCalculados.aVista)}</td></tr>
      <tr><td>Prazo / Parcelado:</td><td>${brl(totaisCalculados.prazoParcelado)}</td></tr>
      <tr><td>Leasing:</td><td>${brl(totaisCalculados.leasing)}</td></tr>
      <tr><td>Financiamento:</td><td>${brl(totaisCalculados.financiamento)}</td></tr>
      <tr><td>Consórcio:</td><td>${brl(totaisCalculados.consorcio)}</td></tr>
      <tr><td>Troca Usados:</td><td>${brl(totaisCalculados.trocaUsados)}</td></tr>
      <tr><td><b>Total Pago (+):</b></td><td><b>${brl(totaisCalculados.totalPago)}</b></td></tr>
      <tr><td>Troco/Devol (−):</td><td>${brl(totaisCalculados.trocoDevol)}</td></tr>
      <tr><td>Desconto (−):</td><td>${brl(totaisCalculados.desconto)}</td></tr>
      <tr class="total"><td>Valor Total NF (=):</td><td>${brl(totaisCalculados.valorTotalNF)}</td></tr>
    </table>
  </div>
</div>

<div class="signs">
  <div class="sign">
    <div class="sign-label">De Acordo</div>
    <div class="sign-line">${esc(cliente.nome).toUpperCase()}</div>
  </div>
  <div class="sign">
    <div class="sign-label">De Acordo</div>
    <div class="sign-line">${esc(empresa.nome)}</div>
  </div>
</div>

</body></html>`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}
