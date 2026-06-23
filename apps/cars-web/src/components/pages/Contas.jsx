import React, { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Trash2, Edit3, Building2, Receipt, ArrowRightLeft, ChevronRight, ChevronUp, ChevronDown, GripVertical, RefreshCw, AlertCircle, Eye, EyeOff, Upload } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, uid } from "../../lib/format.js";
import { parseValorBR } from "../../lib/importExport.js";
import { confirm } from "../../lib/confirm.js";
import { toast } from "../../lib/toast.js";
import { calcSaldoConta, reconciliarContas } from "../../lib/saldoConta.js";
import { filtrarPorEscopo, detectarEscopoConta } from "../../lib/escopo.js";
import { somaContasBRL, semCotacao, buscarCotacao, saldoContaBRL } from "../../lib/cambio.js";
import Field from "../ui/Field.jsx";
import ColorPicker from "../ui/ColorPicker.jsx";
import Modal from "../ui/Modal.jsx";
import SecaoColapsavel from "../ui/SecaoColapsavel.jsx";
import TransferenciaModal from "../modals/TransferenciaModal.jsx";
import ImportarExtrato from "../modals/ImportarExtrato.jsx";

export default function Contas({ contas, setContas, hidden, onCreateTransacao, onContaClick, contaAtiva, transacoes, setTransacoes, categorias, escopoAtivo = "tudo" }) {
  const [form, setForm] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [importExtratoOpen, setImportExtratoOpen] = useState(false);
  const tipos = [
    { v: "corrente", l: "Conta Corrente" },
    { v: "poupanca", l: "Poupança" },
    { v: "investimento", l: "Investimento" },
    { v: "cripto", l: "Carteira Cripto" },
    { v: "carteira", l: "Carteira Física" },
  ];
  // Moedas — Real (padrão) ou conta do exterior (moeda estrangeira).
  const moedas = [
    { v: "BRL", l: "🇧🇷 Real (R$)" },
    { v: "USD", l: "🇺🇸 Dólar (US$)" },
    { v: "EUR", l: "🇪🇺 Euro (€)" },
    { v: "GBP", l: "🇬🇧 Libra (£)" },
    { v: "CHF", l: "🇨🇭 Franco suíço (CHF)" },
    { v: "ARS", l: "🇦🇷 Peso argentino (ARS)" },
  ];
  const ehBRL = (c) => !(c?.moeda) || c.moeda === "BRL";

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
  const [expandedConta, setExpandedConta] = useState(() => new Set());
  const toggleExpanded = (id) => {
    setExpandedConta(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  // A tela Contas mostra TODAS as contas (é onde você gerencia) — inclusive as
  // de Negócio, com selo. Quem filtra por escopo é o PAINEL/Dashboard.
  const contasNoEscopo = contas || [];
  const contasVisiveis = ocultarZeradas
    ? contasNoEscopo.filter(c => Math.abs(Number(c.saldo) || 0) > 0.01)
    : contasNoEscopo;
  const ehNegocio = (c) => (c?.escopo || "pessoal") === "negocio";
  const totalNegocio = somaContasBRL((contas || []).filter(ehNegocio));

  // Reordena a conta `c` trocando de posição com a vizinha VISÍVEL (dir -1 sobe,
  // +1 desce). Mexe no array `contas` completo (persistido), por isso funciona
  // mesmo com a lista filtrada por escopo/ocultar zeradas.
  const moverConta = (c, dir) => {
    const visIds = contasVisiveis.map(x => x.id);
    const alvoId = visIds[visIds.indexOf(c.id) + dir];
    if (!alvoId) return; // já é o primeiro/último visível
    const arr = [...(contas || [])];
    const i = arr.findIndex(x => x.id === c.id);
    const j = arr.findIndex(x => x.id === alvoId);
    if (i < 0 || j < 0) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setContas(arr);
  };

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

    // O valor digitado é o SALDO ATUAL (o que aparece no app do banco).
    // O app deriva o saldoInicial pra trás: inicial = atual − soma das
    // transações compensadas. Assim o saldo bate exatamente com o banco e a
    // coluna "saldo após" de cada lançamento fica consistente.
    const txsExistentes = (transacoes || []).filter(t => t.conta === form.nome && t.compensado);
    const somaTx = txsExistentes.reduce(
      (s, t) => s + (t.tipo === "receita" ? (Number(t.valor) || 0) : -(Number(t.valor) || 0)),
      0
    );
    const saldoAtual = saldoParsed;
    const saldoInicial = +(saldoAtual - somaTx).toFixed(2);
    // Cotação só pra conta do exterior (R$ por 1 unidade); aceita vírgula.
    const cotacaoNum = (form.moeda && form.moeda !== "BRL") ? (parseValorBR(form.cotacao) || 0) : null;
    const formNormalizado = { ...form, saldoInicial, saldo: saldoAtual, cotacao: cotacaoNum };

    if (form.id && contas.find(c => c.id === form.id)) {
      setContas(contas.map(c => c.id === form.id ? formNormalizado : c));
      toast.success(`Conta atualizada · saldo atual ${fmt(saldoAtual)} (bate com o banco).`);
    } else {
      setContas([...contas, { ...formNormalizado, id: uid() }]);
      toast.success(`Conta "${form.nome}" criada com saldo ${fmt(saldoAtual)}.`);
    }
    setForm(null);
    setFormErrors({});
  };

  // Total em R$ — contas do exterior convertidas pela cotação de cada uma.
  const total = somaContasBRL(contas);
  const contasSemCotacao = contas.filter(semCotacao);
  // Composição do total: quanto é Pessoal vs Negócio (ambos entram no total;
  // "fora do patrimônio" NÃO entra — mostrado à parte).
  const totalPessoal = somaContasBRL((contas || []).filter(c => !ehNegocio(c)));
  const totalForaPatrimonio = (contas || []).filter(c => c?.foraPatrimonio).reduce((s, c) => s + saldoContaBRL(c), 0);

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

  // Correção automática: ao detectar conta(s) dessincronizada(s), reconcilia
  // sozinho (sem precisar clicar em "Corrigir agora"). Roda uma vez por sessão
  // da página e avisa com toast + opção de Desfazer (para respeitar o undo).
  const autoReconciliado = useRef(false);
  useEffect(() => {
    if (autoReconciliado.current) return;
    if (dessincronizadas.length === 0) return;
    autoReconciliado.current = true;
    const backup = contas;
    const { contas: novaLista, mudancas } = reconciliarContas(contas, transacoes || []);
    if (mudancas.length === 0) return;
    setContas(novaLista);
    toast.success(
      `Saldo corrigido automaticamente: ` +
      mudancas.map(m => `${m.nome} (${m.delta > 0 ? "+" : ""}${fmt(m.delta)})`).join(", "),
      { action: { label: "Desfazer", onClick: () => setContas(backup) } }
    );
  }, [dessincronizadas, contas, transacoes, setContas]);

  // Detecta pelo nome (Loja, AF4, CNPJ, PJ…) e marca como Negócio — assim some
  // das somas do painel quando o escopo está em Pessoal.
  const marcarNegocioAuto = async () => {
    const candidatas = (contas || []).filter(
      c => (c.escopo || "pessoal") !== "negocio" && detectarEscopoConta(c) === "negocio"
    );
    if (candidatas.length === 0) {
      toast.info("Nenhuma conta com cara de negócio encontrada. Você pode marcar manualmente em Editar → Escopo.");
      return;
    }
    const ok = await confirm({
      title: `Marcar ${candidatas.length} conta(s) como Negócio?`,
      body: `Detectei pelo nome: ${candidatas.map(c => c.nome).join(", ")}. Elas saem das somas do painel (no escopo Pessoal). Tem Desfazer.`,
      confirmLabel: "Marcar como Negócio",
    });
    if (!ok) return;
    const backup = contas;
    const ids = new Set(candidatas.map(c => c.id));
    setContas(contas.map(c => ids.has(c.id) ? { ...c, escopo: "negocio" } : c));
    toast.success(`${candidatas.length} conta(s) marcada(s) como Negócio.`, {
      action: { label: "Desfazer", onClick: () => setContas(backup) },
    });
  };

  const btnSec = {
    background: "transparent", border: `1px solid ${T.border}`,
    padding: "7px 12px", fontFamily: T.sans, fontSize: 11,
    letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600,
    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
    borderRadius: 11, color: T.muted, whiteSpace: "nowrap",
  };

  return (
    <div className="fade-up py-8">
      {/* Cabeçalho — botões à direita, na linha do título (quebram abaixo em telas estreitas) */}
      <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${T.border}`,
                    display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flexShrink: 0 }}>
          <div className="label-eyebrow">Capítulo I</div>
          <h2 style={{ fontFamily: T.serif, fontSize: 26, color: T.ink, marginTop: 4, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            Contas
          </h2>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 4, fontStyle: "italic" }}>
            Cada conta é uma página do seu balanço.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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
          <button onClick={marcarNegocioAuto}
                  title="Detecta contas com nome de empresa (Loja, AF4, CNPJ…) e marca como Negócio"
                  style={btnSec}>
            <Building2 size={12} /> Detectar negócio
          </button>
          <button onClick={() => setImportExtratoOpen(true)} title="Importar extrato OFX/CSV do banco"
                  style={{ ...btnSec, color: T.green, borderColor: `${T.green}88` }}>
            <Upload size={12} /> Extrato banco
          </button>
          <button className="btn-gold" style={{ padding: "7px 12px", fontSize: 11 }}
                  onClick={() => setForm({ id: null, nome: "", instituicao: "", tipo: "corrente", moeda: "BRL", cotacao: "", escopo: escopoAtivo === "negocio" ? "negocio" : "pessoal", saldo: "", cor: T.gold, appUrl: "", foraPatrimonio: false })}>
            <Plus size={13} className="inline mr-1.5" />Nova Conta
          </button>
        </div>
      </div>

      {/* Aviso de contas dessincronizadas */}
      {dessincronizadas.length > 0 && (
        <div style={{
          background: `${T.red}11`, border: `1px solid ${T.red}55`, borderLeft: `4px solid ${T.red}`,
          borderRadius: 14, padding: "12px 16px", marginBottom: 16,
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
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
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
          {totalNegocio > 0 && (
            <span className="num" style={{ fontSize: 10.5, color: T.muted }}>
              · {hidden ? "•••" : fmt(totalNegocio)} em Negócio <span style={{ color: T.faint }}>(fora do painel)</span>
            </span>
          )}
          {contasSemCotacao.length > 0 && (
            <span className="num" style={{ fontSize: 10.5, color: T.gold }}>
              · ⚠ {contasSemCotacao.length} conta(s) do exterior sem cotação (não somam)
            </span>
          )}
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
        {/* Barra de composição do total: Pessoal vs Negócio (fora do patrimônio à parte) */}
        {total > 0 && totalNegocio > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", background: T.bgSoft }}>
              <div style={{ width: `${(totalPessoal / total) * 100}%`, background: T.gold }} />
              <div style={{ width: `${(totalNegocio / total) * 100}%`, background: T.blue }} />
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 5, fontSize: 10, color: T.muted }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: T.gold }} /> Pessoal · {hidden ? "•••" : fmt(totalPessoal)}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: T.blue }} /> Negócio · {hidden ? "•••" : fmt(totalNegocio)}
              </span>
              {totalForaPatrimonio > 0 && (
                <span style={{ color: T.faint }}>Fora do patrimônio · {hidden ? "•••" : fmt(totalForaPatrimonio)} (não soma)</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lista de contas — aberta por padrão */}
      <SecaoColapsavel idKey="contas-lista" titulo="Minhas contas" count={contasVisiveis.length} defaultAberto={true}>
      {(() => {
        // Iniciais do nome (1–2 letras) pro avatar.
        const iniciais = (nome) => {
          const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
          if (partes.length === 0) return "?";
          if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
          return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
        };

        // Bandeira da moeda (conta do exterior).
        const bandeira = (m) => ({ USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵", CHF: "🇨🇭", CAD: "🇨🇦", AUD: "🇦🇺", ARS: "🇦🇷" }[m] || "🌎");

        // Card de uma conta — mantém TODOS os handlers/ações originais.
        const renderConta = (c) => {
          const ativa = contaAtiva?.id === c.id;
          const exp = expandedConta.has(c.id);
          return (
          <div key={c.id}
               style={{
                 background: ativa ? `${T.gold}10` : T.card,
                 border: `1px solid ${ativa ? T.gold : T.border}`,
                 borderLeft: `3px solid ${c.cor || T.gold}`,
                 borderRadius: 11, overflow: "hidden",
                 transition: "all .15s",
               }}>
            {/* Linha principal — pai */}
            <div onClick={() => onContaClick && onContaClick(c)}
                 role={onContaClick ? "button" : undefined}
                 tabIndex={onContaClick ? 0 : undefined}
                 onKeyDown={(e) => { if (onContaClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onContaClick(c); } }}
                 style={{
                   display: "flex", alignItems: "center", gap: 10,
                   padding: "10px 12px",
                   cursor: onContaClick ? "pointer" : "default",
                 }}>
              <GripVertical size={13} style={{ color: T.faint, flexShrink: 0, opacity: 0.45 }} aria-hidden="true" />
              {/* Avatar com inicial */}
              <div aria-hidden="true" style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: c.cor || T.gold, color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: T.sans, fontWeight: 700, fontSize: 13, letterSpacing: ".02em",
              }}>
                {iniciais(c.nome)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</span>
                  {(() => {
                    const neg = ehNegocio(c), fora = !!c.foraPatrimonio;
                    if (!neg && !fora) return null;
                    const label = neg && fora ? "Negócio · fora" : neg ? "Negócio" : "Fora do patrimônio";
                    const st = neg
                      ? { background: `${T.gold}22`, color: T.gold }
                      : { background: T.bgSoft, color: T.faint };
                    return (
                      <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 100, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", whiteSpace: "nowrap", flexShrink: 0, ...st }}>
                        {label}
                      </span>
                    );
                  })()}
                </div>
                {c.instituicao && (
                  <div style={{ fontSize: 10, color: T.muted, fontStyle: "italic" }}>{c.instituicao}</div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                <div className="num" style={{
                  fontFamily: T.serif, fontVariantNumeric: "tabular-nums",
                  fontSize: 15, color: c.saldo < 0 ? T.red : T.ink, whiteSpace: "nowrap",
                }}>
                  {!ehBRL(c) && <span style={{ fontSize: 12, marginRight: 3 }} aria-hidden="true">{bandeira(c.moeda)}</span>}
                  {hidden ? "•••" : fmt(c.saldo, c.moeda || "BRL")}
                </div>
                {!ehBRL(c) && (
                  <div className="num" style={{ fontSize: 9.5, color: Number(c.cotacao) > 0 ? T.faint : T.gold, whiteSpace: "nowrap" }}>
                    {Number(c.cotacao) > 0 ? `≈ ${hidden ? "•••" : fmt(saldoContaBRL(c))}` : "sem cotação"}
                  </div>
                )}
              </div>
              <button onClick={(e) => { e.stopPropagation(); toggleExpanded(c.id); }}
                      aria-label={exp ? "Recolher" : "Mais ações"}
                      style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", padding: 4, lineHeight: 0 }}>
                <ChevronRight size={16} style={{ transform: exp ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
              </button>
            </div>
            {/* Filhos — ações */}
            {exp && (
              <div style={{ display: "flex", gap: 6, padding: "6px 12px 10px", borderTop: `1px dashed ${T.border}` }}>
                {(() => {
                  const vi = contasVisiveis.findIndex(x => x.id === c.id);
                  const primeiro = vi <= 0, ultimo = vi >= contasVisiveis.length - 1;
                  const estilo = (off) => ({
                    width: 30, padding: "5px 0", borderRadius: 4, background: "transparent",
                    border: `1px solid ${T.border}`, color: off ? T.faint : T.muted,
                    cursor: off ? "default" : "pointer", opacity: off ? 0.4 : 1,
                    display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  });
                  return (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); moverConta(c, -1); }} disabled={primeiro}
                              title="Mover para cima" style={estilo(primeiro)}>
                        <ChevronUp size={13} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); moverConta(c, 1); }} disabled={ultimo}
                              title="Mover para baixo" style={estilo(ultimo)}>
                        <ChevronDown size={13} />
                      </button>
                    </>
                  );
                })()}
                {c.appUrl && (
                  <button onClick={(e) => { e.stopPropagation(); window.open(c.appUrl, "_blank", "noopener"); }}
                    title="Abrir o app/site do banco"
                    style={{
                      flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: 600,
                      letterSpacing: ".05em", textTransform: "uppercase",
                      borderRadius: 4, background: `${T.gold}22`,
                      border: `1px solid ${T.gold}`, color: T.gold, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                    }}>
                    🔗 Banco
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
                <button onClick={(e) => {
                            e.stopPropagation();
                            // Abre o form com o SALDO ATUAL (o que o usuário compara com o banco).
                            setForm({ ...c });
                          }}
                        style={{
                          flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: 600,
                          letterSpacing: ".05em", textTransform: "uppercase",
                          borderRadius: 4, background: "transparent",
                          border: `1px solid ${T.border}`, color: T.muted, cursor: "pointer",
                          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                        }}>
                  <Edit3 size={11} /> Editar
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
                          flex: 1, padding: "5px 8px", fontSize: 10, fontWeight: 600,
                          letterSpacing: ".05em", textTransform: "uppercase",
                          borderRadius: 4, background: "transparent",
                          border: `1px solid ${T.red}33`, color: T.red, cursor: "pointer",
                          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4,
                        }}>
                  <Trash2 size={11} /> Excluir
                </button>
              </div>
            )}
          </div>
          );
        };

        // Agrupa por escopo, preservando a ordem global de contasVisiveis.
        const grupoPessoal = contasVisiveis.filter(c => !ehNegocio(c));
        const grupoNegocio = contasVisiveis.filter(ehNegocio);
        const grupos = [
          { id: "pessoal", titulo: "Pessoal", contas: grupoPessoal },
          { id: "negocio", titulo: "Negócio", contas: grupoNegocio },
        ].filter(g => g.contas.length > 0);

        const renderGrupo = (g) => (
          <div key={g.id} style={{ marginBottom: 12 }}>
            {/* Cabeçalho do grupo + subtotal */}
            <div style={{
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
              gap: 8, margin: "4px 2px 8px",
            }}>
              <span style={{ fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase", fontWeight: 700, color: T.muted }}>
                {g.titulo}
                <span style={{ color: T.faint, fontWeight: 600 }}> · {g.contas.length}</span>
              </span>
              <span className="num" style={{
                fontFamily: T.serif, fontVariantNumeric: "tabular-nums",
                fontSize: 12.5, color: T.muted, whiteSpace: "nowrap",
              }}>
                {hidden ? "•••" : fmt(somaContasBRL(g.contas))}
              </span>
            </div>
            {/* Grid responsivo — 1 coluna no mobile */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 10,
            }}>
              {g.contas.map(renderConta)}
            </div>
          </div>
        );

        return <div>{grupos.map(renderGrupo)}</div>;
      })()}
      </SecaoColapsavel>

      {form && (
        <Modal title={form.id ? "Editar Conta" : "Abrir Nova Conta"} onClose={() => setForm(null)}>
          <Field label="Nome" required error={formErrors.nome}>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Conta Principal" />
          </Field>
          <Field label="Instituição" required error={formErrors.instituicao}>
            <input value={form.instituicao} onChange={e => setForm({ ...form, instituicao: e.target.value })} placeholder="Ex.: Itaú, Nubank, XP…" />
          </Field>
          <Field label="App / site do banco (link)" hint="Opcional — atalho pra abrir o banco numa nova aba. Ex.: https://app.nubank.com.br">
            <input value={form.appUrl || ""} onChange={e => setForm({ ...form, appUrl: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label="Tipo">
            <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })}>
              {tipos.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </Field>
          <Field label="Moeda" hint="Real para contas no Brasil; outra moeda = conta do exterior.">
            <select value={form.moeda || "BRL"} onChange={e => setForm({ ...form, moeda: e.target.value })}>
              {moedas.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </Field>
          {form.moeda && form.moeda !== "BRL" && (
            <Field label={`Cotação (R$ por 1 ${form.moeda})`} hint="Usada pra converter o saldo pro patrimônio em R$.">
              <div style={{ display: "flex", gap: 6 }}>
                <input type="text" inputMode="decimal" style={{ flex: 1 }}
                       value={form.cotacao == null ? "" : String(form.cotacao)}
                       onChange={e => setForm({ ...form, cotacao: e.target.value })}
                       placeholder="Ex.: 5,40" />
                <button type="button" className="btn-ghost" style={{ whiteSpace: "nowrap", fontSize: 11 }}
                        onClick={async () => {
                          const r = await buscarCotacao(form.moeda);
                          if (r) { setForm(f => ({ ...f, cotacao: r })); toast.success(`Cotação ${form.moeda}→BRL: ${fmt(r)}`); }
                          else toast.error("Não consegui buscar a cotação agora. Digite manualmente.");
                        }}>
                  ⟳ Atualizar
                </button>
              </div>
            </Field>
          )}
          <Field label="Escopo" hint="Pessoal ou Negócio — separação financeira">
            <select value={form.escopo || "pessoal"} onChange={e => setForm({ ...form, escopo: e.target.value })}>
              <option value="pessoal">👤 Pessoal</option>
              <option value="negocio">🏢 Negócio</option>
            </select>
          </Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", margin: "2px 0 4px", fontSize: 12.5, color: T.ink }}>
            <input type="checkbox" checked={!!form.foraPatrimonio}
                   onChange={e => setForm({ ...form, foraPatrimonio: e.target.checked })} />
            Fora do patrimônio (só controle)
            <span style={{ fontSize: 11, color: T.muted }}>— não soma no total/patrimônio</span>
          </label>
          <Field label={`Saldo atual (${form.moeda && form.moeda !== "BRL" ? form.moeda : "R$"})`} error={formErrors.saldo} hint="O mesmo que aparece no app do banco. Aceita: 1500 · 1.500,00 · negativo pra dívida">
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

      {importExtratoOpen && (
        <ImportarExtrato
          contas={contas} categorias={categorias}
          transacoes={transacoes} setTransacoes={setTransacoes}
          onClose={() => setImportExtratoOpen(false)}
        />
      )}
    </div>
  );
}
