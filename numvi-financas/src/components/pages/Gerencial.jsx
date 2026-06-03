import React, { useState, useMemo } from "react";
import { Users, BookOpen, CreditCard, Settings, RefreshCw, Send, Clock, Trash2, CheckCircle2, Search } from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid, todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import { APP_URL } from "../../lib/gestor.js";

/**
 * Painel Gerencial (gestor/admin) — CRM local de clientes do produto.
 * Visível só pro gestor. Dados persistidos no estado do app (aurum_state).
 *
 * Cliente: { id, email, confirmado, assinatura: ""|"ativa"|"teste", testeDias, cadastro }
 */
export default function Gerencial({ clientes = [], setClientes, gestorEmail = "" }) {
  const [sub, setSub] = useState("clientes");
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = q ? clientes.filter(c => (c.email || "").toLowerCase().includes(q)) : clientes;
    return [...base].sort((a, b) => (b.cadastro || "").localeCompare(a.cadastro || ""));
  }, [clientes, busca]);

  const stats = useMemo(() => ({
    total: clientes.length,
    ativos: clientes.filter(c => c.assinatura === "ativa").length,
    assinaturas: clientes.filter(c => c.assinatura === "ativa" || c.assinatura === "teste").length,
  }), [clientes]);

  const upsertCliente = (email) => {
    const e = (email || "").trim().toLowerCase();
    if (!e || !/.+@.+\..+/.test(e)) { toast.error("Informe um e-mail válido."); return null; }
    const existe = clientes.find(c => (c.email || "").toLowerCase() === e);
    if (existe) return existe;
    const novo = { id: uid(), email: e, confirmado: false, assinatura: "", testeDias: 0, cadastro: todayISO() };
    setClientes([novo, ...clientes]);
    return novo;
  };

  const convidarWhatsApp = () => {
    // O convite só compartilha o link — NÃO exige e-mail. Se um e-mail válido
    // estiver digitado, também registra o cliente na lista (opcional).
    const texto = `Olá! Te convido pra usar o NUMVI Finanças — sua vida financeira organizada num só lugar. Acesse: ${APP_URL}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
    const e = (busca || "").trim().toLowerCase();
    if (e && /.+@.+\..+/.test(e)) {
      upsertCliente(e);
      toast.success(`Convite gerado e ${e} adicionado.`);
      setBusca("");
    } else {
      toast.success("Convite aberto no WhatsApp.");
    }
  };

  const adicionarCliente = () => {
    const c = upsertCliente(busca);
    if (c) { toast.success(`${c.email} adicionado.`); setBusca(""); }
  };

  const atualizarCliente = (id, patch) =>
    setClientes(clientes.map(c => c.id === id ? { ...c, ...patch } : c));

  const concederTeste = (c) => {
    // "Teste" concede/estende dias grátis. Clicar soma 7 dias; longo-press (Alt) zera.
    const novos = (Number(c.testeDias) || 0) + 7;
    atualizarCliente(c.id, { testeDias: novos, assinatura: c.assinatura === "ativa" ? "ativa" : "teste" });
    toast.success(`${c.email}: teste em ${novos} dias.`);
  };

  const removerCliente = async (c) => {
    const ok = await confirm({ title: `Remover ${c.email}?`, danger: true, confirmLabel: "Remover",
      body: "Remove o cliente do painel (não afeta a conta dele no login)." });
    if (!ok) return;
    setClientes(clientes.filter(x => x.id !== c.id));
  };

  const SUBS = [
    { id: "clientes", label: "Clientes", icon: Users },
    { id: "curadoria", label: "Curadoria", icon: BookOpen },
    { id: "assinaturas", label: "Assinaturas", icon: CreditCard },
    { id: "config", label: "Configurações", icon: Settings },
  ];

  return (
    <div className="fade-up py-8 px-6">
      <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: T.serif, fontSize: 26, display: "inline-flex", alignItems: "center", gap: 10 }}>
          <Settings size={22} color={T.gold} /> Painel administrativo
        </h1>
        <div style={{ fontSize: 11, color: T.muted }}>Gestor: <strong style={{ color: T.ink }}>{gestorEmail || "—"}</strong></div>
      </div>

      {/* Sub-abas */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {SUBS.map(s => {
          const ativo = sub === s.id;
          return (
            <button key={s.id} onClick={() => setSub(s.id)} style={{
              padding: "8px 14px", borderRadius: 100, fontSize: 12, fontWeight: 600,
              display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
              background: ativo ? `${T.gold}22` : T.bgSoft,
              border: `1px solid ${ativo ? T.gold : T.border}`,
              color: ativo ? T.gold : T.muted,
            }}>
              <s.icon size={13} /> {s.label}
            </button>
          );
        })}
      </div>

      {sub === "clientes" && (
        <>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
            <Kpi label="Clientes" valor={stats.total} />
            <Kpi label="Assinantes ativos" valor={stats.ativos} cor={T.green} />
            <Kpi label="Assinaturas (total)" valor={stats.assinaturas} cor={T.gold} />
          </div>

          {/* Busca + convite */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
              <input value={busca} onChange={e => setBusca(e.target.value)}
                     placeholder="Buscar ou adicionar por e-mail…"
                     onKeyDown={e => { if (e.key === "Enter") adicionarCliente(); }}
                     style={{ width: "100%", padding: "9px 12px 9px 32px", background: T.bgSoft,
                              border: `1px solid ${T.border}`, borderRadius: 8, color: T.ink, fontSize: 13 }} />
            </div>
            <button onClick={adicionarCliente} title="Adiciona o e-mail digitado à lista de clientes" style={{
              padding: "9px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              background: "transparent", border: `1px solid ${T.border}`, color: T.muted,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              + Adicionar
            </button>
            <button onClick={convidarWhatsApp} title="Abre o WhatsApp com o link do app (não precisa de e-mail)" style={{
              padding: "9px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              background: "transparent", border: `1px solid ${T.green}`, color: T.green,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <Send size={14} /> Convidar pelo WhatsApp
            </button>
          </div>

          {/* Tabela */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "auto" }}>
            <table className="tbl" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 640 }}>
              <thead>
                <tr style={{ background: T.bgSoft, color: T.muted, textTransform: "uppercase", fontSize: 9.5, letterSpacing: ".08em" }}>
                  <th style={th}>Cliente</th>
                  <th style={{ ...th, textAlign: "center" }}>Conf.</th>
                  <th style={{ ...th, textAlign: "center" }}>Assinatura</th>
                  <th style={{ ...th, textAlign: "center" }}>Teste</th>
                  <th style={th}>Cadastro</th>
                  <th style={{ ...th, textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map(c => (
                  <tr key={c.id} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ ...td, color: T.ink, fontWeight: 500 }}>{c.email}</td>
                    <td style={{ ...td, textAlign: "center", cursor: "pointer" }}
                        onClick={() => atualizarCliente(c.id, { confirmado: !c.confirmado })}
                        title="Marcar confirmado">
                      {c.confirmado
                        ? <CheckCircle2 size={16} color={T.green} style={{ display: "inline" }} />
                        : <span style={{ color: T.faint }}>—</span>}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      {c.assinatura === "ativa"
                        ? <Tag cor={T.green}>Ativa</Tag>
                        : c.assinatura === "teste"
                          ? <Tag cor={T.gold}>Teste</Tag>
                          : <span style={{ color: T.faint }}>—</span>}
                    </td>
                    <td style={{ ...td, textAlign: "center", color: c.testeDias > 0 ? T.gold : T.faint, fontWeight: 600 }}>
                      {c.testeDias > 0 ? `${c.testeDias}d` : "—"}
                    </td>
                    <td style={{ ...td, color: T.muted }}>{fmtData(c.cadastro)}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button onClick={() => concederTeste(c)} title="Conceder/estender 7 dias de teste" style={actBtn}>
                        <Clock size={12} /> Teste
                      </button>
                      <button onClick={() => atualizarCliente(c.id, { assinatura: c.assinatura === "ativa" ? "" : "ativa" })}
                              title="Alternar assinatura ativa" style={{ ...actBtn, marginLeft: 6 }}>
                        <CreditCard size={12} />
                      </button>
                      <button onClick={() => removerCliente(c)} title="Remover" style={{ ...actBtn, marginLeft: 6, borderColor: `${T.red}55`, color: T.red }}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: T.muted, padding: 24, fontStyle: "italic" }}>
                    {busca ? "Nenhum cliente encontrado." : "Nenhum cliente ainda. Digite um e-mail e convide pelo WhatsApp."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10.5, color: T.muted, marginTop: 8 }}>
            "Teste" concede/estende dias grátis pro cliente. O convite abre o WhatsApp com o link do app.
          </div>
        </>
      )}

      {sub !== "clientes" && (
        <div style={{ background: T.card, border: `1px dashed ${T.border}`, borderRadius: 10, padding: 40, textAlign: "center", color: T.muted }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, marginBottom: 6 }}>
            {SUBS.find(s => s.id === sub)?.label}
          </div>
          Em breve — próxima fase do painel do gestor.
        </div>
      )}
    </div>
  );
}

const th = { padding: "10px 12px", textAlign: "left", fontWeight: 700 };
const td = { padding: "11px 12px" };
const actBtn = {
  padding: "4px 8px", fontSize: 10.5, fontWeight: 600, borderRadius: 5, cursor: "pointer",
  background: "transparent", border: `1px solid ${T.border}`, color: T.muted,
  display: "inline-flex", alignItems: "center", gap: 4,
};

function Kpi({ label, valor, cor }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, marginBottom: 8 }}>{label}</div>
      <div className="num" style={{ fontSize: 28, fontWeight: 300, color: cor || T.ink }}>{valor}</div>
    </div>
  );
}

function Tag({ cor, children }) {
  return <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700,
    background: `${cor}22`, color: cor, textTransform: "uppercase", letterSpacing: ".04em" }}>{children}</span>;
}

function fmtData(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}
