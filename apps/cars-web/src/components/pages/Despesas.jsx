import React, { useState, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Settings as SettingsIcon, Check,
  Home, Utensils, Car, ShoppingCart, Heart, Smartphone,
  Plane, GraduationCap, Tag, CreditCard,
} from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, todayISO, uid } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import PageHeader from "../ui/PageHeader.jsx";
import {
  getDespesasDoMes, getKPIsMes, agruparPorCategoria, mesAtual,
  identificarParcelaDoItem,
} from "../../lib/agregador.js";
import DespesasFixas from "./DespesasFixas.jsx";
import BaixaParcelaModal from "../modals/BaixaParcelaModal.jsx";

/**
 * Despesas — view unificada (Fixas + Variáveis + Parcelas) do mês.
 * Read-only com filtros por tipo + agrupamento por categoria.
 * O botão "Gerenciar fixas" abre o gestor antigo (DespesasFixas) sem perder
 * nenhuma funcionalidade de cadastro/edição/pagamento de fixas.
 */
const MES_NOMES_LONGOS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const MES_PILLS = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

const TIPO_BADGE = {
  fixa:     { lbl: "Fixa",     cor: "#f59e0b" }, // gold
  variavel: { lbl: "Variável", cor: "#a8a8b0" }, // muted
  parcela:  { lbl: "Parcela",  cor: "#60a5fa" }, // blue
};

// Ícones por categoria (busca por nome contendo termo). Fallback: Tag.
const CAT_ICONS = [
  { match: /casa|aluguel|moradia|residen/i,           Icon: Home },
  { match: /aliment|comida|mercado|restaurant|food/i, Icon: Utensils },
  { match: /carro|auto|combust|transporte/i,          Icon: Car },
  { match: /compra|shop|loja|vestu/i,                 Icon: ShoppingCart },
  { match: /sa[úu]de|m[ée]dic|farm|hosp/i,            Icon: Heart },
  { match: /telefon|celular|internet|streaming|netflix|spotify/i, Icon: Smartphone },
  { match: /viagem|lazer|hotel|passag/i,              Icon: Plane },
  { match: /educa|curso|escola|faculd/i,              Icon: GraduationCap },
  { match: /cart[ãa]o|parcela/i,                      Icon: CreditCard },
];
function iconeCategoria(nome = "") {
  const m = CAT_ICONS.find(c => c.match.test(nome));
  return m ? m.Icon : Tag;
}

