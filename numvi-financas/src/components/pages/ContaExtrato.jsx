import React, { useState, useMemo, useEffect, useRef } from "react";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Plus, ArrowRightLeft, Search, Printer, ArrowUp, ArrowDown, Edit3, Trash2 } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt } from "../../lib/format.js";
import { confirm } from "../../lib/confirm.js";
import { toast } from "../../lib/toast.js";
import { reconciliarContas } from "../../lib/saldoConta.js";
import NovaTransacaoModal from "../modals/NovaTransacaoModal.jsx";

/**
 * Extrato detalhado de uma conta bancária.
 * Tabela com colunas Data · Descrição · Obs · Categoria · Valor · Saldo · Ações.
 * Coluna Data é clicável e alterna entre desc (mais novo primeiro) e asc.
 */
export default function ContaExtrato({ conta, contas = [], setContas, transacoes = [], setTransacoes, categorias = [], hidden, onVoltar, onTransferir, embutido = false }) {
  const [periodo, setPeriodo] = useState("mes"); // mes | 3meses | tudo
  const [tipo, setTipo] = useState("todos"); // todos | receita | despesa
  const [busca, setBusca] = useState("");
  const [sortDir, setSortDir] = useState("desc"); // desc = mais novo primeiro (default)
  const [statusFilter, setStatusFilter] = useState("todas"); // todas | compensadas | pendentes
  const [editCatId, setEditCatId] = useState(null); // id da transação com select de categoria aberto
  const [txModal, setTxModal] = useState(null); // null | { modo: "novo" } | { modo: "editar", tx }
  // Override manual do estado de cada dia. Padrão: só o ÚLTIMO dia de movimento
  // (mais recente) fica aberto; os demais recolhidos. { [dia]: true=aberto }.
  const [diasOverride, setDiasOverride] = useState({});
  const toggleDia = (dia, abertoPadrao) =>
    setDiasOverride(prev => ({ ...prev, [dia]: !(dia in prev ? prev[dia] : abertoPadrao) }));

  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  // Transações desta conta
  const transacoesDaConta = useMemo(() => {
    return transacoes.filter(t => t.conta === conta.nome);
  }, [transacoes, conta]);

  // Saldo "verdadeiro" = saldoInicial (se houver) + transações compensadas.
  // Se a conta NÃO tem saldoInicial, o próprio conta.saldo é a referência.
  const saldoVerdadeiro = useMemo(() => {
    const compensadas = transacoesDaConta.filter(t => t.compensado);
    const somaTx = compensadas.reduce(
      (s, t) => s + (t.tipo === "receita" ? Number(t.valor) || 0 : -(Number(t.valor) || 0)), 0
    );
    if (conta.saldoInicial != null) return (Number(conta.saldoInicial) || 0) + somaTx;
    return Number(conta.saldo) || 0;
  }, [transacoesDaConta, conta.saldoInicial, conta.saldo]);

  // Drift entre o saldo guardado (cache) e o verdadeiro. Se houver, o banner
  // mostra o verdadeiro e a gente corrige o cache (uma vez por sessão da tela).
  const driftSaldo = +(saldoVerdadeiro - (Number(conta.saldo) || 0)).toFixed(2);
  const saldoExibido = Math.abs(driftSaldo) > 0.005 ? saldoVerdadeiro : (Number(conta.saldo) || 0);

  const autoReconciliado = useRef(false);
  useEffect(() => {
    if (autoReconciliado.current) return;
    if (Math.abs(driftSaldo) <= 0.005) return;
    if (!setContas) return;
    autoReconciliado.current = true;
    const backup = contas;
    const { contas: novaLista, mudancas } = reconciliarContas(contas, transacoes || []);
    if (mudancas.length === 0) return;
    setContas(novaLista);
    toast.success(
      `Saldo de ${conta.nome} corrigido: ${driftSaldo > 0 ? "+" : ""}${fmt(driftSaldo)} (agora bate com os lançamentos).`,
      { action: { label: "Desfazer", onClick: () => setContas(backup) } }
    );
  }, [driftSaldo, contas, transacoes, setContas, conta.nome]);

  // Aplica filtros
  const filtradas = useMemo(() => {
    let arr = [...transacoesDaConta];

    if (periodo === "mes") {
      arr = arr.filter(t => (t.data || "").startsWith(mesAtual));
    } else if (periodo === "3meses") {
      const limite = new Date();
      limite.setMonth(limite.getMonth() - 3);
      arr = arr.filter(t => new Date(t.data) >= limite);
    }

    if (tipo !== "todos") arr = arr.filter(t => t.tipo === tipo);

    if (statusFilter === "compensadas") arr = arr.filter(t => !!t.compensado);
    else if (statusFilter === "pendentes") arr = arr.filter(t => !t.compensado);

    if (busca.trim()) {
      const q = busca.toLowerCase();
      arr = arr.filter(t =>
        (t.descricao || "").toLowerCase().includes(q) ||
        (t.obs || "").toLowerCase().includes(q) ||
        (t.categoria || "").toLowerCase().includes(q)
      );
    }

    // Sort estável usando data + id como tie-breaker (mesma chave do saldoPorTransacao
    // pra que a coluna "Saldo" seja coerente com a ordem visual)
    return arr.sort((a, b) => {
      const ka = `${a.data || ""}::${a.id || ""}`;
      const kb = `${b.data || ""}::${b.id || ""}`;
      const cmp = ka.localeCompare(kb);
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [transacoesDaConta, periodo, tipo, busca, mesAtual, sortDir, statusFilter]);

  const trocarCategoria = (t, novaCat) => {
    setTransacoes?.((prev) => prev.map(x => x.id === t.id ? { ...x, categoria: novaCat } : x));
    setEditCatId(null);
    toast.success(`Categoria atualizada para "${novaCat}".`);
  };

  const removerTransacao = async (t) => {
    const ok = await confirm({
      title: `Excluir "${t.descricao}"?`,
      body: `Vai apagar essa transação de ${fmt(t.valor)} do dia ${t.data}.`,
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    const backup = transacoes;
    setTransacoes?.((prev) => prev.filter(x => x.id !== t.id));
    toast.success(`"${t.descricao}" removida.`, {
      action: {
        label: "Desfazer",
        onClick: () => setTransacoes?.(backup),
      },
    });
  };

  const editarTransacao = (t) => {
    setTxModal({ modo: "editar", tx: t });
  };

  /**
   * Saldo acumulado por transação.
   *
   * O saldo atual da conta (conta.saldo) reflete TODAS as transações compensadas
   * já aplicadas. Para reconstruir o "saldo após cada lançamento":
   *
   * 1) Ordenar TODAS as transações compensadas da conta, da mais NOVA pra mais ANTIGA.
   * 2) Saldo após a mais nova = conta.saldo
   * 3) Saldo após a próxima (mais antiga) = saldo_da_anterior − impacto_da_anterior
   *
   * Transações PENDENTES não entram na conta (não afetam saldo real).
   */
  // Chave de ordenação estável: data + id (id como tie-breaker pra desempatar
  // transações no mesmo dia). Crucial pra que a coluna "Saldo" reflita uma
  // ordem cronológica coerente E coincida com a ordem visual da tabela.
  const tieKey = (t) => `${t.data || ""}::${t.id || ""}`;

  const saldoPorTransacao = useMemo(() => {
    const map = new Map();
    const compensadasAsc = transacoesDaConta
      .filter(t => t.compensado)
      .sort((a, b) => tieKey(a).localeCompare(tieKey(b))); // antigo → novo (estável)

    // Se a conta tem saldoInicial definido, calcula do mais antigo pro mais novo:
    //   saldo[n] = saldo[n-1] + (tipo === "receita" ? +valor : -valor)
    // Senão, fallback: usa conta.saldo como saldo final e volta no tempo.
    if (conta.saldoInicial != null) {
      let saldoAcum = parseFloat(conta.saldoInicial) || 0;
      for (const t of compensadasAsc) {
        const v = parseFloat(t.valor) || 0;
        const impacto = t.tipo === "receita" ? v : -v;
        saldoAcum += impacto;
        map.set(t.id, saldoAcum);
      }
    } else {
      // Fallback antigo: conta.saldo é o saldo atual; voltamos no tempo.
      let saldoAcum = parseFloat(conta.saldo) || 0;
      const compensadasDesc = [...compensadasAsc].reverse();
      for (const t of compensadasDesc) {
        map.set(t.id, saldoAcum);
        const v = parseFloat(t.valor) || 0;
        const impacto = t.tipo === "receita" ? v : -v;
        saldoAcum -= impacto;
      }
    }
    return map;
  }, [transacoesDaConta, conta.saldo, conta.saldoInicial]);

  // KPIs do mês
  const kpisMes = useMemo(() => {
    const noMes = transacoesDaConta.filter(t => (t.data || "").startsWith(mesAtual));
    const entradas = noMes.filter(t => t.tipo === "receita" && t.compensado).reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const saidas = noMes.filter(t => t.tipo === "despesa" && t.compensado).reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const pendReceitas = noMes.filter(t => t.tipo === "receita" && !t.compensado).reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const pendDespesas = noMes.filter(t => t.tipo === "despesa" && !t.compensado).reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const saldoPrev = saldoVerdadeiro + pendReceitas - pendDespesas;
    return { entradas, saidas, pendReceitas, pendDespesas, saldoPrev };
  }, [transacoesDaConta, conta, mesAtual, saldoVerdadeiro]);

  // Gradiente estilo cartão, por banco/instituição (mesma identidade visual dos Cartões).
  const gradient = gradByName(conta.instituicao || conta.nome, conta.cor);

  return (
    <div className="fade-up py-8 px-6">
      {/* Voltar — escondido no modo embutido (lista fica ao lado) */}
      {!embutido && (
        <button onClick={onVoltar}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 12px", borderRadius: 7,
                  background: "transparent", border: `1px solid ${T.border}`,
                  color: T.muted, fontSize: 11, cursor: "pointer", marginBottom: 14,
                  letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 500,
                }}>
          <ArrowLeft size={13} /> Voltar para contas
        </button>
      )}

      {/* Banner estilo cartão: gradiente por banco + nome + saldo */}
      <div className="conta-hero" style={{
        display: "flex", alignItems: "center", gap: 18, padding: 24,
        background: gradient, borderRadius: 14, marginBottom: 14,
        color: "#fff", flexWrap: "wrap",
        boxShadow: `0 6px 20px ${T.bg}66`,
      }}>
        <div className="conta-hero-icon" style={{
          width: 56, height: 56, borderRadius: 12,
          display: "grid", placeItems: "center", fontSize: 28, flexShrink: 0,
          background: "rgba(0,0,0,.2)",
        }}>🏦</div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: "rgba(255,255,255,.8)", fontWeight: 600 }}>
            Extrato · {conta.instituicao}{conta.tipo ? ` · ${conta.tipo}` : ""}
          </div>
          <div className="conta-hero-name" style={{ fontFamily: T.serif, fontWeight: 500, marginTop: 5, letterSpacing: "-0.02em", wordBreak: "break-word" }}>
            {conta.nome}
          </div>
        </div>
        <div className="conta-hero-fatura" style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,.7)", letterSpacing: ".15em", textTransform: "uppercase", marginBottom: 4 }}>
            Saldo atual
          </div>
          <div className="num conta-hero-valor" style={{ fontFamily: T.serif, fontWeight: 300, lineHeight: 1, fontVariantNumeric: "tabular-nums", wordBreak: "break-word" }}>
            {hidden ? "R$ •••••" : fmt(saldoExibido)}
          </div>
        </div>
        <style>{`
          .conta-hero-name { font-size: 23px; }
          .conta-hero-valor { font-size: 32px; }
          @media (max-width: 560px) {
            .conta-hero { padding: 18px !important; gap: 14px !important; }
            .conta-hero-icon { width: 46px !important; height: 46px !important; font-size: 22px !important; }
            .conta-hero-name { font-size: 19px !important; }
            .conta-hero-fatura { text-align: left !important; width: 100%; }
            .conta-hero-valor { font-size: clamp(26px, 8vw, 32px) !important; }
            .extrato-filtros { grid-template-columns: 1fr 1fr !important; }
            .extrato-filtros > div[style*="position: relative"] { grid-column: 1 / -1; }
            .extrato-filtros > button { grid-column: 1 / -1; }
          }
        `}</style>
      </div>

      {/* KPIs do mês + ações */}
      <div style={{
        display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end",
        marginBottom: 16, padding: "0 2px",
      }}>
        <KPI l="Entradas (mês)" v={hidden ? "•••" : `+ ${fmt(kpisMes.entradas)}`} c={T.green} />
        <KPI l="Saídas (mês)"   v={hidden ? "•••" : `− ${fmt(kpisMes.saidas)}`}   c={T.red} />
        <KPI l="Saldo previsto fim do mês" v={hidden ? "•••" : fmt(kpisMes.saldoPrev)} c={T.gold} />

        <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setTxModal({ modo: "novo" })}
                  style={{
                    background: `${conta.cor || T.gold}22`, color: conta.cor || T.gold,
                    border: `1px solid ${conta.cor || T.gold}`, padding: "8px 12px",
                    fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase",
                    fontWeight: 600, cursor: "pointer", borderRadius: 7,
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
            <Plus size={11} /> Nova transação
          </button>
          {onTransferir && (
            <button onClick={onTransferir}
                    style={{
                      background: "transparent", color: T.gold,
                      border: `1px solid ${T.gold}`, padding: "8px 12px",
                      fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase",
                      fontWeight: 600, cursor: "pointer", borderRadius: 7,
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
              <ArrowRightLeft size={11} /> Transferir
            </button>
          )}
          <button onClick={() => window.print()}
                  title="Imprimir ou salvar como PDF"
                  style={{
                    background: "transparent", color: T.muted,
                    border: `1px solid ${T.border}`, padding: "8px 12px",
                    fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase",
                    fontWeight: 600, cursor: "pointer", borderRadius: 7,
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
            <Printer size={11} /> PDF
          </button>
        </div>
      </div>

      {/* Filtros — uma linha em desktop, colapsa em mobile */}
      <div className="extrato-filtros" style={{
        display: "grid",
        gridTemplateColumns: "minmax(160px, 0.8fr) minmax(140px, 0.7fr) minmax(220px, 1.4fr) auto",
        gap: 8, marginBottom: 8, alignItems: "center",
      }}>
        <select value={periodo} onChange={e => setPeriodo(e.target.value)}
                style={{ padding: "8px 11px", background: T.bgSoft, border: `1px solid ${T.border}`, color: T.ink, fontSize: 12, borderRadius: 6 }}>
          <option value="mes">Período · este mês</option>
          <option value="3meses">Período · últimos 3 meses</option>
          <option value="tudo">Período · tudo</option>
        </select>
        <select value={tipo} onChange={e => setTipo(e.target.value)}
                style={{ padding: "8px 11px", background: T.bgSoft, border: `1px solid ${T.border}`, color: T.ink, fontSize: 12, borderRadius: 6 }}>
          <option value="todos">Tipo · todos</option>
          <option value="receita">Tipo · receitas</option>
          <option value="despesa">Tipo · despesas</option>
        </select>
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
          <input
            value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar descrição, observação, categoria…"
            style={{ width: "100%", padding: "8px 11px 8px 32px", background: T.bgSoft, border: `1px solid ${T.border}`, color: T.ink, fontSize: 12, borderRadius: 6 }}
          />
        </div>
        <div style={{ fontSize: 11, color: T.muted, letterSpacing: ".05em", whiteSpace: "nowrap" }}>
          {filtradas.length} {filtradas.length === 1 ? "lançamento" : "lançamentos"}
        </div>
      </div>

      {/* Chips de Status */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 10, color: T.muted, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", marginRight: 4 }}>
          Status:
        </span>
        {[
          { id: "todas", label: "Todas" },
          { id: "compensadas", label: "✓ Compensadas" },
          { id: "pendentes", label: "○ Pendentes" },
        ].map(opt => {
          const active = statusFilter === opt.id;
          return (
            <button key={opt.id} onClick={() => setStatusFilter(opt.id)}
              style={{
                padding: "5px 11px", borderRadius: 100, fontSize: 11, fontWeight: 500,
                background: active ? `${T.gold}22` : T.bgSoft,
                color: active ? T.gold : T.muted,
                border: `1px solid ${active ? T.gold : T.border}`,
                cursor: "pointer", whiteSpace: "nowrap",
                transition: "all .15s",
              }}>
              {opt.label}
            </button>
          );
        })}
        <button onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
                title="Alternar ordem por data"
                style={{
                  marginLeft: "auto", padding: "5px 11px", borderRadius: 100, fontSize: 11,
                  background: T.bgSoft, color: T.muted, border: `1px solid ${T.border}`,
                  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                }}>
          {sortDir === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
          {sortDir === "desc" ? "Mais recentes" : "Mais antigos"}
        </button>
        {(() => {
          const dias = agruparPorDia(filtradas).map(g => g.dia);
          const ultimoDia = dias.reduce((max, d) => (d > max ? d : max), dias[0] || "");
          const estaAberto = (d) => (d in diasOverride ? diasOverride[d] : d === ultimoDia);
          const todosRecolhidos = dias.length > 0 && dias.every(d => !estaAberto(d));
          const setTodos = (aberto) => {
            const o = {}; dias.forEach(d => { o[d] = aberto; }); setDiasOverride(o);
          };
          return (
            <button onClick={() => setTodos(todosRecolhidos)}
                    title="Recolher ou expandir todos os dias"
                    style={{
                      padding: "5px 11px", borderRadius: 100, fontSize: 11,
                      background: T.bgSoft, color: T.muted, border: `1px solid ${T.border}`,
                      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                    }}>
              {todosRecolhidos ? "Expandir dias" : "Recolher dias"}
            </button>
          );
        })()}
      </div>

      {/* Lista de transações — agrupada por dia, formato lista (responsivo) */}
      {filtradas.length === 0 ? (
        <div style={{
          padding: 60, textAlign: "center", color: T.muted, fontStyle: "italic",
          border: `1px dashed ${T.border}`, borderRadius: 10, background: T.card,
        }}>
          Nenhum lançamento {busca ? `para "${busca}"` : "no período selecionado"}.
        </div>
      ) : (
        <div className="extrato-lista" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden", boxShadow: `0 1px 3px ${T.bg}55` }}>
          <style>{`
            .extrato-row { transition: background .12s ease; }
            .extrato-row:hover { background: ${T.gold}10; }
            .extrato-row .acoes { opacity: 0; transition: opacity .12s ease; }
            .extrato-row:hover .acoes { opacity: 1; }
            @media (hover: none) { .extrato-row .acoes { opacity: 1; } }
          `}</style>
          {(() => {
            const grupos = agruparPorDia(filtradas);
            // Dia mais recente de movimento (independe da ordenação) → aberto por padrão.
            const ultimoDia = grupos.reduce((max, g) => (g.dia > max ? g.dia : max), grupos[0]?.dia || "");
            return grupos.map(grupo => {
            const net = grupo.itens.reduce((s, t) => s + (t.tipo === "receita" ? 1 : -1) * (parseFloat(t.valor) || 0), 0);
            const dl = fmtDataLonga(grupo.dia);
            const abertoPadrao = grupo.dia === ultimoDia; // só o último dia abre por padrão
            const aberto = grupo.dia in diasOverride ? diasOverride[grupo.dia] : abertoPadrao;
            const recolhido = !aberto;
            return (
              <div key={grupo.dia}>
                {/* Cabeçalho do dia (clicável: recolhe/expande os lançamentos) */}
                <div onClick={() => toggleDia(grupo.dia, abertoPadrao)} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "8px 14px", background: T.bgSoft, borderBottom: `1px solid ${T.border}`,
                  cursor: "pointer",
                }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: T.muted, display: "inline-block", transform: recolhido ? "none" : "rotate(90deg)", transition: "transform .15s" }}>▸</span>
                    <span className="num" style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{dl.dia}</span>
                    <span style={{ fontSize: 11, color: T.muted }}>{dl.mes} '{dl.ano}</span>
                    <span style={{ fontSize: 10.5, color: T.faint, textTransform: "capitalize" }}>· {dl.semana}</span>
                    <span style={{ fontSize: 10.5, color: T.faint }}>· {grupo.itens.length} {grupo.itens.length === 1 ? "lançamento" : "lançamentos"}</span>
                  </span>
                  <span className="num" style={{ fontSize: 11, fontWeight: 600, color: net >= 0 ? T.green : T.red }}>
                    {hidden ? "•••" : `${net >= 0 ? "+ " : "− "}${fmt(Math.abs(net))}`}
                  </span>
                </div>

                {/* Lançamentos do dia (escondidos quando recolhido) */}
                {!recolhido && grupo.itens.map(t => {
                  const cat = categorias.find(c => c.nome === t.categoria);
                  const saldoApos = saldoPorTransacao.get(t.id);
                  const corTipo = t.tipo === "receita" ? T.green : T.red;
                  return (
                    <div key={t.id} className="extrato-row" style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", borderBottom: `1px solid ${T.border}`,
                      opacity: t.compensado ? 1 : 0.7,
                    }}>
                      {/* Ícone entrada/saída */}
                      <span style={{
                        width: 30, height: 30, borderRadius: "50%",
                        background: `${corTipo}1c`, color: corTipo,
                        display: "grid", placeItems: "center", flexShrink: 0,
                      }}>
                        {t.tipo === "receita" ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                      </span>

                      {/* Descrição + obs + categoria */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ color: T.ink, fontWeight: 600, fontSize: 13 }}>{t.descricao}</span>
                          {!t.compensado && (
                            <span style={{ fontSize: 8.5, padding: "1px 5px", borderRadius: 3, background: `${T.gold}22`, color: T.gold, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>Pendente</span>
                          )}
                          {t.fixa && t.compensado && (
                            <span style={{ fontSize: 8.5, padding: "1px 5px", borderRadius: 3, background: `${T.blue || "#60a5fa"}22`, color: T.blue || "#60a5fa", fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>Fixa</span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                          {/* Chip de categoria (clicável pra editar) */}
                          {editCatId === t.id ? (
                            <select
                              autoFocus
                              value={t.categoria || ""}
                              onChange={e => trocarCategoria(t, e.target.value)}
                              onBlur={() => setEditCatId(null)}
                              style={{
                                background: T.bgSoft, border: `1px solid ${T.gold}`,
                                color: T.ink, fontSize: 11, padding: "3px 7px", borderRadius: 5, maxWidth: 180,
                              }}>
                              <option value="">— sem categoria —</option>
                              {categorias.filter(c => c.tipo === t.tipo).map(c => (
                                <option key={c.id} value={c.nome}>{c.nome}</option>
                              ))}
                            </select>
                          ) : (
                            <button
                              onClick={() => setEditCatId(t.id)}
                              title="Clique para mudar a categoria"
                              style={{
                                background: cat ? `${cat.cor || T.muted}1a` : "transparent",
                                border: cat ? `1px solid ${cat.cor || T.border}55` : `1px dashed ${T.border}`,
                                padding: "2px 8px", borderRadius: 100, cursor: "pointer",
                                display: "inline-flex", alignItems: "center", gap: 5,
                                fontSize: 10.5, fontWeight: 600, color: cat ? (cat.cor || T.muted) : T.faint,
                              }}>
                              {cat && <span style={{ width: 7, height: 7, background: cat.cor || T.muted, borderRadius: "50%" }} />}
                              {cat ? cat.nome : "+ categoria"}
                            </button>
                          )}
                        </div>
                        {/* Observação em linha própria — visível e completa */}
                        {t.obs && (
                          <div style={{ fontSize: 11, color: T.muted, marginTop: 3, lineHeight: 1.35, wordBreak: "break-word" }}>
                            {t.obs}
                          </div>
                        )}
                      </div>

                      {/* Valor + saldo */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div className="num" style={{ color: corTipo, fontWeight: 700, fontSize: 14.5 }}>
                          {t.tipo === "receita" ? "+ " : "− "}{hidden ? "•••" : fmt(t.valor)}
                        </div>
                        <div className="num" style={{ fontSize: 10.5, color: T.faint, marginTop: 1 }}
                             title={t.compensado ? "Saldo após esta transação" : "Pendentes não afetam o saldo"}>
                          {!t.compensado ? "pendente" : `saldo ${hidden ? "•••" : fmt(saldoApos ?? 0)}`}
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="acoes" style={{ display: "flex", flexShrink: 0 }}>
                        <button onClick={() => editarTransacao(t)} title="Editar" style={iconBtn}>
                          <Edit3 size={14} />
                        </button>
                        <button onClick={() => removerTransacao(t)} title="Excluir" style={{ ...iconBtn, color: T.red }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
            });
          })()}
        </div>
      )}

      {txModal && (
        <NovaTransacaoModal
          contaFixa={txModal.modo === "novo" ? conta : undefined}
          transacaoEdit={txModal.modo === "editar" ? txModal.tx : undefined}
          contas={contas}
          categorias={categorias}
          transacoes={transacoes}
          setTransacoes={setTransacoes}
          setContas={setContas}
          onClose={() => setTxModal(null)}
        />
      )}
    </div>
  );
}

function KPI({ l, v, c }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, marginBottom: 3 }}>{l}</div>
      <div className="num" style={{ fontSize: 14, color: c, fontWeight: 500 }}>{v}</div>
    </div>
  );
}

// Gradiente do banner por banco/instituição — mesma identidade visual dos Cartões.
function gradByName(nome, fallbackCor) {
  const n = (nome || "").toLowerCase();
  if (n.includes("nubank") || n.includes("nu ")) return "linear-gradient(135deg, #8b5cf6, #06b6d4)";
  if (n.includes("itau") || n.includes("itaú")) return "linear-gradient(135deg, #c9a961, #54545c)";
  if (n.includes("c6"))                          return "linear-gradient(135deg, #f43f5e, #fbbf24)";
  if (n.includes("inter"))                       return "linear-gradient(135deg, #f59e0b, #ea580c)";
  if (n.includes("santander"))                   return "linear-gradient(135deg, #dc2626, #991b1b)";
  if (n.includes("bradesco"))                    return "linear-gradient(135deg, #cc092f, #7a0a1e)";
  if (n.includes("sicred") || n.includes("sicoob")) return "linear-gradient(135deg, #00935f, #3fae6b)";
  if (n.includes("caixa"))                       return "linear-gradient(135deg, #0070b8, #f39200)";
  if (n.includes("banco do brasil") || n.includes(" bb")) return "linear-gradient(135deg, #fae128, #0038a8)";
  if (fallbackCor)                               return `linear-gradient(135deg, ${fallbackCor}, ${fallbackCor})`;
  return `linear-gradient(135deg, ${T.gold}, ${T.goldHi || T.gold})`;
}

// Agrupa a lista (já ordenada) em blocos por dia, preservando a ordem.
function agruparPorDia(lista) {
  const grupos = [];
  let atual = null;
  lista.forEach(t => {
    const dia = (t.data || "").slice(0, 10);
    if (!atual || atual.dia !== dia) { atual = { dia, itens: [] }; grupos.push(atual); }
    atual.itens.push(t);
  });
  return grupos;
}

const MESES_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
function fmtDataLonga(iso) {
  if (!iso || iso.length < 10) return { dia: iso || "—", mes: "", ano: "", semana: "" };
  // Trunca para YYYY-MM-DD caso venha com hora (ex.: "2026-05-28T10:00:00").
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  const semana = isNaN(d.getTime()) ? "" : SEMANA[d.getDay()];
  return { dia, mes: MESES_ABBR[parseInt(mes, 10) - 1] || mes, ano: (ano || "").slice(2), semana };
}

const iconBtn = {
  background: "transparent",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  padding: 6,
  borderRadius: 6,
  marginLeft: 4,
};
