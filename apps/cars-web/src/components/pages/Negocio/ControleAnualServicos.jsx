import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import { MESES_CURTO as MES_NOMES } from "../../../lib/meses.js";

/**
 * Controle Anual de Recebíveis e Pagamentos do Negócio (serviços).
 * Espelha o "Controle Anual" do Financeiro, mas no contexto de prestação de
 * serviços: por mês mostra o que há A RECEBER (vendas/faturas já registradas +
 * contratos ativos ainda não faturados) e o que há A PAGAR (repasse aos
 * colaboradores + custo do serviço). Projeção, não toca em dados.
 */
export default function ControleAnualServicos({ vendas = [], contratos = [], instaladores = [], hidden }) {
  const hoje = new Date();
  const anoCorrente = hoje.getFullYear();
  const mesCorrenteIdx = hoje.getMonth();

  const [ano, setAno] = useState(anoCorrente);
  const [mesExpandido, setMesExpandido] = useState(null);

  const linhas = useMemo(
    () => calcularAnual(ano, vendas, contratos, anoCorrente, mesCorrenteIdx),
    [ano, vendas, contratos, anoCorrente, mesCorrenteIdx]
  );

  const totais = useMemo(() => linhas.reduce((acc, l) => ({
    aReceber: acc.aReceber + l.aReceber,
    aPagar: acc.aPagar + l.aPagar,
    liquido: acc.liquido + l.liquido,
  }), { aReceber: 0, aPagar: 0, liquido: 0 }), [linhas]);

  const nomeInst = (id) => (instaladores || []).find(i => i.id === id)?.nome || "colaborador";
  const m = (v) => (hidden ? "•••" : fmt(v));

  return (
    <div>
      {/* Cabeçalho com seletor de ano */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 11.5 }}>
          <span style={{ color: T.muted }}>
            A receber no ano: <strong style={{ color: T.gold }}>{m(totais.aReceber)}</strong>
          </span>
          <span style={{ color: T.muted }}>
            A pagar no ano: <strong style={{ color: T.red }}>{m(totais.aPagar)}</strong>
          </span>
          <span style={{ color: T.muted }}>
            Líquido: <strong style={{ color: totais.liquido >= 0 ? T.green : T.red }}>{m(totais.liquido)}</strong>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => setAno(a => a - 1)} style={btnAno()}>‹</button>
          <span className="num" style={{ fontSize: 13, fontWeight: 600, color: T.ink, minWidth: 44, textAlign: "center" }}>{ano}</span>
          <button onClick={() => setAno(a => a + 1)} style={btnAno()}>›</button>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: T.bgSoft }}>
              <th style={thSty()}></th>
              <th style={thSty("left")}>Mês</th>
              <th style={thSty("right")}>A Receber</th>
              <th style={thSty("right")}>A Pagar</th>
              <th style={thSty("right")}>Líquido</th>
              <th style={thSty("center")}>Status</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(l => {
              const aberto = mesExpandido === l.m;
              const isCorrente = ano === anoCorrente && l.m === mesCorrenteIdx;
              const temItens = l.detReceber.length > 0 || l.detPagar.length > 0;
              return (
                <React.Fragment key={l.m}>
                  <tr onClick={() => temItens && setMesExpandido(aberto ? null : l.m)}
                      style={{
                        background: isCorrente ? `${T.gold}11` : "transparent",
                        borderBottom: `1px solid ${T.border}`,
                        cursor: temItens ? "pointer" : "default",
                      }}>
                    <td style={{ ...tdSty(), width: 26, color: T.gold }}>
                      {temItens && (aberto ? <ChevronDown size={13} /> : <ChevronRight size={13} />)}
                    </td>
                    <td style={{ ...tdSty(), fontWeight: isCorrente ? 700 : 500, color: T.ink }}>
                      {MES_NOMES[l.m]}
                    </td>
                    <td className="num" style={{ ...tdSty("right"), color: l.aReceber > 0 ? T.gold : T.faint }}>{m(l.aReceber)}</td>
                    <td className="num" style={{ ...tdSty("right"), color: l.aPagar > 0 ? T.red : T.faint }}>{m(l.aPagar)}</td>
                    <td className="num" style={{ ...tdSty("right"), fontWeight: 600, color: l.liquido > 0 ? T.green : l.liquido < 0 ? T.red : T.faint }}>{m(l.liquido)}</td>
                    <td style={{ ...tdSty("center") }}>
                      <StatusBadge status={l.status} />
                    </td>
                  </tr>
                  {aberto && (
                    <tr style={{ background: T.bgSoft }}>
                      <td colSpan={6} style={{ padding: "10px 14px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
                          <BlocoDetalhe titulo="A Receber" cor={T.gold} itens={l.detReceber} hidden={hidden} nomeInst={nomeInst} />
                          <BlocoDetalhe titulo="A Pagar" cor={T.red} itens={l.detPagar} hidden={hidden} nomeInst={nomeInst} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: `${T.gold}14`, borderTop: `2px solid ${T.gold}55` }}>
              <td style={tdSty()}></td>
              <td style={{ ...tdSty(), fontWeight: 700, color: T.ink, textTransform: "uppercase", fontSize: 10.5, letterSpacing: ".08em" }}>Total {ano}</td>
              <td className="num" style={{ ...tdSty("right"), fontWeight: 700, color: T.gold }}>{m(totais.aReceber)}</td>
              <td className="num" style={{ ...tdSty("right"), fontWeight: 700, color: T.red }}>{m(totais.aPagar)}</td>
              <td className="num" style={{ ...tdSty("right"), fontWeight: 700, color: totais.liquido >= 0 ? T.green : T.red }}>{m(totais.liquido)}</td>
              <td style={tdSty()}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ marginTop: 10, fontSize: 10.5, color: T.faint, fontStyle: "italic", lineHeight: 1.5 }}>
        A Receber = vendas/faturas já registradas no mês + contratos ativos ainda não faturados (previsto).
        A Pagar = repasse aos colaboradores + custo do serviço. Itens previstos aparecem marcados como “previsto”.
      </div>
    </div>
  );
}

/* ---------- Cálculo ---------- */
function calcularAnual(ano, vendas, contratos, anoCorrente, mesCorrenteIdx) {
  const linhas = [];
  for (let mi = 0; mi < 12; mi++) {
    const mesISO = `${ano}-${String(mi + 1).padStart(2, "0")}`;
    const detReceber = [];
    const detPagar = [];

    // 1) Realizado — vendas/faturas já registradas com data nesse mês.
    (vendas || []).forEach(v => {
      if (!(v.data || "").startsWith(mesISO)) return;
      const valor = Number(v.valor || 0);
      const repasse = Number(v.valorInstalador || 0);
      const custo = Number(v.custo || 0);
      if (valor > 0) detReceber.push({ nome: v.nome || "Venda", valor, instaladorId: null, previsto: false });
      if (repasse > 0) detPagar.push({ nome: v.nome || "Repasse", valor: repasse, instaladorId: v.instaladorId || null, previsto: false, tipo: "repasse" });
      if (custo > 0) detPagar.push({ nome: `Custo · ${v.nome || "venda"}`, valor: custo, instaladorId: null, previsto: false, tipo: "custo" });
    });

    // 2) Previsto — contratos ativos que faturam nesse mês e ainda não foram faturados.
    (contratos || []).forEach(c => {
      if (c.ativo === false) return;
      const inicio = c.dataInicio ? new Date(c.dataInicio + "T00:00:00") : null;
      const mesAtual = new Date(ano, mi, 1);

      // Janela ativa do contrato (início + duração opcional).
      if (inicio) {
        const inicioMes = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
        if (mesAtual < inicioMes) return;
        if (c.duracaoMeses) {
          const fim = new Date(inicio.getFullYear(), inicio.getMonth() + Number(c.duracaoMeses), 1);
          if (mesAtual >= fim) return;
        }
      }

      // Este contrato fatura neste mês? Mensal: todo mês. Anual: mês de aniversário.
      const ehMesDeFatura = c.recorrencia === "anual"
        ? (inicio ? inicio.getMonth() === mi : mi === 0)
        : true;
      if (!ehMesDeFatura) return;

      // Já faturado nessa competência? Então já contou no realizado acima.
      const competencia = c.recorrencia === "anual" ? String(ano) : mesISO;
      const jaFaturado = (vendas || []).some(v => v.contratoId === c.id && v.faturaRef === competencia);
      if (jaFaturado) return;

      const valor = Number(c.valor || 0);
      const repasse = Number(c.valorInstalador || 0);
      const custo = Number(c.custo || 0);
      if (valor > 0) detReceber.push({ nome: c.nome || "Contrato", valor, instaladorId: null, previsto: true });
      if (repasse > 0) detPagar.push({ nome: c.nome || "Repasse", valor: repasse, instaladorId: c.instaladorId || null, previsto: true, tipo: "repasse" });
      if (custo > 0) detPagar.push({ nome: `Custo · ${c.nome || "contrato"}`, valor: custo, instaladorId: null, previsto: true, tipo: "custo" });
    });

    const aReceber = detReceber.reduce((s, d) => s + d.valor, 0);
    const aPagar = detPagar.reduce((s, d) => s + d.valor, 0);
    const liquido = aReceber - aPagar;

    let status = "previsto";
    if (ano < anoCorrente || (ano === anoCorrente && mi < mesCorrenteIdx)) status = "fechado";
    else if (ano === anoCorrente && mi === mesCorrenteIdx) status = "em-andamento";

    linhas.push({ m: mi, mesISO, aReceber, aPagar, liquido, status, detReceber, detPagar });
  }
  return linhas;
}

/* ---------- Subcomponentes ---------- */
function BlocoDetalhe({ titulo, cor, itens, hidden, nomeInst }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: cor, fontWeight: 700, marginBottom: 6 }}>
        {titulo}
      </div>
      {itens.length === 0 ? (
        <div style={{ fontSize: 11, color: T.faint, fontStyle: "italic" }}>—</div>
      ) : (
        <div style={{ display: "grid", gap: 4 }}>
          {itens.map((it, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11.5 }}>
              <span style={{ color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.tipo === "repasse" && it.instaladorId ? `🧑‍💻 ${nomeInst(it.instaladorId)}` : it.nome}
                {it.previsto && <span style={{ marginLeft: 5, fontSize: 8.5, padding: "1px 4px", borderRadius: 3, background: `${T.gold}22`, color: T.gold, letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 700 }}>previsto</span>}
              </span>
              <span className="num" style={{ color: cor, fontWeight: 500, flexShrink: 0 }}>{hidden ? "•••" : fmt(it.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    fechado: { l: "Fechado", c: T.muted, bg: T.border },
    "em-andamento": { l: "Em andamento", c: T.gold, bg: `${T.gold}22` },
    previsto: { l: "Previsto", c: T.blue || "#60a5fa", bg: `${T.blue || "#60a5fa"}22` },
  };
  const s = map[status] || map.previsto;
  return (
    <span style={{ fontSize: 8.5, padding: "2px 7px", borderRadius: 3, background: s.bg, color: s.c, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap" }}>
      {s.l}
    </span>
  );
}

/* ---------- Estilos ---------- */
const thSty = (align = "left") => ({
  padding: "8px 10px", textAlign: align,
  fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase",
  color: T.muted, fontWeight: 600, borderBottom: `1px solid ${T.border}`,
});
const tdSty = (align = "left") => ({ padding: "8px 10px", textAlign: align, verticalAlign: "middle" });
const btnAno = () => ({
  background: "transparent", border: `1px solid ${T.border}`, color: T.muted,
  width: 26, height: 26, borderRadius: 5, cursor: "pointer", fontSize: 14, lineHeight: 1,
});
