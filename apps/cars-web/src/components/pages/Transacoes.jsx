import React, { useState, useMemo, useEffect } from "react";
import { Activity, Plus, Trash2, Edit3, ArrowUpRight, ArrowDownRight, AlertCircle, CheckCircle2, Upload, Download, Repeat, Search, CheckSquare, Square, Paperclip, X, Camera, FileText, Mic } from "lucide-react";
import EmptyState from "../ui/EmptyState.jsx";
import { T } from "../../lib/theme.js";
import { MESES_CURTO } from "../../lib/meses.js";
import { fmt, uid, todayISO } from "../../lib/format.js";
import { parseValorBR, printHTML } from "../../lib/importExport.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";
import Field from "../ui/Field.jsx";
import Modal from "../ui/Modal.jsx";
import MoneyInput from "../ui/MoneyInput.jsx";
import ImportExportModal from "../modals/ImportExportModal.jsx";
import OCRComprovante from "../modals/OCRComprovante.jsx";
import VoiceTransacao from "../modals/VoiceTransacao.jsx";

export default function Transacoes({ transacoes, setTransacoes, categorias, contas, setContas, ativos, totais, hidden, pendingTransacao, clearPendingTransacao, parcelamentos, cartoes, apiKey, escopoAtivo = "tudo" }) {
  const [form, setForm] = useState(null);
  const [ieOpen, setIeOpen] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [filterTipo, setFilterTipo] = useState("todas");
  const [filterCat, setFilterCat] = useState("todas");
  const [filterConta, setFilterConta] = useState("todas"); // "todas" | nome de conta | "particular"
  const [filterComp, setFilterComp] = useState("todas"); // todas | compensadas | pendentes
  const [filtroRecorrencia, setFiltroRecorrencia] = useState("todas"); // todas | fixas | variaveis
  const [visao, setVisao] = useState(() => {
    try { return localStorage.getItem("af4:transacoes-visao") || "lista"; }
    catch { return "lista"; }
  });
  const setVisaoPersist = (v) => {
    setVisao(v);
    try { localStorage.setItem("af4:transacoes-visao", v); } catch {}
  };
  const [filterPeriodo, setFilterPeriodo] = useState("todos"); // todos | mes-atual | mes-anterior | YYYY-MM
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [comprovanteVisualizar, setComprovanteVisualizar] = useState(null);

  // Auto-open form with pre-filled account, ou editar transação existente
  useEffect(() => {
    if (pendingTransacao?.editId) {
      const t = transacoes.find(x => x.id === pendingTransacao.editId);
      if (t) {
        setForm({ ...t, valor: t.valor == null || t.valor === "" ? "" : parseValorBR(t.valor) });
      }
      clearPendingTransacao?.();
      return;
    }
    if (pendingTransacao?.conta) {
      setForm({
        id: null,
        tipo: "despesa",
        valor: "",
        descricao: "",
        categoria: "",
        conta: pendingTransacao.conta,
        data: todayISO(),
        obs: "",
        compensado: true,
        fixa: false,
        vencimento: null,
      });
      clearPendingTransacao?.();
    }
  }, [pendingTransacao, clearPendingTransacao, transacoes]);

  const filtered = useMemo(() => {
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;
    const lastMonth = curM === 1 ? { y: curY - 1, m: 12 } : { y: curY, m: curM - 1 };
    // Escopo: só transações cujas contas pertencem ao escopo ativo
    const contasEscopo = escopoAtivo === "tudo"
      ? null
      : new Set((contas || []).filter(c => (c.escopo || "pessoal") === escopoAtivo).map(c => c.nome));
    return transacoes
      .filter(t => !contasEscopo || contasEscopo.has(t.conta))
      .filter(t => filterTipo === "todas" || t.tipo === filterTipo)
      .filter(t => filterCat === "todas" || t.categoria === filterCat)
      .filter(t => {
        if (filterConta === "todas") return true;
        if (filterConta === "particular") return !t.conta || !contas.find(c => c.nome === t.conta);
        return t.conta === filterConta;
      })
      .filter(t => filterComp === "todas" || (filterComp === "compensadas" ? t.compensado : !t.compensado))
      .filter(t => {
        if (filtroRecorrencia === "fixas") return !!t.fixa;
        if (filtroRecorrencia === "variaveis") return t.tipo === "despesa" && !t.fixa;
        return true;
      })
      .filter(t => {
        if (filterPeriodo === "todos") return true;
        if (!t.data) return false;
        const [y, m] = t.data.split("-").map(Number);
        if (filterPeriodo === "mes-atual") return y === curY && m === curM;
        if (filterPeriodo === "mes-anterior") return y === lastMonth.y && m === lastMonth.m;
        if (filterPeriodo === "ano-atual") return y === curY;
        // formato YYYY-MM
        if (/^\d{4}-\d{2}$/.test(filterPeriodo)) {
          const [py, pm] = filterPeriodo.split("-").map(Number);
          return y === py && m === pm;
        }
        return true;
      })
      .filter(t => !search || (t.descricao + " " + (t.obs || "")).toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [transacoes, filterTipo, filterCat, filterConta, filterComp, filterPeriodo, search, filtroRecorrencia, contas, escopoAtivo]);

  // Exporta as transações filtradas como PDF (via janela de impressão do navegador)
  const exportarPDF = () => {
    if (filtered.length === 0) { toast.error("Nenhuma transação para exportar."); return; }
    const esc = (s) => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const totRec = filtered.filter(t => t.tipo === "receita").reduce((s, t) => s + Number(t.valor || 0), 0);
    const totDes = filtered.filter(t => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor || 0), 0);
    const linhas = filtered.map(t => `<tr>
      <td>${esc(t.data)}</td><td>${esc(t.descricao)}</td><td>${esc(t.categoria)}</td><td>${esc(t.conta)}</td>
      <td class="r ${t.tipo}">${t.tipo === "receita" ? "+ " : "− "}${esc(fmt(t.valor))}</td></tr>`).join("");
    printHTML(`<!doctype html><html><head><meta charset="utf-8"><title>Transações · Afinanças</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:24px;color:#111}
h1{font-size:18px;margin:0}.sub{color:#666;font-size:12px;margin:2px 0 16px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #ddd}
th{text-transform:uppercase;font-size:10px;letter-spacing:.08em;color:#666}
td.r{text-align:right;white-space:nowrap}td.receita{color:#15803d}td.despesa{color:#b91c1c}
tfoot td{font-weight:700;border-top:2px solid #111;border-bottom:none}
</style></head><body>
<h1>Afinanças · Transações</h1>
<div class="sub">${filtered.length} lançamento(s) · gerado em ${esc(new Date().toLocaleString("pt-BR"))}</div>
<table>
<thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Conta</th><th style="text-align:right">Valor</th></tr></thead>
<tbody>${linhas}</tbody>
<tfoot>
<tr><td colspan="4">Total receitas</td><td class="r receita">+ ${esc(fmt(totRec))}</td></tr>
<tr><td colspan="4">Total despesas</td><td class="r despesa">− ${esc(fmt(totDes))}</td></tr>
<tr><td colspan="4">Saldo</td><td class="r">${esc(fmt(totRec - totDes))}</td></tr>
</tfoot></table></body></html>`);
  };

  // Lista de meses com transações (para popular o filtro de período)
  const mesesDisponiveis = useMemo(() => {
    const set = new Set();
    transacoes.forEach(t => {
      if (t.data) set.add(t.data.slice(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [transacoes]);

  // Saldo previsto fim do mês: saldo atual + (receitas pendentes do mês - despesas pendentes do mês)
  const saldoPrevisto = useMemo(() => {
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;
    const saldoAtual = (contas || []).reduce((s, c) => s + Number(c.saldo || 0), 0);
    let pendentesReceita = 0;
    let pendentesDespesa = 0;
    transacoes.forEach(t => {
      if (t.compensado || !t.data) return;
      const [y, m] = t.data.split("-").map(Number);
      if (y === curY && m === curM) {
        if (t.tipo === "receita") pendentesReceita += Number(t.valor || 0);
        else pendentesDespesa += Number(t.valor || 0);
      }
    });
    return {
      atual: saldoAtual,
      pendentesReceita,
      pendentesDespesa,
      previsto: saldoAtual + pendentesReceita - pendentesDespesa,
    };
  }, [contas, transacoes]);

  // Limpa seleção quando filtros mudam
  useEffect(() => { setSelectedIds(new Set()); }, [filterTipo, filterCat, filterConta, filterComp, filterPeriodo, search]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(t => t.id)));
  };

  const bulkDelete = async () => {
    const count = selectedIds.size;
    const ok = await confirm({
      title: `Excluir ${count} transação${count !== 1 ? "ões" : ""}?`,
      body: "Essa ação não pode ser desfeita facilmente. Considere primeiro fazer backup em Configurações.",
      danger: true, confirmLabel: "Excluir todas",
    });
    if (!ok) return;
    const backup = transacoes;
    setTransacoes(transacoes.filter(t => !selectedIds.has(t.id)));
    setSelectedIds(new Set());
    toast.success(`${count} transação${count !== 1 ? "ões excluídas" : " excluída"}.`, {
      action: {
        label: "Desfazer",
        onClick: () => setTransacoes(backup),
      },
    });
  };

  // Remove lançamentos duplicados já existentes na lista. Conservador: só
  // considera duplicata o que for IDÊNTICO (mesma data, valor, tipo, conta e
  // descrição) e mantém sempre a 1ª ocorrência. Tem desfazer.
  const removerDuplicados = async () => {
    const chave = (t) => [
      String(t.data || "").slice(0, 10),
      Math.abs(Number(t.valor) || 0).toFixed(2),
      t.tipo || "",
      String(t.conta || "").trim().toLowerCase(),
      String(t.descricao || "").trim().toLowerCase().replace(/\s+/g, " "),
    ].join("|");

    const vistas = new Set();
    const idsDuplicados = new Set();
    for (const t of transacoes) {
      const k = chave(t);
      if (vistas.has(k)) idsDuplicados.add(t.id);
      else vistas.add(k);
    }

    if (idsDuplicados.size === 0) {
      toast.success("Nenhum lançamento duplicado encontrado.");
      return;
    }
    const count = idsDuplicados.size;
    const ok = await confirm({
      title: `Remover ${count} lançamento${count !== 1 ? "s" : ""} duplicado${count !== 1 ? "s" : ""}?`,
      body: "Mantém a 1ª ocorrência de cada lançamento e remove as cópias idênticas (mesma data, valor, tipo, conta e descrição).",
      danger: true, confirmLabel: "Remover duplicados",
    });
    if (!ok) return;
    const backup = transacoes;
    setTransacoes(transacoes.filter(t => !idsDuplicados.has(t.id)));
    setSelectedIds(new Set());
    toast.success(`${count} duplicado${count !== 1 ? "s removidos" : " removido"}.`, {
      action: { label: "Desfazer", onClick: () => setTransacoes(backup) },
    });
  };

  const bulkCategorizar = (categoriaNome) => {
    if (!categoriaNome) return;
    const count = selectedIds.size;
    const backup = transacoes.map(t => ({ ...t }));
    setTransacoes(transacoes.map(t =>
      selectedIds.has(t.id) ? { ...t, categoria: categoriaNome } : t
    ));
    setSelectedIds(new Set());
    toast.success(`${count} transação${count !== 1 ? "ões" : ""} re-categorizada${count !== 1 ? "s" : ""} para "${categoriaNome}".`, {
      action: { label: "Desfazer", onClick: () => setTransacoes(backup) },
    });
  };

  const bulkAlterarBanco = (novaConta) => {
    if (!novaConta) return;
    const count = selectedIds.size;
    const backup = transacoes.map(t => ({ ...t }));
    setTransacoes(transacoes.map(t =>
      selectedIds.has(t.id) ? { ...t, conta: novaConta } : t
    ));
    setSelectedIds(new Set());
    toast.success(`${count} transação${count !== 1 ? "ões" : ""} movida${count !== 1 ? "s" : ""} para "${novaConta}".`, {
      action: { label: "Desfazer", onClick: () => setTransacoes(backup) },
    });
  };

  // Recompute filtered with compensação filter
  // (the existing filtered useMemo already reads filterTipo/filterCat/search; we extend below)

  // Helper: signed amount from a transaction (only counts if compensada).
  // Usa parseValorBR pra aceitar valor como string ("1.500,00") ou número.
  const signedIfCompensada = (t) => {
    if (!t.compensado) return 0;
    const raw = t.valor;
    const v = typeof raw === "number" ? raw : (parseValorBR(raw) || 0);
    return t.tipo === "receita" ? v : -v;
  };

  const [formErrors, setFormErrors] = useState({});

  const save = () => {
    // Validação inline (sem usar schemas para evitar conflito com transferenciaId etc)
    const errs = {};
    if (!form.descricao?.trim()) errs.descricao = "Descrição é obrigatória";
    else if (form.descricao.length > 200) errs.descricao = "Máximo 200 caracteres";

    const v = Number(form.valor) || 0;
    if (form.valor == null || form.valor === "") errs.valor = "Informe um valor numérico (ex.: 1500 ou 1.500,00)";
    else if (v <= 0) errs.valor = "Valor deve ser positivo";

    if (!form.categoria) errs.categoria = "Selecione uma categoria";
    if (!form.conta) errs.conta = "Selecione uma conta";
    if (!form.data) errs.data = "Informe a data";

    if (form.fixa && form.vencimento) {
      const venc = parseInt(form.vencimento);
      if (isNaN(venc) || venc < 1 || venc > 31) errs.vencimento = "Dia entre 1 e 31";
    }

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados em vermelho.");
      return;
    }

    // Atualiza saldos: se editou e mudou a conta, estorna da velha e aplica na nova
    const oldT = transacoes.find(t => t.id === form.id);
    const newDelta = signedIfCompensada(form);
    const oldDelta = oldT ? signedIfCompensada(oldT) : 0;
    const oldContaNome = oldT?.conta;
    const newContaNome = form.conta;

    if (oldContaNome && oldContaNome !== newContaNome && oldDelta !== 0) {
      // Trocou de conta: estorna o impacto antigo da conta antiga e aplica o novo na nova
      setContas(contas.map(c => {
        if (c.nome === oldContaNome) return { ...c, saldo: (Number(c.saldo) || 0) - oldDelta };
        if (c.nome === newContaNome) return { ...c, saldo: (Number(c.saldo) || 0) + newDelta };
        return c;
      }));
    } else {
      // Mesma conta (ou nova transação): aplica só o delta líquido na conta atual
      const saldoDelta = newDelta - oldDelta;
      if (saldoDelta !== 0) {
        setContas(contas.map(c => c.nome === newContaNome ? { ...c, saldo: (Number(c.saldo) || 0) + saldoDelta } : c));
      }
    }

    // Persiste com valor já normalizado como número (não string com vírgula)
    const formNorm = { ...form, valor: v };
    if (form.id && transacoes.find(t => t.id === form.id)) {
      setTransacoes(transacoes.map(t => t.id === form.id ? formNorm : t));
      toast.success("Transação atualizada.");
    } else {
      setTransacoes([...transacoes, { ...formNorm, id: uid() }]);
      toast.success("Transação criada.");
    }
    setForm(null);
    setFormErrors({});
  };

  const del = async (t) => {
    const ok = await confirm({
      title: `Excluir "${t.descricao}"?`,
      body: t.compensado
        ? `O valor de ${fmt(t.valor)} será ${t.tipo === "receita" ? "removido da" : "estornado na"} conta ${t.conta}.`
        : "Esta transação está pendente — nada será revertido em saldo.",
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    const backupTransacoes = transacoes;
    const backupContas = contas;
    const conta = contas.find(c => c.nome === t.conta);
    if (conta && t.compensado) {
      const delta = -signedIfCompensada(t);
      setContas(contas.map(c => c.id === conta.id ? { ...c, saldo: c.saldo + delta } : c));
    }
    setTransacoes(transacoes.filter(x => x.id !== t.id));
    toast.success(`"${t.descricao}" excluída.`, {
      action: {
        label: "Desfazer",
        onClick: () => { setTransacoes(backupTransacoes); setContas(backupContas); },
      },
    });
  };

  // Toggle compensação inline (in list)
  const toggleCompensacao = (t) => {
    const novoEstado = !t.compensado;
    const conta = contas.find(c => c.nome === t.conta);
    if (conta) {
      const v = Number(t.valor || 0);
      const signed = t.tipo === "receita" ? v : -v;
      const delta = novoEstado ? signed : -signed;
      setContas(contas.map(c => c.id === conta.id ? { ...c, saldo: c.saldo + delta } : c));
    }
    setTransacoes(transacoes.map(x => x.id === t.id ? { ...x, compensado: novoEstado } : x));
  };

  // Totais por compensação para exibir resumo
  const resumoComp = useMemo(() => {
    let receitasC = 0, receitasP = 0, despesasC = 0, despesasP = 0;
    transacoes.forEach(t => {
      const v = Number(t.valor || 0);
      if (t.tipo === "receita") {
        if (t.compensado) receitasC += v; else receitasP += v;
      } else {
        if (t.compensado) despesasC += v; else despesasP += v;
      }
    });
    return { receitasC, receitasP, despesasC, despesasP };
  }, [transacoes]);

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Capítulo II"
        title="Transações"
        sub="O fluxo cotidiano. Receitas e despesas registradas com método."
        action={
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setVoiceOpen(true)}
                    style={{
                      background: `${T.gold}22`, color: T.gold,
                      border: `1px solid ${T.gold}`,
                      padding: "10px 16px", fontFamily: T.sans, fontSize: 12,
                      letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    }}
                    title="Registrar transação por voz (Gemini)">
              <Mic size={12} />
              <span>Voz</span>
            </button>
            <button onClick={() => setOcrOpen(true)}
                    style={{
                      background: `${T.blue || "#60a5fa"}22`, color: T.blue || "#60a5fa",
                      border: `1px solid ${T.blue || "#60a5fa"}`,
                      padding: "10px 16px", fontFamily: T.sans, fontSize: 12,
                      letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    }}
                    title="Tirar foto do comprovante (OCR via Gemini Vision)">
              <Camera size={12} />
              <span>Foto</span>
            </button>
            <button onClick={() => setIeOpen(true)}
                    style={{
                      background: `${T.gold}22`, color: T.gold,
                      border: `1px solid ${T.gold}`,
                      padding: "10px 16px", fontFamily: T.sans, fontSize: 12,
                      letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    }}>
              <Download size={12} />
              <span>Backup JSON</span>
            </button>
            <button onClick={exportarPDF}
                    style={{
                      background: T.card, color: T.ink,
                      border: `1px solid ${T.border}`,
                      padding: "10px 16px", fontFamily: T.sans, fontSize: 12,
                      letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    }}
                    title="Exportar transações filtradas para PDF">
              <FileText size={12} />
              <span>PDF</span>
            </button>
            <button className="btn-gold" onClick={() => setForm({ id: null, tipo: "despesa", valor: "", descricao: "", categoria: "", conta: contas[0]?.nome || "", data: todayISO(), obs: "", compensado: true, fixa: false, vencimento: null })}>
              <Plus size={14} className="inline mr-2" />Nova Transação
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4" style={{ background: T.card, border: `1px solid ${T.border}`, padding: 10, borderRadius: 11 }}>
        <div className="flex items-center gap-2 flex-1 min-w-[180px] max-w-[320px]" style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 5, padding: "0 10px" }}>
          <Search size={13} style={{ color: T.muted, flexShrink: 0 }} />
          <input style={{ border: "none", background: "transparent", flex: 1, padding: "6px 0", fontSize: 12.5 }}
                 placeholder="Buscar descrição/obs…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} style={{ width: "auto", flex: "0 1 160px" }}>
          <option value="todas">Todos os tipos</option>
          <option value="receita">Receitas</option>
          <option value="despesa">Despesas</option>
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ width: "auto", flex: "0 1 200px" }}>
          <option value="todas">Todas as categorias</option>
          {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
        </select>
        <select value={filterConta} onChange={e => setFilterConta(e.target.value)} style={{ width: "auto", flex: "0 1 220px" }}>
          <option value="todas">🏦 Banco · todos</option>
          <optgroup label="── Contas cadastradas ──">
            {(contas || []).map(c => (
              <option key={c.id} value={c.nome}>
                {c.nome}{c.instituicao ? ` (${c.instituicao})` : ""}
              </option>
            ))}
          </optgroup>
          <optgroup label="── Origem ──">
            <option value="particular">👤 Particular / sem conta</option>
          </optgroup>
        </select>
        <select value={filterComp} onChange={e => setFilterComp(e.target.value)} style={{ width: "auto", flex: "0 1 180px" }}>
          <option value="todas">Compensação · todas</option>
          <option value="compensadas">Apenas compensadas</option>
          <option value="pendentes">Apenas pendentes</option>
        </select>
        <select value={filterPeriodo} onChange={e => setFilterPeriodo(e.target.value)} style={{ width: "auto", flex: "0 1 180px" }}>
          <option value="todos">Período · todos</option>
          <option value="mes-atual">Mês atual</option>
          <option value="mes-anterior">Mês anterior</option>
          <option value="ano-atual">Ano atual</option>
          {mesesDisponiveis.length > 0 && <option disabled value="">─────────</option>}
          {mesesDisponiveis.map(m => {
            const [y, mm] = m.split("-");
            return <option key={m} value={m}>{MESES_CURTO[parseInt(mm) - 1]}/{y}</option>;
          })}
        </select>
      </div>

      {/* Chips: Recorrência (Todas / Fixas / Variáveis) + toggle de visão */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: T.muted, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase" }}>
            Recorrência:
          </span>
          {[
            { id: "todas", label: "Todas" },
            { id: "fixas", label: "📌 Fixas" },
            { id: "variaveis", label: "📊 Variáveis" },
          ].map(opt => {
            const active = filtroRecorrencia === opt.id;
            return (
              <button key={opt.id} onClick={() => setFiltroRecorrencia(opt.id)}
                style={{
                  padding: "5px 11px", borderRadius: 100, fontSize: 11, fontWeight: 500,
                  background: active ? `${T.gold}22` : T.bgSoft,
                  color: active ? T.gold : T.muted,
                  border: `1px solid ${active ? T.gold : T.border}`,
                  cursor: "pointer", whiteSpace: "nowrap",
                }}>
                {opt.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: "auto" }}>
          <span style={{ fontSize: 10, color: T.muted, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase" }}>
            Visão:
          </span>
          {[
            { id: "lista", label: "📃 Lista" },
            { id: "tabela-mensal", label: "📅 Tabela mensal" },
          ].map(opt => {
            const active = visao === opt.id;
            return (
              <button key={opt.id} onClick={() => setVisaoPersist(opt.id)}
                style={{
                  padding: "5px 11px", borderRadius: 100, fontSize: 11, fontWeight: 500,
                  background: active ? `${T.gold}22` : T.bgSoft,
                  color: active ? T.gold : T.muted,
                  border: `1px solid ${active ? T.gold : T.border}`,
                  cursor: "pointer", whiteSpace: "nowrap",
                }}>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div style={{
          background: `${T.gold}11`, border: `1px solid ${T.gold}`,
          padding: "10px 14px", marginBottom: 10,
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <span style={{ color: T.gold, fontSize: 13, fontWeight: 600 }}>
            {selectedIds.size} selecionada{selectedIds.size !== 1 ? "s" : ""}
          </span>
          <span style={{ color: T.muted, fontSize: 12 }}>·</span>
          <select onChange={e => bulkCategorizar(e.target.value)} value=""
                  style={{ width: "auto", padding: "4px 8px", fontSize: 12 }}>
            <option value="">Recategorizar para…</option>
            {categorias.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
          <select onChange={e => bulkAlterarBanco(e.target.value)} value=""
                  style={{ width: "auto", padding: "4px 8px", fontSize: 12 }}>
            <option value="">Mover para conta…</option>
            {contas.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
          <button onClick={bulkDelete}
                  style={{
                    background: "transparent", color: T.red, border: `1px solid ${T.red}`,
                    padding: "4px 12px", fontSize: 11, letterSpacing: "0.1em",
                    textTransform: "uppercase", fontWeight: 500, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
            <Trash2 size={11} /> Excluir
          </button>
          <button onClick={() => setSelectedIds(new Set())}
                  style={{
                    background: "transparent", color: T.muted, border: "none",
                    padding: "4px 8px", fontSize: 11, cursor: "pointer",
                    marginLeft: "auto",
                  }}>
            Limpar seleção
          </button>
        </div>
      )}

      <div style={{ background: T.card, border: `1px solid ${T.border}` }}>
        {filtered.length > 0 && (
          <div className="px-6 py-2" style={{ borderBottom: `1px solid ${T.border}`, background: T.bgSoft, display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={selectAll}
                    style={{
                      background: "transparent", border: "none", color: T.muted,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                      fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
                    }}>
              {selectedIds.size === filtered.length
                ? <CheckSquare size={14} style={{ color: T.gold }} />
                : <Square size={14} />}
              {selectedIds.size === filtered.length ? "Desmarcar todas" : "Selecionar todas"}
              <span style={{ color: T.faint, fontSize: 10 }}>({filtered.length})</span>
            </button>
            <button onClick={removerDuplicados}
                    title="Encontra e remove lançamentos idênticos repetidos, mantendo a 1ª ocorrência"
                    style={{
                      marginLeft: "auto",
                      background: "transparent", border: `1px solid ${T.border}`, color: T.muted,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                      fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase",
                      padding: "4px 10px", borderRadius: 5,
                    }}>
              <Trash2 size={12} /> Remover duplicados
            </button>
          </div>
        )}
        {filtered.length === 0 ? (
          <EmptyState icon={Search} title="Nenhuma transação encontrada"
            message="Ajuste os filtros de período/categoria/conta ou registre uma nova transação." />
        ) : visao === "tabela-mensal" ? (
          <TabelaMensal transacoes={filtered} hidden={hidden} onEdit={setForm} />
        ) : (
          filtered.map(t => {
            const cat = categorias.find(c => c.nome === t.categoria);
            const isPend = !t.compensado;
            const isSelected = selectedIds.has(t.id);
            return (
              <div key={t.id} className="flex items-center gap-2.5 px-4 py-2 hover:bg-black/30"
                   style={{
                     borderBottom: `1px solid ${T.border}`, transition: "background 0.2s",
                     opacity: isPend ? 0.85 : 1,
                     background: isSelected ? `${T.gold}11` : "transparent",
                   }}>
                {/* Checkbox compacto */}
                <button onClick={() => toggleSelect(t.id)}
                        aria-label={isSelected ? "Desmarcar" : "Marcar"}
                        style={{
                          background: "transparent", border: "none", padding: 0,
                          color: isSelected ? T.gold : T.muted, cursor: "pointer", flexShrink: 0,
                        }}>
                  {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>
                {/* Ícone compacto 24px */}
                <div style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: t.tipo === "receita" ? `${T.green}22` : `${T.red}22`,
                  color: t.tipo === "receita" ? T.green : T.red,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  border: isPend ? `1px dashed ${t.tipo === "receita" ? T.green : T.red}` : "none",
                }}>
                  {t.tipo === "receita" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                </div>
                {/* Conteúdo principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div style={{ color: T.ink, fontSize: 13, fontWeight: 500 }} className="truncate">{t.descricao}</div>
                    {t.fixa && (
                      <span style={{ background: `${T.blue}22`, color: T.blue, padding: "1px 6px", fontSize: 8.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 100, display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                        <Repeat size={8} /> Fixa{t.vencimento ? ` · ${t.vencimento}` : ""}
                      </span>
                    )}
                    {isPend && (
                      <span style={{ background: `${T.gold}22`, color: T.gold, padding: "1px 6px", fontSize: 8.5, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 100, whiteSpace: "nowrap" }}>
                        Pendente
                      </span>
                    )}
                    {t.comprovante && (
                      <button onClick={() => setComprovanteVisualizar(t.comprovante)}
                              aria-label="Ver comprovante anexado"
                              title="Ver comprovante"
                              style={{ background: "transparent", border: `1px solid ${T.gold}`, color: T.gold, padding: "0px 5px", fontSize: 8.5, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, borderRadius: 100 }}>
                        <Paperclip size={8} /> Anexo
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 1, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {cat && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 5, height: 5, background: cat.cor, borderRadius: "50%" }} />{cat.nome}
                    </span>}
                    <span style={{ color: T.faint }}>· {t.conta}</span>
                    <span style={{ color: T.faint }}>· {t.data}</span>
                    {t.subcategoria && <span style={{ color: T.faint }}>· {t.subcategoria}</span>}
                    {t.obs && <span style={{ color: T.faint, fontStyle: "italic" }}>· {t.obs.length > 40 ? t.obs.slice(0, 40) + "…" : t.obs}</span>}
                  </div>
                </div>
                {/* Valor */}
                <div className="num text-right" style={{ color: t.tipo === "receita" ? T.green : T.red, fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
                  {t.tipo === "receita" ? "+" : "−"} {hidden ? "•••" : fmt(t.valor)}
                </div>
                {/* Ações compactas */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button onClick={() => toggleCompensacao(t)}
                          title={t.compensado ? "Marcar como pendente" : "Marcar como compensada"}
                          aria-label="Alternar compensação"
                          style={{
                            color: t.compensado ? T.green : T.gold,
                            padding: 3, background: "transparent", border: "none", cursor: "pointer",
                          }}>
                    {t.compensado ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  </button>
                  <button onClick={() => setForm({ ...t, valor: t.valor == null || t.valor === "" ? "" : parseValorBR(t.valor) })} aria-label="Editar"
                          style={{ color: T.muted, padding: 3, background: "transparent", border: "none", cursor: "pointer" }}>
                    <Edit3 size={12} />
                  </button>
                  <button onClick={() => del(t)} aria-label="Excluir"
                          style={{ color: T.red, padding: 3, background: "transparent", border: "none", cursor: "pointer" }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {form && (
        <Modal title={form.id ? "Editar Transação" : "Nova Transação"} onClose={() => setForm(null)}>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {["receita", "despesa"].map(t => (
              <button key={t} onClick={() => setForm({ ...form, tipo: t })}
                style={{
                  padding: "12px", border: `1px solid ${form.tipo === t ? (t === "receita" ? T.green : T.red) : T.border}`,
                  background: form.tipo === t ? (t === "receita" ? `${T.green}22` : `${T.red}22`) : "transparent",
                  color: form.tipo === t ? (t === "receita" ? T.green : T.red) : T.muted,
                  fontFamily: T.sans, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase",
                }}>
                {t === "receita" ? "Receita" : "Despesa"}
              </button>
            ))}
          </div>
          <Field label="Descrição" required error={formErrors.descricao}>
            <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: Salário, Mercado…" />
          </Field>
          <Field label="Valor (R$)" required error={formErrors.valor} hint="Só números · centavos automáticos">
            <MoneyInput value={form.valor} onChange={v => setForm({ ...form, valor: v })} />
          </Field>
          <Field label="Categoria" required error={formErrors.categoria}>
            <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value, subcategoria: "" })}>
              <option value="">Selecione…</option>
              {categorias.filter(c => c.tipo === form.tipo).map(c => (
                <option key={c.id} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          </Field>
          {/* Subcategoria — só aparece se a categoria escolhida tem subs */}
          {(() => {
            const catObj = categorias.find(c => c.nome === form.categoria && c.tipo === form.tipo);
            const subs = catObj?.subcategorias || [];
            if (subs.length === 0) return null;
            return (
              <Field label="Subcategoria (opcional)" hint="Detalha dentro da categoria">
                <select value={form.subcategoria || ""} onChange={e => setForm({ ...form, subcategoria: e.target.value })}>
                  <option value="">— Nenhuma —</option>
                  {subs.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                </select>
              </Field>
            );
          })()}
          <Field label="Conta" required error={formErrors.conta}>
            <select value={form.conta} onChange={e => setForm({ ...form, conta: e.target.value })}>
              <option value="">Selecione…</option>
              {contas.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Data" required error={formErrors.data}>
            <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
          </Field>
          {form.tipo === "despesa" && cartoes && cartoes.length > 0 && (
            <Field label="Cartão (opcional)" hint="Útil para gerar fatura detalhada por categoria/cartão">
              <select value={form.cartaoId || ""} onChange={e => setForm({ ...form, cartaoId: e.target.value || null })}>
                <option value="">Nenhum · pago direto da conta</option>
                {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Field>
          )}
          <Field label="Observações (opcional)" hint="Notas livres — número do comprovante, contexto, etc.">
            <textarea value={form.obs || ""} onChange={e => setForm({ ...form, obs: e.target.value })}
                      rows={2} placeholder="Notas, número do comprovante, parcelado em…"
                      style={{ resize: "vertical", minHeight: 60, fontFamily: T.body, fontSize: 15 }} />
          </Field>
          <Field label="Comprovante (opcional)" hint="Foto ou PDF — máximo 500 KB. Fica salvo junto da transação.">
            {form.comprovante ? (
              <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, padding: 10, display: "flex", alignItems: "center", gap: 10 }}>
                {form.comprovante.type?.startsWith("image/") ? (
                  <img src={form.comprovante.dataUrl} alt={form.comprovante.name}
                       style={{ width: 48, height: 48, objectFit: "cover", border: `1px solid ${T.border}` }} />
                ) : (
                  <div style={{ width: 48, height: 48, background: `${T.gold}22`, color: T.gold, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.sans, fontSize: 11, fontWeight: 700 }}>PDF</div>
                )}
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13, color: T.ink, fontWeight: 500 }} className="truncate">{form.comprovante.name}</div>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: T.sans }}>{Math.round((form.comprovante.size || 0) / 1024)} KB</div>
                </div>
                <button type="button" onClick={() => setForm({ ...form, comprovante: null })}
                        aria-label="Remover comprovante"
                        style={{ background: "transparent", color: T.red, border: `1px solid ${T.red}`, padding: "4px 10px", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer" }}>
                  Remover
                </button>
              </div>
            ) : (
              <input type="file" accept="image/*,application/pdf"
                     onChange={async e => {
                       const file = e.target.files?.[0];
                       if (!file) return;
                       if (file.size > 500 * 1024) {
                         toast.error("Arquivo muito grande. Máximo: 500 KB.");
                         e.target.value = "";
                         return;
                       }
                       const dataUrl = await new Promise((res, rej) => {
                         const r = new FileReader();
                         r.onload = () => res(r.result);
                         r.onerror = () => rej(r.error);
                         r.readAsDataURL(file);
                       });
                       setForm({
                         ...form,
                         comprovante: { type: file.type, name: file.name, size: file.size, dataUrl },
                       });
                       e.target.value = "";
                     }}
                     style={{ fontSize: 13 }} />
            )}
          </Field>
          <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, padding: 14, marginTop: 8, marginBottom: 8 }}>
            <div className="label-eyebrow mb-3">Tipo de despesa</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: false, l: "Variável", desc: "Esporádica, sem dia fixo", icon: Activity },
                { v: true,  l: "Fixa",     desc: "Recorrente, vencimento mensal", icon: Repeat },
              ].map(opt => {
                const Icon = opt.icon;
                const active = !!form.fixa === opt.v;
                return (
                  <button key={String(opt.v)} type="button"
                    onClick={() => setForm({ ...form, fixa: opt.v, vencimento: opt.v ? (form.vencimento || 5) : null })}
                    style={{
                      padding: 12, textAlign: "left",
                      border: `1px solid ${active ? T.gold : T.border}`,
                      borderWidth: active ? 2 : 1,
                      background: active ? `${T.gold}1a` : T.bg,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                    }}>
                    <Icon size={16} style={{ color: active ? T.gold : T.muted, flexShrink: 0 }} />
                    <div>
                      <div style={{ color: active ? T.gold : T.ink, fontWeight: 500, fontSize: 14 }}>{opt.l}</div>
                      <div style={{ color: T.muted, fontSize: 11 }}>{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {form.fixa && (
              <div className="mt-3">
                <div className="label-eyebrow mb-2">Dia do vencimento</div>
                <input type="number" min="1" max="31" value={form.vencimento || ""}
                       onChange={e => setForm({ ...form, vencimento: parseInt(e.target.value) || null })}
                       placeholder="Ex.: 5 (vence dia 5 de cada mês)" />
              </div>
            )}
          </div>
          <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, padding: 14, marginTop: 8, marginBottom: 8 }}>
            <div className="label-eyebrow mb-3">Controle de compensação</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: true,  l: "Compensada", desc: "Já lançada na conta", cor: T.green, icon: CheckCircle2 },
                { v: false, l: "Pendente",   desc: "Aguardando lançamento", cor: T.gold,  icon: AlertCircle },
              ].map(opt => {
                const Icon = opt.icon;
                const active = !!form.compensado === opt.v;
                return (
                  <button key={String(opt.v)} type="button"
                    onClick={() => setForm({ ...form, compensado: opt.v })}
                    style={{
                      padding: 12, textAlign: "left",
                      border: `1px solid ${active ? opt.cor : T.border}`,
                      borderWidth: active ? 2 : 1,
                      background: active ? `${opt.cor}1a` : T.bg,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                    }}>
                    <Icon size={18} style={{ color: active ? opt.cor : T.muted, flexShrink: 0 }} />
                    <div>
                      <div style={{ color: active ? opt.cor : T.ink, fontWeight: 500, fontSize: 14 }}>{opt.l}</div>
                      <div style={{ color: T.muted, fontSize: 11 }}>{opt.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {!form.compensado && (
              <div style={{ color: T.muted, fontSize: 12, marginTop: 8, fontStyle: "italic" }}>
                Pendentes não alteram o saldo da conta até serem marcadas como compensadas.
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={save}>Salvar</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}

      {ieOpen && (
        <ImportExportModal
          onClose={() => setIeOpen(false)}
          transacoes={transacoes} setTransacoes={setTransacoes}
          contas={contas} setContas={setContas}
          categorias={categorias} ativos={ativos} totais={totais}
          parcelamentos={parcelamentos} cartoes={cartoes}
        />
      )}

      {ocrOpen && (
        <OCRComprovante
          contas={contas} categorias={categorias}
          transacoes={transacoes} setTransacoes={setTransacoes}
          onClose={() => setOcrOpen(false)}
        />
      )}

      {voiceOpen && (
        <VoiceTransacao
          contas={contas} categorias={categorias}
          transacoes={transacoes} setTransacoes={setTransacoes}
          onClose={() => setVoiceOpen(false)}
        />
      )}

      {comprovanteVisualizar && (
        <div role="dialog" aria-modal="true" aria-label="Visualizar comprovante"
             className="comprovante-modal"
             onClick={() => setComprovanteVisualizar(null)}
             style={{
               position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
               zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
               padding: 20,
             }}>
          <button onClick={() => setComprovanteVisualizar(null)}
                  aria-label="Fechar visualização"
                  style={{
                    position: "absolute", top: 20, right: 20,
                    background: "rgba(255,255,255,0.1)", color: "#fff",
                    border: "1px solid rgba(255,255,255,0.3)",
                    padding: 10, cursor: "pointer", zIndex: 2,
                    minWidth: 44, minHeight: 44,
                    display: "grid", placeItems: "center",
                  }}>
            <X size={20} />
          </button>
          <div onClick={e => e.stopPropagation()}
               className="comprovante-modal-content"
               style={{ maxWidth: "90vw", maxHeight: "90vh", overflow: "auto", background: "#fff", padding: 16, position: "relative" }}>
            {comprovanteVisualizar.type?.startsWith("image/") ? (
              <img src={comprovanteVisualizar.dataUrl} alt={comprovanteVisualizar.name}
                   style={{ maxWidth: "100%", maxHeight: "85vh", display: "block" }} />
            ) : (
              <iframe src={comprovanteVisualizar.dataUrl}
                      title={comprovanteVisualizar.name}
                      className="comprovante-modal-iframe"
                      style={{ width: "80vw", height: "80vh", border: "none" }} />
            )}
            <div style={{ marginTop: 10, fontSize: 12, color: "#666", fontFamily: T.sans, letterSpacing: "0.05em" }}>
              {comprovanteVisualizar.name} · {Math.round((comprovanteVisualizar.size || 0) / 1024)} KB
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ================================================================
   TabelaMensal — visão alternativa: tabs por mês + tabela
   ================================================================ */
const MESES_NOMES = MESES_CURTO;

function TabelaMensal({ transacoes, hidden, onEdit }) {
  const hojeISO = new Date().toISOString().slice(0, 10);
  const anoAtual = parseInt(hojeISO.slice(0, 4), 10);
  const mesAtualIdx = parseInt(hojeISO.slice(5, 7), 10) - 1;

  // Lista de meses com transações no ano atual
  const mesesComTx = (() => {
    const set = new Set();
    transacoes.forEach(t => {
      if (t.data && t.data.startsWith(`${anoAtual}-`)) {
        set.add(parseInt(t.data.slice(5, 7), 10) - 1);
      }
    });
    set.add(mesAtualIdx);
    return [...set].sort((a, b) => a - b);
  })();

  const [mesAtivo, setMesAtivo] = useState(mesAtualIdx);
  const mesISO = `${anoAtual}-${String(mesAtivo + 1).padStart(2, "0")}`;
  const txMes = transacoes
    .filter(t => (t.data || "").startsWith(mesISO))
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  const total = txMes.reduce((s, t) => s + (t.tipo === "receita" ? Number(t.valor || 0) : -Number(t.valor || 0)), 0);

  const statusDe = (t) => {
    const isReceita = t.tipo === "receita";
    if (t.compensado) return { label: isReceita ? "Recebido" : "Pago", cor: T.green };
    const data = t.data;
    if (data && data <= hojeISO) return { label: "Atrasado", cor: T.red };
    return { label: "Pendente", cor: T.gold };
  };

  return (
    <div>
      {/* Tabs por mês */}
      <div style={{
        display: "flex", gap: 4, padding: "12px 12px 0", overflowX: "auto",
      }}>
        {mesesComTx.map(idx => {
          const ativo = idx === mesAtivo;
          const isCorrente = idx === mesAtualIdx;
          return (
            <button key={idx} onClick={() => setMesAtivo(idx)}
              style={{
                padding: "7px 12px", fontSize: 11.5, letterSpacing: ".05em",
                background: ativo ? T.gold : "transparent",
                color: ativo ? T.bg : T.muted,
                border: `1px solid ${ativo ? T.gold : T.border}`,
                borderRadius: 11, cursor: "pointer", whiteSpace: "nowrap",
                fontWeight: ativo ? 600 : 500, textTransform: "uppercase",
              }}>
              {isCorrente && "★ "}{MESES_NOMES[idx]}
            </button>
          );
        })}
      </div>

      {txMes.length === 0 ? (
        <div className="p-12 text-center" style={{ color: T.muted, fontStyle: "italic" }}>
          Nenhuma transação em {MESES_NOMES[mesAtivo]}/{anoAtual}.
        </div>
      ) : (
        <div style={{ overflowX: "auto", padding: 12 }}>
          <table className="tbl" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 480 }}>
            <thead>
              <tr style={{ background: T.bgSoft }}>
                <th style={thMensal}>Descrição</th>
                <th style={{ ...thMensal, textAlign: "right" }}>Valor</th>
                <th style={thMensal} className="hidden sm:table-cell">Data</th>
                <th style={{ ...thMensal, textAlign: "center" }} className="hidden md:table-cell">Status</th>
                <th style={{ ...thMensal, textAlign: "center" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {txMes.map(t => {
                const st = statusDe(t);
                const isReceita = t.tipo === "receita";
                return (
                  <tr key={t.id} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={tdMensal}>
                      <div style={{ color: T.ink, fontWeight: 500 }}>{t.descricao}</div>
                      {t.categoria && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>{t.categoria}</div>}
                    </td>
                    <td className="num" style={{
                      ...tdMensal, textAlign: "right",
                      color: isReceita ? T.green : T.red, fontWeight: 600,
                    }}>
                      {isReceita ? "+ " : "− "}{hidden ? "•••" : fmt(t.valor)}
                    </td>
                    <td className="hidden sm:table-cell" style={{ ...tdMensal, color: T.muted, whiteSpace: "nowrap" }}>
                      {(t.data || "").slice(8, 10)}/{(t.data || "").slice(5, 7)}
                    </td>
                    <td className="hidden md:table-cell" style={{ ...tdMensal, textAlign: "center" }}>
                      <span style={{
                        fontSize: 9.5, padding: "2px 8px", borderRadius: 100,
                        background: `${st.cor}22`, color: st.cor,
                        letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600,
                      }}>{st.label}</span>
                    </td>
                    <td style={{ ...tdMensal, textAlign: "center" }}>
                      <button onClick={() => onEdit(t)}
                        style={{
                          background: "transparent", color: T.muted,
                          border: `1px solid ${T.border}`, borderRadius: 5,
                          padding: "4px 9px", fontSize: 10, cursor: "pointer",
                        }}>Editar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: T.bgSoft, borderTop: `2px solid ${T.border}` }}>
                <td style={{ ...tdMensal, fontWeight: 600 }}>
                  Total ({txMes.length} {txMes.length === 1 ? "transação" : "transações"})
                </td>
                <td className="num" style={{
                  ...tdMensal, textAlign: "right", fontWeight: 700,
                  color: total >= 0 ? T.green : T.red,
                }}>
                  {hidden ? "•••" : fmt(total)}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

const thMensal = {
  padding: "10px 12px", textAlign: "left",
  fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase",
  color: "var(--tm)", fontWeight: 500,
};
const tdMensal = { padding: "11px 12px", verticalAlign: "middle" };
