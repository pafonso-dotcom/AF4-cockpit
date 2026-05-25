/**
 * ObjetivosCarteira · "Definir Objetivos" estilo IdV.
 *
 * Modelo livre: usuário monta a árvore como quiser.
 * Cada nó:
 *   - label, percent (% do PAI), parentId, classeMatch (acao/fii/etc — só leafs)
 *
 * Pré-seed com estrutura IdV (RF/RV → País → Classe) mas tudo editável.
 *
 * Comparação:
 *   - % atual da carteira em cada nó (via classeMatch dos descendentes)
 *   - falta R$ pra alcançar o alvo
 *   - barra de progresso
 *
 * Integração: botão "Sugerir aporte (IA)" abre o modal SugestaoAporte
 * já existente, passando o valor "falta R$" como sugestão inicial.
 */
import React, { useMemo, useState } from "react";
import {
  Plus, Trash2, Edit3, ChevronDown, ChevronRight, Sparkles,
  CheckCircle2, AlertCircle, Target, TrendingUp, Building2, Landmark,
} from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, fmtN, uid } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import PageHeader from "../../ui/PageHeader.jsx";
import Field from "../../ui/Field.jsx";
import Modal from "../../ui/Modal.jsx";
import SugestaoAporte from "./SugestaoAporte.jsx";

// Default tree (IdV-style) — usuário pode editar/remover/adicionar
const DEFAULT_TREE = [
  { id: "rf",          parentId: null,        label: "Renda Fixa",     percent: 20, classeMatch: ["cdb", "tesouro", "rf"] },
  { id: "rv",          parentId: null,        label: "Renda Variável", percent: 80, classeMatch: null },
  { id: "rv.brasil",   parentId: "rv",        label: "Brasil",         percent: 60, classeMatch: null },
  { id: "rv.eua",      parentId: "rv",        label: "EUA",            percent: 40, classeMatch: null },
  { id: "rv.br.acao",  parentId: "rv.brasil", label: "Ações",          percent: 30, classeMatch: ["acao"] },
  { id: "rv.br.fii",   parentId: "rv.brasil", label: "FIIs",           percent: 70, classeMatch: ["fii"] },
  { id: "rv.eua.stock",parentId: "rv.eua",    label: "Stocks",         percent: 70, classeMatch: ["stock", "etf"] },
  { id: "rv.eua.reit", parentId: "rv.eua",    label: "REITs",          percent: 30, classeMatch: ["reit"] },
];

const CLASSES_DISPONIVEIS = [
  { id: "acao",    label: "Ações BR" },
  { id: "fii",     label: "FIIs" },
  { id: "stock",   label: "Stocks (US)" },
  { id: "reit",    label: "REITs (US)" },
  { id: "etf",     label: "ETFs" },
  { id: "cdb",     label: "CDB" },
  { id: "tesouro", label: "Tesouro" },
  { id: "rf",      label: "Renda Fixa (genérica)" },
  { id: "cripto",  label: "Cripto" },
  { id: "outro",   label: "Outros" },
];

