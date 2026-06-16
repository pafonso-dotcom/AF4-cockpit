import React, { useState } from "react";
import { Plus } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { gerarOcorrencias } from "../../lib/fixas.js";
import Modal from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";
import MoneyInput from "../ui/MoneyInput.jsx";

const MES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

/**
 * Modal próprio de cadastro/edição de Despesa Fixa.
 * Não tem nada a ver com o modal genérico de Transações.
 *
 * Props:
 *  - editing: fixa existente pra editar (opcional)
 *  - categorias, contas: listas pra popular selects
 *  - onSave(novaFixa, ocorrenciasGeradas, modoEdicao)
 *  - onClose
 */
export default function NovaFixaModal({ editing, categorias = [], contas = [], onSave, onClose }) {
  const hojeISO = todayISO();
  const anoAtual = parseInt(hojeISO.slice(0, 4), 10);
  const mesAtualIdx = parseInt(hojeISO.slice(5, 7), 10) - 1;
  const mesAtualISO = `${anoAtual}-${String(mesAtualIdx + 1).padStart(2, "0")}`;

  const [form, setForm] = useState(() => {
    if (editing) return { ...editing, valor: editing.valor ?? "" };
    return {
      descricao: "",
      valor: "",
      diaVencimento: 5,
      categoria: "",
      escopo: "pessoal",
      contaPadrao: "",
      obs: "",
      inicioEm: mesAtualISO,
      terminoEm: "",
    };
  });
  const [errs, setErrs] = useState({});
  // Pra edição: aplicar em "futuras" (default) ou "todas pendentes"
  const [escopoEdicao, setEscopoEdicao] = useState("futuras");

  const despCats = (categorias || []).filter(c => c.tipo === "despesa");

  // Gera lista de meses (até 24 à frente) pra Começar/Terminar selects
  const mesesOpcoes = [];
  for (let off = -6; off <= 24; off++) {
    const d = new Date(anoAtual, mesAtualIdx + off, 1);
    const ano = d.getFullYear();
    const m = d.getMonth();
    const iso = `${ano}-${String(m + 1).padStart(2, "0")}`;
    mesesOpcoes.push({ iso, label: `${MES_NOMES[m]}/${ano}` });
  }

  const validar = () => {
    const e = {};
    if (!form.descricao?.trim()) e.descricao = "Descrição obrigatória";
    const v = Number(form.valor) || 0;
    if (form.valor == null || form.valor === "" || v <= 0) {
      e.valor = "Valor obrigatório (ex: 1500 ou 1.500,00)";
    }
    const dia = parseInt(form.diaVencimento, 10);
    if (isNaN(dia) || dia < 1 || dia > 31) e.diaVencimento = "Dia entre 1 e 31";
    if (!form.categoria) e.categoria = "Selecione uma categoria";
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const salvar = () => {
    if (!validar()) {
      toast.error("Verifique os campos destacados.");
      return;
    }
    const valorNum = Number(form.valor) || 0;
    const fixaData = {
      ...form,
      valor: valorNum,
      diaVencimento: parseInt(form.diaVencimento, 10),
      terminoEm: form.terminoEm || null,
    };

    if (editing) {
      // Edição: passa o form + o escopo
      onSave?.({ ...editing, ...fixaData }, null, escopoEdicao);
      onClose?.();
      return;
    }

    // Criação nova
    const novaFixa = {
      id: `fixa-${Date.now()}`,
      ...fixaData,
      criadoEm: hojeISO,
    };
    const ocorrencias = gerarOcorrencias(novaFixa, anoAtual);
    onSave?.(novaFixa, ocorrencias, "criar");
    onClose?.();
  };

  const inicioLabel = mesesOpcoes.find(m => m.iso === form.inicioEm)?.label || form.inicioEm;
  const previewN = (() => {
    const inicioAno = parseInt((form.inicioEm || mesAtualISO).slice(0, 4), 10);
    const inicioMes = parseInt((form.inicioEm || mesAtualISO).slice(5), 10);
    const fimAno = form.terminoEm ? parseInt(form.terminoEm.slice(0, 4), 10) : anoAtual;
    const fimMes = form.terminoEm ? parseInt(form.terminoEm.slice(5), 10) : 12;
    if (fimAno < inicioAno) return 0;
    if (fimAno === inicioAno) return Math.max(0, fimMes - inicioMes + 1);
    // Mais de um ano (não suportamos preview multi-ano aqui — gerador faz só do ano corrente)
    return 12 - inicioMes + 1;
  })();

  return (
    <Modal title={editing ? "Editar despesa fixa" : "Nova despesa fixa"} onClose={onClose}>
      <Field label="Descrição" required error={errs.descricao}>
        <input value={form.descricao}
               onChange={e => setForm({ ...form, descricao: e.target.value })}
               placeholder="Ex.: Aluguel apartamento" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor (R$)" required error={errs.valor} hint="Só números · centavos automáticos">
          <MoneyInput value={form.valor} onChange={v => setForm({ ...form, valor: v })} />
        </Field>
        <Field label="Dia de vencimento" required error={errs.diaVencimento} hint="1 a 31">
          <input type="number" min="1" max="31" value={form.diaVencimento}
                 onChange={e => setForm({ ...form, diaVencimento: e.target.value })} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria" required error={errs.categoria}>
          <select value={form.categoria}
                  onChange={e => setForm({ ...form, categoria: e.target.value })}>
            <option value="">— Selecione —</option>
            {despCats.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            <option value="Outros">Outros</option>
          </select>
        </Field>
        <Field label="Escopo" hint="Pessoal ou Negócio — separa nas estatísticas">
          <select value={form.escopo || "pessoal"}
                  onChange={e => setForm({ ...form, escopo: e.target.value })}>
            <option value="pessoal">👤 Pessoal</option>
            <option value="negocio">🏢 Negócio</option>
          </select>
        </Field>
        <Field label="Conta padrão (sugestão)" hint="Pré-seleção ao pagar">
          <select value={form.contaPadrao}
                  onChange={e => setForm({ ...form, contaPadrao: e.target.value })}>
            <option value="">— Nenhuma —</option>
            {(contas || []).map(c => <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>)}
          </select>
        </Field>
      </div>

      <Field label="Observações">
        <textarea rows={2} value={form.obs}
                  onChange={e => setForm({ ...form, obs: e.target.value })}
                  placeholder="Ex.: Imobiliária Real Tatuí · Contrato 2024-088" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Começar em">
          <select value={form.inicioEm}
                  onChange={e => setForm({ ...form, inicioEm: e.target.value })}>
            {mesesOpcoes.map(m => <option key={m.iso} value={m.iso}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="Terminar em" hint="Vazio = sem prazo (continua todo ano)">
          <select value={form.terminoEm}
                  onChange={e => setForm({ ...form, terminoEm: e.target.value })}>
            <option value="">Sem prazo</option>
            {mesesOpcoes.map(m => <option key={m.iso} value={m.iso}>{m.label}</option>)}
          </select>
        </Field>
      </div>

      {!editing && (
        <div style={{
          marginTop: 12, padding: 12,
          background: "#3b82f622", border: `1px solid #3b82f655`,
          borderRadius: 14, fontSize: 12, color: T.ink, lineHeight: 1.5,
        }}>
          💡 Serão criadas <strong>{previewN} ocorrências</strong> a partir de {inicioLabel}.
          Cada uma com status <strong>pendente</strong>. Pagamentos não são lançados no banco automaticamente —
          o app pergunta a cada vez.
        </div>
      )}

      {editing && (
        <div style={{
          marginTop: 12, padding: 12,
          background: `${T.gold}11`, border: `1px solid ${T.gold}55`,
          borderRadius: 14, fontSize: 12, color: T.ink,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Aplicar mudança em:</div>
          {[
            { v: "futuras", l: "Próximo mês em diante (não toca no mês atual)" },
            { v: "todas",   l: "Todas as ocorrências pendentes do ano (incluindo este mês)" },
          ].map(opt => (
            <label key={opt.v} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer" }}>
              <input type="radio" name="escopo-edicao"
                     checked={escopoEdicao === opt.v}
                     onChange={() => setEscopoEdicao(opt.v)}
                     style={{ accentColor: T.gold }} />
              <span style={{ fontSize: 12.5 }}>{opt.l}</span>
            </label>
          ))}
          <div style={{ fontSize: 11, color: T.muted, marginTop: 6, fontStyle: "italic" }}>
            Ocorrências já pagas nunca são alteradas (preserva histórico).
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-end mt-5">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-gold" onClick={salvar}>
          <Plus size={13} className="inline mr-1.5" />
          {editing ? "Salvar mudanças" : "Criar fixa"}
        </button>
      </div>
    </Modal>
  );
}
