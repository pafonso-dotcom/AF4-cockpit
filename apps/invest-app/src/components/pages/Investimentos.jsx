import React, { useState, useMemo, useEffect } from "react";
import { Activity, Briefcase, RefreshCw, Plus, Trash2, Edit3, DollarSign, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, LineChart, Calculator, Printer } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { T } from "../../lib/theme.js";
import { fmt, fmtN, fmtP, uid, generateHistory, todayISO } from "../../lib/format.js";
import { API, COIN_MAP } from "../../lib/api.js";
import { RF_INDEXADORES } from "../../lib/rendaFixa.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";
import Field from "../ui/Field.jsx";
import StatCard from "../ui/StatCard.jsx";
import Modal from "../ui/Modal.jsx";
import PdfCarteira from "./Invest/PdfCarteira.jsx";
import CarteiraSaude from "./Invest/CarteiraSaude.jsx";

const TIPOS_ANALISAVEIS = ["acao", "fii", "stock", "reit", "etf", "cripto"];

// Segmentos/setores sugeridos por tipo de ativo (B3 + padrões de mercado).
// "Outros" libera input livre de texto.
const SEGMENTOS = {
  acao: [
    "Bancos", "Energia Elétrica", "Petróleo & Gás", "Mineração & Siderurgia",
    "Varejo", "Tecnologia", "Saúde", "Indústria", "Construção & Imobiliário",
    "Telecom", "Agronegócio", "Bens de Consumo", "Holding",
  ],
  fii: [
    "Logística", "Shoppings", "Lajes Corporativas", "Recebíveis (CRI)",
    "Híbrido", "Hospitalar", "Residencial", "Educacional",
    "Hotel", "Agro", "Fundo de Fundos (FOF)", "Renda Urbana",
  ],
  stock: [
    "Technology", "Financial", "Energy", "Healthcare",
    "Consumer", "Industrial", "Communication", "Real Estate", "Utilities",
  ],
  reit: [
    "Residential", "Commercial", "Industrial",
    "Mortgage", "Specialty", "Healthcare", "Retail",
  ],
  etf: [
    "Índice (IBOV/S&P)", "Setorial", "Renda Fixa",
    "Internacional", "ESG", "Cripto", "Smart Beta",
  ],
  cripto: [
    "Layer 1", "Layer 2", "DeFi",
    "Stablecoin", "Meme", "Privacy", "RWA", "AI",
  ],
  tesouro: [
    "Selic (pós-fixado)", "Prefixado", "IPCA+",
    "IPCA+ com juros semestrais", "Renda+", "Educa+",
  ],
  cdb: [
    "Pós-fixado (CDI)", "Prefixado", "IPCA+",
    "Híbrido", "Liquidez diária",
  ],
};

