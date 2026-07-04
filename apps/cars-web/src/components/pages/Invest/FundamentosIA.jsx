import React, { useMemo, useState, useCallback } from "react";
import { Award, Pencil, Plus, X, Sparkles, Trash2, BookOpen, Database } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { toast } from "../../../lib/toast.js";
import { CRITERIOS_FII, CRITERIOS_ACOES, CRITERIOS_STOCK, CRITERIOS_REIT } from "../../../lib/criteriosIdV.js";
import { getFundamentosBrapi } from "../../../lib/brapi.js";
import { mapearFundamentosBrapi } from "../../../lib/fundamentosBrapi.js";
import {
  classificar, classeDoAtivo, carregarFundamentos, salvarFundamento,
  removerFundamento, analisarComIA, carregarMetodologia, salvarMetodologia,
} from "../../../lib/fundamentosLocal.js";

const CRIT = { fii: CRITERIOS_FII, acao: CRITERIOS_ACOES, stock: CRITERIOS_STOCK, reit: CRITERIOS_REIT };
const CLASSES = [
  { id: "fii", label: "FIIs" }, { id: "acao", label: "Ações BR" },
  { id: "stock", label: "Stocks US" }, { id: "reit", label: "REITs" },
];

/**
 * Fundamentos (IA) — classificação automática dos ativos a partir da base
 * pessoal (curadoria local) + "Analisar com IA" que preenche os indicadores
 * via Gemini (chave do navegador). Tudo fica salvo só no seu app.
 */
