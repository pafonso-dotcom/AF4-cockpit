import React, { useState } from "react";
import { Plus, Trash2, Edit3, Package } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { uid } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import Field from "../../ui/Field.jsx";
import Modal from "../../ui/Modal.jsx";

/**
 * Pacote pronto de categorias do Negócio (foco em revenda de veículos +
 * serviços), já organizado em PAI → FILHOS. Carregado pelo botão "Pacote":
 * cria os grupos (pais) e suas subcategorias (filhos), pulando o que já existe
 * (por nome). Subcategorias herdam o tipo do pai.
 */
const PACOTE_NEGOCIO = [
  // ----- Receitas -----
  { nome: "Vendas", tipo: "receita", cor: "#4ade80", filhos: [
    { nome: "Venda de veículo", cor: "#4ade80" },
    { nome: "Peças e acessórios", cor: "#22d3ee" },
  ] },
  { nome: "Serviços", tipo: "receita", cor: "#34d399", filhos: [
    { nome: "Mão de obra", cor: "#34d399" },
    { nome: "Comissão recebida", cor: "#60a5fa" },
  ] },
  { nome: "Outras receitas", tipo: "receita", cor: "#86efac", filhos: [
    { nome: "Financiamento / Repasse", cor: "#a78bfa" },
  ] },
  // ----- Despesas -----
  { nome: "Veículos", tipo: "despesa", cor: "#f87171", filhos: [
    { nome: "Compra de veículo", cor: "#f87171" },
    { nome: "Peças e materiais", cor: "#fb923c" },
    { nome: "Manutenção / Oficina", cor: "#fbbf24" },
    { nome: "Combustível", cor: "#facc15" },
    { nome: "Documentação / Despachante", cor: "#e879f9" },
  ] },
  { nome: "Operação", tipo: "despesa", cor: "#fb7185", filhos: [
    { nome: "Mão de obra / Terceiros", cor: "#f59e0b" },
    { nome: "Frete / Transporte", cor: "#fb7185" },
  ] },
  { nome: "Administrativo", tipo: "despesa", cor: "#ef4444", filhos: [
    { nome: "Aluguel", cor: "#f472b6" },
    { nome: "Contas (luz/água/net)", cor: "#fca5a5" },
    { nome: "Salários / Pró-labore", cor: "#ef4444" },
    { nome: "Impostos e taxas", cor: "#dc2626" },
    { nome: "Tarifas bancárias", cor: "#fdba74" },
  ] },
  { nome: "Vendas / Marketing", tipo: "despesa", cor: "#c084fc", filhos: [
    { nome: "Marketing / Anúncios", cor: "#c084fc" },
    { nome: "Comissão paga", cor: "#d8b4fe" },
  ] },
];

/**
 * NegocioCategorias — categorias do Negócio (dados próprios, independentes do
 * financeiro pessoal). Campos: { id, nome, tipo: "despesa"|"receita", cor }.
 */
