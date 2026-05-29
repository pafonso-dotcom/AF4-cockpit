import React, { useEffect, useState } from "react";
import { Users, RefreshCw } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fetchAdminOverview } from "../../lib/admin.js";

/**
 * Painel gerencial (só admin): clientes cadastrados + resumo de assinaturas.
 * Os dados vêm do endpoint protegido /api/admin/overview.
 */
export default function Admin() {
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
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <Users size={20} style={{ color: T.gold }} />
        <h2 style={{ fontFamily: T.serif, fontSize: 22, color: T.ink, fontWeight: 600 }}>Gerencial</h2>
        <button onClick={carregar} title="Atualizar" style={{
          marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6,
          background: "transparent", border: `1px solid ${T.border}`, color: T.muted,
          padding: "6px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer",
        }}>
          <RefreshCw size={13} className={carregando ? "spin" : ""} /> Atualizar
        </button>
      </div>

      {erro && (
        <div style={{
          padding: 14, borderRadius: 10, background: `${T.red}14`, border: `1px solid ${T.red}44`,
          color: T.red, fontSize: 13, marginBottom: 14,
        }}>
          <strong>Não foi possível carregar.</strong> {erro}
          <div style={{ color: T.muted, fontSize: 11.5, marginTop: 6 }}>
            Dica: configure no Cloudflare Pages as variáveis <code>SUPABASE_URL</code>,
            <code> SUPABASE_SERVICE_ROLE</code> e <code>ADMIN_EMAIL</code> (veja o DEPLOY.md).
          </div>
        </div>
      )}

      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 18 }}>
            <Kpi label="Clientes" valor={data.totais.clientes} cor={T.gold} />
            <Kpi label="Assinantes ativos" valor={data.totais.assinantesAtivos} cor={T.green} />
            <Kpi label="Assinaturas (total)" valor={data.totais.assinaturas} cor={T.ink} />
          </div>

          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse", fontSize: 12.5 }}>
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
                  {data.usuarios.length === 0 ? (
                    <tr><td colSpan={5} style={{ ...td(), textAlign: "center", color: T.faint, fontStyle: "italic", padding: 24 }}>Nenhum cliente ainda.</td></tr>
                  ) : data.usuarios.map(u => (
                    <tr key={u.id} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ ...td(), color: T.ink }}>{u.email}</td>
                      <td style={{ ...td(), textAlign: "center" }}>{u.confirmado ? "✅" : "—"}</td>
                      <td style={{ ...td(), textAlign: "center" }}><StatusChip status={u.status} /></td>
                      <td style={td()}>{fmtData(u.criado)}</td>
                      <td style={td()}>{fmtData(u.ultimoLogin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 10.5, color: T.faint, fontStyle: "italic" }}>
            Receita aparecerá aqui quando a cobrança (Mercado Pago) estiver ligada e com preço definido.
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, valor, cor }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, marginBottom: 4 }}>{label}</div>
      <div className="num" style={{ fontFamily: T.serif, fontSize: 26, fontWeight: 600, color: cor }}>{valor}</div>
    </div>
  );
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
