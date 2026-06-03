import React, { useState, useMemo, useRef } from "react";
import { Activity, Sparkles, X, Trash2, Check, AlertCircle, CheckCircle2, Upload, FileText, ChevronLeft, Repeat, Plus, ScanLine, Loader2 } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, fmtN, uid, todayISO } from "../../lib/format.js";
import { gerarJSONGemini, gerarJSONGeminiComPDF, anonimizar, fetchComRetry, parseJSONTolerante } from "../../lib/gemini.js";
import { printHTML } from "../../lib/importExport.js";
import PageHeader from "../ui/PageHeader.jsx";
import PreviewImportarFaturaModal from "../modals/PreviewImportarFaturaModal.jsx";

export default function AnaliseFatura({
  categorias, setCategorias,
  transacoes, setTransacoes,
  contas, setContas,
  cartoes, setCartoes,
  fixas = [], setFixas,
  fixaOcorrencias = [], setFixaOcorrencias,
  parcelamentos = [], setParcelamentos,
  apiKeys, hidden,
}) {
  const [previewAberto, setPreviewAberto] = useState(false);
  const [analiseRaw, setAnaliseRaw] = useState(null); // resposta crua do Gemini
  const [stage, setStage] = useState("upload"); // upload | analyzing | results
  const [mode, setMode] = useState("upload"); // upload | paste | manual
  const [file, setFile] = useState(null);
  const [pastedText, setPastedText] = useState("");
  const [manualRows, setManualRows] = useState([
    { id: uid(), data: todayISO(), descricao: "", valor: "", categoria_sugerida: "Outros", fixa: false },
  ]);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [imported, setImported] = useState(false);
  const [destConta, setDestConta] = useState(contas[0]?.nome || "");
  const [destCartao, setDestCartao] = useState(cartoes[0]?.nome || "");
  const fileRef = useRef();

  const categoriasDespesa = categorias.filter(c => c.tipo === "despesa").map(c => c.nome);
  if (!categoriasDespesa.includes("Outros")) categoriasDespesa.push("Outros");

  const fileToBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("Falha ao ler arquivo"));
    r.readAsDataURL(file);
  });

  // Detecta o tipo REAL pelos magic bytes (4 primeiros bytes)
  // Necessário pra evitar "document has no pages" quando uma imagem é renomeada como .pdf
  const detectarTipoReal = async (file) => {
    try {
      const slice = file.slice(0, 8);
      const buf = await slice.arrayBuffer();
      const bytes = new Uint8Array(buf);
      // PDF: %PDF
      if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
      // PNG: 89 50 4E 47
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return "image/png";
      // JPG: FF D8 FF
      if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return "image/jpeg";
      // WEBP: RIFF....WEBP (verifica posição 8-11)
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "image/webp";
      return null;
    } catch { return null; }
  };

  const handleFile = (f) => {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      setError("Arquivo muito grande. Limite: 20MB.");
      return;
    }
    setFile(f);
    setError("");
  };

  const reset = () => {
    setStage("upload");
    setFile(null);
    setPastedText("");
    setManualRows([{ id: uid(), data: todayISO(), descricao: "", valor: "", categoria_sugerida: "Outros", fixa: false }]);
    setAnalysis(null);
    setError("");
    setImported(false);
  };

  // Adiciona/remove/edita linhas manuais
  const addManualRow = () => {
    setManualRows([...manualRows, { id: uid(), data: todayISO(), descricao: "", valor: "", categoria_sugerida: "Outros", fixa: false }]);
  };
  const removeManualRow = (id) => {
    setManualRows(manualRows.filter(r => r.id !== id));
  };
  const updateManualRow = (id, patch) => {
    setManualRows(manualRows.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  // Aplica cadastro manual sem chamar IA — direto pra tela de resultados
  const applyManual = () => {
    const validas = manualRows
      .filter(r => r.descricao.trim() && parseFloat(r.valor) > 0)
      .map(r => ({
        id: uid(),
        descricao: r.descricao.trim(),
        valor: Math.abs(parseFloat(r.valor)) || 0,
        data: r.data || todayISO(),
        categoria: categoriasDespesa.includes(r.categoria_sugerida) ? r.categoria_sugerida : "Outros",
        categoria_sugerida: r.categoria_sugerida,
        fixa: !!r.fixa,
        selected: true,
      }));

    if (validas.length === 0) {
      setError("Preencha ao menos uma transação válida (descrição + valor).");
      return;
    }
    setError("");
    setAnalysis({ transacoes: validas });
    setStage("results");
  };

  const analyzeInvoice = async () => {
    if (!file && !pastedText.trim()) {
      setError("Envie um arquivo PDF ou cole o texto da fatura.");
      return;
    }
    const geminiKey = (typeof localStorage !== "undefined" && localStorage.getItem("af4:gemini-key")) || apiKeys?.gemini || "";
    if (!geminiKey.trim()) {
      setError("Para usar a análise por IA é preciso configurar sua chave do Gemini em ⚙ Configurações → Inteligência Artificial. Crie a sua em aistudio.google.com. Como alternativa, use a aba ✏️ Cadastrar manual aí em cima.");
      return;
    }
    setError("");
    setStage("analyzing");
    setProgress("Preparando documento…");

    try {
      const hojeBR = new Date().toLocaleDateString("pt-BR");
      const prompt = `Você é um analisador de fatura de cartão de crédito brasileiro. Hoje é ${hojeBR}. Use SEMPRE o ano correto da fatura: não invente anos passados — se o ano do vencimento/fechamento não estiver explícito no documento, assuma o ano atual. Analise o conteúdo e classifique CADA item em um dos 2 tipos:

- "vista": qualquer compra única, à vista, SEM parcelamento (inclui compras na internet, app stores, assinaturas e mensalidades — tudo que NÃO é parcelado)
- "parcela": qualquer item com indicação de parcelamento (ex.: "iPhone 3/10", "Renner 1/4", "PARC 5/12")

NUNCA classifique nada como assinatura/despesa fixa recorrente. Quem decide se uma compra é recorrente é o usuário, manualmente, em Despesas Fixas — a importação só lança o que está na fatura, nunca cria recorrência automática.

Categorias DISPONÍVEIS (use EXATAMENTE uma destas):
${categoriasDespesa.map(c => `- ${c}`).join("\n")}

Retorne EXATAMENTE este JSON (sem markdown, sem texto extra, sem comentários):
{
  "banco": "string",
  "cartao_final": "####",
  "fechamento": "DD/MM/YYYY",
  "vencimento": "DD/MM/YYYY",
  "total": número,
  "minimo": número,
  "itens": [
    {
      "descricao": "string limpa (sem códigos do banco)",
      "valor": número (sempre positivo, em reais),
      "data_compra": "DD/MM/YYYY",
      "categoria_sugerida": "(uma da lista acima ou 'Outros')",
      "tipo": "vista" | "parcela",
      "parcela_atual": número (SÓ se tipo='parcela', ex.: 5),
      "parcela_total": número (SÓ se tipo='parcela', ex.: 12),
      "valor_parcela": número (SÓ se tipo='parcela', igual ao valor)
    }
  ]
}

Regras IMPORTANTES:
1. Se aparecer "X/N", "X DE N", "PARC X/N" na descrição → tipo: "parcela" (parcela_atual=X, parcela_total=N)
2. Limpe o nome: "PARC 5/12 IPHONE 16 APPLE" → descricao: "iPhone 16 Apple", parcela_atual: 5, parcela_total: 12
3. Tudo que NÃO tiver indicação de parcelamento → tipo: "vista" (incluindo Netflix, Apple, internet, mensalidades — NÃO marque como fixa/recorrente).
4. NÃO inclua: "pagamento recebido", "saldo anterior", "juros", "estorno", "crédito", "tarifa de anuidade total" (mas inclua AS PARCELAS dela como tipo "parcela").
6. Se a categoria certa não está na lista, use "Outros".
7. Retorne APENAS o JSON, NADA mais.`;

      setProgress("Conversando com Gemini 2.5 Flash…");

      let parsed;

      // Detecta o tipo REAL do arquivo (não confia só na extensão/file.type)
      const tipoReal = file ? await detectarTipoReal(file) : null;
      const ehPDF = tipoReal === "application/pdf";
      const ehImagem = tipoReal && tipoReal.startsWith("image/");

      // Helper inline para chamar Gemini com inline_data (PDF ou imagem)
      // Usa fetchComRetry: tenta até 3x com backoff 2s/5s/10s em erros 503/429/5xx
      const callGeminiMultimodal = async (mimeType, base64) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`;
        // fetchComRetry já trata 503/429/401/403 com mensagens amigáveis e levanta erro pronto
        const resp = await fetchComRetry(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64 } },
              ],
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 32768, responseMimeType: "application/json" },
          }),
        });
        const data = await resp.json();
        const cand = data.candidates?.[0];
        const texto = (cand?.content?.parts?.[0]?.text || "").trim();
        if (!texto) throw new Error("Gemini retornou resposta vazia. Tente colar o texto da fatura.");
        // Parser tolerante: limpa fences e fecha JSON truncado (faturas longas).
        const obj = parseJSONTolerante(texto);
        if (obj) return obj;
        // Não deu pra recuperar: se a resposta foi cortada por limite, avisa claro.
        if (cand?.finishReason === "MAX_TOKENS") {
          throw new Error("A fatura é muito longa e a IA cortou a resposta. Tente enviar em partes (ex.: metade das páginas) ou cole o texto da fatura.");
        }
        throw new Error("A IA retornou um formato inesperado. Tente de novo ou cole o texto da fatura.");
      };

      if (ehPDF) {
        setProgress("Codificando PDF…");
        const base64 = await fileToBase64(file);
        if (!base64 || base64.length < 100) {
          throw new Error("Arquivo PDF aparentemente vazio. Tente outro arquivo.");
        }
        parsed = await callGeminiMultimodal("application/pdf", base64);
      } else if (ehImagem) {
        setProgress("Codificando imagem…");
        const base64 = await fileToBase64(file);
        parsed = await callGeminiMultimodal(tipoReal, base64);
      } else if (file && /\.pdf$/i.test(file.name) && !ehPDF) {
        // Arquivo tem extensão .pdf mas magic bytes dizem outra coisa
        throw new Error(
          `O arquivo "${file.name}" tem extensão .pdf mas o conteúdo não é um PDF válido (${tipoReal || "tipo desconhecido"}). Tente exportar de novo, ou cole o texto da fatura.`
        );
      } else {
        // Texto colado ou arquivo .txt/.csv
        let textoFatura = pastedText.trim();
        if (file && !textoFatura) {
          const txt = await file.text();
          textoFatura = txt.slice(0, 80000);
        } else if (file && pastedText.trim()) {
          const txt = await file.text();
          textoFatura = `${txt.slice(0, 60000)}\n\n---\n\n${pastedText}`;
        }
        const textoLimpo = anonimizar(textoFatura);
        const promptCompleto = `${prompt}\n\nTEXTO DA FATURA:\n"""\n${textoLimpo}\n"""`;
        parsed = await gerarJSONGemini(promptCompleto, {
          apiKey: geminiKey,
          temperature: 0.1,
          maxOutputTokens: 32768,
        });
      }

      setProgress("Processando resposta…");

      // Estrutura nova: parsed.itens com tipo (vista/fixa/parcela)
      // Estrutura antiga: parsed.transacoes (fallback retrocompat)
      const itens = parsed.itens || parsed.transacoes || [];
      if (!Array.isArray(itens) || itens.length === 0) {
        throw new Error("Nenhum item encontrado na fatura. Tente um arquivo mais claro ou cole o texto.");
      }

      // Pré-condição: precisa de pelo menos 1 conta cadastrada
      if (!contas || contas.length === 0) {
        throw new Error("Cadastre ao menos 1 conta antes de importar fatura. Vá em Finanças → Contas.");
      }

      // Normaliza e abre preview pra importação no Planejamento
      const analiseNorm = {
        banco: parsed.banco || "Cartão",
        cartao_final: parsed.cartao_final || "",
        fechamento: parsed.fechamento || "",
        vencimento: parsed.vencimento || "",
        total: Number(parsed.total) || 0,
        minimo: Number(parsed.minimo) || 0,
        itens: itens.map(it => ({
          ...it,
          descricao: String(it.descricao || "Lançamento").trim(),
          valor: Math.abs(Number(it.valor) || 0),
          categoria_sugerida: categoriasDespesa.includes(it.categoria_sugerida) ? it.categoria_sugerida : "Outros",
          // Importação nunca cria despesa fixa/recorrente automaticamente:
          // qualquer "fixa" sugerida pela IA (ou legado) é tratada como "vista".
          // Só "parcela" preserva o tratamento próprio; o resto vira "vista".
          tipo: it.tipo === "parcela" ? "parcela" : "vista",
        })).filter(t => t.valor > 0),
      };

      setAnaliseRaw(analiseNorm);
      setPreviewAberto(true);
      setStage("upload"); // volta pra tela inicial — modal toma conta a partir daqui
      setProgress("");
    } catch (err) {
      setError(err.message || String(err));
      setStage("upload");
      setProgress("");
    }
  };

  // Compute stats from current analysis
  const stats = useMemo(() => {
    if (!analysis) return null;
    const txs = analysis.transacoes;
    const total = txs.reduce((s, t) => s + t.valor, 0);
    const fixas = txs.filter(t => t.fixa).reduce((s, t) => s + t.valor, 0);
    const livres = total - fixas;

    const groupBy = (arr) => {
      const map = {};
      arr.forEach(t => {
        if (!map[t.categoria]) map[t.categoria] = { valor: 0, count: 0, cor: categorias.find(c => c.nome === t.categoria)?.cor || T.muted };
        map[t.categoria].valor += t.valor;
        map[t.categoria].count++;
      });
      return Object.entries(map)
        .map(([nome, v]) => ({ nome, ...v }))
        .sort((a, b) => b.valor - a.valor);
    };

    return {
      total, fixas, livres,
      pctFixas: total > 0 ? (fixas / total) * 100 : 0,
      pctLivres: total > 0 ? (livres / total) * 100 : 0,
      catsFixas: groupBy(txs.filter(t => t.fixa)),
      catsLivres: groupBy(txs.filter(t => !t.fixa)),
    };
  }, [analysis, categorias]);

  const updateTx = (id, patch) => {
    setAnalysis(a => ({ ...a, transacoes: a.transacoes.map(t => t.id === id ? { ...t, ...patch } : t) }));
  };
  const removeTx = (id) => {
    setAnalysis(a => ({ ...a, transacoes: a.transacoes.filter(t => t.id !== id) }));
  };

  // Exporta a fatura analisada como PDF (via janela de impressão do navegador)
  const exportarFaturaPDF = () => {
    if (!analysis?.transacoes?.length) return;
    const esc = (s) => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const tot = analysis.transacoes.reduce((s, t) => s + Number(t.valor || 0), 0);
    const cab = analiseRaw
      ? [analiseRaw.banco || "Cartão",
         analiseRaw.cartao_final && "···· " + analiseRaw.cartao_final,
         analiseRaw.vencimento && "venc. " + analiseRaw.vencimento].filter(Boolean).join(" · ")
      : "";
    const linhas = analysis.transacoes.map(t => `<tr>
      <td>${esc(t.data)}</td><td>${esc(t.descricao)}</td><td>${esc(t.categoria)}</td>
      <td>${t.fixa ? "Fixa" : "Variável"}</td><td class="r">${esc(fmt(t.valor))}</td></tr>`).join("");
    printHTML(`<!doctype html><html><head><meta charset="utf-8"><title>Fatura · NUMVI</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:24px;color:#111}
h1{font-size:18px;margin:0}.sub{color:#666;font-size:12px;margin:2px 0 16px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #ddd}
th{text-transform:uppercase;font-size:10px;letter-spacing:.08em;color:#666}
td.r{text-align:right;white-space:nowrap}
tfoot td{font-weight:700;border-top:2px solid #111;border-bottom:none}
</style></head><body>
<h1>NUMVI · Análise de Fatura</h1>
<div class="sub">${[esc(cab), analysis.transacoes.length + " lançamento(s)", "gerado em " + esc(new Date().toLocaleString("pt-BR"))].filter(Boolean).join(" · ")}</div>
<table>
<thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Tipo</th><th style="text-align:right">Valor</th></tr></thead>
<tbody>${linhas}</tbody>
<tfoot><tr><td colspan="4">Total da fatura</td><td class="r">${esc(fmt(tot))}</td></tr></tfoot>
</table></body></html>`);
  };

  const importAll = () => {
    if (!analysis?.transacoes?.length) return;
    const novas = analysis.transacoes.map(t => ({
      id: uid(),
      tipo: "despesa",
      valor: t.valor,
      descricao: t.descricao,
      categoria: t.categoria,
      conta: destConta || (contas[0]?.nome || ""),
      data: t.data,
      compensado: false, // fatura ainda não foi paga
      obs: `Importada via Análise IA${destCartao ? ` · ${destCartao}` : ""}`,
      fixa: !!t.fixa,
      vencimento: t.fixa ? Number(t.data.slice(8, 10)) || null : null,
    }));
    setTransacoes([...transacoes, ...novas]);
    setImported(true);
  };

  /* ----------------- RENDER ----------------- */

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Capítulo IV · Inteligência"
        title="Análise de Fatura com IA"
        sub="Envie o PDF da fatura. O Gemini lê, classifica em à vista ou parcela, detecta match com parcelamentos existentes, e importa direto para o Planejamento. Assinaturas recorrentes você cadastra manualmente em Despesas Fixas."
      />

      {/* UPLOAD STAGE */}
      {stage === "upload" && (
        <>
          {/* 3 modos de entrada */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {[
              { v: "upload", l: "📄 Subir PDF/Imagem", icon: Upload },
              { v: "paste",  l: "📋 Colar texto",      icon: ScanLine },
              { v: "manual", l: "✏️ Cadastrar manual", icon: Plus },
            ].map(t => (
              <button key={t.v} onClick={() => { setMode(t.v); setError(""); }}
                style={{
                  padding: "9px 14px", borderRadius: 8,
                  border: `1px solid ${mode === t.v ? T.gold : T.border}`,
                  background: mode === t.v ? `${T.gold}1f` : T.card,
                  color: mode === t.v ? T.gold : T.muted,
                  fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
                  fontWeight: 500, cursor: "pointer",
                }}>
                {t.l}
              </button>
            ))}
          </div>

          {/* MODO: UPLOAD */}
          {mode === "upload" && (
          <div className="mb-6">
            {/* File upload */}
            <div style={{ background: T.card, border: `2px dashed ${file ? T.gold : T.border}`, padding: 32, textAlign: "center", transition: "border 0.3s" }}
                 onDragOver={(e) => { e.preventDefault(); }}
                 onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}>
              <Sparkles size={32} style={{ color: T.gold, margin: "0 auto 12px" }} />
              <div style={{ fontFamily: T.serif, fontSize: 22, color: T.ink, fontWeight: 600, marginBottom: 6, letterSpacing: "-0.01em" }}>
                Envie sua fatura
              </div>
              <div style={{ color: T.muted, fontSize: 13, marginBottom: 20, fontStyle: "italic" }}>
                PDF, imagem (JPG/PNG) ou arquivo de texto
              </div>
              {file ? (
                <div style={{ background: T.bgSoft, border: `1px solid ${T.gold}`, padding: 14, marginBottom: 12, textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}>
                  <FileText size={18} style={{ color: T.gold, flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <div style={{ color: T.ink, fontSize: 14, fontWeight: 500 }} className="truncate">{file.name}</div>
                    <div className="num text-xs" style={{ color: T.muted }}>{(file.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <button onClick={() => setFile(null)} style={{ color: T.red, background: "transparent", border: "none", cursor: "pointer" }}>
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} className="btn-gold">
                  <Upload size={14} className="inline mr-2" />
                  Escolher arquivo
                </button>
              )}
              <input ref={fileRef} type="file" accept=".pdf,.txt,.csv,image/*" style={{ display: "none" }}
                     onChange={(e) => handleFile(e.target.files[0])} />
              <div style={{ color: T.faint, fontSize: 11, marginTop: 14, fontStyle: "italic" }}>
                ou arraste o arquivo para esta área
              </div>
            </div>
          </div>
          )}

          {/* MODO: COLAR TEXTO */}
          {mode === "paste" && (
          <div className="mb-6">
            <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }}>
              <div className="flex items-center gap-2 mb-3">
                <ScanLine size={16} style={{ color: T.muted }} />
                <div style={{ fontFamily: T.serif, fontSize: 18, color: T.ink, fontWeight: 600 }}>
                  Cole o texto da fatura
                </div>
              </div>
              <div style={{ color: T.muted, fontSize: 13, fontStyle: "italic", marginBottom: 12 }}>
                Útil quando o internet banking deixa copiar o histórico. A IA filtra o ruído sozinha.
              </div>
              <textarea value={pastedText} onChange={(e) => setPastedText(e.target.value)}
                        rows={14}
                        placeholder={`Exemplo:

03/05  PAO DE ACUCAR SP             487,30
05/05  POSTO SHELL ITAIM            280,00
08/05  NETFLIX.COM                   55,90
08/05  IFOOD * PIZZAHUT              67,90`}
                        style={{
                          width: "100%", resize: "vertical", minHeight: 240,
                          fontFamily: T.mono, fontSize: 13, padding: 14,
                          background: T.bgSoft, border: `1px solid ${T.border}`,
                          color: T.ink, borderRadius: 8, lineHeight: 1.6,
                        }} />
              <div style={{ color: T.faint, fontSize: 11, marginTop: 8, fontStyle: "italic" }}>
                💡 Dica: no PDF da fatura, Ctrl+A → Ctrl+C e cole aqui.
              </div>
            </div>
          </div>
          )}

          {/* MODO: CADASTRO MANUAL */}
          {mode === "manual" && (
          <div className="mb-6">
            <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }}>
              <div className="flex items-center gap-2 mb-3">
                <Plus size={16} style={{ color: T.muted }} />
                <div style={{ fontFamily: T.serif, fontSize: 18, color: T.ink, fontWeight: 600 }}>
                  Cadastro manual
                </div>
              </div>
              <div style={{ color: T.muted, fontSize: 13, fontStyle: "italic", marginBottom: 16 }}>
                Adicione transações uma a uma. Útil quando não tem PDF nem texto.
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                  <thead>
                    <tr>
                      {["Data", "Descrição", "Valor (R$)", "Categoria", "Fixa?", ""].map(h => (
                        <th key={h} style={{
                          padding: "8px 10px", textAlign: "left",
                          fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase",
                          color: T.faint, fontWeight: 500,
                          borderBottom: `1px solid ${T.border}`,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {manualRows.map(r => (
                      <tr key={r.id}>
                        <td style={{ padding: "8px 6px" }}>
                          <input type="date" value={r.data}
                            onChange={e => updateManualRow(r.id, { data: e.target.value })}
                            style={{ width: "100%", padding: "7px 9px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 6, color: T.ink, fontSize: 12 }} />
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          <input value={r.descricao} placeholder="Ex: Pão de Açúcar"
                            onChange={e => updateManualRow(r.id, { descricao: e.target.value })}
                            style={{ width: "100%", padding: "7px 9px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 6, color: T.ink, fontSize: 12 }} />
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          <input type="number" step="0.01" value={r.valor} placeholder="0,00"
                            onChange={e => updateManualRow(r.id, { valor: e.target.value })}
                            style={{ width: 110, padding: "7px 9px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 6, color: T.ink, fontSize: 12, textAlign: "right" }} />
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          <select value={r.categoria_sugerida}
                            onChange={e => updateManualRow(r.id, { categoria_sugerida: e.target.value })}
                            style={{ width: "100%", padding: "7px 9px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 6, color: T.ink, fontSize: 12 }}>
                            {categoriasDespesa.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "8px 6px", textAlign: "center" }}>
                          <input type="checkbox" checked={r.fixa}
                            onChange={e => updateManualRow(r.id, { fixa: e.target.checked })}
                            style={{ width: 16, height: 16 }} />
                        </td>
                        <td style={{ padding: "8px 6px" }}>
                          {manualRows.length > 1 && (
                            <button onClick={() => removeManualRow(r.id)}
                              aria-label="Remover linha"
                              style={{ color: T.red, background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={addManualRow} className="btn-ghost">
                  <Plus size={14} className="inline mr-1" /> Adicionar linha
                </button>
              </div>
            </div>
          </div>
          )}

          {/* Action button (varia por modo) */}
          <div className="flex justify-center mb-6">
            {mode === "manual" ? (
              <button onClick={applyManual}
                      disabled={manualRows.every(r => !r.descricao.trim() || !parseFloat(r.valor))}
                      className="btn-gold"
                      style={{ fontSize: 15, padding: "16px 32px", opacity: manualRows.every(r => !r.descricao.trim() || !parseFloat(r.valor)) ? 0.4 : 1 }}>
                <Check size={16} className="inline mr-2" />
                Revisar e Importar
              </button>
            ) : (
              <button onClick={analyzeInvoice}
                      disabled={!file && !pastedText.trim()}
                      className="btn-gold"
                      style={{ fontSize: 15, padding: "16px 32px", opacity: (!file && !pastedText.trim()) ? 0.4 : 1 }}>
                <Sparkles size={16} className="inline mr-2" />
                Analisar com Inteligência Artificial
              </button>
            )}
          </div>

          {error && (
            <div style={{ background: `${T.red}15`, border: `1px solid ${T.red}55`, padding: 14, color: T.red, fontSize: 14, display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 24 }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>{error}</div>
            </div>
          )}

          {/* How it works */}
          <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, padding: 24 }}>
            <div className="label-eyebrow mb-3">Como funciona</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${T.gold}22`, color: T.gold, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12 }}>1</div>
                  <div style={{ color: T.ink, fontWeight: 500, fontSize: 14 }}>Upload</div>
                </div>
                <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.5 }}>
                  Envie o PDF da fatura ou cole o texto do histórico do internet banking.
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${T.gold}22`, color: T.gold, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12 }}>2</div>
                  <div style={{ color: T.ink, fontWeight: 500, fontSize: 14 }}>IA classifica</div>
                </div>
                <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.5 }}>
                  Claude Sonnet identifica cada compra, sugere categoria e marca assinaturas como fixas.
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${T.gold}22`, color: T.gold, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 12 }}>3</div>
                  <div style={{ color: T.ink, fontWeight: 500, fontSize: 14 }}>Você revisa e importa</div>
                </div>
                <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.5 }}>
                  Edite categorias, ajuste o que precisar, e importe tudo para Transações com 1 clique.
                </div>
              </div>
            </div>
            {!(typeof localStorage !== "undefined" && localStorage.getItem("af4:gemini-key")) && (
              <div style={{ marginTop: 20, padding: 12, background: T.bg, border: `1px solid ${T.border}`, fontSize: 12, color: T.muted, fontStyle: "italic" }}>
                <strong style={{ color: T.gold, fontStyle: "normal" }}>Em produção:</strong> a análise por IA usa <strong>Google Gemini 2.5 Flash</strong> (1500 análises/dia grátis). Crie sua chave em <span style={{ color: T.gold }}>aistudio.google.com</span> e cole em ⚙ Configurações → Inteligência Artificial.
              </div>
            )}
          </div>
        </>
      )}

      {/* ANALYZING STAGE */}
      {stage === "analyzing" && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 60, textAlign: "center" }}>
          <div style={{ display: "inline-flex", animation: "spin 1.2s linear infinite", marginBottom: 20 }}>
            <Loader2 size={40} style={{ color: T.gold }} />
          </div>
          <div style={{ fontFamily: T.serif, fontSize: 26, color: T.ink, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 8 }}>
            Analisando sua fatura
          </div>
          <div style={{ color: T.muted, fontSize: 14, fontStyle: "italic" }}>
            {progress || "Trabalhando…"}
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* RESULTS STAGE */}
      {stage === "results" && analysis && stats && (
        <>
          {/* Top stats — replicating the reference layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div style={{ background: T.cardHi, border: `2px solid ${T.gold}`, padding: 20 }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: T.gold }}>
                <Sparkles size={14} />
                <span style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 500 }}>Total Geral</span>
              </div>
              <div className="num" style={{ fontFamily: T.serif, fontSize: 30, color: T.ink, fontWeight: 600, letterSpacing: "-0.02em" }}>
                {hidden ? "•••••" : fmt(stats.total)}
              </div>
              <div style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
                {analysis.transacoes.length} transações
              </div>
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 20 }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: T.muted }}>
                <Repeat size={14} />
                <span style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 500 }}>Despesas Fixas</span>
              </div>
              <div className="num" style={{ fontFamily: T.serif, fontSize: 30, color: T.blue, fontWeight: 600, letterSpacing: "-0.02em" }}>
                {hidden ? "•••••" : fmt(stats.fixas)}
              </div>
              <div className="num" style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
                {fmtN(stats.pctFixas, 1)}% do total
              </div>
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 20 }}>
              <div className="flex items-center gap-2 mb-2" style={{ color: T.muted }}>
                <Activity size={14} />
                <span style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 500 }}>Gastos Livres</span>
              </div>
              <div className="num" style={{ fontFamily: T.serif, fontSize: 30, color: T.red, fontWeight: 600, letterSpacing: "-0.02em" }}>
                {hidden ? "•••••" : fmt(stats.livres)}
              </div>
              <div className="num" style={{ color: T.muted, fontSize: 12, marginTop: 4 }}>
                {fmtN(stats.pctLivres, 1)}% do total
              </div>
            </div>
          </div>

          {/* Two-column breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
            <CategoryBreakdown title="Despesas Fixas" cats={stats.catsFixas} total={stats.fixas} hidden={hidden} accent={T.blue} />
            <CategoryBreakdown title="Gastos Livres" cats={stats.catsLivres} total={stats.livres} hidden={hidden} accent={T.red} />
          </div>

          {/* Import bar */}
          {!imported && (
            <div style={{ background: T.cardHi, border: `1px solid ${T.gold}`, padding: 20, marginBottom: 24 }}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="label-eyebrow">Importar para Transações</div>
                  <div style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>
                    Vai criar <strong style={{ color: T.ink }}>{analysis.transacoes.length}</strong> lançamentos como pendentes (não compensados).
                  </div>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <select value={destConta} onChange={(e) => setDestConta(e.target.value)} style={{ width: "auto", flex: "0 1 160px", fontSize: 13 }}>
                    {contas.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  </select>
                  {cartoes.length > 0 && (
                    <select value={destCartao} onChange={(e) => setDestCartao(e.target.value)} style={{ width: "auto", flex: "0 1 160px", fontSize: 13 }}>
                      <option value="">Sem cartão</option>
                      {cartoes.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                    </select>
                  )}
                  <button onClick={importAll} className="btn-gold">
                    <Check size={14} className="inline mr-2" />Importar tudo
                  </button>
                </div>
              </div>
            </div>
          )}

          {imported && (
            <div style={{ background: `${T.green}15`, border: `1px solid ${T.green}`, padding: 16, marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
              <CheckCircle2 size={20} style={{ color: T.green, flexShrink: 0 }} />
              <div className="flex-1">
                <div style={{ color: T.ink, fontWeight: 500 }}>{analysis.transacoes.length} transações importadas com sucesso!</div>
                <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }}>Veja-as na aba Transações, marcadas como pendentes.</div>
              </div>
              <button onClick={reset} className="btn-ghost" style={{ fontSize: 12 }}>Analisar outra fatura</button>
            </div>
          )}

          {/* Transactions list */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }}>
            <div className="flex items-baseline justify-between mb-4 flex-wrap gap-3">
              <div>
                <div className="label-eyebrow">Todas as Transações</div>
                <h3 style={{ fontFamily: T.serif, fontSize: 24, color: T.ink, marginTop: 4, fontWeight: 600 }}>
                  Revise e ajuste antes de importar
                </h3>
              </div>
              <div className="flex gap-2">
                <button onClick={exportarFaturaPDF} className="btn-ghost" style={{ fontSize: 12 }}>
                  <FileText size={12} className="inline mr-1" />PDF
                </button>
                <button onClick={reset} className="btn-ghost" style={{ fontSize: 12 }}>
                  <ChevronLeft size={12} className="inline mr-1" />Nova análise
                </button>
              </div>
            </div>

            {/* Header row */}
            <div className="hidden md:grid" style={{ gridTemplateColumns: "1fr 200px 110px 140px 32px", gap: 12, padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: T.muted, fontWeight: 500 }}>Descrição</div>
              <div style={{ fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: T.muted, fontWeight: 500 }}>Categoria</div>
              <div style={{ fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: T.muted, fontWeight: 500 }}>Tipo</div>
              <div style={{ fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: T.muted, fontWeight: 500, textAlign: "right" }}>Valor</div>
              <div></div>
            </div>

            {analysis.transacoes.map(t => {
              const cat = categorias.find(c => c.nome === t.categoria);
              return (
                <div key={t.id} className="grid items-center" style={{ gridTemplateColumns: "1fr 200px 110px 140px 32px", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                  <div className="min-w-0">
                    <input value={t.descricao} onChange={(e) => updateTx(t.id, { descricao: e.target.value })}
                           style={{ background: "transparent", padding: "4px 0", fontSize: 14, color: T.ink, border: "none" }} />
                    <div className="num text-xs mt-0.5" style={{ color: T.faint }}>{t.data}</div>
                  </div>
                  <select value={t.categoria} onChange={(e) => updateTx(t.id, { categoria: e.target.value })}
                          style={{ fontSize: 12, padding: "4px 6px" }}>
                    {categoriasDespesa.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={() => updateTx(t.id, { fixa: !t.fixa })}
                          style={{
                            background: t.fixa ? `${T.blue}22` : "transparent",
                            color: t.fixa ? T.blue : T.muted,
                            border: `1px solid ${t.fixa ? T.blue : T.border}`,
                            padding: "4px 10px", fontSize: 11, cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500,
                          }}>
                    {t.fixa ? "Fixa" : "Variável"}
                  </button>
                  <div className="num text-right" style={{ color: T.ink, fontSize: 14, fontWeight: 500 }}>
                    {hidden ? "•••" : fmt(t.valor)}
                  </div>
                  <button onClick={() => removeTx(t.id)} title="Remover" style={{ color: T.red, background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}

            {analysis.resumo?.observacoes && (
              <div style={{ marginTop: 16, padding: 12, background: T.bgSoft, fontSize: 12, color: T.muted, fontStyle: "italic" }}>
                <strong style={{ color: T.gold, fontStyle: "normal" }}>IA: </strong>{analysis.resumo.observacoes}
              </div>
            )}
          </div>
        </>
      )}

      {previewAberto && analiseRaw && (
        <PreviewImportarFaturaModal
          analise={analiseRaw}
          contas={contas} setContas={setContas}
          transacoes={transacoes} setTransacoes={setTransacoes}
          fixas={fixas} setFixas={setFixas}
          fixaOcorrencias={fixaOcorrencias} setFixaOcorrencias={setFixaOcorrencias}
          parcelamentos={parcelamentos} setParcelamentos={setParcelamentos}
          cartoes={cartoes} setCartoes={setCartoes}
          onClose={() => {
            setPreviewAberto(false);
            setAnaliseRaw(null);
          }}
        />
      )}
    </div>
  );
}

function CategoryBreakdown({ title, cats, total, hidden, accent }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }}>
      <h3 style={{ fontFamily: T.serif, fontSize: 22, color: T.ink, fontWeight: 600, marginBottom: 16, letterSpacing: "-0.01em" }}>
        {title}
      </h3>
      {cats.length === 0 ? (
        <div style={{ color: T.muted, fontStyle: "italic", padding: "12px 0" }}>Nenhuma transação nesta categoria.</div>
      ) : (
        <div className="space-y-4">
          {cats.map(c => {
            const pct = total > 0 ? (c.valor / total) * 100 : 0;
            return (
              <div key={c.nome}>
                <div className="flex justify-between items-baseline mb-1.5">
                  <div style={{ color: T.ink, fontSize: 15, fontWeight: 500 }}>{c.nome}</div>
                  <div className="text-right">
                    <div className="num" style={{ color: T.ink, fontSize: 15, fontWeight: 500 }}>
                      {hidden ? "•••" : fmt(c.valor)}
                    </div>
                    <div className="num text-xs" style={{ color: T.muted }}>{fmtN(pct, 1)}%</div>
                  </div>
                </div>
                <div style={{ background: T.border, height: 6 }}>
                  <div style={{ width: `${pct}%`, background: c.cor || accent, height: "100%", transition: "width 0.6s" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
