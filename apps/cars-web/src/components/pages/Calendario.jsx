import React, { useState, useMemo } from "react";
import {
  Plus, X, Trash2, Edit3, ArrowUpRight, ArrowDownRight,
  ChevronLeft, ChevronRight, Bell, AlarmClock,
  MapPin, Clock, Link2, Briefcase, Plane, Heart, Star, Check,
} from "lucide-react";
import { T } from "../../lib/theme.js";
import { MESES_LONGO } from "../../lib/meses.js";
import { fmt, uid, todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";
import Field from "../ui/Field.jsx";
import Modal from "../ui/Modal.jsx";
import { getDespesasDoMes, getGanhosDoMes } from "../../lib/agregador.js";
import { mapaGastosDeItens, corHeat, CORES_HEAT, insightFimDeSemana } from "../../lib/gastosCalendario.js";
import { ordenarPorNome } from "../../lib/categoriaSort.js";
import { EVENTO_TIPO } from "../../lib/coresUI.js";
import CalendarioSemanaDia from "./CalendarioSemanaDia.jsx";

const CATEGORIAS_AGENDA = [
  { id: "compromisso", label: "Compromisso", cor: EVENTO_TIPO.compromisso.cor, icon: Briefcase },
  { id: "viagem",      label: "Viagem",      cor: EVENTO_TIPO.viagem.cor,      icon: Plane },
  { id: "lembrete",    label: "Lembrete",    cor: EVENTO_TIPO.lembrete.cor,    icon: AlarmClock },
  { id: "pessoal",     label: "Pessoal",     cor: EVENTO_TIPO.pessoal.cor,     icon: Heart },
  { id: "evento",      label: "Evento",      cor: EVENTO_TIPO.evento.cor,      icon: Star },
];

const catMeta = (id) =>
  CATEGORIAS_AGENDA.find(c => c.id === id) || CATEGORIAS_AGENDA[0];

function dataDia(year, month, day) {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export default function Calendario({
  transacoes, setTransacoes, contas, setContas, categorias, hidden,
  fixaOcorrencias = [], fixas = [], parcelamentos = [], dividas = [], devedores = [],
  cheques = [], cartoes = [],
  agenda = [], setAgenda,
  escopoAtivo = "tudo",
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [eventoForm, setEventoForm] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [filterMode, setFilterMode] = useState("tudo"); // tudo | financeiro | pessoal
  const [vista, setVista] = useState("mes"); // mes | semana | dia
  // Data de referência para as vistas Semana/Dia (default hoje).
  const [refDate, setRefDate] = useState(new Date());
  // Modo "💸 Gastos": pinta os dias pela intensidade do gasto REAL
  // (transações de despesa), com filtro opcional por categoria.
  const [modoGastos, setModoGastos] = useState(false);
  const [catGasto, setCatGasto] = useState(""); // "" = todas

  const months = MESES_LONGO;

  const showFinanceiro = filterMode === "tudo" || filterMode === "financeiro";
  const showPessoal    = filterMode === "tudo" || filterMode === "pessoal";

  // Calendar grid
  const grid = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDow = first.getDay();
    const totalDays = last.getDate();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  // Itens financeiros do mês — só o que AINDA NÃO foi pago/recebido (o que já
  // está resolvido não precisa ocupar espaço no calendário).
  const itensByDay = useMemo(() => {
    if (!showFinanceiro) return {};
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    // `cheques` incluído: cheques aguardando compensação entram como ganho
    // pendente na data de vencimento (via getGanhosDoMes).
    const state = { transacoes, contas, categorias, fixaOcorrencias, fixas, parcelamentos, dividas, devedores, cheques, cartoes };
    const desp = getDespesasDoMes(monthStr, state, escopoAtivo).filter(d => d.status !== "paga");
    const ganh = getGanhosDoMes(monthStr, state, escopoAtivo).filter(g => g.status !== "paga");
    const map = {};
    desp.forEach(d => {
      if (!d.data) return;
      const day = parseInt(d.data.slice(8, 10), 10);
      if (!map[day]) map[day] = [];
      map[day].push({ ...d, _kind: "despesa" });
    });
    ganh.forEach(g => {
      if (!g.data) return;
      const day = parseInt(g.data.slice(8, 10), 10);
      if (!map[day]) map[day] = [];
      map[day].push({ ...g, _kind: "ganho" });
    });
    return map;
  }, [transacoes, contas, categorias, fixaOcorrencias, fixas, parcelamentos, dividas, devedores, cheques, cartoes, year, month, escopoAtivo, showFinanceiro]);

  // Agenda pessoal do mês
  const agendaByDay = useMemo(() => {
    if (!showPessoal) return {};
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    const map = {};
    (agenda || []).forEach(ev => {
      if (!ev.data || !ev.data.startsWith(monthStr)) return;
      const day = parseInt(ev.data.slice(8, 10), 10);
      if (!map[day]) map[day] = [];
      map[day].push(ev);
    });
    // Ordena por horário em cada dia
    Object.values(map).forEach(arr => arr.sort((a, b) => (a.horario || "00:00").localeCompare(b.horario || "00:00")));
    return map;
  }, [agenda, year, month, showPessoal]);

  // Net + flags por dia
  const cellInfoByDay = useMemo(() => {
    const map = {};
    Object.entries(itensByDay).forEach(([day, lista]) => {
      let net = 0;
      let atrasado = false;
      lista.forEach(i => {
        if (i._kind === "despesa") {
          net -= i.valor;
          if (i.status === "atrasada") atrasado = true;
        } else {
          net += i.valor;
        }
      });
      map[day] = { ...(map[day] || {}), net, itensFin: lista.length, atrasado };
    });
    Object.entries(agendaByDay).forEach(([day, lista]) => {
      map[day] = { ...(map[day] || {}), itensAgenda: lista.length, coresAgenda: lista.slice(0, 3).map(e => catMeta(e.categoria).cor) };
    });
    return map;
  }, [itensByDay, agendaByDay]);

  const navigate = (delta) => {
    if (vista === "semana" || vista === "dia") {
      const passo = vista === "semana" ? 7 : 1;
      const d = new Date(refDate); d.setDate(d.getDate() + delta * passo);
      setRefDate(d); setMonth(d.getMonth()); setYear(d.getFullYear());
      return;
    }
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y--; }
    else if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  const irHoje = () => {
    const d = new Date();
    setRefDate(d); setMonth(d.getMonth()); setYear(d.getFullYear());
  };

  // Abre o form de novo evento já com data/hora do slot clicado (Semana/Dia).
  const novoEventoNoSlot = (dataISO, horaHHMM) => {
    setEventoForm({
      id: null, titulo: "", data: dataISO, horario: horaHHMM,
      categoria: "compromisso", duracao: "60", local: "", link: "", obs: "", feito: false,
    });
  };

  // Título do cabeçalho conforme a vista.
  const tituloPeriodo = (() => {
    if (vista === "dia") {
      return refDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    }
    if (vista === "semana") {
      const ini = new Date(refDate); ini.setDate(ini.getDate() - ini.getDay());
      const fim = new Date(ini); fim.setDate(ini.getDate() + 6);
      const f = (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
      return `${f(ini)} – ${f(fim)} ${fim.getFullYear()}`;
    }
    return null; // mês usa o título serif existente
  })();

  // Eventos da agenda (no filtro pessoal) para passar às vistas semana/dia.
  const eventosAgendaVista = showPessoal ? (agenda || []) : [];

  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const dayFinanceiros = selectedDay ? (itensByDay[selectedDay] || []) : [];
  const dayEventos = selectedDay ? (agendaByDay[selectedDay] || []) : [];

  /* ============ MODO GASTOS (heatmap) ============ */
  // MESMA base dos números que o calendário já mostra (getDespesasDoMes:
  // fixas + parcelas de cartão + dívidas + avulsas), incluindo as PAGAS —
  // gasto é gasto, pago ou pendente. Transações avulsas sozinhas pintavam
  // quase nada (a vida financeira real mora nas fixas/parcelas).
  const monthStrGastos = `${year}-${String(month + 1).padStart(2, "0")}`;
  const despesasDoMesTodas = useMemo(() => {
    if (!modoGastos) return [];
    const state = { transacoes, contas, categorias, fixaOcorrencias, fixas, parcelamentos, dividas, devedores, cheques, cartoes };
    try { return getDespesasDoMes(monthStrGastos, state, escopoAtivo) || []; } catch { return []; }
  }, [modoGastos, transacoes, contas, categorias, fixaOcorrencias, fixas, parcelamentos, dividas, devedores, cheques, cartoes, monthStrGastos, escopoAtivo]);
  const mapaGastos = useMemo(() => {
    if (!modoGastos) return null;
    return mapaGastosDeItens(despesasDoMesTodas, { categorias, ym: monthStrGastos, categoriaFiltro: catGasto });
  }, [modoGastos, despesasDoMesTodas, categorias, monthStrGastos, catGasto]);
  // Categorias-raiz de despesa pro filtro (filhas contam junto com a mãe).
  const catsGastoOpcoes = useMemo(() =>
    ordenarPorNome((categorias || []).filter(c => c && !c.parentId && c.tipo !== "receita")),
    [categorias]);
  // Gastos do dia selecionado (lista do painel no modo gastos) — mesma base
  // agregada do mapa, filtrada pro dia.
  const dayGastos = useMemo(() => {
    if (!modoGastos || !selectedDay) return [];
    const diaISO = dataDia(year, month, selectedDay);
    let nomesFiltro = null;
    if (catGasto) {
      const raiz = (categorias || []).find(c => c.nome === catGasto);
      nomesFiltro = new Set([catGasto, ...(raiz ? categorias.filter(c => c.parentId === raiz.id).map(c => c.nome) : [])]);
    }
    return (despesasDoMesTodas || [])
      .filter(t => t && String(t.data || "") === diaISO && !t.transferenciaId
        && !/transf/i.test(t.categoria || "")
        && (!nomesFiltro || nomesFiltro.has(t.categoria || "Sem categoria")))
      .sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0));
  }, [modoGastos, selectedDay, despesasDoMesTodas, categorias, catGasto, year, month]);

  /* ============ AGENDA: criar/editar/salvar/excluir ============ */
  const novoEvento = (day) => {
    const data = day ? dataDia(year, month, day) : todayISO();
    setEventoForm({
      id: null, titulo: "", descricao: "",
      data, horario: "", duracao: "",
      categoria: "compromisso",
      local: "", link: "",
      status: "agendado",
    });
    setFormErrors({});
  };

  const editarEvento = (ev) => {
    setEventoForm({
      ...ev,
      horario: ev.horario || "",
      duracao: ev.duracao != null ? String(ev.duracao) : "",
      local: ev.local || "",
      link: ev.link || "",
      descricao: ev.descricao || "",
    });
    setFormErrors({});
  };

  const salvarEvento = () => {
    const errs = {};
    if (!eventoForm.titulo?.trim()) errs.titulo = "Título é obrigatório";
    if (!eventoForm.data) errs.data = "Data é obrigatória";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) { toast.error("Verifique os campos."); return; }

    const agora = new Date().toISOString();
    const data = {
      id: eventoForm.id || uid(),
      titulo: eventoForm.titulo.trim(),
      descricao: eventoForm.descricao || "",
      data: eventoForm.data,
      horario: eventoForm.horario || null,
      duracao: eventoForm.duracao ? parseInt(eventoForm.duracao, 10) : null,
      categoria: eventoForm.categoria || "compromisso",
      local: eventoForm.local || "",
      link: eventoForm.link || "",
      status: eventoForm.status || "agendado",
      createdAt: eventoForm.createdAt || agora,
      updatedAt: agora,
    };

    if (eventoForm.id && agenda.find(e => e.id === eventoForm.id)) {
      setAgenda(agenda.map(e => e.id === eventoForm.id ? data : e));
      toast.success("Evento atualizado.");
    } else {
      setAgenda([...agenda, data]);
      toast.success(`Evento "${data.titulo}" criado.`);
    }
    setEventoForm(null);
    setFormErrors({});
  };

  const excluirEvento = async (ev) => {
    const ok = await confirm({
      title: `Excluir "${ev.titulo}"?`,
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    const backup = agenda;
    setAgenda(agenda.filter(x => x.id !== ev.id));
    toast.success(`Evento "${ev.titulo}" excluído.`, {
      action: { label: "Desfazer", onClick: () => setAgenda(backup) },
    });
  };

  const marcarFeito = (ev) => {
    setAgenda(agenda.map(e => e.id === ev.id
      ? { ...e, status: e.status === "feito" ? "agendado" : "feito", updatedAt: new Date().toISOString() }
      : e));
  };

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Capítulo V"
        title="Agenda"
        sub="Vencimentos e compromissos pessoais num lugar só."
        action={
          <button className="btn-gold" onClick={() => novoEvento(selectedDay)}>
            <Plus size={14} className="inline mr-2" />Novo Evento
          </button>
        }
      />

      {/* Filtros */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {[
          { id: "tudo",       label: "Tudo",       cor: T.gold },
          { id: "financeiro", label: "Financeiro", cor: T.green },
          { id: "pessoal",    label: "Pessoal",    cor: T.blue },
        ].map(f => {
          const ativo = filterMode === f.id;
          return (
            <button key={f.id} onClick={() => setFilterMode(f.id)}
              style={{
                padding: "7px 14px",
                background: ativo ? `${f.cor}22` : T.card,
                border: `1px solid ${ativo ? f.cor : T.border}`,
                color: ativo ? f.cor : T.muted,
                fontSize: 11, fontWeight: 600, borderRadius: 100,
                cursor: "pointer", letterSpacing: ".03em",
              }}>
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Navegador + seletor de vista */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
                  style={{ background: T.card, border: `1px solid ${T.border}`, color: T.muted, padding: 10, cursor: "pointer" }}>
            <ChevronLeft size={16} />
          </button>
          <div style={{ fontFamily: T.serif, fontSize: 24, color: T.ink, fontWeight: 600, letterSpacing: "-0.02em", textTransform: "capitalize", minWidth: 180 }}>
            {vista === "mes"
              ? <>{months[month]} <span style={{ color: T.gold }}>{year}</span></>
              : tituloPeriodo}
          </div>
          <button onClick={() => navigate(1)}
                  style={{ background: T.card, border: `1px solid ${T.border}`, color: T.muted, padding: 10, cursor: "pointer" }}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle de vista */}
          <div style={{ display: "inline-flex", gap: 0, background: T.bgSoft, padding: 3, borderRadius: 16, border: `1px solid ${T.border}` }}>
            {[{ id: "mes", l: "Mês" }, { id: "semana", l: "Semana" }, { id: "dia", l: "Dia" }].map(o => {
              const ativo = vista === o.id;
              return (
                <button key={o.id} onClick={() => setVista(o.id)}
                  style={{
                    padding: "5px 12px", fontSize: 11, fontWeight: ativo ? 700 : 500,
                    background: ativo ? T.card : "transparent", color: ativo ? T.gold : T.muted,
                    border: ativo ? `1px solid ${T.gold}55` : "1px solid transparent",
                    borderRadius: 12, cursor: "pointer",
                  }}>{o.l}</button>
              );
            })}
          </div>
          <button onClick={() => { setModoGastos(v => !v); setVista("mes"); }}
                  title="Pinta os dias pela intensidade do gasto real — quanto mais escuro, mais saiu dinheiro"
                  style={{
                    padding: "5px 12px", fontSize: 11, fontWeight: modoGastos ? 700 : 500,
                    background: modoGastos ? `${T.red}22` : T.bgSoft,
                    color: modoGastos ? T.red : T.muted,
                    border: `1px solid ${modoGastos ? `${T.red}66` : T.border}`,
                    borderRadius: 16, cursor: "pointer",
                  }}>
            💸 Gastos
          </button>
          <button onClick={irHoje} className="btn-ghost">Hoje</button>
        </div>
      </div>

      {/* Barra do modo Gastos: filtro por categoria + resumo do mês */}
      {modoGastos && vista === "mes" && mapaGastos && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          background: T.card, border: `1px solid ${T.red}44`, borderLeft: `3px solid ${T.red}`,
          borderRadius: 12, padding: "8px 12px", marginBottom: 12,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: T.red }}>
            Mapa de gastos
          </span>
          <select value={catGasto} onChange={e => setCatGasto(e.target.value)}
                  style={{ width: "auto", padding: "5px 9px", fontSize: 12 }}>
            <option value="">Todas as categorias</option>
            {catsGastoOpcoes.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
          <span className="num" style={{ fontSize: 12, color: T.muted }}>
            Mês: <strong style={{ color: T.ink }}>{hidden ? "•••" : fmt(mapaGastos.total)}</strong>
            {mapaGastos.diaMax && (
              <> · pico dia <strong style={{ color: T.red }}>{mapaGastos.diaMax}</strong> ({hidden ? "•••" : fmt(mapaGastos.max)})</>
            )}
          </span>
          {(() => {
            const ins = insightFimDeSemana(mapaGastos.porDia, monthStrGastos);
            return ins ? (
              <span style={{
                fontSize: 11, fontWeight: 700, color: CORES_HEAT[3],
                border: `1px solid ${CORES_HEAT[3]}66`, background: `${CORES_HEAT[3]}14`,
                borderRadius: 100, padding: "3px 10px", whiteSpace: "nowrap",
              }}>
                {ins.tipo === "fds"
                  ? `🔥 fins de semana: ${String(ins.ratio).replace(".", ",")}× mais caros`
                  : `🔥 dias úteis: ${String(ins.ratio).replace(".", ",")}× mais caros`}
              </span>
            ) : null;
          })()}
          <span style={{ fontSize: 10.5, color: T.faint, marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}>
            menos
            {CORES_HEAT.map(c => (
              <span key={c} style={{ width: 12, height: 12, borderRadius: "50%", background: c }} />
            ))}
            mais
          </span>
        </div>
      )}

      {/* Vista Semana/Dia (grade de horários) */}
      {vista !== "mes" && (
        <CalendarioSemanaDia
          modo={vista}
          refDate={refDate}
          eventos={eventosAgendaVista}
          catMeta={catMeta}
          onSlot={novoEventoNoSlot}
          onEvento={(ev) => editarEvento(ev)}
        />
      )}

      {/* Vista Mês (grade mensal) */}
      {vista === "mes" && (<>
      {/* Calendar grid */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 16 }}>
        {/* Celular: células menores, valor compacto e sem o rótulo "N fin" —
            senão o mês não cabe em 7 colunas numa tela de 360px. */}
        <style>{`
          @media (max-width: 520px) {
            .cal-cell { min-height: 58px !important; padding: 3px !important; }
            .cal-net { font-size: 8.5px !important; letter-spacing: -0.02em; }
            .cal-fin { display: none !important; }
          }
        `}</style>
        <div className="grid grid-cols-7 gap-px mb-2" style={{ background: T.border }}>
          {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d => (
            <div key={d} style={{ background: T.bgSoft, padding: "8px 4px", textAlign: "center",
                                   color: T.muted, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 500 }}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px" style={{ background: T.border }}>
          {grid.map((d, idx) => {
            if (d === null) return <div key={idx} className="cal-cell" style={{ background: T.bgSoft, minHeight: 82 }} />;
            const info = cellInfoByDay[d] || {};
            const isHoje = isToday(d);
            const isSelected = d === selectedDay;
            const cor = info.atrasado ? T.red : (info.net > 0 ? T.green : info.net < 0 ? T.red : T.muted);
            // Modo Gastos: escala de fogo (marrom → laranja → rosa) pelo gasto do dia.
            const gastoDia = modoGastos ? mapaGastos?.porDia?.[d] : null;
            const heat = modoGastos && gastoDia ? corHeat(gastoDia.total, mapaGastos?.max || 0) : null;
            return (
              <button key={idx} className="cal-cell" onClick={() => setSelectedDay(isSelected ? null : d)}
                style={{
                  background: modoGastos
                    ? (heat || T.bgSoft)
                    : (isSelected ? T.cardHi : (isHoje ? `${T.gold}11` : T.bgSoft)),
                  outline: modoGastos && isSelected ? "2px solid #fff" : "none",
                  outlineOffset: modoGastos && isSelected ? -2 : 0,
                  borderRadius: modoGastos && heat ? 10 : 0,
                  minHeight: 82, padding: 6, textAlign: "left", cursor: "pointer",
                  border: isHoje ? `2px solid ${T.gold}` : "none",
                  position: "relative", overflow: "hidden",
                  transition: "background 0.2s",
                  display: "flex", flexDirection: "column",
                }}>
                <div className="num" style={{
                  color: modoGastos && heat ? "#fff" : (isHoje ? T.gold : T.ink),
                  fontSize: 13, fontWeight: isHoje || (modoGastos && heat) ? 700 : 500,
                  marginBottom: 2,
                }}>
                  {d}
                </div>
                {modoGastos ? (
                  gastoDia && (
                    <div style={{ textAlign: "left", marginTop: "auto" }}
                         title={`${fmt(gastoDia.total)} em ${gastoDia.itens} lançamento(s)${gastoDia.top?.[0] ? ` · maior: ${gastoDia.top[0].nome}` : ""}`}>
                      <div className="num cal-net" style={{ fontSize: 12.5, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>
                        {hidden ? "•••" : (gastoDia.total >= 1000 ? `${(gastoDia.total / 1000).toFixed(1).replace(".", ",")}k` : Math.round(gastoDia.total))}
                      </div>
                      <div className="cal-fin" style={{ fontSize: 9, color: "rgba(255,255,255,.75)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {gastoDia.top?.[0]?.nome || ""}
                      </div>
                    </div>
                  )
                ) : info.net != null && (
                  <div style={{ textAlign: "center", marginTop: 6 }}>
                    <div className="num cal-net" style={{
                      fontSize: 11, fontWeight: 600, color: cor, lineHeight: 1.1,
                    }}>
                      {info.net > 0 ? "+ " : info.net < 0 ? "− " : ""}{hidden ? "•••" : fmt(Math.abs(info.net))}
                    </div>
                    <div className="cal-fin" style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>
                      {info.itensFin} fin
                      {info.atrasado && <span style={{ color: T.red, marginLeft: 3 }}>⚠</span>}
                    </div>
                  </div>
                )}
                {info.coresAgenda?.length > 0 && (
                  <div style={{ display: "flex", gap: 3, justifyContent: "center", marginTop: "auto", paddingTop: 4 }}>
                    {info.coresAgenda.map((c, i) => (
                      <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
                    ))}
                    {info.itensAgenda > 3 && (
                      <span style={{ fontSize: 10, color: T.muted, marginLeft: 2 }}>+{info.itensAgenda - 3}</span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day details */}
      {selectedDay && (
        <div className="mt-6" style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }}>
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <div>
              <div className="label-eyebrow">Dia selecionado</div>
              <h3 style={{ fontFamily: T.serif, fontSize: 24, color: T.ink, marginTop: 4, fontWeight: 600 }}>
                {selectedDay} de {months[month]} de {year}
              </h3>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => novoEvento(selectedDay)} className="btn-gold" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Plus size={12} /> Evento
              </button>
              <button onClick={() => setSelectedDay(null)} style={{ color: T.muted, background: "transparent", border: "none", cursor: "pointer", padding: 8 }}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modo Gastos: o que saiu de dinheiro NESTE dia (transações reais) */}
          {modoGastos && (
            dayGastos.length === 0 ? (
              <div style={{ color: T.muted, fontStyle: "italic", marginBottom: dayEventos.length || dayFinanceiros.length ? 16 : 0 }}>
                Nenhum gasto registrado neste dia{catGasto ? ` em ${catGasto}` : ""}.
              </div>
            ) : (
              <div style={{ marginBottom: dayEventos.length || dayFinanceiros.length ? 20 : 0 }}>
                <div className="label-eyebrow" style={{ marginBottom: 8, color: T.red }}>
                  💸 Gastos do dia{catGasto ? ` · ${catGasto}` : ""} — {hidden ? "•••" : fmt(dayGastos.reduce((s, t) => s + (Number(t.valor) || 0), 0))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {dayGastos.map(t => (
                    <div key={t.id} style={{
                      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                      padding: "8px 12px", background: T.bgSoft, borderRadius: 12,
                      borderLeft: `3px solid ${T.red}`,
                    }}>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>{t.descricao}</div>
                        <div style={{ fontSize: 10.5, color: T.muted }}>
                          {t.categoria || "Sem categoria"}{t.subcategoria ? ` · ${t.subcategoria}` : ""}{t.conta ? ` · ${t.conta}` : ""}
                          {t.status === "paga" ? <span style={{ color: T.green }}> · ✓ paga</span> : t.status ? <span style={{ color: T.gold }}> · pendente</span> : ""}
                        </div>
                      </div>
                      <div className="num" style={{ color: T.red, fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap" }}>
                        {hidden ? "•••" : fmt(t.valor)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {dayEventos.length === 0 && dayFinanceiros.length === 0 ? (
            !modoGastos && <div style={{ color: T.muted, fontStyle: "italic" }}>Nada agendado para este dia.</div>
          ) : (
            <>
              {/* Eventos pessoais primeiro */}
              {dayEventos.length > 0 && (
                <>
                  <div className="label-eyebrow" style={{ marginBottom: 8 }}>Compromissos · Pessoal</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: dayFinanceiros.length > 0 ? 20 : 0 }}>
                    {dayEventos.map(ev => {
                      const meta = catMeta(ev.categoria);
                      const Icon = meta.icon;
                      const feito = ev.status === "feito";
                      return (
                        <div key={ev.id} style={{
                          background: `${meta.cor}0d`,
                          border: `1px solid ${meta.cor}33`,
                          borderLeft: `4px solid ${meta.cor}`,
                          padding: 12, borderRadius: 12,
                          display: "flex", alignItems: "flex-start", gap: 10,
                          opacity: feito ? 0.55 : 1,
                        }}>
                          <div style={{
                            background: `${meta.cor}22`, color: meta.cor,
                            width: 32, height: 32, borderRadius: "50%",
                            display: "grid", placeItems: "center", flexShrink: 0,
                          }}>
                            <Icon size={14} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <strong style={{ fontSize: 14, color: T.ink, textDecoration: feito ? "line-through" : "none" }}>
                                {ev.titulo}
                              </strong>
                              <span style={{
                                fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
                                textTransform: "uppercase", color: meta.cor,
                                padding: "1px 6px", borderRadius: 8, background: `${meta.cor}22`,
                              }}>
                                {meta.label}
                              </span>
                            </div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, color: T.muted, marginTop: 4 }}>
                              {ev.horario && (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <Clock size={10} />{ev.horario}{ev.duracao ? ` · ${ev.duracao}min` : ""}
                                </span>
                              )}
                              {ev.local && (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <MapPin size={10} />{ev.local}
                                </span>
                              )}
                              {ev.link && (
                                <a href={ev.link} target="_blank" rel="noopener noreferrer"
                                   style={{ color: T.gold, display: "inline-flex", alignItems: "center", gap: 3 }}>
                                  <Link2 size={10} />Link
                                </a>
                              )}
                            </div>
                            {ev.descricao && (
                              <div style={{ fontSize: 12, color: T.muted, marginTop: 6, whiteSpace: "pre-wrap" }}>
                                {ev.descricao}
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                            <button onClick={() => marcarFeito(ev)}
                              title={feito ? "Desmarcar" : "Marcar como feito"}
                              style={{ background: feito ? T.green : "transparent", color: feito ? T.bg : T.muted, border: `1px solid ${feito ? T.green : T.border}`, width: 26, height: 26, borderRadius: 8, cursor: "pointer", display: "grid", placeItems: "center" }}>
                              <Check size={13} />
                            </button>
                            <button onClick={() => editarEvento(ev)} title="Editar"
                              style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, width: 26, height: 26, borderRadius: 8, cursor: "pointer", display: "grid", placeItems: "center" }}>
                              <Edit3 size={13} />
                            </button>
                            <button onClick={() => excluirEvento(ev)} title="Excluir"
                              style={{ background: "transparent", color: T.red, border: `1px solid ${T.border}`, width: 26, height: 26, borderRadius: 8, cursor: "pointer", display: "grid", placeItems: "center" }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Itens financeiros */}
              {dayFinanceiros.length > 0 && (
                <>
                  <div className="label-eyebrow" style={{ marginBottom: 8 }}>Vencimentos · Financeiro</div>
                  <div className="space-y-2">
                    {dayFinanceiros.map((t, i) => {
                      const cat = categorias.find(c => c.nome === t.categoria);
                      const isReceita = t._kind === "ganho";
                      const isPaga = t.status === "paga";
                      const isAtrasada = t.status === "atrasada";
                      const cor = isReceita ? T.green : T.red;
                      const tipoBadge = {
                        fixa:     { lbl: "Fixa",     cor: T.gold },
                        variavel: { lbl: "Variável", cor: T.muted },
                        parcela:  { lbl: "Parcela",  cor: T.blue || "#60a5fa" },
                        ganho:    { lbl: "Ganho",    cor: T.green },
                      }[t.tipo] || { lbl: t.tipo || "—", cor: T.muted };
                      const statusCfg = isAtrasada
                        ? { bg: `${T.red}22`, fg: T.red, lbl: "Em atraso", Icon: Bell }
                        : isPaga
                          ? { bg: `${cor}22`, fg: cor, lbl: isReceita ? "Recebido" : "Pago", Icon: isReceita ? ArrowUpRight : ArrowDownRight }
                          : { bg: `${T.gold}22`, fg: T.gold, lbl: "Aguardando", Icon: AlarmClock };
                      const Icon = statusCfg.Icon;
                      return (
                        <div key={t.id || i} className="flex items-center gap-3 py-3" style={{
                          borderBottom: `1px solid ${T.border}`,
                        }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: "50%",
                            background: statusCfg.bg, color: statusCfg.fg,
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          }}>
                            <Icon size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div style={{ color: T.ink, fontSize: 13, fontWeight: 600 }}>
                              {t.descricao}
                            </div>
                            <div className="flex gap-2 mt-1 flex-wrap text-xs">
                              <span style={{ background: `${tipoBadge.cor}22`, color: tipoBadge.cor, padding: "1px 6px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 8 }}>
                                {tipoBadge.lbl}
                              </span>
                              {cat && (
                                <span style={{ background: cat.cor + "22", color: cat.cor, padding: "1px 8px", fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 8 }}>
                                  {cat.nome}
                                </span>
                              )}
                              <span style={{ background: statusCfg.bg, color: statusCfg.fg, padding: "1px 8px", fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 8 }}>
                                {statusCfg.lbl}
                              </span>
                            </div>
                          </div>
                          <div className="num text-right" style={{ color: cor, fontSize: 15, fontWeight: 600 }}>
                            {isReceita ? "+" : "−"} {hidden ? "•••" : fmt(t.valor)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex items-center gap-4 flex-wrap" style={{ color: T.muted, fontSize: 12 }}>
        <div className="flex items-center gap-2">
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.green }} /> Receita
        </div>
        <div className="flex items-center gap-2">
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.red }} /> Despesa
        </div>
        {CATEGORIAS_AGENDA.map(c => (
          <div key={c.id} className="flex items-center gap-2">
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: c.cor }} /> {c.label}
          </div>
        ))}
      </div>
      </>)}

      {/* Modal novo/editar evento */}
      {eventoForm && (
        <Modal title={eventoForm.id ? "Editar evento" : "Novo evento"}
               onClose={() => { setEventoForm(null); setFormErrors({}); }}>
          <Field label="Título" required error={formErrors.titulo}>
            <input value={eventoForm.titulo}
                   onChange={e => setEventoForm({ ...eventoForm, titulo: e.target.value })}
                   placeholder="Ex.: Reunião com cliente, Voo São Paulo, Aniversário..."
                   autoFocus />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Data" required error={formErrors.data}>
              <input type="date" value={eventoForm.data}
                     onChange={e => setEventoForm({ ...eventoForm, data: e.target.value })} />
            </Field>
            <Field label="Horário (opcional)">
              <input type="time" value={eventoForm.horario}
                     onChange={e => setEventoForm({ ...eventoForm, horario: e.target.value })} />
            </Field>
            <Field label="Categoria">
              <select value={eventoForm.categoria}
                      onChange={e => setEventoForm({ ...eventoForm, categoria: e.target.value })}>
                {CATEGORIAS_AGENDA.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Duração (min, opcional)">
              <input type="number" min="0" value={eventoForm.duracao}
                     onChange={e => setEventoForm({ ...eventoForm, duracao: e.target.value })}
                     placeholder="ex.: 60" />
            </Field>
          </div>

          <Field label="Local (opcional)">
            <input value={eventoForm.local}
                   onChange={e => setEventoForm({ ...eventoForm, local: e.target.value })}
                   placeholder="Endereço, sala, link da call..." />
          </Field>

          <Field label="Link (opcional)">
            <input type="url" value={eventoForm.link}
                   onChange={e => setEventoForm({ ...eventoForm, link: e.target.value })}
                   placeholder="https://..." />
          </Field>

          <Field label="Descrição">
            <textarea value={eventoForm.descricao}
                      onChange={e => setEventoForm({ ...eventoForm, descricao: e.target.value })}
                      placeholder="Detalhes, agenda, anotações..."
                      rows={4}
                      style={{ resize: "vertical", fontFamily: "inherit" }} />
          </Field>

          <div className="flex gap-3 mt-6 flex-wrap">
            <button className="btn-gold" onClick={salvarEvento}>Salvar</button>
            <button className="btn-ghost" onClick={() => { setEventoForm(null); setFormErrors({}); }}>Cancelar</button>
            {eventoForm.id && (
              <button onClick={() => { excluirEvento(eventoForm); setEventoForm(null); }}
                style={{ marginLeft: "auto", background: "transparent", color: T.red, border: `1px solid ${T.red}`, padding: "10px 16px", fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Trash2 size={12} /> Excluir
              </button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
