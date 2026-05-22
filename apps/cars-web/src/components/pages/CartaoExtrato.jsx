import React, { useMemo, useState } from "react";
import { T } from "../../lib/theme.js";
import { fmt } from "../../lib/format.js";
import { ArrowLeft } from "lucide-react";

// Calcula qual parcela de um parcelamento cai em um mês específico (mesISO = "2026-05")
function parcelaNoMes(parc, mesISO) {
  const dataPrimeira = parc.dataPrimeira || parc.dataInicio || parc.data;
  if (!dataPrimeira) return null;

  const totalParc = parseInt(parc.totalParcelas || parc.parcelas || 0, 10);
  if (!totalParc) return null;

  const [aP, mP] = dataPrimeira.slice(0, 7).split("-").map(Number);
  const [aM, mM] = mesISO.split("-").map(Number);
  const diffMeses = (aM - aP) * 12 + (mM - mP);

  if (diffMeses < 0 || diffMeses >= totalParc) return null;

  const numeroParcela = diffMeses + 1;
  const parcelasPagas = parc.parcelasPagas || [];
  const restantes = parc.parcelasRestantes;
  const paga = parcelasPagas.includes(numeroParcela)
    || (restantes != null && numeroParcela <= (totalParc - restantes));

  return {
    numero: numeroParcela,
    total: totalParc,
    valor: Number(parc.valorParcela || ((parc.valorTotal || 0) / totalParc) || 0),
    paga,
    descricao: parc.descricao || parc.nome || "Parcela",
    categoria: parc.categoria || "Compras",
  };
}

/**
 * Extrato de um cartão de crédito.
 * Mostra: gradiente do cartão, KPIs, parcelamentos ativos e transações da fatura.
 */
