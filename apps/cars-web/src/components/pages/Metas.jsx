import React, { useState } from "react";
import { Plus, Trash2, Edit3, Repeat, CheckCircle2, PiggyBank } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, fmtN, uid, todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import { gerarOcorrencias } from "../../lib/fixas.js";
import { parseValorBR } from "../../lib/importExport.js";
import PageHeader from "../ui/PageHeader.jsx";
import Field from "../ui/Field.jsx";
import Modal from "../ui/Modal.jsx";

// Calcula meses entre hoje e uma data alvo (YYYY-MM-DD ou YYYY-MM)
function mesesAteData(dataAlvoISO) {
  if (!dataAlvoISO) return 0;
  const hoje = new Date();
  const alvo = new Date((dataAlvoISO.length === 7 ? dataAlvoISO + "-01" : dataAlvoISO) + "T00:00:00");
  return Math.max(0, (alvo.getFullYear() - hoje.getFullYear()) * 12 + (alvo.getMonth() - hoje.getMonth()));
}

export default function Metas({
  metas, setMetas, hidden,
  fixas = [], setFixas, fixaOcorrencias = [], setFixaOcorrencias,
  categorias = [], contas = [], setContas,
  transacoes = [], setTransacoes,
}) {
  const [form, setForm] = useState(null);
  const [resgate, setResgate] = useState(null); // { meta, valor, conta } — modal de uso/resgate

  const calc = (m) => {
    // tempo necessário com juros compostos para atingir alvo
    const r = m.taxa / 100;
    const PV = m.atual;
    const PMT = m.aporte;
    const FV = m.alvo;
    if (PMT <= 0 && PV >= FV) return { mesesNecessarios: 0, projetado: PV };
    let saldo = PV;
    let n = 0;
    while (saldo < FV && n < 1200) {
      saldo = saldo * (1 + r) + PMT;
      n++;
    }
    // projetado no prazo
    let proj = PV;
    for (let i = 0; i < m.prazo; i++) proj = proj * (1 + r) + PMT;
    return { mesesNecessarios: n, projetado: proj };
  };

  const [formErrors, setFormErrors] = useState({});

  // Cria uma despesa fixa recorrente atrelada à meta — uma "poupança automática".
  // Funciona como um agendamento mensal até a data alvo. Marca a meta como tendo
  // fixaId pra evitar duplicação.
  const criarFixaDaMeta = async (m) => {
    if (m.fixaId && fixas.find(f => f.id === m.fixaId)) {
      toast.info(`Meta "${m.nome}" já tem uma poupança automática.`);
      return;
    }
    if (!setFixas || !setFixaOcorrencias) {
      toast.error("Não foi possível criar a poupança (módulo fixas indisponível).");
      return;
    }
    const meses = m.dataAlvo ? mesesAteData(m.dataAlvo) : m.prazo;
    if (!meses || meses <= 0) {
      toast.error("Defina uma data ou prazo válido na meta.");
      return;
    }
    const falta = Math.max(0, (m.alvo || 0) - (m.atual || 0));
    const valorMensal = Math.ceil(falta / meses);
    if (valorMensal <= 0) {
      toast.info("Meta já está alcançada — sem necessidade de poupança automática.");
      return;
    }
    const catReserva = (categorias || []).find(c =>
      c.tipo === "despesa" && /reserva|meta|poupan/i.test(c.nome || "")
    );
    const categoria = catReserva?.nome || (categorias || []).filter(c => c.tipo === "despesa")[0]?.nome || "Outros";
    const conta = contas[0]?.nome || "";
    const ok = await confirm({
      title: `Criar poupança automática?`,
      body: `Vai criar uma despesa fixa de ${fmt(valorMensal)}/mês durante ${meses} meses pra meta "${m.nome}". Categoria: ${categoria}. Pode cancelar depois em Despesas Fixas.`,
      confirmLabel: "Criar",
    });
    if (!ok) return;
    const hojeISO = new Date().toISOString().slice(0, 10);
    const anoAtual = parseInt(hojeISO.slice(0, 4), 10);
    const mesAtualISO = hojeISO.slice(0, 7);
    // Calcula terminoEm = mês atual + meses-1
    const fim = new Date(); fim.setMonth(fim.getMonth() + meses - 1);
    const terminoEm = `${fim.getFullYear()}-${String(fim.getMonth() + 1).padStart(2, "0")}`;
    const novaFixa = {
      id: `fixa-${Date.now()}`,
      descricao: `Meta: ${m.nome}`,
      valor: valorMensal,
      diaVencimento: 5,
      categoria,
      contaPadrao: conta,
      obs: `Poupança automática pra meta "${m.nome}" — encerra em ${terminoEm}.`,
      inicioEm: mesAtualISO,
      terminoEm,
      metaId: m.id,
      criadoEm: hojeISO,
    };
    const ocorrencias = gerarOcorrencias(novaFixa, anoAtual);
    setFixas([...(fixas || []), novaFixa]);
    setFixaOcorrencias([...(fixaOcorrencias || []), ...ocorrencias]);
    setMetas(metas.map(x => x.id === m.id ? { ...x, fixaId: novaFixa.id, aporte: valorMensal, prazo: meses } : x));
    toast.success(`Poupança de ${fmt(valorMensal)}/mês criada em Despesas Fixas pra "${m.nome}".`);
  };

  // Nome do cofrinho de uma meta (mesma convenção do aporte em AReceberEDividas).
  const cofreNomeDe = (m) => `🐷 ${m.nome}`;
  const cofreDe = (m) => (contas || []).find(c => c.nome === cofreNomeDe(m));

  // FASE 3 — Resgatar / usar a meta.
  // modo "usar": o dinheiro foi gasto (comprou a viagem) → vira DESPESA real,
  //   sai do cofrinho e do patrimônio.
  // modo "devolver": realocação de volta pra uma conta normal → transferência
  //   (não é gasto; patrimônio intacto).
  const confirmarResgate = () => {
    const m = resgate.meta;
    const cofre = cofreDe(m);
    const valor = parseValorBR(resgate.valor) || 0;
    const disponivel = Number(cofre?.saldo) || 0;
    if (!cofre) { toast.error("Esta meta ainda não tem cofrinho (faça ao menos um aporte)."); return; }
    if (!(valor > 0)) { toast.error("Informe um valor válido."); return; }
    if (valor > disponivel + 0.005) { toast.error(`Máximo disponível no cofrinho: ${fmt(disponivel)}.`); return; }
    const hojeISO = todayISO();
    const novoAtual = Math.max(0, +(((Number(m.atual) || 0) - valor)).toFixed(2));

    if (resgate.modo === "usar") {
      // Gasto real: debita o cofrinho e cria 1 despesa (sai do patrimônio).
      setContas?.((contas || []).map(c => c.id === cofre.id
        ? { ...c, saldo: +(((Number(c.saldo) || 0) - valor)).toFixed(2) } : c));
      const tx = {
        id: uid(), tipo: "despesa", valor, descricao: `Uso da meta: ${m.nome}`,
        categoria: resgate.categoria || "Outros", conta: cofre.nome, data: hojeISO,
        compensado: true, fixa: false, vencimento: null,
        obs: resgate.obs || `Resgate/uso da meta "${m.nome}"`,
      };
      setTransacoes?.([tx, ...(transacoes || [])]);
      setMetas(metas.map(x => x.id === m.id ? { ...x, atual: novoAtual } : x));
      toast.success(`Usou ${fmt(valor)} da meta "${m.nome}". Virou despesa real.`);
    } else {
      // Devolução: transferência cofrinho → conta normal (não é gasto).
      const destino = (contas || []).find(c => c.nome === resgate.contaDestino);
      if (!destino) { toast.error("Selecione a conta de destino."); return; }
      const transferId = uid();
      const catTransf = (categorias || []).find(c => /transfer/i.test(c.nome || ""))?.nome || "";
      setContas?.((contas || []).map(c => {
        if (c.id === cofre.id)   return { ...c, saldo: +(((Number(c.saldo) || 0) - valor)).toFixed(2) };
        if (c.id === destino.id) return { ...c, saldo: +(((Number(c.saldo) || 0) + valor)).toFixed(2) };
        return c;
      }));
      const txSaida = {
        id: uid(), tipo: "despesa", valor, descricao: `Resgate de ${cofre.nome}`,
        categoria: catTransf, conta: cofre.nome, data: hojeISO, compensado: true,
        fixa: false, vencimento: null, transferenciaId: transferId, obs: resgate.obs || "Resgate de meta",
      };
      const txEntrada = {
        id: uid(), tipo: "receita", valor, descricao: `Resgate da meta ${m.nome}`,
        categoria: catTransf, conta: destino.nome, data: hojeISO, compensado: true,
        fixa: false, vencimento: null, transferenciaId: transferId, obs: resgate.obs || "Resgate de meta",
      };
      setTransacoes?.([txSaida, txEntrada, ...(transacoes || [])]);
      setMetas(metas.map(x => x.id === m.id ? { ...x, atual: novoAtual } : x));
      toast.success(`Devolveu ${fmt(valor)} de "${m.nome}" pra ${destino.nome}.`);
    }
    setResgate(null);
  };

  const save = () => {
    const errs = {};
    if (!form.nome?.trim()) errs.nome = "Nome é obrigatório";
    if (!form.alvo || parseFloat(form.alvo) <= 0) errs.alvo = "Valor alvo deve ser positivo";

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }

    const data = {
      ...form,
      alvo: parseFloat(form.alvo),
      atual: parseFloat(form.atual),
      prazo: parseInt(form.prazo),
      aporte: parseFloat(form.aporte),
      taxa: parseFloat(form.taxa),
      dataAlvo: form.dataAlvo || null,
    };
    if (form.id && metas.find(m => m.id === form.id)) {
      setMetas(metas.map(m => m.id === form.id ? data : m));
      toast.success("Meta atualizada.");
    } else {
      setMetas([...metas, { ...data, id: uid() }]);
      toast.success(`Meta "${data.nome}" criada.`);
    }
    setForm(null);
    setFormErrors({});
  };

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Capítulo VII"
        title="Metas"
        sub="Promessas que viram patrimônio. Calcule, projete, persiga."
        action={<button className="btn-gold" onClick={() => setForm({ id: null, nome: "", alvo: "", atual: 0, prazo: 12, aporte: 500, taxa: 0.85, dataAlvo: "" })}>
          <Plus size={14} className="inline mr-2" />Nova Meta
        </button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {metas.length === 0 && (
          <div className="md:col-span-2 text-center py-12" style={{ color: T.muted, fontStyle: "italic" }}>
            Nenhuma meta cadastrada.
          </div>
        )}
        {metas.map(m => {
          const { mesesNecessarios, projetado } = calc(m);
          const pct = Math.min(100, (m.atual / m.alvo) * 100);
          const ok = projetado >= m.alvo;
          return (
            <div key={m.id} style={{ background: T.card, border: `1px solid ${T.border}`, padding: 28 }}>
              <div className="flex items-baseline justify-between mb-2">
                <div className="label-eyebrow">{ok ? "No ritmo certo" : "Acelerar aporte"}</div>
                <div className="flex gap-2">
                  <button onClick={() => setForm(m)} aria-label={`Editar meta ${m.nome}`} style={{ color: T.muted }}><Edit3 size={14} /></button>
                  <button onClick={async () => {
                            const ok = await confirm({
                              title: `Excluir meta "${m.nome}"?`,
                              danger: true, confirmLabel: "Excluir",
                            });
                            if (!ok) return;
                            const backup = metas;
                            setMetas(metas.filter(x => x.id !== m.id));
                            toast.success(`Meta "${m.nome}" excluída.`, {
                              action: { label: "Desfazer", onClick: () => setMetas(backup) },
                            });
                          }}
                          style={{ color: T.red }}><Trash2 size={14} /></button>
                </div>
              </div>
              <h3 style={{ fontFamily: T.serif, fontSize: 28, color: T.ink, lineHeight: 1.1 }}>{m.nome}</h3>
              <div className="num text-sm mt-2" style={{ color: T.muted }}>
                {hidden ? "•••" : fmt(m.atual)} <span style={{ color: T.faint }}>de</span> {hidden ? "•••" : fmt(m.alvo)}
              </div>
              <div className="mt-4" style={{ background: T.border, height: 8 }}>
                <div style={{ width: `${pct}%`, background: T.gold, height: "100%", transition: "width 0.6s" }} />
              </div>
              <div className="num text-right text-xs mt-1" style={{ color: T.gold }}>{fmtN(pct, 1)}%</div>

              {(() => {
                const fixaJa = m.fixaId && (fixas || []).find(f => f.id === m.fixaId);
                if (fixaJa) {
                  return (
                    <div style={{
                      marginTop: 14, padding: 10, background: `${T.green}11`,
                      border: `1px solid ${T.green}33`, borderRadius: 6,
                      fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <CheckCircle2 size={14} style={{ color: T.green, flexShrink: 0 }} />
                      Poupança automática ativa em Despesas Fixas — <strong className="num" style={{ color: T.ink }}>{fmt(fixaJa.valor)}/mês</strong>
                    </div>
                  );
                }
                if (!setFixas) return null;
                return (
                  <button onClick={() => criarFixaDaMeta(m)}
                          style={{
                            marginTop: 14, width: "100%",
                            background: T.gold, color: T.bg,
                            border: "none", padding: "8px 14px", borderRadius: 6,
                            fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                            letterSpacing: ".05em", textTransform: "uppercase",
                            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                          }}>
                    <Repeat size={12} /> Criar poupança automática
                  </button>
                );
              })()}

              {/* Cofrinho da meta — saldo guardado + botão de usar/resgatar */}
              {(() => {
                const cofre = cofreDe(m);
                const saldoCofre = Number(cofre?.saldo) || 0;
                if (!cofre || saldoCofre <= 0.005) return null;
                return (
                  <div style={{
                    marginTop: 12, padding: 12, borderRadius: 8,
                    background: `${T.gold}11`, border: `1px solid ${T.gold}33`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 11.5, color: T.muted, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <PiggyBank size={14} style={{ color: T.gold }} /> Guardado no cofrinho
                      </span>
                      <span className="num" style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>
                        {hidden ? "•••" : fmt(saldoCofre)}
                      </span>
                    </div>
                    {setContas && setTransacoes && (
                      <button onClick={() => setResgate({
                                meta: m, modo: "usar",
                                valor: String(saldoCofre),
                                categoria: categorias.filter(c => c.tipo === "despesa")[0]?.nome || "Outros",
                                contaDestino: (contas || []).find(c => c.nome !== cofre.nome)?.nome || "",
                                obs: "",
                              })}
                              style={{
                                marginTop: 10, width: "100%",
                                background: "transparent", color: T.gold,
                                border: `1px solid ${T.gold}`, padding: "7px 14px", borderRadius: 6,
                                fontSize: 11, fontWeight: 700, cursor: "pointer",
                                letterSpacing: ".05em", textTransform: "uppercase",
                                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                              }}>
                        <PiggyBank size={12} /> Usar / resgatar
                      </button>
                    )}
                  </div>
                );
              })()}
              <div className="grid grid-cols-2 gap-4 mt-6 pt-6" style={{ borderTop: `1px solid ${T.border}` }}>
                <div>
                  <div className="label-eyebrow">Aporte/mês</div>
                  <div className="num mt-1" style={{ fontSize: 16, color: T.ink }}>{hidden ? "•••" : fmt(m.aporte)}</div>
                </div>
                <div>
                  <div className="label-eyebrow">Taxa a.m.</div>
                  <div className="num mt-1" style={{ fontSize: 16, color: T.ink }}>{fmtN(m.taxa, 2)}%</div>
                </div>
                <div>
                  <div className="label-eyebrow">Tempo necessário</div>
                  <div className="num mt-1" style={{ fontSize: 16, color: ok ? T.green : T.gold }}>
                    {mesesNecessarios >= 1200 ? "—" : `${mesesNecessarios} meses`}
                  </div>
                </div>
                <div>
                  <div className="label-eyebrow">No prazo ({m.prazo}m)</div>
                  <div className="num mt-1" style={{ fontSize: 16, color: ok ? T.green : T.red }}>
                    {hidden ? "•••" : fmt(projetado)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {form && (
        <Modal title={form.id ? "Editar Meta" : "Nova Meta"} onClose={() => setForm(null)}>
          <Field label="Nome" required error={formErrors.nome}>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Reserva de emergência" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor alvo (R$)" required error={formErrors.alvo}>
              <input type="number" value={form.alvo} onChange={e => setForm({ ...form, alvo: e.target.value })} />
            </Field>
            <Field label="Valor atual (R$)">
              <input type="number" value={form.atual} onChange={e => setForm({ ...form, atual: e.target.value })} />
            </Field>
            <Field label="Data alvo" hint="Quando você quer atingir">
              <input type="date" value={form.dataAlvo || ""}
                     onChange={e => {
                       const dataAlvo = e.target.value;
                       const meses = mesesAteData(dataAlvo);
                       setForm({ ...form, dataAlvo, prazo: meses > 0 ? meses : form.prazo });
                     }} />
            </Field>
            <Field label="Prazo (meses)">
              <input type="number" value={form.prazo} onChange={e => setForm({ ...form, prazo: e.target.value })} />
            </Field>
            <Field label="Aporte mensal (R$)">
              <input type="number" value={form.aporte} onChange={e => setForm({ ...form, aporte: e.target.value })} />
              {(() => {
                const alvo = parseFloat(form.alvo) || 0;
                const atual = parseFloat(form.atual) || 0;
                const prazo = parseFloat(form.prazo) || 0;
                const falta = Math.max(0, alvo - atual);
                const sugerido = prazo > 0 ? falta / prazo : 0;
                if (sugerido <= 0) return null;
                return (
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    Sugerido: <strong className="num" style={{ color: T.ink }}>{fmt(sugerido)}</strong>
                    <span style={{ color: T.faint }}>= (alvo − atual) ÷ prazo</span>
                    <button type="button"
                            onClick={() => setForm({ ...form, aporte: sugerido.toFixed(2) })}
                            style={{ background: T.gold, color: T.bg, border: "none", borderRadius: 4, padding: "2px 10px", fontSize: 10, fontWeight: 600, cursor: "pointer", letterSpacing: ".05em", textTransform: "uppercase" }}>
                      Usar
                    </button>
                  </div>
                );
              })()}
            </Field>
            <Field label="Taxa juros (% a.m.)">
              <input type="number" step="0.01" value={form.taxa} onChange={e => setForm({ ...form, taxa: e.target.value })} />
            </Field>
          </div>
          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={save}>Salvar</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* Modal Usar / Resgatar meta (Fase 3) */}
      {resgate && (() => {
        const cofre = cofreDe(resgate.meta);
        const disponivel = Number(cofre?.saldo) || 0;
        const valor = parseValorBR(resgate.valor) || 0;
        const invalido = !(valor > 0) || valor > disponivel + 0.005;
        const isUsar = resgate.modo === "usar";
        return (
          <Modal title={`Usar meta: ${resgate.meta.nome}`} onClose={() => setResgate(null)}>
            <div style={{ padding: 12, background: T.bgSoft, borderRadius: 7, fontSize: 12.5, marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: T.muted }}>Disponível no cofrinho:</span>
              <span className="num" style={{ fontWeight: 700, color: T.ink }}>{fmt(disponivel)}</span>
            </div>

            {/* Modo: usar (gasto) ou devolver (transferência) */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {[
                { id: "usar", label: "💸 Gastei", desc: "Vira despesa real" },
                { id: "devolver", label: "↩︎ Devolver", desc: "Volta pra uma conta" },
              ].map(opt => {
                const active = resgate.modo === opt.id;
                return (
                  <button key={opt.id} onClick={() => setResgate({ ...resgate, modo: opt.id })}
                    style={{
                      flex: 1, padding: "10px 8px", borderRadius: 8, cursor: "pointer",
                      background: active ? `${T.gold}22` : T.bgSoft,
                      border: `1px solid ${active ? T.gold : T.border}`,
                      color: active ? T.gold : T.muted, textAlign: "center",
                    }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{opt.label}</div>
                    <div style={{ fontSize: 10, marginTop: 2, color: T.faint }}>{opt.desc}</div>
                  </button>
                );
              })}
            </div>

            <Field label="Valor (R$)" required hint={`Máx. ${fmt(disponivel)}`}>
              <input type="text" inputMode="decimal" value={resgate.valor}
                     onChange={e => setResgate({ ...resgate, valor: e.target.value })}
                     placeholder={String(disponivel)} />
            </Field>

            {isUsar ? (
              <Field label="Categoria da despesa">
                <select value={resgate.categoria}
                        onChange={e => setResgate({ ...resgate, categoria: e.target.value })}>
                  {categorias.filter(c => c.tipo === "despesa").map(c => (
                    <option key={c.id} value={c.nome}>{c.nome}</option>
                  ))}
                  <option value="Outros">Outros</option>
                </select>
              </Field>
            ) : (
              <Field label="Devolver para qual conta?" required>
                <select value={resgate.contaDestino}
                        onChange={e => setResgate({ ...resgate, contaDestino: e.target.value })}>
                  <option value="">Selecione…</option>
                  {(contas || []).filter(c => c.nome !== cofre?.nome).map(c => (
                    <option key={c.id} value={c.nome}>{c.nome} · saldo {fmt(c.saldo)}</option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Observação (opcional)">
              <input value={resgate.obs} onChange={e => setResgate({ ...resgate, obs: e.target.value })}
                     placeholder={isUsar ? "Ex.: Passagens compradas" : "Ex.: Mudei de ideia"} />
            </Field>

            <div style={{
              padding: 10, marginTop: 8, borderRadius: 6, fontSize: 11, lineHeight: 1.6,
              background: `${T.gold}11`, border: `1px solid ${T.gold}33`, color: T.muted,
            }}>
              {isUsar
                ? <>💸 Cria uma <strong>despesa real</strong> de {fmt(valor)} — o dinheiro sai do cofrinho e do patrimônio.</>
                : <>↩︎ Transfere {fmt(valor)} do cofrinho de volta — <strong>não é gasto</strong>, patrimônio mantido.</>}
            </div>

            <div className="flex gap-3 justify-end mt-5">
              <button className="btn-ghost" onClick={() => setResgate(null)}>Cancelar</button>
              <button className="btn-gold" disabled={invalido}
                      style={{ opacity: invalido ? 0.5 : 1, cursor: invalido ? "not-allowed" : "pointer" }}
                      onClick={confirmarResgate}>
                {isUsar ? "💸 Confirmar uso" : "↩︎ Devolver"}
              </button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

