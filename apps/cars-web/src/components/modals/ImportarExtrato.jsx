import React, { useState, useRef } from "react";
import { Upload, AlertCircle, Loader2 } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, uid } from "../../lib/format.js";
import { parseExtrato, marcarDuplicadas } from "../../lib/extratoParser.js";
import { gerarJSONGeminiComPDF, fileToBase64 } from "../../lib/gemini.js";
import { toast } from "../../lib/toast.js";
import { audit } from "../../lib/auditLog.js";
import { ordenarPorNome } from "../../lib/categoriaSort.js";
import Modal from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";

// Extrai transações de um extrato em PDF usando o Gemini.
// Devolve o mesmo formato de parseExtrato: { banco, transacoes, erro }.
async function parseExtratoPDFFile(file) {
  const key = (typeof localStorage !== "undefined" && localStorage.getItem("af4:gemini-key")) || "";
  if (!key.trim()) {
    return { erro: "Para importar PDF é preciso configurar a chave do Gemini em ⚙ Configurações → Inteligência Artificial. Como alternativa, envie o arquivo OFX ou CSV do banco." };
  }
  try {
    const base64 = await fileToBase64(file);
    if (!base64 || base64.length < 100) return { erro: "PDF aparentemente vazio. Tente outro arquivo." };
    const prompt = `Você é um leitor de extratos bancários. Extraia TODAS as transações deste PDF de extrato.
Para cada transação:
- data: ISO YYYY-MM-DD
- descricao: descrição como aparece no extrato (máx 80 chars)
- valor: número positivo, em reais, sem sinal
- tipo: "receita" para créditos/entradas/depósitos, "despesa" para débitos/saídas/pagamentos

Retorne EXATAMENTE este JSON (sem markdown):
{
  "banco": "Nome do banco identificado (Itaú, Nubank, Bradesco, etc.) ou 'PDF' se não conseguir identificar.",
  "transacoes": [
    { "data": "2024-01-15", "descricao": "Mercado XYZ", "valor": 150.00, "tipo": "despesa" }
  ]
}

Importante: não inclua linhas de saldo, total, juros aplicados, taxas que sejam só informativas, nem linhas vazias — somente transações reais com data e valor.`;
    const data = await gerarJSONGeminiComPDF(prompt, base64);
    const lista = Array.isArray(data?.transacoes) ? data.transacoes : [];
    const transacoes = lista
      .filter(t => t && t.data && t.valor != null)
      .map(t => ({
        _id: uid(),
        data: String(t.data).slice(0, 10),
        descricao: String(t.descricao || "Lançamento").slice(0, 200),
        valor: Math.abs(Number(t.valor) || 0),
        tipo: t.tipo === "receita" ? "receita" : "despesa",
        categoria: "Outros",
        subcategoria: null,
      }))
      .filter(t => t.valor > 0);
    if (transacoes.length === 0) {
      return { erro: "Nenhuma transação encontrada no PDF. Tente o arquivo OFX/CSV exportado direto do banco." };
    }
    return { banco: data?.banco || "PDF", transacoes };
  } catch (e) {
    return { erro: `Erro ao analisar PDF: ${e.message}` };
  }
}

/**
 * Modal de importação de extratos OFX/CSV/PDF.
 * Fluxo: arquivo → (IA, se PDF) → preview → revisar categorias → confirmar.
 */
