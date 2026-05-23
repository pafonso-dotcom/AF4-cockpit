import React, { useMemo, useState } from "react";
import {
  Plus, Trash2, Edit3, Search, Tag as TagIcon, Pin, PinOff,
  TrendingUp, Plane, Briefcase, Heart, Bookmark, StickyNote, FileText,
} from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";
import Field from "../ui/Field.jsx";
import Modal from "../ui/Modal.jsx";

const CATEGORIAS_PADRAO = [
  { id: "investimentos", label: "Investimentos", cor: "#5b9bd5", icon: TrendingUp },
  { id: "viagens",       label: "Viagens",       cor: "#70ad47", icon: Plane },
  { id: "trabalho",      label: "Trabalho",      cor: "#c9a96b", icon: Briefcase },
  { id: "pessoal",       label: "Pessoal",       cor: "#e7a3a3", icon: Heart },
  { id: "geral",         label: "Geral",         cor: "#9b9b9b", icon: Bookmark },
];

const catMeta = (id) =>
  CATEGORIAS_PADRAO.find(c => c.id === id) || { id, label: id, cor: T.gold, icon: Bookmark };

function dataRelativa(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);
    const diffDias = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return "agora";
    if (diffMin < 60) return `há ${diffMin} min`;
    if (diffH < 24) return `há ${diffH}h`;
    if (diffDias === 0) return "hoje";
    if (diffDias === 1) return "ontem";
    if (diffDias < 7) return `há ${diffDias} dias`;
    if (diffDias < 30) {
      const semanas = Math.floor(diffDias / 7);
      return `há ${semanas} sem`;
    }
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
  } catch { return ""; }
}

// Mistura a cor da categoria com o fundo do card pra ficar "post-it" sutil
function corPostIt(corHex, alpha = "1a") {
  return `${corHex}${alpha}`;
}