export default function ObjetivosCarteira({
  ativos = [],
  objetivosCarteira,
  setObjetivosCarteira,
  hidden,
  apiKeys = {},
}) {
  const tree = (objetivosCarteira && objetivosCarteira.length > 0) ? objetivosCarteira : DEFAULT_TREE;
  const [editando, setEditando] = useState(null); // node sendo editado
  const [sugestaoOpen, setSugestaoOpen] = useState(false);
  const [sugestaoBucket, setSugestaoBucket] = useState(null); // node escolhido para sugestão

  /* ===== Total da carteira ===== */
  const totalCarteira = useMemo(() =>
    (ativos || []).reduce((s, a) =>
      s + (Number(a.qtd || 0) * Number(a.preco || 0)), 0
    ), [ativos]);

  /* ===== Computa valor atual em R$ de cada nó (recursivo) ===== */
  const valorPorNo = useMemo(() => {
    const map = new Map();
    // Para cada folha: soma ativos cujo tipo bate com classeMatch
    const folhas = tree.filter(n => !tree.some(c => c.parentId === n.id));
    folhas.forEach(folha => {
      if (!folha.classeMatch || folha.classeMatch.length === 0) {
        map.set(folha.id, 0);
        return;
      }
      const v = (ativos || [])
        .filter(a => folha.classeMatch.includes(a.tipo))
        .reduce((s, a) => s + (Number(a.qtd || 0) * Number(a.preco || 0)), 0);
      map.set(folha.id, v);
    });
    // Para cada nó intermediário: soma dos filhos
    const calcular = (nodeId) => {
      if (map.has(nodeId)) return map.get(nodeId);
      const filhos = tree.filter(n => n.parentId === nodeId);
      const v = filhos.reduce((s, f) => s + calcular(f.id), 0);
      map.set(nodeId, v);
      return v;
    };
    tree.forEach(n => calcular(n.id));
    return map;
  }, [tree, ativos]);

  /* ===== Valor alvo de cada nó (cascateia % de cima pra baixo) ===== */
  const valorAlvo = useMemo(() => {
    const map = new Map();
    const calcular = (nodeId, valorDoPai) => {
      const node = tree.find(n => n.id === nodeId);
      if (!node) return;
      const valor = valorDoPai * (Number(node.percent || 0) / 100);
      map.set(nodeId, valor);
      tree.filter(n => n.parentId === nodeId).forEach(f => calcular(f.id, valor));
    };
    tree.filter(n => n.parentId === null).forEach(root => calcular(root.id, totalCarteira));
    return map;
  }, [tree, totalCarteira]);

  /* ===== Validação: filhos somam 100%? ===== */
  const validacoes = useMemo(() => {
    const problemas = [];
    // Raízes devem somar 100
    const raizes = tree.filter(n => n.parentId === null);
    const somaRaiz = raizes.reduce((s, n) => s + Number(n.percent || 0), 0);
    if (Math.abs(somaRaiz - 100) > 0.01 && raizes.length > 0) {
      problemas.push(`Raízes somam ${somaRaiz}% (precisa ser 100%)`);
    }
    // Cada pai com filhos: filhos somam 100
    tree.forEach(node => {
      const filhos = tree.filter(n => n.parentId === node.id);
      if (filhos.length > 0) {
        const soma = filhos.reduce((s, f) => s + Number(f.percent || 0), 0);
        if (Math.abs(soma - 100) > 0.01) {
          problemas.push(`Filhos de "${node.label}" somam ${soma}% (precisa ser 100%)`);
        }
      }
    });
    return problemas;
  }, [tree]);

  /* ===== Salvar / criar / excluir nó ===== */
  const salvarNo = (data) => {
    let novo;
    if (data.id && tree.find(n => n.id === data.id)) {
      novo = tree.map(n => n.id === data.id ? { ...n, ...data } : n);
    } else {
      novo = [...tree, { ...data, id: data.id || uid() }];
    }
    setObjetivosCarteira(novo);
    setEditando(null);
    toast.success("Salvo.");
  };

  const excluirNo = async (node) => {
    const filhos = tree.filter(n => n.parentId === node.id);
    if (filhos.length > 0) {
      toast.error("Remova os filhos antes de excluir este nó.");
      return;
    }
    const ok = await confirm({
      title: `Excluir "${node.label}"?`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    setObjetivosCarteira(tree.filter(n => n.id !== node.id));
    toast.success("Nó removido.");
  };

  const resetarPadrao = async () => {
    const ok = await confirm({
      title: "Restaurar árvore padrão IdV?",
      message: "Sua estrutura atual será substituída pela árvore padrão (RF/RV → País → Classe).",
      confirmLabel: "Restaurar",
      danger: true,
    });
    if (!ok) return;
    setObjetivosCarteira(DEFAULT_TREE);
    toast.success("Árvore restaurada.");
  };

  /* ===== Sugestão IA pra um bucket específico ===== */
  const abrirSugestao = (node) => {
    const atual = valorPorNo.get(node.id) || 0;
    const alvo = valorAlvo.get(node.id) || 0;
    const falta = Math.max(0, alvo - atual);
    if (falta <= 0) {
      toast.info(`"${node.label}" já está acima do alvo. Nada a aportar.`);
      return;
    }
    setSugestaoBucket({ node, valor: falta });
    setSugestaoOpen(true);
  };

  /* ===== Render ===== */
  const raizes = tree.filter(n => n.parentId === null);

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Investimentos"
        title="Objetivos"
        sub="Defina a alocação ideal da sua carteira e acompanhe quanto falta pra alcançar."
        action={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="btn-ghost" onClick={resetarPadrao}>
              Restaurar padrão
            </button>
            <button className="btn-gold" onClick={() => setEditando({
              id: null, parentId: null, label: "", percent: 0, classeMatch: null,
            })}>
              <Plus size={13} className="inline mr-1.5" /> Adicionar nó
            </button>
          </div>
        }
      />

      {/* Resumo da carteira */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
        padding: 14, marginBottom: 14,
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div className="label-eyebrow">Patrimônio total da carteira</div>
          <div className="num" style={{
            fontFamily: T.serif, fontSize: 26, color: T.ink, fontWeight: 600, marginTop: 4,
          }}>
            {hidden ? "•••" : fmt(totalCarteira)}
          </div>
        </div>
        <div style={{ fontSize: 11, color: T.muted, maxWidth: 320, lineHeight: 1.5 }}>
          Os % abaixo são <strong>cascateados</strong>: cada nó representa % do PAI.
          Folhas mapeiam classes de ativos (Ações, FIIs, CDB…).
        </div>
      </div>

      {/* Avisos de validação */}
      {validacoes.length > 0 && (
        <div style={{
          padding: 12, background: `${T.gold}11`,
          border: `1px solid ${T.gold}55`, borderLeft: `3px solid ${T.gold}`,
          borderRadius: 8, marginBottom: 14,
        }}>
          <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, marginBottom: 4, letterSpacing: ".05em", textTransform: "uppercase" }}>
            <AlertCircle size={12} className="inline mr-1" /> Atenção
          </div>
          {validacoes.map((p, i) => (
            <div key={i} style={{ fontSize: 12, color: T.ink, marginTop: 2 }}>• {p}</div>
          ))}
        </div>
      )}

      {/* Árvore */}
      {raizes.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 24px",
          background: T.card, border: `1px dashed ${T.border}`, borderRadius: 12,
        }}>
          <Target size={36} style={{ color: T.gold, marginBottom: 12 }} />
          <h3 style={{ fontFamily: T.serif, fontSize: 20, color: T.ink, margin: "0 0 8px", fontWeight: 600 }}>
            Sem objetivos definidos
          </h3>
          <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>
            Clique em "Restaurar padrão" pra começar com a árvore IdV ou "Adicionar nó".
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {raizes.map(raiz => (
            <NodeBlock
              key={raiz.id}
              node={raiz}
              tree={tree}
              valorPorNo={valorPorNo}
              valorAlvo={valorAlvo}
              hidden={hidden}
              onEditar={(n) => setEditando(n)}
              onExcluir={excluirNo}
              onAdicionarFilho={(parent) => setEditando({
                id: null, parentId: parent.id, label: "", percent: 0, classeMatch: null,
              })}
              onSugerir={abrirSugestao}
              nivel={0}
            />
          ))}
        </div>
      )}

      {/* Modal Editar/Adicionar nó */}
      {editando && (
        <EditNoModal
          node={editando}
          tree={tree}
          onSalvar={salvarNo}
          onClose={() => setEditando(null)}
        />
      )}

      {/* Modal Sugestão IA */}
      {sugestaoOpen && sugestaoBucket && (
        <SugestaoAporte
          open={sugestaoOpen}
          onClose={() => { setSugestaoOpen(false); setSugestaoBucket(null); }}
          ativosCarteira={ativos}
          apiKey={apiKeys.anthropic}
          valorInicial={Math.round(sugestaoBucket.valor)}
          contextoExtra={`Foco: alocar prioritariamente em **${sugestaoBucket.node.label}** (categoria abaixo do alvo na minha árvore de objetivos).`}
          onAplicarProjecao={() => { setSugestaoOpen(false); setSugestaoBucket(null); }}
        />
      )}
    </div>
  );
}