export default function Despesas(props) {
  const {
    fixas = [], fixaOcorrencias = [], setFixaOcorrencias,
    parcelamentos = [], setParcelamentos,
    dividas = [], setDividas,
    transacoes = [], setTransacoes,
    contas = [], setContas,
    categorias = [], setFixas,
    cartoes = [],
    escopoAtivo = "tudo",
    hidden,
  } = props;

  const [mes, setMes] = useState(() => mesAtual());
  const [filtroTipo, setFiltroTipo] = useState("todas"); // todas | fixa | variavel | parcela
  const [gerenciarAberto, setGerenciarAberto] = useState(false);
  const [baixaItem, setBaixaItem] = useState(null);

  const state = { transacoes, contas, categorias, fixas, fixaOcorrencias, parcelamentos, dividas };
  const ano = parseInt(mes.slice(0, 4), 10);

  const despesas = useMemo(
    () => getDespesasDoMes(mes, state, escopoAtivo),
    [mes, transacoes, contas, categorias, fixas, fixaOcorrencias, parcelamentos, dividas, escopoAtivo]
  );
  const kpis = useMemo(
    () => getKPIsMes(mes, state, escopoAtivo),
    [mes, transacoes, contas, categorias, fixas, fixaOcorrencias, parcelamentos, dividas, escopoAtivo]
  );

  const filtradas = useMemo(() => {
    if (filtroTipo === "todas") return despesas;
    return despesas.filter(d => d.tipo === filtroTipo);
  }, [despesas, filtroTipo]);

  const grupos = useMemo(() => agruparPorCategoria(filtradas), [filtradas]);

  // Pills de mês (12 meses do ano corrente da seleção)
  const mesIdx = parseInt(mes.slice(5, 7), 10) - 1;

  const prevAno = () => setMes(`${ano - 1}-${String(mesIdx + 1).padStart(2, "0")}`);
  const nextAno = () => setMes(`${ano + 1}-${String(mesIdx + 1).padStart(2, "0")}`);
  const irHoje  = () => setMes(mesAtual());
  const setMesIdx = (i) => setMes(`${ano}-${String(i + 1).padStart(2, "0")}`);

  const confirmarBaixa = ({ conta, data, obs }) => {
    const item = baixaItem;
    if (!item) return;

    const valor = Number(item.valor) || 0;

    // undo() é montado por caso e reverte apenas as mudanças específicas, por id,
    // usando updaters funcionais — assim não sobrescreve alterações feitas entre pagar e desfazer.
    let undo = null;

    // ─────── Caso 1: PARCELA ───────
    if (item.tipo === "parcela") {
      const id = identificarParcelaDoItem(item, parcelamentos);
      if (!id) {
        toast.error("Não consegui identificar essa parcela. Marque manualmente em Cartões.");
        setBaixaItem(null);
        return;
      }
      const parcOriginal = parcelamentos.find(p => p.id === id.parcId);
      const cartao = parcOriginal && cartoes.find(c => c.id === parcOriginal.cartaoId);
      // A parcela já estava paga antes? Se sim, não reverter ao desfazer.
      const jaPaga = (parcOriginal?.parcelasPagas || []).includes(id.numero);
      const novaTx = {
        id: uid(), tipo: "despesa",
        descricao: `${item.descricao}${cartao ? ` · ${cartao.nome}` : ""}`,
        valor, categoria: item.categoria || "Compras",
        conta: conta.nome, data, compensado: true,
        obs: obs || `Baixa de parcela ${id.numero}/${parcOriginal?.totalParcelas || "?"}`,
        origemParcelamentoId: id.parcId, parcelaNum: id.numero,
      };

      setParcelamentos?.(prev => prev.map(p => {
        if (p.id !== id.parcId) return p;
        const pagas = new Set([...(p.parcelasPagas || []), id.numero]);
        return { ...p, parcelasPagas: Array.from(pagas).sort((a, b) => a - b) };
      }));
      setContas?.(prev => prev.map(c => c.id === conta.id
        ? { ...c, saldo: (Number(c.saldo) || 0) - valor } : c));
      setTransacoes?.(prev => [novaTx, ...prev]);

      undo = () => {
        setTransacoes?.(prev => prev.filter(t => t.id !== novaTx.id));
        setContas?.(prev => prev.map(c => c.id === conta.id
          ? { ...c, saldo: (Number(c.saldo) || 0) + valor } : c));
        if (!jaPaga) {
          setParcelamentos?.(prev => prev.map(p => p.id === id.parcId
            ? { ...p, parcelasPagas: (p.parcelasPagas || []).filter(n => n !== id.numero) }
            : p));
        }
      };
    }

    // ─────── Caso 2: FIXA ───────
    else if (item.tipo === "fixa") {
      const occ = fixaOcorrencias.find(o => o.id === item.id);
      if (!occ) {
        toast.error("Não consegui identificar essa fixa. Verifique em Gerenciar fixas.");
        setBaixaItem(null);
        return;
      }
      const occAntiga = occ; // snapshot da ocorrência para restaurar campos por id
      const novaTx = {
        id: uid(), tipo: "despesa",
        descricao: item.descricao, valor,
        categoria: item.categoria || "Outros",
        conta: conta.nome, data, compensado: true,
        obs: obs || `Pagamento de fixa: ${item.descricao}`,
        origemFixaOcorrenciaId: occ.id,
      };
      setFixaOcorrencias?.(prev => prev.map(o =>
        o.id === occ.id
          ? { ...o, status: "paga", dataPagamento: data, valorPago: valor, transacaoId: novaTx.id }
          : o));
      setContas?.(prev => prev.map(c => c.id === conta.id
        ? { ...c, saldo: (Number(c.saldo) || 0) - valor } : c));
      setTransacoes?.(prev => [novaTx, ...prev]);

      undo = () => {
        setTransacoes?.(prev => prev.filter(t => t.id !== novaTx.id));
        setContas?.(prev => prev.map(c => c.id === conta.id
          ? { ...c, saldo: (Number(c.saldo) || 0) + valor } : c));
        setFixaOcorrencias?.(prev => prev.map(o => o.id === occAntiga.id ? occAntiga : o));
      };
    }

    // ─────── Caso 3: VARIÁVEL (dívida ou transação) ───────
    else if (item.tipo === "variavel") {
      if (item.fonte === "divida") {
        const div = dividas.find(d => d.id === item.id);
        if (!div) {
          toast.error("Não consegui encontrar essa dívida.");
          setBaixaItem(null);
          return;
        }
        const divAntiga = div; // snapshot da dívida para restaurar campos por id
        const novaTx = {
          id: uid(), tipo: "despesa",
          descricao: item.descricao, valor,
          categoria: item.categoria || "Dívida",
          conta: conta.nome, data, compensado: true,
          obs: obs || `Pagamento de dívida: ${item.descricao}`,
        };
        setDividas?.(prev => prev.map(d => d.id === item.id
          ? { ...d, pago: true, dataPagamento: data, contaPagamento: conta.nome }
          : d));
        setContas?.(prev => prev.map(c => c.id === conta.id
          ? { ...c, saldo: (Number(c.saldo) || 0) - valor } : c));
        setTransacoes?.(prev => [novaTx, ...prev]);

        undo = () => {
          setTransacoes?.(prev => prev.filter(t => t.id !== novaTx.id));
          setContas?.(prev => prev.map(c => c.id === conta.id
            ? { ...c, saldo: (Number(c.saldo) || 0) + valor } : c));
          setDividas?.(prev => prev.map(d => d.id === divAntiga.id ? divAntiga : d));
        };
      } else {
        const tx = transacoes.find(t => t.id === item.id);
        if (!tx) {
          toast.error("Não consegui encontrar essa transação.");
          setBaixaItem(null);
          return;
        }
        const txAntiga = tx; // snapshot da transação para restaurar campos por id
        setTransacoes?.(prev => prev.map(t =>
          t.id === item.id
            ? { ...t, compensado: true, conta: conta.nome, data, obs: obs || t.obs }
            : t));
        // Ajusta saldos: estorna conta antiga se já estava compensada e debita a nova
        const contaAnterior = contas.find(c => c.nome === tx.conta);
        if (tx.conta !== conta.nome) {
          setContas?.(prev => prev.map(c => {
            if (c.id === conta.id) return { ...c, saldo: (Number(c.saldo) || 0) - valor };
            if (contaAnterior && c.id === contaAnterior.id && tx.compensado) {
              return { ...c, saldo: (Number(c.saldo) || 0) + valor };
            }
            return c;
          }));
        } else if (!tx.compensado) {
          setContas?.(prev => prev.map(c => c.id === conta.id
            ? { ...c, saldo: (Number(c.saldo) || 0) - valor } : c));
        }

        undo = () => {
          setTransacoes?.(prev => prev.map(t => t.id === txAntiga.id ? txAntiga : t));
          if (tx.conta !== conta.nome) {
            setContas?.(prev => prev.map(c => {
              if (c.id === conta.id) return { ...c, saldo: (Number(c.saldo) || 0) + valor };
              if (contaAnterior && c.id === contaAnterior.id && tx.compensado) {
                return { ...c, saldo: (Number(c.saldo) || 0) - valor };
              }
              return c;
            }));
          } else if (!tx.compensado) {
            setContas?.(prev => prev.map(c => c.id === conta.id
              ? { ...c, saldo: (Number(c.saldo) || 0) + valor } : c));
          }
        };
      }
    }

    setBaixaItem(null);

    const tipoLbl = item.tipo === "fixa" ? "Fixa" : item.tipo === "variavel" ? "Variável" : "Parcela";
    toast.success(`${tipoLbl} "${item.descricao}" paga · ${conta.nome}`, {
      action: {
        label: "Desfazer",
        onClick: () => { undo?.(); },
      },
    });
  };

  if (gerenciarAberto) {
    return (
      <div className="fade-up py-8 px-6">
        <button onClick={() => setGerenciarAberto(false)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", marginBottom: 16,
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 12, fontSize: 11, fontWeight: 600,
            color: T.muted, cursor: "pointer",
            letterSpacing: ".05em", textTransform: "uppercase",
          }}>
          <ChevronLeft size={14} style={{ display: "inline", verticalAlign: "middle" }} /> Voltar
        </button>
        <DespesasFixas {...props} />
      </div>
    );
  }

  // Contagens por tipo (do mês inteiro, não filtrado)
  const cntTodas    = despesas.length;
  const cntFixa     = despesas.filter(d => d.tipo === "fixa").length;
  const cntVariavel = despesas.filter(d => d.tipo === "variavel").length;
  const cntParcela  = despesas.filter(d => d.tipo === "parcela").length;

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Finanças · Planejamento"
        title={<>Despesas <em>do mês.</em></>}
        sub="Tudo o que sai (fixas, variáveis e parcelas) agrupado por categoria, mês a mês."
        action={
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setGerenciarAberto(true)} className="btn-ghost" title="Gerenciar fixas">
              <SettingsIcon size={13} className="inline mr-1.5" /> Gerenciar fixas
            </button>
          </div>
        }
      />

      {/* Navegação de ANO + Hoje */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap",
      }}>
        <button onClick={prevAno} style={navBtn}><ChevronLeft size={14} /></button>
        <div style={{
          fontFamily: T.serif, fontSize: 22, color: T.ink, fontWeight: 500,
          minWidth: 70, textAlign: "center",
        }}>{ano}</div>
        <button onClick={nextAno} style={navBtn}><ChevronRight size={14} /></button>
        {mes !== mesAtual() && (
          <button onClick={irHoje} style={{
            padding: "6px 12px", background: T.gold, color: T.bg, border: "none",
            borderRadius: 11, fontSize: 10, fontWeight: 600, letterSpacing: ".05em",
            textTransform: "uppercase", cursor: "pointer", marginLeft: 4,
          }}>Hoje</button>
        )}
      </div>

      {/* Pills de MÊS */}
      <div style={{
        display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap",
      }}>
        {MES_PILLS.map((nome, i) => {
          const ativo = i === mesIdx;
          return (
            <button key={i} onClick={() => setMesIdx(i)}
              style={{
                padding: "6px 10px", borderRadius: 11,
                background: ativo ? T.gold : T.bgSoft,
                color: ativo ? T.bg : T.muted,
                border: `1px solid ${ativo ? T.gold : T.border}`,
                fontSize: 10, fontWeight: 700, letterSpacing: ".1em",
                cursor: "pointer", transition: "all .15s",
              }}>
              {nome}
            </button>
          );
        })}
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginBottom: 18 }}>
        <Kpi lbl="Total previsto" val={fmt(kpis.totalPrevisto)} qtd={kpis.qtdDespesas} cor={T.gold} hidden={hidden} />
        <Kpi lbl="Já pago" val={fmt(kpis.totalPago)} cor={T.green} hidden={hidden} />
        <Kpi lbl="Pendente" val={fmt(kpis.totalPendente)} cor={T.muted} hidden={hidden} />
        <Kpi lbl="⚠ Atrasado" val={fmt(kpis.totalAtrasado)} cor={kpis.totalAtrasado > 0 ? T.red : T.muted} hidden={hidden} />
      </div>

      {/* Filtros por tipo */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <FiltroChip label="Todas" qtd={cntTodas} ativo={filtroTipo === "todas"}
                    cor={T.ink} onClick={() => setFiltroTipo("todas")} />
        <FiltroChip label="Fixas" qtd={cntFixa} ativo={filtroTipo === "fixa"}
                    cor={TIPO_BADGE.fixa.cor} onClick={() => setFiltroTipo("fixa")} />
        <FiltroChip label="Variáveis" qtd={cntVariavel} ativo={filtroTipo === "variavel"}
                    cor={TIPO_BADGE.variavel.cor} onClick={() => setFiltroTipo("variavel")} />
        <FiltroChip label="Parcelas" qtd={cntParcela} ativo={filtroTipo === "parcela"}
                    cor={TIPO_BADGE.parcela.cor} onClick={() => setFiltroTipo("parcela")} />
      </div>

      {/* Subtítulo do mês */}
      <div style={{
        fontSize: 11, color: T.muted, marginBottom: 8, textTransform: "uppercase",
        letterSpacing: ".15em", fontWeight: 700,
      }}>
        {MES_NOMES_LONGOS[mesIdx]} {ano} · {filtradas.length} {filtradas.length === 1 ? "item" : "itens"}
      </div>

      {/* Lista agrupada por categoria */}
      {grupos.length === 0 ? (
        <div style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 16,
          padding: "40px 20px", textAlign: "center", color: T.muted, fontStyle: "italic",
        }}>
          Sem despesas neste filtro para {MES_NOMES_LONGOS[mesIdx]}/{ano}.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {grupos.map(g => (
            <GrupoCategoria key={g.categoria} grupo={g} categorias={categorias} hidden={hidden} onPagar={setBaixaItem} />
          ))}
        </div>
      )}

      {baixaItem && (
        <BaixaParcelaModal
          item={baixaItem}
          contas={contas}
          onConfirm={confirmarBaixa}
          onClose={() => setBaixaItem(null)}
        />
      )}
    </div>
  );
}

