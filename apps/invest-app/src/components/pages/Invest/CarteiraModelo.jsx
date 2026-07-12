/**
 * CarteiraModelo · "Onde colocar seu dinheiro" estilo IdV.
 *
 * Mostra carteira modelo (Iniciante, Completo ou Custom) com:
 * - Tickers e % alvo por classe
 * - Agrupados por segmento/setor (FII e Ação)
 * - Comparação com a carteira atual (você tem? quanto? falta R$)
 * - Checklist de regras de boa prática (mín FIIs por segmento, etc.)
 * - Aporte mensal distribuído pelas folhas em déficit
 * - Botão IA por ticker faltante
 * - Botão "Duplicar e editar" pra criar custom
 */
import React, { useMemo, useState } from "react";
import {
  Plus, Trash2, Edit3, Sparkles, ChevronDown, ChevronRight,
  CheckCircle2, AlertCircle, Target, TrendingUp, Building2, Landmark,
  Wallet, ArrowRight, Copy, Eye, EyeOff,
} from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, fmtN, uid } from "../../../lib/format.js";
import { parseValorBR } from "../../../lib/importExport.js";
import { semCapitalSocial } from "../../../lib/invest-constants.js";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import {
  MODELOS_BUILTIN, TIPOS_POR_CLASSE, LABEL_CLASSE,
  analisarClasse, avaliarRegra,
} from "../../../lib/carteirasModelo.js";
import PageHeader from "../../ui/PageHeader.jsx";
import Field from "../../ui/Field.jsx";
import Modal from "../../ui/Modal.jsx";
import SugestaoAporte from "./SugestaoAporte.jsx";

const ICONE_CLASSE = {
  fii:   Building2,
  acao:  TrendingUp,
  stock: TrendingUp,
  reit:  Building2,
};

const COR_CLASSE = {
  fii:   "#fbbf24",
  acao:  "#f87171",
  stock: "#a78bfa",
  reit:  "#fb7185",
};

