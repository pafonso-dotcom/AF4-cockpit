import React, { useEffect, useState, useMemo } from "react";
import { Users, RefreshCw, Award, CreditCard, Settings, Search } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fetchAdminOverview, adminEmail } from "../../lib/admin.js";
import { carregarFundamentos } from "../../lib/fundamentos.js";
import { billingEnabled, trialDias } from "../../lib/subscription.js";

/**
 * Painel administrativo do Aurum (só admin). Abas:
 * Clientes · Curadoria · Assinaturas · Configurações.
 */
const ABAS = [
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "curadoria", label: "Curadoria", icon: Award },
  { id: "assinaturas", label: "Assinaturas", icon: CreditCard },
  { id: "config", label: "Configurações", icon: Settings },
];

export default function Admin() {
  const [aba, setAba] = useState("clientes");
  const [data, setData] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = () => {
    setCarregando(true); setErro(null);
    fetchAdminOverview()
      .then(d => { setData(d); setCarregando(false); })
      .catch(e => { setErro(e.message); setCarregando(false); });
  };
  useEffect(() => { carregar(); }, []);

  return (
    <div className="fade-up py-8 px-6" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <Settings size={20} style={{ color: T.gold }} />
        <h2 style={{ fontFamily: T.serif, fontSize: 22, color: T.ink, fontWeight: 600 }}>Painel administrativo</h2>
        <button onClick={carregar} title="Atualizar" style={{
          marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6,
          background: "transparent", border: `1px solid ${T.border}`, color: T.muted,
          padding: "6px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer",
        }}>
          <RefreshCw size={13} className={carregando ? "spin" : ""} /> Atualizar
        </button>
      </div>

      {/* Abas internas */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {ABAS.map(a => {
          const Icon = a.icon, ativo = aba === a.id;
          return (
            <button key={a.id} onClick={() => setAba(a.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 100, fontSize: 12.5, cursor: "pointer",
                border: `1px solid ${ativo ? T.gold : T.border}`,
                background: ativo ? `${T.gold}22` : "transparent",
                color: ativo ? T.gold : T.muted, fontWeight: ativo ? 600 : 400,
              }}>
              <Icon size={13} /> {a.label}
            </button>
          );
        })}
      </div>

      {erro && (
        <div style={{ padding: 14, borderRadius: 10, background: `${T.red}14`, border: `1px solid ${T.red}44`, color: T.red, fontSize: 13, marginBottom: 14 }}>
          <strong>Não foi possível carregar os dados de admin.</strong> {erro}
          <div style={{ color: T.muted, fontSize: 11.5, marginTop: 6 }}>
            Configure no Cloudflare as variáveis <code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_ROLE</code>, <code>ADMIN_EMAIL</code>, <code>VITE_ADMIN_EMAIL</code> (veja DEPLOY.md).
          </div>
        </div>
      )}

      {aba === "clientes" && <Clientes data={data} />}
      {aba === "curadoria" && <Curadoria />}
      {aba === "assinaturas" && <Assinaturas data={data} />}
      {aba === "config" && <Config />}
    </div>
  );
}

/* ---------- Clientes ---------- */
function Clientes({ data }) {
  const [busca, setBusca] = useState("");
  if (!data) return <Vazio texto="Carregando clientes…" />;
  const lista = (data.usuarios || []).filter(u => !busca || (u.email || "").toLowerCase().includes(busca.toLowerCase()));
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 16 }}>
        <Kpi label="Clientes" valor={data.totais.clientes} cor={T.gold} />
        <Kpi label="Assinantes ativos" valor={data.totais.assinantesAtivos} cor={T.green} />
        <Kpi label="Assinaturas (total)" valor={data.totais.assinaturas} cor={T.ink} />
      </div>
      <div style={{ position: "relative", marginBottom: 12, maxWidth: 320 }}>
        <Search size={13} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por e-mail…"
               style={{ width: "100%", padding: "8px 11px 8px 32px", background: T.bgSoft, border: `1px solid ${T.border}`, color: T.ink, fontSize: 12.5, borderRadius: 8 }} />
      </div>
      <Tabela>
        <thead>
          <tr style={{ background: T.bgSoft }}>
            <th style={th("left")}>Cliente</th>
            <th style={th("center")}>Confirmado</th>
            <th style={th("center")}>Assinatura</th>
            <th style={th("left")}>Cadastro</th>
            <th style={th("left")}>Último acesso</th>
          </tr>
        </thead>
        <tbody>
          {lista.length === 0 ? (
            <tr><td colSpan={5} style={{ ...td(), textAlign: "center", color: T.faint, fontStyle: "italic", padding: 24 }}>Nenhum cliente.</td></tr>
          ) : lista.map(u => (
            <tr key={u.id} style={{ borderTop: `1px solid ${T.border}` }}>
              <td style={{ ...td(), color: T.ink }}>{u.email}</td>
              <td style={{ ...td(), textAlign: "center" }}>{u.confirmado ? "✅" : "—"}</td>
              <td style={{ ...td(), textAlign: "center" }}><StatusChip status={u.status} /></td>
              <td style={td()}>{fmtData(u.criado)}</td>
              <td style={td()}>{fmtData(u.ultimoLogin)}</td>
            </tr>
          ))}
        </tbody>
      </Tabela>
    </>
  );
}

