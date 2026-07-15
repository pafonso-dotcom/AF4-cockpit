import React, { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Edit3, PieChart, Package, Check } from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import { PACOTES } from "../../lib/categoriasPacotes.js";
import { filtrarPorEscopo } from "../../lib/escopo.js";
import { ordenarPorNome } from "../../lib/categoriaSort.js";
import PageHeader from "../ui/PageHeader.jsx";
import Field from "../ui/Field.jsx";
import ColorPicker from "../ui/ColorPicker.jsx";
import Modal from "../ui/Modal.jsx";

export default function Categorias({ categorias, setCategorias, transacoes, hidden, escopoAtivo = "tudo" }) {
  const [form, setForm] = useState(null);
  const [pacoteAberto, setPacoteAberto] = useState(null); // null | "list" | pacoteId
  const [selecionadas, setSelecionadas] = useState({});   // { "<pacoteId>:<nome>": true }
  const [vista, setVista] = useState("despesa"); // "receita" | "despesa"
  // Expandir/recolher tudo: expandSig incrementa a cada clique; os itens reagem
  // no useEffect abrindo (expandTo=true) ou fechando (false) subs e filhas.
  const [expandSig, setExpandSig] = useState(0);
  const [expandTo, setExpandTo] = useState(false);
  const expandirTudo = (v) => { setExpandTo(v); setExpandSig(s => s + 1); };

  const [formErrors, setFormErrors] = useState({});

  const save = () => {
    const errs = {};
    if (!form.nome?.trim()) errs.nome = "Nome é obrigatório";
    else if (categorias.find(c => c.nome === form.nome && c.id !== form.id)) {
      errs.nome = "Já existe uma categoria com esse nome";
    }
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }

    if (form.id && categorias.find(c => c.id === form.id)) {
      setCategorias(categorias.map(c => c.id === form.id ? form : c));
      toast.success("Categoria atualizada.");
    } else {
      setCategorias([...categorias, { ...form, id: uid() }]);
      toast.success(`Categoria "${form.nome}" criada.`);
    }
    setForm(null);
    setFormErrors({});
  };

  const categoriasNoEscopo = filtrarPorEscopo(categorias || [], escopoAtivo);
  const receitas = categoriasNoEscopo.filter(c => c.tipo === "receita");
  const despesas = categoriasNoEscopo.filter(c => c.tipo === "despesa");

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Capítulo VI"
        title="Categorias"
        sub="A taxonomia do dinheiro. Cadastro de categorias, pais e subcategorias."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn-ghost" onClick={() => { setSelecionadas({}); setPacoteAberto("list"); }}>
              <Package size={14} className="inline mr-2" />📦 Importar pacote
            </button>
            <button className="btn-gold" onClick={() => setForm({ id: null, nome: "", tipo: vista, escopo: escopoAtivo === "negocio" ? "negocio" : "pessoal", cor: T.gold, limite: null })}>
              <Plus size={14} className="inline mr-2" />Nova Categoria
            </button>
          </div>
        }
      />

      {/* Aviso: valores e orçamento agora vivem na Análise de gastos */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
        padding: "8px 12px", background: T.bgSoft, border: `1px solid ${T.border}`,
        borderRadius: 10, color: T.muted, fontSize: 11.5,
      }}>
        <PieChart size={13} style={{ color: T.gold, flexShrink: 0 }} />
        <span>Esta tela é só para <b style={{ color: T.ink }}>cadastro</b> das categorias. Valores gastos e orçamento (limites) ficam no <b style={{ color: T.ink }}>Centro de controle → Análise de gastos</b>.</span>
      </div>

      {/* Toggle Receitas | Despesas + Expandir/Recolher tudo */}
      <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: 12 }}>
        <div style={{
          display: "inline-flex", gap: 0,
          background: T.bgSoft, padding: 3, borderRadius: 14, border: `1px solid ${T.border}`,
        }}>
          {[
            { id: "receita", label: `Receitas (${receitas.length})`, cor: T.green },
            { id: "despesa", label: `Despesas (${despesas.length})`, cor: T.red },
          ].map(t => {
            const ativo = vista === t.id;
            return (
              <button key={t.id} onClick={() => setVista(t.id)}
                style={{
                  padding: "6px 14px", fontSize: 11.5, fontWeight: ativo ? 700 : 500,
                  background: ativo ? T.card : "transparent",
                  color: ativo ? t.cor : T.muted,
                  border: ativo ? `1px solid ${t.cor}55` : `1px solid transparent`,
                  borderRadius: 11, cursor: "pointer",
                }}>
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="inline-flex gap-2">
          <button className="btn-ghost" style={{ padding: "5px 12px", fontSize: 11 }}
            onClick={() => expandirTudo(true)} title="Abrir todas as categorias-pai, filhas e subcategorias">
            ▾ Expandir tudo
          </button>
          <button className="btn-ghost" style={{ padding: "5px 12px", fontSize: 11 }}
            onClick={() => expandirTudo(false)} title="Recolher todas">
            ▸ Recolher tudo
          </button>
        </div>
      </div>

      {vista === "receita" ? (
        <CategoriaCol titulo="Receitas" cats={receitas} setForm={setForm} setCategorias={setCategorias} categorias={categorias} accent={T.green} hidden={hidden} transacoes={transacoes} expandSig={expandSig} expandTo={expandTo} />
      ) : (
        <CategoriaCol titulo="Despesas" cats={despesas} setForm={setForm} setCategorias={setCategorias} categorias={categorias} accent={T.red} hidden={hidden} transacoes={transacoes} expandSig={expandSig} expandTo={expandTo} />
      )}

      {form && (
        <Modal title={form.id ? "Editar Categoria" : "Nova Categoria"} onClose={() => setForm(null)}>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {["receita", "despesa"].map(t => (
              <button key={t} onClick={() => setForm({ ...form, tipo: t })}
                style={{
                  padding: "12px", border: `1px solid ${form.tipo === t ? (t === "receita" ? T.green : T.red) : T.border}`,
                  background: form.tipo === t ? (t === "receita" ? `${T.green}22` : `${T.red}22`) : "transparent",
                  color: form.tipo === t ? (t === "receita" ? T.green : T.red) : T.muted,
                  fontFamily: T.sans, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase",
                }}>
                {t === "receita" ? "Receita" : "Despesa"}
              </button>
            ))}
          </div>
          <Field label="Nome" required error={formErrors.nome}>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          </Field>
          <Field label="Categoria-pai (opcional)" hint="Se selecionar, esta categoria vira filha (subcategoria) — apenas 2 níveis de hierarquia">
            <select value={form.parentId || ""}
                    onChange={e => setForm({ ...form, parentId: e.target.value || null })}>
              <option value="">— Nenhuma (categoria raiz) —</option>
              {categorias
                .filter(c => c.tipo === form.tipo && !c.parentId && c.id !== form.id)
                .map(c => (<option key={c.id} value={c.id}>{c.nome}</option>))}
            </select>
          </Field>
          <Field label="Escopo" hint="Pessoal ou Negócio — separação financeira">
            <select value={form.escopo || "pessoal"} onChange={e => setForm({ ...form, escopo: e.target.value })}>
              <option value="pessoal">👤 Pessoal</option>
              <option value="negocio">🏢 Negócio</option>
            </select>
          </Field>
          <Field label="Cor">
            <ColorPicker value={form.cor} onChange={cor => setForm({ ...form, cor })} />
          </Field>
          {form.tipo === "despesa" && (
            <div style={{ fontSize: 11, color: T.faint, marginTop: -2, marginBottom: 4 }}>
              O limite mensal de gastos agora é definido na <b>Análise de gastos</b> (Centro de controle).
            </div>
          )}
          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={save}>Salvar</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}

      {pacoteAberto === "list" && (
        <Modal title="📦 Importar pacote de categorias" onClose={() => setPacoteAberto(null)}>
          <p style={{ color: T.muted, fontSize: 13, marginBottom: 16 }}>
            Pacotes prontos para começar rápido. Escolha um para ver as categorias incluídas.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PACOTES.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  const inicial = {};
                  p.categorias.forEach(c => {
                    const dupe = categorias.some(x => x.nome.toLowerCase() === c.nome.toLowerCase());
                    if (!dupe) inicial[`${p.id}:${c.nome}`] = true;
                  });
                  setSelecionadas(inicial);
                  setPacoteAberto(p.id);
                }}
                style={{
                  textAlign: "left",
                  background: T.bgSoft,
                  border: `1px solid ${T.border}`,
                  borderRadius: 16,
                  padding: 14,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}
              >
                <div style={{ fontSize: 28, marginBottom: 4 }}>{p.icone}</div>
                <div style={{ color: T.ink, fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{p.nome}</div>
                <div style={{ color: T.muted, fontSize: 11.5, lineHeight: 1.4, marginBottom: 8 }}>{p.descricao}</div>
                <div style={{ color: T.gold, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>
                  {p.categorias.length} categorias
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {pacoteAberto && pacoteAberto !== "list" && (() => {
        const pacote = PACOTES.find(p => p.id === pacoteAberto);
        if (!pacote) return null;

        const totalSel = pacote.categorias.filter(c => selecionadas[`${pacote.id}:${c.nome}`]).length;

        const importar = () => {
          const novas = [];
          pacote.categorias.forEach(c => {
            if (!selecionadas[`${pacote.id}:${c.nome}`]) return;
            if (categorias.some(x => x.nome.toLowerCase() === c.nome.toLowerCase())) return;
            novas.push({ ...c, id: uid() });
          });
          if (novas.length === 0) {
            toast.error("Nenhuma categoria selecionada (ou todas já existem).");
            return;
          }
          setCategorias([...categorias, ...novas]);
          toast.success(`${novas.length} categoria${novas.length > 1 ? "s" : ""} importada${novas.length > 1 ? "s" : ""} do pacote "${pacote.nome}".`);
          setPacoteAberto(null);
          setSelecionadas({});
        };

        const toggleTodos = () => {
          const todas = pacote.categorias.every(c =>
            selecionadas[`${pacote.id}:${c.nome}`] ||
            categorias.some(x => x.nome.toLowerCase() === c.nome.toLowerCase())
          );
          const novo = {};
          if (!todas) {
            pacote.categorias.forEach(c => {
              const dupe = categorias.some(x => x.nome.toLowerCase() === c.nome.toLowerCase());
              if (!dupe) novo[`${pacote.id}:${c.nome}`] = true;
            });
          }
          setSelecionadas(novo);
        };

        return (
          <Modal title={`${pacote.icone} ${pacote.nome}`} onClose={() => setPacoteAberto("list")}>
            <div style={{ color: T.muted, fontSize: 12.5, marginBottom: 12 }}>{pacote.descricao}</div>

            <div className="flex items-center justify-between mb-2" style={{ paddingBottom: 8, borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 11.5, color: T.muted }}>
                {totalSel} de {pacote.categorias.length} selecionada{totalSel === 1 ? "" : "s"}
              </span>
              <button onClick={toggleTodos} className="btn-ghost" style={{ padding: "4px 10px", fontSize: 10 }}>
                Selecionar todas
              </button>
            </div>

            <div style={{ maxHeight: 360, overflowY: "auto", paddingRight: 4 }}>
              {pacote.categorias.map(c => {
                const key = `${pacote.id}:${c.nome}`;
                const dupe = categorias.some(x => x.nome.toLowerCase() === c.nome.toLowerCase());
                const checked = !!selecionadas[key];
                return (
                  <label
                    key={c.nome}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 4px",
                      borderBottom: `1px dashed ${T.border}`,
                      cursor: dupe ? "not-allowed" : "pointer",
                      opacity: dupe ? 0.45 : 1,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={dupe}
                      onChange={() => setSelecionadas(s => ({ ...s, [key]: !s[key] }))}
                      style={{ accentColor: T.gold }}
                    />
                    <div style={{ width: 10, height: 10, background: c.cor, borderRadius: 2 }} />
                    <span style={{ flex: 1, color: T.ink, fontSize: 13 }}>{c.nome}</span>
                    <span style={{
                      fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
                      color: c.tipo === "receita" ? T.green : T.red,
                    }}>
                      {c.tipo}
                    </span>
                    {dupe && (
                      <span style={{ fontSize: 10, color: T.muted, fontStyle: "italic" }}>já existe</span>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="flex gap-3 mt-5">
              <button className="btn-gold" onClick={importar} disabled={totalSel === 0}>
                <Check size={14} className="inline mr-2" />
                Importar {totalSel > 0 ? `(${totalSel})` : ""}
              </button>
              <button className="btn-ghost" onClick={() => setPacoteAberto("list")}>Voltar</button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

function CategoriaCol({ titulo, cats, stats, setForm, setCategorias, categorias, accent, hidden, transacoes, expandSig, expandTo }) {
  // Apenas categorias-raiz neste nível; filhas aparecem indentadas via CategoriaItem
  // (ambas em ordem alfabética)
  const raizes = ordenarPorNome(cats.filter(c => !c.parentId));
  const filhasPorPai = useMemo(() => {
    const map = {};
    cats.forEach(c => {
      if (c.parentId) {
        if (!map[c.parentId]) map[c.parentId] = [];
        map[c.parentId].push(c);
      }
    });
    Object.keys(map).forEach(k => { map[k] = ordenarPorNome(map[k]); });
    return map;
  }, [cats]);

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14, borderRadius: 14 }}>
      <div className="flex items-baseline justify-between mb-2">
        <h3 style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, fontWeight: 600 }}>{titulo}</h3>
        <span style={{ fontSize: 11, color: T.faint }}>{raizes.length} {raizes.length === 1 ? "categoria" : "categorias"}</span>
      </div>
      <div className="space-y-1">
        {raizes.map(c => (
          <CategoriaItem
            key={c.id}
            c={c}
            filhas={filhasPorPai[c.id] || []}
            categorias={categorias}
            setCategorias={setCategorias}
            setForm={setForm}
            transacoes={transacoes}
            expandSig={expandSig}
            expandTo={expandTo}
          />
        ))}
      </div>
    </div>
  );
}

function CategoriaItem({ c, filhas = [], categorias, setCategorias, setForm, transacoes, expandSig = 0, expandTo = false }) {
  const [open, setOpen] = useState(false);
  const [openFilhas, setOpenFilhas] = useState(false); // filhas colapsadas por default
  const [novaSub, setNovaSub] = useState("");

  const subs = ordenarPorNome(c.subcategorias || []);
  const temFilhas = filhas.length > 0;

  // Expandir/recolher tudo (vem do topo da página): abre/fecha subs e filhas.
  useEffect(() => {
    if (expandSig === 0) return; // estado inicial: mantém colapsado
    setOpen(expandTo && subs.length > 0);
    setOpenFilhas(expandTo && temFilhas);
  }, [expandSig]); // eslint-disable-line react-hooks/exhaustive-deps

  const addSub = () => {
    const nm = novaSub.trim();
    if (!nm) return;
    if (subs.some(s => s.nome === nm)) {
      toast.error(`Subcategoria "${nm}" já existe.`);
      return;
    }
    const novaCat = { ...c, subcategorias: [...subs, { id: uid(), nome: nm }] };
    setCategorias(categorias.map(x => x.id === c.id ? novaCat : x));
    setNovaSub("");
    toast.success(`Subcategoria "${nm}" adicionada a ${c.nome}.`);
  };

  const removeSub = async (sub) => {
    const ok = await confirm({
      title: `Remover "${sub.nome}"?`,
      body: "As transações que usam essa subcategoria ficarão sem ela mas continuam existindo.",
      danger: true, confirmLabel: "Remover",
    });
    if (!ok) return;
    const novaCat = { ...c, subcategorias: subs.filter(s => s.id !== sub.id) };
    setCategorias(categorias.map(x => x.id === c.id ? novaCat : x));
    toast.success(`Subcategoria "${sub.nome}" removida.`);
  };

  // Exclui uma categoria (pai ou filha). Transações que a usam ficam sem
  // categoria (não são apagadas); filhas de um pai excluído viram raiz.
  const excluirCat = async (cat) => {
    const suasFilhas = categorias.filter(x => x.parentId === cat.id);
    const nUso = transacoes.filter(t => t.categoria === cat.nome).length;
    const partes = [];
    if (nUso > 0) partes.push(`${nUso} transaç${nUso === 1 ? "ão" : "ões"} que usa${nUso === 1 ? "" : "m"} essa categoria fica${nUso === 1 ? "" : "m"} sem categoria (não são apagadas).`);
    if (suasFilhas.length > 0) partes.push(`As ${suasFilhas.length} subcategoria${suasFilhas.length === 1 ? "" : "s"} (${suasFilhas.map(f => f.nome).join(", ")}) viram categorias-raiz.`);
    partes.push("Essa ação não pode ser desfeita.");
    const ok = await confirm({
      title: `Excluir "${cat.nome}"?`,
      body: partes.join(" "),
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    setCategorias(categorias
      .filter(x => x.id !== cat.id)
      .map(x => x.parentId === cat.id ? { ...x, parentId: null } : x));
    toast.success(`Categoria "${cat.nome}" excluída.`);
  };

  return (
    <div className="group" style={{ borderBottom: `1px solid ${T.border}` }}>
      <div className="flex items-center gap-2.5" style={{ padding: "7px 0", cursor: subs.length > 0 ? "pointer" : "default" }}
           onClick={() => { if (subs.length > 0) setOpen(!open); }}>
        <div style={{ width: 18, height: 18, background: c.cor, borderRadius: 4, flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <div style={{ color: T.ink, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {c.nome}
            {subs.length > 0 && (
              <span style={{ fontSize: 9.5, color: T.muted, marginLeft: 2 }}>
                {open ? "▾" : "▸"} {subs.length} sub
              </span>
            )}
            {temFilhas && (
              <span onClick={e => { e.stopPropagation(); setOpenFilhas(v => !v); }}
                style={{
                  fontSize: 9, color: T.gold, marginLeft: 2, cursor: "pointer", fontWeight: 700,
                  padding: "1px 6px", borderRadius: 3, background: `${T.gold}18`,
                  letterSpacing: ".03em",
                }}>
                {openFilhas ? "▾" : "▸"} {filhas.length} {filhas.length === 1 ? "filha" : "filhas"}
              </span>
            )}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); setOpen(!open); }}
                aria-label="Expandir subcategorias"
                title="Subcategorias"
                style={{ color: T.muted, padding: 4, background: "transparent", border: "none", cursor: "pointer", fontSize: 12 }}>
          {open ? "▾" : "+"}
        </button>
        <button onClick={e => { e.stopPropagation(); setForm(c); }}
                aria-label={`Editar categoria ${c.nome}`}
                style={{ color: T.muted, padding: 4, background: "transparent", border: "none", cursor: "pointer" }}>
          <Edit3 size={12} />
        </button>
        <button onClick={e => { e.stopPropagation(); excluirCat(c); }}
                aria-label={`Excluir categoria ${c.nome}`}
                title="Excluir categoria"
                style={{ color: T.muted, padding: 4, background: "transparent", border: "none", cursor: "pointer" }}>
          <Trash2 size={12} />
        </button>
      </div>

      {open && (
        <div style={{
          padding: "10px 0 14px 24px",
          marginLeft: 6,
          borderLeft: `2px dashed ${T.border}`,
          fontSize: 12.5,
        }} onClick={e => e.stopPropagation()}>
          {subs.length === 0 ? (
            <div style={{ color: T.muted, fontSize: 11.5, fontStyle: "italic", marginBottom: 8 }}>
              Nenhuma subcategoria ainda. Adicione abaixo.
            </div>
          ) : (
            subs.map(sub => (
              <div key={sub.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 0", borderBottom: `1px dashed ${T.border}`,
              }}>
                <span style={{ flex: 1, color: T.ink }}>↳ {sub.nome}</span>
                <button onClick={() => removeSub(sub)}
                        aria-label={`Remover subcategoria ${sub.nome}`}
                        style={{ color: T.red, padding: 4, background: "transparent", border: "none", cursor: "pointer" }}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${T.border}` }}>
            <input
              value={novaSub}
              onChange={e => setNovaSub(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addSub(); }}
              placeholder="+ Nova subcategoria"
              style={{
                flex: 1, padding: "6px 10px", fontSize: 12,
                background: T.bgSoft, border: `1px solid ${T.border}`,
                borderRadius: 11, color: T.ink,
              }} />
            <button onClick={addSub} className="btn-gold" style={{ padding: "6px 12px", fontSize: 10 }}>
              Add
            </button>
          </div>
        </div>
      )}

      {/* Filhas (categorias com parentId apontando pra esta) — colapsáveis */}
      {temFilhas && openFilhas && (
        <div style={{
          paddingLeft: 32, marginTop: 4,
          background: `${T.bgSoft}66`, borderLeft: `2px solid ${T.gold}55`,
        }}>
          {filhas.map(f => {
            return (
              <div key={f.id} style={{
                padding: "8px 10px", display: "flex", alignItems: "center", gap: 8,
                borderBottom: `1px dashed ${T.border}`,
              }}>
                <div style={{ width: 8, height: 8, background: f.cor, borderRadius: 2, flexShrink: 0 }} />
                <span style={{ flex: 1, color: T.ink, fontSize: 12.5 }}>↳ {f.nome}</span>
                <button onClick={() => setForm(f)}
                  aria-label={`Editar ${f.nome}`}
                  style={{ color: T.muted, background: "transparent", border: "none", cursor: "pointer", padding: 2 }}>
                  <Edit3 size={11} />
                </button>
                <button onClick={() => excluirCat(f)}
                  aria-label={`Excluir ${f.nome}`}
                  title="Excluir subcategoria"
                  style={{ color: T.muted, background: "transparent", border: "none", cursor: "pointer", padding: 2 }}>
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

