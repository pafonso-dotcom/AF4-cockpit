import React, { useState, useMemo } from "react";
import { Plus, Trash2, Edit3, Building2, Receipt, ArrowRightLeft, ChevronRight, RefreshCw, AlertCircle, Eye, EyeOff } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, uid } from "../../lib/format.js";
import { parseValorBR } from "../../lib/importExport.js";
import { confirm } from "../../lib/confirm.js";
import { toast } from "../../lib/toast.js";
import { calcSaldoConta, reconciliarContas } from "../../lib/saldoConta.js";
import { filtrarPorEscopo } from "../../lib/escopo.js";
import Field from "../ui/Field.jsx";
import ColorPicker from "../ui/ColorPicker.jsx";
import Modal from "../ui/Modal.jsx";
import TransferenciaModal from "../modals/TransferenciaModal.jsx";

export default function Contas({ contas, setContas, hidden, onCreateTransacao, onContaClick, contaAtiva, transacoes, setTransacoes, categorias, escopoAtivo = "tudo" }) {
  const [form, setForm] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const tipos = [
    { v: "corrente", l: "Conta Corrente" },
    { v: "poupanca", l: "Poupança" },
    { v: "investimento", l: "Investimento" },
    { v: "cripto", l: "Carteira Cripto" },
    { v: "carteira", l: "Carteira Física" },
  ];

  const [formErrors, setFormErrors] = useState({});

  // Ocultar contas zeradas (persistido em localStorage)
  const [ocultarZeradas, setOcultarZeradas] = useState(() => {
    try { return localStorage.getItem("af4:ocultar-zeradas") === "1"; }
    catch { return false; }
  });
  const toggleOcultarZeradas = () => {
    const novo = !ocultarZeradas;
    try { localStorage.setItem("af4:ocultar-zeradas", novo ? "1" : "0"); } catch {}
    setOcultarZeradas(novo);
  };
  const contasNoEscopo = filtrarPorEscopo(contas || [], escopoAtivo);
  const contasVisiveis = ocultarZeradas
    ? contasNoEscopo.filter(c => Math.abs(Number(c.saldo) || 0) > 0.01)
    : contasNoEscopo;

  const save = () => {
    const errs = {};
    if (!form.nome?.trim()) errs.nome = "Nome é obrigatório";
    else if (form.nome.length > 60) errs.nome = "Máximo 60 caracteres";
    if (!form.instituicao?.trim()) errs.instituicao = "Instituição é obrigatória";

    // Parse robusto: aceita "1.500,00", "1500,00", "1500", "R$ 1.234,56", negativos
    const saldoParsed = parseValorBR(form.saldo);
    if (form.saldo == null || form.saldo === "" || isNaN(saldoParsed)) {
      errs.saldo = "Saldo inválido (use ex.: 1500 ou 1.500,00)";
    }

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }

    // Grava o valor digitado como saldoInicial e recalcula o saldo atual
    // (saldoInicial + soma das transações compensadas dessa conta).
    // Isso garante que o saldo fique sempre consistente com as transações.
    const txsExistentes = (transacoes || []).filter(t => t.conta === form.nome && t.compensado);
    const somaTx = txsExistentes.reduce(
      (s, t) => s + (t.tipo === "receita" ? Number(t.valor) : -Number(t.valor)),
      0
    );
    const novoSaldo = saldoParsed + somaTx;
    const formNormalizado = { ...form, saldoInicial: saldoParsed, saldo: novoSaldo };

    if (form.id && contas.find(c => c.id === form.id)) {
      setContas(contas.map(c => c.id === form.id ? formNormalizado : c));
      toast.success(`Conta atualizada · saldo inicial ${fmt(saldoParsed)} → atual ${fmt(novoSaldo)}.`);
    } else {
      setContas([...contas, { ...formNormalizado, id: uid() }]);
      toast.success(`Conta "${form.nome}" criada com saldo ${fmt(novoSaldo)}.`);
    }
    setForm(null);
    setFormErrors({});
  };

  const total = contas.reduce((s, c) => s + Number(c.saldo || 0), 0);

  // Detecta contas dessincronizadas (saldo armazenado != saldo calculado por transações)
  const dessincronizadas = useMemo(() => {
    if (!transacoes) return [];
    return contas
      .map(c => {
        const calculado = calcSaldoConta(c, transacoes);
        const armazenado = Number(c.saldo) || 0;
        const delta = calculado - armazenado;
        return { conta: c, calculado, armazenado, delta };
      })
      .filter(x => Math.abs(x.delta) > 0.005 && x.conta.saldoInicial != null);
  }, [contas, transacoes]);

  const reconciliar = async () => {
    const ok = await confirm({
      title: "Recalcular saldos?",
      body: `Vai zerar os saldos atuais e recalcular cada conta a partir do saldoInicial + transações compensadas. Útil pra corrigir contas que dessincronizaram.`,
      confirmLabel: "Recalcular",
    });
    if (!ok) return;
    const { contas: novaLista, mudancas } = reconciliarContas(contas, transacoes || []);
    setContas(novaLista);
    if (mudancas.length === 0) {
      toast.info("Nenhuma conta precisava de ajuste — todos os saldos batem.");
    } else {
      toast.success(`${mudancas.length} conta${mudancas.length > 1 ? "s" : ""} reconciliada${mudancas.length > 1 ? "s" : ""}: ` +
        mudancas.map(m => `${m.nome} (${m.delta > 0 ? "+" : ""}${fmt(m.delta)})`).join(", "));
    }
  };

  const btnSec = {
    background: "transparent", border: `1px solid ${T.border}`,
    padding: "7px 12px", fontFamily: T.sans, fontSize: 11,
    letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600,
    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
    borderRadius: 6, color: T.muted, whiteSpace: "nowrap",
  };

  return (
    <div className="fade-up py-8">
      {/* Cabeçalho compacto — botões abaixo do título (cabe na coluna estreita) */}
      <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${T.border}` }}>
        <div className="label-eyebrow">Capítulo I</div>
        <h2 style={{ fontFamily: T.serif, fontSize: 26, color: T.ink, marginTop: 4, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
          Contas
        </h2>
        <div style={{ color: T.muted, fontSize: 12, marginTop: 4, fontStyle: "italic" }}>
          Cada conta é uma página do seu balanço.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {contas.length >= 2 && (
            <button onClick={() => setTransferOpen(true)}
                    style={{ ...btnSec, color: T.gold, borderColor: T.gold }}>
              <ArrowRightLeft size={12} /> Transferir
            </button>
          )}
          <button onClick={reconciliar}
                  title="Recalcula o saldo de cada conta a partir do saldoInicial + transações"
                  style={btnSec}>
            <RefreshCw size={12} /> Reconciliar
          </button>
          <button className="btn-gold" style={{ padding: "7px 12px", fontSize: 11 }}
                  onClick={() => setForm({ id: null, nome: "", instituicao: "", tipo: "corrente", escopo: escopoAtivo === "negocio" ? "negocio" : "pessoal", saldo: "", cor: T.gold })}>
            <Plus size={13} className="inline mr-1.5" />Nova Conta
          </button>
        </div>
      </div>

      {/* Aviso de contas dessincronizadas */}
      {dessincronizadas.length > 0 && (
        <div style={{
          background: `${T.red}11`, border: `1px solid ${T.red}55`, borderLeft: `4px solid ${T.red}`,
          borderRadius: 8, padding: "12px 16px", marginBottom: 16,
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          <AlertCircle size={18} style={{ color: T.red, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 200, fontSize: 12.5 }}>
            <div style={{ color: T.red, fontWeight: 600 }}>
              {dessincronizadas.length} {dessincronizadas.length === 1 ? "conta" : "contas"} dessincronizada{dessincronizadas.length === 1 ? "" : "s"}
            </div>
            <div style={{ color: T.muted, marginTop: 2, fontSize: 11.5 }}>
              {dessincronizadas.map(d =>
                `${d.conta.nome}: armazenado ${fmt(d.armazenado)} ≠ calculado ${fmt(d.calculado)} (Δ ${d.delta > 0 ? "+" : ""}${fmt(d.delta)})`
              ).join(" · ")}
            </div>
          </div>
          <button onClick={reconciliar} className="btn-gold" style={{ padding: "8px 14px", fontSize: 11 }}>
            <RefreshCw size={11} className="inline mr-1.5" /> Corrigir agora
          </button>
        </div>
      )}

      {/* Total compacto */}
      <div style={{
        marginBottom: 10, padding: "8px 12px",
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
        display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 9, letterSpacing: ".15em", color: T.muted, textTransform: "uppercase", fontWeight: 700 }}>
            Total
          </span>
          <span className="num" style={{ fontFamily: T.serif, fontSize: 22, color: T.gold, lineHeight: 1 }}>
            {hidden ? "R$ •••••" : fmt(total)}
          </span>
          <span className="num" style={{ fontSize: 10.5, color: T.faint }}>
            · {contas.length} {contas.length === 1 ? "conta" : "contas"}
          </span>
        </div>
        <button onClick={toggleOcultarZeradas}
          style={{
            background: "transparent", border: `1px solid ${T.border}`,
            color: T.muted, padding: "4px 9px", borderRadius: 5,
            fontSize: 9.5, letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 600,
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap",
          }}>
          {ocultarZeradas
            ? <><Eye size={10} /> Mostrar zeradas</>
            : <><EyeOff size={10} /> Ocultar zeradas</>}
        </button>
      </div>

      {/* Grid denso · auto-fill 200px+ */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 6,
      }}>
        {contasVisiveis.map(c => {
          const ativa = contaAtiva?.id === c.id;
          return (
          <div key={c.id} className="card-hover"
               onClick={() => onContaClick && onContaClick(c)}
               role={onContaClick ? "button" : undefined}
               tabIndex={onContaClick ? 0 : undefined}
               onKeyDown={(e) => { if (onContaClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onContaClick(c); } }}
               style={{
                 background: ativa ? `${T.gold}10` : T.card,
                 border: `${ativa ? 2 : 1}px solid ${ativa ? T.gold : T.border}`,
                 borderTop: `3px solid ${c.cor || T.gold}`,
                 borderRadius: 8, padding: 9,
                 cursor: onContaClick ? "pointer" : "default",
                 transition: "all .15s",
                 display: "flex", flexDirection: "column", gap: 2,
               }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{
                fontSize: 9, letterSpacing: ".15em", color: T.muted,
                textTransform: "uppercase", fontWeight: 600,
              }}>
                {tipos.find(t => t.v === c.tipo)?.l || c.tipo}
              </div>
              <Building2 size={13} style={{ color: T.faint }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-.01em", color: T.ink, marginTop: 1 }}>{c.nome}</div>
            {c.instituicao && (
              <div style={{ fontSize: 10, color: T.muted, fontStyle: "italic" }}>{c.instituicao}</div>
            )}
            <div className="num" style={{
              fontFamily: T.serif, fontSize: 17, fontWeight: 400,
              marginTop: 2, color: c.saldo < 0 ? T.red : T.ink, lineHeight: 1.15,
            }}>
              {hidden ? "•••••" : fmt(c.saldo)}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              {onContaClick && (
                <button onClick={(e) => { e.stopPropagation(); onContaClick(c); }}
                  style={{
                    flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: 600,
                    letterSpacing: ".05em", textTransform: "uppercase",
                    borderRadius: 4, background: "transparent",
                    border: `1px solid ${T.border}`, color: T.muted, cursor: "pointer",
                  }}>
                  Extrato
                </button>
              )}
              {onCreateTransacao && (
                <button onClick={(e) => { e.stopPropagation(); onCreateTransacao(c.nome); }}
                  style={{
                    flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: 600,
                    letterSpacing: ".05em", textTransform: "uppercase",
                    borderRadius: 4, background: T.gold,
                    border: "none", color: T.bg, cursor: "pointer",
                  }}>
                  + Tx
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
              <button onClick={(e) => {
                          e.stopPropagation();
                          setForm({ ...c, saldo: c.saldoInicial != null ? c.saldoInicial : c.saldo });
                        }}
                      style={{
                        flex: 1, padding: "3px", fontSize: 9, background: "transparent",
                        border: "none", color: T.muted, cursor: "pointer",
                        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3,
                      }}>
                <Edit3 size={10} /> editar
              </button>
              <button onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await confirm({
                            title: `Excluir "${c.nome}"?`,
                            body: `A conta será removida. Transações ligadas a ela continuam mas ficam sem conta vinculada.`,
                            danger: true, confirmLabel: "Excluir",
                          });
                          if (!ok) return;
                          setContas(contas.filter(x => x.id !== c.id));
                          toast.success(`${c.nome} excluída.`);
                        }}
                      style={{
                        flex: 1, padding: "3px", fontSize: 9, background: "transparent",
                        border: "none", color: T.red, cursor: "pointer",
                        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 3,
                      }}>
                <Trash2 size={10} /> excluir
              </button>
            </div>
          </div>
          );
        })}
      </div>

      {form && (
        <Modal title={form.id ? "Editar Conta" : "Abrir Nova Conta"} onClose={() => setForm(null)}>
          <Field label="Nome" required error={formErrors.nome}>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Conta Principal" />
          </Field>
          <Field label="Instituição" required error={formErrors.instituicao}>
            <input value={form.instituicao} onChange={e => setForm({ ...form, instituicao: e.target.value })} placeholder="Ex.: Itaú, Nubank, XP…" />
          </Field>
          <Field label="Tipo">
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
              {tipos.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </Field>
          <Field label="Escopo" hint="Pessoal ou Negócio — separação financeira">
            <select value={form.escopo || "pessoal"} onChange={e => setForm({ ...form, escopo: e.target.value })}>
              <option value="pessoal">👤 Pessoal</option>
              <option value="negocio">🏢 Negócio</option>
            </select>
          </Field>
          <Field label="Saldo inicial (R$)" error={formErrors.saldo} hint="Aceita: 1500 · 1500,00 · 1.500,00 · R$ 1.234,56 · negativos pra dívida">
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={form.saldo == null ? "" : String(form.saldo)}
              onChange={e => setForm({ ...form, saldo: e.target.value })}
              placeholder="Ex.: 1.500,00 ou 1500"
            />
          </Field>
          <Field label="Cor">
            <ColorPicker value={form.cor} onChange={cor => setForm({ ...form, cor })} />
          </Field>
          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={save}>Salvar</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}

      {transferOpen && (
        <TransferenciaModal
          contas={contas}
          setContas={setContas}
          transacoes={transacoes}
          setTransacoes={setTransacoes}
          categorias={categorias}
          onClose={() => setTransferOpen(false)}
        />
      )}
    </div>
  );
}