/* ============================================================
   Subcomponentes
   ============================================================ */
function Kpi({ lbl, val, qtd, cor, hidden }) {
  return (
    <div style={{
      background: T.card, padding: "12px 14px",
      borderRadius: 14, borderLeft: `3px solid ${cor}`,
      border: `1px solid ${T.border}`,
    }}>
      <div style={{
        fontSize: 8.5, letterSpacing: ".15em", color: T.muted,
        textTransform: "uppercase", fontWeight: 700,
      }}>{lbl}</div>
      <div className="num" style={{
        fontFamily: T.serif, fontSize: 19, color: cor,
        marginTop: 4, fontWeight: 500, lineHeight: 1.1,
      }}>
        {hidden ? "•••" : val}
      </div>
      {typeof qtd === "number" && (
        <div style={{ fontSize: 9.5, color: T.faint, marginTop: 3 }}>
          {qtd} {qtd === 1 ? "lançamento" : "lançamentos"}
        </div>
      )}
    </div>
  );
}

function FiltroChip({ label, qtd, ativo, cor, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        padding: "7px 12px", borderRadius: 100,
        background: ativo ? `${cor}22` : T.bgSoft,
        border: `1px solid ${ativo ? cor : T.border}`,
        color: ativo ? cor : T.muted,
        fontSize: 11, fontWeight: 600, letterSpacing: ".03em",
        cursor: "pointer", transition: "all .15s",
        display: "inline-flex", alignItems: "center", gap: 6,
      }}>
      {label}
      <span style={{
        fontSize: 9.5, padding: "1px 6px", borderRadius: 16,
        background: ativo ? cor : T.border,
        color: ativo ? T.bg : T.muted, fontWeight: 700,
      }}>{qtd}</span>
    </button>
  );
}

