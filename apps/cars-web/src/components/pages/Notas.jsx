import React, { useMemo, useState } from "react";
import { Plus, Trash2, Edit3, Search, Tag as TagIcon } from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";
import Field from "../ui/Field.jsx";
import Modal from "../ui/Modal.jsx";

const CATEGORIAS_PADRAO = [
  { id: "investimentos", label: "Investimentos", cor: "#5b9bd5" },
  { id: "viagens",       label: "Viagens",       cor: "#70ad47" },
  { id: "trabalho",      label: "Trabalho",      cor: "#c9a96b" },
  { id: "pessoal",       label: "Pessoal",       cor: "#e7a3a3" },
  { id: "geral",         label: "Geral",         cor: "#9b9b9b" },
];

const corCategoria = (id) =>
  CATEGORIAS_PADRAO.find(c => c.id === id)?.cor || T.gold;

const labelCategoria = (id) =>
  CATEGORIAS_PADRAO.find(c => c.id === id)?.label || id;

function formatarData(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return ""; }
}

export default function Notas({ notas = [], setNotas }) {
  const [form, setForm] = useState(null);
  const [filtroCat, setFiltroCat] = useState("todas");
  const [busca, setBusca] = useState("");
  const [formErrors, setFormErrors] = useState({});

  const notasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return notas
      .filter(n => filtroCat === "todas" || n.categoria === filtroCat)
      .filter(n => !q || (n.titulo || "").toLowerCase().includes(q) || (n.conteudo || "").toLowerCase().includes(q) || (n.tags || []).some(t => t.toLowerCase().includes(q)))
      .slice()
      .sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""));
  }, [notas, filtroCat, busca]);

  const novaNota = () => {
    setForm({
      id: null,
      titulo: "",
      conteudo: "",
      categoria: "geral",
      tagsRaw: "",
    });
    setFormErrors({});
  };

  const editarNota = (n) => {
    setForm({
      ...n,
      tagsRaw: (n.tags || []).join(", "),
    });
    setFormErrors({});
  };

  const salvar = () => {
    const errs = {};
    if (!form.titulo?.trim()) errs.titulo = "Título é obrigatório";

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }

    const agora = new Date().toISOString();
    const tags = (form.tagsRaw || "")
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);

    const data = {
      id: form.id || uid(),
      titulo: form.titulo.trim(),
      conteudo: form.conteudo || "",
      categoria: form.categoria || "geral",
      tags,
      createdAt: form.createdAt || agora,
      updatedAt: agora,
    };

    if (form.id && notas.find(n => n.id === form.id)) {
      setNotas(notas.map(n => n.id === form.id ? data : n));
      toast.success("Nota atualizada.");
    } else {
      setNotas([...notas, data]);
      toast.success(`Nota "${data.titulo}" criada.`);
    }
    setForm(null);
    setFormErrors({});
  };

  const excluir = async (n) => {
    const ok = await confirm({
      title: `Excluir nota "${n.titulo}"?`,
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    const backup = notas;
    setNotas(notas.filter(x => x.id !== n.id));
    toast.success(`Nota "${n.titulo}" excluída.`, {
      action: { label: "Desfazer", onClick: () => setNotas(backup) },
    });
  };

  const contagemPorCat = useMemo(() => {
    const m = { todas: notas.length };
    for (const c of CATEGORIAS_PADRAO) m[c.id] = 0;
    for (const n of notas) m[n.categoria] = (m[n.categoria] || 0) + 1;
    return m;
  }, [notas]);

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Bloco de Notas"
        title="Anotações"
        sub="Pensamentos, ideias, lembretes sobre investimentos, viagens e qualquer coisa."
        action={
          <button className="btn-gold" onClick={novaNota}>
            <Plus size={14} className="inline mr-2" />Nova Nota
          </button>
        }
      />

      {/* Busca + filtros de categoria */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 20 }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted }} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por título, conteúdo ou tag..."
            style={{
              width: "100%", padding: "8px 10px 8px 30px",
              background: T.card, border: `1px solid ${T.border}`,
              color: T.ink, fontSize: 13, borderRadius: 6,
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[{ id: "todas", label: "Todas" }, ...CATEGORIAS_PADRAO].map(c => {
            const ativo = filtroCat === c.id;
            const cor = c.id === "todas" ? T.gold : corCategoria(c.id);
            return (
              <button
                key={c.id}
                onClick={() => setFiltroCat(c.id)}
                style={{
                  padding: "6px 12px",
                  background: ativo ? `${cor}22` : T.card,
                  border: `1px solid ${ativo ? cor : T.border}`,
                  color: ativo ? cor : T.muted,
                  fontSize: 11, fontWeight: 600, borderRadius: 100,
                  cursor: "pointer", letterSpacing: ".03em",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {c.label}
                <span style={{ opacity: 0.7, fontSize: 10 }}>{contagemPorCat[c.id] || 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista */}
      {notasFiltradas.length === 0 ? (
        <div className="text-center py-12" style={{ color: T.muted, fontStyle: "italic" }}>
          {notas.length === 0
            ? "Nenhuma nota ainda. Clique em \"Nova Nota\" pra começar."
            : "Nenhuma nota corresponde à busca/filtro."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {notasFiltradas.map(n => {
            const cor = corCategoria(n.categoria);
            return (
              <div
                key={n.id}
                style={{
                  background: T.card, border: `1px solid ${T.border}`,
                  borderLeft: `4px solid ${cor}`,
                  padding: 18, borderRadius: 6,
                  display: "flex", flexDirection: "column", gap: 8,
                  minHeight: 160,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div className="label-eyebrow" style={{ color: cor }}>{labelCategoria(n.categoria)}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => editarNota(n)} aria-label={`Editar nota ${n.titulo}`} style={{ color: T.muted, background: "none", border: "none", cursor: "pointer" }}>
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => excluir(n)} aria-label={`Excluir nota ${n.titulo}`} style={{ color: T.red, background: "none", border: "none", cursor: "pointer" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h3 style={{ fontFamily: T.serif, fontSize: 18, color: T.ink, lineHeight: 1.25, margin: 0 }}>
                  {n.titulo}
                </h3>

                {n.conteudo && (
                  <p style={{
                    fontSize: 12.5, color: T.muted, lineHeight: 1.5,
                    margin: 0, whiteSpace: "pre-wrap",
                    display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}>
                    {n.conteudo}
                  </p>
                )}

                <div style={{ flex: 1 }} />

                {n.tags && n.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {n.tags.map(t => (
                      <span key={t} style={{
                        fontSize: 10, padding: "2px 7px", borderRadius: 100,
                        background: T.bgSoft, color: T.muted,
                        display: "inline-flex", alignItems: "center", gap: 3,
                      }}>
                        <TagIcon size={9} />{t}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: 10, color: T.faint, letterSpacing: ".05em" }}>
                  {n.updatedAt && n.updatedAt !== n.createdAt
                    ? `editado ${formatarData(n.updatedAt)}`
                    : formatarData(n.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de edição */}
      {form && (
        <Modal title={form.id ? "Editar Nota" : "Nova Nota"} onClose={() => setForm(null)}>
          <Field label="Título" required error={formErrors.titulo}>
            <input
              value={form.titulo}
              onChange={e => setForm({ ...form, titulo: e.target.value })}
              placeholder="Ex.: Estratégia FII Logística 2026"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoria">
              <select
                value={form.categoria}
                onChange={e => setForm({ ...form, categoria: e.target.value })}
              >
                {CATEGORIAS_PADRAO.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Tags (separadas por vírgula)">
              <input
                value={form.tagsRaw}
                onChange={e => setForm({ ...form, tagsRaw: e.target.value })}
                placeholder="Ex.: fii, logistica, 2026"
              />
            </Field>
          </div>

          <Field label="Conteúdo">
            <textarea
              value={form.conteudo}
              onChange={e => setForm({ ...form, conteudo: e.target.value })}
              placeholder="Escreve aqui..."
              rows={10}
              style={{ resize: "vertical", minHeight: 140, fontFamily: "inherit" }}
            />
          </Field>

          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={salvar}>Salvar</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