/* ============================================================
   NodeBlock — card recursivo de cada nó da árvore
   ============================================================ */
function NodeBlock({ node, tree, valorPorNo, valorAlvo, hidden, onEditar, onExcluir, onAdicionarFilho, onSugerir, nivel }) {
  const filhos = tree.filter(n => n.parentId === node.id);
  const atual = valorPorNo.get(node.id) || 0;
  const alvo = valorAlvo.get(node.id) || 0;
  const diff = atual - alvo;
  const pctAlvo = alvo > 0 ? Math.min(100, (atual / alvo) * 100) : 0;
  const noAlvo = Math.abs(diff) <= alvo * 0.03; // tolerância 3%
  const acima = diff > 0;
  const abaixo = diff < 0;

  const corStatus = noAlvo ? T.green : acima ? "#fbbf24" : T.red;
  const Icon = filhos.length === 0
    ? (node.classeMatch?.includes("fii") ? Building2
      : node.classeMatch?.includes("acao") || node.classeMatch?.includes("stock") ? TrendingUp
      : node.classeMatch?.includes("cdb") || node.classeMatch?.includes("tesouro") ? Landmark
      : Target)
    : Target;

  const indent = nivel * 16;

  return (
    <>
      <div style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderLeft: `4px solid ${corStatus}`,
        borderRadius: 10,
        padding: 14,
        marginLeft: indent,
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 12, alignItems: "center",
      }}>
        {/* Ícone */}
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: `${corStatus}22`, color: corStatus,
          display: "grid", placeItems: "center", flexShrink: 0,
        }}>
          <Icon size={18} />
        </div>

        {/* Conteúdo */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>
              {node.label}
            </span>
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 4,
              background: `${T.gold}22`, color: T.gold, fontWeight: 700,
            }}>
              {Number(node.percent).toFixed(1)}%
            </span>
            {node.classeMatch && node.classeMatch.length > 0 && (
              <span style={{ fontSize: 9.5, color: T.faint, letterSpacing: ".05em", textTransform: "uppercase" }}>
                {node.classeMatch.join(" · ")}
              </span>
            )}
          </div>

          {/* Linha de progresso */}
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 6, background: T.border, borderRadius: 999, overflow: "hidden" }}>
              <div style={{
                width: `${pctAlvo}%`, height: "100%",
                background: corStatus, transition: "width .4s",
              }} />
            </div>
            <div style={{
              fontSize: 11, color: T.muted, marginTop: 5,
              display: "flex", flexWrap: "wrap", gap: 14,
            }}>
              <span>
                Atual: <strong className="num" style={{ color: T.ink }}>
                  {hidden ? "•••" : fmt(atual)}
                </strong>
              </span>
              <span>
                Alvo: <strong className="num" style={{ color: T.gold }}>
                  {hidden ? "•••" : fmt(alvo)}
                </strong>
              </span>
              <span style={{ color: corStatus, fontWeight: 600 }}>
                {noAlvo ? (
                  <><CheckCircle2 size={11} className="inline mr-1" /> No alvo</>
                ) : abaixo ? (
                  <>Falta {hidden ? "•••" : fmt(-diff)}</>
                ) : (
                  <>Sobra {hidden ? "•••" : fmt(diff)}</>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
          {abaixo && filhos.length === 0 && (
            <button onClick={() => onSugerir(node)} title="Sugerir aporte com IA"
                    style={{
                      background: `${T.gold}22`, color: T.gold,
                      border: `1px solid ${T.gold}55`, padding: "5px 10px",
                      fontSize: 10.5, fontWeight: 600, borderRadius: 6,
                      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                      whiteSpace: "nowrap",
                    }}>
              <Sparkles size={11} /> IA aporte
            </button>
          )}
          <div style={{ display: "flex", gap: 2 }}>
            <button onClick={() => onAdicionarFilho(node)} title="Adicionar filho"
                    style={iconBtnStyle(T.muted)}>
              <Plus size={13} />
            </button>
            <button onClick={() => onEditar(node)} title="Editar"
                    style={iconBtnStyle(T.muted)}>
              <Edit3 size={12} />
            </button>
            <button onClick={() => onExcluir(node)} title="Excluir"
                    style={iconBtnStyle(T.red)}
                    disabled={filhos.length > 0}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Filhos */}
      {filhos.map(f => (
        <NodeBlock
          key={f.id}
          node={f}
          tree={tree}
          valorPorNo={valorPorNo}
          valorAlvo={valorAlvo}
          hidden={hidden}
          onEditar={onEditar}
          onExcluir={onExcluir}
          onAdicionarFilho={onAdicionarFilho}
          onSugerir={onSugerir}
          nivel={nivel + 1}
        />
      ))}
    </>
  );
}