function GrupoCategoria({ grupo, categorias, hidden, onPagar }) {
  const [aberto, setAberto] = useState(true);
  const cat = categorias.find(c => c.nome === grupo.categoria);
  const corCat = cat?.cor || T.gold;
  const Icon = iconeCategoria(grupo.categoria);

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 16, overflow: "hidden",
    }}>
      {/* Header do grupo */}
      <div onClick={() => setAberto(!aberto)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", cursor: "pointer",
          borderLeft: `4px solid ${corCat}`,
          background: T.bgSoft,
        }}>
        <Icon size={16} style={{ color: corCat, flexShrink: 0 }} />
        <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: T.ink }}>
          {grupo.categoria}
        </div>
        <span style={{ fontSize: 10, color: T.muted }}>
          {grupo.qtd} {grupo.qtd === 1 ? "item" : "itens"}
        </span>
        <span className="num" style={{
          fontFamily: T.serif, fontSize: 15, color: T.ink, fontWeight: 600,
          minWidth: 90, textAlign: "right",
        }}>
          {hidden ? "•••" : fmt(grupo.total)}
        </span>
        {aberto ? <ChevronLeft size={14} style={{ color: T.muted, transform: "rotate(-90deg)" }} />
                : <ChevronLeft size={14} style={{ color: T.muted, transform: "rotate(180deg)" }} />}
      </div>

      {/* Itens */}
      {aberto && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {grupo.items.map((it, i) => {
            const badge = TIPO_BADGE[it.tipo] || { lbl: it.tipo, cor: T.muted };
            const statusCfg = {
              paga:     { fg: T.green, bg: `${T.green}22`, lbl: "Paga" },
              pendente: { fg: T.gold,  bg: `${T.gold}22`,  lbl: "Pendente" },
              atrasada: { fg: T.red,   bg: `${T.red}22`,   lbl: "Atrasada" },
            }[it.status] || { fg: T.muted, bg: `${T.muted}22`, lbl: it.status };
            return (
              <div key={it.id + i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 14px",
                borderTop: i === 0 ? "none" : `1px solid ${T.border}`,
                fontSize: 12,
              }}>
                <span style={{
                  fontSize: 9, padding: "2px 6px", borderRadius: 3,
                  background: `${badge.cor}22`, color: badge.cor,
                  fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
                  flexShrink: 0, whiteSpace: "nowrap", minWidth: 60, textAlign: "center",
                }}>{badge.lbl}</span>
                <span style={{
                  flex: 1, color: T.ink, minWidth: 0,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{it.descricao}</span>
                {it.data && (
                  <span style={{ fontSize: 10, color: T.muted, whiteSpace: "nowrap" }}>
                    {it.data.slice(8, 10)}/{it.data.slice(5, 7)}
                  </span>
                )}
                <span style={{
                  fontSize: 9, padding: "1px 6px", borderRadius: 3,
                  background: statusCfg.bg, color: statusCfg.fg,
                  fontWeight: 700, whiteSpace: "nowrap",
                }}>{statusCfg.lbl}</span>
                {onPagar
                  && (it.tipo === "parcela" || it.tipo === "fixa" || it.tipo === "variavel")
                  && (it.status === "pendente" || it.status === "atrasada") && (
                  <button onClick={() => onPagar(it)}
                    title="Marcar como paga"
                    style={{
                      padding: "3px 8px", fontSize: 9.5, fontWeight: 700,
                      letterSpacing: ".05em", textTransform: "uppercase",
                      background: T.green, color: "#fff", border: "none",
                      borderRadius: 4, cursor: "pointer", whiteSpace: "nowrap",
                      display: "inline-flex", alignItems: "center", gap: 3,
                    }}>
                    <Check size={10} /> Pagar
                  </button>
                )}
                <span className="num" style={{
                  color: T.ink, fontWeight: 600,
                  whiteSpace: "nowrap", minWidth: 80, textAlign: "right",
                }}>
                  {hidden ? "•••" : fmt(it.valor)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const navBtn = {
  width: 30, height: 30, padding: 0,
  background: T.bgSoft, border: `1px solid ${T.border}`,
  color: T.muted, borderRadius: 11, cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};
