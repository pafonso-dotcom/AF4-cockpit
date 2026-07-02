import React, { useState, useRef } from "react";
import { Camera, Sparkles, CheckCircle2, AlertCircle, RotateCcw } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, uid, todayISO } from "../../lib/format.js";
import { ocrComprovante } from "../../lib/ocrComprovante.js";
import { extrairReciboViaWorker } from "../../lib/reciboWorker.js";
import { audit } from "../../lib/auditLog.js";
import { toast } from "../../lib/toast.js";
import { ordenarPorNome } from "../../lib/categoriaSort.js";
import Modal from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";
import MoneyInput from "../ui/MoneyInput.jsx";

export default function OCRComprovante({
  contas, categorias,
  transacoes, setTransacoes, onClose,
}) {
  const temGeminiKey = !!(localStorage.getItem("af4:gemini-key") || "").trim();
  const [imagem, setImagem] = useState(null);
  const [step, setStep] = useState("upload");
  const [forma, setForma] = useState(null);
  const [erro, setErro] = useState("");
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErro("Selecione uma imagem (JPG, PNG, HEIC)."); return; }
    setErro("");
    const reader = new FileReader();
    reader.onload = e => setImagem({ file, preview: e.target.result });
    reader.readAsDataURL(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // Mapeia categoria sugerida pela IA pra uma categoria existente do cockpit
  // (case-insensitive); se não casar, mantém a sugestão (o select aceita "Outros").
  const mapCategoria = (sugerida) => {
    if (!sugerida) return "Outros";
    const hit = categorias.find(c => (c.nome || "").toLowerCase() === sugerida.toLowerCase());
    return hit ? hit.nome : sugerida;
  };

  const processar = async () => {
    if (!imagem) return;
    setErro("");
    setStep("processando");
    try {
      // Caminho preferido: Worker com Claude Vision (chave protegida no servidor).
      // Fallback: Gemini client-side, se houver chave e o Worker não estiver pronto.
      let result, fonte;
      try {
        const r = await extrairReciboViaWorker({ file: imagem.file, categorias: categorias.map(c => c.nome) });
        result = {
          tipo: r.tipo, descricao: r.loja, valor: r.valor, data: r.data,
          categoria: mapCategoria(r.categoriaSugerida), subcategoria: r.subcategoria,
          estabelecimento: r.loja, pagamento: r.pagamento, confianca: r.confianca, alerta: r.alerta,
        };
        fonte = "Claude Vision";
      } catch (errWorker) {
        if (!temGeminiKey) throw errWorker; // sem fallback → erro do Worker
        const g = await ocrComprovante({ file: imagem.file, categoriasDisponiveis: categorias.map(c => c.nome) });
        result = { ...g, categoria: mapCategoria(g.categoria) };
        fonte = "Gemini Vision";
      }

      const obsPartes = [];
      if (result.estabelecimento && result.estabelecimento !== result.descricao) obsPartes.push(`Estabelecimento: ${result.estabelecimento}`);
      if (result.pagamento) obsPartes.push(`Pgto: ${result.pagamento}`);
      if (result.alerta) obsPartes.push(`⚠ ${result.alerta}`);

      setForma({
        tipo: result.tipo || "despesa",
        descricao: result.descricao || "",
        valor: Number(result.valor) || 0,
        data: result.data || todayISO(),
        categoria: result.categoria || "Outros",
        subcategoria: result.subcategoria || "",
        conta: contas[0]?.nome || "",
        obs: obsPartes.join(" · "),
        _fonte: fonte,
        _confianca: result.confianca,
      });
      setStep("revisar");
    } catch (err) {
      setErro(err.message || "Falha ao processar.");
      setStep("upload");
    }
  };

  const confirmar = () => {
    if (!forma.descricao || !forma.valor) { toast.error("Descrição e valor obrigatórios."); return; }
    const valorNum = Number(forma.valor) || 0;
    if (valorNum <= 0) { toast.error("Valor inválido."); return; }
    const sufixo = `OCR ${forma._fonte || "recibo"}`;
    const tx = {
      id: uid(), tipo: forma.tipo, descricao: forma.descricao,
      valor: valorNum, data: forma.data,
      categoria: forma.categoria, subcategoria: forma.subcategoria || null,
      conta: forma.conta, compensado: true, fixa: false,
      obs: forma.obs ? `${forma.obs} · ${sufixo}` : sufixo,
    };
    setTransacoes([tx, ...transacoes]);
    audit.create("transação", forma.descricao, tx.id, { ...tx, fonte: "OCR" });
    toast.success(`✓ ${forma.descricao} · ${fmt(valorNum)} registrada!`);
    onClose();
  };

  return (
    <Modal title="Escanear recibo por foto" onClose={onClose} wide>
      {step === "upload" && (
        <>
          {!imagem ? (
            <>
              <div onDrop={onDrop} onDragOver={e => e.preventDefault()}
                   onClick={() => fileRef.current?.click()}
                   style={{
                     border: `2px dashed ${T.border}`, borderRadius: 18,
                     padding: "40px 20px", textAlign: "center", cursor: "pointer",
                     background: T.bgSoft, transition: "all .2s",
                   }}
                   onMouseEnter={e => e.currentTarget.style.borderColor = T.gold}
                   onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
                <Camera size={36} style={{ color: T.muted, marginBottom: 10 }} />
                <div style={{ fontSize: 15, color: T.ink, marginBottom: 6 }}>Tire foto ou arraste comprovante</div>
                <div style={{ fontSize: 12, color: T.muted }}>ou <strong style={{ color: T.gold }}>clique para selecionar</strong></div>
                <div style={{ fontSize: 10.5, color: T.faint, marginTop: 10 }}>JPG · PNG · HEIC · Cupom fiscal, nota, recibo</div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" capture="environment"
                     style={{ display: "none" }} onChange={e => handleFile(e.target.files?.[0])} />
            </>
          ) : (
            <>
              <div style={{ background: T.bgSoft, borderRadius: 14, padding: 14, marginBottom: 14, textAlign: "center" }}>
                <img src={imagem.preview} alt="Preview" style={{ maxWidth: "100%", maxHeight: 400, borderRadius: 11, display: "block", margin: "0 auto" }} />
                <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>{imagem.file.name} · {Math.round(imagem.file.size / 1024)} KB</div>
              </div>
              <div className="flex gap-3">
                <button className="btn-gold" onClick={processar} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Sparkles size={13} /> Escanear recibo
                </button>
                <button className="btn-ghost" onClick={() => setImagem(null)}>Outra imagem</button>
              </div>
            </>
          )}
          {erro && (
            <div style={{ marginTop: 14, padding: 10, background: `${T.red}22`, color: T.red, border: `1px solid ${T.red}`, borderRadius: 11, fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={14} /> {erro}
            </div>
          )}
        </>
      )}

      {step === "processando" && (
        <div style={{ padding: 40, textAlign: "center" }}>
          <Sparkles size={36} className="spin" style={{ color: T.gold, marginBottom: 14 }} />
          <h3 style={{ fontFamily: T.serif, fontSize: 20, color: T.ink, marginBottom: 6 }}>Analisando recibo…</h3>
          <p style={{ fontSize: 12, color: T.muted }}>Extraindo loja, valor, data e categoria da foto.</p>
        </div>
      )}

      {step === "revisar" && forma && (
        <>
          <div style={{ padding: 12, marginBottom: 14, background: `${T.green}11`, border: `1px solid ${T.green}`, borderRadius: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.green, flexWrap: "wrap" }}>
            <CheckCircle2 size={14} /> Dados extraídos! Revise antes de criar.
            {forma._fonte && (
              <span style={{ marginLeft: "auto", fontSize: 10.5, color: T.muted }}>
                {forma._fonte}{typeof forma._confianca === "number" ? ` · confiança ${forma._confianca}%` : ""}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Descrição *"><input type="text" value={forma.descricao} onChange={e => setForma({ ...forma, descricao: e.target.value })} /></Field>
            <Field label="Valor (R$) *"><MoneyInput value={forma.valor} onChange={v => setForma({ ...forma, valor: v })} /></Field>
            <Field label="Data"><input type="date" value={forma.data} onChange={e => setForma({ ...forma, data: e.target.value })} /></Field>
            <Field label="Tipo">
              <select value={forma.tipo} onChange={e => setForma({ ...forma, tipo: e.target.value })}>
                <option value="despesa">Despesa</option><option value="receita">Receita</option>
              </select>
            </Field>
            <Field label="Categoria">
              <select value={forma.categoria} onChange={e => setForma({ ...forma, categoria: e.target.value })}>
                {ordenarPorNome(categorias.filter(c => c.tipo === forma.tipo)).map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                {!categorias.some(c => c.nome === forma.categoria) && <option value={forma.categoria}>{forma.categoria} (sugerida)</option>}
              </select>
            </Field>
            <Field label="Conta">
              <select value={forma.conta} onChange={e => setForma({ ...forma, conta: e.target.value })}>
                {contas.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
            </Field>
          </div>
          {forma.obs && (
            <Field label="Observações">
              <textarea value={forma.obs} rows={2} onChange={e => setForma({ ...forma, obs: e.target.value })} />
            </Field>
          )}
          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={confirmar} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={13} /> Criar transação
            </button>
            <button className="btn-ghost" onClick={() => { setStep("upload"); setForma(null); }} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <RotateCcw size={13} /> Tentar outra foto
            </button>
            <button className="btn-ghost" onClick={onClose} style={{ marginLeft: "auto" }}>Cancelar</button>
          </div>
        </>
      )}
    </Modal>
  );
}