/* ---------- Curadoria (base de fundamentos) ---------- */
function Curadoria() {
  const [fund, setFund] = useState(null);
  useEffect(() => { carregarFundamentos(true).then(setFund).catch(() => setFund({})); }, []);
  const linhas = useMemo(() => Object.values(fund || {}).sort((a, b) => (a.ticker || "").localeCompare(b.ticker || "")), [fund]);
  if (!fund) return <Vazio texto="Carregando base…" />;
  const porClasse = linhas.reduce((m, r) => { m[r.classe || "fii"] = (m[r.classe || "fii"] || 0) + 1; return m; }, {});
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Kpi label="Ativos na base" valor={linhas.length} cor={T.gold} />
        <Kpi label="FIIs" valor={porClasse.fii || 0} cor={T.ink} />
        <Kpi label="Ações BR" valor={porClasse.acao || 0} cor={T.ink} />
        <Kpi label="EUA (Stock/REIT)" valor={(porClasse.stock || 0) + (porClasse.reit || 0)} cor={T.ink} />
      </div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>
        O cadastro e a edição dos indicadores são feitos na aba <strong>Análise</strong> (botão "Cadastrar ativo"). Aqui é a visão geral da base que alimenta a classificação automática.
      </div>
      <Tabela>
        <thead>
          <tr style={{ background: T.bgSoft }}>
            <th style={th("left")}>Ticker</th>
            <th style={th("left")}>Nome</th>
            <th style={th("center")}>Classe</th>
            <th style={th("left")}>Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 ? (
            <tr><td colSpan={4} style={{ ...td(), textAlign: "center", color: T.faint, fontStyle: "italic", padding: 24 }}>Base vazia. Cadastre ativos na aba Análise.</td></tr>
          ) : linhas.map(r => (
            <tr key={r.ticker} style={{ borderTop: `1px solid ${T.border}` }}>
              <td style={{ ...td(), color: T.ink, fontWeight: 600 }}>{r.ticker}</td>
              <td style={td()}>{r.nome || "—"}</td>
              <td style={{ ...td(), textAlign: "center", textTransform: "uppercase", fontSize: 11 }}>{r.classe}</td>
              <td style={td()}>{fmtData(r.atualizado_em)}</td>
            </tr>
          ))}
        </tbody>
      </Tabela>
    </>
  );
}

