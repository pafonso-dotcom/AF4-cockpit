import React, { useState, useMemo } from "react";
import { Users, BookOpen, CreditCard, Settings, RefreshCw, Send, Clock, Trash2, CheckCircle2, Search } from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid, todayISO, fmt } from "../../lib/format.js";
import { Plus, Pin, Link as LinkIcon } from "lucide-react";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import { APP_URL } from "../../lib/gestor.js";

/**
 * Painel Gerencial (gestor/admin) — CRM local de clientes do produto.
 * Visível só pro gestor. Dados persistidos no estado do app (aurum_state).
 *
 * Cliente: { id, email, confirmado, assinatura: ""|"ativa"|"teste", testeDias, cadastro }
 */
export default function Gerencial({
  clientes = [], setClientes,
  curadoria = [], setCuradoria,
  planos = [], setPlanos,
  config = {}, setConfig,
  gestorEmail = "",
}) {
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
    const url = (config.appUrl || "").trim() || APP_URL;
    const base = (config.mensagemConvite || "").trim()
      || "Olá! Te convido pra usar o NUMVI Finanças — sua vida financeira organizada num só lugar. Acesse: {link}";
    const texto = base.includes("{link}") ? base.replace("{link}", url) : `${base} ${url}`;
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
    // "Teste" concede/estende dias grátis (padrão configurável).
    const passo = Number(config.testeDias) > 0 ? Number(config.testeDias) : 7;
    const novos = (Number(c.testeDias) || 0) + passo;
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

      {sub === "curadoria" && (
        <CuradoriaTab curadoria={curadoria} setCuradoria={setCuradoria} />
      )}

      {sub === "assinaturas" && (
        <AssinaturasTab planos={planos} setPlanos={setPlanos} clientes={clientes} />
      )}

      {sub === "config" && (
        <ConfigTab config={config} setConfig={setConfig} gestorEmail={gestorEmail} />
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

/* ============ CURADORIA — dicas/conteúdos pro cliente ============ */
function CuradoriaTab({ curadoria = [], setCuradoria }) {
  const [form, setForm] = useState({ titulo: "", texto: "", link: "" });

  const publicar = () => {
    const titulo = form.titulo.trim();
    if (!titulo) { toast.error("Dê um título à dica."); return; }
    const item = {
      id: uid(), titulo, texto: form.texto.trim(), link: form.link.trim(),
      fixado: false, data: todayISO(),
    };
    setCuradoria([item, ...curadoria]);
    setForm({ titulo: "", texto: "", link: "" });
    toast.success("Conteúdo publicado.");
  };

  const togglePin = (id) =>
    setCuradoria(curadoria.map(c => c.id === id ? { ...c, fixado: !c.fixado } : c));

  const remover = async (c) => {
    const ok = await confirm({ title: `Remover "${c.titulo}"?`, danger: true, confirmLabel: "Remover" });
    if (!ok) return;
    setCuradoria(curadoria.filter(x => x.id !== c.id));
  };

  const lista = [...curadoria].sort((a, b) =>
    (b.fixado - a.fixado) || (b.data || "").localeCompare(a.data || ""));

  return (
    <>
      {/* Form */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.ink, marginBottom: 10 }}>Nova dica / conteúdo</div>
        <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
               placeholder="Título" style={inp} />
        <textarea value={form.texto} onChange={e => setForm({ ...form, texto: e.target.value })}
                  placeholder="Texto da dica (opcional)" rows={3}
                  style={{ ...inp, resize: "vertical" }} />
        <input value={form.link} onChange={e => setForm({ ...form, link: e.target.value })}
               placeholder="Link (opcional)" style={inp} />
        <button onClick={publicar} style={{
          marginTop: 6, padding: "9px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
          cursor: "pointer", background: T.gold, color: T.bg, border: "none",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <Plus size={14} /> Publicar
        </button>
      </div>

      {/* Lista */}
      <div style={{ display: "grid", gap: 10 }}>
        {lista.map(c => (
          <div key={c.id} style={{
            background: T.card, border: `1px solid ${c.fixado ? T.gold : T.border}`,
            borderRadius: 10, padding: 14,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{c.titulo}</div>
              <div style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => togglePin(c.id)} title="Fixar" style={iconBtn(c.fixado ? T.gold : T.muted)}>
                  <Pin size={13} />
                </button>
                <button onClick={() => remover(c)} title="Remover" style={iconBtn(T.red)}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            {c.texto && <div style={{ fontSize: 12.5, color: T.muted, marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.texto}</div>}
            {c.link && (
              <a href={c.link} target="_blank" rel="noreferrer"
                 style={{ fontSize: 12, color: T.blue || "#60a5fa", marginTop: 8, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <LinkIcon size={12} /> {c.link}
              </a>
            )}
            <div style={{ fontSize: 10.5, color: T.faint, marginTop: 8 }}>{fmtData(c.data)}</div>
          </div>
        ))}
        {lista.length === 0 && (
          <div style={{ background: T.card, border: `1px dashed ${T.border}`, borderRadius: 10, padding: 30, textAlign: "center", color: T.muted, fontStyle: "italic" }}>
            Nenhum conteúdo ainda. Publique a primeira dica acima.
          </div>
        )}
      </div>
    </>
  );
}

/* ============ ASSINATURAS — planos + resumo de assinantes ============ */
function AssinaturasTab({ planos = [], setPlanos, clientes = [] }) {
  const [form, setForm] = useState({ nome: "", preco: "", periodo: "mensal" });

  const resumo = {
    ativos: clientes.filter(c => c.assinatura === "ativa").length,
    teste: clientes.filter(c => c.assinatura === "teste").length,
    total: clientes.length,
  };

  const addPlano = () => {
    const nome = form.nome.trim();
    const preco = Number(String(form.preco).replace(",", "."));
    if (!nome) { toast.error("Dê um nome ao plano."); return; }
    if (!(preco > 0)) { toast.error("Informe um preço válido."); return; }
    setPlanos([...planos, { id: uid(), nome, preco, periodo: form.periodo, ativo: true }]);
    setForm({ nome: "", preco: "", periodo: "mensal" });
    toast.success("Plano criado.");
  };

  const toggleAtivo = (id) =>
    setPlanos(planos.map(p => p.id === id ? { ...p, ativo: !p.ativo } : p));

  const remover = async (p) => {
    const ok = await confirm({ title: `Remover plano "${p.nome}"?`, danger: true, confirmLabel: "Remover" });
    if (!ok) return;
    setPlanos(planos.filter(x => x.id !== p.id));
  };

  return (
    <>
      {/* Resumo de assinantes (da lista de Clientes) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
        <Kpi label="Assinantes ativos" valor={resumo.ativos} cor={T.green} />
        <Kpi label="Em teste" valor={resumo.teste} cor={T.gold} />
        <Kpi label="Total de clientes" valor={resumo.total} />
      </div>

      {/* Novo plano */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.ink, marginBottom: 10 }}>Novo plano</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
                 placeholder="Nome do plano" style={{ ...inp, flex: 1, minWidth: 160, marginBottom: 0 }} />
          <input value={form.preco} onChange={e => setForm({ ...form, preco: e.target.value })}
                 placeholder="Preço (R$)" inputMode="decimal" style={{ ...inp, width: 120, marginBottom: 0 }} />
          <select value={form.periodo} onChange={e => setForm({ ...form, periodo: e.target.value })}
                  style={{ ...inp, width: 130, marginBottom: 0 }}>
            <option value="mensal">Mensal</option>
            <option value="anual">Anual</option>
          </select>
          <button onClick={addPlano} style={{
            padding: "9px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
            background: T.gold, color: T.bg, border: "none", display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <Plus size={14} /> Criar
          </button>
        </div>
      </div>

      {/* Lista de planos */}
      <div style={{ display: "grid", gap: 10 }}>
        {planos.map(p => (
          <div key={p.id} style={{
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
            opacity: p.ativo ? 1 : 0.55,
          }}>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{p.nome}</div>
              <div style={{ fontSize: 11.5, color: T.muted }}>{p.periodo === "anual" ? "Anual" : "Mensal"}</div>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
              <span className="num" style={{ fontSize: 15, fontWeight: 600, color: T.gold }}>{fmt(p.preco)}</span>
              <button onClick={() => toggleAtivo(p.id)} style={{
                ...iconBtn(p.ativo ? T.green : T.muted), padding: "4px 10px", width: "auto", fontSize: 10.5, fontWeight: 600,
              }}>{p.ativo ? "Ativo" : "Inativo"}</button>
              <button onClick={() => remover(p)} title="Remover" style={iconBtn(T.red)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
        {planos.length === 0 && (
          <div style={{ background: T.card, border: `1px dashed ${T.border}`, borderRadius: 10, padding: 30, textAlign: "center", color: T.muted, fontStyle: "italic" }}>
            Nenhum plano ainda. Crie o primeiro acima.
          </div>
        )}
      </div>
    </>
  );
}

const inp = {
  width: "100%", padding: "9px 12px", marginBottom: 8, background: T.bgSoft,
  border: `1px solid ${T.border}`, borderRadius: 8, color: T.ink, fontSize: 13,
  fontFamily: "inherit", boxSizing: "border-box",
};
function iconBtn(cor) {
  return {
    padding: "5px 8px", borderRadius: 6, cursor: "pointer", background: "transparent",
    border: `1px solid ${cor}55`, color: cor, display: "inline-flex", alignItems: "center", gap: 4,
  };
}

/* ============ CONFIGURAÇÕES do gestor ============ */
function ConfigTab({ config = {}, setConfig, gestorEmail = "" }) {
  const [form, setForm] = useState({
    appUrl: config.appUrl || "",
    mensagemConvite: config.mensagemConvite || "",
    testeDias: config.testeDias || "",
  });

  const salvar = () => {
    setConfig({
      appUrl: form.appUrl.trim(),
      mensagemConvite: form.mensagemConvite.trim(),
      testeDias: Number(form.testeDias) || 0,
    });
    toast.success("Configurações do gestor salvas.");
  };

  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <Campo label="E-mail do gestor">
          <input value={gestorEmail} disabled style={{ ...inp, marginBottom: 0, opacity: 0.7 }} />
          <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4 }}>
            Definido no build (VITE_GESTOR_EMAILS). Só este e-mail vê o painel Gerencial.
          </div>
        </Campo>
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 16 }}>
        <Campo label="Link do app (usado no convite)">
          <input value={form.appUrl} onChange={e => setForm({ ...form, appUrl: e.target.value })}
                 placeholder={APP_URL} style={{ ...inp, marginBottom: 0 }} />
        </Campo>
        <Campo label="Mensagem do convite (WhatsApp)">
          <textarea value={form.mensagemConvite} onChange={e => setForm({ ...form, mensagemConvite: e.target.value })}
                    rows={3} placeholder="Use {link} onde o link do app deve entrar."
                    style={{ ...inp, marginBottom: 0, resize: "vertical" }} />
          <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4 }}>
            Use <code>{"{link}"}</code> pra posicionar o link; se não usar, o link é colado no fim.
          </div>
        </Campo>
        <Campo label="Dias de teste por clique no botão “Teste”">
          <input value={form.testeDias} onChange={e => setForm({ ...form, testeDias: e.target.value })}
                 inputMode="numeric" placeholder="7" style={{ ...inp, marginBottom: 0, width: 120 }} />
        </Campo>
        <button onClick={salvar} style={{
          marginTop: 8, padding: "9px 18px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
          cursor: "pointer", background: T.gold, color: T.bg, border: "none",
        }}>
          Salvar
        </button>
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      {children}
    </div>
  );
}
