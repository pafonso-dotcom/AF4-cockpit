import React, { useState, useRef } from "react";
import Logo, { NumviMark } from "./ui/Logo.jsx";
import { forcarAtualizacaoApp } from "../lib/appUpdate.js";
import { T, THEMES } from "../lib/theme.js";
import { getPerfilAtivo } from "../lib/perfis.js";
import { useLayout } from "../lib/useLayout.js";
import AlertCenter from "./AlertCenter.jsx";
import {
  Activity, Wallet, CreditCard, Receipt, Calendar, Tag, Sparkles, PiggyBank,
  Briefcase, TrendingUp, LineChart as LineIcon, Calculator, BarChart3,
  Package, Target, Users, AlertCircle, History, MessageCircle,
  Settings, Eye, EyeOff, RefreshCw, DollarSign, Sun, Moon,
  Radar, Bookmark, StickyNote, Home, CheckSquare, Lightbulb,
  Store, Car, Wrench, Search, ChevronDown, ChevronRight,
  BookOpen, Repeat, MoreHorizontal, RotateCw, LogOut,
  Bell, Dumbbell,
} from "lucide-react";

/**
 * Header NUMVI · v4 (refatorado pra hierarquia clara)
 *  Linha 1 (sempre): logo · separador · subtabs (scroll) · separador · quick actions · separador · utility · gap · settings · avatar
 *  Linha 2 (≥640px): módulos (Finanças/Invest)
 *  Mobile (<640px): linha 1 = logo + settings; linha 2 = subtabs scroll
 */
export default function Header(props) {
  const { isVertical } = useLayout();
  if (isVertical) return <HeaderVertical {...props} />;
  return <HeaderHorizontal {...props} />;
}

// Filhas da "matriz" Agenda — ficam ESCONDIDAS; só aparecem ao clicar na Agenda.
// O id da matriz na lista de subtabs é "inicio" (a aba Início da Agenda).
export const AGENDA_TABS = [
  { id: "inicio",     label: "Início",       icon: Home },
  { id: "calendario", label: "Calendário",   icon: Calendar },
  { id: "notas",      label: "Compromissos", icon: StickyNote },
  { id: "tarefas",    label: "Tarefas",      icon: CheckSquare },
  { id: "lembretes",  label: "Lembretes",    icon: Bell },
  { id: "conversa",   label: "Conversa",     icon: MessageCircle },
  { id: "treino",     label: "Treino",       icon: Dumbbell },
  { id: "metas",      label: "Metas",        icon: Target },
  { id: "compras",    label: "Compras",      icon: Tag },
  { id: "habitos",    label: "Hábitos",      icon: Repeat },
  { id: "diario",     label: "Diário",       icon: BookOpen },
  { id: "ideias",     label: "Ideias",       icon: Sparkles },
  { id: "sugestoes",  label: "Sugestões",    icon: Lightbulb },
];
const AGENDA_TAB_IDS = new Set(AGENDA_TABS.map(t => t.id));

/* ===== Ordem das abas (arrastar pra reordenar) — persistida por grupo em localStorage ===== */
const TAB_ORDER_KEY = "af4.taborder.v1";
function loadTabOrders() {
  try { return JSON.parse(localStorage.getItem(TAB_ORDER_KEY) || "{}") || {}; } catch { return {}; }
}
// Reordena `items` (com .id) conforme a lista de ids salva. Abas novas (sem ordem
// salva) vão pro fim na ordem original; ids que não existem mais são ignorados.
function aplicarOrdem(items, ordem) {
  if (!Array.isArray(ordem) || !ordem.length) return items;
  const porId = new Map(items.map(it => [it.id, it]));
  const out = [];
  ordem.forEach(id => { if (porId.has(id)) { out.push(porId.get(id)); porId.delete(id); } });
  items.forEach(it => { if (porId.has(it.id)) out.push(it); });
  return out;
}

/* Toggle global de escopo · Pessoal / Negócio / Tudo */
function EscopoToggle({ escopoAtivo = "tudo", onEscopoChange, compact }) {
  const opcoes = [
    { id: "pessoal", lbl: "Pessoal", icon: "👤" },
    { id: "negocio", lbl: "Negócio", icon: "🏢" },
    { id: "tudo",    lbl: "Tudo",    icon: "📊" },
  ];
  return (
    <div style={{
      display: "inline-flex", gap: 2, padding: 2,
      background: "rgba(255,255,255,.06)", borderRadius: 11,
      marginRight: compact ? 6 : 10,
    }}>
      {opcoes.map(esc => {
        const ativo = escopoAtivo === esc.id;
        return (
          <button key={esc.id}
            onClick={() => onEscopoChange?.(esc.id)}
            title={`Ver dados: ${esc.lbl}`}
            style={{
              padding: compact ? "3px 7px" : "4px 9px",
              fontSize: compact ? 9.5 : 10, fontWeight: 600,
              letterSpacing: ".05em", textTransform: "uppercase",
              borderRadius: 4, border: "none", cursor: "pointer",
              background: ativo ? "rgba(255,255,255,.18)" : "transparent",
              color: ativo ? "#fff" : "rgba(255,255,255,.6)",
              display: "inline-flex", alignItems: "center", gap: 4,
              whiteSpace: "nowrap",
            }}>
            <span>{esc.icon}</span>
            {!compact && <span>{esc.lbl}</span>}
          </button>
        );
      })}
    </div>
  );
}

