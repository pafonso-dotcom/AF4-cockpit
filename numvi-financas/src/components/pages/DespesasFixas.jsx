import React, { useState, useMemo } from "react";
import { Plus, Edit3, Trash2, Check, AlertCircle, Repeat, Clock, Circle } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, todayISO, uid } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import { gerarOcorrencias, statusReal, resumoMes } from "../../lib/fixas.js";
import PageHeader from "../ui/PageHeader.jsx";
import NovaFixaModal from "../modals/NovaFixaModal.jsx";
import ConfirmarPagamentoFixaModal from "../modals/ConfirmarPagamentoFixaModal.jsx";

const MES_NOMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MES_NOMES_LONGOS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

/**
 * Despesas Fixas — módulo independente.
 * Lê fixas[] e fixaOcorrencias[] do estado global. Pagar uma fixa NÃO cria
 * transação automaticamente — pergunta toda vez via ConfirmarPagamentoFixaModal.
 */
export default function DespesasFixas({
  fixas = [],
  setFixas,
  fixaOcorrencias = [],
  setFixaOcorrencias,
  categorias = [],
  contas = [],
  transacoes = [],
  setTransacoes,
  hidden,
}) {
  const hojeISO = todayISO();
  const anoAtual = parseInt(hojeISO.slice(0, 4), 10);
  const mesAtualIdx = parseInt(hojeISO.slice(5, 7), 10) - 1;
  const mesAtualISO = `${anoAtual}-${String(mesAtualIdx + 1).padStart(2, "0")}`;

  const [mesAtivo, setMesAtivo] = useState(mesAtualISO);
  const [modalNovaFixaOpen, setModalNovaFixaOpen] = useState(false);
  const [editingFixa, setEditingFixa] = useState(null); // fixa sendo editada
  const [pagandoOccId, setPagandoOccId] = useState(null);

  // Tabs por mês — mostra os 12 do ano atual
  const tabsMeses = useMemo(() => {
    const out = [];
    for (let m = 1; m <= 12; m++) {
      const mesISO = `${anoAtual}-${String(m).padStart(2, "0")}`;
      const qtd = fixaOcorrencias.filter(o => o.mes === mesISO).length;
      out.push({ iso: mesISO, idx: m - 1, qtd });
    }
    return out;
  }, [fixaOcorrencias, anoAtual]);

  // Ocorrências do mês ativo, ordenadas por dataVencimento
  const ocorrenciasDoMes = useMemo(() => {
    return fixaOcorrencias
      .filter(o => o.mes === mesAtivo)
      .sort((a, b) => (a.dataVencimento || "").localeCompare(b.dataVencimento || ""));
  }, [fixaOcorrencias, mesAtivo]);

  // Resumo do mês
  const resumo = useMemo(() => resumoMes(fixaOcorrencias, mesAtivo), [fixaOcorrencias, mesAtivo]);

  // Index de fixas por id pra lookup rápido
  const fixasPorId = useMemo(() => {
    const m = {};
    fixas.forEach(f => { m[f.id] = f; });
    return m;
  }, [fixas]);

  // ===== Handlers =====
  const handleSalvarFixa = (fixaSalva, ocorrenciasNovas, modo) => {
    if (modo === "criar") {
      setFixas([...fixas, fixaSalva]);
      setFixaOcorrencias([...fixaOcorrencias, ...(ocorrenciasNovas || [])]);
      toast.success(`Fixa "${fixaSalva.descricao}" criada · ${ocorrenciasNovas?.length || 0} ocorrências geradas.`);
      setMesAtivo(fixaSalva.inicioEm || mesAtualISO);
    } else {
      // Edição: atualiza a fixa + propaga pra ocorrências (futuras ou todas pendentes)
      setFixas(fixas.map(f => f.id === fixaSalva.id ? fixaSalva : f));
      const limite = modo === "todas" ? mesAtualISO : (() => {
        // Próximo mês
        const d = new Date(anoAtual, mesAtualIdx + 1, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      })();

      const novasOcc = fixaOcorrencias.map(o => {
        if (o.fixaId !== fixaSalva.id) return o;
        if (o.status === "paga") return o; // nunca toca em pagas
        if (modo === "futuras" && o.mes < limite) return o;
        // Atualiza valor padrão (se não foi editado individualmente, mantém igual à fixa)
        return { ...o, valor: fixaSalva.valor };
      });
      setFixaOcorrencias(novasOcc);
      toast.success(`"${fixaSalva.descricao}" atualizada (${modo === "futuras" ? "futuras" : "todas pendentes"}).`);
      setEditingFixa(null);
    }
  };

  const handleExcluirFixa = async (fixa) => {
    const ocorrenciasFixa = fixaOcorrencias.filter(o => o.fixaId === fixa.id);
    const pendentes = ocorrenciasFixa.filter(o => o.status !== "paga");
    const pagas = ocorrenciasFixa.filter(o => o.status === "paga");

    const ok = await confirm({
      title: `Excluir fixa "${fixa.descricao}"?`,
      body: `Vai remover ${pendentes.length} ocorrência${pendentes.length === 1 ? "" : "s"} pendente${pendentes.length === 1 ? "" : "s"}. ${pagas.length > 0 ? `Os ${pagas.length} pagamentos já feitos ficam preservados no histórico.` : ""}`,
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;

    setFixas(fixas.filter(f => f.id !== fixa.id));
    // Remove só pendentes; pagas ficam (mantendo histórico)
    setFixaOcorrencias(fixaOcorrencias.filter(o => o.fixaId !== fixa.id || o.status === "paga"));
    toast.success(`"${fixa.descricao}" excluída. ${pagas.length > 0 ? `${pagas.length} pagamento${pagas.length === 1 ? "" : "s"} preservado${pagas.length === 1 ? "" : "s"}.` : ""}`);
  };

  // Remove fixas duplicadas (mesmo nome + mesmo valor). Mantém a que tem mais
  // ocorrências e remove as cópias; pagamentos já feitos ficam preservados.
  const removerDuplicadas = async () => {
    const norm = (s) => (s || "").toLowerCase().normalize("NFD")
      .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ").trim();
    const contarOcc = (f) => fixaOcorrencias.filter(o => o.fixaId === f.id).length;
    const grupos = {};
    fixas.forEach(f => {
      const key = `${norm(f.descricao)}|${Math.round((Number(f.valor) || 0) * 100)}`;
      (grupos[key] = grupos[key] || []).push(f);
    });
    const remover = [];
    Object.values(grupos).filter(g => g.length > 1).forEach(g => {
      const ordenado = [...g].sort((a, b) => contarOcc(b) - contarOcc(a));
      remover.push(...ordenado.slice(1)); // mantém a 1ª (mais ocorrências)
    });
    if (remover.length === 0) {
      toast.info("Nenhuma fixa duplicada encontrada.");
      return;
    }
    const ok = await confirm({
      title: `Remover ${remover.length} fixa${remover.length === 1 ? "" : "s"} duplicada${remover.length === 1 ? "" : "s"}?`,
      body: "Mantém uma de cada despesa repetida e remove as cópias (ocorrências pendentes). Pagamentos já feitos ficam preservados no histórico.",
      danger: true, confirmLabel: "Remover",
    });
    if (!ok) return;
    const idsRemover = new Set(remover.map(f => f.id));
    const backupFixas = fixas;
    const backupOcc = fixaOcorrencias;
    setFixas(fixas.filter(f => !idsRemover.has(f.id)));
    setFixaOcorrencias(fixaOcorrencias.filter(o => !idsRemover.has(o.fixaId) || o.status === "paga"));
    toast.success(`${remover.length} fixa${remover.length === 1 ? "" : "s"} duplicada${remover.length === 1 ? "" : "s"} removida${remover.length === 1 ? "" : "s"}.`, {
      action: {
        label: "Desfazer",
        onClick: () => { setFixas(backupFixas); setFixaOcorrencias(backupOcc); },
      },
    });
  };

  const handleConfirmarPagamento = ({ dataPagto, valorPago, lancarNoBanco, conta }) => {
    const occ = fixaOcorrencias.find(o => o.id === pagandoOccId);
    if (!occ) return;
    const fixa = fixasPorId[occ.fixaId];
    if (!fixa) return;

    let transacaoId = null;
    let novaTx = null;

    // 1. Se "lançar no banco", cria a transação
    if (lancarNoBanco && conta && setTransacoes) {
      novaTx = {
        id: `tx-${Date.now()}`,
        tipo: "despesa",
        descricao: fixa.descricao,
        valor: valorPago,
        data: dataPagto,
        categoria: fixa.categoria,
        conta,
        compensado: true,
        fixa: false,
        obs: `Pagamento de fixa: ${fixa.descricao} · ${occ.mes}`,
        origemFixaOcorrenciaId: occ.id,
      };
      setTransacoes([...(transacoes || []), novaTx]);
      transacaoId = novaTx.id;
    }

    // 2. Atualiza a ocorrência
    const novasOcc = fixaOcorrencias.map(o =>
      o.id === occ.id
        ? { ...o, status: "paga", dataPagamento: dataPagto, valorPago, transacaoId }
        : o
    );
    setFixaOcorrencias(novasOcc);

    setPagandoOccId(null);

    // 3. Toast com Desfazer
    const backupOcc = fixaOcorrencias;
    const backupTx = transacoes;
    toast.success(
      `${fixa.descricao} marcada como paga${lancarNoBanco ? ` · ${fmt(valorPago)} debitado de ${conta}` : " (sem lançar no banco)"}.`,
      {
        action: {
          label: "Desfazer",
          onClick: () => {
            setFixaOcorrencias(backupOcc);
            if (novaTx) setTransacoes(backupTx);
          },
        },
      }
    );
  };

  const desfazerPagamento = async (occ) => {
    const fixa = fixasPorId[occ.fixaId];
    const ok = await confirm({
      title: `Desmarcar pagamento de "${fixa?.descricao || "?"}"?`,
      body: occ.transacaoId
        ? "A transação criada no extrato bancário também será removida."
        : "A ocorrência voltará para 'pendente'.",
      danger: true, confirmLabel: "Desmarcar",
    });
    if (!ok) return;

    if (occ.transacaoId && setTransacoes) {
      setTransacoes((transacoes || []).filter(t => t.id !== occ.transacaoId));
    }
    setFixaOcorrencias(fixaOcorrencias.map(o =>
      o.id === occ.id
        ? { ...o, status: "pendente", dataPagamento: null, valorPago: null, transacaoId: null }
        : o
    ));
    toast.info("Pagamento desfeito.");
  };

  // Visual do card baseado no status real
  const visualOcc = (occ) => {
    const sr = statusReal(occ);
    if (sr === "paga") return { bg: `${T.green}11`, border: T.green, label: "Paga", labelCor: T.green, badgeBg: `${T.green}22`, icon: Check };
    if (sr === "atrasada") return { bg: `${T.red}11`, border: T.red, label: "Atrasada", labelCor: T.red, badgeBg: `${T.red}22`, icon: AlertCircle };
    // Próximas (até 3 dias) → amarelo
    const dias = Math.round((new Date(occ.dataVencimento) - new Date(hojeISO)) / 86400000);
    if (dias >= 0 && dias <= 3) return { bg: `${T.gold}11`, border: T.gold, label: `Vence em ${dias === 0 ? "hoje" : `${dias}d`}`, labelCor: T.gold, badgeBg: `${T.gold}22`, icon: Clock };
    return { bg: T.card, border: T.border, label: "Pendente", labelCor: T.muted, badgeBg: T.bgSoft, icon: Circle };
  };

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Finanças · Recorrência"
        title={<>Despesas <em>Fixas.</em></>}
        sub="Agenda de obrigações recorrentes — aluguel, mensalidades, assinaturas. Pagar aqui não toca no banco automaticamente: o app pergunta a cada vez."
        action={
          <div className="flex gap-2 flex-wrap">
            <button className="btn-ghost" onClick={removerDuplicadas} title="Remove fixas repetidas (mesmo nome e valor)">
              <Trash2 size={14} className="inline mr-1.5" /> Remover duplicadas
            </button>
            <button className="btn-gold" onClick={() => { setEditingFixa(null); setModalNovaFixaOpen(true); }}>
              <Plus size={14} className="inline mr-1.5" /> Nova fixa
            </button>
          </div>
        }
      />

      {/* Seletor de mês compacto */}
      {(() => {
        const mesIdx = parseInt(mesAtivo.slice(5), 10) - 1;
        const ano = mesAtivo.slice(0, 4);
        const isCorrente = mesAtivo === mesAtualISO;
        const qtd = ocorrenciasDoMes.length;
        const addMes = (delta) => {
          const [y, m] = mesAtivo.split("-").map(Number);
          const d = new Date(y, m - 1 + delta, 1);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        };
        const navBtn = { background: T.bgSoft, color: T.ink, border: `1px solid ${T.border}`, borderRadius: 8, width: 34, height: 34, cursor: "pointer", fontSize: 16, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center" };
        return (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <button onClick={() => setMesAtivo(addMes(-1))} aria-label="Mês anterior" style={navBtn}>‹</button>
            <div style={{ minWidth: 170, textAlign: "center", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: T.ink, whiteSpace: "nowrap" }}>
                {isCorrente && "★ "}{MES_NOMES_LONGOS[mesIdx]} {ano}
              </span>
              {qtd > 0 && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 100, background: T.gold, color: T.bg, fontWeight: 700 }}>{qtd}</span>}
            </div>
            <button onClick={() => setMesAtivo(addMes(1))} aria-label="Próximo mês" style={navBtn}>›</button>
            {!isCorrente && (
              <button onClick={() => setMesAtivo(mesAtualISO)} style={{ background: "transparent", color: T.gold, border: `1px solid ${T.border}`, borderRadius: 8, padding: "0 12px", height: 34, cursor: "pointer", fontSize: 12 }}>Hoje</button>
            )}
          </div>
        );
      })()}

      {/* Resumo do mês: 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <ResumoCard label="Total previsto" valor={hidden ? "•••" : fmt(resumo.previsto)}
                    sub={`${resumo.total} ${resumo.total === 1 ? "fixa" : "fixas"}`} cor={T.muted} />
        <ResumoCard label="Já pago" valor={hidden ? "•••" : fmt(resumo.jaPago)}
                    sub={`${resumo.qtdPagas} ${resumo.qtdPagas === 1 ? "paga" : "pagas"}`} cor={T.green} />
        <ResumoCard label="Pendente" valor={hidden ? "•••" : fmt(resumo.pendente)}
                    sub={`${resumo.qtdPendentes} ${resumo.qtdPendentes === 1 ? "aguarda" : "aguardam"}`} cor={T.gold} />
        <ResumoCard label="⚠ Atrasado" valor={hidden ? "•••" : fmt(resumo.atrasado)}
                    sub={`${resumo.qtdAtrasadas} ${resumo.qtdAtrasadas === 1 ? "atrasada" : "atrasadas"}`} cor={T.red} />
      </div>

      {/* Lista de cards das fixas do mês */}
      {ocorrenciasDoMes.length === 0 ? (
        <div style={{
          padding: 50, textAlign: "center", color: T.muted, fontStyle: "italic",
          background: T.card, border: `1px dashed ${T.border}`, borderRadius: 10,
        }}>
          Nenhuma despesa fixa em {MES_NOMES_LONGOS[parseInt(mesAtivo.slice(5), 10) - 1]}/{mesAtivo.slice(0, 4)}.
          {fixas.length === 0 && <div style={{ marginTop: 8 }}>Comece criando uma com o botão <strong>+ Nova fixa</strong>.</div>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {ocorrenciasDoMes.map(occ => {
            const fixa = fixasPorId[occ.fixaId];
            if (!fixa) return null;
            const v = visualOcc(occ);
            const isPaga = occ.status === "paga";
            const cat = (categorias || []).find(c => c.nome === fixa.categoria);
            return (
              <div key={occ.id} style={{
                background: v.bg, border: `1px solid ${v.border}55`, borderLeft: `4px solid ${v.border}`,
                borderRadius: 10, padding: "4px 10px",
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: cat ? `${cat.cor}22` : T.bgSoft,
                  color: cat ? cat.cor : T.muted,
                  display: "grid", placeItems: "center", flexShrink: 0,
                  fontSize: 13, fontWeight: 700,
                }}>
                  <Repeat size={13} />
                </div>

                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ color: T.ink, fontSize: 13, fontWeight: 600 }}>{fixa.descricao}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 1, fontSize: 11, color: T.muted, flexWrap: "wrap" }}>
                    <span style={{
                      padding: "1px 7px", background: cat ? `${cat.cor}22` : T.bgSoft,
                      color: cat ? cat.cor : T.muted, borderRadius: 4,
                      fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", fontSize: 9.5,
                    }}>{fixa.categoria || "—"}</span>
                    <span>Recorrente · todo dia {fixa.diaVencimento}</span>
                    {fixa.obs && <span style={{ fontStyle: "italic" }}>· {fixa.obs}</span>}
                  </div>
                </div>

                <div style={{ minWidth: 110, textAlign: "right" }}>
                  <div className="num" style={{ color: isPaga ? T.green : T.red, fontFamily: T.serif, fontSize: 14.5, fontWeight: 600 }}>
                    {hidden ? "•••" : fmt(occ.valorPago ?? occ.valor)}
                  </div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 0 }}>
                    {isPaga
                      ? `Pago ${(occ.dataPagamento || "").slice(8,10)}/${(occ.dataPagamento || "").slice(5,7)}`
                      : `Vence ${occ.dataVencimento.slice(8,10)}/${occ.dataVencimento.slice(5,7)}`}
                  </div>
                </div>

                <div style={{ display: "inline-flex", gap: 5, flexShrink: 0 }}>
                  {!isPaga ? (
                    <button onClick={() => setPagandoOccId(occ.id)}
                      title="Marcar como paga"
                      style={{
                        background: T.green, color: T.bg, border: "none",
                        padding: "5px 11px", fontSize: 11, letterSpacing: ".08em",
                        textTransform: "uppercase", fontWeight: 600, cursor: "pointer",
                        borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 5,
                      }}>
                      <Check size={11} /> Pagar
                    </button>
                  ) : (
                    <span style={{
                      padding: "5px 10px", borderRadius: 5,
                      background: v.badgeBg, color: v.labelCor, fontSize: 10,
                      letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700,
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}><v.icon size={11} /> {v.label}</span>
                  )}

                  {isPaga && (
                    <button onClick={() => desfazerPagamento(occ)}
                      title="Desmarcar pagamento"
                      style={{ background: "transparent", color: T.muted,
                               border: `1px solid ${T.border}`, padding: "5px 8px",
                               borderRadius: 6, cursor: "pointer", fontSize: 10 }}>
                      ↶
                    </button>
                  )}

                  <button onClick={() => { setEditingFixa(fixa); setModalNovaFixaOpen(true); }}
                    title="Editar fixa"
                    style={{ background: "transparent", color: T.muted,
                             border: `1px solid ${T.border}`, padding: "5px 8px",
                             borderRadius: 6, cursor: "pointer" }}>
                    <Edit3 size={12} />
                  </button>
                  <button onClick={() => handleExcluirFixa(fixa)}
                    title="Excluir fixa"
                    style={{ background: "transparent", color: T.red,
                             border: `1px solid ${T.red}55`, padding: "5px 8px",
                             borderRadius: 6, cursor: "pointer" }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modais */}
      {modalNovaFixaOpen && (
        <NovaFixaModal
          editing={editingFixa}
          categorias={categorias}
          contas={contas}
          onSave={handleSalvarFixa}
          onClose={() => { setModalNovaFixaOpen(false); setEditingFixa(null); }}
        />
      )}

      {pagandoOccId && (() => {
        const occ = fixaOcorrencias.find(o => o.id === pagandoOccId);
        if (!occ) return null;
        const fixa = fixasPorId[occ.fixaId];
        if (!fixa) return null;
        return (
          <ConfirmarPagamentoFixaModal
            ocorrencia={occ}
            fixa={fixa}
            contas={contas}
            onConfirm={handleConfirmarPagamento}
            onClose={() => setPagandoOccId(null)}
          />
        );
      })()}
    </div>
  );
}

function ResumoCard({ label, valor, sub, cor }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${cor}`, borderRadius: 8, padding: 14,
    }}>
      <div style={{
        fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase",
        color: T.muted, fontWeight: 600,
      }}>{label}</div>
      <div className="num" style={{
        fontFamily: T.serif, fontSize: 20, color: cor,
        fontWeight: 600, marginTop: 6, lineHeight: 1.1,
      }}>
        {valor}
      </div>
      <div style={{ fontSize: 10.5, color: T.faint, marginTop: 4 }}>{sub}</div>
    </div>
  );
}
