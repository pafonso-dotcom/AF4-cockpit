import React from "react";
import { T, THEMES } from "../lib/theme.js";
import { getPerfilAtivo } from "../lib/perfis.js";
import { useLayout } from "../lib/useLayout.js";
import {
  Activity, Wallet, CreditCard, Receipt, Calendar, Tag, Sparkles, PiggyBank,
  Briefcase, TrendingUp, LineChart as LineIcon, Calculator, BarChart3,
  Car, Package, Target, Users, AlertCircle, History, MessageCircle,
  Settings, Eye, EyeOff, RefreshCw, DollarSign, Sun, Moon,
  Radar, Bookmark, StickyNote,
} from "lucide-react";

/**
 * Header AF4 Cockpit · v4 (refatorado pra hierarquia clara)
 *  Linha 1 (sempre): logo · separador · subtabs (scroll) · separador · quick actions · separador · utility · gap · settings · avatar
 *  Linha 2 (≥640px): módulos (Finanças/Invest/Loja)
 *  Mobile (<640px): linha 1 = logo + settings; linha 2 = subtabs scroll
 */
export default function Header(props) {
  const { isVertical } = useLayout();
  if (isVertical) return <HeaderVertical {...props} />;
  return <HeaderHorizontal {...props} />;
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
      background: "rgba(255,255,255,.06)", borderRadius: 6,
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
  onQuickAction,
  pendingCounts = {},
  contas = [], cartoes = [],
  contaAberta, setContaAberta,
  cartaoAberto, setCartaoAberto,
}) {

  const perfilAtivo = getPerfilAtivo();
  const perms = perfilAtivo?.permissoes || { financas: true, invest: true, loja: true, trade: true, config: true };

  const TODOS_MODULOS = [
    { id: "financas", label: "Finanças",      icon: Wallet,    desc: "Pessoal" },
    { id: "invest",   label: "Investimentos", icon: Briefcase, desc: "Carteira" },
    { id: "loja",     label: "Loja AF4",      icon: Car,       desc: "Comercial" },
  ];
  const MODULOS = TODOS_MODULOS.filter(m => perms[m.id] !== false);

  const SUBTABS = {
    financas: [
      { id: "dashboard",    label: "Painel",       icon: Activity },
      { id: "notas",        label: "Notas",        icon: StickyNote },
      { id: "contas",       label: "Contas",       icon: Wallet },
      { id: "cartoes",      label: "Cartões",      icon: CreditCard },
      { id: "transacoes",   label: "Transações",   icon: Receipt },
      { id: "analiseia",    label: "Análise IA",   icon: Sparkles },
      { id: "calendario",   label: "Calendário",   icon: Calendar },
      { id: "planejamento", label: "Planejamento", icon: Target },
      { id: "metas",        label: "Metas",        icon: Target },
      { id: "categorias",   label: "Categorias",   icon: Tag },
      { id: "perguntar",    label: "Pergunte ao Claude", icon: Sparkles },
      { id: "relatorios-f", label: "Relatórios",   icon: BarChart3 },
      { id: "audit",        label: "Histórico",    icon: History },
    ],
    invest: [
      { id: "investimentos", label: "Painel",       icon: BarChart3 },
      { id: "invest-idv",    label: "Análise IdV",  icon: Sparkles },
      { id: "carteira",      label: "Carteira",     icon: Briefcase },
      { id: "performance",   label: "Performance",  icon: TrendingUp },
      { id: "proventos",     label: "Proventos",    icon: DollarSign },
      { id: "analise-carteira", label: "Análise da Carteira", icon: Radar },
      { id: "mercado",       label: "Mercado",      icon: LineIcon },
      { id: "relatorios-i",  label: "Relatórios",   icon: BarChart3 },
      { id: "simulador",     label: "Simulador",    icon: Calculator },
    ],
    loja: [
      { id: "loja-painel",   label: "Painel",       icon: BarChart3 },
      { id: "loja-estoque",  label: "Estoque",      icon: Package },
      { id: "loja-novo",     label: "Novo Veículo", icon: Car },
      { id: "loja-vendas",   label: "Vendas",       icon: TrendingUp },
      { id: "loja-funil",    label: "Funil",        icon: Target },
      { id: "loja-cheques",  label: "Cheques",      icon: Receipt },
      { id: "loja-banco",    label: "Banco",        icon: Wallet },
      { id: "loja-relatorios", label: "Relatórios", icon: BarChart3 },
      { id: "loja-whatsapp", label: "WhatsApp",   icon: MessageCircle },
      { id: "loja-clientes", label: "Clientes",     icon: Users },
    ],
    config: [
      { id: "cfg-aparencia", label: "Aparência",    icon: Sparkles },
      { id: "cfg-apis",      label: "APIs",         icon: Settings },
      { id: "cfg-modulos",   label: "Módulos",      icon: Package },
      { id: "cfg-backup",    label: "Backup",       icon: RefreshCw },
    ],
  };

  const subtabs = SUBTABS[modulo] || SUBTABS.financas;

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
    color: NAV_MUTED, borderRadius: 10, cursor: "pointer",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    transition: "background .15s, color .15s, border-color .15s",
  };

  const sep = (
    <div aria-hidden style={{
      width: 1, height: 24, background: NAV_BORDER, opacity: 0.8,
      margin: "0 4px", flexShrink: 0,
    }} className="hide-mobile" />
  );

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "rgba(10,10,12,.92)", backdropFilter: "blur(14px)",
      borderBottom: `1px solid ${T.border}`,
    }}>
      {/* ============== LINHA 1 · brand · ações · utility ============== */}
      <div style={{
        maxWidth: 1280, margin: "0 auto",
        padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      }}>
        {/* BRAND · logo + nome */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginRight: "auto", flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${T.gold}, ${T.goldHi})`,
            display: "grid", placeItems: "center",
            color: T.bg, fontWeight: 700, fontSize: 16,
            flexShrink: 0,
          }}>A</div>
          <div className="header-brand-text" style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 14, letterSpacing: ".05em", fontWeight: 600, color: NAV_INK }}>
              AF4 Cockpit
            </div>
            <div className="header-subtitle" style={{ fontSize: 9.5, letterSpacing: ".18em", color: NAV_FAINT, marginTop: 1 }}>
              v4 · Multi-Módulo
            </div>
          </div>
        </div>

        {sep}

        {/* Quick actions removidas — agora via atalhos de teclado N/V/A.
            Pressione ? pra ver lista de atalhos. */}

        {/* UTILITY · 40x40 cada */}
        <div className="hide-mobile" style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <EscopoToggle escopoAtivo={escopoAtivo} onEscopoChange={onEscopoChange} />
          <button onClick={() => setHidden(!hidden)}
                  title={hidden ? "Mostrar valores" : "Ocultar valores"}
                  className="hdr-util" style={utilBtn}>
            {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
          <button onClick={() => onOpenSettings?.("toggle-tema")}
                  title={T.dark ? "Mudar para tema claro" : "Mudar para tema escuro"}
                  className="hdr-util" style={utilBtn}>
            {T.dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={onRefresh} title="Atualizar cotações" disabled={refreshing}
                  className="hdr-util"
                  style={{ ...utilBtn, color: refreshing ? T.gold : NAV_MUTED, cursor: refreshing ? "wait" : "pointer" }}>
            <RefreshCw size={18} style={refreshing ? { animation: "spin 1s linear infinite" } : undefined} />
          </button>
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
                if (m.id === "loja" && escopoAtivo === "pessoal") onEscopoChange?.("negocio");
              }}
                style={{
                  padding: "9px 16px", borderRadius: 8,
                  background: active ? "rgba(255,255,255,0.10)" : "transparent",
                  color: active ? NAV_INK : NAV_MUTED,
                  border: `1px solid ${active ? NAV_BORDER : "transparent"}`,
                  fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 500,
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
            const active = tab === st.id;
            const pending = pendingCounts[st.id] || 0;
            return (
              <button key={st.id}
                onClick={() => setTab(st.id)}
                title={st.label}
                style={{
                  position: "relative",
                  padding: "10px 18px",
                  background: active ? `${T.gold}1a` : "transparent",
                  color: active ? T.gold : NAV_MUTED,
                  borderTop: "none", borderLeft: "none", borderRight: "none",
                  borderBottom: `2px solid ${active ? T.gold : "transparent"}`,
                  fontSize: 13.5, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 500,
                  display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                  cursor: "pointer", transition: "color .15s, background .15s, border-color .15s",
                  fontFamily: T.sans, borderRadius: "6px 6px 0 0",
                }}>
                <Icon size={14} /> {st.label}
                {pending > 0 && (
                  <span style={{
                    background: T.red, color: "#fff",
                    fontSize: 9, padding: "1px 6px", borderRadius: 100, marginLeft: 2,
                    fontWeight: 700,
                  }}>{pending}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============== LINHA 4 · árvore (filhos) de Contas / Cartões ============== */}
      {((tab === "contas" && contas.length > 0 && setContaAberta) ||
        (tab === "cartoes" && cartoes.length > 0 && setCartaoAberto)) && (
        <div style={{ borderTop: `1px solid ${NAV_BORDER}`, padding: "0 16px" }}>
          <div style={{
            maxWidth: 1280, margin: "0 auto",
            display: "flex", gap: 6, overflowX: "auto", padding: "6px 0", alignItems: "center",
          }}>
            <span style={{ fontSize: 9.5, color: NAV_FAINT, letterSpacing: ".2em", textTransform: "uppercase", whiteSpace: "nowrap", paddingRight: 4 }}>
              {tab === "contas" ? "Bancos" : "Cartões"} ·
            </span>
            {(tab === "contas" ? contas : cartoes).map(c => {
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
        @media (max-width: 640px) {
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
        color: fg, border: "none", borderRadius: 10,
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
  pendingCounts = {},
  contas = [], cartoes = [],
  contaAberta, setContaAberta,
  cartaoAberto, setCartaoAberto,
}) {
  const perfilAtivo = getPerfilAtivo();
  const perms = perfilAtivo?.permissoes || { financas: true, invest: true, loja: true, trade: true, config: true };

  const TODOS_MODULOS = [
    { id: "financas", label: "Finanças",      icon: Wallet },
    { id: "invest",   label: "Investimentos", icon: Briefcase },
    { id: "loja",     label: "Loja AF4",      icon: Car },
  ];
  const MODULOS = TODOS_MODULOS.filter(m => perms[m.id] !== false);

  const SUBTABS = {
    financas: [
      { id: "dashboard",    label: "Painel",       icon: Activity },
      { id: "notas",        label: "Notas",        icon: StickyNote },
      { id: "contas",       label: "Contas",       icon: Wallet },
      { id: "cartoes",      label: "Cartões",      icon: CreditCard },
      { id: "transacoes",   label: "Transações",   icon: Receipt },
      { id: "analiseia",    label: "Análise IA",   icon: Sparkles },
      { id: "calendario",   label: "Calendário",   icon: Calendar },
      { id: "planejamento", label: "Planejamento", icon: Target },
      { id: "metas",        label: "Metas",        icon: Target },
      { id: "categorias",   label: "Categorias",   icon: Tag },
      { id: "perguntar",    label: "Pergunte ao Claude", icon: Sparkles },
      { id: "relatorios-f", label: "Relatórios",   icon: BarChart3 },
      { id: "audit",        label: "Histórico",    icon: History },
    ],
    invest: [
      { id: "investimentos", label: "Painel",       icon: BarChart3 },
      { id: "invest-idv",    label: "Análise IdV",  icon: Sparkles },
      { id: "carteira",      label: "Carteira",     icon: Briefcase },
      { id: "performance",   label: "Performance",  icon: TrendingUp },
      { id: "proventos",     label: "Proventos",    icon: DollarSign },
      { id: "analise-carteira", label: "Análise da Carteira", icon: Radar },
      { id: "mercado",       label: "Mercado",      icon: LineIcon },
      { id: "relatorios-i",  label: "Relatórios",   icon: BarChart3 },
      { id: "simulador",     label: "Simulador",    icon: Calculator },
    ],
    loja: [
      { id: "loja-painel",   label: "Painel",       icon: BarChart3 },
      { id: "loja-estoque",  label: "Estoque",      icon: Package },
      { id: "loja-novo",     label: "Novo Veículo", icon: Car },
      { id: "loja-vendas",   label: "Vendas",       icon: TrendingUp },
      { id: "loja-funil",    label: "Funil",        icon: Target },
      { id: "loja-cheques",  label: "Cheques",      icon: Receipt },
      { id: "loja-banco",    label: "Banco",        icon: Wallet },
      { id: "loja-relatorios", label: "Relatórios", icon: BarChart3 },
      { id: "loja-whatsapp", label: "WhatsApp",     icon: MessageCircle },
      { id: "loja-clientes", label: "Clientes",     icon: Users },
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

  const NAV_BG = "rgba(10,10,12,.96)";
  const NAV_INK = "#f5f5f7";
  const NAV_MUTED = "#a8a8b0";
  const NAV_BORDER = "rgba(255,255,255,0.08)";

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
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${T.gold}, ${T.goldHi})`,
            display: "grid", placeItems: "center",
            color: T.bg, fontWeight: 700, fontSize: 16,
          }}>A</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>AF4 Cockpit</div>
            <div style={{ fontSize: 8.5, color: NAV_MUTED, letterSpacing: ".2em" }}>v4 · MULTI-MÓDULO</div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9, color: NAV_MUTED, letterSpacing: ".2em", marginBottom: 6, paddingLeft: 4 }}>MÓDULOS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {MODULOS.map(m => {
              const Icon = m.icon;
              const ativo = m.id === modulo;
              return (
                <button key={m.id}
                  onClick={() => {
                    setModulo(m.id);
                    const first = SUBTABS[m.id]?.[0]?.id;
                    if (first) setTab(first);
                    if (m.id === "loja" && escopoAtivo === "pessoal") onEscopoChange?.("negocio");
                  }}
                  style={{
                    padding: "8px 10px", borderRadius: 7,
                    background: ativo ? "rgba(255,255,255,0.08)" : "transparent",
                    color: ativo ? T.gold : NAV_INK,
                    fontWeight: ativo ? 600 : 400, fontSize: 12,
                    border: "none", cursor: "pointer", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 9,
                  }}>
                  {Icon && <Icon size={14} />}
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9, color: NAV_MUTED, letterSpacing: ".2em", marginBottom: 6, paddingLeft: 4 }}>
            {(moduloAtivo.label || "").toUpperCase()}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {subtabs.map(s => {
              const Icon = s.icon;
              const ativo = s.id === tab;
              const pending = pendingCounts[s.id] || 0;
              // Filhos da árvore: Contas → bancos, Cartões → cartões.
              let filhos = null;
              if (s.id === "contas" && contas.length > 0 && setContaAberta) {
                filhos = contas.map(c => ({
                  id: `conta:${c.id}`, label: c.nome, cor: c.cor,
                  ativo: contaAberta?.id === c.id,
                  onClick: () => { setTab("contas"); setContaAberta(c); },
                }));
              } else if (s.id === "cartoes" && cartoes.length > 0 && setCartaoAberto) {
                filhos = cartoes.map(c => ({
                  id: `cartao:${c.id}`, label: c.nome, cor: null,
                  ativo: cartaoAberto?.id === c.id,
                  onClick: () => { setTab("cartoes"); setCartaoAberto(c); },
                }));
              }
              return (
                <React.Fragment key={s.id}>
                  <button onClick={() => setTab(s.id)}
                    style={{
                      padding: "7px 10px 7px 12px", borderRadius: 5, fontSize: 13,
                      background: ativo ? "rgba(255,255,255,0.08)" : "transparent",
                      color: ativo ? NAV_INK : NAV_MUTED,
                      fontWeight: ativo ? 600 : 400,
                      borderLeft: `2px solid ${ativo ? T.gold : "transparent"}`,
                      border: "none", borderLeftWidth: 2, cursor: "pointer", textAlign: "left",
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                    {Icon && <Icon size={12} />}
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
                        padding: "5px 10px 5px 30px", borderRadius: 5, fontSize: 12,
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
        </div>

        <div style={{ flex: 1 }} />

        <button
          onClick={() => { setModulo("config"); setTab("cfg-aparencia"); }}
          style={{
            padding: "8px 10px", borderRadius: 7,
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
          <EscopoToggle escopoAtivo={escopoAtivo} onEscopoChange={onEscopoChange} compact />
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
  color: "#a8a8b0", borderRadius: 7, cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};
