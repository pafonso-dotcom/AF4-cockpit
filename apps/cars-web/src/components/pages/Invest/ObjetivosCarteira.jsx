/**
 * ObjetivosCarteira · "Definir Objetivos" estilo IdV.
 *
 * Modelo livre: usuário monta a árvore como quiser.
 * Cada nó:
 *   - label, percent (% do PAI), parentId, classeMatch (acao/fii/etc — só leafs)
 *
 * Visualizações:
 *   - Desktop ≥768px: árvore visual estilo org-chart (cards conectados por linhas)
 *   - Mobile: lista vertical indentada
 *
 * Comparação:
 *   - % atual da carteira em cada nó (via classeMatch dos descendentes)
 *   - falta R$ pra alcançar o alvo
 *   - barra de progresso
 *
 * Aporte mensal:
 *   - Campo no topo pro usuário definir quanto vai aportar
 *   - Distribui automaticamente pelas folhas, priorizando as abaixo do alvo
 *   - Lista "Onde aportar este mês" com botão IA por folha
 */
import React, { useMemo, useState } from "react";
import {
  Plus, Trash2, Edit3, Sparkles,
  CheckCircle2, AlertCircle, Target, TrendingUp, Building2, Landmark,
  Wallet, ArrowRight, Eye,
} from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, fmtN, uid } from "../../../lib/format.js";
import { parseValorBR } from "../../../lib/importExport.js";
import { semCapitalSocial } from "../../../lib/invest-constants.js";
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
  ativos: ativosProp = [],
  objetivosCarteira,
  setObjetivosCarteira,
  hidden,
  apiKeys = {},
}) {
  const ativos = semCapitalSocial(ativosProp); // Capital Social fora dos objetivos
  const tree = (objetivosCarteira && objetivosCarteira.length > 0) ? objetivosCarteira : DEFAULT_TREE;
  const [editando, setEditando] = useState(null); // node sendo editado
  const [sugestaoOpen, setSugestaoOpen] = useState(false);
  const [sugestaoBucket, setSugestaoBucket] = useState(null); // node escolhido para sugestão
  const [aporteMensal, setAporteMensal] = useState("");
  const [verAtivosNo, setVerAtivosNo] = useState(null); // nó cujos ativos mostrar

  const aporteN = parseValorBR(aporteMensal) || 0;

  /* ===== Total da carteira ===== */
  const totalCarteira = useMemo(() =>
    (ativos || []).reduce((s, a) =>
      s + (Number(a.qtd || 0) * Number(a.preco || 0)), 0
    ), [ativos]);

  /* ===== Valor atual em R$ de cada nó (recursivo: folha = soma de ativos do match; pai = soma dos filhos) ===== */
  const valorPorNo = useMemo(() => {
    const map = new Map();
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

  /* ===== Valor alvo (cascateia % do pai pra baixo) — calculado pro NOVO total (atual + aporte) ===== */
  const valorAlvo = useMemo(() => {
    const map = new Map();
    const totalProjetado = totalCarteira + aporteN;
    const calcular = (nodeId, valorDoPai) => {
      const node = tree.find(n => n.id === nodeId);
      if (!node) return;
      const valor = valorDoPai * (Number(node.percent || 0) / 100);
      map.set(nodeId, valor);
      tree.filter(n => n.parentId === nodeId).forEach(f => calcular(f.id, valor));
    };
    tree.filter(n => n.parentId === null).forEach(root => calcular(root.id, totalProjetado));
    return map;
  }, [tree, totalCarteira, aporteN]);

  /* ===== Distribuição do aporte: prioriza folhas abaixo do alvo ===== */
  const distribuicaoAporte = useMemo(() => {
    if (aporteN <= 0) return new Map();
    const folhas = tree.filter(n => !tree.some(c => c.parentId === n.id));
    const faltas = folhas.map(f => ({
      node: f,
      atual: valorPorNo.get(f.id) || 0,
      alvo: valorAlvo.get(f.id) || 0,
      falta: Math.max(0, (valorAlvo.get(f.id) || 0) - (valorPorNo.get(f.id) || 0)),
    }));
    const somaFaltas = faltas.reduce((s, f) => s + f.falta, 0);
    const map = new Map();

    if (somaFaltas > 0) {
      // Distribui o aporte proporcionalmente ao gap
      // Mas limita cada folha ao máximo do gap (pra não passar do alvo)
      let restante = aporteN;
      const ordenado = [...faltas].filter(f => f.falta > 0).sort((a, b) => b.falta - a.falta);
      for (const f of ordenado) {
        const proporcao = f.falta / somaFaltas;
        const valor = Math.min(f.falta, aporteN * proporcao);
        map.set(f.node.id, valor);
        restante -= valor;
      }
      // Se sobrou (porque algumas folhas atingiram o teto), distribui o restante pelo % alvo das folhas
      if (restante > 0.5) {
        folhas.forEach(f => {
          const proporcao = (valorAlvo.get(f.id) || 0) / (totalCarteira + aporteN);
          map.set(f.node?.id ?? f.id, (map.get(f.node?.id ?? f.id) || 0) + restante * proporcao);
        });
      }
    } else {
      // Tudo no alvo ou acima — distribui pelo % do alvo
      folhas.forEach(f => {
        const totalAlvos = folhas.reduce((s, x) => s + (valorAlvo.get(x.id) || 0), 0);
        const proporcao = totalAlvos > 0 ? (valorAlvo.get(f.id) || 0) / totalAlvos : 0;
        map.set(f.id, aporteN * proporcao);
      });
    }
    return map;
  }, [tree, valorPorNo, valorAlvo, aporteN, totalCarteira]);

  /* ===== Validação: filhos somam 100%? ===== */
  const validacoes = useMemo(() => {
    const problemas = [];
    const raizes = tree.filter(n => n.parentId === null);
    const somaRaiz = raizes.reduce((s, n) => s + Number(n.percent || 0), 0);
    if (Math.abs(somaRaiz - 100) > 0.01 && raizes.length > 0) {
      problemas.push(`Raízes somam ${somaRaiz}% (precisa ser 100%)`);
    }
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

  /* ===== Coleta recursiva de ativos que compõem um nó ===== */
  // Para folhas: ativos cujo tipo está em classeMatch
  // Para intermediários: une os ativos de todas as folhas descendentes (sem repetir)
  const ativosDoNo = (nodeId) => {
    const node = tree.find(n => n.id === nodeId);
    if (!node) return [];
    const filhos = tree.filter(n => n.parentId === nodeId);
    if (filhos.length === 0) {
      // folha
      if (!node.classeMatch || node.classeMatch.length === 0) return [];
      return (ativos || []).filter(a => node.classeMatch.includes(a.tipo) && Number(a.qtd || 0) > 0);
    }
    // intermediário: une descendentes (dedupe por id)
    const set = new Map();
    filhos.forEach(f => {
      ativosDoNo(f.id).forEach(a => set.set(a.id, a));
    });
    return Array.from(set.values());
  };

  /* ===== Sugestão IA pra um bucket ===== */
  const abrirSugestao = (node, valorPadrao) => {
    const valor = valorPadrao != null
      ? valorPadrao
      : Math.max(0, (valorAlvo.get(node.id) || 0) - (valorPorNo.get(node.id) || 0));
    if (valor <= 0) {
      toast.info(`"${node.label}" já está acima do alvo.`);
      return;
    }
    setSugestaoBucket({ node, valor });
    setSugestaoOpen(true);
  };

  const raizes = tree.filter(n => n.parentId === null);

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Investimentos"
        title="Objetivos"
        sub="Defina a alocação ideal da sua carteira. O sistema mostra quanto falta e onde aportar."
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

      {/* Resumo da carteira + aporte mensal */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10,
      }} className="objetivos-resumo">
        <div style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
          padding: 10,
        }}>
          <div className="label-eyebrow">
            <Wallet size={10} className="inline mr-1" />
            Patrimônio total
          </div>
          <div className="num" style={{
            fontFamily: T.serif, fontSize: 19, color: T.ink, fontWeight: 600, marginTop: 3,
          }}>
            {hidden ? "•••" : fmt(totalCarteira)}
          </div>
          <div style={{ fontSize: 10.5, color: T.faint, marginTop: 3 }}>
            {(ativos || []).filter(a => Number(a.qtd || 0) > 0).length} ativos
          </div>
        </div>

        <div style={{
          background: `linear-gradient(135deg, ${T.gold}11, ${T.card})`,
          border: `1px solid ${T.gold}66`,
          borderLeft: `3px solid ${T.gold}`,
          borderRadius: 8, padding: 10,
        }}>
          <div className="label-eyebrow" style={{ color: T.gold }}>
            <ArrowRight size={10} className="inline mr-1" />
            Aporte deste mês
          </div>
          <input type="text" inputMode="decimal"
                 value={aporteMensal}
                 onChange={e => setAporteMensal(e.target.value)}
                 placeholder="Ex.: 2.500,00"
                 style={{
                   marginTop: 4, fontSize: 16,
                   fontFamily: T.serif, fontWeight: 600,
                   padding: "5px 8px",
                   border: `1px solid ${T.border}`, background: T.bg,
                 }} />
          {aporteN > 0 && (
            <div style={{ fontSize: 10.5, color: T.gold, marginTop: 4, fontWeight: 600 }}>
              + {fmt(aporteN)} → {fmt(totalCarteira + aporteN)}
            </div>
          )}
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

      {/* Layout: árvore + plano lado a lado */}
      <div className="objetivos-split">

        {/* Coluna esquerda: árvore */}
        <div className="objetivos-split-tree">
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
            <div style={{
              background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 10,
              padding: 12, overflowX: "auto",
            }}>
              {/* DESKTOP: org-chart visual */}
              <div className="objetivos-tree-desktop">
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                  {raizes.map(raiz => (
                    <TreeOrgNode
                      key={raiz.id}
                      node={raiz}
                      tree={tree}
                      valorPorNo={valorPorNo}
                      valorAlvo={valorAlvo}
                      distribuicaoAporte={distribuicaoAporte}
                      aporteN={aporteN}
                      hidden={hidden}
                      onEditar={(n) => setEditando(n)}
                      onExcluir={excluirNo}
                      onAdicionarFilho={(p) => setEditando({ id: null, parentId: p.id, label: "", percent: 0, classeMatch: null })}
                      onSugerir={(n, v) => abrirSugestao(n, v)}
                      onVer={(n) => setVerAtivosNo(n)}
                    />
                  ))}
                </div>
              </div>

              {/* MOBILE: lista vertical indentada */}
              <div className="objetivos-tree-mobile" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {raizes.map(raiz => (
                  <TreeListNode
                    key={raiz.id}
                    node={raiz}
                    tree={tree}
                    valorPorNo={valorPorNo}
                    valorAlvo={valorAlvo}
                    distribuicaoAporte={distribuicaoAporte}
                    aporteN={aporteN}
                    hidden={hidden}
                    onEditar={(n) => setEditando(n)}
                    onExcluir={excluirNo}
                    onAdicionarFilho={(p) => setEditando({ id: null, parentId: p.id, label: "", percent: 0, classeMatch: null })}
                    onSugerir={(n, v) => abrirSugestao(n, v)}
                    onVer={(n) => setVerAtivosNo(n)}
                    nivel={0}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Coluna direita: Plano deste mês (sidebar) */}
        <div className="objetivos-split-plan">
          <PlanoDeMes
            tree={tree}
            distribuicaoAporte={distribuicaoAporte}
            valorPorNo={valorPorNo}
            valorAlvo={valorAlvo}
            aporteN={aporteN}
            hidden={hidden}
            onSugerir={(n, v) => abrirSugestao(n, v)}
          />
        </div>

      </div>

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
          contextoExtra={`Foco: aportar prioritariamente em **${sugestaoBucket.node.label}** (categoria abaixo do alvo na minha árvore de objetivos).`}
          onAplicarProjecao={() => { setSugestaoOpen(false); setSugestaoBucket(null); }}
        />
      )}

      {/* Modal: Ativos que compõem o nó */}
      {verAtivosNo && (
        <VerAtivosModal
          node={verAtivosNo}
          ativos={ativosDoNo(verAtivosNo.id)}
          valorTotal={valorPorNo.get(verAtivosNo.id) || 0}
          hidden={hidden}
          onClose={() => setVerAtivosNo(null)}
        />
      )}

      <style>{`
        .objetivos-resumo { grid-template-columns: 1fr 1fr; }
        .objetivos-tree-desktop { display: block; }
        .objetivos-tree-mobile { display: none; }

        /* Split layout */
        .objetivos-split { display: flex; gap: 20px; align-items: flex-start; }
        .objetivos-split-tree { flex: 1 1 0; min-width: 0; }
        .objetivos-split-plan { flex: 0 0 300px; min-width: 260px; position: sticky; top: 80px; }

        /* Card hover actions */
        .obj-card-actions { opacity: 0; transition: opacity .15s; }
        .obj-card:hover .obj-card-actions { opacity: 1; }

        @media (max-width: 600px) {
          .objetivos-split { flex-direction: column; }
          .objetivos-split-plan { flex: 1 1 auto; width: 100%; position: static; min-width: 0; }
        }
        @media (max-width: 900px) {
          /* Painel um pouco mais estreito pra árvore e plano caberem lado a lado. */
          .objetivos-split-plan { flex: 0 0 260px; min-width: 220px; }
          .obj-card-actions { opacity: 1; }
        }
        @media (max-width: 768px) {
          .objetivos-resumo { grid-template-columns: 1fr !important; }
          .objetivos-tree-desktop { display: none; }
          .objetivos-tree-mobile { display: flex; }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   TreeOrgNode — visual estilo org-chart (cards conectados por linhas)
   Usado no desktop. Cada nó renderiza o card + linha + filhos centralizados.
   ============================================================ */
function TreeOrgNode({ node, tree, valorPorNo, valorAlvo, distribuicaoAporte, aporteN, hidden, onEditar, onExcluir, onAdicionarFilho, onSugerir, onVer }) {
  const filhos = tree.filter(n => n.parentId === node.id);
  const temFilhos = filhos.length > 0;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      minWidth: 130,
    }}>
      <NodeCard
        node={node}
        valorPorNo={valorPorNo}
        valorAlvo={valorAlvo}
        distribuicaoAporte={distribuicaoAporte}
        aporteN={aporteN}
        hidden={hidden}
        onEditar={onEditar}
        onExcluir={onExcluir}
        onAdicionarFilho={onAdicionarFilho}
        onSugerir={onSugerir}
        onVer={onVer}
        temFilhos={temFilhos}
        modo="org"
      />
      {temFilhos && (
        <>
          {/* linha vertical descendo do pai */}
          <div style={{ width: 1.5, height: 8, background: T.border }} />
          {/* container dos filhos com linha horizontal conectora */}
          <div style={{ position: "relative", display: "flex", gap: 6, paddingTop: 0 }}>
            {/* Linha horizontal só aparece se 2+ filhos */}
            {filhos.length >= 2 && (
              <div style={{
                position: "absolute", top: -2, left: "10%", right: "10%",
                height: 1.5, background: T.border,
              }} />
            )}
            {filhos.map(f => (
              <div key={f.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                {/* Linha vertical curta de cada filho subindo até a horizontal */}
                <div style={{ width: 1.5, height: 6, background: T.border }} />
                <TreeOrgNode
                  node={f}
                  tree={tree}
                  valorPorNo={valorPorNo}
                  valorAlvo={valorAlvo}
                  distribuicaoAporte={distribuicaoAporte}
                  aporteN={aporteN}
                  hidden={hidden}
                  onEditar={onEditar}
                  onExcluir={onExcluir}
                  onAdicionarFilho={onAdicionarFilho}
                  onSugerir={onSugerir}
        onVer={onVer}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   TreeListNode — lista vertical indentada (mobile)
   ============================================================ */
function TreeListNode({ node, tree, valorPorNo, valorAlvo, distribuicaoAporte, aporteN, hidden, onEditar, onExcluir, onAdicionarFilho, onSugerir, onVer, nivel }) {
  const filhos = tree.filter(n => n.parentId === node.id);
  return (
    <>
      <div style={{ marginLeft: nivel * 14 }}>
        <NodeCard
          node={node}
          valorPorNo={valorPorNo}
          valorAlvo={valorAlvo}
          distribuicaoAporte={distribuicaoAporte}
          aporteN={aporteN}
          hidden={hidden}
          onEditar={onEditar}
          onExcluir={onExcluir}
          onAdicionarFilho={onAdicionarFilho}
          onSugerir={onSugerir}
        onVer={onVer}
          temFilhos={filhos.length > 0}
          modo="list"
        />
      </div>
      {filhos.map(f => (
        <TreeListNode
          key={f.id}
          node={f}
          tree={tree}
          valorPorNo={valorPorNo}
          valorAlvo={valorAlvo}
          distribuicaoAporte={distribuicaoAporte}
          aporteN={aporteN}
          hidden={hidden}
          onEditar={onEditar}
          onExcluir={onExcluir}
          onAdicionarFilho={onAdicionarFilho}
          onSugerir={onSugerir}
        onVer={onVer}
          nivel={nivel + 1}
        />
      ))}
    </>
  );
}

/* ============================================================
   NodeCard — visual do card (usado tanto no org-chart quanto na lista)
   ============================================================ */
function NodeCard({ node, valorPorNo, valorAlvo, distribuicaoAporte, aporteN, hidden, onEditar, onExcluir, onAdicionarFilho, onSugerir, onVer, temFilhos, modo }) {
  const atual = valorPorNo.get(node.id) || 0;
  const alvo = valorAlvo.get(node.id) || 0;
  const diff = atual - alvo;
  const pctAlvo = alvo > 0 ? Math.min(100, (atual / alvo) * 100) : 0;
  const noAlvo = alvo > 0 && Math.abs(diff) <= alvo * 0.03;
  const acima = diff > 0;
  const abaixo = diff < 0 && alvo > 0;
  const corStatus = noAlvo ? T.green : acima ? "#fbbf24" : abaixo ? T.red : T.muted;

  // Aporte sugerido pra esta folha (só relevante quando aporteN > 0 e é folha)
  const aporteSugerido = !temFilhos && distribuicaoAporte ? (distribuicaoAporte.get(node.id) || 0) : 0;
  const pctDoAporte = aporteN > 0 ? (aporteSugerido / aporteN) * 100 : 0;
  const temAporte = aporteSugerido > 0.5;

  const Icon = iconeDaClasse(node.classeMatch);
  const corClasse = corDaClasse(node.classeMatch);

  if (modo === "org") {
    return (
      <div className="obj-card" style={{
        position: "relative",
        background: T.card,
        border: `1px solid ${T.border}`,
        borderTop: `3px solid ${corStatus}`,
        borderRadius: 10,
        padding: "10px 12px",
        minWidth: 148, maxWidth: 200,
        boxShadow: `0 2px 6px rgba(0,0,0,.12)`,
      }}>
        {/* Ações flutuantes no canto superior direito (hover) */}
        <div className="obj-card-actions" style={{
          position: "absolute", top: 6, right: 6,
          display: "flex", gap: 2,
        }}>
          <button onClick={() => onVer && onVer(node)} title="Ver ativos" style={iconBtnStyle(T.muted)}><Eye size={11} /></button>
          <button onClick={() => onAdicionarFilho(node)} title="Adicionar filho" style={iconBtnStyle(T.muted)}><Plus size={11} /></button>
          <button onClick={() => onEditar(node)} title="Editar" style={iconBtnStyle(T.muted)}><Edit3 size={11} /></button>
          <button onClick={() => onExcluir(node)} title="Excluir" disabled={temFilhos}
                  style={{ ...iconBtnStyle(T.red), opacity: temFilhos ? 0.3 : 1 }}><Trash2 size={11} /></button>
        </div>

        {/* Header: ícone + label + % */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, paddingRight: 60 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            background: `${corClasse}22`, color: corClasse,
            display: "grid", placeItems: "center",
          }}>
            <Icon size={14} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.ink, lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {node.label}
            </div>
            <div className="num" style={{ fontSize: 13, color: T.gold, fontWeight: 700, lineHeight: 1.1 }}>
              {Number(node.percent).toFixed(1)}%
            </div>
          </div>
          {noAlvo && <CheckCircle2 size={13} style={{ color: T.green, flexShrink: 0 }} />}
        </div>

        {/* Barra de progresso + valores */}
        {alvo > 0 && (
          <>
            <div style={{ height: 6, background: T.border, borderRadius: 999, overflow: "hidden" }}>
              <div style={{
                width: `${pctAlvo}%`, height: "100%",
                background: corStatus, borderRadius: 999,
                transition: "width .4s",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: T.muted }}>
              <span>{hidden ? "•••" : fmt(atual)}</span>
              <span style={{ color: T.faint }}>{hidden ? "•••" : fmt(alvo)}</span>
            </div>
            {!noAlvo && (
              <div style={{ fontSize: 11, color: corStatus, fontWeight: 700, textAlign: "center", marginTop: 2 }}>
                {abaixo ? `↓ falta ${hidden ? "•••" : fmt(-diff)}` : `↑ sobra ${hidden ? "•••" : fmt(diff)}`}
              </div>
            )}
          </>
        )}

        {/* Aporte: badge compacto + botão IA pequeno */}
        {!temFilhos && temAporte && (
          <div style={{
            marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "5px 8px", background: `${T.gold}12`, border: `1px solid ${T.gold}44`, borderRadius: 6,
          }}>
            <div>
              <div style={{ fontSize: 9, color: T.gold, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>
                Aportar
              </div>
              <div className="num" style={{ fontSize: 13, color: T.gold, fontWeight: 700, lineHeight: 1 }}>
                {hidden ? "•••" : fmt(aporteSugerido)}
              </div>
            </div>
            <button onClick={() => onSugerir(node, aporteSugerido)} title="Sugerir ticker com IA"
                    style={{
                      background: T.gold, color: T.bg, border: "none",
                      padding: "4px 7px", fontSize: 9.5, fontWeight: 700, borderRadius: 5,
                      cursor: "pointer", display: "flex", alignItems: "center", gap: 3,
                    }}>
              <Sparkles size={9} /> IA
            </button>
          </div>
        )}

        {/* Sem aporte mas abaixo do alvo: botão IA */}
        {!temFilhos && !temAporte && abaixo && (
          <button onClick={() => onSugerir(node)}
                  style={{
                    marginTop: 6, width: "100%",
                    background: `${T.gold}15`, color: T.gold,
                    border: `1px solid ${T.gold}55`, padding: "4px 8px",
                    fontSize: 10, fontWeight: 700, borderRadius: 5,
                    cursor: "pointer",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                  }}>
            <Sparkles size={10} /> IA aporte
          </button>
        )}

      </div>
    );
  }

  // modo "list" (mobile)
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderLeft: `4px solid ${corStatus}`,
      borderRadius: 8,
      padding: 12,
      display: "grid",
      gridTemplateColumns: "auto 1fr auto",
      gap: 10, alignItems: "center",
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 7,
        background: `${corClasse}22`, color: corClasse,
        display: "grid", placeItems: "center", flexShrink: 0,
      }}>
        <Icon size={16} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{node.label}</span>
          <span style={{
            fontSize: 10, padding: "2px 7px", borderRadius: 4,
            background: `${T.gold}22`, color: T.gold, fontWeight: 700,
          }}>
            {Number(node.percent).toFixed(1)}%
          </span>
        </div>
        {alvo > 0 && (
          <>
            <div style={{ height: 5, background: T.border, borderRadius: 999, marginTop: 6, overflow: "hidden" }}>
              <div style={{ width: `${pctAlvo}%`, height: "100%", background: corStatus, transition: "width .4s" }} />
            </div>
            <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4 }}>
              {hidden ? "•••" : fmt(atual)} / {hidden ? "•••" : fmt(alvo)}
              {!noAlvo && (
                <span style={{ color: corStatus, marginLeft: 8, fontWeight: 600 }}>
                  {abaixo ? `falta ${fmt(-diff)}` : `sobra ${fmt(diff)}`}
                </span>
              )}
            </div>
            {!temFilhos && temAporte && (
              <div style={{
                marginTop: 6, padding: "5px 8px", borderRadius: 6,
                background: `${T.gold}15`, border: `1px solid ${T.gold}55`,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 10, color: T.gold, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase" }}>
                  Aportar
                </span>
                <span className="num" style={{ fontSize: 12, color: T.gold, fontWeight: 700 }}>
                  {hidden ? "•••" : fmt(aporteSugerido)}
                  <span style={{ fontSize: 9.5, color: T.faint, fontWeight: 500, marginLeft: 5 }}>
                    ({pctDoAporte.toFixed(0)}%)
                  </span>
                </span>
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
        {!temFilhos && (temAporte || abaixo) && (
          <button onClick={() => onSugerir(node, temAporte ? aporteSugerido : undefined)}
                  title="Sugerir ticker IA"
                  style={{ ...iconBtnStyle(T.gold), background: `${T.gold}15` }}>
            <Sparkles size={12} />
          </button>
        )}
        <button onClick={() => onVer && onVer(node)} title="Ver ativos deste objetivo"
                style={iconBtnStyle(T.gold)}>
          <Eye size={12} />
        </button>
        <button onClick={() => onAdicionarFilho(node)} title="Adicionar filho" style={iconBtnStyle(T.muted)}>
          <Plus size={12} />
        </button>
        <button onClick={() => onEditar(node)} title="Editar" style={iconBtnStyle(T.muted)}>
          <Edit3 size={11} />
        </button>
        <button onClick={() => onExcluir(node)} title="Excluir" disabled={temFilhos}
                style={{ ...iconBtnStyle(T.red), opacity: temFilhos ? 0.3 : 1 }}>
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

const iconBtnStyle = (cor) => ({
  background: "transparent", border: "none", color: cor,
  cursor: "pointer", padding: 1, minHeight: 14,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  borderRadius: 3,
});

function corDaClasse(classeMatch) {
  if (!classeMatch || classeMatch.length === 0) return "#a8a8b0";
  if (classeMatch.includes("fii")) return "#fbbf24";
  if (classeMatch.includes("acao") || classeMatch.includes("stock")) return "#f87171";
  if (classeMatch.includes("reit")) return "#fb7185";
  if (classeMatch.includes("etf")) return "#a78bfa";
  if (classeMatch.includes("cdb") || classeMatch.includes("tesouro") || classeMatch.includes("rf")) return "#60a5fa";
  if (classeMatch.includes("cripto")) return "#34d399";
  return T.gold;
}

function iconeDaClasse(classeMatch, size = 14) {
  if (!classeMatch || classeMatch.length === 0) return (props) => <Target {...props} />;
  if (classeMatch.includes("fii")) return (props) => <Building2 {...props} />;
  if (classeMatch.includes("cdb") || classeMatch.includes("tesouro") || classeMatch.includes("rf")) return (props) => <Landmark {...props} />;
  if (classeMatch.includes("acao") || classeMatch.includes("stock") || classeMatch.includes("reit") || classeMatch.includes("etf")) return (props) => <TrendingUp {...props} />;
  return (props) => <Target {...props} />;
}

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

/* ============================================================
   PlanoDeMes — distribuição do aporte mensal por folha
   ============================================================ */
function PlanoDeMes({ tree, distribuicaoAporte, valorPorNo, valorAlvo, aporteN, hidden, onSugerir }) {
  if (aporteN <= 0) return null;

  const folhas = tree
    .filter(n => !tree.some(c => c.parentId === n.id))
    .filter(n => (distribuicaoAporte.get(n.id) || 0) > 0.5)
    .sort((a, b) => (distribuicaoAporte.get(b.id) || 0) - (distribuicaoAporte.get(a.id) || 0));

  if (folhas.length === 0) return null;

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", marginBottom: 12,
        background: `${T.gold}10`, border: `1px solid ${T.gold}40`,
        borderLeft: `3px solid ${T.gold}`, borderRadius: 8,
      }}>
        <Target size={15} style={{ color: T.gold, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.gold, textTransform: "uppercase", letterSpacing: ".08em" }}>
            Plano deste mês
          </div>
          <div style={{ fontSize: 10.5, color: T.muted }}>
            Distribuição de {fmt(aporteN)}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {folhas.map(node => {
          const sugerido = distribuicaoAporte.get(node.id) || 0;
          const pctAporte = (sugerido / aporteN) * 100;
          const cor = corDaClasse(node.classeMatch);
          const Icon = iconeDaClasse(node.classeMatch);
          const atual = valorPorNo.get(node.id) || 0;
          const alvo = valorAlvo.get(node.id) || 0;
          const pctAlvoAtual = alvo > 0 ? Math.min(100, (atual / alvo) * 100) : 0;

          return (
            <div key={node.id} style={{
              background: T.card, border: `1px solid ${T.border}`,
              borderLeft: `3px solid ${cor}`, borderRadius: 8,
              padding: "12px 14px",
              display: "grid", gridTemplateColumns: "auto 1fr auto",
              gap: 12, alignItems: "center",
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 9,
                background: `${cor}20`, color: cor,
                display: "grid", placeItems: "center", flexShrink: 0,
              }}>
                <Icon size={17} />
              </div>

              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{node.label}</span>
                  <span style={{
                    fontSize: 10, padding: "2px 7px", borderRadius: 4,
                    background: `${cor}18`, color: cor, fontWeight: 700,
                  }}>
                    {pctAporte.toFixed(0)}% do aporte
                  </span>
                </div>
                <div style={{ height: 6, background: T.border, borderRadius: 999, overflow: "hidden" }}>
                  <div style={{
                    width: `${pctAporte}%`, height: "100%",
                    background: cor, borderRadius: 999, transition: "width .4s",
                  }} />
                </div>
                <div style={{ fontSize: 10.5, color: T.faint, marginTop: 4 }}>
                  meta: {hidden ? "•••" : fmt(alvo)} · alocado {pctAlvoAtual.toFixed(0)}%
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                <div className="num" style={{ fontSize: 17, fontWeight: 700, color: T.gold }}>
                  {hidden ? "•••" : fmt(sugerido)}
                </div>
                <button onClick={() => onSugerir(node, sugerido)}
                        style={{
                          background: T.gold, color: T.bg, border: "none",
                          padding: "5px 10px", fontSize: 10.5, fontWeight: 700,
                          borderRadius: 5, cursor: "pointer",
                          display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
                        }}>
                  <Sparkles size={9} /> IA
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   VerAtivosModal — visualização rápida dos ativos de um objetivo
   ============================================================ */
function VerAtivosModal({ node, ativos, valorTotal, hidden, onClose }) {
  const ordenados = [...ativos]
    .map(a => ({
      ...a,
      valor: Number(a.qtd || 0) * Number(a.preco || 0),
      investido: Number(a.qtd || 0) * Number(a.pm || 0),
    }))
    .sort((a, b) => b.valor - a.valor);

  const cor = corDaClasse(node.classeMatch);
  const Icon = iconeDaClasse(node.classeMatch);

  return (
    <Modal
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon size={16} style={{ color: cor }} />
          <span>{node.label}</span>
          <span style={{ fontSize: 11, color: T.muted, fontWeight: 400 }}>
            · {ativos.length} {ativos.length === 1 ? "ativo" : "ativos"}
          </span>
        </span>
      }
      onClose={onClose}
      wide
    >
      {/* Resumo total */}
      <div style={{
        padding: 12, marginBottom: 12,
        background: `${cor}11`, border: `1px solid ${cor}44`,
        borderLeft: `3px solid ${cor}`,
        borderRadius: 8,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 11, color: T.muted, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600 }}>
          Valor total no objetivo
        </span>
        <span className="num" style={{
          fontFamily: T.serif, fontSize: 22, color: cor, fontWeight: 600,
        }}>
          {hidden ? "•••" : fmt(valorTotal)}
        </span>
      </div>

      {/* Lista de ativos */}
      {ordenados.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "40px 24px",
          background: T.bgSoft, border: `1px dashed ${T.border}`, borderRadius: 10,
        }}>
          <Target size={32} style={{ color: T.muted, marginBottom: 10 }} />
          <div style={{ fontSize: 14, color: T.ink, fontWeight: 600, marginBottom: 4 }}>
            Nenhum ativo nesta categoria
          </div>
          <div style={{ fontSize: 12, color: T.muted }}>
            {node.classeMatch?.length
              ? `Adicione ativos do tipo: ${node.classeMatch.join(", ")}`
              : "Este nó intermediário não tem ativos nos filhos."}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ordenados.map(a => {
            const pctNoObj = valorTotal > 0 ? (a.valor / valorTotal) * 100 : 0;
            const ganho = a.valor - a.investido;
            const pctGanho = a.investido > 0 ? (ganho / a.investido) * 100 : 0;
            return (
              <div key={a.id} style={{
                background: T.card, border: `1px solid ${T.border}`,
                borderLeft: `3px solid ${cor}`,
                borderRadius: 8, padding: "10px 12px",
                display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center",
              }}>
                <div style={{
                  padding: "4px 8px", background: `${cor}22`, color: cor,
                  fontSize: 11, fontWeight: 700, borderRadius: 5, letterSpacing: ".03em",
                  minWidth: 56, textAlign: "center",
                }}>
                  {a.ticker}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: T.ink, fontWeight: 500 }}>
                    {a.nome || a.ticker}
                    {a.segmento && (
                      <span style={{ fontSize: 10, color: T.faint, marginLeft: 6, fontStyle: "italic" }}>
                        · {a.segmento}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>
                    {Number(a.qtd).toFixed(a.tipo === "cripto" ? 6 : 0)} × {fmt(a.preco)}
                    {a.investido > 0 && (
                      <span style={{ color: ganho >= 0 ? T.green : T.red, marginLeft: 8, fontWeight: 600 }}>
                        {ganho >= 0 ? "+" : ""}{pctGanho.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <div className="num" style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>
                    {hidden ? "•••" : fmt(a.valor)}
                  </div>
                  <div style={{ fontSize: 9.5, color: T.faint, marginTop: 1 }}>
                    {pctNoObj.toFixed(1)}% do objetivo
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
