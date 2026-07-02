import React, { useState, useMemo } from "react";
import { RefreshCw, AlertCircle, Upload } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, uid } from "../../lib/format.js";
import { parseOFX, parseDataBR, parseValorBR, autoMapCSV, norm } from "../../lib/importExport.js";
import { marcarDuplicadas } from "../../lib/extratoParser.js";
import Papa from "papaparse";
import Field from "../ui/Field.jsx";
import { ordenarPorNome } from "../../lib/categoriaSort.js";

export default function ImportPanel({ transacoes, setTransacoes, contas, setContas, categorias, onDone }) {
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null); // { type, rows, headers? }
  const [mapping, setMapping] = useState({});
  const [defaultConta, setDefaultConta] = useState(contas[0]?.nome || "");
  const [defaultCategoria, setDefaultCategoria] = useState("");
  const [updateBalances, setUpdateBalances] = useState(true);
  const [pularDuplicados, setPularDuplicados] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (f) => {
    setError(null); setParsed(null); setFile(f);
    if (!f) return;
    setBusy(true);
    try {
      const text = await f.text();
      const isOFX = /\.ofx$/i.test(f.name) || /<OFX>|<STMTTRN>/i.test(text);
      if (isOFX) {
        const rows = parseOFX(text);
        if (!rows.length) throw new Error("Nenhuma transação encontrada no OFX.");
        setParsed({ type: "ofx", rows });
      } else {
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        if (!result.data.length) throw new Error("CSV vazio ou inválido.");
        const headers = result.meta.fields || Object.keys(result.data[0]);
        const auto = autoMapCSV(headers);
        setMapping(auto);
        setParsed({ type: "csv", rows: result.data, headers });
      }
    } catch (e) {
      setError(e.message || "Erro ao ler arquivo.");
    }
    setBusy(false);
  };

  const previewRows = useMemo(() => {
    if (!parsed) return [];
    if (parsed.type === "ofx") return parsed.rows.slice(0, 5);
    if (parsed.type === "csv") {
      return parsed.rows.slice(0, 5).map(r => ({
        data: parseDataBR(r[mapping.data]) || "—",
        valor: parseValorBR(r[mapping.valor]),
        descricao: r[mapping.descricao] || "—",
        tipo: mapping.tipo
          ? (norm(r[mapping.tipo]).match(/c|receita|credit|entrada/) ? "receita" : "despesa")
          : (parseValorBR(r[mapping.valor]) >= 0 ? "receita" : "despesa"),
        categoria: mapping.categoria ? r[mapping.categoria] : "",
      }));
    }
    return [];
  }, [parsed, mapping]);

  const buildFinalRows = () => {
    if (!parsed) return [];
    let rows;
    if (parsed.type === "ofx") {
      rows = parsed.rows.map(r => ({
        ...r,
        conta: defaultConta,
        categoria: r.categoria || defaultCategoria,
        compensado: true, // OFX vem do banco já compensado
        obs: "",
      }));
    } else {
      rows = parsed.rows
        .map(r => {
          const data = parseDataBR(r[mapping.data]);
          const rawVal = parseValorBR(r[mapping.valor]);
          const tipo = mapping.tipo
            ? (norm(r[mapping.tipo]).match(/c|receita|credit|entrada/) ? "receita" : "despesa")
            : (rawVal >= 0 ? "receita" : "despesa");
          const desc = r[mapping.descricao] || "Importado";
          if (!data || isNaN(rawVal) || rawVal === 0) return null;
          return {
            data,
            valor: Math.abs(rawVal),
            tipo,
            descricao: String(desc).trim(),
            categoria: (mapping.categoria && r[mapping.categoria]) || defaultCategoria,
            conta: defaultConta,
            compensado: true,
            obs: "",
          };
        })
        .filter(Boolean);
    }
    return rows;
  };

  const importNow = () => {
    const rows = buildFinalRows();
    if (rows.length === 0) { setError("Nenhuma linha válida para importar."); return; }
    const marcadas = marcarDuplicadas(rows, transacoes);
    const finais = pularDuplicados ? marcadas.filter(r => !r._duplicada) : marcadas;
    if (finais.length === 0) {
      setError("Todas as linhas já existem nos lançamentos — nada a importar.");
      return;
    }
    // Remove o marcador interno antes de salvar.
    const newTrans = finais.map(({ _duplicada, ...r }) => ({ ...r, id: uid() }));
    setTransacoes([...transacoes, ...newTrans]);

    if (updateBalances) {
      const deltas = {};
      newTrans.forEach(t => {
        if (!t.conta) return;
        const d = t.tipo === "receita" ? Number(t.valor) : -Number(t.valor);
        deltas[t.conta] = (deltas[t.conta] || 0) + d;
      });
      setContas(contas.map(c => deltas[c.nome] != null ? { ...c, saldo: c.saldo + deltas[c.nome] } : c));
    }
    onDone();
  };

  // Contagens de duplicidade (para resumo e botão).
  const rowsMarcadas = parsed ? marcarDuplicadas(buildFinalRows(), transacoes) : [];
  const qtdDuplicados = rowsMarcadas.filter(r => r._duplicada).length;
  const qtdImportar = pularDuplicados ? rowsMarcadas.length - qtdDuplicados : rowsMarcadas.length;

  return (
    <div>
      {/* File picker */}
      <div style={{ background: T.bgSoft, border: `1px dashed ${T.border}`, padding: 28, textAlign: "center", marginBottom: 16 }}>
        <Upload size={28} style={{ color: T.gold, margin: "0 auto 10px" }} />
        <div style={{ fontFamily: T.serif, fontSize: 18, color: T.ink, marginBottom: 4 }}>
          Selecione um arquivo .csv ou .ofx
        </div>
        <div style={{ color: T.muted, fontSize: 13, fontStyle: "italic", marginBottom: 14 }}>
          Suporta extratos de Itaú, Nubank, BB, Inter, Santander e formatos genéricos.
        </div>
        <label style={{
          display: "inline-block", padding: "10px 20px", background: T.gold, color: T.bg,
          fontFamily: T.sans, fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase",
          fontWeight: 600, cursor: "pointer",
        }}>
          Escolher arquivo
          <input type="file" accept=".csv,.ofx,.txt" style={{ display: "none" }}
                 onChange={e => handleFile(e.target.files?.[0])} />
        </label>
        {file && <div className="num text-xs mt-3" style={{ color: T.muted }}>{file.name}</div>}
      </div>

      {error && (
        <div style={{ background: `${T.red}22`, border: `1px solid ${T.red}55`, padding: 12, marginBottom: 16,
                      display: "flex", gap: 8, alignItems: "flex-start", color: T.red, fontSize: 13 }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>{error}</div>
        </div>
      )}

      {busy && (
        <div className="flex items-center gap-2" style={{ color: T.gold, fontSize: 13 }}>
          <RefreshCw size={14} className="spin" /> Lendo arquivo…
        </div>
      )}

      {parsed && parsed.type === "csv" && (
        <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, padding: 16, marginBottom: 16 }}>
          <div className="label-eyebrow mb-3">Mapeamento de colunas</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "data", label: "Data", required: true },
              { key: "valor", label: "Valor", required: true },
              { key: "descricao", label: "Descrição", required: true },
              { key: "tipo", label: "Tipo (opcional)", required: false },
              { key: "categoria", label: "Categoria (opcional)", required: false },
            ].map(f => (
              <Field key={f.key} label={f.label}>
                <select value={mapping[f.key] || ""} onChange={e => setMapping({ ...mapping, [f.key]: e.target.value })}>
                  <option value="">— nenhuma —</option>
                  {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>
            ))}
          </div>
        </div>
      )}

      {parsed && (
        <>
          {/* Defaults */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <Field label="Conta de destino">
              <select value={defaultConta} onChange={e => setDefaultConta(e.target.value)}>
                {contas.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
            </Field>
            <Field label="Categoria padrão (opcional)">
              <select value={defaultCategoria} onChange={e => setDefaultCategoria(e.target.value)}>
                <option value="">— sem categoria —</option>
                {ordenarPorNome(categorias).map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
            </Field>
          </div>

          <label className="flex items-center gap-2 mb-3 cursor-pointer">
            <input type="checkbox" checked={updateBalances} onChange={e => setUpdateBalances(e.target.checked)}
                   style={{ width: 16, height: 16, accentColor: T.gold }} />
            <span style={{ color: T.ink, fontSize: 14 }}>
              Atualizar saldo da conta com base nas transações importadas
            </span>
          </label>

          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input type="checkbox" checked={pularDuplicados} onChange={e => setPularDuplicados(e.target.checked)}
                   style={{ width: 16, height: 16, accentColor: T.gold }} />
            <span style={{ color: T.ink, fontSize: 14 }}>
              Pular lançamentos duplicados (que já existem nos lançamentos)
            </span>
          </label>

          {/* Preview */}
          <div className="label-eyebrow mb-2">Pré-visualização · primeiras 5 linhas</div>
          <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, padding: 0, marginBottom: 16,
                        overflowX: "auto", fontSize: 12 }}>
            <table className="w-full" style={{ minWidth: 500 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["Data", "Tipo", "Descrição", "Valor"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", color: T.muted, fontFamily: T.sans,
                                          fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase",
                                          textAlign: h === "Valor" ? "right" : "left", fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td className="num" style={{ padding: "8px 10px", color: T.muted }}>{r.data}</td>
                    <td style={{ padding: "8px 10px", color: r.tipo === "receita" ? T.green : T.red,
                                 fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>{r.tipo}</td>
                    <td style={{ padding: "8px 10px", color: T.ink, maxWidth: 240, overflow: "hidden",
                                 textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.descricao}</td>
                    <td className="num" style={{ padding: "8px 10px", textAlign: "right",
                                                  color: r.tipo === "receita" ? T.green : T.red }}>
                      {fmt(r.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ color: T.muted, fontSize: 12, fontStyle: "italic", marginBottom: 16 }}>
            Total de linhas detectadas: <strong style={{ color: T.gold }}>{parsed.rows.length}</strong>
            {" · "}fonte: <strong style={{ color: T.gold }}>{parsed.type.toUpperCase()}</strong>
            {qtdDuplicados > 0 && (
              <span style={{ color: T.yellow || "#f59e0b", fontStyle: "normal" }}>
                {" · "}⚠ {qtdDuplicados} {qtdDuplicados === 1 ? "duplicado" : "duplicados"}{" "}
                {pularDuplicados ? "serão ignorados" : "serão importados mesmo assim"}
              </span>
            )}
          </div>

          <div className="flex gap-3">
            <button className="btn-gold" onClick={importNow}>
              Importar {qtdImportar} {qtdImportar === 1 ? "transação" : "transações"}
            </button>
            <button className="btn-ghost" onClick={() => { setParsed(null); setFile(null); setError(null); }}>
              Cancelar
            </button>
          </div>
        </>
      )}
    </div>
  );
}