export default function Investimentos({ ativos, setAtivos, contas, setContas, categorias, transacoes, setTransacoes, onRefresh, refreshing, onAnalisar, onProjetar, hidden }) {
  const [form, setForm] = useState(null);
  const [importarAberto, setImportarAberto] = useState(false);
  const [aporteForm, setAporteForm] = useState(null);
  const [vendaForm, setVendaForm] = useState(null);
  const [filter, setFilter] = useState("todos");
  const [selected, setSelected] = useState(null);
  // Quando setado, abre PdfCarteira com este ativo pré-selecionado.
  const [pdfAtivoId, setPdfAtivoId] = useState(null);

  // Tick a cada 15s pra recalcular o indicador "ao vivo" sem depender
  // de re-render externo. Ativo é considerado "ao vivo" se recebeu
  // cotação nos últimos 60s.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);
  const isLive = (a) => {
    if (!a?.ultimaAtt) return false;
    const t = Date.parse(a.ultimaAtt);
    if (!Number.isFinite(t)) return false;
    return (now - t) < 60_000;
  };
  const [fetchingPrice, setFetchingPrice] = useState(false);

  // ★ Atalho rápido global: abre aporte no primeiro ativo ou modal de novo ativo
  useEffect(() => {
    const handler = () => {
      if (ativos.length > 0) {
        const a = ativos[0];
        setAporteForm({ ativoId: a.id, qtd: "", preco: a.preco.toString(), conta: contas?.[0]?.nome || "" });
      } else {
        setForm({ id: null, ticker: "", nome: "", tipo: "acao", segmento: "", qtd: "", pm: "", preco: "", base: 0 });
      }
    };
    window.addEventListener("af4:open-new-aporte", handler);
    return () => window.removeEventListener("af4:open-new-aporte", handler);
  }, [ativos, contas]);

  const tipos = [
    { v: "acao", l: "Ações" }, { v: "fii", l: "FIIs" },
    { v: "stock", l: "Stocks (US)" }, { v: "reit", l: "REITs (US)" },
    { v: "etf", l: "ETFs" },
    { v: "cripto", l: "Cripto" }, { v: "tesouro", l: "Tesouro" }, { v: "cdb", l: "CDB" },
  ];

  const filtered = filter === "todos" ? ativos : ativos.filter(a => a.tipo === filter);

  const totais = useMemo(() => {
    const valor = filtered.reduce((s, a) => s + a.qtd * a.preco, 0);
    const custo = filtered.reduce((s, a) => s + a.qtd * a.pm, 0);
    return { valor, custo, ganho: valor - custo, pct: custo > 0 ? ((valor - custo) / custo) * 100 : 0 };
  }, [filtered]);

  // Agrupa ativos por segmento (ordenado por valor decrescente).
  // Ativos sem segmento caem num grupo "Sem segmento".
  const grupos = useMemo(() => {
    const m = new Map();
    filtered.forEach(a => {
      const seg = (a.segmento && String(a.segmento).trim()) || "Sem segmento";
      if (!m.has(seg)) m.set(seg, []);
      m.get(seg).push(a);
    });
    return [...m.entries()]
      .map(([segmento, items]) => {
        const valor = items.reduce((s, a) => s + (Number(a.qtd) || 0) * (Number(a.preco) || 0), 0);
        return { segmento, ativos: items, valor, count: items.length };
      })
      .sort((a, b) => b.valor - a.valor);
  }, [filtered]);

  // Quais segmentos estão colapsados (persistido em localStorage).
  const [collapsedSegs, setCollapsedSegs] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("af4:invest:collapsed") || "[]")); }
    catch { return new Set(); }
  });
  const toggleSeg = (seg) => {
    setCollapsedSegs(prev => {
      const next = new Set(prev);
      if (next.has(seg)) next.delete(seg); else next.add(seg);
      try { localStorage.setItem("af4:invest:collapsed", JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const formPreview = useMemo(() => {
    if (!form) return null;
    const qtd = parseFloat(form.qtd) || 0;
    const pm = parseFloat(form.pm) || 0;
    const preco = parseFloat(form.preco) || pm;
    const investido = qtd * pm;
    const mercado = qtd * preco;
    const ganho = mercado - investido;
    const pct = investido > 0 ? (ganho / investido) * 100 : 0;
    return { qtd, pm, preco, investido, mercado, ganho, pct };
  }, [form]);

  const [formErrors, setFormErrors] = useState({});

  const save = () => {
    const errs = {};
    if (!form.ticker?.trim()) errs.ticker = "Ticker é obrigatório";
    if (!form.qtd || parseFloat(form.qtd) <= 0) errs.qtd = "Quantidade deve ser positiva";
    if (!form.pm || parseFloat(form.pm) <= 0) errs.pm = "Preço médio deve ser positivo";

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }

    const data = {
      ...form,
      ticker: form.ticker.toUpperCase(),
      qtd: parseFloat(form.qtd),
      pm: parseFloat(form.pm),
      preco: parseFloat(form.preco) || parseFloat(form.pm),
      base: parseFloat(form.preco) || parseFloat(form.pm),
    };
    if (form.id && ativos.find(a => a.id === form.id)) {
      setAtivos(ativos.map(a => a.id === form.id ? data : a));
      toast.success(`${data.ticker} atualizado.`);
    } else {
      setAtivos([...ativos, { ...data, id: uid() }]);
      toast.success(`${data.ticker} adicionado à carteira.`);
    }
    setForm(null);
    setFormErrors({});
  };

  const fetchPrice = async () => {
    if (!form.ticker) return;
    setFetchingPrice(true);
    try {
      let preco = null;
      if (form.tipo === "acao" || form.tipo === "fii") {
        const data = await API.brapiQuotes([form.ticker.toUpperCase()]);
        const found = data?.find(d => d.symbol === form.ticker.toUpperCase());
        if (found?.regularMarketPrice) preco = found.regularMarketPrice;
      } else if (form.tipo === "cripto") {
        const coinId = COIN_MAP[form.ticker.toUpperCase()];
        if (coinId) {
          const data = await API.coingeckoPrices([coinId]);
          if (data?.[coinId]?.brl) preco = data[coinId].brl;
        }
      }
      if (preco) {
        setForm({ ...form, preco: preco.toFixed(2) });
        toast.success(`Cotação atualizada: ${form.ticker.toUpperCase()} = R$ ${preco.toFixed(2)}`);
      } else {
        toast.error("Cotação não encontrada. Digite o preço manualmente ou confira o ticker.");
      }
    } catch (e) {
      toast.error("Falha ao buscar cotação: " + (e.message || "erro desconhecido"));
    }
    setFetchingPrice(false);
  };

  const doAporte = () => {
    if (!aporteForm.qtd || !aporteForm.preco) return;
    const novaQtd = parseFloat(aporteForm.qtd);
    const precoCompra = parseFloat(aporteForm.preco);
    if (novaQtd <= 0 || precoCompra <= 0) return;
    const ativo = ativos.find(a => a.id === aporteForm.ativoId);
    if (!ativo) return;

    const totalGasto = novaQtd * precoCompra;
    const contaUsada = aporteForm.conta ? contas?.find(c => c.nome === aporteForm.conta) : null;

    // Verifica saldo se houver conta selecionada
    if (contaUsada && contaUsada.saldo < totalGasto) {
      toast.error(`Saldo insuficiente em ${contaUsada.nome}. Disponível: ${fmt(contaUsada.saldo)}, necessário: ${fmt(totalGasto)}.`);
      return;
    }

    const qtdAtual = ativo.qtd;
    const pmAtual = ativo.pm;
    const qtdTotal = qtdAtual + novaQtd;
    const pmNovo = (qtdAtual * pmAtual + novaQtd * precoCompra) / qtdTotal;

    // 1. Atualiza ativo
    setAtivos(ativos.map(a => a.id === ativo.id ? {
      ...a, qtd: qtdTotal, pm: +pmNovo.toFixed(4), preco: precoCompra,
    } : a));

    // 2. Se houver conta: debita e cria despesa
    let tx = null;
    if (contaUsada && setContas && setTransacoes) {
      setContas(contas.map(c => c.id === contaUsada.id
        ? { ...c, saldo: Number(c.saldo) - totalGasto }
        : c));
      const catInv = (categorias || []).find(c => c.tipo === "despesa" && /investiment|aporte/i.test(c.nome))?.nome
                  || (categorias || []).find(c => c.tipo === "despesa")?.nome || "";
      tx = {
        id: uid(),
        tipo: "despesa",
        valor: totalGasto,
        descricao: `Aporte ${ativo.ticker} (${novaQtd} × ${fmt(precoCompra)})`,
        categoria: catInv,
        conta: contaUsada.nome,
        data: todayISO(),
        compensado: true,
        obs: `Investimento em ${ativo.nome}`,
        fixa: false,
        vencimento: null,
      };
      setTransacoes([tx, ...(transacoes || [])]);
    }

    setAporteForm(null);
    toast.success(
      `Aporte registrado: ${novaQtd} ${ativo.ticker} a ${fmt(precoCompra)}.${contaUsada ? ` Debitado de ${contaUsada.nome}.` : ""}`,
      tx ? {
        action: {
          label: "Desfazer",
          onClick: () => {
            setAtivos(ativos);
            if (contaUsada) {
              setContas(contas);
              setTransacoes((transacoes || []).filter(t => t.id !== tx.id));
            }
          },
        },
      } : {}
    );
  };

  const doVenda = async () => {
    if (!vendaForm.qtd || !vendaForm.preco) return;
    const qtdVender = parseFloat(vendaForm.qtd);
    const precoVenda = parseFloat(vendaForm.preco);
    if (qtdVender <= 0 || precoVenda <= 0) return;
    const ativo = ativos.find(a => a.id === vendaForm.ativoId);
    if (!ativo) return;
    if (qtdVender > ativo.qtd) {
      toast.error(`Você só tem ${fmtN(ativo.qtd, 8)} ${ativo.ticker} disponíveis.`);
      return;
    }
    const resultado = qtdVender * (precoVenda - ativo.pm);
    const qtdRestante = ativo.qtd - qtdVender;
    const valorBruto = qtdVender * precoVenda;
    const contaUsada = vendaForm.conta ? contas?.find(c => c.nome === vendaForm.conta) : null;

    // Confirmar com modal próprio
    const isFullSale = qtdRestante <= 0.0000001;
    const ok = await confirm({
      title: isFullSale ? `Vender TODAS as ${ativo.ticker}?` : `Confirmar venda de ${fmtN(qtdVender, 8)} ${ativo.ticker}?`,
      body: `Preço de venda: ${fmt(precoVenda)} · Resultado: ${fmt(resultado)} (${resultado >= 0 ? "lucro" : "prejuízo"})${isFullSale ? "\n\nO ativo será removido da carteira." : `\nRestará: ${fmtN(qtdRestante, 8)}`}${contaUsada ? `\n\n${fmt(valorBruto)} será creditado em ${contaUsada.nome}.` : ""}`,
      danger: isFullSale,
      confirmLabel: isFullSale ? "Vender Tudo" : "Vender",
    });
    if (!ok) return;

    // 1. Atualiza ativo
    if (isFullSale) {
      setAtivos(ativos.filter(a => a.id !== ativo.id));
    } else {
      setAtivos(ativos.map(a => a.id === ativo.id ? {
        ...a, qtd: qtdRestante, preco: precoVenda,
      } : a));
    }

    // 2. Se houver conta: credita e cria receita
    let tx = null;
    if (contaUsada && setContas && setTransacoes) {
      setContas(contas.map(c => c.id === contaUsada.id
        ? { ...c, saldo: Number(c.saldo) + valorBruto }
        : c));
      const catInv = (categorias || []).find(c => c.tipo === "receita" && /investiment|venda/i.test(c.nome))?.nome
                  || (categorias || []).find(c => c.tipo === "receita")?.nome || "";
      tx = {
        id: uid(),
        tipo: "receita",
        valor: valorBruto,
        descricao: `Venda ${ativo.ticker} (${qtdVender} × ${fmt(precoVenda)})`,
        categoria: catInv,
        conta: contaUsada.nome,
        data: todayISO(),
        compensado: true,
        obs: `Resultado: ${fmt(resultado)} (${resultado >= 0 ? "lucro" : "prejuízo"})`,
        fixa: false,
        vencimento: null,
      };
      setTransacoes([tx, ...(transacoes || [])]);
    }

    setVendaForm(null);
    toast.success(
      `Venda registrada. ${resultado >= 0 ? "Lucro" : "Prejuízo"}: ${fmt(resultado)}.${contaUsada ? ` ${fmt(valorBruto)} em ${contaUsada.nome}.` : ""}`,
      tx ? {
        action: {
          label: "Desfazer",
          onClick: () => {
            setAtivos(ativos);
            if (contaUsada) {
              setContas(contas);
              setTransacoes((transacoes || []).filter(t => t.id !== tx.id));
            }
          },
        },
      } : {}
    );
  };

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Capítulo IV"
        title="Investimentos"
        sub="Sua carteira como tese viva. Atualize, acompanhe, repondere."
        action={
          <div className="flex gap-2 flex-wrap no-print">
            <button className="btn-ghost" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw size={12} className={`inline mr-2 ${refreshing ? "spin" : ""}`} />
              {refreshing ? "Atualizando…" : "Atualizar Mercado"}
            </button>
            <button className="btn-gold" onClick={() => setForm({ id: null, ticker: "", nome: "", tipo: "acao", segmento: "", qtd: "", pm: "", preco: "", base: 0 })}>
              <Plus size={14} className="inline mr-2" />Novo Ativo
            </button>
          </div>
        }
      />

      <CarteiraSaude ativos={ativos} hidden={hidden} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-6 no-print" style={{ background: T.border }}>
        <StatCard label="Valor Investido" value={hidden ? "•••••" : fmt(totais.custo)} accent={T.muted} icon={DollarSign}
                  sub={`${filtered.length} ativos`} />
        <StatCard label="Valor de Mercado" value={hidden ? "•••••" : fmt(totais.valor)} accent={T.gold} icon={Briefcase} />
        <StatCard label="Resultado" value={hidden ? "•••••" : fmt(totais.ganho)}
                  accent={totais.ganho >= 0 ? T.green : T.red}
                  icon={totais.ganho >= 0 ? TrendingUp : TrendingDown}
                  sub={fmtP(totais.pct)} />
        <StatCard label="Posições" value={String(filtered.length)} accent={T.blue} icon={Activity}
                  sub={`${filtered.filter(a => a.preco > a.pm).length} no lucro`} />
      </div>

      <div className="flex flex-wrap gap-2 mb-6 no-print">
        {[{ v: "todos", l: "Todos" }, ...tipos].map(t => (
          <button key={t.v} onClick={() => setFilter(t.v)}
            style={{
              padding: "8px 16px", border: `1px solid ${filter === t.v ? T.gold : T.border}`,
              background: filter === t.v ? `${T.gold}22` : "transparent",
              color: filter === t.v ? T.gold : T.muted,
              fontFamily: T.sans, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase",
            }}>{t.l}</button>
        ))}
      </div>

      {/* Mobile: cards verticais agrupados por segmento */}
      <div className="md:hidden space-y-3 mb-6">
        {filtered.length === 0 && (
          <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 32, textAlign: "center", color: T.muted, fontStyle: "italic" }}>
            Nenhum ativo nessa categoria.
          </div>
        )}
        {grupos.map(grupo => {
          const fechado = collapsedSegs.has(grupo.segmento);
          return (
            <React.Fragment key={grupo.segmento}>
              <button onClick={() => toggleSeg(grupo.segmento)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", background: `${T.gold}10`,
                  border: `1px solid ${T.gold}33`, cursor: "pointer", textAlign: "left",
                }}>
                <span style={{ color: T.gold, fontSize: 11, fontWeight: 600 }}>
                  {fechado ? "▶" : "▼"}
                </span>
                <span style={{ flex: 1, color: T.ink, fontSize: 13, fontWeight: 600 }}>
                  {grupo.segmento}
                </span>
                <span style={{ color: T.muted, fontSize: 11 }}>
                  {grupo.count} {grupo.count === 1 ? "ativo" : "ativos"}
                </span>
                <span style={{ color: T.gold, fontSize: 12, fontWeight: 600 }}>
                  {hidden ? "•••" : fmt(grupo.valor)}
                </span>
              </button>
              {!fechado && grupo.ativos.map(a => {
          const investido = a.qtd * a.pm;
          const valor = a.qtd * a.preco;
          const ganho = valor - investido;
          const pct = investido > 0 ? (ganho / investido) * 100 : 0;
          return (
            <div key={a.id} onClick={() => setSelected(a)}
                 style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14, cursor: "pointer" }}>
              <div className="flex justify-between items-start mb-3">
                <div className="min-w-0">
                  <div style={{ fontFamily: T.serif, fontSize: 19, color: T.ink, display: "flex", alignItems: "center", gap: 8 }}>
                    {a.ticker}
                    {isLive(a) && <span className="af4-live-dot" title="Cotação ao vivo (atualizada nos últimos 60s)" />}
                  </div>
                  <div style={{ color: T.muted, fontSize: 12, marginTop: 2 }} className="italic truncate">{a.nome}</div>
                  <div style={{ color: T.faint, fontSize: 10, marginTop: 4, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: T.sans }}>
                    {a.tipo} · {fmtN(a.qtd, a.tipo === "cripto" ? 8 : 0)} un.
                  </div>
                  {a.segmento && (
                    <div style={{
                      display: "inline-block", marginTop: 6,
                      padding: "2px 8px", borderRadius: 4,
                      background: `${T.gold}15`, color: T.gold,
                      fontSize: 10, fontWeight: 600, letterSpacing: ".03em",
                    }}>
                      {a.segmento}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0 ml-2">
                  <div className="num" style={{ color: ganho >= 0 ? T.green : T.red, fontSize: 14, fontWeight: 600 }}>
                    {hidden ? "•••" : fmt(ganho)}
                  </div>
                  <div className="num" style={{ color: ganho >= 0 ? T.green : T.red, fontSize: 11 }}>
                    {fmtP(pct)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs mb-3" style={{ paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
                <div>
                  <div style={{ color: T.muted, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" }}>PM</div>
                  <div className="num" style={{ color: T.muted, marginTop: 2 }}>{hidden ? "•••" : fmt(a.pm)}</div>
                </div>
                <div>
                  <div style={{ color: T.muted, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" }}>Preço</div>
                  <div className="num" style={{ color: T.gold, marginTop: 2 }}>{hidden ? "•••" : fmt(a.preco)}</div>
                  {Number.isFinite(Number(a.variacao24h)) && (
                    <div className="num" style={{
                      fontSize: 10, marginTop: 2,
                      color: Number(a.variacao24h) >= 0 ? T.green : T.red,
                    }}>
                      {Number(a.variacao24h) >= 0 ? "+" : ""}{Number(a.variacao24h).toFixed(2)}% 24h
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ color: T.muted, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase" }}>Valor</div>
                  <div className="num" style={{ color: T.ink, marginTop: 2 }}>{hidden ? "•••" : fmt(valor)}</div>
                </div>
              </div>
              <div className="flex gap-2 no-print" onClick={e => e.stopPropagation()}>
                <button onClick={() => setAporteForm({ ativoId: a.id, qtd: "", preco: a.preco.toString(), conta: contas?.[0]?.nome || "" })}
                        aria-label={`Aportar em ${a.ticker}`}
                        style={{ flex: 1, background: `${T.green}22`, color: T.green, padding: "6px 8px", border: `1px solid ${T.green}`, fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }}>
                  Aporte
                </button>
                <button onClick={() => setVendaForm({ ativoId: a.id, qtd: "", preco: a.preco.toString(), conta: contas?.[0]?.nome || "" })}
                        aria-label={`Vender ${a.ticker}`}
                        style={{ flex: 1, background: `${T.red}22`, color: T.red, padding: "6px 8px", border: `1px solid ${T.red}`, fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer" }}>
                  Venda
                </button>
                {onAnalisar && TIPOS_ANALISAVEIS.includes(a.tipo) && (
                  <button onClick={() => onAnalisar(a)} aria-label={`Analisar ${a.ticker}`} title="Análise técnica"
                          style={{ color: T.gold, padding: 6, background: "transparent", border: `1px solid ${T.gold}`, cursor: "pointer" }}>
                    <LineChart size={14} />
                  </button>
                )}
                {onProjetar && (
                  <button onClick={() => onProjetar(a)} aria-label={`Projetar ${a.ticker}`} title="Projetar evolução deste ativo"
                          style={{ color: T.gold, padding: 6, background: "transparent", border: `1px solid ${T.gold}`, cursor: "pointer" }}>
                    <Calculator size={14} />
                  </button>
                )}
                <button onClick={() => setPdfAtivoId(a.id)} aria-label={`Imprimir PDF de ${a.ticker}`} title="Imprimir PDF deste ativo"
                        style={{ color: T.gold, padding: 6, background: "transparent", border: `1px solid ${T.gold}`, cursor: "pointer" }}>
                  <Printer size={14} />
                </button>
                <button onClick={() => setForm(a)} aria-label={`Editar ${a.ticker}`} style={{ color: T.muted, padding: 6, background: "transparent", border: `1px solid ${T.border}`, cursor: "pointer" }}>
                  <Edit3 size={14} />
                </button>
                <button onClick={async () => {
                          const ok = await confirm({
                            title: `Excluir ${a.ticker}?`,
                            body: `Posição de ${a.qtd} ${a.ticker} (${fmt(a.qtd * a.preco)}) será removida.`,
                            danger: true, confirmLabel: "Excluir",
                          });
                          if (!ok) return;
                          const backup = ativos;
                          setAtivos(ativos.filter(x => x.id !== a.id));
                          toast.success(`${a.ticker} removido.`, {
                            action: { label: "Desfazer", onClick: () => setAtivos(backup) },
                          });
                        }}
                        aria-label={`Excluir ${a.ticker}`}
                        style={{ color: T.red, padding: 6, background: "transparent", border: `1px solid ${T.red}`, cursor: "pointer" }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
              })}
            </React.Fragment>
          );
        })}
      </div>

      {/* Desktop: tabela completa */}
      <div className="hidden md:block overflow-x-auto" style={{ background: T.card, border: `1px solid ${T.border}` }}>
        <table className="w-full" style={{ minWidth: 820 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${T.border}` }}>
              {["Ativo", "Tipo", "Qtd", "PM", "Preço Atual", "Investido", "Valor", "Resultado", "Ações"].map((h, i) => (
                <th key={i}
                    className={h === "Ações" ? "no-print" : undefined}
                    style={{ color: T.muted, padding: "12px 16px", textAlign: i > 1 ? "right" : "left",
                             fontFamily: T.sans, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {refreshing && filtered.length === 0 && (
              <>
                {[1,2,3,4,5].map(i => (
                  <tr key={`skel-${i}`}>
                    <td colSpan={9} style={{ padding: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: `linear-gradient(90deg, ${T.bgSoft || T.card}, ${T.border}, ${T.bgSoft || T.card})`,
                          backgroundSize: "200% 100%", animation: "skelPulse 1.6s ease-in-out infinite",
                        }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 13, width: 110, background: `linear-gradient(90deg, ${T.bgSoft || T.card}, ${T.border}, ${T.bgSoft || T.card})`, backgroundSize: "200% 100%", animation: "skelPulse 1.6s ease-in-out infinite", borderRadius: 4 }} />
                          <div style={{ height: 4 }} />
                          <div style={{ height: 10, width: 70, background: `linear-gradient(90deg, ${T.bgSoft || T.card}, ${T.border}, ${T.bgSoft || T.card})`, backgroundSize: "200% 100%", animation: "skelPulse 1.6s ease-in-out infinite", borderRadius: 4 }} />
                        </div>
                        <div style={{ width: 90, height: 14, background: `linear-gradient(90deg, ${T.bgSoft || T.card}, ${T.border}, ${T.bgSoft || T.card})`, backgroundSize: "200% 100%", animation: "skelPulse 1.6s ease-in-out infinite", borderRadius: 4 }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </>
            )}
            {grupos.map(grupo => {
              const fechado = collapsedSegs.has(grupo.segmento);
              return (
                <React.Fragment key={grupo.segmento}>
                  <tr onClick={() => toggleSeg(grupo.segmento)}
                      style={{ cursor: "pointer", background: `${T.gold}10`, borderTop: `1px solid ${T.gold}33`, borderBottom: `1px solid ${T.gold}33` }}>
                    <td colSpan={9} style={{ padding: "8px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color: T.gold, fontSize: 11, fontWeight: 600 }}>
                          {fechado ? "▶" : "▼"}
                        </span>
                        <span style={{ flex: 1, color: T.ink, fontSize: 13, fontWeight: 600 }}>
                          {grupo.segmento}
                        </span>
                        <span style={{ color: T.muted, fontSize: 11 }}>
                          {grupo.count} {grupo.count === 1 ? "ativo" : "ativos"}
                        </span>
                        <span style={{ color: T.gold, fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                          {hidden ? "•••" : fmt(grupo.valor)}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {!fechado && grupo.ativos.map(a => {
              const investido = a.qtd * a.pm;
              const valor = a.qtd * a.preco;
              const ganho = valor - investido;
              const pct = investido > 0 ? (ganho / investido) * 100 : 0;
              return (
                <tr key={a.id} className="hover:bg-black/30" style={{ borderBottom: `1px solid ${T.border}`, transition: "background 0.2s", cursor: "pointer" }}
                    onClick={() => setSelected(a)}>
                  <td style={{ padding: "14px 16px" }}>
                    <div style={{ fontFamily: T.serif, fontSize: 17, color: T.ink, display: "inline-flex", alignItems: "center", gap: 8 }}>
                      {a.ticker}
                      {isLive(a) && <span className="af4-live-dot" title="Cotação ao vivo (atualizada nos últimos 60s)" />}
                    </div>
                    <div style={{ color: T.muted, fontSize: 12 }} className="italic">{a.nome}</div>
                  </td>
                  <td style={{ padding: "14px 16px", color: T.muted, fontSize: 11, fontFamily: T.sans, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {a.tipo}
                    {a.segmento && (
                      <div style={{ color: T.gold, fontSize: 9.5, marginTop: 3, letterSpacing: ".03em", textTransform: "none", fontWeight: 500 }}>
                        {a.segmento}
                      </div>
                    )}
                  </td>
                  <td className="num" style={{ padding: "14px 16px", textAlign: "right", color: T.ink }}>{fmtN(a.qtd, a.tipo === "cripto" ? 8 : 0)}</td>
                  <td className="num" style={{ padding: "14px 16px", textAlign: "right", color: T.muted }}>{hidden ? "•••" : fmt(a.pm)}</td>
                  <td className="num" style={{ padding: "14px 16px", textAlign: "right", color: T.gold }}>
                    {hidden ? "•••" : fmt(a.preco)}
                    {Number.isFinite(Number(a.variacao24h)) && (
                      <div style={{
                        fontSize: 10, marginTop: 2,
                        color: Number(a.variacao24h) >= 0 ? T.green : T.red,
                      }}>
                        {Number(a.variacao24h) >= 0 ? "+" : ""}{Number(a.variacao24h).toFixed(2)}% 24h
                      </div>
                    )}
                  </td>
                  <td className="num" style={{ padding: "14px 16px", textAlign: "right", color: T.muted }}>{hidden ? "•••" : fmt(investido)}</td>
                  <td className="num" style={{ padding: "14px 16px", textAlign: "right", color: T.ink }}>{hidden ? "•••" : fmt(valor)}</td>
                  <td className="num" style={{ padding: "14px 16px", textAlign: "right", color: ganho >= 0 ? T.green : T.red }}>
                    {hidden ? "•••" : fmt(ganho)}<br/>
                    <span style={{ fontSize: 11 }}>{fmtP(pct)}</span>
                  </td>
                  <td className="no-print" style={{ padding: "14px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={e => { e.stopPropagation(); setAporteForm({ ativoId: a.id, qtd: "", preco: a.preco.toString(), conta: contas?.[0]?.nome || "" }); }}
                            title="Novo Aporte"
                            style={{ background: `${T.green}22`, color: T.green, padding: "4px 8px", border: `1px solid ${T.green}`, marginRight: 4, cursor: "pointer", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      <ArrowDownRight size={10} className="inline" /> Aporte
                    </button>
                    <button onClick={e => { e.stopPropagation(); setVendaForm({ ativoId: a.id, qtd: "", preco: a.preco.toString(), conta: contas?.[0]?.nome || "" }); }}
                            title="Venda"
                            style={{ background: `${T.red}22`, color: T.red, padding: "4px 8px", border: `1px solid ${T.red}`, marginRight: 4, cursor: "pointer", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                      <ArrowUpRight size={10} className="inline" /> Venda
                    </button>
                    {onAnalisar && TIPOS_ANALISAVEIS.includes(a.tipo) && (
                      <button onClick={e => { e.stopPropagation(); onAnalisar(a); }} aria-label={`Analisar ${a.ticker}`} title="Análise técnica"
                              style={{ color: T.gold, padding: 4, background: "transparent", border: "none", cursor: "pointer" }}><LineChart size={12} /></button>
                    )}
                    {onProjetar && (
                      <button onClick={e => { e.stopPropagation(); onProjetar(a); }} aria-label={`Projetar ${a.ticker}`} title="Projetar evolução deste ativo"
                              style={{ color: T.gold, padding: 4, background: "transparent", border: "none", cursor: "pointer" }}><Calculator size={12} /></button>
                    )}
                    <button onClick={e => { e.stopPropagation(); setPdfAtivoId(a.id); }} aria-label={`Imprimir PDF de ${a.ticker}`} title="Imprimir PDF deste ativo"
                            style={{ color: T.gold, padding: 4, background: "transparent", border: "none", cursor: "pointer" }}><Printer size={12} /></button>
                    <button onClick={e => { e.stopPropagation(); setForm(a); }} aria-label={`Editar ${a.ticker}`} style={{ color: T.muted, padding: 4, background: "transparent", border: "none", cursor: "pointer" }}><Edit3 size={12} /></button>
                    <button onClick={async e => {
                              e.stopPropagation();
                              const ok = await confirm({
                                title: `Excluir ${a.ticker}?`,
                                body: `Posição de ${a.qtd} ${a.ticker} (${fmt(a.qtd * a.preco)}) será removida da carteira.`,
                                danger: true, confirmLabel: "Excluir",
                              });
                              if (!ok) return;
                              const backup = ativos;
                              setAtivos(ativos.filter(x => x.id !== a.id));
                              toast.success(`${a.ticker} removido da carteira.`, {
                                action: { label: "Desfazer", onClick: () => setAtivos(backup) },
                              });
                            }}
                            style={{ color: T.red, padding: 4, background: "transparent", border: "none", cursor: "pointer" }}><Trash2 size={12} /></button>
                  </td>
                </tr>
              );
                  })}
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: T.muted, fontStyle: "italic" }}>
                Nenhum ativo nessa categoria.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && <DetalheAtivo ativo={selected} onClose={() => setSelected(null)} />}

      {pdfAtivoId && (
        <PdfCarteira
          ativos={ativos}
          proventos={[]}
          operacoes={[]}
          initialSelectedId={pdfAtivoId}
          onClose={() => setPdfAtivoId(null)}
        />
      )}

      {form && (
        <Modal title={form.id ? "Editar Ativo" : "Novo Ativo"} onClose={() => setForm(null)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ticker / Código">
              <input value={form.ticker} onChange={e => setForm({ ...form, ticker: e.target.value.toUpperCase() })} placeholder="PETR4 · HGRE11 · BTC" />
            </Field>
            <Field label="Tipo">
              <select value={form.tipo}
                      onChange={e => setForm({ ...form, tipo: e.target.value, segmento: "" })}>
                {tipos.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </Field>
          </div>
          <SegmentoField form={form} setForm={setForm} />
          {(form.tipo === "cdb" || form.tipo === "tesouro") && (() => {
            const opt = RF_INDEXADORES.find(o => o.v === form.rfIndexador);
            return (
              <div style={{ background: `${T.gold}0d`, border: `1px solid ${T.gold}33`, borderRadius: 12, padding: 12, marginBottom: 4 }}>
                <div className="label-eyebrow" style={{ color: T.gold, marginBottom: 8 }}>Rentabilidade contratada (renda fixa)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Indexador">
                    <select value={form.rfIndexador || ""} onChange={e => setForm({ ...form, rfIndexador: e.target.value })}>
                      <option value="">— não calcular —</option>
                      {RF_INDEXADORES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </Field>
                  <Field label={opt?.campo || "Taxa"}>
                    <input type="number" step="0.0001" value={form.rfTaxa ?? ""}
                           onChange={e => setForm({ ...form, rfTaxa: e.target.value })}
                           placeholder={form.rfIndexador === "cdi" ? "104,5" : form.rfIndexador === "selic" ? "0,07" : "Ex.: 5,5"}
                           disabled={!form.rfIndexador} />
                  </Field>
                </div>
                <div style={{ fontSize: 10.5, color: T.faint, marginTop: 6, fontStyle: "italic" }}>
                  Ex.: CDI 104,5% · Tesouro Selic + 0,07%. O rendimento previsto do mês aparece em Proventos.
                </div>
              </div>
            );
          })()}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Quantidade">
              <input type="number" step="0.00000001" value={form.qtd} onChange={e => setForm({ ...form, qtd: e.target.value })} placeholder="8" />
            </Field>
            <Field label="Preço Médio (R$/unid)">
              <input type="number" step="0.01" value={form.pm} onChange={e => setForm({ ...form, pm: e.target.value })} placeholder="106,85" />
            </Field>
            <Field label="Preço Atual (R$/unid)">
              <div style={{ display: "flex", gap: 4 }}>
                <input type="number" step="0.01" value={form.preco} onChange={e => setForm({ ...form, preco: e.target.value })} placeholder="120,00" style={{ flex: 1 }} />
                <button type="button" onClick={fetchPrice} disabled={!form.ticker || fetchingPrice}
                        title="Buscar cotação atual"
                        style={{ background: T.gold, color: T.bg, border: "none", padding: "0 10px", cursor: fetchingPrice ? "wait" : "pointer", fontSize: 11 }}>
                  <RefreshCw size={12} className={fetchingPrice ? "spin" : ""} />
                </button>
              </div>
            </Field>
          </div>

          {/* Atalho: VALOR APLICADO TOTAL → calcula PM automático */}
          <Field label="Valor aplicado total (R$) — opcional">
            <div style={{ display: "flex", gap: 6 }}>
              <input
                type="number" step="0.01"
                value={form.valorAplicado || ""}
                onChange={e => setForm({ ...form, valorAplicado: e.target.value })}
                placeholder="Ex: 1.000,00"
                style={{ flex: 1 }}
              />
              <button type="button"
                onClick={() => {
                  const total = parseFloat(form.valorAplicado);
                  const q = parseFloat(form.qtd);
                  if (!total || !q) {
                    toast.error("Preencha Quantidade e Valor aplicado total antes de calcular.");
                    return;
                  }
                  setForm({ ...form, pm: (total / q).toFixed(4) });
                }}
                style={{ background: T.gold, color: T.bg, border: "none", padding: "0 14px", cursor: "pointer", fontSize: 11, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", borderRadius: 6 }}>
                ↻ Calcular PM
              </button>
            </div>
            <div style={{ fontSize: 10.5, color: T.faint, marginTop: 4, fontStyle: "italic" }}>
              Use quando você sabe quanto investiu no total (R$) mas não sabe o preço médio por unidade. Tipo: comprou R$1.000 de Tesouro Selic e recebeu 9,43 unidades → Calcular PM.
            </div>
          </Field>

          {formPreview && formPreview.qtd > 0 && formPreview.pm > 0 && (
            <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, padding: 14, marginTop: 12 }}>
              <div className="label-eyebrow mb-2">Resumo da posição</div>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span style={{ color: T.muted }}>Valor investido</span>
                <span className="num text-right" style={{ color: T.ink }}>{formPreview.qtd} × {fmt(formPreview.pm)} = <strong>{fmt(formPreview.investido)}</strong></span>
                <span style={{ color: T.muted }}>Valor de mercado</span>
                <span className="num text-right" style={{ color: T.gold }}>{formPreview.qtd} × {fmt(formPreview.preco)} = <strong>{fmt(formPreview.mercado)}</strong></span>
                <span style={{ color: T.muted, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>Saldo</span>
                <span className="num text-right" style={{ color: formPreview.ganho >= 0 ? T.green : T.red, paddingTop: 8, borderTop: `1px solid ${T.border}`, fontWeight: 600 }}>
                  {fmt(formPreview.ganho)} · {fmtP(formPreview.pct)}
                </span>
              </div>
              {Math.abs(formPreview.pct) > 200 && (
                <div style={{ color: T.gold, fontSize: 12, fontStyle: "italic", marginTop: 8 }}>
                  ⚠️ Variação muito alta — confira se os preços estão por <em>unidade</em>, não o total.
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={save}>Salvar</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}

      {aporteForm && (() => {
        const ativo = ativos.find(a => a.id === aporteForm.ativoId);
        if (!ativo) return null;
        const qtdAdd = parseFloat(aporteForm.qtd) || 0;
        const precoAdd = parseFloat(aporteForm.preco) || 0;
        const qtdNova = ativo.qtd + qtdAdd;
        const pmNovo = qtdNova > 0 ? (ativo.qtd * ativo.pm + qtdAdd * precoAdd) / qtdNova : 0;
        return (
          <Modal title={`Novo Aporte — ${ativo.ticker}`} onClose={() => setAporteForm(null)}>
            <div style={{ background: T.bgSoft, padding: 12, border: `1px solid ${T.border}`, marginBottom: 16 }}>
              <div className="label-eyebrow mb-1">Posição atual</div>
              <div className="num text-sm" style={{ color: T.ink }}>
                {fmtN(ativo.qtd, ativo.tipo === "cripto" ? 8 : 0)} × {fmt(ativo.pm)} (PM)
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantidade a adicionar">
                <input type="number" step="0.00000001" autoFocus
                       value={aporteForm.qtd}
                       onChange={e => setAporteForm({ ...aporteForm, qtd: e.target.value })}
                       placeholder="Ex.: 5" />
              </Field>
              <Field label="Preço de compra (R$/unid)">
                <input type="number" step="0.01"
                       value={aporteForm.preco}
                       onChange={e => setAporteForm({ ...aporteForm, preco: e.target.value })}
                       placeholder="Ex.: 125,00" />
              </Field>
            </div>
            {contas?.length > 0 && (
              <Field label="Conta usada para o aporte (opcional)">
                <select value={aporteForm.conta || ""} onChange={e => setAporteForm({ ...aporteForm, conta: e.target.value })}>
                  <option value="">— Não registrar na conta —</option>
                  {contas.map(c => (
                    <option key={c.id} value={c.nome}>{c.nome} · saldo {fmt(c.saldo)}</option>
                  ))}
                </select>
              </Field>
            )}
            {qtdAdd > 0 && precoAdd > 0 && (
              <div style={{ background: `${T.green}11`, border: `1px solid ${T.green}`, padding: 14, marginTop: 8 }}>
                <div className="label-eyebrow mb-2" style={{ color: T.green }}>Após o aporte</div>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span style={{ color: T.muted }}>Investido neste aporte</span>
                  <span className="num text-right" style={{ color: T.ink }}>{fmt(qtdAdd * precoAdd)}</span>
                  <span style={{ color: T.muted }}>Quantidade total</span>
                  <span className="num text-right" style={{ color: T.ink }}>{fmtN(qtdNova, ativo.tipo === "cripto" ? 8 : 0)}</span>
                  <span style={{ color: T.muted }}>Novo Preço Médio</span>
                  <span className="num text-right" style={{ color: T.gold, fontWeight: 600 }}>{fmt(pmNovo)}</span>
                </div>
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button className="btn-gold" onClick={doAporte}>Confirmar Aporte</button>
              <button className="btn-ghost" onClick={() => setAporteForm(null)}>Cancelar</button>
            </div>
          </Modal>
        );
      })()}

      {vendaForm && (() => {
        const ativo = ativos.find(a => a.id === vendaForm.ativoId);
        if (!ativo) return null;
        const qtdVender = parseFloat(vendaForm.qtd) || 0;
        const precoVender = parseFloat(vendaForm.preco) || 0;
        const resultado = qtdVender * (precoVender - ativo.pm);
        const resultadoPct = ativo.pm > 0 ? ((precoVender - ativo.pm) / ativo.pm) * 100 : 0;
        const valorBruto = qtdVender * precoVender;
        const qtdRest = ativo.qtd - qtdVender;
        return (
          <Modal title={`Venda — ${ativo.ticker}`} onClose={() => setVendaForm(null)}>
            <div style={{ background: T.bgSoft, padding: 12, border: `1px solid ${T.border}`, marginBottom: 16 }}>
              <div className="label-eyebrow mb-1">Posição atual</div>
              <div className="num text-sm" style={{ color: T.ink }}>
                {fmtN(ativo.qtd, ativo.tipo === "cripto" ? 8 : 0)} × {fmt(ativo.pm)} (PM)
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Qtd a vender (máx ${fmtN(ativo.qtd, ativo.tipo === "cripto" ? 8 : 0)})`}>
                <input type="number" step="0.00000001" autoFocus
                       max={ativo.qtd}
                       value={vendaForm.qtd}
                       onChange={e => setVendaForm({ ...vendaForm, qtd: e.target.value })}
                       placeholder={fmtN(ativo.qtd, 0)} />
              </Field>
              <Field label="Preço de venda (R$/unid)">
                <input type="number" step="0.01"
                       value={vendaForm.preco}
                       onChange={e => setVendaForm({ ...vendaForm, preco: e.target.value })}
                       placeholder="Ex.: 130,00" />
              </Field>
            </div>
            {contas?.length > 0 && (
              <Field label="Conta de destino (onde o dinheiro entra)">
                <select value={vendaForm.conta || ""} onChange={e => setVendaForm({ ...vendaForm, conta: e.target.value })}>
                  <option value="">— Não registrar na conta —</option>
                  {contas.map(c => (
                    <option key={c.id} value={c.nome}>{c.nome}</option>
                  ))}
                </select>
              </Field>
            )}
            <div className="flex gap-2 mb-2">
              {[25, 50, 75, 100].map(p => (
                <button key={p} type="button"
                        onClick={() => setVendaForm({ ...vendaForm, qtd: (ativo.qtd * p / 100).toString() })}
                        style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
                  {p}%
                </button>
              ))}
            </div>
            {qtdVender > 0 && precoVender > 0 && (
              <div style={{ background: `${resultado >= 0 ? T.green : T.red}11`, border: `1px solid ${resultado >= 0 ? T.green : T.red}`, padding: 14, marginTop: 8 }}>
                <div className="label-eyebrow mb-2" style={{ color: resultado >= 0 ? T.green : T.red }}>Resultado da operação</div>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span style={{ color: T.muted }}>Valor bruto de venda</span>
                  <span className="num text-right" style={{ color: T.ink }}>{fmt(valorBruto)}</span>
                  <span style={{ color: T.muted }}>Custo das vendidas</span>
                  <span className="num text-right" style={{ color: T.ink }}>{fmt(qtdVender * ativo.pm)}</span>
                  <span style={{ color: T.muted, paddingTop: 6, borderTop: `1px solid ${T.border}` }}>Lucro / Prejuízo</span>
                  <span className="num text-right" style={{ color: resultado >= 0 ? T.green : T.red, paddingTop: 6, borderTop: `1px solid ${T.border}`, fontWeight: 600 }}>
                    {fmt(resultado)} · {fmtP(resultadoPct)}
                  </span>
                  <span style={{ color: T.muted }}>Quantidade restante</span>
                  <span className="num text-right" style={{ color: qtdRest > 0 ? T.ink : T.muted }}>
                    {qtdRest <= 0 ? "Zerada · ativo será removido" : fmtN(qtdRest, ativo.tipo === "cripto" ? 8 : 0)}
                  </span>
                </div>
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button className="btn-gold" onClick={doVenda}>Confirmar Venda</button>
              <button className="btn-ghost" onClick={() => setVendaForm(null)}>Cancelar</button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

function DetalheAtivo({ ativo, onClose }) {
  const historia = useMemo(() => generateHistory(ativo.preco, 30,
    ativo.tipo === "cripto" ? 0.04 : ativo.tipo === "fii" ? 0.012 : ativo.tipo === "tesouro" ? 0.005 : 0.025
  ), [ativo.id, ativo.preco]);

  const valor = ativo.qtd * ativo.preco;
  const custo = ativo.qtd * ativo.pm;
  const ganho = valor - custo;
  const rendaFixa = ativo._cdbMeta || ["cdb", "tesouro", "rf"].includes(String(ativo.tipo || "").toLowerCase());

  return (
    <Modal title={`${ativo.ticker} — ${ativo.nome}`} onClose={onClose} wide>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div>
          <div className="label-eyebrow">Posição</div>
          <div className="num" style={{ color: T.ink, fontSize: 18, marginTop: 4 }}>{fmtN(ativo.qtd, ativo.tipo === "cripto" ? 8 : 0)}</div>
        </div>
        <div>
          <div className="label-eyebrow">Preço Médio</div>
          <div className="num" style={{ color: T.ink, fontSize: 18, marginTop: 4 }}>{fmt(ativo.pm)}</div>
        </div>
        <div>
          <div className="label-eyebrow">Preço Atual</div>
          <div className="num" style={{ color: T.gold, fontSize: 18, marginTop: 4 }}>{fmt(ativo.preco)}</div>
          {!rendaFixa && (
            <div style={{ fontSize: 9.5, fontWeight: 700, marginTop: 3, display: "inline-flex", alignItems: "center", gap: 4, color: ativo.realtime ? T.green : T.gold }}
                 title={ativo.realtime
                   ? `Cotação de mercado${ativo.fonteCotacao ? ` (${ativo.fonteCotacao})` : ""}${ativo.ultimaAtt ? ` · ${new Date(ativo.ultimaAtt).toLocaleString("pt-BR")}` : ""}`
                   : "Preço SIMULADO — não é o da bolsa. Ative o Mercado real em Configurações → APIs → BRAPI e clique em Atualizar mercado pra puxar a cotação real."}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: ativo.realtime ? T.green : T.gold }} />
              {ativo.realtime ? "tempo real" : "simulado — não é da bolsa"}
            </div>
          )}
        </div>
        <div>
          <div className="label-eyebrow">Resultado</div>
          <div className="num" style={{ color: ganho >= 0 ? T.green : T.red, fontSize: 18, marginTop: 4 }}>{fmt(ganho)}</div>
        </div>
      </div>

      <div style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={historia}>
            <defs>
              <linearGradient id="cor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={T.gold} stopOpacity={0.4} />
                <stop offset="100%" stopColor={T.gold} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={T.border} strokeDasharray="3 3" />
            <XAxis dataKey="data" stroke={T.muted} fontSize={10} />
            <YAxis stroke={T.muted} fontSize={10} domain={["dataMin", "dataMax"]} />
            <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}` }} />
            <Area type="monotone" dataKey="preco" stroke={T.gold} fill="url(#cor)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ color: T.muted, fontSize: 11, fontStyle: "italic", marginTop: 8, textAlign: "center" }}>
        Histórico ilustrativo (simulado) · 30 dias{!rendaFixa && !ativo.realtime ? " · preço simulado — ative o Mercado real em Configurações → APIs → BRAPI" : ""}
      </div>
    </Modal>
  );
}

/**
 * SegmentoField — campo Segmento/Setor que adapta as opções ao tipo do ativo.
 * Inclui modo "Outros" com input livre. Detecta automaticamente que o
 * usuário está editando um ativo com segmento fora da lista.
 */
function SegmentoField({ form, setForm }) {
  const opcoes = SEGMENTOS[form.tipo] || [];
  const valor = form.segmento || "";

  // Modo: "preset" (escolheu da lista) | "custom" (digitando livre) | "" (não escolheu)
  // Inicializa: se já tem segmento e NÃO está na lista, força modo custom
  const detectarModo = () => {
    if (!valor) return "";
    return opcoes.includes(valor) ? "preset" : "custom";
  };
  const [modo, setModo] = useState(detectarModo());

  // Quando troca o TIPO, reseta o modo
  useEffect(() => {
    setModo(detectarModo());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tipo]);

  const handleSelectChange = (v) => {
    if (v === "__custom__") {
      setModo("custom");
      // Mantém valor atual se já tiver, senão zera pra ele digitar
      if (opcoes.includes(valor)) setForm({ ...form, segmento: "" });
    } else if (v === "") {
      setModo("");
      setForm({ ...form, segmento: "" });
    } else {
      setModo("preset");
      setForm({ ...form, segmento: v });
    }
  };

  return (
    <Field
      label={form.tipo === "cripto" ? "Categoria"
            : (form.tipo === "tesouro" || form.tipo === "cdb") ? "Indexador / Tipo"
            : "Segmento / Setor"}
      hint="Ajuda a classificar nas análises da carteira (diversificação por setor)."
    >
      <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
        <select value={modo === "custom" ? "__custom__" : (modo === "preset" ? valor : "")}
                onChange={e => handleSelectChange(e.target.value)}>
          <option value="">— escolha —</option>
          {opcoes.map(s => <option key={s} value={s}>{s}</option>)}
          <option value="__custom__">+ Outros (digitar segmento personalizado)</option>
        </select>
        {modo === "custom" && (
          <input value={valor}
                 onChange={e => setForm({ ...form, segmento: e.target.value })}
                 placeholder="Digite o segmento/setor (ex.: Petróleo, Saneamento, AI...)"
                 autoFocus
                 style={{ marginTop: 2 }} />
        )}
      </div>
    </Field>
  );
}
