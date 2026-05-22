import React, { useState, useMemo } from "react";
import { Plus, Trash2, Check, RefreshCw, AlertTriangle } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, uid, todayISO } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import { getContaLojaNome } from "../../../lib/bancoLoja.js";
import PageHeader from "../../ui/PageHeader.jsx";
import Modal from "../../ui/Modal.jsx";
import Field from "../../ui/Field.jsx";

const STATUS = [
  { id: "aguardando",  label: "Aguardando",  cor: T.gold || "#c9a961", bg: "gold" },
  { id: "disponivel",  label: "Disponível",  cor: "#60a5fa",            bg: "info" },
  { id: "compensado",  label: "Compensado",  cor: "#4ade80",            bg: "green" },
  { id: "devolvido",   label: "Devolvido",   cor: "#f87171",            bg: "red" },
  { id: "substituido", label: "Substituído", cor: "#a78bfa",            bg: "purple" },
];

export default function Cheques({
  cheques = [], setCheques,
  contas = [], setContas,
  transacoes = [], setTransacoes,
  devedores = [], setDevedores,
  hidden,
  setTab,
}) {
  const [form, setForm] = useState(null);
  const [trocaForm, setTrocaForm] = useState(null); // { original, novo: {...} }

  // KPIs
  const hoje = todayISO();
  const em7d = new Date(); em7d.setDate(em7d.getDate() + 7);
  const em7dIso = em7d.toISOString().slice(0, 10);

  const kpis = useMemo(() => {
    const ativos = cheques.filter(c => c.status === "aguardando" || c.status === "disponivel");
    const prox7 = ativos.filter(c => c.data <= em7dIso);
    const comp = cheques.filter(c => c.status === "compensado");
    const dev = cheques.filter(c => c.status === "devolvido");
    const sub = cheques.filter(c => c.status === "substituido");
    return {
      ativos: ativos.length,
      ativosValor: ativos.reduce((s, c) => s + (parseFloat(c.valor) || 0), 0),
      prox7: prox7.length,
      prox7Valor: prox7.reduce((s, c) => s + (parseFloat(c.valor) || 0), 0),
      comp: comp.length,
      compValor: comp.reduce((s, c) => s + (parseFloat(c.valor) || 0), 0),
      dev: dev.length,
      devValor: dev.reduce((s, c) => s + (parseFloat(c.valor) || 0), 0),
      sub: sub.length,
      subValor: sub.reduce((s, c) => s + (parseFloat(c.valor) || 0), 0),
    };
  }, [cheques, em7dIso]);

  // Agrupar por mês (somente ativos por padrão)
  const porMes = useMemo(() => {
    const map = new Map();
    cheques.forEach(c => {
      if (!c.data) return;
      const key = c.data.slice(0, 7); // YYYY-MM
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    });
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, list]) => ({
        key,
        list: list.sort((a, b) => a.data.localeCompare(b.data)),
        total: list.reduce((s, c) => s + (parseFloat(c.valor) || 0), 0),
      }));
  }, [cheques]);

  const save = () => {
    if (!form.emitente?.trim() || !form.valor) {
      toast.error("Emitente e valor são obrigatórios.");
      return;
    }
    if (form.id) {
      setCheques(cheques.map(c => c.id === form.id ? form : c));
    } else {
      setCheques([...cheques, { ...form, id: uid() }]);
    }
    setForm(null);
  };

  const del = async (id) => {
    const ok = await confirm({ title: "Excluir este cheque?", danger: true, confirmLabel: "Excluir" });
    if (!ok) return;
    setCheques(cheques.filter(c => c.id !== id));
  };

  // ===== AÇÕES RÁPIDAS =====
  const compensarCheque = (c) => {
    const today = todayISO();
    const valor = parseFloat(c.valor) || 0;
    const contaNome = getContaLojaNome(contas);

    setCheques(cheques.map(x => x.id === c.id
      ? { ...x, status: "compensado", dataCompensacao: today }
      : x));

    if (setTransacoes && contaNome) {
      const tx = {
        id: uid(),
        tipo: "receita",
        descricao: `Cheque #${c.numero || "?"} · ${c.emitente || "—"}`,
        categoria: "Cheque compensado",
        conta: contaNome,
        data: today,
        valor,
        compensado: true,
        fixa: false,
        obs: c.banco ? `Banco: ${c.banco}` : "",
        origemLoja: { tipo: "cheque-compensado", chequeId: c.id },
      };
      setTransacoes([tx, ...transacoes]);
    }
    if (setContas && contaNome) {
      setContas(contas.map(co => co.nome === contaNome
        ? { ...co, saldo: (parseFloat(co.saldo) || 0) + valor }
        : co));
    }
    toast.success(`Cheque #${c.numero || ""} compensado · ${fmt(valor)} creditado em ${contaNome || "—"}.`);
  };

  const abrirTrocaCheque = (c) => {
    setTrocaForm({
      original: c,
      novo: {
        numero: "",
        banco: c.banco || "",
        agencia: c.agencia || "",
        conta: c.conta || "",
        data: c.data || todayISO(),
        valor: c.valor || "",
        emitente: c.emitente || "",
        parcela: c.parcela || "",
      },
    });
  };

  const confirmarTroca = () => {
    if (!trocaForm?.novo?.numero?.trim() || !trocaForm?.novo?.valor) {
      toast.error("Preencha número e valor do novo cheque.");
      return;
    }
    const original = trocaForm.original;
    const novoId = uid();
    const novo = {
      ...trocaForm.novo,
      id: novoId,
      status: "aguardando",
      substituiCheque: original.id,
      obs: `Substitui cheque #${original.numero || "?"} (${original.emitente || "—"})`,
    };
    setCheques([
      ...cheques.map(x => x.id === original.id
        ? { ...x, status: "substituido", substituidoPor: novoId, dataSubstituicao: todayISO() }
        : x),
      novo,
    ]);
    toast.success(`Cheque #${original.numero || ""} substituído por #${novo.numero}.`);
    setTrocaForm(null);
  };

  const devolverCheque = async (c) => {
    const ok = await confirm({
      title: `Marcar cheque #${c.numero || ""} como devolvido?`,
      body: `Vai criar uma entrada em "A Receber" com ${c.emitente || "emitente"} · ${fmt(parseFloat(c.valor) || 0)}.`,
      danger: true, confirmLabel: "Devolver",
    });
    if (!ok) return;
    const today = todayISO();
    const valor = parseFloat(c.valor) || 0;

    setCheques(cheques.map(x => x.id === c.id
      ? { ...x, status: "devolvido", dataDevolucao: today }
      : x));

    if (setDevedores) {
      const novo = {
        id: uid(),
        nome: c.emitente || "Emitente",
        valor,
        vencimento: today,
        categoria: "Cheque devolvido",
        obs: `Cheque #${c.numero || "?"} devolvido em ${today}${c.banco ? ` (${c.banco})` : ""}`,
        recebido: false,
        origemLoja: { tipo: "cheque-devolvido", chequeId: c.id },
      };
      setDevedores([...devedores, novo]);
    }
    toast.success(`Cheque devolvido. Entrada criada em A Receber.`, {
      action: setTab ? {
        label: "Ver em A Receber",
        onClick: () => setTab("areceber"),
      } : undefined,
    });
  };

  const mesLabel = (key) => {
    const [y, m] = key.split("-");
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${meses[parseInt(m, 10) - 1]} · ${y}`;
  };

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Loja AF4 · Carteira"
        title={<>Cheques <em>pré-datados.</em></>}
        sub="Lista agrupada por mês de vencimento · alerta de cheques nos próximos 7 dias."
        action={
          <button className="btn-gold" onClick={() => setForm({
            id: null, numero: "", emitente: "", banco: "", agencia: "", conta: "",
            data: todayISO(), valor: "", parcela: "", status: "aguardando", obs: "",
          })}>
            <Plus size={14} className="inline mr-1.5" /> Novo Cheque
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px mb-6" style={{ background: T.border }}>
        <div style={{ background: T.card, padding: 16 }}>
          <div className="label-eyebrow">Ativos</div>
          <div className="num" style={{ fontSize: 22, color: T.ink, fontWeight: 300, marginTop: 8 }}>
            {kpis.ativos}
          </div>
          <div style={{ fontSize: 10, color: T.faint, marginTop: 4 }}>{hidden ? "•••" : fmt(kpis.ativosValor)}</div>
        </div>
        <div style={{ background: T.card, padding: 16 }}>
          <div className="label-eyebrow">Próx. 7 dias</div>
          <div className="num" style={{ fontSize: 22, color: kpis.prox7 > 0 ? T.gold : T.muted, fontWeight: 300, marginTop: 8 }}>
            {kpis.prox7}
          </div>
          <div style={{ fontSize: 10, color: T.faint, marginTop: 4 }}>
            {hidden ? "•••" : fmt(kpis.prox7Valor)} {kpis.prox7 > 0 ? "· ⚠" : ""}
          </div>
        </div>
        <div style={{ background: T.card, padding: 16 }}>
          <div className="label-eyebrow">Compensados</div>
          <div className="num" style={{ fontSize: 22, color: T.green, fontWeight: 300, marginTop: 8 }}>
            {kpis.comp}
          </div>
          <div style={{ fontSize: 10, color: T.faint, marginTop: 4 }}>{hidden ? "•••" : fmt(kpis.compValor)}</div>
        </div>
        <div style={{ background: T.card, padding: 16 }}>
          <div className="label-eyebrow">Devolvidos</div>
          <div className="num" style={{ fontSize: 22, color: kpis.dev > 0 ? T.red : T.faint, fontWeight: 300, marginTop: 8 }}>
            {kpis.dev}
          </div>
          <div style={{ fontSize: 10, color: T.faint, marginTop: 4 }}>{hidden ? "•••" : fmt(kpis.devValor)}</div>
        </div>
        <div style={{ background: T.card, padding: 16 }}>
          <div className="label-eyebrow">Substituídos</div>
          <div className="num" style={{ fontSize: 22, color: kpis.sub > 0 ? "#a78bfa" : T.faint, fontWeight: 300, marginTop: 8 }}>
            {kpis.sub}
          </div>
          <div style={{ fontSize: 10, color: T.faint, marginTop: 4 }}>{hidden ? "•••" : fmt(kpis.subValor)}</div>
        </div>
      </div>

      {/* Lista por mês */}
      {porMes.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: T.muted, fontStyle: "italic", border: `1px dashed ${T.border}`, borderRadius: 10 }}>
          Nenhum cheque cadastrado. Clique em "Novo Cheque" pra começar.
        </div>
      ) : porMes.map(({ key, list, total }) => (
        <div key={key} className="mb-6">
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", marginBottom: 8, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.ink, letterSpacing: ".05em", textTransform: "uppercase" }}>
              {mesLabel(key)}
            </div>
            <div style={{ marginLeft: "auto", fontSize: 11, color: T.muted }}>
              {list.length} cheques · {hidden ? "•••" : fmt(total)}
            </div>
          </div>
          {list.map(c => {
            const st = STATUS.find(s => s.id === c.status) || STATUS[0];
            const prox = c.data <= em7dIso && (c.status === "aguardando");
            return (
              <div key={c.id} style={{
                display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                padding: "10px 0", borderBottom: `1px dashed ${T.border}`,
                fontSize: 12.5, cursor: "pointer", transition: "background .15s",
              }}
                   onMouseEnter={e => e.currentTarget.style.background = T.bgSoft}
                   onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                   onClick={() => setForm(c)}>
                <div className="hide-mobile" style={{ width: 80, flexShrink: 0, fontSize: 11, color: T.faint, fontFamily: "monospace" }}>
                  {c.numero ? `#${c.numero}` : "—"}
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ color: T.ink, fontWeight: 500 }}>{c.emitente}</div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>
                    {[c.banco, c.agencia && `Ag ${c.agencia}`, c.conta && `CC ${c.conta}`, c.numero && `#${c.numero}`].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <div style={{ minWidth: 70, fontSize: 11, color: prox ? T.gold : T.muted, fontWeight: prox ? 500 : 400 }}>
                  {c.data ? c.data.slice(8, 10) + "/" + c.data.slice(5, 7) : "—"}
                  {c.parcela && <span style={{ color: T.faint, marginLeft: 4 }}>· {c.parcela}</span>}
                </div>
                <div style={{ minWidth: 90, fontVariantNumeric: "tabular-nums", fontWeight: 500, textAlign: "right" }}>
                  {hidden ? "•••" : fmt(parseFloat(c.valor) || 0)}
                </div>
                <div style={{ minWidth: 110, textAlign: "right" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 9, padding: "3px 9px", borderRadius: 100,
                    letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 500,
                    background: `${st.cor}22`, color: st.cor, border: `1px solid ${st.cor}55`,
                  }}>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: st.cor }} />
                    {st.label}
                  </span>
                </div>

                {c.status === "aguardando" && (
                  <div style={{ display: "inline-flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                    <button title="Compensar · cria receita na Banco da Loja"
                            onClick={() => compensarCheque(c)}
                            style={chequeActionBtn(T.green)}>
                      <Check size={11} /> Compensar
                    </button>
                    <button title="Trocar por outro cheque"
                            onClick={() => abrirTrocaCheque(c)}
                            style={chequeActionBtn("#a78bfa")}>
                      <RefreshCw size={11} /> Trocar
                    </button>
                    <button title="Marcar como devolvido · cria entrada em A Receber"
                            onClick={() => devolverCheque(c)}
                            style={chequeActionBtn(T.red)}>
                      <AlertTriangle size={11} /> Devolver
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Modal trocar cheque */}
      {trocaForm && (
        <Modal title={`🔄 Substituir cheque #${trocaForm.original.numero || ""}`} onClose={() => setTrocaForm(null)}>
          <div style={{ padding: 12, marginBottom: 14, background: T.bgSoft, borderRadius: 7, fontSize: 12 }}>
            <div style={{ color: T.muted }}>Cheque original</div>
            <div style={{ marginTop: 4 }}>
              <strong>{trocaForm.original.emitente}</strong> · #{trocaForm.original.numero || "—"}
              {trocaForm.original.banco && ` · ${trocaForm.original.banco}`} ·{" "}
              <span className="num">{fmt(parseFloat(trocaForm.original.valor) || 0)}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Novo número" required>
              <input value={trocaForm.novo.numero}
                     onChange={e => setTrocaForm({ ...trocaForm, novo: { ...trocaForm.novo, numero: e.target.value } })}
                     placeholder="000124" />
            </Field>
            <Field label="Novo banco">
              <input value={trocaForm.novo.banco}
                     onChange={e => setTrocaForm({ ...trocaForm, novo: { ...trocaForm.novo, banco: e.target.value } })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nova data">
              <input type="date" value={trocaForm.novo.data}
                     onChange={e => setTrocaForm({ ...trocaForm, novo: { ...trocaForm.novo, data: e.target.value } })} />
            </Field>
            <Field label="Novo valor (R$)" required hint={`Sugerido: ${fmt(parseFloat(trocaForm.original.valor) || 0)}`}>
              <input type="number" step="0.01" value={trocaForm.novo.valor}
                     onChange={e => setTrocaForm({ ...trocaForm, novo: { ...trocaForm.novo, valor: e.target.value } })} />
            </Field>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button className="btn-ghost" onClick={() => setTrocaForm(null)}>Cancelar</button>
            <button className="btn-gold" onClick={confirmarTroca}>Confirmar troca</button>
          </div>
        </Modal>
      )}

      {/* Modal cheque */}
      {form && (
        <Modal title={form.id ? "Editar Cheque" : "Novo Cheque"} onClose={() => setForm(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Número do cheque">
              <input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} placeholder="000123" />
            </Field>
            <Field label="Status">
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STATUS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Emitente" required>
            <input value={form.emitente} onChange={e => setForm({ ...form, emitente: e.target.value })} placeholder="Nome de quem emitiu" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Banco">
              <input value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })} placeholder="Itaú" />
            </Field>
            <Field label="Agência">
              <input value={form.agencia} onChange={e => setForm({ ...form, agencia: e.target.value })} placeholder="1234" />
            </Field>
            <Field label="Conta">
              <input value={form.conta} onChange={e => setForm({ ...form, conta: e.target.value })} placeholder="56789-0" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Data" required>
              <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
            </Field>
            <Field label="Valor (R$)" required>
              <input type="number" step="0.01" value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="5000.00" />
            </Field>
            <Field label="Parcela">
              <input value={form.parcela} onChange={e => setForm({ ...form, parcela: e.target.value })} placeholder="1/3" />
            </Field>
          </div>
          <Field label="Observações">
            <textarea value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} rows={2} placeholder="Notas sobre o cheque…" />
          </Field>
          <div className="flex gap-2 justify-between mt-4">
            {form.id ? (
              <button className="btn-ghost" onClick={() => { del(form.id); setForm(null); }} style={{ color: T.red, borderColor: T.red }}>
                <Trash2 size={12} className="inline mr-1" /> Excluir
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn-gold" onClick={save}>Salvar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

const chequeActionBtn = (cor) => ({
  display: "inline-flex", alignItems: "center", gap: 4,
  background: `${cor}1a`, color: cor,
  border: `1px solid ${cor}55`, borderRadius: 6,
  padding: "5px 9px", fontSize: 10, fontWeight: 600,
  letterSpacing: ".05em", cursor: "pointer", whiteSpace: "nowrap",
});
