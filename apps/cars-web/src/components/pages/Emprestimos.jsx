import React, { useMemo } from "react";
import { HandCoins, TrendingUp, Wallet, Clock, ArrowRight, CheckCircle2 } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, fmtN } from "../../lib/format.js";
import PageHeader from "../ui/PageHeader.jsx";
import { StatTile } from "../ui/widget.jsx";
import { resumoEmprestimos } from "../../lib/emprestimos.js";

const fmtData = (iso) => {
  if (!iso) return "—";
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split("-");
  return d ? `${d}/${m}/${y}` : s;
};

/**
 * Controle de empréstimos — visão dedicada do que você emprestou: principal,
 * quanto já rendeu de juros (com as datas) e o que ainda falta receber.
 * Leitura; o cadastro/baixa continua em "A Receber & Dívidas".
 */
export default function Emprestimos({ devedores = [], hidden, onTabChange }) {
  const r = useMemo(() => resumoEmprestimos(devedores), [devedores]);

  return (
    <div className="fade-up py-8 px-6" style={{ maxWidth: 1100, margin: "0 auto" }}>
      <PageHeader
        eyebrow="Finanças · Recebíveis"
        title={<>Empréstimos<em> em controle.</em></>}
        sub="Quanto você emprestou, quanto já rendeu de juros e o que ainda falta — com as datas de cada recebimento."
      />

      {/* Totais */}
      <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 8, marginBottom: 24 }}>
        <StatTile label="Total emprestado" valor={r.totalEmprestado} hidden={hidden} cor={T.gold} icon={HandCoins}
          sub={`${r.emprestimos.length} ${r.emprestimos.length === 1 ? "empréstimo" : "empréstimos"} · ${r.abertos} em aberto`} />
        <StatTile label="Juros recebidos" valor={r.totalJurosRecebido} hidden={hidden} cor={T.green} icon={TrendingUp}
          sub={r.totalEmprestado > 0 ? `${fmtN(r.rendimentoMedioPct, 1)}% do principal` : undefined} />
        <StatTile label="Juros a receber" valor={r.totalJurosAReceber} hidden={hidden} cor={T.blue || "#60a5fa"} icon={Clock}
          sub="ainda previstos" />
        <StatTile label="Principal em aberto" valor={r.totalPrincipalAberto} hidden={hidden} cor={T.red} icon={Wallet}
          sub="a devolver" />
      </div>

      {r.emprestimos.length === 0 ? (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 32, textAlign: "center" }}>
          <HandCoins size={26} style={{ color: T.muted, marginBottom: 8 }} />
          <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.6 }}>
            Nenhum empréstimo registrado ainda.<br />
            Cadastre um em <b style={{ color: T.ink }}>A Receber &amp; Dívidas</b> (marcando "empréstimo com juros").
          </div>
          {onTabChange && (
            <button onClick={() => onTabChange("areceber")} className="btn-gold" style={{ marginTop: 14, padding: "8px 16px", fontSize: 12.5 }}>
              Ir para A Receber &amp; Dívidas
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {r.emprestimos.map((e) => (
            <div key={e.id} style={{
              background: T.card, border: `1px solid ${e.quitado ? T.border : T.gold + "55"}`,
              borderRadius: 16, padding: 16, opacity: e.quitado ? 0.82 : 1,
            }}>
              {/* Cabeçalho */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 700, color: T.ink }}>{e.nome}</span>
                    {e.quitado ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: `${T.green}1e`, color: T.green, fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 100 }}>
                        <CheckCircle2 size={10} /> Quitado
                      </span>
                    ) : (
                      <span style={{ background: `${T.gold}1e`, color: T.gold, fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 100 }}>
                        Em aberto
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>
                    Emprestado em <b style={{ color: T.ink }}>{fmtData(e.dataEmprestimo)}</b>
                    {e.jurosMensal > 0 && <> · juros {hidden ? "•••" : fmt(e.jurosMensal)}/mês × {e.meses} {e.meses === 1 ? "mês" : "meses"}</>}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 600 }}>Principal</div>
                  <div className="num" style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 700, color: T.ink }}>{hidden ? "•••••" : fmt(e.principal)}</div>
                </div>
              </div>

              {/* Números de juros */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: e.jurosLancamentos.length ? 12 : 0 }}>
                <Mini label="Juros recebidos" valor={e.jurosRecebido} cor={T.green} hidden={hidden}
                  sub={e.principal > 0 ? `${fmtN(e.rendimentoPct, 1)}% do principal` : null} />
                <Mini label="Juros a receber" valor={e.jurosAReceber} cor={T.blue || "#60a5fa"} hidden={hidden}
                  sub={e.jurosPrevisto > 0 ? `de ${hidden ? "•••" : fmt(e.jurosPrevisto)} previstos` : null} />
                <Mini label="Principal em aberto" valor={e.principalAberto} cor={e.principalAberto > 0 ? T.red : T.muted} hidden={hidden}
                  sub={e.quitado ? "devolvido" : "a devolver"} />
              </div>

              {/* Linha do tempo dos juros recebidos */}
              {e.jurosLancamentos.length > 0 && (
                <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                  <div style={{ fontSize: 9.5, color: T.faint, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>
                    Juros recebidos ({e.jurosLancamentos.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {e.jurosLancamentos.map((j, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                        <span style={{ color: T.muted }}>
                          {fmtData(j.data)}{j.mes ? ` · ref. ${j.mes}` : ""}
                        </span>
                        <span className="num" style={{ color: T.green, fontWeight: 600 }}>+{hidden ? "•••" : fmt(j.valor)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {r.emprestimos.length > 0 && onTabChange && (
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button onClick={() => onTabChange("areceber")}
            style={{ background: "transparent", border: "none", color: T.gold, fontSize: 12.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
            Registrar recebimento ou novo empréstimo em A Receber &amp; Dívidas <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

function Mini({ label, valor, sub, cor, hidden }) {
  return (
    <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 12, padding: "9px 11px" }}>
      <div style={{ fontSize: 9.5, color: T.muted, letterSpacing: ".04em", textTransform: "uppercase", fontWeight: 600 }}>{label}</div>
      <div className="num" style={{ fontSize: 15.5, fontWeight: 700, color: cor || T.ink, marginTop: 2 }}>{hidden ? "•••" : fmt(valor)}</div>
      {sub && <div style={{ fontSize: 9.5, color: T.faint, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}