const iconBtnStyle = (cor) => ({
  background: "transparent", border: "none", color: cor,
  cursor: "pointer", padding: 4, minHeight: 24,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
});

/* ============================================================
   EditNoModal — criar/editar nó da árvore
   ============================================================ */
function EditNoModal({ node, tree, onSalvar, onClose }) {
  const [form, setForm] = useState({
    id:           node.id || null,
    parentId:     node.parentId,
    label:        node.label || "",
    percent:      Number(node.percent) || 0,
    classeMatch:  node.classeMatch || [],
  });
  const [errors, setErrors] = useState({});

  const opcaoPais = [
    { id: null, label: "— Raiz (sem pai) —" },
    ...tree.filter(n => n.id !== form.id).map(n => ({
      id: n.id,
      label: caminhoNo(n, tree),
    })),
  ];

  const submit = () => {
    const errs = {};
    if (!form.label.trim()) errs.label = "Nome é obrigatório";
    const pct = Number(form.percent);
    if (isNaN(pct) || pct < 0 || pct > 100) errs.percent = "% deve ser entre 0 e 100";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onSalvar({
      ...form,
      label: form.label.trim(),
      percent: pct,
      classeMatch: (form.classeMatch && form.classeMatch.length > 0) ? form.classeMatch : null,
    });
  };

  const toggleClasse = (id) => {
    const cm = form.classeMatch || [];
    setForm({
      ...form,
      classeMatch: cm.includes(id) ? cm.filter(x => x !== id) : [...cm, id],
    });
  };

  return (
    <Modal title={form.id ? "Editar nó" : "Adicionar nó"} onClose={onClose}>
      <Field label="Nome" required error={errors.label}>
        <input value={form.label}
               onChange={e => setForm({ ...form, label: e.target.value })}
               placeholder="Ex.: Renda Fixa, Brasil, FIIs..."
               autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pai (hierarquia)">
          <select value={form.parentId || ""}
                  onChange={e => setForm({ ...form, parentId: e.target.value || null })}>
            {opcaoPais.map(o => (
              <option key={o.id || "__root"} value={o.id || ""}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="% do pai" required error={errors.percent}
               hint="Quanto este nó representa do PAI (ou do total se for raiz)">
          <input type="number" step="0.1" min="0" max="100"
                 value={form.percent}
                 onChange={e => setForm({ ...form, percent: e.target.value })} />
        </Field>
      </div>

      <Field label="Classes mapeadas (opcional — só pra folhas)"
             hint="Marque quais ativos da carteira este nó representa. Deixe vazio se for um nó intermediário.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
          {CLASSES_DISPONIVEIS.map(c => {
            const ativo = (form.classeMatch || []).includes(c.id);
            return (
              <button key={c.id} type="button" onClick={() => toggleClasse(c.id)}
                      style={{
                        padding: "5px 10px",
                        background: ativo ? `${T.gold}22` : T.bgSoft,
                        border: `1px solid ${ativo ? T.gold : T.border}`,
                        color: ativo ? T.gold : T.muted,
                        fontSize: 11, fontWeight: 600, borderRadius: 999,
                        cursor: "pointer",
                      }}>
                {c.label}
              </button>
            );
          })}
        </div>
      </Field>

      <div className="flex gap-3 justify-end mt-6">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-gold" onClick={submit}>Salvar</button>
      </div>
    </Modal>
  );
}

function caminhoNo(node, tree) {
  const partes = [node.label];
  let cur = node;
  while (cur.parentId) {
    cur = tree.find(n => n.id === cur.parentId);
    if (!cur) break;
    partes.unshift(cur.label);
  }
  return partes.join(" → ");
}