/* ---------- Assinaturas / Financeiro ---------- */
function Assinaturas({ data }) {
  if (!data) return <Vazio texto="Carregando…" />;
  const ativos = (data.usuarios || []).filter(u => ["active", "trialing"].includes(u.status));
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 14 }}>
        <Kpi label="Assinantes ativos" valor={data.totais.assinantesAtivos} cor={T.green} />
        <Kpi label="Total de assinaturas" valor={data.totais.assinaturas} cor={T.ink} />
        <Kpi label="Cobrança" valor={billingEnabled ? "Ligada" : "Desligada"} cor={billingEnabled ? T.green : T.muted} />
      </div>
      {!billingEnabled && (
        <div style={{ padding: 12, borderRadius: 10, background: `${T.gold}14`, border: `1px solid ${T.gold}44`, color: T.gold, fontSize: 12.5, marginBottom: 14 }}>
          A cobrança está <strong>desligada</strong>. A receita aparecerá aqui quando o Mercado Pago for ligado (checkout + webhook) e a chave <code>VITE_BILLING_ENABLED=true</code> for definida.
        </div>
      )}
      <Tabela>
        <thead>
          <tr style={{ background: T.bgSoft }}>
            <th style={th("left")}>Cliente</th>
            <th style={th("center")}>Status</th>
            <th style={th("left")}>Validade</th>
          </tr>
        </thead>
        <tbody>
          {ativos.length === 0 ? (
            <tr><td colSpan={3} style={{ ...td(), textAlign: "center", color: T.faint, fontStyle: "italic", padding: 24 }}>Nenhuma assinatura ativa ainda.</td></tr>
          ) : ativos.map(u => (
            <tr key={u.id} style={{ borderTop: `1px solid ${T.border}` }}>
              <td style={{ ...td(), color: T.ink }}>{u.email}</td>
              <td style={{ ...td(), textAlign: "center" }}><StatusChip status={u.status} /></td>
              <td style={td()}>{fmtData(u.validade)}</td>
            </tr>
          ))}
        </tbody>
      </Tabela>
    </>
  );
}

/* ---------- Configurações (estado atual) ---------- */
function Config() {
  const linhas = [
    { k: "Admin (VITE_ADMIN_EMAIL)", v: adminEmail || "— não definido —" },
    { k: "Cobrança (VITE_BILLING_ENABLED)", v: billingEnabled ? "Ligada" : "Desligada" },
    { k: "Período de teste (VITE_TRIAL_DIAS)", v: trialDias > 0 ? `${trialDias} dias` : "Sem trial" },
  ];
  return (
    <>
      <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 12 }}>
        Estado atual das configurações. Elas são definidas nas <strong>Environment variables</strong> do Cloudflare Pages (veja DEPLOY.md) e aplicadas no próximo deploy.
      </div>
      <Tabela>
        <thead>
          <tr style={{ background: T.bgSoft }}>
            <th style={th("left")}>Configuração</th>
            <th style={th("left")}>Valor atual</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(l => (
            <tr key={l.k} style={{ borderTop: `1px solid ${T.border}` }}>
              <td style={{ ...td(), color: T.ink }}>{l.k}</td>
              <td style={td()}>{l.v}</td>
            </tr>
          ))}
        </tbody>
      </Tabela>
      <div style={{ marginTop: 10, fontSize: 10.5, color: T.faint, fontStyle: "italic" }}>
        Edição de preço/textos diretamente pelo painel entra numa próxima fase (requer tabela de config em runtime).
      </div>
    </>
  );
}

/* ---------- UI helpers ---------- */
function Kpi({ label, valor, cor }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, marginBottom: 4 }}>{label}</div>
      <div className="num" style={{ fontFamily: T.serif, fontSize: 24, fontWeight: 600, color: cor }}>{valor}</div>
    </div>
  );
}
function Tabela({ children }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", fontSize: 12.5 }}>{children}</table>
      </div>
    </div>
  );
}
function Vazio({ texto }) {
  return <div style={{ padding: 30, textAlign: "center", color: T.faint, fontStyle: "italic" }}>{texto}</div>;
}
function StatusChip({ status }) {
  const map = {
    active: { l: "Ativa", c: T.green }, trialing: { l: "Teste", c: T.gold },
    past_due: { l: "Atrasada", c: T.red }, canceled: { l: "Cancelada", c: T.muted },
    inactive: { l: "Inativa", c: T.muted }, "—": { l: "—", c: T.faint },
  };
  const s = map[status] || { l: status, c: T.muted };
  return <span style={{ fontSize: 10.5, fontWeight: 600, color: s.c }}>{s.l}</span>;
}
function fmtData(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return "—"; }
}
const th = (a) => ({ padding: "9px 11px", textAlign: a, fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: T.muted, fontWeight: 600 });
const td = () => ({ padding: "9px 11px", verticalAlign: "middle" });
