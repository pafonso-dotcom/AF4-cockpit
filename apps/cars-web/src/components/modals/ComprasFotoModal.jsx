import React, { useRef, useState } from "react";
import { Camera, Check, Pencil } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, uid, todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import Modal from "../ui/Modal.jsx";
import { gerarJSONGeminiComImagem, fileToBase64 } from "../../lib/gemini.js";
import { montarPromptComprasFoto, normalizarCompraFoto, marcarJaLancadas } from "../../lib/comprasFoto.js";

const KEY_ULTIMO_CARTAO = "af4:compra-cartao:ultimo"; // mesmo do CompraCartaoModal

/**
 * Compras do cartão POR FOTO: tira foto (ou print) da tela de transações
 * recentes do app do banco/Wallet — ou de um cupom — e a IA extrai as
 * compras pra lançar na fatura na hora, sem esperar a fatura fechar.
 * As já lançadas (mesmo valor + data próxima) vêm desmarcadas.
 */
export default function ComprasFotoModal({
  cartoes = [], transacoes = [], setTransacoes,
  onClose, onManual,
}) {
  const [cartaoId, setCartaoId] = useState(() => {
    try {
      const ultimo = localStorage.getItem(KEY_ULTIMO_CARTAO);
      if (ultimo && cartoes.some(c => c.id === ultimo)) return ultimo;
    } catch {}
    return cartoes[0]?.id || "";
  });
  const [lendo, setLendo] = useState(false);
  const [itens, setItens] = useState(null); // null = etapa foto · [] = leu e não achou
  const inputRef = useRef(null);

  const temGemini = (() => {
    try { return !!localStorage.getItem("af4:gemini-key"); } catch { return false; }
  })();

  const lerFoto = async (file) => {
    if (!file) return;
    setLendo(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await gerarJSONGeminiComImagem(
        montarPromptComprasFoto(new Date()),
        base64,
        file.type || "image/jpeg"
      );
      const hoje = todayISO();
      const compras = (res?.compras || [])
        .map(i => normalizarCompraFoto(i, hoje))
        .filter(Boolean);
      if (!compras.length) {
        toast.error("Não encontrei compras na foto. Tente enquadrar melhor ou digite manualmente.");
        setLendo(false);
        return;
      }
      const marcadas = marcarJaLancadas(compras, transacoes, cartaoId);
      setItens(marcadas.map((c, i) => ({ ...c, id: i, incluir: !c.jaLancada })));
    } catch (e) {
      toast.error(e?.message || "Falha ao ler a foto.");
    } finally {
      setLendo(false);
    }
  };

  const toggle = (id) => setItens(prev => prev.map(x => x.id === id ? { ...x, incluir: !x.incluir } : x));

  const lancar = () => {
    const escolhidas = (itens || []).filter(x => x.incluir);
    if (!escolhidas.length) { toast.error("Marque pelo menos uma compra."); return; }
    if (!cartaoId) { toast.error("Selecione o cartão."); return; }
    const cartao = cartoes.find(c => c.id === cartaoId);
    try { localStorage.setItem(KEY_ULTIMO_CARTAO, cartaoId); } catch {}
    const novas = escolhidas.map(c => ({
      id: `tx-${uid()}`,
      tipo: "despesa",
      descricao: c.descricao,
      valor: c.valor,
      data: c.data,
      categoria: "Outros",
      cartaoId,
      compensado: false,
      origem: "compra-foto",
    }));
    setTransacoes([...(transacoes || []), ...novas]);
    const total = escolhidas.reduce((s, c) => s + c.valor, 0);
    toast.success(`${escolhidas.length} compra${escolhidas.length > 1 ? "s" : ""} (${fmt(total)}) lançada${escolhidas.length > 1 ? "s" : ""} na fatura do ${cartao?.nome || "cartão"}.`);
    onClose?.();
  };

  const totalMarcado = (itens || []).filter(x => x.incluir).reduce((s, c) => s + c.valor, 0);

  return (
    <Modal title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Camera size={20} style={{ color: T.gold }} /> Compras por foto</span>} onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, fontWeight: 600, letterSpacing: ".05em" }}>CARTÃO</div>
        <select value={cartaoId} onChange={e => {
          setCartaoId(e.target.value);
          // Recalcula "já lançada" pro cartão escolhido
          if (itens) setItens(prev => marcarJaLancadas(prev, transacoes, e.target.value).map((c, i) => ({ ...c, id: i, incluir: !c.jaLancada })));
        }}>
          {cartoes.length === 0 && <option value="">— Sem cartões —</option>}
          {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>

      {itens === null ? (
        <>
          <p style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.55, marginBottom: 14 }}>
            Tire uma foto (ou use um print) da tela de <strong>transações recentes</strong> do
            app do banco/Wallet, ou de um cupom/comprovante. A IA lê as compras e você
            confirma antes de lançar na fatura — <strong>sem esperar a fatura fechar</strong>.
          </p>
          {!temGemini && (
            <div style={{ padding: "10px 14px", borderRadius: 11, fontSize: 12, marginBottom: 12, background: `${T.red}15`, color: T.red, border: `1px solid ${T.red}55` }}>
              Configure a chave do Gemini em ⚙ Configurações → Inteligência Artificial pra ler fotos.
            </div>
          )}
          <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                 onChange={e => { lerFoto(e.target.files?.[0]); e.target.value = ""; }} />
          <button className="btn-gold" style={{ width: "100%", opacity: temGemini && !lendo ? 1 : 0.55 }}
                  disabled={!temGemini || lendo}
                  onClick={() => inputRef.current?.click()}>
            {lendo ? "⏳ Lendo a foto…" : "📷 Tirar foto / escolher print"}
          </button>
          <button onClick={() => { onClose?.(); onManual?.(); }}
                  style={{ width: "100%", marginTop: 8, padding: "10px 14px", background: "transparent", color: T.muted, border: `1px dashed ${T.border}`, borderRadius: 11, cursor: "pointer", fontSize: 12 }}>
            <Pencil size={12} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
            Prefiro digitar manualmente
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>
            Encontrei <strong style={{ color: T.ink }}>{itens.length}</strong> compra{itens.length > 1 ? "s" : ""}. Desmarque o que não quiser lançar —
            as que parecem <strong style={{ color: T.gold }}>já lançadas</strong> vieram desmarcadas.
          </p>
          <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {itens.map(c => (
              <button key={c.id} onClick={() => toggle(c.id)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", textAlign: "left", cursor: "pointer",
                               background: c.incluir ? `${T.gold}10` : T.bgSoft, border: `1px solid ${c.incluir ? T.gold : T.border}`, borderRadius: 11 }}>
                <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                               background: c.incluir ? T.gold : "transparent", border: `1.5px solid ${c.incluir ? T.gold : T.border}`, color: T.bg }}>
                  {c.incluir && <Check size={12} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.descricao}</span>
                  <span style={{ fontSize: 10.5, color: T.muted }}>
                    {c.data.slice(8, 10)}/{c.data.slice(5, 7)}
                    {c.jaLancada && <strong style={{ color: T.gold }}> · já lançada?</strong>}
                  </span>
                </span>
                <span className="num" style={{ fontSize: 13, fontWeight: 700, color: T.ink, flexShrink: 0 }}>{fmt(c.valor)}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-3 justify-end" style={{ alignItems: "center" }}>
            <button onClick={() => setItens(null)}
                    style={{ marginRight: "auto", padding: "8px 12px", background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 10, cursor: "pointer", fontSize: 11.5 }}>
              ← Outra foto
            </button>
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-gold" onClick={lancar}>
              <Check size={13} className="inline mr-1.5" /> Lançar {fmt(totalMarcado)}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
