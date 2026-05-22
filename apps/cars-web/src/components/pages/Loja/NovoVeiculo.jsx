import React, { useState, useMemo, useEffect, useRef } from "react";
import { T } from "../../../lib/theme.js";
import { fmt, uid, todayISO } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import { getContaLojaNome } from "../../../lib/bancoLoja.js";

/**
 * Novo Veículo · estilo demo v3 com cascata Marca → Modelo → Cor.
 */
export default function NovoVeiculo({
  veiculos, setVeiculos,
  transacoes = [], setTransacoes,
  dividas = [], setDividas,
  cheques = [], setCheques,
  contas = [], setContas,
  pendingNovoVeiculo, clearPendingNovoVeiculo,
  setTab,
}) {
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [cor, setCor] = useState("Prata");
  const [corHex, setCorHex] = useState("#c0c0c0");
  const [corOpen, setCorOpen] = useState(false);

  const [ano, setAno] = useState(new Date().getFullYear() - 1);
  const [anoMod, setAnoMod] = useState(new Date().getFullYear());
  const [valorCompra, setValorCompra] = useState("");
  const [valorFipe, setValorFipe] = useState("");
  const [valorAnunciado, setValorAnunciado] = useState("");
  const [valorMinimo, setValorMinimo] = useState("");
  const [km, setKm] = useState(0);
  const [placa, setPlaca] = useState("");
  const [chassi, setChassi] = useState("");
  const [renavam, setRenavam] = useState("");
  const [combustivel, setCombustivel] = useState("flex");
  const [cambio, setCambio] = useState("automatico");
  const [observacoes, setObservacoes] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [dataCompra, setDataCompra] = useState(todayISO());
  const [formaCompra, setFormaCompra] = useState("vista");
  const [despesasEntrada, setDespesasEntrada] = useState([]);

  // Detalhes da forma de compra
  const [contaDebito, setContaDebito] = useState(getContaLojaNome(contas)); // default: Banco da Loja
  const [qtdParcelas, setQtdParcelas] = useState(12);            // financiado
  const [primeiraParcela, setPrimeiraParcela] = useState(todayISO());
  const [chequesList, setChequesList] = useState([]);            // [{ numero, valor, vencimento, banco }]
  const [modoCompraTroca, setModoCompraTroca] = useState(false);
  const [vendaOrigemId, setVendaOrigemId] = useState(null);

  // Pré-preencher quando vier de "Efetivar compra do veículo da troca"
  useEffect(() => {
    if (!pendingNovoVeiculo) return;
    const p = pendingNovoVeiculo;
    if (p.marca) setMarca(p.marca);
    if (p.modelo) setModelo(p.modelo);
    if (p.cor) setCor(p.cor);
    if (p.ano) { setAno(parseInt(p.ano) || ano); setAnoMod(parseInt(p.ano) || anoMod); }
    if (p.placa) setPlaca(p.placa);
    if (p.km) setKm(p.km);
    if (p.valorCompra) setValorCompra(String(p.valorCompra));
    if (p.fornecedor) setFornecedor(p.fornecedor);
    if (p.obs) setObservacoes(p.obs);
    if (p.formaCompra) setFormaCompra(p.formaCompra);
    if (p.modo === "compra-troca") {
      setModoCompraTroca(true);
      setVendaOrigemId(p.vendaOrigemId || null);
    }
    clearPendingNovoVeiculo?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingNovoVeiculo]);

  const dropRef = useRef(null);
  useEffect(() => {
    const h = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setCorOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  const modelosDisponiveis = useMemo(() => MODELOS[marca] || [], [marca]);

  const totalDespesasEntrada = useMemo(
    () => despesasEntrada.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0),
    [despesasEntrada]
  );

  const custoTotalEntrada = useMemo(
    () => (parseFloat(valorCompra) || 0) + totalDespesasEntrada,
    [valorCompra, totalDespesasEntrada]
  );

  const margem = useMemo(() => {
    const v = parseFloat(valorAnunciado) || 0;
    const c = custoTotalEntrada;
    if (c <= 0) return { val: 0, pct: 0 };
    return { val: v - c, pct: ((v - c) / c) * 100 };
  }, [valorAnunciado, custoTotalEntrada]);

  const addDespesaEntrada = () => setDespesasEntrada([
    ...despesasEntrada,
    { id: uid(), tipo: "Documentação", descricao: "", valor: "", data: todayISO() },
  ]);
  const removeDespesaEntrada = (id) => setDespesasEntrada(despesasEntrada.filter(d => d.id !== id));
  const updateDespesaEntrada = (id, patch) => setDespesasEntrada(despesasEntrada.map(d => d.id === id ? { ...d, ...patch } : d));

  const salvar = () => {
    if (!marca) return toast.error("Selecione a marca.");
    if (!modelo) return toast.error("Selecione o modelo.");
    if (!valorCompra) return toast.error("Informe o valor de compra.");
    if (!valorAnunciado) return toast.error("Informe o valor anunciado.");

    const veiculoId = uid();
    const valorCompraNum = parseFloat(valorCompra) || 0;

    const novo = {
      id: veiculoId, marca, modelo, cor, corHex,
      anoFabricacao: parseInt(ano), anoModelo: parseInt(anoMod),
      km: parseInt(km) || 0, placa,
      chassi: chassi.trim().toUpperCase() || null,
      renavam: renavam.trim() || null,
      combustivel, cambio,
      valorCompra: valorCompraNum,
      valorFipe: valorFipe ? parseFloat(valorFipe) : null,
      valorAnunciado: parseFloat(valorAnunciado),
      valorMinimo: valorMinimo ? parseFloat(valorMinimo) : null,
      categoria: classificarCategoria(modelo),
      status: "estoque",
      dataEntrada: todayISO(),
      fornecedor: fornecedor || null,
      dataCompra: dataCompra || todayISO(),
      formaCompra,
      origem: modoCompraTroca ? "troca" : undefined,
      vendaOrigemId: modoCompraTroca ? vendaOrigemId : undefined,
      despesasEntrada: despesasEntrada.filter(d => parseFloat(d.valor) > 0).map(d => ({
        ...d, valor: parseFloat(d.valor) || 0,
      })),
      observacoes,
    };
    setVeiculos([...veiculos, novo]);

    // ===== Automação: compromissos derivados da compra =====
    const descCompra = `Compra de veículo · ${marca} ${modelo}${placa ? ` (${placa})` : ""}`;
    const dataRef = dataCompra || todayISO();
    let extra = [];

    // Se for compra-troca, NÃO cria transação de despesa pelo valor de compra
    // (esse já entrou via venda original). Despesas de entrada SIM viram transação.
    if (formaCompra === "vista" && !modoCompraTroca) {
      // Cria transação despesa imediata
      if (setTransacoes) {
        const tx = {
          id: uid(),
          tipo: "despesa",
          descricao: descCompra,
          categoria: "Compra de Veículo",
          conta: contaDebito || getContaLojaNome(contas),
          data: dataRef,
          valor: valorCompraNum,
          compensado: true,
          fixa: false,
          obs: fornecedor ? `Fornecedor: ${fornecedor}` : "",
          origemLoja: { tipo: "compra-veiculo", veiculoId },
        };
        setTransacoes([tx, ...transacoes]);
      }
      // Debita a conta escolhida (se houver)
      if (contaDebito && setContas) {
        setContas(contas.map(c => c.nome === contaDebito
          ? { ...c, saldo: (parseFloat(c.saldo) || 0) - valorCompraNum }
          : c));
      }
      extra.push("transação despesa criada");
    }

    if (formaCompra === "financiado") {
      // Cria parcelas em dividas
      const qtd = Math.max(1, parseInt(qtdParcelas) || 1);
      const valorParcela = valorCompraNum / qtd;
      const baseDate = new Date(primeiraParcela || dataRef);
      if (setDividas) {
        const novas = [];
        for (let i = 0; i < qtd; i++) {
          const venc = new Date(baseDate);
          venc.setMonth(venc.getMonth() + i);
          const vencISO = venc.toISOString().slice(0, 10);
          novas.push({
            id: uid(),
            nome: `${marca} ${modelo} · parcela ${i + 1}/${qtd}`,
            valor: valorParcela,
            vencimento: vencISO,
            categoria: "Compra de Veículo",
            obs: fornecedor ? `Fornecedor: ${fornecedor}` : "",
            parcela: `${i + 1}/${qtd}`,
            pago: false,
            origemLoja: { tipo: "compra-veiculo-financiada", veiculoId },
          });
        }
        setDividas([...dividas, ...novas]);
      }
      extra.push(`${qtd} parcela${qtd > 1 ? "s" : ""} em dívidas`);
    }

    if (formaCompra === "cheque") {
      const validos = chequesList.filter(c => parseFloat(c.valor) > 0);
      if (setCheques && validos.length > 0) {
        const novos = validos.map(c => ({
          id: uid(),
          numero: c.numero || "",
          banco: c.banco || "",
          valor: parseFloat(c.valor) || 0,
          data: c.vencimento || dataRef,
          beneficiario: fornecedor || "Fornecedor",
          tipo: "emitido",
          status: "aguardando",
          obs: `Compra ${marca} ${modelo}${placa ? ` (${placa})` : ""}`,
          origemLoja: { tipo: "compra-veiculo-cheque", veiculoId },
        }));
        setCheques([...cheques, ...novos]);
        extra.push(`${validos.length} cheque${validos.length > 1 ? "s" : ""} emitido${validos.length > 1 ? "s" : ""}`);
      }
    }

    // Despesas de entrada → sempre viram transação de despesa na Banco da Loja
    // (independente do modo, inclusive em compra-troca)
    const despValidas = despesasEntrada.filter(d => parseFloat(d.valor) > 0);
    if (despValidas.length > 0 && setTransacoes) {
      const contaLoja = getContaLojaNome(contas);
      const txDesp = despValidas.map(d => ({
        id: uid(),
        tipo: "despesa",
        descricao: `${d.tipo || "Despesa"} · ${marca} ${modelo}${d.descricao ? ` · ${d.descricao}` : ""}`,
        categoria: "Compra de Veículo",
        conta: contaLoja,
        data: d.data || dataRef,
        valor: parseFloat(d.valor) || 0,
        compensado: true,
        fixa: false,
        obs: `Despesa de entrada do ${marca} ${modelo}`,
        origemLoja: { tipo: "despesa-entrada", veiculoId },
      }));
      setTransacoes([...txDesp, ...transacoes]);
      // Debita a Banco da Loja
      if (setContas && contaLoja) {
        const totalDesp = txDesp.reduce((s, t) => s + t.valor, 0);
        setContas(contas.map(c => c.nome === contaLoja
          ? { ...c, saldo: (parseFloat(c.saldo) || 0) - totalDesp }
          : c));
      }
      extra.push(`${despValidas.length} despesa${despValidas.length > 1 ? "s" : ""} de entrada`);
    }

    const detalhe = extra.length ? ` · ${extra.join(", ")}` : "";
    const sufixoTroca = modoCompraTroca ? " (efetivada via troca)" : "";
    toast.success(`${marca} ${modelo} adicionado ao estoque${sufixoTroca}. Custo total: ${fmt(custoTotalEntrada)}${detalhe}.`);
    if (setTab) setTab("loja-estoque");
  };

  /* helpers para cheques */
  const addCheque = () => setChequesList([
    ...chequesList,
    { id: uid(), numero: "", banco: "", valor: "", vencimento: todayISO() },
  ]);
  const updateCheque = (id, patch) => setChequesList(chequesList.map(c => c.id === id ? { ...c, ...patch } : c));
  const removeCheque = (id) => setChequesList(chequesList.filter(c => c.id !== id));

  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="eb">Loja AF4 · Cadastro</div>
      <h1 className="h1">Novo <em>Veículo.</em></h1>
      <p className="hs">Marca → Modelo → Cor. Cada select depende do anterior.</p>

      {modoCompraTroca && (
        <div style={{
          padding: "12px 14px", margin: "12px 0",
          background: `linear-gradient(135deg, ${T.gold}22, ${T.gold}11)`,
          border: `1px solid ${T.gold}66`, borderRadius: 8,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>🔁</span>
          <div style={{ fontSize: 12.5, color: T.muted }}>
            <strong style={{ color: T.gold }}>Modo: Efetivar compra de veículo de troca.</strong>{" "}
            Não cria transação de despesa pelo valor de compra (esse já entrou via venda original).
            Despesas de entrada SIM viram transação na Banco da Loja.
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18, marginTop: 18 }}
           className="novo-grid">
        {/* Coluna esquerda — form */}
        <div>
          <div className="fb">
            <h4>Identificação <span style={{ fontSize: 9, color: T.gold, marginLeft: 8 }}>Selects em cascata</span></h4>

            <div className="fr">
              <div className="ff">
                <label>1. Marca <span style={{ color: T.gold }}>★</span></label>
                <select value={marca} onChange={e => { setMarca(e.target.value); setModelo(""); }}>
                  <option value="">— Selecione uma marca —</option>
                  {Object.keys(MODELOS).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <div className={`hint ${marca ? "ac" : ""}`}>{Object.keys(MODELOS).length} marcas disponíveis</div>
              </div>
              <div className="ff">
                <label>2. Modelo <span style={{ color: T.gold }}>★</span></label>
                <select value={modelo} disabled={!marca} onChange={e => setModelo(e.target.value)}>
                  <option value="">{marca ? "— Selecione um modelo —" : "— Escolha a marca primeiro —"}</option>
                  {modelosDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <div className={`hint ${modelo ? "ok" : ""}`}>
                  {marca ? `${modelosDisponiveis.length} modelos da ${marca}` : "Depende da marca"}
                </div>
              </div>
            </div>

            <div className="fr">
              <div className="ff">
                <label>3. Cor <span style={{ color: T.gold }}>★</span></label>
                <div className={`color-select ${corOpen ? "open" : ""}`} ref={dropRef}>
                  <button type="button" className="csbtn" onClick={() => setCorOpen(!corOpen)}>
                    <span className="swatch-mini" style={{ background: corHex }} />
                    <span className="csname">{cor}</span>
                    <span className="csarrow">▼</span>
                  </button>
                  <div className="csdrop">
                    {CORES.map(c => (
                      <div key={c.nome}
                           className={`csopt ${cor === c.nome ? "sel" : ""}`}
                           onClick={() => { setCor(c.nome); setCorHex(c.hex); setCorOpen(false); }}>
                        <div className="sw-mini" style={{ background: c.hex }} />
                        {c.nome}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="hint">Visual com bolinha</div>
              </div>
              <div className="ff">
                <label>Ano fabricação</label>
                <input type="number" value={ano} onChange={e => setAno(e.target.value)} />
              </div>
              <div className="ff">
                <label>Ano modelo</label>
                <input type="number" value={anoMod} onChange={e => setAnoMod(e.target.value)} />
              </div>
            </div>

            <div className="fr">
              <div className="ff">
                <label>Placa</label>
                <input value={placa} onChange={e => setPlaca(e.target.value.toUpperCase())} placeholder="ABC-1D23" />
              </div>
              <div className="ff">
                <label>Chassi</label>
                <input value={chassi}
                       onChange={e => setChassi(e.target.value.toUpperCase().replace(/\s/g, ""))}
                       maxLength={17}
                       placeholder="9BWZZZ377VT004251" />
                <div className="hint">17 caracteres · alfanumérico</div>
              </div>
              <div className="ff">
                <label>Renavam</label>
                <input value={renavam}
                       onChange={e => setRenavam(e.target.value.replace(/\D/g, ""))}
                       maxLength={11}
                       inputMode="numeric"
                       placeholder="00123456789" />
                <div className="hint">11 dígitos · só números</div>
              </div>
            </div>

            <div className="fr">
              <div className="ff">
                <label>Quilometragem</label>
                <input type="number" value={km} onChange={e => setKm(e.target.value)} />
              </div>
              <div className="ff">
                <label>Combustível</label>
                <select value={combustivel} onChange={e => setCombustivel(e.target.value)}>
                  <option value="flex">Flex</option>
                  <option value="gasolina">Gasolina</option>
                  <option value="diesel">Diesel</option>
                  <option value="hibrido">Híbrido</option>
                  <option value="eletrico">Elétrico</option>
                </select>
              </div>
              <div className="ff">
                <label>Câmbio</label>
                <select value={cambio} onChange={e => setCambio(e.target.value)}>
                  <option value="manual">Manual</option>
                  <option value="automatico">Automático</option>
                  <option value="automatizado">Automatizado</option>
                  <option value="cvt">CVT</option>
                </select>
              </div>
            </div>
          </div>

          <div className="fb">
            <h4>Valores</h4>
            <div className="fr">
              <div className="ff">
                <label>Valor compra (R$) <span style={{ color: T.gold }}>★</span></label>
                <input type="number" step="0.01" value={valorCompra}
                       onChange={e => setValorCompra(e.target.value)} />
              </div>
              <div className="ff">
                <label>Valor FIPE (R$)</label>
                <input type="number" step="0.01" value={valorFipe}
                       onChange={e => setValorFipe(e.target.value)} />
                <div className="hint">Referência de mercado</div>
              </div>
              <div className="ff">
                <label>Valor anunciado (R$) <span style={{ color: T.gold }}>★</span></label>
                <input type="number" step="0.01" value={valorAnunciado}
                       onChange={e => setValorAnunciado(e.target.value)} />
              </div>
              <div className="ff">
                <label>Valor mínimo (R$)</label>
                <input type="number" step="0.01" value={valorMinimo}
                       onChange={e => setValorMinimo(e.target.value)} />
                <div className="hint">Piso de negociação</div>
              </div>
            </div>
          </div>

          <div className="fb">
            <h4>Dados da compra <span style={{ fontSize: 9, color: T.gold, marginLeft: 8 }}>De quem comprei</span></h4>
            <div className="fr">
              <div className="ff" style={{ gridColumn: "1 / span 2" }}>
                <label>Fornecedor / Vendedor</label>
                <input value={fornecedor} onChange={e => setFornecedor(e.target.value)}
                       placeholder="Ex: Auto Brasil · João Particular · Leilão Copart" />
              </div>
              <div className="ff">
                <label>Data da compra</label>
                <input type="date" value={dataCompra} onChange={e => setDataCompra(e.target.value)} />
              </div>
              <div className="ff">
                <label>Forma de compra</label>
                <select value={formaCompra} onChange={e => setFormaCompra(e.target.value)}>
                  <option value="vista">À vista</option>
                  <option value="cheque">Cheque(s)</option>
                  <option value="financiado">Financiado / Repasse</option>
                  <option value="consignacao">Consignação</option>
                  <option value="troca">Troca por outro veículo</option>
                </select>
              </div>
            </div>

            {/* Detalhes da forma de compra */}
            {formaCompra === "vista" && contas.length > 0 && (
              <div className="fr" style={{ marginTop: 10, padding: 12, background: `${T.gold}11`, borderRadius: 7, border: `1px dashed ${T.gold}55` }}>
                <div className="ff" style={{ gridColumn: "1 / span 2" }}>
                  <label>Debitar de qual conta?</label>
                  <select value={contaDebito} onChange={e => setContaDebito(e.target.value)}>
                    <option value="">— Não debitar (apenas registrar despesa) —</option>
                    {contas.map(c => (
                      <option key={c.id || c.nome} value={c.nome}>
                        {c.nome} · saldo {fmt(c.saldo || 0)}
                      </option>
                    ))}
                  </select>
                  <div className="hint">Ao salvar, cria <strong>transação despesa</strong> {contaDebito ? "e desconta da conta selecionada" : "(saldo das contas não é alterado se nenhuma for escolhida)"}.</div>
                </div>
              </div>
            )}

            {formaCompra === "financiado" && (
              <div className="fr" style={{ marginTop: 10, padding: 12, background: `${T.gold}11`, borderRadius: 7, border: `1px dashed ${T.gold}55` }}>
                <div className="ff">
                  <label>Qtd. de parcelas</label>
                  <input type="number" min={1} max={120} value={qtdParcelas}
                         onChange={e => setQtdParcelas(e.target.value)} />
                  <div className="hint">
                    Valor por parcela: <strong>{fmt((parseFloat(valorCompra) || 0) / (parseInt(qtdParcelas) || 1))}</strong>
                  </div>
                </div>
                <div className="ff">
                  <label>Primeiro vencimento</label>
                  <input type="date" value={primeiraParcela}
                         onChange={e => setPrimeiraParcela(e.target.value)} />
                  <div className="hint">As demais parcelas vencem mensalmente a partir desta.</div>
                </div>
                <div className="ff" style={{ gridColumn: "1 / -1" }}>
                  <div className="hint" style={{ color: T.muted, fontStyle: "italic" }}>
                    Ao salvar, as parcelas entram em <strong>A Receber & Dívidas → A Pagar</strong>.
                  </div>
                </div>
              </div>
            )}

            {formaCompra === "cheque" && (
              <div style={{ marginTop: 10, padding: 12, background: `${T.gold}11`, borderRadius: 7, border: `1px dashed ${T.gold}55` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <strong style={{ fontSize: 12, color: T.ink }}>
                    Cheques emitidos {chequesList.length > 0 && `(${chequesList.length})`}
                  </strong>
                  <button onClick={addCheque} className="btn-ghost" style={{ padding: "4px 10px", fontSize: 11 }}>
                    + Cheque
                  </button>
                </div>
                {chequesList.length === 0 ? (
                  <div style={{ padding: 10, color: T.faint, fontSize: 11, fontStyle: "italic", textAlign: "center" }}>
                    Nenhum cheque ainda. Clique em "+ Cheque" para adicionar.
                  </div>
                ) : chequesList.map(c => (
                  <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr 1.1fr auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
                    <input value={c.numero} onChange={e => updateCheque(c.id, { numero: e.target.value })}
                           placeholder="Nº" />
                    <input value={c.banco} onChange={e => updateCheque(c.id, { banco: e.target.value })}
                           placeholder="Banco" />
                    <input type="number" step="0.01" value={c.valor}
                           onChange={e => updateCheque(c.id, { valor: e.target.value })}
                           placeholder="Valor" />
                    <input type="date" value={c.vencimento}
                           onChange={e => updateCheque(c.id, { vencimento: e.target.value })} />
                    <button onClick={() => removeCheque(c.id)}
                            aria-label="Remover cheque"
                            style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer", padding: 4 }}>✕</button>
                  </div>
                ))}
                <div className="hint" style={{ marginTop: 6, color: T.muted, fontStyle: "italic" }}>
                  Ao salvar, os cheques entram em <strong>Loja AF4 → Cheques</strong> com status pendente.
                </div>
              </div>
            )}
          </div>

          <div className="fb">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h4 style={{ marginBottom: 0 }}>Despesas de entrada <span style={{ fontSize: 9, color: T.gold, marginLeft: 8 }}>Total: {fmt(totalDespesasEntrada)}</span></h4>
              <button onClick={addDespesaEntrada} className="btn-ghost" style={{ padding: "6px 12px", fontSize: 11 }}>
                + Despesa
              </button>
            </div>
            <p style={{ fontSize: 11, color: T.muted, marginTop: -4, marginBottom: 10, fontStyle: "italic" }}>
              Documentação, vistoria, reparo, polimento, transferência. Tudo isso entra no custo total do veículo e impacta a margem real.
            </p>

            {despesasEntrada.length === 0 ? (
              <div style={{ padding: 14, color: T.faint, fontSize: 11.5, fontStyle: "italic", textAlign: "center", border: `1px dashed ${T.border}`, borderRadius: 7 }}>
                Nenhuma despesa cadastrada. Clique em "+ Despesa" pra lançar.
              </div>
            ) : despesasEntrada.map(d => (
              <div key={d.id} style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr 1fr 1fr auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
                <select value={d.tipo} onChange={e => updateDespesaEntrada(d.id, { tipo: e.target.value })}>
                  <option>Documentação</option>
                  <option>Vistoria</option>
                  <option>Polimento / Limpeza</option>
                  <option>Reparo / Mecânica</option>
                  <option>Funilaria / Pintura</option>
                  <option>Fotografia</option>
                  <option>Transferência</option>
                  <option>Combustível</option>
                  <option>Despachante</option>
                  <option>Frete / Transporte</option>
                  <option>Outros</option>
                </select>
                <input value={d.descricao} onChange={e => updateDespesaEntrada(d.id, { descricao: e.target.value })}
                       placeholder="Descrição (opcional)" />
                <input type="number" step="0.01" value={d.valor}
                       onChange={e => updateDespesaEntrada(d.id, { valor: e.target.value })}
                       placeholder="Valor (R$)" />
                <input type="date" value={d.data} onChange={e => updateDespesaEntrada(d.id, { data: e.target.value })} />
                <button onClick={() => removeDespesaEntrada(d.id)}
                        aria-label="Remover"
                        style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer", padding: 4 }}>✕</button>
              </div>
            ))}

            {totalDespesasEntrada > 0 && (
              <div style={{ marginTop: 12, padding: 10, background: T.bgSoft, borderRadius: 7, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: T.muted }}>
                  <span>Valor de compra:</span><span className="num">{fmt(parseFloat(valorCompra) || 0)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: T.muted }}>
                  <span>+ Despesas de entrada:</span><span className="num">{fmt(totalDespesasEntrada)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: T.ink, borderTop: `1px solid ${T.border}`, paddingTop: 5, marginTop: 5 }}>
                  <span>= Custo total:</span><span className="num" style={{ color: T.gold }}>{fmt(custoTotalEntrada)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="fb">
            <h4>Observações</h4>
            <div className="ff">
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)}
                        rows={3} placeholder="Histórico, opcionais, problemas conhecidos…"
                        style={{ width: "100%", resize: "vertical" }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button className="btn-gold" onClick={salvar}>Salvar veículo</button>
            <button className="btn-ghost" onClick={() => setTab && setTab("loja-estoque")}>Cancelar</button>
          </div>
        </div>

        {/* Coluna direita — preview */}
        <div>
          <div style={{
            background: `linear-gradient(180deg, ${T.card}, ${T.cardHi})`,
            border: `1px solid ${T.border}`, borderRadius: 12, padding: 18,
            position: "sticky", top: 170,
          }}>
            <div className="label-eyebrow" style={{ marginBottom: 12 }}>Preview</div>
            <div style={{
              height: 120, borderRadius: 10,
              background: `linear-gradient(135deg, ${T.bgSoft}, ${T.cardHi})`,
              display: "grid", placeItems: "center",
              fontSize: 48, color: T.faint, marginBottom: 14,
              position: "relative",
            }}>
              🚗
              <span style={{
                position: "absolute", bottom: 8, right: 8,
                width: 28, height: 28, borderRadius: "50%",
                background: corHex, border: `2px solid ${T.borderHi}`,
                boxShadow: "0 2px 8px rgba(0,0,0,.4)",
              }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: T.ink }}>
              {marca && modelo ? `${marca} ${modelo}` : marca ? `${marca} (escolha o modelo)` : "Selecione marca/modelo"}
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
              {ano}/{anoMod} · {cor}
            </div>
            {valorAnunciado && (
              <>
                <div className="num" style={{ fontSize: 22, fontWeight: 300, marginTop: 14, color: T.ink }}>
                  {fmt(parseFloat(valorAnunciado))}
                </div>
                <div className="num" style={{ fontSize: 11, color: margem.val >= 0 ? T.green : T.red, marginTop: 4 }}>
                  Margem: {fmt(margem.val)} ({margem.pct.toFixed(1)}%)
                </div>
              </>
            )}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}`, fontSize: 10.5, color: T.muted, lineHeight: 1.6 }}>
              {valorCompra && <>Custo: {fmt(parseFloat(valorCompra))}<br /></>}
              {valorMinimo && <>Mínimo: {fmt(parseFloat(valorMinimo))}<br /></>}
              {valorFipe && <>FIPE: {fmt(parseFloat(valorFipe))}</>}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .novo-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ============ DADOS CASCATA ============ */
const MODELOS = {
  "Volkswagen": ["Polo", "Virtus", "T-Cross", "Nivus", "Jetta", "Tiguan", "Amarok", "Saveiro", "Gol", "Voyage"],
  "Fiat":       ["Argo", "Mobi", "Cronos", "Pulse", "Fastback", "Toro", "Strada", "Uno"],
  "Chevrolet":  ["Onix", "Tracker", "Spin", "Cruze", "S10", "Equinox", "Montana"],
  "Hyundai":    ["HB20", "Creta", "Tucson", "Santa Fe", "i30"],
  "Toyota":     ["Corolla", "Yaris", "Hilux", "SW4", "Corolla Cross", "RAV4", "Etios"],
  "Honda":      ["Civic", "Fit", "HR-V", "WR-V", "City"],
  "Jeep":       ["Renegade", "Compass", "Commander", "Wrangler", "Gladiator"],
  "Renault":    ["Kwid", "Sandero", "Logan", "Duster", "Captur", "Oroch"],
  "Ford":       ["Ka", "EcoSport", "Ranger", "Bronco", "Maverick", "Territory"],
  "Nissan":     ["Versa", "Kicks", "Sentra", "Frontier"],
  "Mitsubishi": ["L200", "Pajero", "Eclipse Cross", "ASX"],
  "Peugeot":    ["208", "2008", "3008", "Partner"],
  "Citroën":    ["C3", "C4 Cactus", "Aircross"],
  "Kia":        ["Picanto", "Stonic", "Sportage", "Sorento"],
  "BMW":        ["320i", "X1", "X3", "X5", "M3"],
  "Mercedes":   ["C200", "GLA", "GLC", "Classe A"],
  "Audi":       ["A3", "Q3", "Q5", "A4"],
};

const CORES = [
  { nome: "Prata",      hex: "#c0c0c0" },
  { nome: "Branco",     hex: "#ffffff" },
  { nome: "Preto",      hex: "#0a0a0a" },
  { nome: "Cinza",      hex: "#6b7280" },
  { nome: "Vermelho",   hex: "#dc2626" },
  { nome: "Azul",       hex: "#2563eb" },
  { nome: "Azul escuro", hex: "#1e3a8a" },
  { nome: "Verde",      hex: "#16a34a" },
  { nome: "Amarelo",    hex: "#eab308" },
  { nome: "Marrom",     hex: "#78350f" },
  { nome: "Bege",       hex: "#d4c5a0" },
  { nome: "Champagne",  hex: "#e8d5a8" },
];

// Heurística simples pra categorizar modelos
const classificarCategoria = (modelo) => {
  const m = (modelo || "").toLowerCase();
  if (/(suv|tracker|creta|renegade|compass|kicks|tiguan|tucson|t-cross|hrv|hr-v|wr-v|corolla cross|nivus|pulse|fastback|2008|3008|c4 cactus|aircross|stonic|sportage|sorento|gla|q3|q5|x1|x3|x5|asx|eclipse cross)/.test(m)) return "suv";
  if (/(picape|hilux|s10|amarok|ranger|maverick|frontier|l200|toro|strada|saveiro|montana|gladiator|oroch)/.test(m)) return "picape";
  if (/(sedan|virtus|cronos|cruze|civic|corolla|jetta|sentra|versa|onix sedan|hb20s|320i|c200|a3|a4)/.test(m)) return "sedan";
  if (/(bmw|mercedes|audi|porsche|tesla)/.test(m)) return "premium";
  return "hatch";
};