export default function FundamentosIA({ ativos = [] }) {
  const [classe, setClasse] = useState("fii");
  const [fundamentos, setFundamentos] = useState(() => carregarFundamentos());
  const [edit, setEdit] = useState(null); // { ticker, classe, nome, dados }

  const recarregar = useCallback(() => setFundamentos(carregarFundamentos()), []);

  // Lista: tickers da base pessoal da classe + os da carteira do usuário.
  const linhas = useMemo(() => {
    const tickers = new Set();
    Object.values(fundamentos).forEach(f => { if ((f.classe || "fii") === classe) tickers.add(String(f.ticker).toUpperCase()); });
    ativos.forEach(a => { if (classeDoAtivo(a.tipo) === classe) tickers.add(String(a.ticker).toUpperCase()); });
    const arr = [...tickers].map(tk => {
      const naCarteira = ativos.find(a => String(a.ticker).toUpperCase() === tk);
      const c = classificar({ ticker: tk, tipo: classe }, fundamentos);
      const naBase = !!fundamentos[tk];
      return { ticker: tk, naCarteira: !!naCarteira, naBase, classif: c };
    });
    arr.sort((a, b) => (b.classif?.score ?? -1) - (a.classif?.score ?? -1));
    return arr;
  }, [fundamentos, ativos, classe]);

  const abrirEdicao = (ticker) => {
    const reg = fundamentos[ticker?.toUpperCase()];
    setEdit({ ticker: ticker || "", classe, nome: reg?.nome || "", dados: { ...(reg?.dados || {}) } });
  };

  const excluir = (ticker) => {
    if (!window.confirm(`Remover ${ticker} da sua base de fundamentos?`)) return;
    removerFundamento(ticker);
    recarregar();
    toast.success(`${ticker} removido.`);
  };

  return (
    <div className="fade-up" style={{ maxWidth: 1000, margin: "0 auto" }}>
      <MetodologiaEditor />

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, marginTop: 24, flexWrap: "wrap" }}>
        <Award size={20} style={{ color: T.gold }} />
        <h2 style={{ fontFamily: T.serif, fontSize: 22, color: T.ink, fontWeight: 600 }}>Análise dos ativos</h2>
        <button onClick={() => abrirEdicao("")} style={{ marginLeft: "auto", ...btnGold() }}>
          <Plus size={14} style={{ display: "inline", marginRight: 4 }} /> Cadastrar ativo
        </button>
      </div>
      <p style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>
        Nota + recomendação automáticas pela metodologia. Use <strong style={{ color: T.gold }}>Analisar com IA</strong> pra
        preencher os indicadores de um ativo na hora.
      </p>

      {/* Abas de classe */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {CLASSES.map(c => (
          <button key={c.id} onClick={() => setClasse(c.id)}
            style={{
              padding: "5px 14px", borderRadius: 100, fontSize: 12, cursor: "pointer",
              border: `1px solid ${classe === c.id ? T.gold : T.border}`,
              background: classe === c.id ? `${T.gold}22` : "transparent",
              color: classe === c.id ? T.gold : T.muted, fontWeight: classe === c.id ? 600 : 400,
            }}>{c.label}</button>
        ))}
      </div>

      {linhas.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: T.muted, fontStyle: "italic", border: `1px dashed ${T.border}`, borderRadius: 18, background: T.card }}>
          Nenhum ativo dessa classe ainda. Cadastre um ativo e clique em "Analisar com IA".
        </div>
      ) : (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: T.bgSoft }}>
                  <th style={th("left")}>Ativo</th>
                  <th style={th("center")}>Nota</th>
                  <th style={th("center")}>Selo</th>
                  <th style={th("center")}>Recomendação</th>
                  <th style={th("center")}>Na carteira</th>
                  <th style={th("center")}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => (
                  <tr key={l.ticker} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={{ ...td(), color: T.ink, fontWeight: 600 }}>{l.ticker}</td>
                    <td style={{ ...td(), textAlign: "center" }} className="num">
                      {l.classif && l.classif.preenchidos ? `${l.classif.score}` : "—"}
                    </td>
                    <td style={{ ...td(), textAlign: "center" }}>
                      {l.classif && l.classif.preenchidos
                        ? <Selo cor={l.classif.cor} texto={l.classif.badge} />
                        : <span style={{ color: T.faint, fontSize: 11 }}>sem dados</span>}
                    </td>
                    <td style={{ ...td(), textAlign: "center" }}>
                      {l.classif && l.classif.preenchidos
                        ? <span style={{ color: l.classif.recCor, fontWeight: 600, fontSize: 12 }}>{l.classif.recomendacao}</span>
                        : "—"}
                    </td>
                    <td style={{ ...td(), textAlign: "center" }}>{l.naCarteira ? "✅" : "—"}</td>
                    <td style={{ ...td(), textAlign: "center", whiteSpace: "nowrap" }}>
                      <button onClick={() => abrirEdicao(l.ticker)} title="Editar / Analisar"
                              style={{ background: "transparent", border: "none", color: T.gold, cursor: "pointer", marginRight: 6 }}>
                        <Pencil size={14} />
                      </button>
                      {l.naBase && (
                        <button onClick={() => excluir(l.ticker)} title="Remover da base"
                                style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer" }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 10.5, color: T.faint, fontStyle: "italic" }}>
        A IA faz estimativas a partir do que conhece — revise os valores. Ferramenta educacional, não recomendação de investimento.
      </div>

      {edit && (
        <EditarFundamento edit={edit} setEdit={setEdit} onMudou={recarregar} />
      )}
    </div>
  );
}

/* ---------- Editor de metodologia (por classe) ---------- */
function MetodologiaEditor() {
  const [classe, setClasse] = useState("fii");
  const [texto, setTexto] = useState(() => carregarMetodologia("fii"));
  const [aberto, setAberto] = useState(false);

  const trocar = (c) => { setClasse(c); setTexto(carregarMetodologia(c)); };
  const salvar = () => { salvarMetodologia(classe, texto); toast.success("Metodologia salva."); };

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16 }}>
      <button onClick={() => setAberto(a => !a)}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "transparent", border: "none", cursor: "pointer", color: T.ink, textAlign: "left" }}>
        <BookOpen size={18} style={{ color: T.gold }} />
        <span style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 600 }}>Metodologia & critérios (guia da IA)</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: T.muted }}>{aberto ? "ocultar" : "editar"}</span>
      </button>

      {aberto && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>
            Escreva como você avalia cada classe (métricas, fundamentos, regras). A IA segue esse texto ao preencher os indicadores.
          </p>
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {CLASSES.map(c => (
              <button key={c.id} onClick={() => trocar(c.id)}
                style={{
                  padding: "5px 14px", borderRadius: 100, fontSize: 12, cursor: "pointer",
                  border: `1px solid ${classe === c.id ? T.gold : T.border}`,
                  background: classe === c.id ? `${T.gold}22` : "transparent",
                  color: classe === c.id ? T.gold : T.muted, fontWeight: classe === c.id ? 600 : 400,
                }}>{c.label}</button>
            ))}
          </div>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={7}
            placeholder={"Ex.: Priorizo FIIs de tijolo com DY ≥ 8%, vacância < 10%, P/VP entre 0,8 e 1,1, e bom histórico de gestão…"}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.bgSoft, color: T.ink, fontSize: 13, resize: "vertical", lineHeight: 1.5 }} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button onClick={salvar} style={btnGold()}>Salvar metodologia</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Modal: cadastrar / editar / analisar ---------- */
