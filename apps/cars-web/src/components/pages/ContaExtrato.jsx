import React, { useState, useMemo } from "react";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Plus, ArrowRightLeft, Search, Printer, ArrowUp, ArrowDown, Edit3, Trash2, TrendingUp, TrendingDown, Wallet, Building2 } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt } from "../../lib/format.js";
import { confirm } from "../../lib/confirm.js";
import { toast } from "../../lib/toast.js";
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

  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  // Transações desta conta
  const transacoesDaConta = useMemo(() => {
    return transacoes.filter(t => t.conta === conta.nome);
  }, [transacoes, conta]);

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
    const saldoPrev = (parseFloat(conta.saldo) || 0) + pendReceitas - pendDespesas;
    return { entradas, saidas, pendReceitas, pendDespesas, saldoPrev };
  }, [transacoesDaConta, conta, mesAtual]);

  // Saldo líquido (receitas − despesas) de cada dia, dentro do filtro atual.
  // Usado nos cabeçalhos de agrupamento por data.
  const netPorDia = useMemo(() => {
    const m = new Map();
    for (const t of filtradas) {
      const v = parseFloat(t.valor) || 0;
      const impacto = t.tipo === "receita" ? v : -v;
      m.set(t.data, (m.get(t.data) || 0) + impacto);
    }
    return m;
  }, [filtradas]);

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

      {/* Header com saldo grande */}
      <div className="conta-hero" style={{
        position: "relative", overflow: "hidden",
        background: `linear-gradient(135deg, ${T.card}, ${T.cardHi || T.card})`,
        border: `1px solid ${T.border}`,
        borderRadius: 14, padding: 24, marginBottom: 16,
        borderTop: `3px solid ${conta.cor || T.gold}`,
      }}>
        {/* glow decorativo na cor da conta */}
        <div aria-hidden style={{
          position: "absolute", top: -80, right: -60, width: 240, height: 240,
          borderRadius: "50%", pointerEvents: "none",
          background: `radial-gradient(circle, ${conta.cor || T.gold}1f, transparent 70%)`,
        }} />

        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            background: `${conta.cor || T.gold}1f`, color: conta.cor || T.gold,
            display: "grid", placeItems: "center", border: `1px solid ${conta.cor || T.gold}40`,
          }}>
            <Building2 size={19} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="label-eyebrow">Extrato · {conta.instituicao} · {conta.tipo}</div>
            <h2 className="conta-hero-name" style={{ fontFamily: T.serif, color: T.ink, marginTop: 2, letterSpacing: "-0.02em" }}>
              {conta.nome}
            </h2>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginTop: 14, position: "relative" }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, marginBottom: 4 }}>Saldo atual</div>
            <div className="num conta-hero-value" style={{ fontFamily: T.serif, color: T.gold, fontWeight: 300, lineHeight: 1, wordBreak: "break-word" }}>
              {hidden ? "R$ •••••" : fmt(conta.saldo)}
            </div>
          </div>
          {!hidden && (() => {
            const net = kpisMes.entradas - kpisMes.saidas;
            const pos = net >= 0;
            return (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 100, marginBottom: 4,
                fontSize: 12, fontWeight: 600,
                background: pos ? `${T.green}1a` : `${T.red}1a`,
                color: pos ? T.green : T.red,
                border: `1px solid ${pos ? T.green : T.red}33`,
              }}>
                {pos ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {pos ? "+ " : "− "}{fmt(Math.abs(net))} <span style={{ color: T.muted, fontWeight: 500 }}>no mês</span>
              </span>
            );
          })()}
        </div>
        <style>{`
          .conta-hero-name { font-size: 26px; }
          .conta-hero-value { font-size: 42px; }
          .extrato-row { transition: background .12s; }
          .extrato-row:hover { background: ${T.bgSoft}; }
          @media (max-width: 480px) {
            .conta-hero { padding: 18px !important; }
            .conta-hero-name { font-size: 20px !important; margin-bottom: 10px !important; }
            .conta-hero-value { font-size: clamp(26px, 8vw, 34px) !important; }
            .extrato-filtros { grid-template-columns: 1fr 1fr !important; }
            .extrato-filtros > div[style*="position: relative"] { grid-column: 1 / -1; }
            .extrato-filtros > button { grid-column: 1 / -1; }
          }
        `}</style>

        <div style={{
          display: "flex", gap: 10, flexWrap: "wrap", alignItems: "stretch",
          marginTop: 18, paddingTop: 18, borderTop: `1px solid ${T.border}`,
        }}>
          <KPI l="Entradas (mês)" v={hidden ? "•••" : `+ ${fmt(kpisMes.entradas)}`} c={T.green} icon={ArrowUpRight} />
          <KPI l="Saídas (mês)"   v={hidden ? "•••" : `− ${fmt(kpisMes.saidas)}`}   c={T.red}   icon={ArrowDownRight} />
          <KPI l="Saldo previsto fim do mês" v={hidden ? "•••" : fmt(kpisMes.saldoPrev)} c={T.gold} icon={Wallet} />

          <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
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
      </div>

      {/* Lista de transações */}
      {filtradas.length === 0 ? (
        <div style={{
          padding: 60, textAlign: "center", color: T.muted, fontStyle: "italic",
          border: `1px dashed ${T.border}`, borderRadius: 10, background: T.card,
        }}>
          Nenhum lançamento {busca ? `para "${busca}"` : "no período selecionado"}.
        </div>
      ) : (
        <div className="tbl-extrato-wrap" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "auto" }}>
          <table className="tbl tbl-extrato" style={{ width: "100%", minWidth: 580, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: T.bgSoft }}>
                <Th onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")} clickable>
                  Data {sortDir === "desc" ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
                </Th>
                <Th>Descrição</Th>
                <Th className="hidden md:table-cell">Obs</Th>
                <Th className="hidden sm:table-cell">Categoria</Th>
                <Th align="right">Valor</Th>
                <Th align="right" className="hidden md:table-cell">Saldo</Th>
                <Th align="right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {filtradas.flatMap((t, i) => {
                const cat = categorias.find(c => c.nome === t.categoria);
                const saldoApos = saldoPorTransacao.get(t.id);
                const novoDia = i === 0 || filtradas[i - 1].data !== t.data;
                const rows = [];

                if (novoDia) {
                  const net = netPorDia.get(t.data) || 0;
                  const pos = net >= 0;
                  rows.push(
                    <tr key={`g-${t.data}`}>
                      <td colSpan={7} style={{
                        padding: "10px 12px 6px",
                        background: T.bgSoft,
                        borderTop: i === 0 ? "none" : `1px solid ${T.border}`,
                        borderBottom: `1px solid ${T.border}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <span style={{
                            fontSize: 11, fontWeight: 600, letterSpacing: ".04em",
                            color: T.muted, textTransform: "capitalize",
                          }}>
                            {fmtDiaGrupo(t.data)}
                          </span>
                          {!hidden && (
                            <span className="num" style={{ fontSize: 11.5, fontWeight: 600, color: pos ? T.green : T.red }}>
                              {pos ? "+ " : "− "}{fmt(Math.abs(net))}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }

                rows.push(
                  <tr key={t.id} className="extrato-row" style={{
                    borderBottom: `1px solid ${T.border}`,
                    opacity: t.compensado ? 1 : 0.65,
                  }}>
                    <td style={tdSty}>
                      <span className="num" style={{ color: T.muted, fontSize: 12, fontWeight: 500 }}>{fmtDiaCurto(t.data)}</span>
                      {!t.compensado && (
                        <div style={{ fontSize: 9, color: T.gold, fontStyle: "italic", marginTop: 2 }}>Pendente</div>
                      )}
                      {t.fixa && t.compensado && (
                        <div style={{ fontSize: 9, color: T.blue || "#60a5fa", fontStyle: "italic", marginTop: 2 }}>Fixa</div>
                      )}
                    </td>
                    <td style={tdSty}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: t.tipo === "receita" ? `${T.green}1a` : `${T.red}1a`,
                          color: t.tipo === "receita" ? T.green : T.red,
                          display: "inline-grid", placeItems: "center", flexShrink: 0,
                        }}>
                          {t.tipo === "receita" ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                        </span>
                        <span style={{ color: T.ink, fontWeight: 500 }}>{t.descricao}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell" style={{ ...tdSty, color: T.muted, fontSize: 11.5, fontStyle: t.obs ? "normal" : "italic" }}>
                      {t.obs || <span style={{ color: T.faint }}>—</span>}
                    </td>
                    <td className="hidden sm:table-cell" style={tdSty}>
                      {editCatId === t.id ? (
                        <select
                          autoFocus
                          value={t.categoria || ""}
                          onChange={e => trocarCategoria(t, e.target.value)}
                          onBlur={() => setEditCatId(null)}
                          style={{
                            background: T.bgSoft, border: `1px solid ${T.gold}`,
                            color: T.ink, fontSize: 11.5, padding: "4px 8px",
                            borderRadius: 4, maxWidth: 180,
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
                            background: cat ? `${cat.cor}14` : "transparent",
                            border: `1px ${cat ? "solid" : "dashed"} ${cat ? `${cat.cor}40` : T.border}`,
                            padding: "3px 9px", borderRadius: 100, cursor: "pointer",
                            display: "inline-flex", alignItems: "center", gap: 6,
                            fontSize: 11.5, fontWeight: 500, color: cat ? T.ink : T.faint,
                            transition: "all .15s", whiteSpace: "nowrap",
                          }}
                          onMouseEnter={e => { e.currentTarget.style.filter = "brightness(1.15)"; }}
                          onMouseLeave={e => { e.currentTarget.style.filter = "none"; }}>
                          {cat ? (
                            <>
                              <span style={{ width: 7, height: 7, background: cat.cor, borderRadius: "50%" }} />
                              {cat.nome}
                            </>
                          ) : "— escolher —"}
                        </button>
                      )}
                    </td>
                    <td className="num" style={{
                      ...tdSty, textAlign: "right",
                      color: t.tipo === "receita" ? T.green : T.red,
                      fontWeight: 600,
                    }}>
                      {t.tipo === "receita" ? "+ " : "− "}{hidden ? "•••" : fmt(t.valor)}
                    </td>
                    <td className="num hidden md:table-cell" style={{
                      ...tdSty, textAlign: "right",
                      color: t.compensado ? (saldoApos != null && saldoApos < 0 ? T.red : T.ink) : T.faint,
                      fontStyle: t.compensado ? "normal" : "italic",
                    }} title={t.compensado ? "Saldo após esta transação" : "Pendentes não afetam o saldo"}>
                      {!t.compensado ? "—" : hidden ? "•••" : fmt(saldoApos ?? 0)}
                    </td>
                    <td style={{ ...tdSty, textAlign: "right" }}>
                      <button onClick={() => editarTransacao(t)}
                              title="Editar"
                              style={iconBtn}>
                        <Edit3 size={14} />
                      </button>
                      <button onClick={() => removerTransacao(t)}
                              title="Excluir"
                              style={{ ...iconBtn, color: T.red }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );

                return rows;
              })}
            </tbody>
          </table>
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

function KPI({ l, v, c, icon: Icon }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 14px", borderRadius: 10,
      background: T.bgSoft, border: `1px solid ${T.border}`,
    }}>
      {Icon && (
        <span style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: `${c}1a`, color: c, display: "grid", placeItems: "center",
        }}>
          <Icon size={15} />
        </span>
      )}
      <div>
        <div style={{ fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, marginBottom: 3 }}>{l}</div>
        <div className="num" style={{ fontSize: 15, color: c, fontWeight: 600 }}>{v}</div>
      </div>
    </div>
  );
}

const tdSty = {
  padding: "9px 12px",
  verticalAlign: "middle",
};

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// "qua, 28 mai 2026" — cabeçalho de grupo por dia
function fmtDiaGrupo(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return `${DIAS_SEMANA[dt.getDay()]}, ${String(d).padStart(2, "0")} ${MESES_CURTOS[(m || 1) - 1]} ${y}`;
}

// "28 mai" — célula da coluna Data
function fmtDiaCurto(iso) {
  if (!iso) return "—";
  const [, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MESES_CURTOS[(m || 1) - 1]}`;
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

function Th({ children, align, style, onClick, clickable, className }) {
  return (
    <th onClick={onClick} className={className} style={{
      padding: "8px 10px",
      textAlign: align || "left",
      fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase",
      color: T.muted, fontWeight: 500,
      borderBottom: `1px solid ${T.border}`,
      cursor: clickable ? "pointer" : "default",
      userSelect: "none",
      ...style,
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {children}
      </span>
    </th>
  );
}
