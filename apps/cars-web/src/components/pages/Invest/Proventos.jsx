import React, { useMemo } from "react";
import { fmt } from "../../../lib/format.js";
import { calendarioProventos } from "../../../lib/invest-metrics.js";

export default function Proventos({ ativos = [], hidden }) {
  const proventos = useMemo(() => calendarioProventos(ativos), [ativos]);

  // Agrupar por mês
  const porMes = useMemo(() => {
    const map = {};
    proventos.forEach(p => {
      const k = p.data.slice(0, 7);
      (map[k] ||= []).push(p);
    });
    return Object.entries(map).sort();
  }, [proventos]);

  const hoje = new Date();
  const mesAtual = hoje.toISOString().slice(0, 7);
  const proxMes = new Date(hoje); proxMes.setMonth(proxMes.getMonth() + 1);
  const proxMesK = proxMes.toISOString().slice(0, 7);

  const totalMes = (porMes.find(([k]) => k === mesAtual)?.[1] || []).reduce((s, p) => s + p.total, 0);
  const totalProxMes = (porMes.find(([k]) => k === proxMesK)?.[1] || []).reduce((s, p) => s + p.total, 0);
  const totalTrim = proventos.reduce((s, p) => s + p.total, 0);

  const valorCarteira = ativos.reduce((s, a) => s + Number(a.qtd || 0) * Number(a.preco || 0), 0);
  const dyMedio = valorCarteira > 0 ? (totalTrim * 4 / valorCarteira) * 100 : 0;

  const nomeMes = (k) => {
    const [y, m] = k.split("-");
    const meses = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    return `${meses[parseInt(m) - 1]} ${y}`;
  };

  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="eb">Investimentos · Proventos</div>
      <h1 className="h1">Calendário de <em>proventos.</em></h1>
      <p className="hs">Dividendos, JCP e rendimentos a receber pelos próximos 3 meses.</p>

      <div className="kg">
        <div className="k">
          <div className="kh"><div className="kl">A receber (este mês)</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
          </div>
          <div className="kv">{hidden ? "•••" : fmt(totalMes)}</div>
          <div className="ku">{(porMes.find(([k]) => k === mesAtual)?.[1] || []).length} pagamento(s)</div>
        </div>
        <div className="k">
          <div className="kh"><div className="kl">A receber (próximo)</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/></svg>
          </div>
          <div className="kv">{hidden ? "•••" : fmt(totalProxMes)}</div>
          <div className="ku">{(porMes.find(([k]) => k === proxMesK)?.[1] || []).length} pagamento(s)</div>
        </div>
        <div className="k">
          <div className="kh"><div className="kl">Total (3 meses)</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="4 12 9 17 20 6"/></svg>
          </div>
          <div className="kv">{hidden ? "•••" : fmt(totalTrim)}</div>
          <div className="ku">{proventos.length} pagamentos</div>
        </div>
        <div className="k">
          <div className="kh"><div className="kl">DY anualizado (est.)</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M2 12h20"/></svg>
          </div>
          <div className="kv">{dyMedio.toFixed(1)}%</div>
          <div className="ku">Estimativa</div>
        </div>
      </div>

      {porMes.length === 0 ? (
        <div className="pn">
          <div className="empty-state">
            <div className="ic">💵</div>
            Adicione ações e FIIs para ver o calendário de proventos.
          </div>
        </div>
      ) : porMes.map(([mes, lista]) => (
        <div key={mes} style={{ marginBottom: 18 }}>
          <div className="eb">{nomeMes(mes)} · {lista.length} pagamento(s)</div>
          <div className="pn">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Ticker</th>
                  <th>Tipo</th>
                  <th style={{ textAlign: "right" }}>Por cota</th>
                  <th style={{ textAlign: "right" }}>Qtd</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p, i) => (
                  <tr key={i}>
                    <td>{p.data.slice(8, 10)}/{p.data.slice(5, 7)}</td>
                    <td><strong>{p.ticker}</strong></td>
                    <td>
                      <span className={`bg-c ${p.tipo === "Rendimento" ? "bgd" : p.tipo === "Dividendo" ? "bgi" : "bgr"}`}>
                        {p.tipo}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }} className="num">{fmt(p.valorPorCota)}</td>
                    <td style={{ textAlign: "right" }} className="num">{p.qtd}</td>
                    <td style={{ textAlign: "right" }} className="num pos">
                      {hidden ? "•••" : fmt(p.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
