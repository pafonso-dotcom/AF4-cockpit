import React, { useMemo } from "react";
import { Trash2, ShieldCheck, Search } from "lucide-react";
import { T } from "../../lib/theme.js";
import Modal from "../ui/Modal.jsx";
import { toast } from "../../lib/toast.js";
import { varrerDuplicidades } from "../../lib/duplicidades.js";

/**
 * Varredura de duplicidades do Financeiro. Roda varrerDuplicidades sobre o
 * estado atual e deixa remover os itens repetidos por tipo (mantém 1 de cada
 * grupo), sempre com desfazer. Não cria nada — só limpa repetição.
 *
 * Props: dados (objeto com as coleções), setters (map tipo→setState), onClose.
 */
export default function VarreduraDuplicidades({ dados = {}, setters = {}, onClose }) {
  const res = useMemo(() => varrerDuplicidades(dados), [dados]);
  const tipos = Object.values(res.porTipo);

  // Remove os `remover` ids de um tipo (ou de todos), com desfazer.
  const limpar = (lista) => {
    // lista: [{ tipo, remover:[ids] }]
    const backups = {};
    let total = 0;
    lista.forEach(({ tipo, remover }) => {
      const setter = setters[tipo];
      const arr = dados[tipo];
      if (!setter || !Array.isArray(arr) || !remover.length) return;
      backups[tipo] = arr;
      const rm = new Set(remover);
      setter(arr.filter((x) => !rm.has(x.id)));
      total += remover.length;
    });
    if (!total) return;
    toast.success(`${total} ${total === 1 ? "duplicata removida" : "duplicatas removidas"}.`, {
      action: { label: "Desfazer", onClick: () => Object.entries(backups).forEach(([tipo, arr]) => setters[tipo]?.(arr)) },
    });
  };

  return (
    <Modal title="Verificar duplicidades" onClose={onClose} wide>
      <div style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.6, marginBottom: 14 }}>
        Varredura no Financeiro por itens repetidos (mesmo valor, data, nome…). Mantém <b>1</b> de cada grupo e remove os extras — dá pra <b>desfazer</b> logo depois.
      </div>

      {res.totalExtra === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 14px", background: `${T.green}12`, border: `1px solid ${T.green}44`, borderRadius: 14, color: T.ink }}>
          <ShieldCheck size={20} style={{ color: T.green, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700 }}>Nenhuma duplicidade encontrada 🎉</div>
            <div style={{ fontSize: 12, color: T.muted }}>Transações, dívidas, a receber, fixas, cheques, cartões, parcelamentos, contas e categorias — tudo limpo.</div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 13, color: T.ink }}>
              <b style={{ color: T.gold }}>{res.totalExtra}</b> {res.totalExtra === 1 ? "duplicata" : "duplicatas"} em <b>{res.totalGrupos}</b> {res.totalGrupos === 1 ? "grupo" : "grupos"}.
            </div>
            <button onClick={() => limpar(tipos)} className="btn-gold" style={{ padding: "8px 14px", fontSize: 12.5 }}>
              <Trash2 size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} /> Remover todas ({res.totalExtra})
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {tipos.map((t) => (
              <div key={t.tipo} style={{ background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 14, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>
                      {t.remover.length} {t.remover.length === 1 ? "extra" : "extras"} em {t.grupos.length} {t.grupos.length === 1 ? "grupo" : "grupos"}
                    </div>
                  </div>
                  <button onClick={() => limpar([{ tipo: t.tipo, remover: t.remover }])}
                          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: `1px solid ${T.red}55`, color: T.red, borderRadius: 9, padding: "6px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                    <Trash2 size={13} /> Remover {t.remover.length}
                  </button>
                </div>
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  {t.grupos.slice(0, 6).map((g, i) => (
                    <div key={i} style={{ fontSize: 11.5, color: T.muted, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 8.5, fontWeight: 800, padding: "1px 5px", borderRadius: 4, background: `${T.gold}22`, color: T.gold }}>×{g.qtd}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.exemplos[0]}</span>
                    </div>
                  ))}
                  {t.grupos.length > 6 && <div style={{ fontSize: 11, color: T.faint }}>+{t.grupos.length - 6} outros grupos…</div>}
                </div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: T.faint, marginTop: 10, lineHeight: 1.5 }}>
            <Search size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />
            Critério: mesmo tipo/valor/data/nome (ignora maiúsc./espaços). Sempre mantém a primeira ocorrência. Pagamentos ligados a fixas/parcelas não são mexidos aqui — use "Excluir duplicidade" no Controle Anual pra esse caso.
          </div>
        </>
      )}
    </Modal>
  );
}
