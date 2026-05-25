/**
 * Proventos · calendário + baixa + Carteira virtual de Proventos.
 *
 * - Calendário: dividendos/JCP/rendimentos projetados pros próximos 3 meses
 * - Cada pagamento tem botão "Baixar" → modal pra:
 *     (a) Deixar em "Carteira de Proventos" (virtual, separada das contas)
 *     (b) Reinvestir agora em um ativo (atualiza qtd + PM + cria histórico)
 * - Carteira de Proventos: saldo + histórico de movimentações
 *     - Transferir pra conta real (cria receita)
 *     - Comprar ativo (saída pra reinvestimento avulso)
 */
import React, { useMemo, useState } from "react";
import {
  Check, TrendingUp, ArrowDownToLine, Wallet, ChevronDown, ChevronRight,
  ArrowUpRight, ShoppingCart, X, AlertCircle, Sparkles,
} from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, uid } from "../../../lib/format.js";
import { calendarioProventos } from "../../../lib/invest-metrics.js";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import PageHeader from "../../ui/PageHeader.jsx";
import Field from "../../ui/Field.jsx";
import Modal from "../../ui/Modal.jsx";

const nomeMes = (k) => {
  const [y, m] = k.split("-");
  const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${meses[parseInt(m) - 1]} ${y}`;
};

export default function Proventos({
  ativos = [], setAtivos,
  hidden,
  carteiraProventos = { saldo: 0, historico: [] },
  setCarteiraProventos,
  proventosRecebidos = {},
  setProventosRecebidos,
  contas = [], setContas,
  categorias = [],
  transacoes = [], setTransacoes,
}) {
  const proventos = useMemo(() => calendarioProventos(ativos), [ativos]);

  const [baixaForm, setBaixaForm] = useState(null);
  const [transferirForm, setTransferirForm] = useState(null);
  const [comprarForm, setComprarForm] = useState(null);
  const [historicoAberto, setHistoricoAberto] = useState(false);

  // Agrupar por mês
  const porMes = useMemo(() => {
    const map = {};
    proventos.forEach(p => {
      const k = p.data.slice(0, 7);
      (map[k] ||= []).push(p);
    });
    return Object.entries(map).sort();
  }, [proventos]);

  const hoje = new Date();
  const mesAtual = hoje.toISOString().slice(0, 7);

  // KPIs (considera só pendentes — não baixados ainda)
  const pendentes = proventos.filter(p => !proventosRecebidos[p.id]);
  const totalPendente = pendentes.reduce((s, p) => s + p.total, 0);
  const totalMes = (porMes.find(([k]) => k === mesAtual)?.[1] || [])
    .filter(p => !proventosRecebidos[p.id])
    .reduce((s, p) => s + p.total, 0);

  // Total recebido (histórico)
  const totalRecebido = (carteiraProventos.historico || [])
    .filter(h => h.tipo === "recebimento")
    .reduce((s, h) => s + (h.valor || 0), 0);

  /* ===== Ação: BAIXAR provento (modal abre) ===== */
  const abrirBaixa = (provento) => {
    setBaixaForm({
      provento,
      destino: "carteira",
      ativoDestinoId: ativos[0]?.id || "",
      dataBaixa: hoje.toISOString().slice(0, 10),
      // Valor recebido pode ser ajustado pelo usuário (IR retido, valor
      // que veio diferente do projetado, etc). Default = total calculado.
      valorAjustado: String(provento.total ?? 0),
    });
  };

  const confirmarBaixa = () => {
    const { provento, destino, ativoDestinoId, dataBaixa, valorAjustado } = baixaForm;
    const valor = Number(valorAjustado);
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    const proventoKey = provento.id;

    // Adiciona entrada de RECEBIMENTO no histórico da carteira virtual
    const hist = carteiraProventos.historico || [];
    const novoRecebimento = {
      id: uid(),
      data: dataBaixa,
      tipo: "recebimento",
      valor,
      descricao: `${provento.ticker} · ${provento.tipo} de ${provento.data.slice(8, 10)}/${provento.data.slice(5, 7)}`,
      proventoKey,
      ticker: provento.ticker,
    };
    let novoSaldo = carteiraProventos.saldo + valor;
    let novoHistorico = [...hist, novoRecebimento];

    // Se REINVESTIR: cria entrada de saída + atualiza ativo
    if (destino === "reinvestir") {
      const ativoDestino = ativos.find(a => a.id === ativoDestinoId);
      if (!ativoDestino) { toast.error("Selecione um ativo pra reinvestir."); return; }
      const precoAtual = Number(ativoDestino.preco || 0);
      if (precoAtual <= 0) { toast.error("Ativo destino sem preço atual."); return; }
      const qtdCompravel = valor / precoAtual;

      // Saída do saldo da carteira
      novoHistorico.push({
        id: uid(),
        data: dataBaixa,
        tipo: "reinvestimento",
        valor: -valor,
        descricao: `Reinvestido em ${ativoDestino.ticker} · ${qtdCompravel.toFixed(6)} cotas × ${fmt(precoAtual)}`,
        proventoKey,
        ticker: ativoDestino.ticker,
      });
      novoSaldo -= valor;

      // Atualiza ativo: novo PM ponderado + nova qtd
      const qtdAtual = Number(ativoDestino.qtd || 0);
      const pmAtual = Number(ativoDestino.pm || 0);
      const novaQtd = qtdAtual + qtdCompravel;
      const novoPM = novaQtd > 0
        ? (qtdAtual * pmAtual + qtdCompravel * precoAtual) / novaQtd
        : precoAtual;
      setAtivos(ativos.map(a => a.id === ativoDestinoId
        ? { ...a, qtd: novaQtd, pm: novoPM }
        : a));
    }

    setCarteiraProventos({ saldo: novoSaldo, historico: novoHistorico });
    setProventosRecebidos({
      ...proventosRecebidos,
      [proventoKey]: { dataBaixa, valor, destino, ativoDestinoId: destino === "reinvestir" ? ativoDestinoId : null },
    });
    setBaixaForm(null);
    toast.success(
      destino === "reinvestir"
        ? `${fmt(valor)} reinvestido em ${ativos.find(a => a.id === ativoDestinoId)?.ticker}.`
        : `${fmt(valor)} recebido na Carteira de Proventos.`
    );
  };

  /* ===== Ação: ESTORNAR baixa (excluir provento já recebido) ===== */
  // Reverte a marcação de "Recebido", remove as entradas associadas do
  // histórico da carteira virtual e ajusta o saldo. Se a baixa foi
  // reinvestida em um ativo, a COMPRA não é desfeita aqui — o user
  // ajusta manualmente em Investimentos se quiser.
  const estornarBaixa = async (provento) => {
    const baixaInfo = proventosRecebidos[provento.id];
    if (!baixaInfo) return;
    const foiReinvestido = baixaInfo.destino === "reinvestir";
    const ok = await confirm({
      title: `Estornar baixa de ${provento.ticker}?`,
      body: foiReinvestido
        ? `A baixa de ${fmt(baixaInfo.valor || provento.total)} (${provento.tipo}) será revertida. ATENÇÃO: como foi reinvestida, a compra do ativo NÃO é desfeita automaticamente — ajuste manualmente em Investimentos se quiser desfazer.`
        : `A baixa de ${fmt(baixaInfo.valor || provento.total)} (${provento.tipo}) será revertida e o saldo voltará pra Carteira de Proventos.`,
      confirmLabel: "Estornar",
      danger: true,
    });
    if (!ok) return;

    const hist = carteiraProventos.historico || [];
    const associadas = hist.filter(h => h.proventoKey === provento.id);
    const valorLiquido = associadas.reduce((s, h) => s + Number(h.valor || 0), 0);
    setCarteiraProventos({
      saldo: (carteiraProventos.saldo || 0) - valorLiquido,
      historico: hist.filter(h => h.proventoKey !== provento.id),
    });

    const next = { ...proventosRecebidos };
    delete next[provento.id];
    setProventosRecebidos(next);

    toast.success(`Baixa de ${provento.ticker} estornada.`);
  };

  /* ===== Ação: TRANSFERIR da carteira pra conta real ===== */
  const confirmarTransferencia = () => {
    const { valor, contaDestino } = transferirForm;
    const valN = Number(valor) || 0;
    if (valN <= 0) { toast.error("Valor inválido."); return; }
    if (valN > carteiraProventos.saldo) { toast.error("Saldo insuficiente na Carteira de Proventos."); return; }
    if (!contaDestino) { toast.error("Selecione a conta destino."); return; }
    const conta = contas.find(c => c.nome === contaDestino);
    if (!conta) return;

    // Saída da carteira virtual
    const novoHistorico = [...(carteiraProventos.historico || []), {
      id: uid(),
      data: hoje.toISOString().slice(0, 10),
      tipo: "transferencia_saida",
      valor: -valN,
      descricao: `Transferido pra ${contaDestino}`,
    }];
    setCarteiraProventos({ saldo: carteiraProventos.saldo - valN, historico: novoHistorico });

    // Cria transação de receita na conta
    const catInv = categorias.find(c => c.tipo === "receita" && /provent|dividend|renda/i.test(c.nome))?.nome
                || categorias.find(c => c.tipo === "receita")?.nome || "Outros";
    setTransacoes([{
      id: uid(),
      tipo: "receita",
      descricao: "Transferência da Carteira de Proventos",
      categoria: catInv,
      conta: contaDestino,
      data: hoje.toISOString().slice(0, 10),
      valor: valN,
      compensado: true,
      fixa: false,
      obs: "Saque de proventos acumulados",
    }, ...transacoes]);

    // Atualiza saldo da conta
    setContas(contas.map(c => c.id === conta.id ? { ...c, saldo: (parseFloat(c.saldo) || 0) + valN } : c));

    setTransferirForm(null);
    toast.success(`${fmt(valN)} transferido pra ${contaDestino}.`);
  };

  /* ===== Ação: COMPRAR ativo usando saldo da carteira ===== */
  const confirmarCompra = () => {
    const { valor, ativoId } = comprarForm;
    const valN = Number(valor) || 0;
    if (valN <= 0) { toast.error("Valor inválido."); return; }
    if (valN > carteiraProventos.saldo) { toast.error("Saldo insuficiente na Carteira de Proventos."); return; }
    const ativo = ativos.find(a => a.id === ativoId);
    if (!ativo) { toast.error("Selecione um ativo."); return; }
    const preco = Number(ativo.preco || 0);
    if (preco <= 0) { toast.error("Ativo sem preço atual."); return; }

    const qtdCompravel = valN / preco;
    const qtdAtual = Number(ativo.qtd || 0);
    const pmAtual = Number(ativo.pm || 0);
    const novaQtd = qtdAtual + qtdCompravel;
    const novoPM = novaQtd > 0 ? (qtdAtual * pmAtual + qtdCompravel * preco) / novaQtd : preco;

    setAtivos(ativos.map(a => a.id === ativoId ? { ...a, qtd: novaQtd, pm: novoPM } : a));

    const novoHistorico = [...(carteiraProventos.historico || []), {
      id: uid(),
      data: hoje.toISOString().slice(0, 10),
      tipo: "reinvestimento",
      valor: -valN,
      descricao: `Compra avulsa: ${ativo.ticker} · ${qtdCompravel.toFixed(6)} cotas × ${fmt(preco)}`,
      ticker: ativo.ticker,
    }];
    setCarteiraProventos({ saldo: carteiraProventos.saldo - valN, historico: novoHistorico });
    setComprarForm(null);
    toast.success(`Comprado ${qtdCompravel.toFixed(6)} ${ativo.ticker}.`);
  };

  /* ===== Render ===== */
  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Investimentos · Proventos"
        title="Calendário & Carteira"
        sub="Dividendos, JCP e rendimentos previstos + carteira virtual pra acumular ou reinvestir."
      />

      {/* CARD CARTEIRA DE PROVENTOS */}
      <div style={{
        background: `linear-gradient(135deg, ${T.gold}11, ${T.card})`,
        border: `1px solid ${T.gold}55`,
        borderLeft: `3px solid ${T.gold}`,
        borderRadius: 12, padding: 16, marginBottom: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="label-eyebrow" style={{ color: T.gold }}>
              <Wallet size={11} className="inline mr-1" />
              Carteira de Proventos
            </div>
            <div className="num" style={{
              fontFamily: T.serif, fontSize: 32, color: T.ink, fontWeight: 600,
              marginTop: 4, letterSpacing: "-0.02em",
            }}>
              {hidden ? "•••" : fmt(carteiraProventos.saldo)}
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
              Total já recebido: <strong style={{ color: T.green }} className="num">
                {hidden ? "•••" : fmt(totalRecebido)}
              </strong>
              {" · "}{(carteiraProventos.historico || []).filter(h => h.tipo === "recebimento").length} entradas
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="btn-ghost"
                    disabled={carteiraProventos.saldo <= 0}
                    onClick={() => setTransferirForm({
                      valor: carteiraProventos.saldo.toFixed(2),
                      contaDestino: contas[0]?.nome || "",
                    })}
                    style={{ opacity: carteiraProventos.saldo <= 0 ? 0.4 : 1 }}>
              <ArrowUpRight size={13} className="inline mr-1.5" />
              Transferir pra conta
            </button>
            <button className="btn-gold"
                    disabled={carteiraProventos.saldo <= 0}
                    onClick={() => setComprarForm({
                      valor: carteiraProventos.saldo.toFixed(2),
                      ativoId: ativos[0]?.id || "",
                    })}
                    style={{ opacity: carteiraProventos.saldo <= 0 ? 0.4 : 1 }}>
              <ShoppingCart size={13} className="inline mr-1.5" />
              Reinvestir
            </button>
          </div>
        </div>

        {/* Histórico colapsível */}
        {(carteiraProventos.historico || []).length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${T.border}` }}>
            <button onClick={() => setHistoricoAberto(!historicoAberto)}
                    style={{
                      background: "transparent", border: "none", color: T.muted,
                      cursor: "pointer", padding: 0, fontSize: 11, fontWeight: 600,
                      letterSpacing: ".05em", textTransform: "uppercase",
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
              {historicoAberto ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              Histórico · {(carteiraProventos.historico || []).length} movimentação(ões)
            </button>
            {historicoAberto && (
              <div style={{ marginTop: 8, maxHeight: 280, overflowY: "auto" }}>
                {(carteiraProventos.historico || []).slice().reverse().map(h => {
                  const positivo = h.valor > 0;
                  return (
                    <div key={h.id} style={{
                      display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10,
                      alignItems: "center",
                      padding: "8px 10px", marginBottom: 4,
                      background: T.bgSoft, borderRadius: 6,
                      borderLeft: `2px solid ${positivo ? T.green : T.red}`,
                    }}>
                      <div style={{ fontSize: 10.5, color: T.muted, fontFamily: T.mono, minWidth: 56 }}>
                        {h.data.slice(8, 10)}/{h.data.slice(5, 7)}
                      </div>
                      <div style={{ fontSize: 12, color: T.ink, minWidth: 0 }}>
                        {h.descricao}
                      </div>
                      <div className="num" style={{
                        fontSize: 13, fontWeight: 600,
                        color: positivo ? T.green : T.red, whiteSpace: "nowrap",
                      }}>
                        {positivo ? "+ " : "− "}{hidden ? "•••" : fmt(Math.abs(h.valor))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ marginBottom: 14 }}>
        <Kpi
          label="Pendentes este mês"
          valor={hidden ? "•••" : fmt(totalMes)}
          sub={`${(porMes.find(([k]) => k === mesAtual)?.[1] || []).filter(p => !proventosRecebidos[p.id]).length} pagamento(s)`}
          cor={T.gold}
        />
        <Kpi
          label="Total pendente (3 meses)"
          valor={hidden ? "•••" : fmt(totalPendente)}
          sub={`${pendentes.length} pagamento(s)`}
          cor={T.blue || "#5b9bd5"}
        />
        <Kpi
          label="Já recebido"
          valor={hidden ? "•••" : fmt(totalRecebido)}
          sub={`${(carteiraProventos.historico || []).filter(h => h.tipo === "recebimento").length} baixas`}
          cor={T.green}
        />
      </div>

      {/* CALENDÁRIO */}
      {porMes.length === 0 ? (
        <div style={{
          padding: 40, textAlign: "center",
          background: T.card, border: `1px dashed ${T.border}`, borderRadius: 10,
          color: T.muted, fontSize: 13,
        }}>
          Adicione ações e FIIs para ver o calendário de proventos.
        </div>
      ) : porMes.map(([mes, lista]) => (
        <div key={mes} style={{ marginBottom: 18 }}>
          <div className="label-eyebrow" style={{ marginBottom: 8 }}>
            {nomeMes(mes)} · {lista.length} pagamento(s)
          </div>
          <div style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 10, overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Ticker</Th>
                  <Th>Tipo</Th>
                  <Th align="right">Por cota</Th>
                  <Th align="right">Qtd</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">Ação</Th>
                </tr>
              </thead>
              <tbody>
                {lista.map(p => {
                  const recebido = !!proventosRecebidos[p.id];
                  return (
                    <tr key={p.id} style={{
                      borderTop: `1px solid ${T.border}`,
                      opacity: recebido ? 0.55 : 1,
                    }}>
                      <Td>{p.data.slice(8, 10)}/{p.data.slice(5, 7)}</Td>
                      <Td><strong>{p.ticker}</strong></Td>
                      <Td>
                        <span style={{
                          fontSize: 10, padding: "2px 7px", borderRadius: 4,
                          background: p.tipo === "Rendimento" ? `${T.green}22`
                                    : p.tipo === "Dividendo" ? `${T.gold}22`
                                    : `${T.blue || "#5b9bd5"}22`,
                          color: p.tipo === "Rendimento" ? T.green
                                : p.tipo === "Dividendo" ? T.gold
                                : (T.blue || "#5b9bd5"),
                          fontWeight: 700, letterSpacing: ".03em",
                        }}>
                          {p.tipo}
                        </span>
                      </Td>
                      <Td align="right" mono>{fmt(p.valorPorCota)}</Td>
                      <Td align="right" mono>{p.qtd}</Td>
                      <Td align="right" mono style={{ color: T.green, fontWeight: 600 }}>
                        {hidden ? "•••" : fmt(p.total)}
                      </Td>
                      <Td align="right">
                        {recebido ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              fontSize: 10, color: T.green, fontWeight: 700,
                              padding: "3px 7px", background: `${T.green}22`, borderRadius: 4,
                            }}>
                              <Check size={11} /> Recebido
                            </span>
                            <button onClick={() => estornarBaixa(p)}
                                    title="Estornar baixa"
                                    aria-label={`Estornar baixa de ${p.ticker}`}
                                    style={{
                                      background: "transparent", border: `1px solid ${T.border}`,
                                      color: T.red, padding: "2px 5px", borderRadius: 4,
                                      cursor: "pointer", display: "inline-flex", alignItems: "center",
                                    }}>
                              <X size={11} />
                            </button>
                          </span>
                        ) : (
                          <button onClick={() => abrirBaixa(p)}
                                  style={{
                                    background: T.gold, color: T.bg,
                                    border: "none", padding: "5px 11px", borderRadius: 5,
                                    fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                                    letterSpacing: ".05em", textTransform: "uppercase",
                                    display: "inline-flex", alignItems: "center", gap: 4,
                                  }}>
                            <ArrowDownToLine size={11} /> Baixar
                          </button>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* MODAL: BAIXAR PROVENTO */}
      {baixaForm && (() => {
        const p = baixaForm.provento;
        const ativoDestino = ativos.find(a => a.id === baixaForm.ativoDestinoId);
        const precoAtivo = Number(ativoDestino?.preco || 0);
        const valorAtual = Number(baixaForm.valorAjustado) || 0;
        const qtdCompravel = baixaForm.destino === "reinvestir" && precoAtivo > 0
          ? valorAtual / precoAtivo : 0;
        const valorMudou = Math.abs(valorAtual - (p.total || 0)) > 0.001;
        return (
          <Modal title={`Baixar ${p.ticker} (${p.tipo})`} onClose={() => setBaixaForm(null)}>
            <div style={{
              padding: 12, background: T.bgSoft, borderRadius: 7,
              fontSize: 12, marginBottom: 14,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: T.muted, marginBottom: 4 }}>
                <span>Data prevista:</span>
                <span style={{ color: T.ink }}>{p.data.slice(8, 10)}/{p.data.slice(5, 7)}/{p.data.slice(0, 4)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: T.muted }}>
                <span>{p.qtd} cotas × {fmt(p.valorPorCota)} =</span>
                <span style={{ color: T.muted, fontWeight: 600 }} className="num">{fmt(p.total)}</span>
              </div>
            </div>

            <Field label="Valor efetivamente recebido (R$)" required>
              <input type="number" step="0.01" min="0"
                     value={baixaForm.valorAjustado}
                     onChange={e => setBaixaForm({ ...baixaForm, valorAjustado: e.target.value })}
                     placeholder="0,00" />
            </Field>
            {valorMudou && (
              <div style={{
                marginTop: -8, marginBottom: 12,
                fontSize: 11, color: T.muted, fontStyle: "italic",
              }}>
                Ajustado em relação ao previsto ({fmt(p.total)}). Útil pra IR retido ou diferenças.
              </div>
            )}

            <div className="label-eyebrow" style={{ marginBottom: 8 }}>O que fazer com o valor?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {[
                { id: "carteira",   label: "Deixar na Carteira de Proventos",  desc: "Acumula pra usar depois." },
                { id: "reinvestir", label: "Reinvestir agora em um ativo",      desc: "Compra mais cotas direto." },
              ].map(opt => {
                const ativo = baixaForm.destino === opt.id;
                return (
                  <button key={opt.id} onClick={() => setBaixaForm({ ...baixaForm, destino: opt.id })}
                          style={{
                            padding: "10px 12px",
                            background: ativo ? `${T.gold}22` : T.bgSoft,
                            border: `1px solid ${ativo ? T.gold : T.border}`,
                            borderRadius: 7, cursor: "pointer", textAlign: "left",
                            display: "flex", alignItems: "flex-start", gap: 10,
                          }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%",
                      border: `2px solid ${ativo ? T.gold : T.border}`,
                      background: ativo ? T.gold : "transparent",
                      flexShrink: 0, marginTop: 2,
                    }} />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: ativo ? T.gold : T.ink }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {baixaForm.destino === "reinvestir" && (
              <>
                <Field label="Ativo destino" required>
                  <select value={baixaForm.ativoDestinoId}
                          onChange={e => setBaixaForm({ ...baixaForm, ativoDestinoId: e.target.value })}>
                    <option value="">Selecione…</option>
                    {ativos.filter(a => Number(a.preco || 0) > 0).map(a => (
                      <option key={a.id} value={a.id}>
                        {a.ticker} · preço {fmt(a.preco)}
                      </option>
                    ))}
                  </select>
                </Field>
                {ativoDestino && precoAtivo > 0 && (
                  <div style={{
                    padding: 10, background: `${T.green}11`,
                    border: `1px solid ${T.green}33`, borderRadius: 6,
                    fontSize: 11.5, color: T.muted, marginBottom: 10,
                  }}>
                    Vai comprar <strong className="num" style={{ color: T.green }}>
                      {qtdCompravel.toFixed(6)} {ativoDestino.ticker}
                    </strong> a <strong className="num" style={{ color: T.ink }}>{fmt(precoAtivo)}</strong>/cota.
                  </div>
                )}
              </>
            )}

            <Field label="Data da baixa">
              <input type="date" value={baixaForm.dataBaixa}
                     onChange={e => setBaixaForm({ ...baixaForm, dataBaixa: e.target.value })} />
            </Field>

            <div className="flex gap-3 justify-end mt-6">
              <button className="btn-ghost" onClick={() => setBaixaForm(null)}>Cancelar</button>
              <button className="btn-gold" onClick={confirmarBaixa}
                      disabled={baixaForm.destino === "reinvestir" && !baixaForm.ativoDestinoId}>
                <Check size={13} className="inline mr-1" />
                Confirmar baixa
              </button>
            </div>
          </Modal>
        );
      })()}

      {/* MODAL: TRANSFERIR PRA CONTA */}
      {transferirForm && (
        <Modal title="Transferir da Carteira de Proventos" onClose={() => setTransferirForm(null)}>
          <div style={{
            padding: 12, background: T.bgSoft, borderRadius: 7,
            fontSize: 12, marginBottom: 14,
          }}>
            Saldo disponível: <strong className="num" style={{ color: T.gold, fontSize: 16 }}>
              {hidden ? "•••" : fmt(carteiraProventos.saldo)}
            </strong>
          </div>
          <Field label="Valor a transferir (R$)" required>
            <input type="number" step="0.01" value={transferirForm.valor}
                   onChange={e => setTransferirForm({ ...transferirForm, valor: e.target.value })} />
          </Field>
          <Field label="Conta destino" required>
            <select value={transferirForm.contaDestino}
                    onChange={e => setTransferirForm({ ...transferirForm, contaDestino: e.target.value })}>
              <option value="">Selecione…</option>
              {contas.map(c => (
                <option key={c.id} value={c.nome}>{c.nome} · saldo {fmt(c.saldo)}</option>
              ))}
            </select>
          </Field>
          <div style={{
            padding: 10, background: `${T.green}11`, border: `1px solid ${T.green}33`,
            borderRadius: 6, fontSize: 11.5, color: T.green, marginTop: 8,
          }}>
            ✓ Cria transação de receita "Transferência da Carteira de Proventos"<br />
            ✓ Aumenta saldo da conta destino<br />
            ✓ Diminui saldo da Carteira de Proventos
          </div>
          <div className="flex gap-3 justify-end mt-6">
            <button className="btn-ghost" onClick={() => setTransferirForm(null)}>Cancelar</button>
            <button className="btn-gold" onClick={confirmarTransferencia}>
              <Check size={13} className="inline mr-1" /> Transferir
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL: COMPRAR ATIVO COM SALDO DA CARTEIRA */}
      {comprarForm && (() => {
        const ativoSel = ativos.find(a => a.id === comprarForm.ativoId);
        const preco = Number(ativoSel?.preco || 0);
        const valN = Number(comprarForm.valor) || 0;
        const qtdCompravel = preco > 0 ? valN / preco : 0;
        return (
          <Modal title="Reinvestir saldo da Carteira" onClose={() => setComprarForm(null)}>
            <div style={{
              padding: 12, background: T.bgSoft, borderRadius: 7,
              fontSize: 12, marginBottom: 14,
            }}>
              Saldo disponível: <strong className="num" style={{ color: T.gold, fontSize: 16 }}>
                {hidden ? "•••" : fmt(carteiraProventos.saldo)}
              </strong>
            </div>
            <Field label="Ativo a comprar" required>
              <select value={comprarForm.ativoId}
                      onChange={e => setComprarForm({ ...comprarForm, ativoId: e.target.value })}>
                <option value="">Selecione…</option>
                {ativos.filter(a => Number(a.preco || 0) > 0).map(a => (
                  <option key={a.id} value={a.id}>
                    {a.ticker} · preço {fmt(a.preco)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Valor a usar (R$)" required>
              <input type="number" step="0.01" value={comprarForm.valor}
                     onChange={e => setComprarForm({ ...comprarForm, valor: e.target.value })} />
            </Field>
            {ativoSel && preco > 0 && (
              <div style={{
                padding: 10, background: `${T.green}11`, border: `1px solid ${T.green}33`,
                borderRadius: 6, fontSize: 11.5, color: T.muted, marginTop: 8,
              }}>
                Vai comprar <strong className="num" style={{ color: T.green }}>
                  {qtdCompravel.toFixed(6)} {ativoSel.ticker}
                </strong> a <strong className="num" style={{ color: T.ink }}>{fmt(preco)}</strong>/cota.
                <br />Novo PM ponderado calculado automaticamente.
              </div>
            )}
            <div className="flex gap-3 justify-end mt-6">
              <button className="btn-ghost" onClick={() => setComprarForm(null)}>Cancelar</button>
              <button className="btn-gold" onClick={confirmarCompra}
                      disabled={!comprarForm.ativoId || valN <= 0}>
                <Check size={13} className="inline mr-1" /> Comprar
              </button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

function Kpi({ label, valor, sub, cor }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${cor || T.gold}`,
      borderRadius: 10, padding: 12,
    }}>
      <div className="label-eyebrow">{label}</div>
      <div className="num" style={{
        fontFamily: T.serif, fontSize: 20, color: cor || T.ink, fontWeight: 600, marginTop: 4,
      }}>
        {valor}
      </div>
      <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function Th({ children, align }) {
  return (
    <th style={{
      padding: "10px 12px", textAlign: align || "left",
      fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase",
      color: T.muted, fontWeight: 600,
      background: T.bgSoft, borderBottom: `1px solid ${T.border}`,
    }}>{children}</th>
  );
}

function Td({ children, align, mono, style }) {
  return (
    <td style={{
      padding: "10px 12px", textAlign: align || "left",
      color: T.ink, ...(mono && { fontFamily: T.mono }),
      ...(style || {}),
    }}>{children}</td>
  );
}