export default function Notas({ notas = [], setNotas }) {
  const [form, setForm] = useState(null);
  const [filtroCat, setFiltroCat] = useState("todas");
  const [busca, setBusca] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [quickAdd, setQuickAdd] = useState("");

  const notasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return notas
      .filter(n => filtroCat === "todas" || n.categoria === filtroCat)
      .filter(n => !q
        || (n.titulo || "").toLowerCase().includes(q)
        || (n.conteudo || "").toLowerCase().includes(q)
        || (n.tags || []).some(t => t.toLowerCase().includes(q)))
      .slice()
      .sort((a, b) => {
        // Pinned no topo
        if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        return (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "");
      });
  }, [notas, filtroCat, busca]);

  const novaNota = (preset = {}) => {
    setForm({
      id: null,
      titulo: "",
      conteudo: "",
      categoria: "geral",
      tagsRaw: "",
      pinned: false,
      ...preset,
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

  const togglePin = (n) => {
    setNotas(notas.map(x => x.id === n.id ? { ...x, pinned: !x.pinned, updatedAt: new Date().toISOString() } : x));
    toast.success(n.pinned ? "Nota desafixada." : "Nota fixada no topo.");
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
      pinned: !!form.pinned,
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

  const handleQuickAdd = () => {
    const t = quickAdd.trim();
    if (!t) return;
    novaNota({ titulo: t });
    setQuickAdd("");
  };

  const contagemPorCat = useMemo(() => {
    const m = { todas: notas.length };
    for (const c of CATEGORIAS_PADRAO) m[c.id] = 0;
    for (const n of notas) m[n.categoria] = (m[n.categoria] || 0) + 1;
    return m;
  }, [notas]);

  const pinnedCount = useMemo(() => notas.filter(n => n.pinned).length, [notas]);

  return (
    <div className="fade-up py-8">
      <style>{`
        .notas-card {
          position: relative;
          transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
        }
        .notas-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px -12px rgba(0,0,0,.35);
        }
        .notas-card .acoes { opacity: 0; transition: opacity .15s ease; }
        .notas-card:hover .acoes, .notas-card:focus-within .acoes { opacity: 1; }
        @media (max-width: 768px) { .notas-card .acoes { opacity: 1; } }
        .notas-quick {
          background: ${T.bgSoft};
          border: 1px dashed ${T.border};
          padding: 14px 16px;
          border-radius: 10px;
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 18px;
          transition: border-color .15s ease, background .15s ease;
        }
        .notas-quick:focus-within {
          border-color: ${T.gold};
          background: ${T.card};
        }
        .notas-quick input {
          flex: 1; background: transparent; border: none; outline: none;
          color: ${T.ink}; font-size: 14px; font-family: inherit;
        }
        .notas-quick input::placeholder { color: ${T.faint}; }
      `}</style>

      <PageHeader
        eyebrow="Bloco de Notas"
        title="Anotações"
        sub="Ideias, lembretes e pensamentos — organizados por categoria e fácil de buscar."
        action={
          <button className="btn-gold" onClick={() => novaNota()}>
            <Plus size={14} className="inline mr-2" />Nova Nota
          </button>
        }
      />

      {/* Stats compactos */}
      <div style={{
        display: "flex", gap: 16, flexWrap: "wrap",
        margin: "-8px 0 18px", fontSize: 11, color: T.muted,
      }}>
        <span><strong style={{ color: T.ink, fontWeight: 600 }}>{notas.length}</strong> {notas.length === 1 ? "nota" : "notas"} no total</span>
        {pinnedCount > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Pin size={11} style={{ color: T.gold }} />
            <strong style={{ color: T.ink, fontWeight: 600 }}>{pinnedCount}</strong> fixada{pinnedCount === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* Quick add */}
      <div className="notas-quick">
        <StickyNote size={16} style={{ color: T.gold, flexShrink: 0 }} />
        <input
          value={quickAdd}
          onChange={e => setQuickAdd(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleQuickAdd(); }}
          placeholder="Anotar rápido... (Enter abre o editor)"
        />
        {quickAdd && (
          <button onClick={handleQuickAdd}
            style={{
              background: T.gold, color: T.bg, border: "none",
              padding: "6px 14px", borderRadius: 4, fontSize: 11, fontWeight: 700,
              cursor: "pointer", letterSpacing: ".05em", textTransform: "uppercase",
            }}>
            Criar
          </button>
        )}
      </div>

      {/* Busca + filtros */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 22 }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted, pointerEvents: "none" }} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por título, conteúdo ou tag..."
            style={{
              width: "100%", padding: "9px 10px 9px 32px",
              background: T.card, border: `1px solid ${T.border}`,
              color: T.ink, fontSize: 13, borderRadius: 6,
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[{ id: "todas", label: "Todas", icon: FileText }, ...CATEGORIAS_PADRAO].map(c => {
            const ativo = filtroCat === c.id;
            const cor = c.id === "todas" ? T.gold : c.cor;
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                onClick={() => setFiltroCat(c.id)}
                style={{
                  padding: "7px 13px",
                  background: ativo ? `${cor}22` : T.card,
                  border: `1px solid ${ativo ? cor : T.border}`,
                  color: ativo ? cor : T.muted,
                  fontSize: 11, fontWeight: 600, borderRadius: 100,
                  cursor: "pointer", letterSpacing: ".03em",
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "all .15s ease",
                }}
              >
                <Icon size={11} />
                {c.label}
                <span style={{
                  opacity: 0.7, fontSize: 10,
                  padding: "1px 6px", borderRadius: 100,
                  background: ativo ? `${cor}33` : T.bgSoft,
                }}>
                  {contagemPorCat[c.id] || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista ou empty state */}
      {notasFiltradas.length === 0 ? (
        <EmptyState
          temNotas={notas.length > 0}
          onCriar={() => novaNota()}
        />
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 14,
        }}>
          {notasFiltradas.map(n => {
            const meta = catMeta(n.categoria);
            const Icon = meta.icon;
            return (
              <div
                key={n.id}
                className="notas-card"
                style={{
                  background: corPostIt(meta.cor, "0d"),
                  border: `1px solid ${corPostIt(meta.cor, "33")}`,
                  borderTop: `3px solid ${meta.cor}`,
                  padding: 16, borderRadius: 8,
                  display: "flex", flexDirection: "column", gap: 8,
                  minHeight: 170,
                }}
              >
                {n.pinned && (
                  <div style={{
                    position: "absolute", top: -6, right: 10,
                    background: T.gold, color: T.bg,
                    width: 22, height: 22, borderRadius: "50%",
                    display: "grid", placeItems: "center",
                    boxShadow: "0 2px 6px rgba(0,0,0,.25)",
                  }} title="Fixada">
                    <Pin size={11} />
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    fontSize: 10, fontWeight: 700, letterSpacing: ".08em",
                    textTransform: "uppercase", color: meta.cor,
                  }}>
                    <Icon size={11} />
                    {meta.label}
                  </div>
                  <div className="acoes" style={{ display: "flex", gap: 4 }}>
                    <IconBtn onClick={() => togglePin(n)} title={n.pinned ? "Desafixar" : "Fixar no topo"}>
                      {n.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                    </IconBtn>
                    <IconBtn onClick={() => editarNota(n)} title="Editar">
                      <Edit3 size={13} />
                    </IconBtn>
                    <IconBtn onClick={() => excluir(n)} title="Excluir" danger>
                      <Trash2 size={13} />
                    </IconBtn>
                  </div>
                </div>

                <h3 style={{
                  fontFamily: T.serif, fontSize: 18, fontWeight: 600,
                  color: T.ink, lineHeight: 1.25, margin: 0,
                  cursor: "pointer",
                }} onClick={() => editarNota(n)}>
                  {n.titulo}
                </h3>

                {n.conteudo && (
                  <p style={{
                    fontSize: 12.5, color: T.muted, lineHeight: 1.55,
                    margin: 0, whiteSpace: "pre-wrap",
                    display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical",
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
                        fontSize: 10, padding: "2px 8px", borderRadius: 100,
                        background: corPostIt(meta.cor, "1a"),
                        color: meta.cor, fontWeight: 600,
                        display: "inline-flex", alignItems: "center", gap: 3,
                      }}>
                        <TagIcon size={9} />{t}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{
                  fontSize: 10, color: T.faint, letterSpacing: ".05em",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  marginTop: 4, paddingTop: 6, borderTop: `1px dashed ${corPostIt(meta.cor, "22")}`,
                }}>
                  <span>
                    {n.updatedAt && n.updatedAt !== n.createdAt ? "editado " : ""}
                    {dataRelativa(n.updatedAt || n.createdAt)}
                  </span>
                  {n.conteudo && (
                    <span title="Caracteres">
                      {n.conteudo.length} chars
                    </span>
                  )}
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
              style={{ resize: "vertical", minHeight: 160, fontFamily: "inherit", lineHeight: 1.6 }}
            />
          </Field>

          <label style={{
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 12, color: T.muted, marginBottom: 16, cursor: "pointer",
          }}>
            <input type="checkbox"
              checked={!!form.pinned}
              onChange={e => setForm({ ...form, pinned: e.target.checked })}
              style={{ accentColor: T.gold, width: 14, height: 14 }} />
            <Pin size={12} style={{ color: T.gold }} />
            Fixar esta nota no topo
          </label>

          <div className="flex gap-3 mt-2">
            <button className="btn-gold" onClick={salvar}>Salvar</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============ subcomponentes ============ */

function IconBtn({ onClick, title, children, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        background: "transparent",
        border: `1px solid ${T.border}`,
        color: danger ? T.red : T.muted,
        width: 26, height: 26, borderRadius: 5,
        cursor: "pointer",
        display: "grid", placeItems: "center",
        transition: "all .15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? `${T.red}15` : T.bgSoft;
        e.currentTarget.style.borderColor = danger ? T.red : T.gold;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.borderColor = T.border;
      }}
    >
      {children}
    </button>
  );
}

function EmptyState({ temNotas, onCriar }) {
  return (
    <div style={{
      textAlign: "center", padding: "64px 24px",
      background: T.card, border: `1px dashed ${T.border}`, borderRadius: 12,
    }}>
      <div style={{
        width: 60, height: 60, margin: "0 auto 16px",
        borderRadius: 14, background: `${T.gold}15`,
        display: "grid", placeItems: "center",
        color: T.gold,
      }}>
        <StickyNote size={28} />
      </div>
      <h3 style={{
        fontFamily: T.serif, fontSize: 22, color: T.ink,
        margin: "0 0 8px", fontWeight: 600,
      }}>
        {temNotas ? "Nada por aqui" : "Comece a anotar"}
      </h3>
      <p style={{ color: T.muted, fontSize: 13, margin: "0 0 20px", maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
        {temNotas
          ? "Nenhuma nota corresponde à busca ou ao filtro selecionado."
          : "Use as Notas pra capturar ideias de investimento, planos de viagem, lembretes do trabalho ou qualquer coisa que precise lembrar depois."}
      </p>
      {!temNotas && (
        <button className="btn-gold" onClick={onCriar}>
          <Plus size={14} className="inline mr-2" />
          Criar primeira nota
        </button>
      )}
    </div>
  );
}