export default function ImportarExtrato({
  contas, categorias,
  transacoes, setTransacoes,
  onClose,
}) {
  const [step, setStep] = useState("upload"); // upload | preview
  const [parsed, setParsed] = useState(null); // { transacoes, banco }
  const [contaDestino, setContaDestino] = useState(contas?.[0]?.nome || "");
  const [selecionadas, setSelecionadas] = useState(new Set());
  const [edicoes, setEdicoes] = useState({}); // { _id: { categoria, ... } }
  const [erro, setErro] = useState("");
  const [parsing, setParsing] = useState(false); // true enquanto a IA processa o PDF
  const fileRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    setErro("");
    setParsing(true);
    try {
      const result = isPdf
        ? await parseExtratoPDFFile(file)
        : parseExtrato(await file.text(), file.name);
      if (result.erro) { setErro(result.erro); return; }
      if (!result.transacoes || result.transacoes.length === 0) {
        setErro("Nenhuma transação encontrada no arquivo.");
        return;
      }
      // Identifica lançamentos que já existem (mesma data/valor/tipo/descrição)
      // ou repetidos dentro do próprio arquivo, para não duplicar.
      const transMarcadas = marcarDuplicadas(result.transacoes, transacoes);
      setParsed({ ...result, transacoes: transMarcadas });
      // Por padrão, marca só as que NÃO são duplicadas.
      setSelecionadas(new Set(transMarcadas.filter(t => !t._duplicada).map(t => t._id)));
      setStep("preview");
    } catch (err) {
      setErro(`Erro ao ler arquivo: ${err.message}`);
    } finally {
      setParsing(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };

  const toggleSel = (id) => {
    const next = new Set(selecionadas);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelecionadas(next);
  };

  const updateLinha = (id, campo, valor) => {
    setEdicoes(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));
  };

  const confirmar = () => {
    if (!contaDestino) {
      toast.error("Selecione a conta de destino.");
      return;
    }
    if (selecionadas.size === 0) {
      toast.error("Selecione pelo menos 1 transação.");
      return;
    }

    const novas = parsed.transacoes
      .filter(t => selecionadas.has(t._id))
      .map(t => {
        const edits = edicoes[t._id] || {};
        return {
          id: uid(),
          descricao: edits.descricao ?? t.descricao,
          categoria: edits.categoria ?? t.categoria,
          subcategoria: edits.subcategoria ?? t.subcategoria ?? null,
          tipo: edits.tipo ?? t.tipo,
          conta: contaDestino,
          data: t.data,
          valor: t.valor,
          compensado: true,
          fixa: false,
          obs: `Importado de extrato ${parsed.banco}`,
        };
      });

    setTransacoes([...novas, ...transacoes]);
    audit.system(`Importou ${novas.length} transações de ${parsed.banco}`, {
      banco: parsed.banco,
      conta: contaDestino,
      qtd: novas.length,
    });
    toast.success(`✓ ${novas.length} transações importadas com sucesso!`);
    onClose();
  };

  // ===== UPLOAD STEP =====
  if (step === "upload") {
    return (
      <Modal title="Importar extrato bancário" onClose={onClose} wide>
        <p style={{ fontSize: 13, color: T.muted, marginBottom: 18, lineHeight: 1.6 }}>
          Arraste o arquivo do banco aqui ou clique para selecionar. Aceito: <strong style={{ color: T.gold }}>.OFX</strong>, <strong style={{ color: T.gold }}>.CSV</strong> e <strong style={{ color: T.gold }}>.PDF</strong> (PDF é lido por IA).
          As transações serão categorizadas automaticamente.
        </p>

        {parsing ? (
          <div style={{
            border: `2px dashed ${T.gold}`, borderRadius: 18,
            padding: "40px 20px", textAlign: "center",
            background: T.bgSoft,
          }}>
            <Loader2 size={36} style={{ color: T.gold, marginBottom: 10, animation: "spin 1s linear infinite" }} />
            <div style={{ fontSize: 15, color: T.ink, marginBottom: 6 }}>
              Analisando arquivo com IA…
            </div>
            <div style={{ fontSize: 12, color: T.muted }}>
              Isso pode levar alguns segundos.
            </div>
          </div>
        ) : (
        <div onDrop={onDrop} onDragOver={onDragOver}
             onClick={() => fileRef.current?.click()}
             style={{
               border: `2px dashed ${T.border}`, borderRadius: 18,
               padding: "40px 20px", textAlign: "center", cursor: "pointer",
               background: T.bgSoft, transition: "all .2s",
             }}
             onMouseEnter={e => e.currentTarget.style.borderColor = T.gold}
             onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
          <Upload size={36} style={{ color: T.muted, marginBottom: 10 }} />
          <div style={{ fontSize: 15, color: T.ink, marginBottom: 6 }}>
            Arraste o extrato aqui
          </div>
          <div style={{ fontSize: 12, color: T.muted }}>
            ou <strong style={{ color: T.gold }}>clique para selecionar</strong>
          </div>
          <div style={{ fontSize: 10.5, color: T.faint, marginTop: 10, letterSpacing: ".05em" }}>
            Itaú · Nubank · Bradesco · Santander · BB · Inter · C6 · Genérico
          </div>
        </div>
        )}
        <input ref={fileRef} type="file" accept=".ofx,.csv,.txt,.pdf,application/pdf"
               style={{ display: "none" }}
               onChange={e => handleFile(e.target.files?.[0])} />

        {erro && (
          <div style={{
            marginTop: 14, padding: 10,
            background: `${T.red}22`, color: T.red,
            border: `1px solid ${T.red}`,
            borderRadius: 11, fontSize: 12,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <AlertCircle size={14} /> {erro}
          </div>
        )}

        <div style={{ marginTop: 18, padding: 12, background: T.bgSoft, borderRadius: 11, fontSize: 11, color: T.muted, lineHeight: 1.6 }}>
          <strong style={{ color: T.gold }}>Como funciona:</strong>
          <ol style={{ margin: "6px 0 0 18px", padding: 0 }}>
            <li>Sistema lê e detecta automaticamente o banco</li>
            <li>Sugere categoria por palavra-chave (Mercado→Alimentação, Uber→Transporte, etc)</li>
            <li>Você revisa, edita e desmarca o que não quiser importar</li>
            <li>Confirma e tudo é criado em lote na conta escolhida</li>
          </ol>
        </div>
      </Modal>
    );
  }

  // ===== PREVIEW STEP =====
  const total = parsed.transacoes
    .filter(t => selecionadas.has(t._id))
    .reduce((s, t) => s + (t.tipo === "receita" ? t.valor : -t.valor), 0);
  const qtdDuplicadas = parsed.transacoes.filter(t => t._duplicada).length;

  return (
    <Modal title={`Revisar · ${parsed.transacoes.length} transações encontradas (${parsed.banco})`} onClose={onClose} wide>
      <div style={{ marginBottom: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
        <Field label="Conta de destino *">
          <select value={contaDestino} onChange={e => setContaDestino(e.target.value)}>
            <option value="">— Escolher conta —</option>
            {contas.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
        </Field>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted, marginBottom: 3 }}>
            Saldo das selecionadas
          </div>
          <div className="num" style={{ fontSize: 18, color: total >= 0 ? T.green : T.red, fontWeight: 500 }}>
            {fmt(total)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn-ghost"
                  onClick={() => setSelecionadas(new Set(parsed.transacoes.map(t => t._id)))}>
            Marcar todas
          </button>
          <button className="btn-ghost"
                  onClick={() => setSelecionadas(new Set())}>
            Desmarcar todas
          </button>
        </div>
      </div>

      <div style={{ maxHeight: "50vh", overflowY: "auto", border: `1px solid ${T.border}`, borderRadius: 12 }}>
        {parsed.transacoes.map(t => {
          const edits = edicoes[t._id] || {};
          const sel = selecionadas.has(t._id);
          const cat = edits.categoria ?? t.categoria;
          return (
            <div key={t._id}
                 style={{
                   display: "grid",
                   gridTemplateColumns: "26px 60px 1fr 100px",
                   alignItems: "center", gap: 10,
                   padding: "8px 12px", borderBottom: `1px solid ${T.border}`,
                   opacity: sel ? 1 : 0.5,
                   background: sel ? "transparent" : T.bgSoft,
                 }}>
              <input type="checkbox" checked={sel} onChange={() => toggleSel(t._id)} />
              <div style={{ fontSize: 11, color: T.muted, whiteSpace: "nowrap" }}>
                {t.data.slice(8, 10) + "/" + t.data.slice(5, 7)}
              </div>
              <div style={{ minWidth: 0 }}>
                {t._duplicada && (
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 9, fontWeight: 700, letterSpacing: ".08em",
                    textTransform: "uppercase",
                    color: T.yellow || "#f59e0b",
                    background: `${T.yellow || "#f59e0b"}22`,
                    border: `1px solid ${T.yellow || "#f59e0b"}`,
                    borderRadius: 4, padding: "1px 5px", marginBottom: 3,
                  }}>
                    ⚠ Já lançada
                  </div>
                )}
                <input type="text" value={edits.descricao ?? t.descricao}
                       onChange={e => updateLinha(t._id, "descricao", e.target.value)}
                       style={{ width: "100%", background: T.bgSoft, color: T.ink, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 12.5, padding: "4px 6px", outline: "none", minHeight: 26, WebkitAppearance: "none" }} />
                <select value={cat}
                        onChange={e => updateLinha(t._id, "categoria", e.target.value)}
                        style={{ width: "100%", marginTop: 3, background: T.bgSoft, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 11, padding: "3px 6px", cursor: "pointer", outline: "none" }}>
                  {ordenarPorNome(categorias.filter(c => c.tipo === t.tipo)).map(c => (
                    <option key={c.id} value={c.nome}>{c.nome}</option>
                  ))}
                  {!categorias.some(c => c.nome === cat) && (
                    <option value={cat}>{cat} (auto)</option>
                  )}
                </select>
              </div>
              <div className="num" style={{
                color: t.tipo === "receita" ? T.green : T.red,
                fontWeight: 600, fontSize: 13, whiteSpace: "nowrap",
                textAlign: "right",
              }}>
                {t.tipo === "receita" ? "+ " : "− "}{fmt(t.valor)}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14, padding: 10, background: T.bgSoft, borderRadius: 11, fontSize: 11, color: T.muted }}>
        <strong style={{ color: T.gold }}>{selecionadas.size}</strong> de {parsed.transacoes.length} marcadas para importar.
        {qtdDuplicadas > 0 && (
          <span style={{ color: T.yellow || "#f59e0b", marginLeft: 8 }}>
            ⚠ {qtdDuplicadas} {qtdDuplicadas === 1 ? "possível duplicata desmarcada" : "possíveis duplicatas desmarcadas"} (já existem nos lançamentos).
          </span>
        )}
      </div>

      <div className="flex gap-3 mt-6">
        <button className="btn-gold" onClick={confirmar}>
          ✓ Importar {selecionadas.size} {selecionadas.size === 1 ? "transação" : "transações"}
        </button>
        <button className="btn-ghost" onClick={() => { setStep("upload"); setParsed(null); setSelecionadas(new Set()); }}>
          ← Voltar
        </button>
        <button className="btn-ghost" onClick={onClose} style={{ marginLeft: "auto" }}>
          Cancelar
        </button>
      </div>
    </Modal>
  );
}