export default function CarteiraModelo({
  ativos: ativosProp = [],
  carteirasModeloCustom,
  setCarteirasModeloCustom,
  modeloAtivoId,
  setModeloAtivoId,
  hidden,
  apiKeys = {},
}) {
  const ativos = semCapitalSocial(ativosProp); // Capital Social fora do rebalanceamento
  const todosModelos = useMemo(
    () => [...MODELOS_BUILTIN, ...(carteirasModeloCustom || [])],
    [carteirasModeloCustom]
  );
  const modelo = todosModelos.find(m => m.id === modeloAtivoId) || todosModelos[0];

  const [aporteMensal, setAporteMensal] = useState("");
  const [classesExpandidas, setClassesExpandidas] = useState({ fii: true, acao: true, stock: false, reit: false });
  const [sugestaoOpen, setSugestaoOpen] = useState(false);
  const [sugestaoCtx, setSugestaoCtx] = useState(null);
  const [editando, setEditando] = useState(null);

  const aporteN = parseValorBR(aporteMensal) || 0;

  // Total da carteira por classe (todas as classes do modelo)
  const totalPorClasse = useMemo(() => {
    const m = {};
    Object.keys(modelo?.classes || {}).forEach(k => {
      const tipos = TIPOS_POR_CLASSE[k] || [k];
      m[k] = (ativos || [])
        .filter(a => Number(a.qtd || 0) > 0)
        .filter(a => tipos.includes(a.tipo))
        .reduce((s, a) => s + Number(a.qtd || 0) * Number(a.preco || 0), 0);
    });
    return m;
  }, [ativos, modelo]);

  const totalGeral = Object.values(totalPorClasse).reduce((s, v) => s + v, 0);

  // Aporte por classe: proporcional ao % do modelo (se modelo tem peso por classe)
  // Como o modelo IdV não define % por classe, distribuímos proporcional ao alvo total faltante por classe
  const aportePorClasse = useMemo(() => {
    if (aporteN <= 0 || !modelo) return {};
    const m = {};
    const totaisFalta = {};
    Object.keys(modelo.classes).forEach(k => {
      const analise = analisarClasse({
        classeConfig: modelo.classes[k],
        ativosCarteira: ativos,
        ativosTipo: TIPOS_POR_CLASSE[k] || [k],
        aporteAlvo: 0,
      });
      totaisFalta[k] = analise.linhas.reduce((s, l) => s + l.falta, 0);
    });
    const somaFaltas = Object.values(totaisFalta).reduce((s, v) => s + v, 0);
    if (somaFaltas <= 0) {
      // dividi igualmente entre classes (não recomendado, mas evita zerar)
      Object.keys(modelo.classes).forEach(k => { m[k] = aporteN / Object.keys(modelo.classes).length; });
    } else {
      Object.keys(modelo.classes).forEach(k => {
        m[k] = aporteN * ((totaisFalta[k] || 0) / somaFaltas);
      });
    }
    return m;
  }, [aporteN, modelo, ativos]);

  const trocarModelo = (id) => setModeloAtivoId(id);

  const duplicarModelo = () => {
    if (!modelo) return;
    const novoId = `custom-${Date.now()}`;
    const copia = {
      ...JSON.parse(JSON.stringify(modelo)),
      id: novoId,
      nome: `${modelo.nome} (cópia)`,
      builtin: false,
    };
    setCarteirasModeloCustom([...(carteirasModeloCustom || []), copia]);
    setModeloAtivoId(novoId);
    toast.success("Modelo duplicado. Agora você pode editar.");
  };

  const excluirModelo = async () => {
    if (!modelo || modelo.builtin) return;
    const ok = await confirm({
      title: `Excluir "${modelo.nome}"?`,
      confirmLabel: "Excluir", danger: true,
    });
    if (!ok) return;
    setCarteirasModeloCustom((carteirasModeloCustom || []).filter(m => m.id !== modelo.id));
    setModeloAtivoId(MODELOS_BUILTIN[0].id);
    toast.success("Modelo removido.");
  };

  const abrirSugestao = (ticker, valor, classe) => {
    if (valor <= 0) {
      toast.info(`${ticker} já está no alvo.`);
      return;
    }
    setSugestaoCtx({ ticker, valor, classe });
    setSugestaoOpen(true);
  };

  // Edita uma classe: se modelo é builtin, duplica primeiro e abre editor no clone
  const editarClasse = (classeKey) => {
    if (!modelo) return;
    if (modelo.builtin) {
      const novoId = `custom-${Date.now()}`;
      const copia = {
        ...JSON.parse(JSON.stringify(modelo)),
        id: novoId,
        nome: `${modelo.nome} (editado)`,
        builtin: false,
      };
      setCarteirasModeloCustom([...(carteirasModeloCustom || []), copia]);
      setModeloAtivoId(novoId);
      toast.info("Modelo padrão duplicado pra você editar.");
      setTimeout(() => setEditando({ classeKey }), 50);
      return;
    }
    setEditando({ classeKey });
  };

  const toggleClasse = (k) => setClassesExpandidas(p => ({ ...p, [k]: !p[k] }));

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Investimentos"
        title="Carteira Modelo"
        sub="Tickers e % alvo por classe — saiba exatamente onde colocar o próximo R$."
        action={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="btn-ghost" onClick={duplicarModelo}>
              <Copy size={13} className="inline mr-1.5" /> Duplicar
            </button>
            {!modelo?.builtin && (
              <button className="btn-ghost" onClick={excluirModelo} style={{ color: T.red, borderColor: `${T.red}55` }}>
                <Trash2 size={13} className="inline mr-1.5" /> Excluir
              </button>
            )}
          </div>
        }
      />

      {/* Seletor de modelo + descrição */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 18,
        padding: 14, marginBottom: 12,
      }}>
        <div className="label-eyebrow" style={{ marginBottom: 8 }}>Modelo ativo</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {todosModelos.map(m => {
            const ativo = m.id === modelo?.id;
            return (
              <button key={m.id} onClick={() => trocarModelo(m.id)}
                      style={{
                        padding: "8px 14px",
                        background: ativo ? `${T.gold}22` : T.bgSoft,
                        border: `1px solid ${ativo ? T.gold : T.border}`,
                        color: ativo ? T.gold : T.muted,
                        borderRadius: 14, cursor: "pointer",
                        fontSize: 12, fontWeight: 600,
                        display: "inline-flex", alignItems: "center", gap: 6,
                      }}>
                {m.nome}
                {!m.builtin && <span style={{ fontSize: 9.5, color: T.faint, fontWeight: 500 }}>custom</span>}
              </button>
            );
          })}
        </div>
        {modelo?.descricao && (
          <div style={{ fontSize: 12, color: T.muted, marginTop: 10, fontStyle: "italic" }}>
            {modelo.descricao}
          </div>
        )}
      </div>

      {/* Aporte mensal */}
      <div style={{
        background: `linear-gradient(135deg, ${T.gold}11, ${T.card})`,
        border: `1px solid ${T.gold}66`,
        borderLeft: `3px solid ${T.gold}`,
        borderRadius: 18, padding: 14, marginBottom: 14,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
      }} className="carteira-modelo-topo">
        <div>
          <div className="label-eyebrow">
            <Wallet size={11} className="inline mr-1" />
            Total nas classes do modelo
          </div>
          <div className="num" style={{
            fontFamily: T.serif, fontSize: 24, color: T.ink, fontWeight: 600, marginTop: 4,
          }}>
            {hidden ? "•••" : fmt(totalGeral)}
          </div>
        </div>
        <div>
          <div className="label-eyebrow" style={{ color: T.gold }}>
            <ArrowRight size={11} className="inline mr-1" />
            Quanto vai aportar este mês?
          </div>
          <input type="text" inputMode="decimal"
                 value={aporteMensal}
                 onChange={e => setAporteMensal(e.target.value)}
                 placeholder="Ex.: 2.500,00"
                 style={{
                   marginTop: 6, fontSize: 18, fontFamily: T.serif, fontWeight: 600,
                   border: `1px solid ${T.border}`, background: T.bg,
                 }} />
        </div>
      </div>

      {/* Classes: FII, Ação, Stock, REIT */}
      {modelo && Object.keys(modelo.classes).map(k => (
        <ClasseBlock
          key={k}
          classeKey={k}
          classeConfig={modelo.classes[k]}
          ativos={ativos}
          totalDaClasse={totalPorClasse[k] || 0}
          aporteDaClasse={aportePorClasse[k] || 0}
          expandida={classesExpandidas[k]}
          onToggle={() => toggleClasse(k)}
          hidden={hidden}
          onSugerirIA={abrirSugestao}
          onEditar={() => editarClasse(k)}
        />
      ))}

      {/* Modal Sugestão IA */}
      {sugestaoOpen && sugestaoCtx && (
        <SugestaoAporte
          open={sugestaoOpen}
          onClose={() => { setSugestaoOpen(false); setSugestaoCtx(null); }}
          ativosCarteira={ativos}
          apiKey={apiKeys.anthropic}
          valorInicial={Math.round(sugestaoCtx.valor)}
          contextoExtra={`Foco específico: comprar **${sugestaoCtx.ticker}** (faltando R$ ${sugestaoCtx.valor.toFixed(2)} pra atingir o alvo da minha carteira modelo na classe ${sugestaoCtx.classe}). Confirme se é boa hora ou sugira alternativa do mesmo segmento.`}
        />
      )}

      {/* Modal Editar (só pra custom) */}
      {editando && (
        <EditarClasseModal
          classeKey={editando.classeKey}
          classeConfig={modelo.classes[editando.classeKey]}
          onSalvar={(novaConfig) => {
            const novoModelo = {
              ...modelo,
              classes: { ...modelo.classes, [editando.classeKey]: novaConfig },
            };
            setCarteirasModeloCustom((carteirasModeloCustom || []).map(m =>
              m.id === modelo.id ? novoModelo : m
            ));
            setEditando(null);
            toast.success("Classe atualizada.");
          }}
          onClose={() => setEditando(null)}
        />
      )}

      <style>{`
        .carteira-modelo-topo { grid-template-columns: 1fr 1fr; }
        @media (max-width: 768px) {
          .carteira-modelo-topo { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   ClasseBlock — bloco colapsível de uma classe (FII / Ação / Stock / REIT)
   ============================================================ */
function ClasseBlock({ classeKey, classeConfig, ativos, totalDaClasse, aporteDaClasse, expandida, onToggle, hidden, onSugerirIA, onEditar }) {
  const cor = COR_CLASSE[classeKey] || T.gold;
  const Icon = ICONE_CLASSE[classeKey] || Target;

  const analise = useMemo(() => analisarClasse({
    classeConfig,
    ativosCarteira: ativos,
    ativosTipo: TIPOS_POR_CLASSE[classeKey] || [classeKey],
    aporteAlvo: aporteDaClasse,
  }), [classeConfig, ativos, classeKey, aporteDaClasse]);

  const totalAtual = analise.totalAtual;
  const totalAlvo = analise.totalProjetado;
  const totalFalta = analise.linhas.reduce((s, l) => s + l.falta, 0);
  const totalTickersOk = analise.linhas.filter(l => l.temNaCarteira).length;

  // Agrupa linhas por segmento
  const porSegmento = useMemo(() => {
    const m = new Map();
    analise.linhas.forEach(l => {
      const seg = l.segmento || "Sem segmento";
      if (!m.has(seg)) m.set(seg, []);
      m.get(seg).push(l);
    });
    return Array.from(m.entries());
  }, [analise.linhas]);

  // Avalia regras
  const resultadosRegras = useMemo(() =>
    (classeConfig.regras || []).map(r => ({
      regra: r,
      resultado: avaliarRegra(r, classeConfig.tickers, ativos),
    })), [classeConfig, ativos]);

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${cor}`,
      borderRadius: 18, marginBottom: 12, overflow: "hidden",
    }}>
      {/* Header */}
      <button onClick={onToggle}
              style={{
                width: "100%", padding: "14px 16px",
                background: "transparent", border: "none",
                display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 12, alignItems: "center",
                cursor: "pointer", textAlign: "left",
              }}>
        <div style={{
          width: 36, height: 36, borderRadius: 14,
          background: `${cor}22`, color: cor,
          display: "grid", placeItems: "center", flexShrink: 0,
        }}>
          <Icon size={18} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>
            {LABEL_CLASSE[classeKey] || classeKey}
            <span style={{ fontSize: 11, color: T.muted, fontWeight: 400, marginLeft: 8 }}>
              {totalTickersOk} de {classeConfig.tickers.length} no modelo
            </span>
            {analise.qtdAtivosClasse > 0 && (
              <span style={{ fontSize: 11, color: T.faint, fontWeight: 400, marginLeft: 6 }}>
                · {analise.qtdAtivosClasse} {analise.qtdAtivosClasse === 1 ? "ativo" : "ativos"} na carteira
              </span>
            )}
            {analise.foraDoModelo.length > 0 && (
              <span style={{ fontSize: 10, color: T.ink, fontWeight: 700, marginLeft: 6, padding: "1px 6px", background: `${T.ink}1a`, borderRadius: 3 }}>
                {analise.foraDoModelo.length} fora
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
            Atual {hidden ? "•••" : fmt(totalAtual)}
            {totalFalta > 0.5 && (
              <span style={{ color: T.red, fontWeight: 600, marginLeft: 8 }}>
                · falta {hidden ? "•••" : fmt(totalFalta)}
              </span>
            )}
            {aporteDaClasse > 0 && (
              <span style={{ color: T.gold, fontWeight: 600, marginLeft: 8 }}>
                · aporte {hidden ? "•••" : fmt(aporteDaClasse)}
              </span>
            )}
          </div>
        </div>
        {expandida && (
          <button onClick={(e) => { e.stopPropagation(); onEditar(); }}
                  style={iconBtn(T.muted)} title="Editar tickers e %">
            <Edit3 size={13} />
          </button>
        )}
        {expandida ? <ChevronDown size={16} color={T.muted} /> : <ChevronRight size={16} color={T.muted} />}
      </button>

      {/* Conteúdo expandido */}
      {expandida && (
        <div style={{ padding: "0 16px 16px" }}>
          {/* Regras */}
          {resultadosRegras.length > 0 && (
            <div style={{
              marginBottom: 12, padding: 10,
              background: T.bgSoft, borderRadius: 14,
              border: `1px solid ${T.border}`,
            }}>
              <div className="label-eyebrow" style={{ marginBottom: 6 }}>
                Regras de boa prática
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {resultadosRegras.map(({ regra, resultado }) => (
                  <div key={regra.id} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    fontSize: 11.5, color: T.ink,
                  }}>
                    {regra.tipo === "info" ? (
                      <Sparkles size={12} style={{ color: T.gold, flexShrink: 0 }} />
                    ) : resultado.ok ? (
                      <CheckCircle2 size={12} style={{ color: T.green, flexShrink: 0 }} />
                    ) : (
                      <AlertCircle size={12} style={{ color: T.red, flexShrink: 0 }} />
                    )}
                    <span>{regra.label}</span>
                    {resultado.mensagem && (
                      <span style={{ color: T.muted, fontSize: 10.5, fontStyle: "italic", marginLeft: "auto" }}>
                        {resultado.mensagem}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lista por segmento */}
          {porSegmento.map(([segmento, linhas]) => {
            const segPctAlvo = linhas.reduce((s, l) => s + l.pctAlvoNoModelo, 0);
            const segValorAlvo = linhas.reduce((s, l) => s + l.valorAlvo, 0);
            const segValorAtual = linhas.reduce((s, l) => s + l.valorAtual, 0);
            const segFalta = Math.max(0, segValorAlvo - segValorAtual);
            return (
              <div key={segmento} style={{ marginBottom: 12 }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  fontSize: 11, color: cor, letterSpacing: ".08em", textTransform: "uppercase",
                  fontWeight: 700, marginBottom: 6,
                  paddingBottom: 4, borderBottom: `1px solid ${T.border}`,
                }}>
                  <span>{segmento} · {segPctAlvo.toFixed(1)}%</span>
                  <span style={{ color: T.muted, fontSize: 10.5, fontWeight: 500, letterSpacing: 0, textTransform: "none" }}>
                    {hidden ? "•••" : fmt(segValorAtual)} / {hidden ? "•••" : fmt(segValorAlvo)}
                    {segFalta > 0.5 && (
                      <span style={{ color: T.red, fontWeight: 600, marginLeft: 6 }}>
                        falta {hidden ? "•••" : fmt(segFalta)}
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {linhas.map(l => (
                    <TickerRow
                      key={l.ticker}
                      linha={l}
                      cor={cor}
                      hidden={hidden}
                      onSugerirIA={() => onSugerirIA(l.ticker, l.falta, classeKey)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Fora do modelo — lista visual com cards
              Segmentos que JÁ aparecem nos tickers do modelo ganham um chip verde
              "✓ mesma categoria" pra sinalizar que é candidato natural a entrar. */}
          {analise.foraDoModelo.length > 0 && (() => {
            // Set de segmentos presentes no modelo (pra detectar overlap)
            const segmentosNoModelo = new Set(
              (classeConfig.tickers || [])
                .map(t => (t.segmento || "").trim().toLowerCase())
                .filter(Boolean)
            );
            return (
            <div style={{ marginTop: 14 }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                fontSize: 11, color: T.ink, letterSpacing: ".08em", textTransform: "uppercase",
                fontWeight: 700, marginBottom: 6,
                paddingBottom: 4, borderBottom: `1px solid ${T.border}`,
              }}>
                <span>
                  <AlertCircle size={11} className="inline mr-1" />
                  Ativos seus FORA do modelo ({analise.foraDoModelo.length})
                </span>
                <span style={{ color: T.muted, fontSize: 10.5, fontWeight: 500, letterSpacing: 0, textTransform: "none" }}>
                  Total: {hidden ? "•••" : fmt(analise.foraDoModelo.reduce((s, f) => s + f.valor, 0))}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {analise.foraDoModelo.map(f => {
                  const segNorm = (f.segmento || "").trim().toLowerCase();
                  const mesmaCategoria = segNorm && segmentosNoModelo.has(segNorm);
                  const barraCor = mesmaCategoria ? T.green : T.ink;
                  return (
                  <div key={f.ticker} style={{
                    background: T.bgSoft, border: `1px solid ${T.border}`,
                    borderLeft: `3px solid ${barraCor}`,
                    borderRadius: 14, padding: "9px 12px",
                    display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center",
                  }}>
                    <div style={{
                      padding: "4px 9px", background: `${T.ink}1a`, color: T.ink,
                      fontSize: 11, fontWeight: 700, borderRadius: 5, letterSpacing: ".03em",
                      minWidth: 64, textAlign: "center",
                    }}>
                      {f.ticker}
                    </div>
                    <div style={{ minWidth: 0, fontSize: 11, color: T.muted, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                      <span>{f.qtd} × {fmt(f.preco)}</span>
                      {f.segmento && (
                        <span style={{
                          padding: "1px 7px", borderRadius: 100,
                          background: mesmaCategoria ? `${T.green}22` : `${T.muted}1a`,
                          color: mesmaCategoria ? T.green : T.muted,
                          fontSize: 10, fontWeight: 600, letterSpacing: ".02em",
                        }}>
                          {mesmaCategoria && "✓ "}{f.segmento}
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <div className="num" style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
                        {hidden ? "•••" : fmt(f.valor)}
                      </div>
                      <div style={{ fontSize: 10, color: T.faint, marginTop: 1 }}>
                        {f.pctDaClasse.toFixed(1)}% da classe
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 10.5, color: T.muted, marginTop: 6, fontStyle: "italic" }}>
                💡 Esses ativos não estão previstos no modelo. Os marcados com <strong style={{ color: T.green }}>✓</strong> são da mesma categoria/segmento que algum ticker já no modelo — candidatos naturais.
              </div>
            </div>
            );
          })()}

          {/* Botão Adicionar/editar tickers — auto-duplica se for builtin */}
          <button onClick={onEditar}
                  style={{
                    marginTop: 14, width: "100%",
                    background: `${cor}11`, color: cor,
                    border: `1.5px dashed ${cor}88`, padding: "10px 12px",
                    fontSize: 12, fontWeight: 600, borderRadius: 14,
                    cursor: "pointer", letterSpacing: ".03em",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}>
            <Plus size={13} /> Adicionar / editar tickers desta classe
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TickerRow — uma linha de ticker dentro do segmento
   ============================================================ */
function TickerRow({ linha, cor, hidden, onSugerirIA }) {
  const { ticker, pctAlvoNoModelo, valorAtual, valorAlvo, falta, temNaCarteira, qtdAtual, precoAtual } = linha;
  const pctReal = valorAlvo > 0 ? Math.min(100, (valorAtual / valorAlvo) * 100) : 0;
  const noAlvo = valorAlvo > 0 && Math.abs(valorAtual - valorAlvo) <= valorAlvo * 0.05;
  const status = noAlvo ? T.green : falta > 0 ? T.red : "#fbbf24";

  return (
    <div style={{
      background: T.bgSoft, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${status}`,
      borderRadius: 14, padding: "9px 12px",
      display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 10, alignItems: "center",
    }}>
      <div style={{
        padding: "4px 9px", background: `${cor}22`, color: cor,
        fontSize: 11, fontWeight: 700, borderRadius: 5, letterSpacing: ".03em",
        minWidth: 64, textAlign: "center",
      }}>
        {ticker}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T.muted }}>
          <span>Alvo <strong style={{ color: T.ink }}>{pctAlvoNoModelo.toFixed(1)}%</strong></span>
          {temNaCarteira ? (
            <span>· Tem <strong style={{ color: T.ink }}>{qtdAtual}</strong> × {fmt(precoAtual)}</span>
          ) : (
            <span style={{ color: T.red, fontWeight: 600 }}>· Não tem na carteira</span>
          )}
        </div>
        {valorAlvo > 0 && (
          <div style={{ height: 4, background: T.border, borderRadius: 999, marginTop: 4, overflow: "hidden" }}>
            <div style={{ width: `${pctReal}%`, height: "100%", background: status, transition: "width .4s" }} />
          </div>
        )}
      </div>
      <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <div className="num" style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
          {hidden ? "•••" : fmt(valorAtual)}
        </div>
        {falta > 0.5 && (
          <div style={{ fontSize: 10, color: T.red, fontWeight: 600, marginTop: 1 }}>
            falta {hidden ? "•••" : fmt(falta)}
          </div>
        )}
        {noAlvo && (
          <div style={{ fontSize: 10, color: T.green, fontWeight: 600, marginTop: 1 }}>
            <CheckCircle2 size={9} className="inline mr-1" /> ok
          </div>
        )}
      </div>
      {falta > 0.5 ? (
        <button onClick={onSugerirIA}
                title={`Sugerir aporte em ${ticker} com IA`}
                style={{
                  background: T.gold, color: T.bg,
                  border: "none", padding: "5px 10px", borderRadius: 5,
                  fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
                }}>
          <Sparkles size={11} /> IA
        </button>
      ) : (
        <span style={{ width: 1 }} />
      )}
    </div>
  );
}

/* ============================================================
   EditarClasseModal — edita tickers e % de uma classe (só custom)
   ============================================================ */
function EditarClasseModal({ classeKey, classeConfig, onSalvar, onClose }) {
  const [tickers, setTickers] = useState(JSON.parse(JSON.stringify(classeConfig.tickers || [])));
  const [highlightIdx, setHighlightIdx] = useState(null);

  const adicionar = () => {
    // Insere no TOPO (visível) + highlight + scroll pra cima da lista
    setTickers([{ ticker: "", pct: 0, segmento: "", _novo: true }, ...tickers]);
    setHighlightIdx(0);
    setTimeout(() => {
      const el = document.getElementById("editar-classe-lista");
      if (el) el.scrollTop = 0;
      const input = document.getElementById("ticker-input-0");
      if (input) input.focus();
    }, 50);
  };

  const remover = (i) => {
    setTickers(tickers.filter((_, idx) => idx !== i));
  };

  const atualizar = (i, campo, valor) => {
    setTickers(tickers.map((t, idx) => idx === i ? { ...t, [campo]: valor } : t));
  };

  const somaPct = tickers.reduce((s, t) => s + (Number(t.pct) || 0), 0);

  const salvar = () => {
    const limpos = tickers
      .map(t => ({
        ...t,
        ticker: (t.ticker || "").trim().toUpperCase(),
        pct: Number(t.pct) || 0,
        segmento: (t.segmento || "").trim() || "Sem segmento",
      }))
      .filter(t => t.ticker);
    if (limpos.length === 0) { toast.error("Adicione ao menos 1 ticker."); return; }
    onSalvar({ ...classeConfig, tickers: limpos });
  };

  return (
    <Modal title={`Editar ${LABEL_CLASSE[classeKey] || classeKey}`} onClose={onClose} wide>
      <div style={{ marginBottom: 10, fontSize: 11.5, color: T.muted }}>
        Adicione/remova tickers e ajuste o % alvo de cada um.
        Soma atual: <strong style={{ color: Math.abs(somaPct - 100) < 0.5 ? T.green : T.red }} className="num">
          {somaPct.toFixed(1)}%
        </strong>
        {Math.abs(somaPct - 100) > 0.5 && <span style={{ color: T.red }}> (precisa ser 100%)</span>}
      </div>

      {/* Botão Adicionar EM CIMA da lista (mais visível) */}
      <button onClick={adicionar}
              style={{
                marginBottom: 10, width: "100%",
                background: T.gold, color: T.bg,
                border: "none", padding: "10px 14px",
                fontSize: 12, fontWeight: 700, borderRadius: 14,
                cursor: "pointer", letterSpacing: ".05em", textTransform: "uppercase",
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
        <Plus size={14} /> Adicionar Ticker
      </button>

      <div id="editar-classe-lista" style={{ maxHeight: 380, overflowY: "auto", marginBottom: 12 }}>
        {tickers.map((t, i) => {
          const isNew = highlightIdx === i || t._novo;
          return (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "1.2fr 0.6fr 1.5fr auto", gap: 6,
              padding: 6, marginBottom: 6,
              background: isNew ? `${T.gold}15` : T.bgSoft,
              border: isNew ? `1px solid ${T.gold}` : `1px solid transparent`,
              borderRadius: 11, alignItems: "center",
              transition: "background .3s, border .3s",
            }}>
              <input id={`ticker-input-${i}`}
                     value={t.ticker}
                     onChange={e => atualizar(i, "ticker", e.target.value.toUpperCase())}
                     placeholder="TICKER" style={{ fontSize: 12 }} />
              <input type="number" step="0.1" value={t.pct}
                     onChange={e => atualizar(i, "pct", e.target.value)}
                     placeholder="% alvo" style={{ fontSize: 12 }} />
              <input value={t.segmento || ""}
                     onChange={e => atualizar(i, "segmento", e.target.value)}
                     placeholder="Segmento / Setor" style={{ fontSize: 12 }} />
              <button onClick={() => remover(i)} style={iconBtn(T.red)}>
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
        {tickers.length === 0 && (
          <div style={{ textAlign: "center", padding: 24, color: T.muted, fontSize: 12, fontStyle: "italic" }}>
            Nenhum ticker. Clique em "Adicionar Ticker" acima.
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-end mt-4">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-gold" onClick={salvar}>Salvar classe</button>
      </div>
    </Modal>
  );
}

const iconBtn = (cor) => ({
  background: "transparent", border: "none", color: cor,
  cursor: "pointer", padding: 6, minHeight: 24,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  borderRadius: 4,
});
