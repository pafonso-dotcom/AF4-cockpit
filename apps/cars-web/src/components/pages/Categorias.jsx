import React, { useState, useMemo } from "react";
import { Plus, Trash2, Edit3, Zap, Package, Check } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, fmtN, uid } from "../../lib/format.js";
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
  // Mês de referência do orçamento (YYYY-MM). Orçamento é MENSAL.
  const [mesOrc, setMesOrc] = useState(() => new Date().toISOString().slice(0, 7));

  // Agregação de transações por ID de categoria (evita somar em dobro
  // quando pai e filha partilham o mesmo nome).
  const stats = useMemo(() => {
    const m = {};
    const idPorNome = {};
    categorias.forEach(c => { idPorNome[c.nome] = c.id; });
    transacoes.forEach(t => {
      const id = idPorNome[t.categoria];
      if (id == null) return;
      m[id] = (m[id] || 0) + Number(t.valor || 0);
    });
    return m;
  }, [transacoes, categorias]);

  // Gasto do MÊS de referência por categoria — base correta pro orçamento mensal.
  const gastoMes = useMemo(() => {
    const m = {};
    const idPorNome = {};
    categorias.forEach(c => { idPorNome[c.nome] = c.id; });
    transacoes.forEach(t => {
      if (t.tipo !== "despesa") return;
      if (!(t.data || "").startsWith(mesOrc)) return;
      const id = idPorNome[t.categoria];
      if (id == null) return;
      m[id] = (m[id] || 0) + Number(t.valor || 0);
    });
    return m;
  }, [transacoes, categorias, mesOrc]);

  const mesOrcLabel = (() => {
    const [y, mm] = mesOrc.split("-").map(Number);
    const nomes = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    return `${nomes[mm - 1]} ${y}`;
  })();
  const passoMes = (delta) => {
    const [y, mm] = mesOrc.split("-").map(Number);
    const d = new Date(y, mm - 1 + delta, 1);
    setMesOrc(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

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
  const despesasComLimite = despesas.filter(c => c.limite > 0);

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Capítulo VI"
        title="Categorias"
        sub="A taxonomia do dinheiro. Defina limites e acompanhe o orçamento."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <button className="btn-ghost" onClick={() => { setSelecionadas({}); setPacoteAberto("list"); }}>
              <Package size={14} className="inline mr-2" />📦 Importar pacote
            </button>
            <button className="btn-gold" onClick={() => setForm({ id: null, nome: "", tipo: "despesa", escopo: escopoAtivo === "negocio" ? "negocio" : "pessoal", cor: T.gold, limite: null })}>
              <Plus size={14} className="inline mr-2" />Nova Categoria
            </button>
          </div>
        }
      />

      {/* Limites de orçamento — visual cards (MENSAL) */}
      {despesasComLimite.length > 0 && (
        <section className="mb-4">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="ornament" style={{ margin: 0 }}>
              <span style={{ fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", fontStyle: "normal" }}>
                Orçamento do mês
              </span>
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => passoMes(-1)} style={{ padding: "4px 8px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 5, cursor: "pointer", color: T.muted }}>‹</button>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.ink, minWidth: 78, textAlign: "center", textTransform: "capitalize" }}>{mesOrcLabel}</span>
              <button onClick={() => passoMes(1)} style={{ padding: "4px 8px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 5, cursor: "pointer", color: T.muted }}>›</button>
            </div>
          </div>
          {(() => {
            const totalLimite = despesasComLimite.reduce((s, c) => s + (Number(c.limite) || 0), 0);
            const totalGasto = despesasComLimite.reduce((s, c) => s + (gastoMes[c.id] || 0), 0);
            const pctTotal = totalLimite > 0 ? Math.min(100, (totalGasto / totalLimite) * 100) : 0;
            const corTot = pctTotal >= 100 ? T.red : pctTotal >= 80 ? T.gold : T.green;
            return (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
                <div className="flex justify-between text-xs mb-1" style={{ color: T.muted }}>
                  <span>Total orçado · {mesOrcLabel}</span>
                  <span className="num">{hidden ? "•••" : `${fmt(totalGasto)} de ${fmt(totalLimite)}`}</span>
                </div>
                <div style={{ background: T.border, height: 6, borderRadius: 1 }}>
                  <div style={{ width: `${pctTotal}%`, background: corTot, height: "100%", transition: "width .6s" }} />
                </div>
              </div>
            );
          })()}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {despesasComLimite.map(c => {
              const gasto = gastoMes[c.id] || 0;
              const saldo = c.limite - gasto;
              const pct = Math.min(100, (gasto / c.limite) * 100);
              const estado = pct >= 100 ? "estourado" : pct >= 80 ? "alerta" : "ok";
              const corEstado = estado === "estourado" ? T.red : estado === "alerta" ? T.gold : T.green;
              return (
                <div key={c.id} style={{ background: T.card, border: `1px solid ${T.border}`, padding: 11, position: "relative", overflow: "hidden", borderRadius: 12 }}>
                  <div style={{ position: "absolute", top: 0, left: 0, height: 3, width: `${pct}%`, background: c.cor, transition: "width 0.6s" }} />
                  <div className="flex items-start justify-between mb-1.5 mt-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div style={{ width: 9, height: 9, background: c.cor, borderRadius: 2, flexShrink: 0 }} />
                      <h3 style={{ color: T.ink, fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }} className="truncate">
                        {c.nome}
                      </h3>
                    </div>
                    {estado === "estourado" && (
                      <Zap size={14} style={{ color: T.red, flexShrink: 0 }} />
                    )}
                  </div>
                  <div className="space-y-1.5 mb-3">
                    <div className="flex justify-between text-xs">
                      <span style={{ color: T.muted }}>Limite/mês</span>
                      <span className="num" style={{ color: T.ink }}>{hidden ? "•••" : fmt(c.limite)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span style={{ color: T.muted }}>Gasto no mês</span>
                      <span className="num" style={{ color: T.ink }}>{hidden ? "•••" : fmt(gasto)}</span>
                    </div>
                    <div className="flex justify-between text-sm pt-1.5" style={{ borderTop: `1px solid ${T.border}` }}>
                      <span style={{ color: T.muted, fontWeight: 500 }}>Saldo</span>
                      <span className="num" style={{ color: corEstado, fontWeight: 600 }}>
                        {hidden ? "•••" : fmt(saldo)}
                      </span>
                    </div>
                  </div>
                  <div style={{ background: T.border, height: 6, borderRadius: 1 }}>
                    <div style={{
                      width: `${pct}%`, background: corEstado, height: "100%",
                      transition: "width 0.6s", boxShadow: estado === "estourado" ? `0 0 8px ${T.red}` : "none",
                    }} />
                  </div>
                  <div className="num text-xs text-right mt-1" style={{ color: corEstado }}>
                    {fmtN(pct, 1)}% usado
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Toggle Receitas | Despesas */}
      <div style={{
        display: "inline-flex", gap: 0, marginBottom: 12,
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

      {vista === "receita" ? (
        <CategoriaCol titulo="Receitas" cats={receitas} stats={stats} setForm={setForm} setCategorias={setCategorias} categorias={categorias} accent={T.green} hidden={hidden} transacoes={transacoes} />
      ) : (
        <CategoriaCol titulo="Despesas" cats={despesas} stats={stats} setForm={setForm} setCategorias={setCategorias} categorias={categorias} accent={T.red} hidden={hidden} transacoes={transacoes} />
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
            <Field label="Limite mensal de gastos (opcional)">
              <input type="number" step="0.01" value={form.limite || ""}
                     placeholder="Ex.: 800,00 — deixe em branco para sem limite"
                     onChange={e => setForm({ ...form, limite: e.target.value ? parseFloat(e.target.value) : null })} />
            </Field>
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

function CategoriaCol({ titulo, cats, stats, setForm, setCategorias, categorias, accent, hidden, transacoes }) {
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

  // Total inclui valor próprio + filhas
  const valorComFilhas = (c) => {
    const propria = stats[c.id] || 0;
    const filhas = (filhasPorPai[c.id] || []).reduce((s, f) => s + (stats[f.id] || 0), 0);
    return propria + filhas;
  };

  const total = raizes.reduce((s, c) => s + valorComFilhas(c), 0);

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14, borderRadius: 14 }}>
      <div className="flex items-baseline justify-between mb-2">
        <h3 style={{ fontFamily: T.serif, fontSize: 16, color: T.ink, fontWeight: 600 }}>{titulo}</h3>
        <div className="num text-sm" style={{ color: accent }}>{hidden ? "•••" : fmt(total)}</div>
      </div>
      <div className="space-y-1">
        {raizes.map(c => (
          <CategoriaItem
            key={c.id}
            c={c}
            total={total}
            valor={valorComFilhas(c)}
            valorProprio={stats[c.id] || 0}
            filhas={filhasPorPai[c.id] || []}
            stats={stats}
            categorias={categorias}
            setCategorias={setCategorias}
            setForm={setForm}
            hidden={hidden}
            transacoes={transacoes}
          />
        ))}
      </div>
    </div>
  );
}

function CategoriaItem({ c, total, valor, valorProprio, filhas = [], stats = {}, categorias, setCategorias, setForm, hidden, transacoes }) {
  const [open, setOpen] = useState(false);
  const [openFilhas, setOpenFilhas] = useState(false); // filhas colapsadas por default
  const [novaSub, setNovaSub] = useState("");

  const subs = ordenarPorNome(c.subcategorias || []);
  const pct = total > 0 ? (valor / total) * 100 : 0;
  const limiteUsado = c.limite > 0 ? Math.min(100, (valor / c.limite) * 100) : null;
  const temFilhas = filhas.length > 0;
  const valorPropriaShown = valorProprio != null ? valorProprio : valor;

  // Calcula uso por sub
  const usoPorSub = useMemo(() => {
    const m = {};
    transacoes.forEach(t => {
      if (t.categoria !== c.nome) return;
      const s = t.subcategoria || "";
      if (!s) return;
      if (!m[s]) m[s] = { count: 0, soma: 0 };
      m[s].count++;
      m[s].soma += Number(t.valor || 0);
    });
    return m;
  }, [transacoes, c.nome]);

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
          {pct > 0 && (
            <div style={{ background: T.bgSoft, height: 3, marginTop: 4, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, background: c.cor, height: "100%", transition: "width .4s" }} />
            </div>
          )}
          {c.limite > 0 && (
            <div className="num" style={{ fontSize: 10, marginTop: 2, color: limiteUsado >= 100 ? T.red : limiteUsado >= 80 ? T.gold : T.muted }}>
              Limite {fmt(c.limite)} · {fmtN(limiteUsado, 0)}%
            </div>
          )}
        </div>
        <div className="num" style={{ color: T.ink, fontSize: 12.5, fontWeight: 600, fontFamily: T.serif }}>
          {hidden ? "•••" : fmt(valor)}
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
            subs.map(sub => {
              const u = usoPorSub[sub.nome] || { count: 0, soma: 0 };
              return (
                <div key={sub.id} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 0", borderBottom: `1px dashed ${T.border}`,
                }}>
                  <span style={{ flex: 1, color: T.ink }}>↳ {sub.nome}</span>
                  <span style={{ color: T.muted, fontSize: 11 }}>
                    {u.count > 0 ? `${u.count} · ${hidden ? "•••" : fmt(u.soma)}` : "—"}
                  </span>
                  <button onClick={() => removeSub(sub)}
                          aria-label={`Remover subcategoria ${sub.nome}`}
                          style={{ color: T.red, padding: 4, background: "transparent", border: "none", cursor: "pointer" }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              );
            })
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
          {/* Linha "(sem subcategoria)" só se a pai tem transações próprias E filhas */}
          {valorPropriaShown > 0 && (
            <div style={{
              padding: "8px 10px", fontSize: 11.5, color: T.muted,
              fontStyle: "italic", display: "flex", justifyContent: "space-between",
              borderBottom: `1px dashed ${T.border}`,
            }}>
              <span>↳ (sem subcategoria · direto na {c.nome})</span>
              <span className="num">{hidden ? "•••" : fmt(valorPropriaShown)}</span>
            </div>
          )}
          {filhas.map(f => {
            const valorF = stats[f.id] || 0;
            return (
              <div key={f.id} style={{
                padding: "8px 10px", display: "flex", alignItems: "center", gap: 8,
                borderBottom: `1px dashed ${T.border}`,
              }}>
                <div style={{ width: 8, height: 8, background: f.cor, borderRadius: 2, flexShrink: 0 }} />
                <span style={{ flex: 1, color: T.ink, fontSize: 12.5 }}>↳ {f.nome}</span>
                <span className="num text-xs" style={{ color: T.muted }}>
                  {hidden ? "•••" : fmt(valorF)}
                </span>
                <button onClick={() => setForm(f)}
                  aria-label={`Editar ${f.nome}`}
                  style={{ color: T.muted, background: "transparent", border: "none", cursor: "pointer", padding: 2 }}>
                  <Edit3 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