export default function CartaoExtrato({ cartao, transacoes = [], parcelamentos = [], onVoltar, hidden }) {
  if (!cartao) return null;

  const mesAtual = new Date().toISOString().slice(0, 7);
  const [verTodasParcelas, setVerTodasParcelas] = useState(false);

  // Transações do cartão no mês atual
  const txCartao = useMemo(() => {
    return transacoes
      .filter(t => t.cartaoId === cartao.id || t.cartaoNome === cartao.nome)
      .filter(t => (t.data || "").startsWith(mesAtual))
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [transacoes, cartao]);

  // Parcelamentos ativos do cartão (suporta modelo novo `parcelasPagas[]` e legado `parcelasRestantes`)
  const parcCartao = useMemo(() => {
    return parcelamentos.filter(p => {
      const doCartao = p.cartaoId === cartao.id || p.cartaoNome === cartao.nome;
      if (!doCartao) return false;
      const total = Number(p.totalParcelas || p.parcelas || 0);
      const pagasArr = (p.parcelasPagas || []).length;
      const restantes = p.parcelasRestantes != null ? Number(p.parcelasRestantes) : (total - pagasArr);
      return restantes > 0;
    });
  }, [parcelamentos, cartao]);

  // Parcelas que caem NO mês atual
  const parcelasDoMes = useMemo(() => {
    return parcelamentos
      .filter(p => p.cartaoId === cartao.id || p.cartaoNome === cartao.nome)
      .map(p => {
        const pm = parcelaNoMes(p, mesAtual);
        return pm ? { ...pm, parcId: p.id, _origem: "parcelamento" } : null;
      })
      .filter(Boolean);
  }, [parcelamentos, cartao, mesAtual]);

  // Itens combinados pra fatura: transações reais + parcelas do mês
  const itensFatura = useMemo(() => {
    const txs = txCartao.map(t => ({
      id: t.id,
      data: t.data,
      descricao: t.descricao || t.desc || "—",
      categoria: t.categoria || "Sem categoria",
      valor: Number(t.valor || 0),
      fixa: !!t.fixa,
      _origem: "transacao",
    }));

    const parcsTx = parcelasDoMes.map(p => ({
      id: `parc-${p.parcId}-${p.numero}`,
      data: mesAtual + "-01",
      descricao: `${p.descricao} (${p.numero}/${p.total})`,
      categoria: p.categoria,
      valor: p.valor,
      parcela: true,
      _origem: "parcelamento",
    }));

    return [...txs, ...parcsTx].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [txCartao, parcelasDoMes, mesAtual]);

  const fatura = Number(cartao.faturaAtual || cartao.usado || 0);
  const limite = Number(cartao.limite || 0);
  const disponivel = limite - fatura;
  const pctUso = limite > 0 ? (fatura / limite) * 100 : 0;
  const totalParcMes = parcCartao.reduce((s, p) => s + Number(p.valorParcela || p.valor || 0), 0);

  // Gradiente baseado no nome do cartão
  const gradByName = (nome) => {
    const n = (nome || "").toLowerCase();
    if (n.includes("nubank") || n.includes("nu ")) return "linear-gradient(135deg, #8b5cf6, #06b6d4)";
    if (n.includes("itau") || n.includes("itaú")) return "linear-gradient(135deg, #c9a961, #54545c)";
    if (n.includes("c6"))                          return "linear-gradient(135deg, #f43f5e, #fbbf24)";
    if (n.includes("inter"))                       return "linear-gradient(135deg, #f59e0b, #ea580c)";
    if (n.includes("santander"))                   return "linear-gradient(135deg, #dc2626, #991b1b)";
    return `linear-gradient(135deg, ${T.gold}, ${T.goldHi})`;
  };

  const gradient = gradByName(cartao.nome);

  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      <button onClick={onVoltar} className="btn-back" style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 12px", borderRadius: 7,
        background: "transparent", border: `1px solid ${T.border}`,
        color: T.muted, fontSize: 11, cursor: "pointer", marginBottom: 14,
      }}>
        <ArrowLeft size={14} /> Voltar para Cartões
      </button>

      {/* Banner */}
      <div style={{
        display: "flex", alignItems: "center", gap: 18, padding: 24,
        background: gradient, borderRadius: 12, marginBottom: 18,
        color: "#fff", flexWrap: "wrap",
      }}>
        <div style={{
          width: 60, height: 60, borderRadius: 12,
          display: "grid", placeItems: "center",
          fontSize: 32, flexShrink: 0,
          background: "rgba(0,0,0,.2)",
        }}>💳</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 18, fontWeight: 500 }}>{cartao.nome}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.85)", marginTop: 4 }}>
            Vence dia {cartao.diaVencimento || cartao.vencimento || "—"}
            {cartao.final && ` · Final ${cartao.final}`}
            {` · ${txCartao.length} transações no mês`}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontSize: 10, color: "rgba(255,255,255,.7)",
            letterSpacing: ".15em", textTransform: "uppercase", marginBottom: 4,
          }}>Fatura {pctUso > 60 ? "· ⚠ ALERTA" : "atual"}</div>
          <div style={{ fontSize: 28, fontWeight: 300, fontVariantNumeric: "tabular-nums" }}>
            {hidden ? "•••" : fmt(fatura)}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="kg">
        <div className="k">
          <div className="kh"><div className="kl">Limite</div></div>
          <div className="kv">{hidden ? "•••" : fmt(limite)}</div>
          <div className="ku" style={{ color: pctUso > 60 ? T.red : T.faint }}>
            Disp: {hidden ? "•••" : fmt(disponivel)}
          </div>
        </div>
        <div className="k">
          <div className="kh"><div className="kl">Uso</div></div>
          <div className="kv">{pctUso.toFixed(0)}%</div>
          <div className="ku" style={{ color: pctUso > 60 ? T.red : pctUso > 40 ? T.yellow : T.green }}>
            {pctUso > 60 ? "Alto" : pctUso > 40 ? "Moderado" : "Saudável"}
          </div>
        </div>
        <div className="k">
          <div className="kh"><div className="kl">Vencimento</div></div>
          <div className="kv">{cartao.diaVencimento || cartao.vencimento || "—"}</div>
          <div className="ku">do mês</div>
        </div>
        <div className="k">
          <div className="kh"><div className="kl">Parcelas ativas</div></div>
          <div className="kv">{parcCartao.length}</div>
          <div className="ku">{hidden ? "•••" : fmt(totalParcMes)}/mês</div>
        </div>
      </div>

      {/* Parcelamentos */}
      {parcCartao.length > 0 && (
        <>
          <div className="st"><h2>Parcelamentos Ativos</h2><div className="mt">{parcCartao.length}</div></div>
          <div className="pn">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Compra</th>
                  <th>Início</th>
                  <th style={{ textAlign: "right" }}>Parcela</th>
                  <th style={{ textAlign: "right" }}>Valor/mês</th>
                  <th style={{ textAlign: "right" }}>Restante</th>
                </tr>
              </thead>
              <tbody>
                {parcCartao.map((p, i) => {
                  const totalParc = Number(p.totalParcelas || p.parcelas || 0);
                  const restantes = Number(p.parcelasRestantes || 0);
                  const pagas = totalParc - restantes;
                  const valor = Number(p.valorParcela || p.valor || 0);
                  return (
                    <tr key={p.id || i}>
                      <td>{p.descricao || p.nome || "—"}</td>
                      <td>{p.dataInicio || p.data || "—"}</td>
                      <td style={{ textAlign: "right" }} className="num">{pagas + 1}/{totalParc}</td>
                      <td style={{ textAlign: "right" }} className="num">{hidden ? "•••" : fmt(valor)}</td>
                      <td style={{ textAlign: "right" }} className="num">{hidden ? "•••" : fmt(valor * restantes)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Transações + Parcelas do mês */}
      <div className="st"><h2>Transações da Fatura</h2><div className="mt">{mesAtual} · {itensFatura.length} itens</div></div>
      <div className="pn">
        {itensFatura.length === 0 ? (
          <div className="empty-state">
            <div className="ic">💳</div>
            Nenhuma transação ou parcela neste cartão no mês atual.
          </div>
        ) : (
          <>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th style={{ textAlign: "right" }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {itensFatura.map((t, i) => (
                  <tr key={t.id || i} style={{ background: t.parcela ? `${T.gold}08` : "transparent" }}>
                    <td>{(t.data || "").slice(8, 10)}/{(t.data || "").slice(5, 7)}</td>
                    <td>
                      {t.parcela && (
                        <span style={{
                          fontSize: 9, padding: "1px 5px",
                          background: "#FAEEDA", color: "#633806",
                          borderRadius: 3, marginRight: 5, fontWeight: 600,
                          letterSpacing: ".05em",
                        }}>PARCELA</span>
                      )}
                      {t.descricao}{t.fixa && " 🔁"}
                    </td>
                    <td><span className="bg-c bgi">{t.categoria}</span></td>
                    <td style={{ textAlign: "right" }} className="num neg">
                      {hidden ? "•••" : `− ${fmt(Math.abs(Number(t.valor || 0)))}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {parcCartao.length > 0 && (
              <div style={{ marginTop: 10, textAlign: "center" }}>
                <button
                  onClick={() => setVerTodasParcelas(v => !v)}
                  style={{
                    padding: "6px 14px", fontSize: 11, fontWeight: 600,
                    letterSpacing: ".05em", textTransform: "uppercase",
                    background: T.card, border: `1px solid ${T.border}`,
                    borderRadius: 5, cursor: "pointer", color: T.muted,
                  }}>
                  {verTodasParcelas ? "Ocultar parcelas" : `Ver todas as parcelas em curso (${parcCartao.length})`}
                </button>
              </div>
            )}

            {verTodasParcelas && parcCartao.length > 0 && (
              <div style={{
                marginTop: 10, background: T.bgSoft, padding: 12, borderRadius: 8,
                border: `1px solid ${T.border}`,
              }}>
                <div style={{
                  fontSize: 10, letterSpacing: ".15em",
                  color: T.muted, textTransform: "uppercase",
                  fontWeight: 600, marginBottom: 8,
                }}>
                  Todas as parcelas em curso deste cartão
                </div>
                {parcCartao.map((p, i) => {
                  const totalParc = Number(p.totalParcelas || p.parcelas || 0);
                  const pagasArr = (p.parcelasPagas || []).length;
                  const pagas = p.parcelasRestantes != null
                    ? totalParc - Number(p.parcelasRestantes || 0)
                    : pagasArr;
                  const restantes = totalParc - pagas;
                  const valor = Number(p.valorParcela || ((p.valorTotal || 0) / (totalParc || 1)) || 0);
                  const pct = totalParc > 0 ? (pagas / totalParc) * 100 : 0;
                  return (
                    <div key={p.id || i} style={{
                      background: T.card, padding: 10, borderRadius: 6, marginBottom: 5,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{p.descricao || p.nome || "—"}</span>
                        <span>{pagas}/{totalParc} · {fmt(valor)}/mês</span>
                      </div>
                      <div style={{ background: T.border, height: 3, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ background: T.gold, width: `${pct}%`, height: "100%" }} />
                      </div>
                      <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4 }}>
                        Restam {fmt(valor * restantes)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