export default function NegocioCategorias({ categorias = [], setCategorias }) {
  const [form, setForm] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [vista, setVista] = useState("despesa");

  const receitas = (categorias || []).filter(c => c.tipo === "receita");
  const despesas = (categorias || []).filter(c => c.tipo === "despesa");
  const lista = vista === "receita" ? receitas : despesas;

  const novo = () =>
    setForm({ id: null, nome: "", tipo: vista, cor: T.gold, paiId: null });

  // Carrega o pacote pronto (pai → filhos), pulando categorias já existentes
  // (por nome). Pais novos são criados; filhos novos são ligados ao pai (novo
  // ou já existente, casado por nome). Mostra quantas foram adicionadas.
  const adicionarPacote = async () => {
    const porNome = new Map((categorias || []).map(c => [(c.nome || "").trim().toLowerCase(), c]));
    const novas = [];
    for (const grupo of PACOTE_NEGOCIO) {
      const chavePai = grupo.nome.toLowerCase();
      let paiId;
      const existePai = porNome.get(chavePai);
      if (existePai) {
        paiId = existePai.id;
      } else {
        paiId = uid();
        const novoPai = { id: paiId, nome: grupo.nome, tipo: grupo.tipo, cor: grupo.cor, paiId: null };
        novas.push(novoPai);
        porNome.set(chavePai, novoPai);
      }
      for (const f of grupo.filhos || []) {
        const chaveF = f.nome.toLowerCase();
        if (porNome.has(chaveF)) continue;
        const novoFilho = { id: uid(), nome: f.nome, tipo: grupo.tipo, cor: f.cor || grupo.cor, paiId };
        novas.push(novoFilho);
        porNome.set(chaveF, novoFilho);
      }
    }
    if (novas.length === 0) {
      toast.info("Todas as categorias do pacote já existem.");
      return;
    }
    const ok = await confirm({
      title: "Adicionar pacote de categorias?",
      body: `Serão criadas ${novas.length} categoria(s) de Negócio, organizadas em grupos (pai) e subcategorias (filho). As que já existem serão mantidas.`,
      confirmLabel: "Adicionar",
    });
    if (!ok) return;
    const backup = categorias;
    setCategorias([...(categorias || []), ...novas]);
    toast.success(`${novas.length} categoria(s) adicionada(s).`, {
      action: { label: "Desfazer", onClick: () => setCategorias(backup) },
    });
  };

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

  const excluir = async (c) => {
    const filhos = (categorias || []).filter(x => x.paiId === c.id);
    const ok = await confirm({
      title: `Excluir "${c.nome}"?`,
      body: filhos.length > 0
        ? `Este grupo tem ${filhos.length} subcategoria(s). Elas NÃO serão excluídas — viram categorias principais.`
        : "A categoria do Negócio será removida.",
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    setCategorias(categorias
      .filter(x => x.id !== c.id)
      .map(x => x.paiId === c.id ? { ...x, paiId: null } : x));
    toast.success(`${c.nome} excluída.`);
  };

  // Agrupa a lista (do tipo selecionado) em pai → filhos. Categorias com paiId
  // "órfão" (pai inexistente neste tipo) entram como principais.
  const idsLista = new Set(lista.map(c => c.id));
  const principais = lista.filter(c => !c.paiId || !idsLista.has(c.paiId));
  const filhosDe = (id) => lista.filter(c => c.paiId === id);

  return (
    <div className="fade-up py-8">
      <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${T.border}`,
                    display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flexShrink: 0 }}>
          <div className="label-eyebrow">Negócio</div>
          <h2 style={{ fontFamily: T.serif, fontSize: 26, color: T.ink, marginTop: 4, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            Categorias
          </h2>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 4, fontStyle: "italic" }}>
            Categorias próprias do Negócio.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-ghost" style={{ padding: "7px 12px", fontSize: 11 }} onClick={adicionarPacote}
                  title="Adicionar um conjunto pronto de categorias de Negócio (pai/filho)">
            <Package size={13} className="inline mr-1.5" />Pacote
          </button>
          <button className="btn-gold" style={{ padding: "7px 12px", fontSize: 11 }} onClick={novo}>
            <Plus size={13} className="inline mr-1.5" />Nova Categoria
          </button>
        </div>
      </div>

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

      {lista.length === 0 ? (
        <div style={{ padding: 50, textAlign: "center", color: T.muted, fontStyle: "italic",
                      background: T.card, border: `1px dashed ${T.border}`, borderRadius: 16 }}>
          Nenhuma categoria de {vista} ainda. Comece com o botão <strong>Nova Categoria</strong>.
        </div>
      ) : (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14, borderRadius: 14 }}>
          <div className="space-y-1">
            {principais.map(c => {
              const filhos = filhosDe(c.id);
              return (
                <React.Fragment key={c.id}>
                  <CategoriaRow c={c} ehPai={filhos.length > 0} onEdit={() => setForm({ ...c })} onDel={() => excluir(c)} />
                  {filhos.map(f => (
                    <CategoriaRow key={f.id} c={f} filho onEdit={() => setForm({ ...f })} onDel={() => excluir(f)} />
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {form && (
        <Modal title={form.id ? "Editar Categoria" : "Nova Categoria"} onClose={() => setForm(null)}>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {["receita", "despesa"].map(t => (
              <button key={t} onClick={() => setForm({ ...form, tipo: t, paiId: null })}
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
          <Field label="Categoria pai (opcional)" hint="Deixe em branco para uma categoria principal.">
            <select value={form.paiId || ""} onChange={e => setForm({ ...form, paiId: e.target.value || null })}>
              <option value="">— Nenhuma (principal) —</option>
              {categorias
                .filter(c => c.tipo === form.tipo && !c.paiId && c.id !== form.id)
                .map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Cor">
            <input type="color" value={form.cor || T.gold}
                   onChange={e => setForm({ ...form, cor: e.target.value })}
                   style={{ width: 60, height: 36, border: `1px solid ${T.border}`, borderRadius: 8, background: "transparent", cursor: "pointer" }} />
          </Field>
          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={save}>Salvar</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Linha de categoria na lista. `filho` indenta e marca como subcategoria;
// `ehPai` mostra o selo "grupo".
function CategoriaRow({ c, ehPai, filho, onEdit, onDel }) {
  return (
    <div className="flex items-center gap-2.5" style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}`, paddingLeft: filho ? 22 : 0 }}>
      {filho && <span style={{ color: T.faint, fontSize: 12 }}>↳</span>}
      <div style={{ width: 14, height: 14, background: c.cor || T.gold, borderRadius: 4, flexShrink: 0 }} />
      <span style={{ flex: 1, color: T.ink, fontSize: 12.5, fontWeight: filho ? 500 : 600 }}>{c.nome}</span>
      {ehPai && (
        <span style={{ fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, background: T.bgSoft, padding: "1px 6px", borderRadius: 100 }}>
          grupo
        </span>
      )}
      <span style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: c.tipo === "receita" ? T.green : T.red }}>
        {c.tipo}
      </span>
      <button onClick={onEdit} aria-label={`Editar ${c.nome}`}
              style={{ color: T.muted, padding: 4, background: "transparent", border: "none", cursor: "pointer" }}>
        <Edit3 size={12} />
      </button>
      <button onClick={onDel} aria-label={`Excluir ${c.nome}`}
              style={{ color: T.red, padding: 4, background: "transparent", border: "none", cursor: "pointer" }}>
        <Trash2 size={12} />
      </button>
    </div>
  );
}
