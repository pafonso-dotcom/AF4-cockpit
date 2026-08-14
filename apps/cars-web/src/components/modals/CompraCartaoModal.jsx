import React, { useState } from "react";
import { Check, CreditCard } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, uid, todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { ordenarPorNome } from "../../lib/categoriaSort.js";
import Modal from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";
import MoneyInput from "../ui/MoneyInput.jsx";

const KEY_ULTIMO_CARTAO = "af4:compra-cartao:ultimo";

/**
 * Compra no cartão — lançamento RÁPIDO na hora da compra (10 segundos):
 * valor, descrição, cartão (lembra o último), à vista ou parcelado em N×.
 *   À vista  → transação pendente no cartão (entra na fatura; banco só é
 *              debitado quando pagares a fatura).
 *   Parcelado→ cria o parcelamento (1ª parcela na fatura do mês seguinte).
 * Quando a fatura importada chegar, esses lançamentos são conciliados
 * ("Já lançado") — não duplicam.
 */
export default function CompraCartaoModal({
  cartoes = [], categorias = [],
  transacoes = [], setTransacoes,
  parcelamentos = [], setParcelamentos,
  onClose,
}) {
  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cartaoId, setCartaoId] = useState(() => {
    try {
      const ultimo = localStorage.getItem(KEY_ULTIMO_CARTAO);
      if (ultimo && cartoes.some(c => c.id === ultimo)) return ultimo;
    } catch {}
    return cartoes[0]?.id || "";
  });
  const [parcelado, setParcelado] = useState(false);
  const [nParcelas, setNParcelas] = useState(2);
  const [categoria, setCategoria] = useState("");
  const [data, setData] = useState(todayISO());

  const despCats = ordenarPorNome((categorias || []).filter(c => c.tipo === "despesa"));
  const v = Number(valor) || 0;
  const n = Math.min(Math.max(parseInt(nParcelas, 10) || 2, 2), 48);

  const salvar = () => {
    if (v <= 0) { toast.error("Informe o valor da compra."); return; }
    if (!cartaoId) { toast.error("Selecione o cartão."); return; }
    const cartao = cartoes.find(c => c.id === cartaoId);
    const desc = descricao.trim() || "Compra no cartão";
    try { localStorage.setItem(KEY_ULTIMO_CARTAO, cartaoId); } catch {}

    if (parcelado) {
      const novo = {
        id: `parc-${uid()}`,
        cartaoId,
        descricao: desc,
        categoria: categoria || "",
        valorTotal: v,
        totalParcelas: n,
        valorParcela: +(v / n).toFixed(2),
        dataCompra: data,
        parcelasPagas: [],
        escopo: "pessoal",
        origem: "compra-manual",
      };
      setParcelamentos([...(parcelamentos || []), novo]);
      toast.success(`${desc} · ${n}× de ${fmt(v / n)} no ${cartao?.nome || "cartão"} (1ª parcela na próxima fatura).`);
    } else {
      const nova = {
        id: `tx-${uid()}`,
        tipo: "despesa",
        descricao: desc,
        valor: v,
        data,
        categoria: categoria || "Outros",
        cartaoId,
        compensado: false,
        origem: "compra-manual",
      };
      setTransacoes([...(transacoes || []), nova]);
      toast.success(`${desc} · ${fmt(v)} lançado na fatura do ${cartao?.nome || "cartão"}.`);
    }
    onClose?.();
  };

  return (
    <Modal title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><CreditCard size={20} style={{ color: T.gold }} /> Compra no cartão</span>} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor da compra (R$)" required>
          <MoneyInput value={valor} onChange={setValor} autoFocus />
        </Field>
        <Field label="Cartão" required>
          <select value={cartaoId} onChange={e => setCartaoId(e.target.value)}>
            {cartoes.length === 0 && <option value="">— Sem cartões —</option>}
            {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Descrição">
        <input value={descricao} onChange={e => setDescricao(e.target.value)}
               placeholder="Ex.: Tênis Centauro" />
      </Field>

      {/* À vista × parcelado */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "4px 0 10px", flexWrap: "wrap" }}>
        <button onClick={() => setParcelado(false)}
                style={{ padding: "7px 14px", borderRadius: 11, cursor: "pointer", fontSize: 12, fontWeight: 700,
                         background: !parcelado ? `${T.gold}22` : T.bgSoft, color: !parcelado ? T.gold : T.muted,
                         border: `1px solid ${!parcelado ? T.gold : T.border}` }}>
          À vista
        </button>
        <button onClick={() => setParcelado(true)}
                style={{ padding: "7px 14px", borderRadius: 11, cursor: "pointer", fontSize: 12, fontWeight: 700,
                         background: parcelado ? `${T.gold}22` : T.bgSoft, color: parcelado ? T.gold : T.muted,
                         border: `1px solid ${parcelado ? T.gold : T.border}` }}>
          Parcelado
        </button>
        {parcelado && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: T.ink }}>
            em
            <input type="number" min="2" max="48" value={nParcelas}
                   onChange={e => setNParcelas(e.target.value)}
                   style={{ width: 58, padding: "6px 8px", borderRadius: 9, background: T.bgSoft, color: T.ink, border: `1px solid ${T.border}`, fontSize: 13 }} />
            ×{v > 0 && <strong className="num" style={{ color: T.gold }}> de {fmt(v / n)}</strong>}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria (opcional)">
          <select value={categoria} onChange={e => setCategoria(e.target.value)}>
            <option value="">— Outros —</option>
            {despCats.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
          </select>
        </Field>
        <Field label="Data da compra">
          <input type="date" value={data} onChange={e => setData(e.target.value)} />
        </Field>
      </div>

      <div style={{ marginTop: 6, padding: 10, background: T.bgSoft, borderRadius: 11, fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
        {parcelado
          ? <>Cria o parcelamento no cartão — a 1ª parcela cai na <strong>fatura do mês seguinte</strong>.</>
          : <>Entra <strong style={{ color: T.gold }}>pendente</strong> na fatura do cartão — o banco só é debitado quando pagares a fatura.</>}
        {" "}Quando importares a fatura, este lançamento é <strong>conciliado</strong> (não duplica).
      </div>

      <div className="flex gap-3 justify-end mt-5">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-gold" onClick={salvar}>
          <Check size={13} className="inline mr-1.5" /> Lançar compra
        </button>
      </div>
    </Modal>
  );
}
