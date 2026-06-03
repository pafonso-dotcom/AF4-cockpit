import React, { useState, useRef } from "react";
import { T } from "../../../lib/theme.js";
import { CLASSES, avaliarCriterio } from "../../../lib/criteriosIdV.js";
import { calcularScoreIdV } from "../../../lib/scoreIdV.js";
import { importarPlanilhaFII, importarPlanilhaAcoes, importarPlanilhaStock, importarPlanilhaReit } from "../../../lib/importarPlanilhaIdV.js";
import { toast } from "../../../lib/toast.js";
import { Plus, Trash2, Upload, Briefcase } from "lucide-react";

const COR = { bom: "#4A7B3A", aceitavel: "#C99A2E", ruim: "#A83A2E", vazio: "#B0A990" };
const IC  = { bom: "✅", aceitavel: "🟡", ruim: "❌", vazio: "⚪" };
const GRUPOS = {
  estrutura: "Estrutura", qualidade: "Qualidade", escala: "Escala", retorno: "Retorno",
  eliminatorio: "Eliminatórios", classificatorio: "Classificatórios",
  resultado: "Resultado", risco: "Risco", sociedade: "Sociedade",
};

export default function AnaliseIdV({ analises = [], setAnalises, ativos = [] }) {
  const [classeAtiva, setClasseAtiva] = useState("fii");
  const [novoTicker, setNovoTicker] = useState("");
  const [editId, setEditId] = useState(null);
  const [importarTodos, setImportarTodos] = useState(false);
  const fileRef = useRef(null);

  const classe = CLASSES.find(c => c.id === classeAtiva);
  const criterios = classe?.criterios || [];
  const analisesClasse = analises
    .filter(a => a.classe === classeAtiva)
    .map(a => ({ ...a, _sc: calcularScoreIdV(a, criterios) }))
    .sort((x, y) => y._sc.score - x._sc.score);

  function adicionar() {
    const tk = novoTicker.trim().toUpperCase();
    if (!tk) return;
    if (analises.find(a => a.ticker === tk && a.classe === classeAtiva)) { toast.error(`${tk} já existe.`); return; }
    const nova = { id: `idv-${Date.now()}`, classe: classeAtiva, ticker: tk, valores: {}, criadoEm: new Date().toISOString() };
    setAnalises([nova, ...analises]); setNovoTicker(""); setEditId(nova.id);
  }

  function importarCarteira() {
    const daClasse = ativos.filter(a => a.tipo === classeAtiva);
    if (daClasse.length === 0) { toast.error(`Nenhum ativo do tipo ${classe.label} na carteira.`); return; }
    const novos = daClasse
      .filter(a => !analises.find(an => an.ticker === (a.ticker || "").toUpperCase() && an.classe === classeAtiva))
      .map(a => ({ id: `idv-${Date.now()}-${a.ticker}`, classe: classeAtiva, ticker: (a.ticker || "").toUpperCase(), valores: {}, origem: "carteira", criadoEm: new Date().toISOString() }));
    if (novos.length === 0) { toast.error("Todos os ativos da carteira já foram adicionados."); return; }
    setAnalises([...novos, ...analises]);
    toast.success(`${novos.length} ativo(s) importado(s) da carteira.`);
  }

  async function importarPlanilha(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Roteia o parser conforme a classe ativa (mesma mecânica do FII).
      const PARSERS = {
        fii: importarPlanilhaFII, acao: importarPlanilhaAcoes,
        stock: importarPlanilhaStock, reit: importarPlanilhaReit,
      };
      const parser = PARSERS[classeAtiva];
      if (!parser) { toast.error("Importação de planilha não disponível pra esta classe."); return; }

      // Tickers da carteira (classe ativa)
      const tickersCarteira = new Set(
        ativos.filter(a => a.tipo === classeAtiva).map(a => (a.ticker || "").toUpperCase())
      );
      const filtro = importarTodos ? null : tickersCarteira;

      if (!importarTodos && tickersCarteira.size === 0) {
        toast.error(`Nenhum ativo ${classe.label} na carteira. Cadastre na aba Carteira ou marque 'incluir todos'.`);
        return;
      }

      const { analises: novas, ignoradosForaCarteira } = await parser(file, filtro);
      if (novas.length === 0) {
        toast.error(importarTodos
          ? `Nenhum ativo ${classe.label} válido na planilha.`
          : `Nenhum ativo ${classe.label} da sua carteira foi encontrado na planilha.`);
        return;
      }

      let atual = [...analises], add = 0, upd = 0;
      novas.forEach(nova => {
        const idx = atual.findIndex(a => a.ticker === nova.ticker && a.classe === classeAtiva);
        if (idx >= 0) { atual[idx] = { ...atual[idx], valores: { ...atual[idx].valores, ...nova.valores } }; upd++; }
        else { atual.unshift(nova); add++; }
      });
      setAnalises(atual);
      const msgIgnorados = ignoradosForaCarteira > 0 ? ` · ${ignoradosForaCarteira} fora da carteira ignorados` : "";
      toast.success(`${add} novos, ${upd} atualizados${msgIgnorados}.`);
    } catch (err) {
      toast.error("Erro ao ler planilha. Verifique o formato.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function atualizar(id, cid, v) {
    setAnalises(analises.map(a => a.id === id ? { ...a, valores: { ...a.valores, [cid]: v } } : a));
  }
  function remover(id) {
    setAnalises(analises.filter(a => a.id !== id));
    if (editId === id) setEditId(null);
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: T.faint, fontWeight: 600 }}>Investimentos · Análise IdV</div>
        <h1 style={{ fontFamily: T.serif, fontSize: 30, fontWeight: 400, marginTop: 4 }}>Análise <em style={{ color: T.gold }}>fundamentalista.</em></h1>
        <p style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>Metodologia Investidor de Verdade · preencha ou importe os critérios.</p>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {CLASSES.map(c => {
          const ativo = classeAtiva === c.id, disp = c.criterios.length > 0;
          return (
            <button key={c.id} onClick={() => disp && setClasseAtiva(c.id)} disabled={!disp}
              style={{ padding: "7px 14px", fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", borderRadius: 6,
                border: `1px solid ${ativo ? T.ink : T.border}`, background: ativo ? T.ink : T.card,
                color: ativo ? "#fff" : (disp ? T.muted : T.faint), cursor: disp ? "pointer" : "not-allowed", opacity: disp ? 1 : 0.5 }}>
              {c.icon} {c.label}{!disp && " (em breve)"}
            </button>
          );
        })}
      </div>

      {/* Ações: adicionar, importar carteira, importar planilha */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <input value={novoTicker} onChange={e => setNovoTicker(e.target.value)} onKeyDown={e => e.key === "Enter" && adicionar()}
          placeholder={`Ticker (ex: ${classeAtiva === "fii" ? "XPML11" : "ITSA4"})`}
          style={{ flex: 1, minWidth: 140, padding: "9px 12px", border: `1px solid ${T.border}`, borderRadius: 7, background: T.card, fontSize: 13, color: T.ink }} />
        <button onClick={adicionar} style={{ padding: "9px 14px", background: T.gold, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Adicionar</button>
        <button onClick={importarCarteira} style={{ padding: "9px 14px", background: T.card, color: T.ink, border: `1px solid ${T.border}`, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><Briefcase size={14} /> Importar da carteira</button>
        <button onClick={() => fileRef.current?.click()} style={{ padding: "9px 14px", background: T.green, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><Upload size={14} /> Importar planilha</button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={importarPlanilha} />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: T.muted, cursor: "pointer", marginLeft: 4 }}>
          <input type="checkbox" checked={importarTodos} onChange={e => setImportarTodos(e.target.checked)} style={{ width: 14, height: 14, accentColor: T.gold }} />
          Incluir ativos fora da carteira
        </label>
      </div>

      {analisesClasse.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: T.faint, fontSize: 13, fontStyle: "italic" }}>Nenhum ativo nesta classe. Adicione, importe da carteira ou da planilha.</div>
      ) : analisesClasse.map(analise => {
        const expandido = editId === analise.id;
        const sc = analise._sc;
        const grupos = [...new Set(criterios.map(c => c.grupo))];
        return (
          <div key={analise.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 10, overflow: "hidden" }}>
            <div onClick={() => setEditId(expandido ? null : analise.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", cursor: "pointer" }}>
              <div>
                <span style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{analise.ticker}</span>
                {analise.origem && <span style={{ fontSize: 9, padding: "1px 6px", background: T.bgSoft, color: T.muted, borderRadius: 3, marginLeft: 8, letterSpacing: ".05em" }}>{analise.origem}</span>}
                <span style={{ fontSize: 11, color: T.muted, marginLeft: 10 }}>{sc.preenchidos}/{sc.total} critérios</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginRight: 2 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                    <span style={{ fontFamily: T.serif, fontSize: 24, fontWeight: 600, color: sc.cor, lineHeight: 1 }}>
                      {sc.preenchidos > 0 ? sc.score : "—"}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: sc.cor, letterSpacing: ".05em" }}>{sc.badge}</span>
                  </div>
                  {sc.parcial && sc.preenchidos > 0 && (
                    <span style={{ fontSize: 9, color: T.faint }}>parcial · faltam {sc.faltam}</span>
                  )}
                </div>
                <span style={{ fontSize: 11, color: T.faint }}>{expandido ? "▲" : "▼"}</span>
                <button onClick={(e) => { e.stopPropagation(); remover(analise.id); }} style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer" }}><Trash2 size={15} /></button>
              </div>
            </div>
            <div style={{ height: 3, background: T.bgSoft }}>
              <div style={{ height: "100%", width: `${sc.preenchidos > 0 ? sc.score : 0}%`, background: sc.cor, transition: "width .3s" }} />
            </div>
            {expandido && (
              <div style={{ padding: "0 16px 16px" }}>
                {grupos.map(g => (
                  <div key={g}>
                    <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: T.faint, fontWeight: 700, margin: "12px 0 6px" }}>{GRUPOS[g] || g}</div>
                    {criterios.filter(c => c.grupo === g).map(c => {
                      const aval = avaliarCriterio(c, analise.valores[c.id]);
                      return (
                        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: T.bgSoft, borderRadius: 7, marginBottom: 4, borderLeft: `3px solid ${COR[aval]}` }}>
                          <span style={{ fontSize: 14 }}>{IC[aval]}</span>
                          <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: T.ink }}>{c.label} <span style={{ fontSize: 10, color: T.faint }}>· {c.hint}</span></span>
                          <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, fontWeight: 700, letterSpacing: ".05em",
                            background: c.fonte === "planilha" ? "rgba(74,123,58,.14)" : c.fonte === "auto" ? "rgba(58,92,138,.14)" : "rgba(186,117,23,.14)",
                            color: c.fonte === "planilha" ? "#4A7B3A" : c.fonte === "auto" ? "#3A5C8A" : "#BA7517" }}>
                            {c.fonte === "planilha" ? "PLANILHA" : c.fonte === "auto" ? "AUTO" : "MANUAL"}
                          </span>
                          {c.tipo === "opcao" ? (() => {
                            const valorAtual = analise.valores[c.id] || "";
                            const opcoesFinais = valorAtual && !c.opcoes.includes(valorAtual)
                              ? [valorAtual, ...c.opcoes]
                              : c.opcoes;
                            return (
                              <select value={valorAtual} onChange={e => atualizar(analise.id, c.id, e.target.value)} style={{ width: 150, padding: "4px 8px", fontSize: 11, border: `1px solid ${T.border}`, borderRadius: 5, background: T.card, color: T.ink }}>
                                <option value="">—</option>{opcoesFinais.map(o => <option key={o} value={o}>{o}</option>)}
                              </select>
                            );
                          })() : (
                            <input value={analise.valores[c.id] || ""} onChange={e => atualizar(analise.id, c.id, e.target.value)} placeholder={c.unidade || ""} style={{ width: 100, padding: "6px 8px", fontSize: 13, border: `1px solid ${T.border}`, borderRadius: 5, background: T.card, color: T.ink }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
