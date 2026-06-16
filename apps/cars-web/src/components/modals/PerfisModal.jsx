import React, { useState } from "react";
import { Plus, Trash2, Edit3, Check } from "lucide-react";
import { T } from "../../lib/theme.js";
import { getPerfis, getPerfilAtivo, setPerfilAtivo, addPerfil, removePerfil, updatePerfil, getRoles } from "../../lib/perfis.js";
import { audit } from "../../lib/auditLog.js";
import { confirm } from "../../lib/confirm.js";
import { toast } from "../../lib/toast.js";
import Modal from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";

export default function PerfisModal({ onClose }) {
  const [perfis, setPerfis] = useState(getPerfis());
  const [ativo, setAtivo] = useState(getPerfilAtivo()?.id);
  const [form, setForm] = useState(null);

  const roles = getRoles();

  const reload = () => {
    setPerfis(getPerfis());
    setAtivo(getPerfilAtivo()?.id);
  };

  const trocar = (id) => {
    setPerfilAtivo(id);
    setAtivo(id);
    audit.system(`Trocou perfil ativo para "${perfis.find(p => p.id === id)?.nome}"`);
    toast.success("Perfil ativo trocado. Recarregando…");
    setTimeout(() => window.location.reload(), 600);
  };

  const salvar = () => {
    if (!form.nome?.trim()) { toast.error("Nome obrigatório."); return; }
    if (form.id && perfis.find(p => p.id === form.id)) {
      updatePerfil(form.id, form);
      audit.update("perfil", form.nome, form.id, null, form);
      toast.success("Perfil atualizado.");
    } else {
      const novo = addPerfil(form);
      audit.create("perfil", novo.nome, novo.id, novo);
      toast.success("Perfil adicionado.");
    }
    setForm(null);
    reload();
  };

  const excluir = async (p) => {
    if (p.role === "admin" && perfis.filter(x => x.role === "admin").length === 1) {
      toast.error("Não pode remover o único administrador.");
      return;
    }
    const ok = await confirm({
      title: `Excluir perfil "${p.nome}"?`,
      body: "O perfil será removido. Os dados financeiros permanecem (eles são globais).",
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    removePerfil(p.id);
    audit.delete("perfil", p.nome, p.id, p);
    toast.success("Perfil removido.");
    reload();
  };

  return (
    <>
      <Modal title="Gerenciar usuários do cockpit" onClose={onClose} wide>
        <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 16, lineHeight: 1.6 }}>
          Crie perfis com diferentes permissões. Útil pra deixar um aparelho na loja com perfil
          <strong style={{ color: T.gold }}> "vendedor"</strong> que só vê o módulo da AF4 Motors.
          Os dados financeiros são compartilhados — só o que aparece na tela muda.
        </p>

        <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          {perfis.map(p => {
            const role = roles[p.role] || roles.admin;
            const isAtivo = ativo === p.id;
            return (
              <div key={p.id} style={{
                background: isAtivo ? `${p.cor}11` : T.card,
                border: `${isAtivo ? "2px" : "1px"} solid ${isAtivo ? p.cor : T.border}`,
                borderRadius: 14, padding: 12,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: p.cor, color: T.bg,
                  display: "grid", placeItems: "center",
                  fontWeight: 700, fontSize: 14, flexShrink: 0,
                }}>
                  {p.nome.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <strong style={{ color: T.ink, fontSize: 13 }}>{p.nome}</strong>
                    <span style={{
                      fontSize: 9, padding: "1px 6px", borderRadius: 4,
                      background: `${p.cor}33`, color: p.cor,
                      letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600,
                    }}>
                      {role.label}
                    </span>
                    {isAtivo && (
                      <span style={{
                        fontSize: 9, padding: "1px 6px", borderRadius: 4,
                        background: `${T.green}22`, color: T.green,
                        letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600,
                      }}>
                        ATIVO AGORA
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>
                    {p.email || "—"} · acessa: {Object.entries(p.permissoes).filter(([, v]) => v).map(([k]) => k).join(", ") || "nada"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {!isAtivo && (
                    <button onClick={() => trocar(p.id)} className="btn-ghost"
                            style={{ padding: "6px 10px", fontSize: 10, color: T.gold, borderColor: T.gold }}>
                      Ativar
                    </button>
                  )}
                  <button onClick={() => setForm({ ...p })} className="btn-ghost"
                          style={{ padding: "6px 10px" }} title="Editar">
                    <Edit3 size={11} />
                  </button>
                  <button onClick={() => excluir(p)} className="btn-ghost"
                          style={{ padding: "6px 10px", color: T.red, borderColor: T.red }} title="Excluir">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={() => setForm({ id: "", nome: "", email: "", role: "vendedor", cor: roles.vendedor.cor })}
                className="btn-gold"
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={13} /> Novo perfil
        </button>

        <div style={{ marginTop: 16, padding: 12, background: T.bgSoft, borderRadius: 12, fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
          <strong style={{ color: T.gold }}>Como cada role acessa:</strong>
          <ul style={{ margin: "5px 0 0 18px", padding: 0 }}>
            <li><strong>Admin</strong> · vê tudo, edita tudo. Recomendado pra você.</li>
            <li><strong>Vendedor</strong> · só vê o módulo Loja AF4. Lança vendas e leads. Não vê finanças pessoais. <em>Útil pro Anderson Kid.</em></li>
            <li><strong>Visualizador</strong> · vê tudo mas não edita. Útil pra mostrar pra contador, sócio.</li>
          </ul>
        </div>
      </Modal>

      {form && (
        <Modal title={form.id && perfis.find(p => p.id === form.id) ? "Editar perfil" : "Novo perfil"} onClose={() => setForm(null)}>
          <Field label="Nome *">
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
                   placeholder="Ex.: Anderson Kid" />
          </Field>
          <Field label="E-mail (opcional)">
            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                   placeholder="anderson@af4motors.com.br" />
          </Field>
          <Field label="Função (define as permissões)">
            <select value={form.role} onChange={e => {
              const role = e.target.value;
              setForm({ ...form, role, cor: roles[role].cor, permissoes: roles[role].permissoes });
            }}>
              {Object.entries(roles).map(([id, r]) => (
                <option key={id} value={id}>{r.label}</option>
              ))}
            </select>
          </Field>

          <div style={{ marginTop: 10, padding: 10, background: T.bgSoft, borderRadius: 11, fontSize: 11, color: T.muted }}>
            <strong style={{ color: roles[form.role].cor }}>{roles[form.role].label}</strong> verá:&nbsp;
            {Object.entries(roles[form.role].permissoes).filter(([, v]) => v).map(([k]) => k).join(", ") || "nenhum módulo"}
          </div>

          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={salvar}>
              <Check size={13} style={{ display: "inline", marginRight: 6 }} /> Salvar
            </button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </>
  );
}
