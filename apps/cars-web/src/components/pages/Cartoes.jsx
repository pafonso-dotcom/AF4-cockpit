import React, { useState, useMemo } from "react";
import { CreditCard, Calendar, TrendingUp, TrendingDown, Plus, Trash2, Edit3, Check, Repeat, ChevronDown, ChevronUp } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, fmtN, uid, todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import { BANK_BRANDS } from "../../data/banks.js";
import PageHeader from "../ui/PageHeader.jsx";
import Field from "../ui/Field.jsx";
import StatCard from "../ui/StatCard.jsx";
import Modal from "../ui/Modal.jsx";

export default function Cartoes({ cartoes, setCartoes, parcelamentos, setParcelamentos, contas, setContas, transacoes, setTransacoes, categorias, hidden, onCartaoClick }) {
  const [form, setForm] = useState(null);
  const [parcForm, setParcForm] = useState(null);
  const [pagFatura, setPagFatura] = useState(null); // { cartaoId, valor, contaNome, data }
  const [pagErrors, setPagErrors] = useState({});

  // Used limit per card from active installments
  const usedByCard = useMemo(() => {
    const map = {};
    parcelamentos.forEach(p => {
      const pagas = p.parcelasPagas?.length || 0;
      const restantes = (p.totalParcelas || 0) - pagas;
      const valorParcela = (p.valorTotal || 0) / (p.totalParcelas || 1);
      const aberto = valorParcela * restantes;
      map[p.cartaoId] = (map[p.cartaoId] || 0) + aberto;
    });
    return map;
  }, [parcelamentos]);

  const totalLimite = cartoes.reduce((s, c) => s + Number(c.limite || 0), 0);
  const totalUsado = Object.values(usedByCard).reduce((s, v) => s + v, 0);

  // Helper: dia que cada parcela cai. Se tem dataPrimeira, soma (N-1) meses; senão usa dataCompra +1 mês
  const dataDaParcela = (p, n) => {
    const base = p.dataPrimeira || p.dataCompra;
    if (!base) return null;
    const [y, m, d] = base.split("-").map(Number);
    const startMonth = p.dataPrimeira ? m : m + 1;
    const dt = new Date(y, startMonth - 1 + (n - 1), d);
    return dt;
  };

  // Fatura por cartão e mês — soma das parcelas que vencem em (ano, mes)
  const faturaPorCartao = useMemo(() => {
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;
    const map = {};
    parcelamentos.forEach(p => {
      if (!p.cartaoId) return;
      const valorParcela = p.valorTotal / p.totalParcelas;
      for (let n = 1; n <= p.totalParcelas; n++) {
        const dt = dataDaParcela(p, n);
        if (!dt) continue;
        if (dt.getFullYear() === curY && dt.getMonth() + 1 === curM) {
          if (!map[p.cartaoId]) map[p.cartaoId] = { valor: 0, parcelas: 0 };
          map[p.cartaoId].valor += valorParcela;
          map[p.cartaoId].parcelas += 1;
        }
      }
    });
    return map;
  }, [parcelamentos]);
  const totalDisp = totalLimite - totalUsado;

  const [formErrors, setFormErrors] = useState({});
  const [parcErrors, setParcErrors] = useState({});

  const saveCard = () => {
    const errs = {};
    if (!form.nome?.trim()) errs.nome = "Nome do cartão obrigatório";
    if (!form.limite || parseFloat(form.limite) <= 0) errs.limite = "Limite deve ser positivo";
    const venc = parseInt(form.vencimento);
    if (isNaN(venc) || venc < 1 || venc > 31) errs.vencimento = "Dia entre 1 e 31";
    const fech = parseInt(form.fechamento);
    if (isNaN(fech) || fech < 1 || fech > 31) errs.fechamento = "Dia entre 1 e 31";

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }

    const data = { ...form, limite: parseFloat(form.limite), vencimento: venc, fechamento: fech };
    if (form.id && cartoes.find(c => c.id === form.id)) {
      setCartoes(cartoes.map(c => c.id === form.id ? data : c));
      toast.success(`${data.nome} atualizado.`);
    } else {
      setCartoes([...cartoes, { ...data, id: uid() }]);
      toast.success(`Cartão "${data.nome}" criado.`);
    }
    setForm(null);
    setFormErrors({});
  };

  const saveParc = () => {
    const errs = {};
    if (!parcForm.descricao?.trim()) errs.descricao = "Descrição obrigatória";
    if (!parcForm.valorTotal || parseFloat(parcForm.valorTotal) <= 0) errs.valorTotal = "Valor total deve ser positivo";
    const tp = parseInt(parcForm.totalParcelas);
    if (isNaN(tp) || tp < 1 || tp > 360) errs.totalParcelas = "Entre 1 e 360 parcelas";
    if (!parcForm.cartaoId) errs.cartaoId = "Escolha um cartão";

    setParcErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }

    const data = {
      ...parcForm,
      valorTotal: parseFloat(parcForm.valorTotal),
      totalParcelas: tp,
      parcelasPagas: parcForm.parcelasPagas || [],
    };
    if (parcForm.id && parcelamentos.find(p => p.id === parcForm.id)) {
      setParcelamentos(parcelamentos.map(p => p.id === parcForm.id ? data : p));
    } else {
      setParcelamentos([...parcelamentos, { ...data, id: uid() }]);
    }
    setParcForm(null);
  };

  const toggleParcela = (parc, num) => {
    const set = new Set(parc.parcelasPagas || []);
    if (set.has(num)) set.delete(num); else set.add(num);
    setParcelamentos(parcelamentos.map(p => p.id === parc.id ? { ...p, parcelasPagas: Array.from(set).sort((a,b)=>a-b) } : p));
  };

  // ============================
  // Pagamento de fatura
  // ============================
  // Pré-preenche o modal com a soma das parcelas do mês corrente que AINDA não estão marcadas como pagas.
  const openPagamento = (cartao) => {
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;
    const monthKey = `${curY}-${String(curM).padStart(2, "0")}`;

    let valorSugerido = 0;
    const parcelasDoMes = [];

    parcelamentos.filter(p => p.cartaoId === cartao.id).forEach(p => {
      const valorParcela = p.valorTotal / p.totalParcelas;
      for (let n = 1; n <= p.totalParcelas; n++) {
        const dt = dataDaParcela(p, n);
        if (!dt) continue;
        if (dt.getFullYear() === curY && dt.getMonth() + 1 === curM) {
          const paga = (p.parcelasPagas || []).includes(n);
          if (!paga) {
            valorSugerido += valorParcela;
            parcelasDoMes.push({ parcId: p.id, parcDescricao: p.descricao, parcN: n, valor: valorParcela });
          }
        }
      }
    });

    setPagFatura({
      cartaoId: cartao.id,
      cartaoNome: cartao.nome,
      valor: valorSugerido > 0 ? valorSugerido.toFixed(2) : "",
      contaNome: contas?.[0]?.nome || "",
      data: todayISO(),
      monthKey,
      parcelasDoMes,
    });
    setPagErrors({});
  };

  const executarPagamento = () => {
    if (!pagFatura) return;
    const errs = {};
    const v = parseFloat(pagFatura.valor);
    if (!pagFatura.valor || isNaN(v) || v <= 0) errs.valor = "Valor deve ser positivo";
    if (!pagFatura.contaNome) errs.contaNome = "Selecione a conta";
    if (!pagFatura.data) errs.data = "Informe a data";

    setPagErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }

    const cartao = cartoes.find(c => c.id === pagFatura.cartaoId);
    const conta = contas?.find(c => c.nome === pagFatura.contaNome);
    if (!cartao || !conta) {
      toast.error("Cartão ou conta não encontrados.");
      return;
    }

    // Backups para Desfazer
    const backupContas = contas;
    const backupTransacoes = transacoes;
    const backupParcelamentos = parcelamentos;

    // 1. Cria transação de despesa
    const novaTransacao = {
      id: uid(),
      tipo: "despesa",
      descricao: `Fatura ${cartao.nome} · ${pagFatura.monthKey}`,
      valor: v,
      categoria: categorias?.find(c => /cart[ãa]o|fatura/i.test(c.nome))?.nome || categorias?.[0]?.nome || "Outros",
      conta: conta.nome,
      data: pagFatura.data,
      compensado: true,
      obs: `Pagamento de fatura — ${pagFatura.parcelasDoMes.length} parcela(s) cobertas`,
    };

    // 2. Debita conta
    setContas(contas.map(c => c.id === conta.id ? { ...c, saldo: c.saldo - v } : c));

    // 3. Marca parcelas como pagas
    const parcelasPorParcId = {};
    pagFatura.parcelasDoMes.forEach(pp => {
      (parcelasPorParcId[pp.parcId] = parcelasPorParcId[pp.parcId] || []).push(pp.parcN);
    });
    setParcelamentos(parcelamentos.map(p => {
      if (!parcelasPorParcId[p.id]) return p;
      const newPagas = new Set([...(p.parcelasPagas || []), ...parcelasPorParcId[p.id]]);
      return { ...p, parcelasPagas: Array.from(newPagas).sort((a, b) => a - b) };
    }));

    // 4. Adiciona transação
    setTransacoes([novaTransacao, ...transacoes]);

    setPagFatura(null);
    setPagErrors({});
    toast.success(`Fatura de ${cartao.nome} paga: ${fmt(v)}.`, {
      duration: 6000,
      action: {
        label: "Desfazer",
        onClick: () => {
          setContas(backupContas);
          setTransacoes(backupTransacoes);
          setParcelamentos(backupParcelamentos);
        },
      },
    });
  };

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Capítulo III"
        title="Cartões"
        sub="Limites, fechamentos e parcelamentos sob controle."
        action={
          <div className="flex gap-2 flex-wrap">
            <button className="btn-ghost" onClick={() => setParcForm({ id: null, descricao: "", dataCompra: todayISO(), dataPrimeira: todayISO(), cartaoId: cartoes[0]?.id || "", valorTotal: "", totalParcelas: "", categoria: "", parcelasPagas: [] })}>
              <Plus size={12} className="inline mr-2" />Parcelamento
            </button>
            <button className="btn-gold" onClick={() => setForm({ id: null, nome: "", banco: "outro", limite: "", vencimento: 5, fechamento: 28, tipo: "principal", tags: [], ativo: true })}>
              <Plus size={14} className="inline mr-2" />Novo Cartão
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-8" style={{ background: T.border }}>
        <StatCard label="Limite total" value={hidden ? "•••••" : fmt(totalLimite)} accent={T.gold} icon={CreditCard} sub={`${cartoes.length} cartões`} />
        <StatCard label="Comprometido" value={hidden ? "•••••" : fmt(totalUsado)} accent={T.red} icon={TrendingDown} />
        <StatCard label="Disponível" value={hidden ? "•••••" : fmt(totalDisp)} accent={T.green} icon={TrendingUp}
                  sub={`${fmtN(totalLimite > 0 ? (totalDisp/totalLimite)*100 : 0, 0)}% livre`} />
        <StatCard label="Parcelamentos ativos" value={String(parcelamentos.filter(p => (p.parcelasPagas?.length || 0) < p.totalParcelas).length)}
                  accent={T.blue} icon={Repeat} />
      </div>

      {/* Visual cards · densos · auto-fill */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 12,
        marginBottom: 30,
      }}>
        {cartoes.map(c => {
          // If c.banco is "custom", use c.bandeiraCustom; otherwise look up in BANK_BRANDS
          const brand = c.banco === "custom" && c.bandeiraCustom
            ? c.bandeiraCustom
            : (BANK_BRANDS[c.banco] || BANK_BRANDS.outro);
          const usado = usedByCard[c.id] || 0;
          const disp = c.limite - usado;
          const pctUsado = c.limite > 0 ? (usado / c.limite) * 100 : 0;
          return (
            <div key={c.id}
                 onClick={() => onCartaoClick && onCartaoClick({ ...c, usado, faturaAtual: usado })}
                 style={{
              background: brand.bg, padding: 0, position: "relative", overflow: "hidden",
              minHeight: 170, borderRadius: 10, boxShadow: "0 6px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.1)",
              cursor: onCartaoClick ? "pointer" : "default",
              transition: "transform .2s, box-shadow .2s",
            }}
                 onMouseEnter={e => { if (onCartaoClick) { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)"; }}}
                 onMouseLeave={e => { if (onCartaoClick) { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)"; }}}
            >
              {/* Highlight ring */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, pointerEvents: "none" }} />

              {/* Top: brand + tipo */}
              <div className="flex items-start justify-between" style={{ padding: "12px 14px 6px" }}>
                <div>
                  <div style={{ color: brand.fg, opacity: 0.6, fontSize: 8.5, letterSpacing: "0.25em", textTransform: "uppercase", fontWeight: 500 }}>
                    {c.tipo === "principal" ? "Cartão Principal" : "Cartão Reserva"}
                  </div>
                  <div style={{ color: brand.fg, fontSize: 17, fontWeight: 600, marginTop: 3, letterSpacing: "-0.01em" }}>
                    {c.nome}
                  </div>
                </div>
                <CreditCard size={18} style={{ color: brand.fg, opacity: 0.85 }} />
              </div>

              {/* Middle: limit visual */}
              <div style={{ padding: "0 14px 8px" }}>
                <div className="flex justify-between items-baseline" style={{ color: brand.fg }}>
                  <span style={{ fontSize: 9, opacity: 0.7, letterSpacing: "0.2em", textTransform: "uppercase" }}>Limite</span>
                  <span className="num" style={{ fontSize: 14, fontWeight: 600 }}>{hidden ? "•••" : fmt(c.limite)}</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.15)", height: 4, marginTop: 5, borderRadius: 1 }}>
                  <div style={{ width: `${Math.min(100, pctUsado)}%`, height: "100%", background: brand.fg, opacity: 0.9, transition: "width 0.6s" }} />
                </div>
                <div className="flex justify-between mt-1" style={{ color: brand.fg, opacity: 0.85, fontSize: 10 }}>
                  <span className="num">Usado · {hidden ? "•••" : fmt(usado)}</span>
                  <span className="num">Livre · {hidden ? "•••" : fmt(disp)}</span>
                </div>
              </div>

              {/* Bottom: meta + ações compactas */}
              <div style={{
                padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
                borderTop: "1px solid rgba(255,255,255,0.1)", color: brand.fg, gap: 6, flexWrap: "wrap",
              }}>
                <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 10 }}>
                  <Calendar size={11} style={{ opacity: 0.7 }} />
                  <span>Vence <strong>{c.vencimento}</strong></span>
                  <span style={{ opacity: 0.4 }}>·</span>
                  <span>Fecha <strong>{c.fechamento || "—"}</strong></span>
                  {faturaPorCartao[c.id] && (
                    <>
                      <span style={{ opacity: 0.4 }}>·</span>
                      <span style={{ fontWeight: 600 }}>
                        Fatura <span className="num">{hidden ? "•••" : fmt(faturaPorCartao[c.id].valor)}</span>
                      </span>
                    </>
                  )}
                </div>
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  {faturaPorCartao[c.id] && faturaPorCartao[c.id].valor > 0 && (
                    <button onClick={(e) => { e.stopPropagation(); openPagamento(c); }}
                            aria-label={`Pagar fatura do ${c.nome}`}
                            title="Pagar fatura corrente"
                            style={{ background: "rgba(255,255,255,0.85)", color: "#1a1a1a", padding: "3px 8px", border: "none", cursor: "pointer", borderRadius: 3, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      Pagar
                    </button>
                  )}
                  <button onClick={() => setForm(c)} aria-label={`Editar ${c.nome}`}
                    style={{ background: "rgba(255,255,255,0.15)", color: brand.fg, padding: 4, border: "none", cursor: "pointer", borderRadius: 3 }}>
                    <Edit3 size={10} />
                  </button>
                  <button onClick={async () => {
                            const ok = await confirm({
                              title: `Excluir "${c.nome}"?`, danger: true, confirmLabel: "Excluir",
                              body: "Parcelamentos vinculados perderão a referência.",
                            });
                            if (ok) {
                              setCartoes(cartoes.filter(x => x.id !== c.id));
                              toast.success(`${c.nome} excluído.`);
                            }
                          }}
                          aria-label={`Excluir ${c.nome}`}
                          style={{ background: "rgba(255,255,255,0.15)", color: brand.fg, padding: 4, border: "none", cursor: "pointer", borderRadius: 3 }}>
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>

              {/* Parcelamentos ativos colapsável dentro do card */}
              <ParcelasDoCartao
                cartao={c}
                parcelamentos={parcelamentos}
                brand={brand}
                hidden={hidden}
              />

              {/* Tags */}
              {c.tags && c.tags.length > 0 && (
                <div className="absolute" style={{ top: 60, right: 16, display: "flex", gap: 4, flexDirection: "column", alignItems: "flex-end" }}>
                  {c.tags.map((t, i) => (
                    <span key={i} style={{
                      background: "rgba(0,0,0,0.25)", color: brand.fg, fontSize: 9, padding: "3px 8px", borderRadius: 10,
                      letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500, backdropFilter: "blur(4px)",
                    }}>{t}</span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {cartoes.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 text-center py-12" style={{ color: T.muted, fontStyle: "italic" }}>
            Nenhum cartão cadastrado.
          </div>
        )}
      </div>

      {/* Parcelamentos table */}
      <section style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }}>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <div>
            <div className="label-eyebrow">Parcelamentos</div>
            <h3 style={{ fontFamily: T.serif, fontSize: 24, color: T.ink, marginTop: 4, fontWeight: 600 }}>
              Compras parceladas em curso
            </h3>
          </div>
        </div>
        {parcelamentos.length === 0 ? (
          <div className="py-8 text-center" style={{ color: T.muted, fontStyle: "italic" }}>
            Nenhum parcelamento cadastrado. Toque em "Parcelamento" no topo para adicionar.
          </div>
        ) : (
          <div className="space-y-4">
            {parcelamentos.map(p => {
              const valorParcela = p.valorTotal / p.totalParcelas;
              const pagas = p.parcelasPagas?.length || 0;
              const pctPago = (pagas / p.totalParcelas) * 100;
              const restante = p.valorTotal - (pagas * valorParcela);
              return (
                <div key={p.id} style={{ background: T.bgSoft, border: `1px solid ${T.border}`, padding: 16 }}>
                  <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div style={{ color: T.ink, fontSize: 17, fontWeight: 600 }}>{p.descricao}</div>
                      <div className="flex gap-2 mt-1 flex-wrap text-xs" style={{ color: T.muted }}>
                        <span style={{ background: `${T.gold}22`, color: T.gold, padding: "2px 8px", letterSpacing: "0.1em", textTransform: "uppercase", fontSize: 10, fontWeight: 500 }}>
                          {cartoes.find(c => c.id === p.cartaoId)?.nome || p.cartaoNome || "Cartão removido"}
                        </span>
                        <span className="num">Compra {p.dataCompra}</span>
                        <span>·</span>
                        <span className="num">1ª parc {p.dataPrimeira}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="num" style={{ color: T.ink, fontSize: 18, fontWeight: 600 }}>
                        {hidden ? "•••" : fmt(p.valorTotal)}
                      </div>
                      <div className="num text-xs" style={{ color: T.muted }}>
                        {p.totalParcelas}× de {hidden ? "•••" : fmt(valorParcela)}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setParcForm(p)} style={{ color: T.muted, padding: 4 }}>
                        <Edit3 size={14} />
                      </button>
                      <button onClick={async () => {
                                const ok = await confirm({
                                  title: `Excluir "${p.descricao}"?`,
                                  danger: true, confirmLabel: "Excluir",
                                });
                                if (ok) {
                                  setParcelamentos(parcelamentos.filter(x => x.id !== p.id));
                                  toast.success(`${p.descricao} excluído.`);
                                }
                              }}
                              style={{ color: T.red, padding: 4 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="flex justify-between text-xs mb-1" style={{ color: T.muted }}>
                    <span>{pagas} de {p.totalParcelas} pagas</span>
                    <span className="num">Restam {hidden ? "•••" : fmt(restante)}</span>
                  </div>
                  <div style={{ background: T.border, height: 6, marginBottom: 12 }}>
                    <div style={{ width: `${pctPago}%`, background: T.green, height: "100%", transition: "width 0.6s" }} />
                  </div>

                  {/* Parcela checkboxes — verde paga · amarelo atual · cinza futura */}
                  <div className="parcelas-grid" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {Array.from({ length: p.totalParcelas }, (_, i) => i + 1).map(num => {
                      const paga = (p.parcelasPagas || []).includes(num);
                      // Calcula data de cada parcela (mensal a partir da 1ª)
                      let dataParcela = "";
                      let isAtual = false;
                      if (p.dataPrimeira) {
                        const base = new Date(p.dataPrimeira);
                        base.setMonth(base.getMonth() + (num - 1));
                        dataParcela = base.toISOString().slice(0, 10);
                        const hojeYM = new Date().toISOString().slice(0, 7);
                        isAtual = dataParcela.startsWith(hojeYM) && !paga;
                      }
                      const cor = paga ? T.green : isAtual ? T.gold : T.border;
                      const bg  = paga ? T.green : isAtual ? `${T.gold}22` : "transparent";
                      const fg  = paga ? T.bg    : isAtual ? T.gold        : T.muted;
                      return (
                        <button key={num} onClick={() => toggleParcela(p, num)}
                          title={`Parcela ${num}ª · ${dataParcela ? `vence ${dataParcela.slice(8,10)}/${dataParcela.slice(5,7)}/${dataParcela.slice(0,4)} · ` : ""}${fmt(valorParcela)}${isAtual ? " · ATUAL" : ""}`}
                          style={{
                            minWidth: 50, padding: "6px 4px",
                            background: bg, color: fg,
                            border: `1px solid ${cor}`,
                            borderRadius: 6,
                            cursor: "pointer",
                            display: "inline-flex", flexDirection: "column", alignItems: "center",
                            fontFamily: T.mono, fontWeight: 600,
                          }}>
                          <div style={{ fontSize: 13 }}>{paga ? "✅" : isAtual ? "⏰" : "⬜"}</div>
                          <div style={{ fontSize: 9, marginTop: 2, letterSpacing: ".05em", textTransform: "uppercase" }}>
                            {num}ª {isAtual ? "· hoje" : ""}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Card form modal */}
      {form && (
        <Modal title={form.id ? "Editar Cartão" : "Novo Cartão"} onClose={() => setForm(null)}>
          <Field label="Nome do cartão" required error={formErrors.nome}>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Bradesco Click" />
          </Field>
          <Field label="Banco / Bandeira">
            <select value={form.banco} onChange={e => {
              const v = e.target.value;
              setForm({
                ...form,
                banco: v,
                bandeiraCustom: v === "custom"
                  ? (form.bandeiraCustom || { nome: form.nome || "Personalizado", bg: `linear-gradient(135deg, ${T.gold} 0%, ${T.goldHi || "#8a7140"} 100%)`, fg: "#ffffff", cor1: T.gold, cor2: "#8a7140", fgColor: "#ffffff" })
                  : form.bandeiraCustom,
              });
            }}>
              {Object.entries(BANK_BRANDS).map(([k, v]) => <option key={k} value={k}>{v.nome}</option>)}
              <option value="custom">✨ Bandeira personalizada…</option>
            </select>
          </Field>

          {/* Custom brand editor */}
          {form.banco === "custom" && (
            <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, padding: 14, marginTop: -8, marginBottom: 16 }}>
              <div className="label-eyebrow mb-3">Personalizar bandeira</div>
              <Field label="Nome a exibir">
                <input value={form.bandeiraCustom?.nome || ""}
                       onChange={e => setForm({ ...form, bandeiraCustom: { ...form.bandeiraCustom, nome: e.target.value } })}
                       placeholder="Ex.: Will Bank · BTG · Empresarial" />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Cor 1 (escura)">
                  <input type="color" value={form.bandeiraCustom?.cor1 || "#c9a96b"}
                         onChange={e => {
                           const cor1 = e.target.value;
                           const cor2 = form.bandeiraCustom?.cor2 || "#8a7140";
                           setForm({
                             ...form,
                             bandeiraCustom: {
                               ...form.bandeiraCustom,
                               cor1,
                               bg: `linear-gradient(135deg, ${cor1} 0%, ${cor2} 100%)`,
                             },
                           });
                         }}
                         style={{ width: "100%", height: 38, padding: 2, cursor: "pointer" }} />
                </Field>
                <Field label="Cor 2 (clara)">
                  <input type="color" value={form.bandeiraCustom?.cor2 || "#8a7140"}
                         onChange={e => {
                           const cor1 = form.bandeiraCustom?.cor1 || "#c9a96b";
                           const cor2 = e.target.value;
                           setForm({
                             ...form,
                             bandeiraCustom: {
                               ...form.bandeiraCustom,
                               cor2,
                               bg: `linear-gradient(135deg, ${cor1} 0%, ${cor2} 100%)`,
                             },
                           });
                         }}
                         style={{ width: "100%", height: 38, padding: 2, cursor: "pointer" }} />
                </Field>
                <Field label="Texto">
                  <input type="color" value={form.bandeiraCustom?.fgColor || "#ffffff"}
                         onChange={e => setForm({
                           ...form,
                           bandeiraCustom: {
                             ...form.bandeiraCustom,
                             fgColor: e.target.value,
                             fg: e.target.value,
                           },
                         })}
                         style={{ width: "100%", height: 38, padding: 2, cursor: "pointer" }} />
                </Field>
              </div>
              {/* Live preview */}
              <div style={{
                marginTop: 12, padding: 14, height: 90, borderRadius: 8,
                background: form.bandeiraCustom?.bg || "transparent",
                color: form.bandeiraCustom?.fgColor || "#fff",
                display: "flex", flexDirection: "column", justifyContent: "space-between",
              }}>
                <div style={{ fontSize: 9, opacity: 0.6, letterSpacing: "0.25em", textTransform: "uppercase" }}>Pré-visualização</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{form.bandeiraCustom?.nome || "Bandeira"}</div>
              </div>
            </div>
          )}
          <Field label="Limite (R$)" required error={formErrors.limite}>
            <input type="number" step="0.01" value={form.limite} onChange={e => setForm({ ...form, limite: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dia do vencimento" required error={formErrors.vencimento}>
              <input type="number" min="1" max="31" value={form.vencimento} onChange={e => setForm({ ...form, vencimento: e.target.value })} />
            </Field>
            <Field label="Dia do fechamento" required error={formErrors.fechamento}>
              <input type="number" min="1" max="31" value={form.fechamento} onChange={e => setForm({ ...form, fechamento: e.target.value })} />
            </Field>
          </div>
          <Field label="Tipo">
            <div className="grid grid-cols-2 gap-2">
              {[{ v: "principal", l: "Principal" }, { v: "reserva", l: "Reserva" }].map(opt => (
                <button key={opt.v} type="button" onClick={() => setForm({ ...form, tipo: opt.v })}
                  style={{
                    padding: 12, border: `1px solid ${form.tipo === opt.v ? T.gold : T.border}`,
                    background: form.tipo === opt.v ? `${T.gold}22` : "transparent",
                    color: form.tipo === opt.v ? T.gold : T.muted,
                    fontSize: 13, fontWeight: 500, letterSpacing: "0.05em",
                  }}>{opt.l}</button>
              ))}
            </div>
          </Field>
          <Field label="Benefícios (separados por vírgula)">
            <input value={(form.tags || []).join(", ")} onChange={e => setForm({ ...form, tags: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                   placeholder="Acumula pontos, Sala VIP, Cashback…" />
          </Field>
          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={saveCard}>Salvar</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* Parcelamento form modal */}
      {parcForm && (
        <Modal title={parcForm.id ? "Editar Parcelamento" : "Novo Parcelamento"} onClose={() => setParcForm(null)}>
          <Field label="Descrição" required error={parcErrors.descricao}>
            <input value={parcForm.descricao} onChange={e => setParcForm({ ...parcForm, descricao: e.target.value })} placeholder="Ex.: iPhone 15" />
          </Field>
          <Field label="Cartão" required error={parcErrors.cartaoId}>
            <select value={parcForm.cartaoId} onChange={e => setParcForm({ ...parcForm, cartaoId: e.target.value })}>
              <option value="">Selecione…</option>
              {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Categoria" hint="Como você quer ver essa parcela nos relatórios">
            <select value={parcForm.categoria || ""} onChange={e => setParcForm({ ...parcForm, categoria: e.target.value })}>
              <option value="">Sem categoria</option>
              {(categorias || []).filter(c => c.tipo !== "receita").map(c => (
                <option key={c.id} value={c.nome}>{c.nome}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data da compra">
              <input type="date" value={parcForm.dataCompra} onChange={e => setParcForm({ ...parcForm, dataCompra: e.target.value })} />
            </Field>
            <Field label="Data 1ª parcela">
              <input type="date" value={parcForm.dataPrimeira} onChange={e => setParcForm({ ...parcForm, dataPrimeira: e.target.value })} />
            </Field>
            <Field label="Valor total (R$)" required error={parcErrors.valorTotal}>
              <input type="number" step="0.01" value={parcForm.valorTotal} onChange={e => setParcForm({ ...parcForm, valorTotal: e.target.value })} />
            </Field>
            <Field label="Nº de parcelas" required error={parcErrors.totalParcelas}>
              <input type="number" min="2" max="360" value={parcForm.totalParcelas} onChange={e => setParcForm({ ...parcForm, totalParcelas: e.target.value })} />
            </Field>
          </div>
          {parcForm.valorTotal && parcForm.totalParcelas && (
            <div style={{ color: T.gold, fontSize: 13, fontStyle: "italic", marginTop: 8 }} className="num">
              {parcForm.totalParcelas}× de {fmt((parseFloat(parcForm.valorTotal) || 0) / (parseInt(parcForm.totalParcelas) || 1))}
            </div>
          )}
          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={saveParc}>Salvar</button>
            <button className="btn-ghost" onClick={() => setParcForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* Pagamento de Fatura modal */}
      {pagFatura && (() => {
        const cartao = cartoes.find(c => c.id === pagFatura.cartaoId);
        const conta = contas?.find(c => c.nome === pagFatura.contaNome);
        const valorNum = parseFloat(pagFatura.valor) || 0;
        const saldoAtual = conta?.saldo ?? 0;
        const saldoPos = saldoAtual - valorNum;
        return (
          <Modal title={`Pagar fatura · ${cartao?.nome || "?"}`} onClose={() => setPagFatura(null)}>
            <div style={{
              background: T.bgSoft, border: `1px solid ${T.border}`,
              padding: 14, marginBottom: 16,
            }}>
              <div className="label-eyebrow mb-2">Resumo da fatura corrente</div>
              {pagFatura.parcelasDoMes.length === 0 ? (
                <div style={{ color: T.muted, fontSize: 13, fontStyle: "italic" }}>
                  Nenhuma parcela em aberto neste mês — você pode pagar um valor livre.
                </div>
              ) : (
                <div style={{ fontSize: 12, color: T.muted, maxHeight: 140, overflowY: "auto" }}>
                  {pagFatura.parcelasDoMes.map((pp, i) => (
                    <div key={i} className="flex justify-between" style={{ padding: "3px 0", borderBottom: i < pagFatura.parcelasDoMes.length - 1 ? `1px dashed ${T.border}` : "none" }}>
                      <span>{pp.parcDescricao} · {pp.parcN}ª</span>
                      <span className="num">{fmt(pp.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Field label="Valor a pagar (R$)" required error={pagErrors.valor}
                   hint={pagFatura.parcelasDoMes.length > 0 ? "Sugerido: soma das parcelas em aberto deste mês" : "Pagamento livre"}>
              <input type="number" step="0.01"
                     value={pagFatura.valor}
                     onChange={e => setPagFatura({ ...pagFatura, valor: e.target.value })} />
            </Field>
            <Field label="Pagar com" required error={pagErrors.contaNome}>
              <select value={pagFatura.contaNome} onChange={e => setPagFatura({ ...pagFatura, contaNome: e.target.value })}>
                <option value="">Selecione…</option>
                {contas?.map(c => <option key={c.id} value={c.nome}>{c.nome} · saldo {fmt(c.saldo)}</option>)}
              </select>
            </Field>
            <Field label="Data do pagamento" required error={pagErrors.data}>
              <input type="date" value={pagFatura.data} onChange={e => setPagFatura({ ...pagFatura, data: e.target.value })} />
            </Field>
            {conta && valorNum > 0 && (
              <div style={{
                background: saldoPos < 0 ? `${T.red}11` : `${T.green}11`,
                border: `1px solid ${saldoPos < 0 ? T.red : T.green}`,
                padding: 10, marginTop: 6, fontSize: 12,
                color: saldoPos < 0 ? T.red : T.green,
              }}>
                {saldoPos < 0 ? "⚠ " : "✓ "}
                Saldo de {conta.nome} após pagamento: <strong className="num">{fmt(saldoPos)}</strong>
              </div>
            )}
            <div style={{ background: `${T.gold}11`, border: `1px solid ${T.gold}`, padding: 10, marginTop: 8, fontSize: 11, color: T.muted, fontStyle: "italic" }}>
              ✓ Ao confirmar: cria uma despesa em Transações, debita {pagFatura.contaNome || "a conta"} e marca as parcelas listadas como pagas.
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-gold" onClick={executarPagamento}>Confirmar Pagamento</button>
              <button className="btn-ghost" onClick={() => setPagFatura(null)}>Cancelar</button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

/* ============================================================
   ParcelasDoCartao — bloco colapsável dentro do card de cartão.
   Mostra parcelamentos ativos com progressbar.
   ============================================================ */
function ParcelasDoCartao({ cartao, parcelamentos = [], brand, hidden }) {
  const [aberto, setAberto] = useState(false);

  // Match por cartaoId OU por nome normalizado
  const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  const ativos = parcelamentos.filter(p => {
    if ((p.parcelasPagas?.length || 0) >= p.totalParcelas) return false;
    if (p.cartaoId === cartao.id) return true;
    if (norm(p.cartaoNome) === norm(cartao.nome)) return true;
    return false;
  });

  if (ativos.length === 0) return null;

  return (
    <div style={{
      borderTop: "1px solid rgba(255,255,255,0.1)",
      padding: "6px 14px",
    }}
      onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setAberto(!aberto)}
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          width: "100%", padding: "4px 0",
          color: brand.fg, opacity: 0.85,
          fontSize: 10, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase",
          display: "flex", alignItems: "center", gap: 4, justifyContent: "space-between",
        }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <CreditCard size={11} /> {ativos.length} parcelamento{ativos.length === 1 ? "" : "s"} ativo{ativos.length === 1 ? "" : "s"}
        </span>
        {aberto ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {aberto && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, paddingBottom: 8 }}>
          {ativos.map(p => {
            const pagas = p.parcelasPagas?.length || 0;
            const total = p.totalParcelas;
            const pct = total > 0 ? (pagas / total) * 100 : 0;
            const valorParc = p.valorParcela || (p.valorTotal && p.totalParcelas ? p.valorTotal / p.totalParcelas : 0);
            return (
              <div key={p.id} style={{
                background: "rgba(0,0,0,0.25)", padding: "6px 8px", borderRadius: 5,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, marginBottom: 3, color: brand.fg }}>
                  <span style={{ fontWeight: 600, opacity: 0.95 }}>{p.descricao}</span>
                  <span style={{ opacity: 0.85 }}>
                    {pagas}/{total} · {hidden ? "•••" : fmt(valorParc)}
                  </span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.15)", height: 3, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ background: brand.fg, opacity: 0.9, width: `${pct}%`, height: "100%" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

