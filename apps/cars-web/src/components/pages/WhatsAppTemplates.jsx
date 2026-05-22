import React, { useState } from "react";
import { MessageCircle, RefreshCw, Check } from "lucide-react";
import { T } from "../../lib/theme.js";
import { getTemplates, setTemplate, resetTemplates, getDefaults } from "../../lib/whatsapp.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";

const META = [
  { id: "cobranca",         titulo: "Cobrança de devedor",       vars: ["nome", "valor", "data"], cor: "#fbbf24", desc: "Disparada quando você clica no ícone 💬 num devedor pendente." },
  { id: "cobrancaDivida",   titulo: "Cobrança de dívida",        vars: ["nome", "valor", "data"], cor: "#f87171", desc: "Quando você manda a cobrança de uma dívida sua." },
  { id: "lembreteCheque",   titulo: "Lembrete de cheque",        vars: ["nome", "numero", "valor", "data"], cor: "#60a5fa", desc: "Lembrete pro emitente antes do cheque compensar." },
  { id: "reciboVenda",      titulo: "Recibo de venda",           vars: ["nome", "veiculo", "valor", "pagamento", "data"], cor: "#4ade80", desc: "Enviado no recibo gerado após uma venda da Loja." },
  { id: "agradecimentoVenda", titulo: "Agradecimento pós-venda", vars: ["nome", "veiculo"], cor: "#a78bfa", desc: "Mensagem opcional após fechar negócio." },
  { id: "followUpLead",     titulo: "Follow-up de lead",         vars: ["nome", "veiculo"], cor: "#60a5fa", desc: "Pra reativar leads que ficaram quietos." },
  { id: "agendamentoVisita", titulo: "Agendamento de visita",    vars: ["nome", "veiculo", "data"], cor: "#c9a961", desc: "Confirma data e horário da visita." },
];

export default function WhatsAppTemplates() {
  const [templates, setTemplates] = useState(getTemplates());
  const [editando, setEditando] = useState(null); // id sendo editado
  const [draft, setDraft] = useState("");

  const iniciarEdicao = (id) => {
    setEditando(id);
    setDraft(templates[id]);
  };

  const salvar = () => {
    setTemplate(editando, draft);
    setTemplates(getTemplates());
    toast.success("Template salvo.");
    setEditando(null);
  };

  const restaurar = async (id) => {
    const ok = await confirm({
      title: "Restaurar padrão?",
      body: "Seu texto atual será substituído pelo template original.",
      confirmLabel: "Restaurar",
    });
    if (!ok) return;
    const defaults = getDefaults();
    setTemplate(id, defaults[id]);
    setTemplates(getTemplates());
    if (editando === id) setDraft(defaults[id]);
    toast.success("Padrão restaurado.");
  };

  const restaurarTodos = async () => {
    const ok = await confirm({
      title: "Restaurar TODOS os templates?",
      body: "Todos os textos personalizados serão perdidos. Use só se quiser começar do zero.",
      danger: true, confirmLabel: "Sim, restaurar tudo",
    });
    if (!ok) return;
    resetTemplates();
    setTemplates(getTemplates());
    setEditando(null);
    toast.success("Templates restaurados.");
  };

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Loja · Comunicação"
        title={<>Templates de <em>WhatsApp.</em></>}
        sub="Mensagens prontas para cobrar, lembrar, agradecer e fazer follow-up. Personalizáveis. Variáveis em {chaves} são preenchidas automaticamente no envio."
        action={
          <button onClick={restaurarTodos} className="btn-ghost"
                  style={{ color: T.red, borderColor: T.red, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={12} /> Restaurar tudo
          </button>
        }
      />

      <div style={{ display: "grid", gap: 12 }}>
        {META.map(m => {
          const isEditing = editando === m.id;
          const texto = isEditing ? draft : templates[m.id];

          return (
            <div key={m.id} style={{
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 10, padding: 16,
              borderLeft: `4px solid ${m.cor}`,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                <MessageCircle size={20} style={{ color: m.cor, flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 14, color: T.ink, fontWeight: 600, marginBottom: 3 }}>
                    {m.titulo}
                  </h3>
                  <p style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.5 }}>{m.desc}</p>
                  <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {m.vars.map(v => (
                      <code key={v} style={{
                        fontSize: 10, padding: "2px 6px",
                        background: T.bgSoft, color: m.cor,
                        borderRadius: 3, fontFamily: "monospace",
                      }}>
                        {`{${v}}`}
                      </code>
                    ))}
                  </div>
                </div>
                {!isEditing && (
                  <button onClick={() => iniciarEdicao(m.id)} className="btn-ghost"
                          style={{ padding: "6px 11px", fontSize: 10 }}>
                    Editar
                  </button>
                )}
              </div>

              {isEditing ? (
                <>
                  <textarea
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    rows={8}
                    style={{
                      width: "100%", padding: 11,
                      background: T.bgSoft, color: T.ink,
                      border: `1px solid ${T.border}`, borderRadius: 6,
                      fontSize: 12.5, lineHeight: 1.5, fontFamily: T.body,
                      resize: "vertical", outline: "none",
                    }}
                  />
                  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                    <button onClick={salvar} className="btn-gold"
                            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Check size={12} /> Salvar
                    </button>
                    <button onClick={() => setEditando(null)} className="btn-ghost">
                      Cancelar
                    </button>
                    <button onClick={() => restaurar(m.id)} className="btn-ghost"
                            style={{ marginLeft: "auto", color: T.muted }}>
                      <RefreshCw size={11} style={{ display: "inline", marginRight: 4 }} />
                      Restaurar padrão
                    </button>
                  </div>
                </>
              ) : (
                <div style={{
                  padding: 11, background: T.bgSoft,
                  borderRadius: 6, fontSize: 12, lineHeight: 1.5,
                  color: T.muted, whiteSpace: "pre-wrap",
                  fontFamily: T.body, maxHeight: 100, overflow: "hidden",
                  position: "relative",
                }}>
                  {texto.slice(0, 220)}{texto.length > 220 ? "…" : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 18, padding: 14, background: T.bgSoft, borderRadius: 8, fontSize: 11.5, color: T.muted, lineHeight: 1.6 }}>
        <strong style={{ color: T.gold }}>Onde os botões aparecem:</strong>
        <ul style={{ margin: "6px 0 0 20px", padding: 0 }}>
          <li><strong>A Receber & Dívidas</strong> → ícone 💬 verde ao lado de editar/excluir</li>
          <li><strong>Recibo de venda</strong> → botão "WhatsApp" no final do recibo</li>
          <li><strong>Cheques</strong> → botão "💬 Avisar" quando faltam ≤3 dias</li>
          <li><strong>Leads</strong> → botão "Follow-up" no funil de vendas</li>
        </ul>
      </div>
    </div>
  );
}