function HeaderHorizontal({
  modulo, setModulo,
  tab, setTab,
  hidden, setHidden,
  escopoAtivo, onEscopoChange,
  onRefresh, refreshing,
  onOpenSettings,
  onOpenPalette,
  onQuickAction,
  pendingCounts = {},
  contas = [], cartoes = [],
  contaAberta, setContaAberta,
  cartaoAberto, setCartaoAberto,
  alertData = {}, onNavegar,
}) {

  const perfilAtivo = getPerfilAtivo();
  const perms = perfilAtivo?.permissoes || { financas: true, invest: true, trade: true, config: true };

  // Barra de bancos/cartões começa RECOLHIDA — abre só ao clicar no rótulo.
  const [listaItensAberta, setListaItensAberta] = useState(false);
  // Menu "⋯" agrupa os utilitários (busca/ocultar/tema/atualizar) no topo.
  const [menuUtilAberto, setMenuUtilAberto] = useState(false);

  const TODOS_MODULOS = [
    { id: "financas", label: "Finanças",      icon: Wallet,    desc: "Pessoal" },
    { id: "invest",   label: "Investimentos", icon: Briefcase, desc: "Carteira" },
    { id: "negocio",  label: "Negócio",       icon: Store,     desc: "Operação" },
  ];
  const MODULOS = TODOS_MODULOS.filter(m => perms[m.id] !== false);

  const SUBTABS = {
    financas: [
      { id: "dashboard",    label: "Painel",       icon: Activity },
      { id: "contas",       label: "Contas",       icon: Wallet },
      { id: "cartoes",      label: "Cartões",      icon: CreditCard },
      { id: "transacoes",   label: "Transações",   icon: Receipt },
      { id: "planejamento", label: "Planejamento", icon: Target },
      { id: "categorias",   label: "Categorias",   icon: Tag },
      { id: "perguntar",    label: "Pergunte ao Claude", icon: Sparkles },
      { id: "relatorios-f", label: "Relatórios",   icon: BarChart3 },
      { id: "audit",        label: "Histórico",    icon: History },
      // "Agenda" é uma matriz: agrupa as abas de vida (filhas em AGENDA_TABS),
      // que ficam escondidas até clicar aqui.
      { id: "inicio",       label: "Agenda",       icon: Calendar, agenda: true },
    ],
    invest: [
      { id: "investimentos",  label: "Painel",              icon: BarChart3 },
      { id: "carteira",       label: "Carteira",            icon: Briefcase },
      { id: "objetivos",      label: "Objetivos (árvore)", icon: Target },
      { id: "monte-carteira", label: "Monte sua Carteira",  icon: Package },
      { id: "calc-renda",     label: "Calculadora",         icon: Calculator },
      { id: "projecao",       label: "Projeção",            icon: Calculator },
      { id: "analises",       label: "Análises",            icon: Radar },
      { id: "proventos",      label: "Proventos",           icon: DollarSign },
      { id: "mercado",        label: "Mercado",             icon: LineIcon },
      { id: "relatorios-i",   label: "Relatórios",          icon: BarChart3 },
    ],
    negocio: [
      { id: "negocio-painel",   label: "Painel",   icon: Store },
      { id: "negocio-veiculos", label: "Veículos", icon: Car },
      { id: "negocio-servicos", label: "Serviços", icon: Wrench },
      { id: "negocio-clientes", label: "Clientes", icon: Users },
    ],
    config: [
      { id: "cfg-aparencia", label: "Aparência",    icon: Sparkles },
      { id: "cfg-apis",      label: "APIs",         icon: Settings },
      { id: "cfg-modulos",   label: "Módulos",      icon: Package },
      { id: "cfg-backup",    label: "Backup",       icon: RefreshCw },
    ],
  };

  // ===== Reordenação por arrastar (módulo + agenda) =====
  const [tabOrders, setTabOrders] = useState(loadTabOrders);
  const dragRef = useRef({ grupo: null, id: null });
  const salvarOrdens = (next) => {
    setTabOrders(next);
    try { localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(next)); } catch {}
  };
  // Move o item arrastado para a posição do item sob o cursor, dentro do MESMO grupo.
  const reordenar = (grupo, itens, overId) => {
    const { grupo: gFrom, id: fromId } = dragRef.current;
    if (gFrom !== grupo || !fromId || fromId === overId) return;
    const ids = itens.map(i => i.id);
    const fromIdx = ids.indexOf(fromId);
    const toIdx = ids.indexOf(overId);
    if (fromIdx < 0 || toIdx < 0) return;
    ids.splice(toIdx, 0, ids.splice(fromIdx, 1)[0]);
    salvarOrdens({ ...tabOrders, [grupo]: ids });
  };
  // Move uma aba uma posição pra esquerda (-1) ou direita (+1) — alternativa
  // ao arrastar, melhor no celular (toque). Usado pelas setas ◀▶ da aba ativa.
  const moverAba = (grupo, itens, id, dir) => {
    const ids = itens.map(i => i.id);
    const idx = ids.indexOf(id);
    const alvo = idx + dir;
    if (idx < 0 || alvo < 0 || alvo >= ids.length) return;
    [ids[idx], ids[alvo]] = [ids[alvo], ids[idx]];
    salvarOrdens({ ...tabOrders, [grupo]: ids });
  };
  // Renderiza as setas de reordenar dentro da aba ativa (spans, não <button>,
  // pra não aninhar botões). Para a propagação pra não re-navegar.
  const renderSetas = (grupo, itens, id) => {
    const idx = itens.findIndex(i => i.id === id);
    const seta = (dir, char, label, off) => (
      <span role="button" aria-label={label} title={label}
        onClick={(e) => { e.stopPropagation(); moverAba(grupo, itens, id, dir); }}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ cursor: "pointer", padding: "0 3px", fontSize: 11, lineHeight: 1, opacity: off ? 0.25 : 0.85, userSelect: "none" }}>
        {char}
      </span>
    );
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 1, marginLeft: 4 }}>
        {seta(-1, "◀", "Mover para a esquerda", idx <= 0)}
        {seta(+1, "▶", "Mover para a direita", idx >= itens.length - 1)}
      </span>
    );
  };

  // Props de drag pra cada botão de aba.
  const dragProps = (grupo, itens, id) => ({
    draggable: true,
    onDragStart: (e) => { dragRef.current = { grupo, id }; e.dataTransfer.effectAllowed = "move"; },
    onDragOver: (e) => { if (dragRef.current.grupo === grupo) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } },
    onDrop: (e) => { e.preventDefault(); reordenar(grupo, itens, id); dragRef.current = { grupo: null, id: null }; },
    onDragEnd: () => { dragRef.current = { grupo: null, id: null }; },
  });

  const subtabs = aplicarOrdem(SUBTABS[modulo] || SUBTABS.financas, tabOrders[`mod:${modulo}`]);
  const agendaTabs = aplicarOrdem(AGENDA_TABS, tabOrders.agenda);

  // Cores fixas pro nav: o fundo do nav é SEMPRE escuro (rgba(10,10,12,.92)),
  // então o texto precisa ser SEMPRE claro — independente do tema (Pérola, Papel, Linho).
  // Sem isso, em temas claros T.ink fica preto e some no fundo escuro do nav.
  const NAV_INK   = "#f5f5f7";
  const NAV_MUTED = "#a8a8b0";
  const NAV_FAINT = "#6e6e78";
  const NAV_BORDER = "rgba(255,255,255,0.08)";
  const NAV_SOFT   = "rgba(255,255,255,0.05)";

  // Estilo padrão dos botões utility (Eye/Sun/Refresh) — área de toque 40x40
  const utilBtn = {
    width: 40, height: 40, padding: 0,
    background: NAV_SOFT, border: `1px solid ${NAV_BORDER}`,
    color: NAV_MUTED, borderRadius: 16, cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    transition: "background .15s, color .15s, border-color .15s",
  };

  const sep = (
    <div aria-hidden style={{
      width: 1, height: 24, background: NAV_BORDER, opacity: 0.8,
      margin: "0 4px", flexShrink: 0,
    }} className="util-cluster" />
  );

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 50,
      // Grafite elegante (tom grafite) — fixo, independe da paleta.
      background: "#2d323b", backdropFilter: "blur(14px)",
      borderBottom: `1px solid ${NAV_BORDER}`,
    }}>
      {/* ============== LINHA 1 · brand · ações · utility ============== */}
      <div style={{
        maxWidth: 1280, margin: "0 auto",
        padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      }}>
        {/* BRAND · marca NUMVI */}
        <div style={{ display: "flex", alignItems: "center", marginRight: "auto", flexShrink: 0 }}>
          {/* Mobile: só o nome (sem símbolo). Desktop: lockup completo. */}
          <span className="hide-desktop" style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
            <span style={{ color: "#9E2B3A" }}>A</span><span style={{ color: "#E8C25A" }}>finanças</span>
          </span>
          <span className="header-brand-text"><Logo size={24} sufixo="·finanças" /></span>
        </div>

        {sep}

        {/* Quick actions removidas — agora via atalhos de teclado N/V/A.
            Pressione ? pra ver lista de atalhos. */}

        {/* UTILITY · sino + menu "⋯". Escondem só em RETRATO no celular; em
            paisagem (e desktop) aparecem normalmente. */}
        <div className="util-cluster" style={{ display: "inline-flex", gap: 8, alignItems: "center", position: "relative" }}>
          <AlertCenter {...alertData} onNavegar={onNavegar} btnStyle={utilBtn} iconSize={18} />
          <button onClick={() => setMenuUtilAberto(v => !v)}
                  title="Mais ações" aria-label="Mais ações"
                  className="hdr-util" style={{ ...utilBtn, background: menuUtilAberto ? `${T.gold}22` : NAV_SOFT, color: menuUtilAberto ? T.gold : NAV_MUTED }}>
            <MoreHorizontal size={20} />
          </button>
          {menuUtilAberto && (
            <>
              <div onClick={() => setMenuUtilAberto(false)} style={{ position: "fixed", inset: 0, zIndex: 90 }} />
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 91,
                background: "#2d323b", border: `1px solid ${NAV_BORDER}`, borderRadius: 16,
                padding: 6, minWidth: 190, boxShadow: "0 12px 28px rgba(0,0,0,.4)",
                display: "flex", flexDirection: "column", gap: 2,
              }}>
                {[
                  { lbl: "Busca rápida", icon: Search, on: () => { onOpenPalette?.(); setMenuUtilAberto(false); } },
                  { lbl: hidden ? "Mostrar valores" : "Ocultar valores", icon: hidden ? EyeOff : Eye, on: () => { setHidden(!hidden); setMenuUtilAberto(false); } },
                  { lbl: T.dark ? "Tema claro" : "Tema escuro", icon: T.dark ? Sun : Moon, on: () => { onOpenSettings?.("toggle-tema"); setMenuUtilAberto(false); } },
                  { lbl: refreshing ? "Atualizando…" : "Atualizar cotações", icon: RefreshCw, on: () => { onRefresh?.(); setMenuUtilAberto(false); } },
                  { lbl: "Atualizar app (nova versão)", icon: RotateCw, on: () => { setMenuUtilAberto(false); forcarAtualizacaoApp(); } },
                  { lbl: "Sair do app", icon: LogOut, danger: true, on: () => { setMenuUtilAberto(false); window.__af4Logout?.(); } },
                ].map(it => {
                  const I = it.icon;
                  return (
                    <button key={it.lbl} onClick={it.on}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "9px 11px",
                        background: "transparent", border: "none", borderRadius: 12, cursor: "pointer",
                        color: it.danger ? "#f87171" : NAV_INK, fontSize: 13, textAlign: "left", fontFamily: T.sans, width: "100%",
                        borderTop: it.danger ? `1px solid ${NAV_BORDER}` : "none", marginTop: it.danger ? 2 : 0,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = it.danger ? "rgba(248,113,113,.12)" : "rgba(255,255,255,.06)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <I size={15} style={{ color: it.danger ? "#f87171" : NAV_MUTED }} /> {it.lbl}
                    </button>
                  );
                })}
                <div style={{
                  marginTop: 4, paddingTop: 6, borderTop: `1px solid ${NAV_BORDER}`,
                  fontSize: 10.5, color: NAV_FAINT, textAlign: "center", fontVariantNumeric: "tabular-nums",
                }}>
                  versão {typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev"}
                </div>
              </div>
            </>
          )}
        </div>

        {/* SETTINGS · sempre na extremidade direita, com margin-left extra */}
        <div style={{ display: "inline-flex", gap: 10, alignItems: "center", marginLeft: 12 }}>
          <button onClick={() => { setModulo("config"); setTab("cfg-aparencia"); }}
                  title="Configurações"
                  className="hdr-util"
                  style={{
                    ...utilBtn,
                    background: modulo === "config" ? `${T.gold}22` : NAV_SOFT,
                    border: `1px solid ${modulo === "config" ? T.gold : NAV_BORDER}`,
                    color: modulo === "config" ? T.gold : NAV_MUTED,
                  }}>
            <Settings size={20} />
          </button>
          <button onClick={() => onOpenSettings?.("perfis")}
                  title={`Perfil ativo: ${perfilAtivo?.nome || "—"} · clique pra gerenciar`}
                  style={{
                    padding: 0, width: 36, height: 36, borderRadius: "50%",
                    background: perfilAtivo?.cor || T.gold,
                    color: T.bg, border: `2px solid ${T.border}`,
                    fontWeight: 700, fontSize: 14, cursor: "pointer",
                    display: "grid", placeItems: "center", flexShrink: 0,
                  }}>
            {(perfilAtivo?.nome || "?").charAt(0).toUpperCase()}
          </button>
        </div>
      </div>

      {/* ============== LINHA 2 · módulos (sempre visível, scroll horizontal no mobile) ============== */}
      <div className="hdr-modules-row" style={{
        background: NAV_SOFT, borderTop: `1px solid ${NAV_BORDER}`, padding: "0 16px",
      }}>
        <div data-subnav style={{
          maxWidth: 1280, margin: "0 auto",
          display: "flex", gap: 6, overflowX: "auto", padding: "8px 0",
        }}>
          {MODULOS.map(m => {
            const Icon = m.icon;
            const active = modulo === m.id;
            return (
              <button key={m.id} onClick={() => {
                setModulo(m.id);
                const firstTab = SUBTABS[m.id]?.[0]?.id;
                if (firstTab) setTab(firstTab);
              }}
                style={{
                  padding: "9px 16px", borderRadius: 14,
                  background: active ? "rgba(255,255,255,0.10)" : "transparent",
                  color: active ? NAV_INK : NAV_MUTED,
                  border: `1px solid ${active ? NAV_BORDER : "transparent"}`,
                  fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: active ? 700 : 600,
                  display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
                  cursor: "pointer", transition: "all .2s", fontFamily: T.sans,
                }}>
                <Icon size={14} /> {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============== LINHA 3 · subtabs do módulo ativo (sempre visível) ============== */}
      <div className="hdr-subtabs-row" style={{
        borderTop: `1px solid ${NAV_BORDER}`, padding: "0 16px",
      }}>
        <div data-subnav style={{
          maxWidth: 1280, margin: "0 auto",
          display: "flex", gap: 2, overflowX: "auto", alignItems: "center",
        }}>
          {subtabs.map(st => {
            const Icon = st.icon;
            // A matriz Agenda fica "ativa" quando qualquer filha está aberta.
            const active = st.agenda ? AGENDA_TAB_IDS.has(tab) : tab === st.id;
            const pending = pendingCounts[st.id] || 0;
            return (
              <button key={st.id}
                onClick={() => setTab(st.id)}
                title={`${st.label} — arraste para reordenar`}
                {...dragProps(`mod:${modulo}`, subtabs, st.id)}
                style={{
                  position: "relative",
                  padding: "9px 12px",
                  background: active ? `${T.gold}1a` : "transparent",
                  color: active ? T.gold : NAV_MUTED,
                  borderTop: "none", borderLeft: "none", borderRight: "none",
                  borderBottom: `2px solid ${active ? T.gold : "transparent"}`,
                  fontSize: 13, letterSpacing: ".01em", fontWeight: active ? 600 : 400,
                  display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                  cursor: "grab", transition: "color .15s, background .15s, border-color .15s",
                  fontFamily: "'Nunito', system-ui, sans-serif", borderRadius: "6px 6px 0 0",
                }}>
                <Icon size={13} /> {st.label}
                {st.agenda && (
                  <span style={{ fontSize: 9, opacity: .8, marginLeft: 1, transform: active ? "rotate(90deg)" : "none", transition: "transform .15s", display: "inline-block" }}>▸</span>
                )}
                {pending > 0 && (
                  <span style={{
                    background: T.red, color: "#fff",
                    fontSize: 9, padding: "1px 6px", borderRadius: 100, marginLeft: 2,
                    fontWeight: 700,
                  }}>{pending}</span>
                )}
                {active && renderSetas(`mod:${modulo}`, subtabs, st.id)}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== Sub-abas da matriz Agenda — escondidas; só aparecem ao abrir a Agenda ===== */}
      {AGENDA_TAB_IDS.has(tab) && (
        <div style={{ borderTop: `1px solid ${NAV_BORDER}`, padding: "0 16px", background: NAV_SOFT }}>
          <div style={{
            maxWidth: 1280, margin: "0 auto",
            display: "flex", gap: 4, overflowX: "auto", padding: "6px 0", alignItems: "center",
          }}>
            <span style={{ fontSize: 9.5, color: NAV_FAINT, letterSpacing: ".2em", textTransform: "uppercase", whiteSpace: "nowrap", paddingRight: 4 }}>
              Agenda ·
            </span>
            {agendaTabs.map(st => {
              const Icon = st.icon;
              const active = tab === st.id;
              return (
                <button key={st.id} onClick={() => setTab(st.id)} title={`${st.label} — arraste para reordenar`}
                  {...dragProps("agenda", agendaTabs, st.id)}
                  style={{
                    padding: "5px 12px", borderRadius: 14,
                    background: active ? `${T.gold}22` : NAV_SOFT,
                    color: active ? T.gold : NAV_MUTED,
                    border: `1px solid ${active ? T.gold : NAV_BORDER}`,
                    fontSize: 11.5, fontWeight: 500, cursor: "grab", whiteSpace: "nowrap",
                    fontFamily: T.sans, display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
                  <Icon size={12} /> {st.label}
                  {active && renderSetas("agenda", agendaTabs, st.id)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ============== LINHA 4 · árvore (filhos) de Contas / Cartões ============== */}
      {((tab === "contas" && contas.length > 0 && setContaAberta) ||
        (tab === "cartoes" && cartoes.length > 0 && setCartaoAberto)) && (
        <div style={{ borderTop: `1px solid ${NAV_BORDER}`, padding: "0 16px" }}>
          <div style={{
            maxWidth: 1280, margin: "0 auto",
            display: "flex", gap: 6, overflowX: "auto", padding: "6px 0", alignItems: "center",
          }}>
            {/* Rótulo clicável: recolhe/expande a lista de bancos/cartões */}
            <button
              onClick={() => setListaItensAberta(v => !v)}
              aria-expanded={listaItensAberta}
              title={listaItensAberta ? "Recolher" : "Mostrar"}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                fontSize: 9.5, color: NAV_FAINT, letterSpacing: ".2em", textTransform: "uppercase",
                whiteSpace: "nowrap", paddingRight: 4, display: "inline-flex", alignItems: "center", gap: 5,
                fontFamily: T.sans, fontWeight: 600,
              }}>
              <span style={{ display: "inline-block", transform: listaItensAberta ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▸</span>
              {tab === "contas" ? "Bancos" : "Cartões"}
              <span style={{ color: NAV_MUTED }}>({(tab === "contas" ? contas : cartoes).length})</span>
            </button>
            {listaItensAberta && (tab === "contas" ? contas : cartoes).map(c => {
              const ativo = tab === "contas"
                ? contaAberta?.id === c.id
                : cartaoAberto?.id === c.id;
              return (
                <button key={c.id}
                  onClick={() => tab === "contas" ? setContaAberta(c) : setCartaoAberto(c)}
                  style={{
                    padding: "5px 12px", borderRadius: 14,
                    background: ativo ? `${T.gold}22` : NAV_SOFT,
                    color: ativo ? T.gold : NAV_MUTED,
                    border: `1px solid ${ativo ? T.gold : NAV_BORDER}`,
                    fontSize: 11.5, fontWeight: 500,
                    cursor: "pointer", whiteSpace: "nowrap",
                    fontFamily: T.sans,
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
                  {tab === "contas" && c.cor && (
                    <span style={{ width: 7, height: 7, borderRadius: 1.5, background: c.cor, flexShrink: 0 }} />
                  )}
                  {c.nome}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .hdr-util:hover:not(:disabled) {
          background: ${T.gold}22 !important;
          color: ${T.gold} !important;
          border-color: ${T.gold}55 !important;
        }
        .show-mobile { display: none; }
        /* Sino + menu "⋯" aparecem também no celular em retrato (utilitários: buscar,
           ocultar valores, tema, atualizar). Em telas bem estreitas, a linha quebra. */
        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .show-mobile { display: block; }
          /* Quick actions seguem visíveis (linha 1) mas só com ícone */
          .quick-actions .qbtn-collapsible { padding: 9px 11px !important; }
          .quick-actions .qbtn-collapsible .qbtn-text { display: none !important; }
          .header-subtitle { display: none; }

          /* No celular a linha de módulos vai pro BottomTabBar — escondida aqui pra
             ganhar espaço vertical no topo. */
          .hdr-modules-row { display: none !important; }
          .hdr-subtabs-row { padding: 0 10px !important; }
          .hdr-subtabs-row > div { padding: 0 !important; }
          .hdr-subtabs-row button {
            padding: 8px 12px !important;
            font-size: 11px !important;
          }
        }
      `}</style>
    </nav>
  );
}

/* ============================================================
   QuickBtn — botão de ação rápida com texto que some em telas <1024px
   ============================================================ */
function QuickBtn({ children, onClick, title, bg, fg, labelHide }) {
  return (
    <button onClick={onClick} title={title}
      className={labelHide ? "qbtn-collapsible" : ""}
      style={{
        padding: "9px 14px",
        background: bg,
        color: fg, border: "none", borderRadius: 16,
        fontSize: 11.5, letterSpacing: ".08em", textTransform: "uppercase",
        fontWeight: 600, cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
        boxShadow: "0 1px 0 rgba(0,0,0,.15)",
      }}>
      ＋ <span className="qbtn-text">{children}</span>
      <style>{`
        @media (max-width: 1024px) {
          .qbtn-collapsible .qbtn-text { display: none; }
          .qbtn-collapsible { padding: 9px 11px; }
        }
      `}</style>
    </button>
  );
}

/* ============================================================
   HeaderVertical — sidebar fixa 220px à esquerda + topbar fina
   ============================================================ */
function HeaderVertical({
  modulo, setModulo,
  tab, setTab,
  hidden, setHidden,
  escopoAtivo, onEscopoChange,
  onRefresh, refreshing,
  onOpenSettings,
  onOpenPalette,
  pendingCounts = {},
  contas = [], cartoes = [],
  contaAberta, setContaAberta,
  cartaoAberto, setCartaoAberto,
  alertData = {}, onNavegar,
}) {
  const perfilAtivo = getPerfilAtivo();
  const perms = perfilAtivo?.permissoes || { financas: true, invest: true, trade: true, config: true };

  const TODOS_MODULOS = [
    { id: "financas", label: "Finanças",      icon: Wallet },
    { id: "invest",   label: "Investimentos", icon: Briefcase },
    { id: "negocio",  label: "Negócio",       icon: Store },
  ];
  const MODULOS = TODOS_MODULOS.filter(m => perms[m.id] !== false);

  const SUBTABS = {
    financas: [
      { id: "dashboard",    label: "Painel",       icon: Activity },
      { id: "contas",       label: "Contas",       icon: Wallet },
      { id: "cartoes",      label: "Cartões",      icon: CreditCard },
      { id: "transacoes",   label: "Transações",   icon: Receipt },
      { id: "planejamento", label: "Planejamento", icon: Target },
      { id: "categorias",   label: "Categorias",   icon: Tag },
      { id: "perguntar",    label: "Pergunte ao Claude", icon: Sparkles },
      { id: "relatorios-f", label: "Relatórios",   icon: BarChart3 },
      { id: "audit",        label: "Histórico",    icon: History },
      // "Agenda" é uma matriz: agrupa as abas de vida (filhas em AGENDA_TABS),
      // que ficam escondidas até clicar aqui.
      { id: "inicio",       label: "Agenda",       icon: Calendar, agenda: true },
    ],
    invest: [
      { id: "investimentos",  label: "Painel",              icon: BarChart3 },
      { id: "carteira",       label: "Carteira",            icon: Briefcase },
      { id: "objetivos",      label: "Objetivos (árvore)", icon: Target },
      { id: "monte-carteira", label: "Monte sua Carteira",  icon: Package },
      { id: "calc-renda",     label: "Calculadora",         icon: Calculator },
      { id: "projecao",       label: "Projeção",            icon: Calculator },
      { id: "analises",       label: "Análises",            icon: Radar },
      { id: "proventos",      label: "Proventos",           icon: DollarSign },
      { id: "mercado",        label: "Mercado",             icon: LineIcon },
      { id: "relatorios-i",   label: "Relatórios",          icon: BarChart3 },
    ],
    negocio: [
      { id: "negocio-painel",   label: "Painel",   icon: Store },
      { id: "negocio-veiculos", label: "Veículos", icon: Car },
      { id: "negocio-servicos", label: "Serviços", icon: Wrench },
      { id: "negocio-clientes", label: "Clientes", icon: Users },
    ],
    config: [
      { id: "cfg-aparencia", label: "Aparência", icon: Sparkles },
      { id: "cfg-apis",      label: "APIs",      icon: Settings },
      { id: "cfg-modulos",   label: "Módulos",   icon: Package },
      { id: "cfg-backup",    label: "Backup",    icon: RefreshCw },
    ],
  };

  const subtabs = SUBTABS[modulo] || SUBTABS.financas;
  const moduloAtivo = TODOS_MODULOS.find(m => m.id === modulo) || { label: modulo };

  const NAV_BG = "#2d323b";
  const NAV_INK = "#f5f5f7";
  const NAV_MUTED = "#a8a8b0";
  const NAV_BORDER = "rgba(255,255,255,0.08)";

  // Acordeão: começa com TODOS fechados; abre um por vez ao clicar no módulo.
  const [expandido, setExpandido] = useState(null);
  const abrirModulo = (m) => {
    if (m.id !== modulo) {
      setModulo(m.id);
      const first = SUBTABS[m.id]?.[0]?.id;
      if (first) setTab(first);
      setExpandido(m.id);
    } else {
      // Clicar no módulo já ativo abre/fecha as sub-abas.
      setExpandido(prev => (prev === m.id ? null : m.id));
    }
  };

  return (
    <>
      <aside className="hdr-vertical-aside" style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: 220,
        background: NAV_BG, color: NAV_INK,
        padding: "16px 14px",
        overflowY: "auto", zIndex: 100,
        display: "flex", flexDirection: "column", gap: 16,
        borderRight: `1px solid ${NAV_BORDER}`,
        backdropFilter: "blur(14px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Logo size={20} />
        </div>

        <div>
          <div style={{ fontSize: 9, color: NAV_MUTED, letterSpacing: ".2em", marginBottom: 6, paddingLeft: 4 }}>MÓDULOS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {MODULOS.map(m => {
              const Icon = m.icon;
              const ativo = m.id === modulo;
              const aberto = expandido === m.id;
              const Chevron = aberto ? ChevronDown : ChevronRight;
              const mSubtabs = SUBTABS[m.id] || [];
              // Soma de pendências das abas do módulo (mostra no master quando fechado)
              const pendModulo = mSubtabs.reduce((s, st) => s + (pendingCounts[st.id] || 0), 0);
              return (
                <React.Fragment key={m.id}>
                  <button onClick={() => abrirModulo(m)}
                    style={{
                      padding: "8px 10px", borderRadius: 12,
                      background: ativo ? "rgba(255,255,255,0.08)" : "transparent",
                      color: ativo ? T.gold : NAV_INK,
                      fontWeight: ativo ? 600 : 400, fontSize: 13,
                      border: "none", cursor: "pointer", textAlign: "left",
                      display: "flex", alignItems: "center", gap: 9,
                    }}>
                    {Icon && <Icon size={14} />}
                    <span style={{ flex: 1 }}>{m.label}</span>
                    {!aberto && pendModulo > 0 && (
                      <span style={{
                        background: T.red, color: "#fff", fontSize: 9,
                        padding: "1px 6px", borderRadius: 100, fontWeight: 700,
                      }}>{pendModulo}</span>
                    )}
                    <Chevron size={13} style={{ opacity: 0.6 }} />
                  </button>

                  {/* Sub-abas (aparecem só quando o módulo está aberto) */}
                  {aberto && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 1, margin: "2px 0 6px" }}>
                      {mSubtabs.map(s => {
                        const SIcon = s.icon;
                        const sAtivo = s.agenda ? AGENDA_TAB_IDS.has(tab) : s.id === tab;
                        const pending = pendingCounts[s.id] || 0;
                        // Filhos da árvore — ESCONDIDOS até clicar na aba-pai:
                        // bancos só aparecem com Contas aberta; cartões com Cartões aberta.
                        let filhos = null;
                        if (s.id === "contas" && tab === "contas" && contas.length > 0 && setContaAberta) {
                          filhos = contas.map(c => ({
                            id: `conta:${c.id}`, label: c.nome, cor: c.cor,
                            ativo: contaAberta?.id === c.id,
                            onClick: () => { setTab("contas"); setContaAberta(c); },
                          }));
                        } else if (s.id === "cartoes" && tab === "cartoes" && cartoes.length > 0 && setCartaoAberto) {
                          filhos = cartoes.map(c => ({
                            id: `cartao:${c.id}`, label: c.nome, cor: null,
                            ativo: cartaoAberto?.id === c.id,
                            onClick: () => { setTab("cartoes"); setCartaoAberto(c); },
                          }));
                        } else if (s.agenda && AGENDA_TAB_IDS.has(tab)) {
                          // Matriz Agenda: filhas só aparecem quando a Agenda está aberta.
                          filhos = AGENDA_TABS.filter(t => t.id !== "inicio").map(t => ({
                            id: `ag:${t.id}`, label: t.label, cor: null,
                            ativo: tab === t.id,
                            onClick: () => setTab(t.id),
                          }));
                        }
                        return (
                          <React.Fragment key={s.id}>
                            <button onClick={() => setTab(s.id)}
                              style={{
                                padding: "7px 10px 7px 26px", borderRadius: 5, fontSize: 15,
                                fontFamily: "'Nunito', system-ui, sans-serif",
                                background: sAtivo ? "rgba(255,255,255,0.08)" : "transparent",
                                color: sAtivo ? NAV_INK : NAV_MUTED,
                                fontWeight: sAtivo ? 600 : 400,
                                borderLeft: `2px solid ${sAtivo ? T.gold : "transparent"}`,
                                border: "none", borderLeftWidth: 2, cursor: "pointer", textAlign: "left",
                                display: "flex", alignItems: "center", gap: 8,
                              }}>
                              {SIcon && <SIcon size={12} />}
                              {s.label}
                              {pending > 0 && (
                                <span style={{
                                  marginLeft: "auto",
                                  background: T.red, color: "#fff",
                                  fontSize: 9, padding: "1px 6px", borderRadius: 100,
                                  fontWeight: 700,
                                }}>{pending}</span>
                              )}
                            </button>
                            {filhos && filhos.map(f => (
                              <button key={f.id} onClick={f.onClick}
                                style={{
                                  padding: "5px 10px 5px 44px", borderRadius: 5, fontSize: 12,
                                  background: f.ativo ? "rgba(255,255,255,0.12)" : "transparent",
                                  color: f.ativo ? NAV_INK : NAV_MUTED,
                                  fontWeight: f.ativo ? 600 : 400,
                                  borderLeft: `2px solid ${f.ativo ? T.gold : "transparent"}`,
                                  border: "none", borderLeftWidth: 2, cursor: "pointer", textAlign: "left",
                                  display: "flex", alignItems: "center", gap: 7,
                                  whiteSpace: "nowrap", overflow: "hidden",
                                }}>
                                {f.cor && <span style={{ width: 8, height: 8, borderRadius: 2, background: f.cor, flexShrink: 0 }} />}
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{f.label}</span>
                              </button>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => { setModulo("config"); setTab("cfg-aparencia"); }}
          style={{
            padding: "8px 10px", borderRadius: 12,
            background: modulo === "config" ? `${T.gold}22` : "rgba(255,255,255,0.05)",
            color: modulo === "config" ? T.gold : NAV_MUTED,
            border: "none", cursor: "pointer", textAlign: "left",
            display: "flex", alignItems: "center", gap: 9, fontSize: 12,
          }}>
          <Settings size={14} /> Configurações
        </button>
      </aside>

      <header className="hdr-vertical-topbar" style={{
        marginLeft: 220,
        background: NAV_BG, color: NAV_INK,
        padding: "10px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
        borderBottom: `1px solid ${NAV_BORDER}`,
        backdropFilter: "blur(14px)",
      }}>
        <div style={{ fontSize: 11.5, color: NAV_MUTED }}>
          {moduloAtivo.label}
          {subtabs.find(s => s.id === tab) && (
            <> · <strong style={{ color: NAV_INK }}>{subtabs.find(s => s.id === tab).label}</strong></>
          )}
        </div>
        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => onOpenPalette?.()}
            title="Busca rápida de abas (Ctrl/Cmd+K)"
            style={vertUtilBtn}>
            <Search size={16} />
          </button>
          <AlertCenter {...alertData} onNavegar={onNavegar} btnStyle={vertUtilBtn} iconSize={16} />
          <button onClick={() => setHidden(!hidden)}
            title={hidden ? "Mostrar valores" : "Ocultar valores"}
            style={vertUtilBtn}>
            {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button onClick={() => onOpenSettings?.("toggle-tema")}
            title={T.dark ? "Tema claro" : "Tema escuro"}
            style={vertUtilBtn}>
            {T.dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={onRefresh} disabled={refreshing}
            title="Atualizar cotações"
            style={{ ...vertUtilBtn, cursor: refreshing ? "wait" : "pointer", color: refreshing ? T.gold : NAV_MUTED }}>
            <RefreshCw size={16} style={refreshing ? { animation: "spin 1s linear infinite" } : undefined} />
          </button>
          <button onClick={() => forcarAtualizacaoApp()}
            title="Atualizar app (buscar versão nova)"
            style={vertUtilBtn}>
            <RotateCw size={16} />
          </button>
          <button onClick={() => window.__af4Logout?.()}
            title="Sair do app"
            style={{ ...vertUtilBtn, color: "#f87171" }}>
            <LogOut size={16} />
          </button>
          <button onClick={() => onOpenSettings?.("perfis")}
            title={`Perfil: ${perfilAtivo?.nome || "—"}`}
            style={{
              padding: 0, width: 30, height: 30, borderRadius: "50%",
              background: perfilAtivo?.cor || T.gold,
              color: T.bg, border: `2px solid ${NAV_BORDER}`,
              fontWeight: 700, fontSize: 12, cursor: "pointer",
              display: "grid", placeItems: "center", flexShrink: 0,
            }}>
            {(perfilAtivo?.nome || "?").charAt(0).toUpperCase()}
          </button>
        </div>
      </header>
    </>
  );
}

const vertUtilBtn = {
  width: 32, height: 32, padding: 0,
  background: "rgba(255,255,255,0.05)",
  border: `1px solid rgba(255,255,255,0.08)`,
  color: "#a8a8b0", borderRadius: 12, cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};