function EditarFundamento({ edit, setEdit, onMudou }) {
  const criterios = CRIT[edit.classe] || [];
  const [salvando, setSalvando] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [buscandoBrapi, setBuscandoBrapi] = useState(false);
  const set = (k, v) => setEdit(e => ({ ...e, [k]: v }));
  const setDado = (id, v) => setEdit(e => ({ ...e, dados: { ...e.dados, [id]: v } }));

  // Dados OFICIAIS da brapi — sobrescrevem os campos que a API traz (ROE,
  // margens, dívida/EBITDA, DY, PL, liquidez); o resto continua manual/IA.
  const buscarBrapi = async () => {
    const ticker = String(edit.ticker || "").toUpperCase().trim();
    if (!ticker) { toast.error("Informe o ticker antes de buscar."); return; }
    setBuscandoBrapi(true);
    try {
      const raw = await getFundamentosBrapi(ticker);
      const { dados, preenchidos } = mapearFundamentosBrapi(raw, edit.classe);
      if (!preenchidos) throw new Error("A brapi não devolveu fundamentos pra esse ticker (confira o ticker e se seu plano inclui os módulos fundamentalistas).");
      setEdit(e => ({ ...e, nome: e.nome || raw?.longName || raw?.shortName || "", dados: { ...e.dados, ...dados } }));
      toast.success(`${preenchidos} ${preenchidos === 1 ? "indicador oficial" : "indicadores oficiais"} da brapi preenchidos. Revise e salve.`);
    } catch (e) {
      toast.error(e.message || "Falha ao buscar na brapi.");
    } finally { setBuscandoBrapi(false); }
  };

  const analisar = async () => {
    const ticker = String(edit.ticker || "").toUpperCase().trim();
    if (!ticker) { toast.error("Informe o ticker antes de analisar."); return; }
    setAnalisando(true);
    try {
      const crit = criterios.map(c => ({ id: c.id, label: c.label, tipo: c.tipo, opcoes: c.opcoes }));
      const out = await analisarComIA({ ticker, classe: edit.classe, nome: edit.nome || ticker, criterios: crit });
      setEdit(e => ({ ...e, dados: { ...e.dados, ...(out.dados || {}) } }));
      toast.success(`IA analisou ${ticker}${out.resumo ? ` · ${out.resumo}` : ""}`);
      onMudou?.();
    } catch (e) {
      toast.error(e.message || "Falha na análise por IA.");
    } finally { setAnalisando(false); }
  };

  const salvar = () => {
    const ticker = String(edit.ticker || "").toUpperCase().trim();
    if (!ticker) { toast.error("Informe o ticker."); return; }
    setSalvando(true);
    try {
      salvarFundamento({ ticker, classe: edit.classe, nome: edit.nome || ticker, dados: edit.dados });
      toast.success(`${ticker} salvo na sua base.`);
      onMudou?.();
      setEdit(null);
    } catch (e) {
      toast.error(e.message || "Falha ao salvar.");
    } finally { setSalvando(false); }
  };

  return (
    <div onClick={() => setEdit(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 60, display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "85vh", overflow: "auto", background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Sparkles size={18} style={{ color: T.gold }} />
          <h3 style={{ fontFamily: T.serif, fontSize: 18, color: T.ink, fontWeight: 600 }}>
            {edit.ticker ? `Fundamentos · ${edit.ticker}` : "Cadastrar ativo"}
          </h3>
          <button onClick={() => setEdit(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: T.muted, cursor: "pointer" }}><X size={18} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <Campo label="Ticker">
            <input value={edit.ticker} onChange={e => set("ticker", e.target.value.toUpperCase())} placeholder="HGLG11" style={inp} />
          </Campo>
          <Campo label="Nome (opcional)">
            <input value={edit.nome} onChange={e => set("nome", e.target.value)} placeholder="CSHG Logística" style={inp} />
          </Campo>
        </div>

        <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 8 }}>
          Indicadores
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {criterios.map(c => (
            <Campo key={c.id} label={`${c.label}${c.unidade ? ` (${c.unidade})` : ""}`} hint={c.hint}>
              {c.tipo === "opcao" ? (
                <select value={edit.dados[c.id] || ""} onChange={e => setDado(c.id, e.target.value)} style={inp}>
                  <option value="">—</option>
                  {(c.opcoes || []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input value={edit.dados[c.id] ?? ""} onChange={e => setDado(c.id, e.target.value)}
                       inputMode={c.tipo === "texto" ? "text" : "decimal"} placeholder="—" style={inp} />
              )}
            </Campo>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={buscarBrapi} disabled={buscandoBrapi}
                    title="Preenche ROE, margens, dívida/EBITDA, DY, patrimônio e liquidez com os números OFICIAIS da brapi (requer plano com fundamentos)"
                    style={{ ...btnGhost(), borderColor: T.green, color: T.green, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Database size={14} /> {buscandoBrapi ? "Buscando…" : "Dados reais (brapi)"}
            </button>
            <button onClick={analisar} disabled={analisando}
                    title="A IA estima os indicadores que a brapi não traz (tag along, anos de lucro, segmento de listagem…)"
                    style={{ ...btnGhost(), borderColor: T.gold, color: T.gold, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={14} /> {analisando ? "Analisando…" : "Analisar com IA"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setEdit(null)} style={btnGhost()}>Cancelar</button>
            <button onClick={salvar} disabled={salvando} style={btnGold()}>{salvando ? "Salvando…" : "Salvar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Selo({ cor, texto }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 9px", borderRadius: 100, background: `${cor}22`, color: cor }}>{texto}</span>;
}
function Campo({ label, hint, children }) {
  return (
    <label style={{ display: "grid", gap: 3 }}>
      <span style={{ fontSize: 10.5, color: T.muted, fontWeight: 600 }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 9.5, color: T.faint }}>{hint}</span>}
    </label>
  );
}

const th = (a) => ({ padding: "9px 11px", textAlign: a, fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: T.muted, fontWeight: 600 });
const td = () => ({ padding: "9px 11px", verticalAlign: "middle" });
const inp = { padding: "8px 10px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.bgSoft, color: T.ink, fontSize: 13, width: "100%" };
const btnGold = () => ({ background: T.gold, color: "#1a1407", border: "none", padding: "9px 16px", borderRadius: 14, fontWeight: 700, fontSize: 13, cursor: "pointer" });
const btnGhost = () => ({ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, padding: "9px 16px", borderRadius: 14, fontSize: 13, cursor: "pointer" });
