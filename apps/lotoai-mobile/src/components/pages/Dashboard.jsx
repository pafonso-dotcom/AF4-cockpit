import React, { useMemo, useState } from "react";
import { Flame, Snowflake, Hash, TrendingUp, Calculator, Info } from "lucide-react";
import Ball from "../ui/Ball.jsx";
import { frequencias, atrasos, quentes, frias } from "../../lib/stats.js";
import { analisarJogo } from "../../lib/lotofacil.js";
import { JOGOS } from "../../lib/jogos.js";
import { relatorioMatematico, pFechamentoCompletoPeloMenos, pPeloMenosUmPremio, pAcertosPeloMenos } from "../../lib/probabilidade.js";

export default function Dashboard({ historico }) {
  const ultimo = historico[historico.length - 1];

  const stats = useMemo(() => {
    if (!historico.length) return null;
    const sorteios = historico.map(c => c.dezenas);
    return {
      freq: frequencias(sorteios),
      atr: atrasos(sorteios),
      quentes: quentes(sorteios, 8),
      frias: frias(sorteios, 8),
    };
  }, [historico]);

  const analise = ultimo ? analisarJogo(ultimo.dezenas) : null;

  return (
    <div className="px-4 pt-4 pb-28 space-y-4">
      {ultimo && (
        <section className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/40">Último sorteio</div>
              <div className="text-lg font-bold">
                Concurso #{ultimo.numero}
                <span className="text-white/50 text-sm font-normal ml-2">{ultimo.data}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {ultimo.dezenas.map(n => <Ball key={n} n={n} highlight />)}
          </div>
          {analise && (
            <div className="grid grid-cols-4 gap-2 text-center">
              <Mini label="Pares" value={analise.pares} />
              <Mini label="Primos" value={analise.primos} />
              <Mini label="Moldura" value={analise.moldura} />
              <Mini label="Soma" value={analise.soma} />
            </div>
          )}
        </section>
      )}

      {stats && (
        <>
          <section className="card">
            <Header icon={<Flame size={16} className="text-orange-400" />} title="Dezenas quentes" hint="Mais sorteadas" />
            <div className="flex flex-wrap gap-2">
              {stats.quentes.map(n => <Ball key={n} n={n} />)}
            </div>
          </section>

          <section className="card">
            <Header icon={<Snowflake size={16} className="text-sky-300" />} title="Dezenas frias" hint="Menos sorteadas" />
            <div className="flex flex-wrap gap-2">
              {stats.frias.map(n => <Ball key={n} n={n} />)}
            </div>
          </section>

          <section className="card">
            <Header icon={<TrendingUp size={16} className="text-gold" />} title="Mapa de frequência" hint={`${historico.length} concursos`} />
            <FrequencyGrid freq={stats.freq} atr={stats.atr} />
          </section>

          <PainelProbabilidade />
        </>
      )}

      {!historico.length && (
        <section className="card text-center py-10">
          <Hash className="mx-auto text-white/30 mb-2" />
          <p className="text-white/60 text-sm">Sem histórico carregado ainda.</p>
        </section>
      )}
    </div>
  );
}

function Header({ icon, title, hint }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-semibold">{title}</h3>
      </div>
      {hint && <span className="chip">{hint}</span>}
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="bg-ink/60 border border-line rounded-xl py-2">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="font-bold text-gold">{value}</div>
    </div>
  );
}

function PainelProbabilidade() {
  const [jogosPorConcurso, setJogosPorConcurso] = useState(5);
  const [orcamentoMensal, setOrcamentoMensal] = useState(500);

  const rel = useMemo(() => relatorioMatematico({
    game: JOGOS.lotofacil,
    jogosPorConcurso,
    orcamentoMensal,
    concursosPorMes: 13,
  }), [jogosPorConcurso, orcamentoMensal]);

  const tabelaFech = useMemo(() => {
    const out = [];
    for (const K of [15, 16, 17, 18, 19, 20]) {
      out.push({
        K,
        p11: pFechamentoCompletoPeloMenos(K, 11),
        p12: pFechamentoCompletoPeloMenos(K, 12),
        p13: pFechamentoCompletoPeloMenos(K, 13),
      });
    }
    return out;
  }, []);

  return (
    <section className="card">
      <Header
        icon={<Calculator size={16} className="text-emerald-400" />}
        title="Probabilidade & estratégia"
        hint="matemática exata"
      />
      <div className="space-y-3">
        <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-2 flex gap-2 items-start text-[11px]">
          <Info size={12} className="text-amber-300 flex-none mt-0.5" />
          <div className="text-amber-200">
            <b>Honestidade matemática</b>: a Lotofácil tem edge de <b>-62.3%</b> (a Caixa
            fica com 62% das apostas em média). Nenhum algoritmo muda isso.
            Esses números mostram a <b>melhor decisão racional</b> dado o orçamento.
          </div>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wider text-white/40">
            Jogos por concurso: <b className="text-gold">{jogosPorConcurso}</b>
          </label>
          <input
            type="range" min="1" max="30" value={jogosPorConcurso}
            onChange={e => setJogosPorConcurso(+e.target.value)}
            className="w-full mt-1 accent-emerald-400"
          />
        </div>
        <div>
          <label className="text-[11px] uppercase tracking-wider text-white/40">
            Orçamento mensal: <b className="text-gold">R$ {orcamentoMensal}</b>
          </label>
          <input
            type="range" min="0" max="3000" step="50" value={orcamentoMensal}
            onChange={e => setOrcamentoMensal(+e.target.value)}
            className="w-full mt-1 accent-emerald-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <Mini label="P(prêmio) por concurso" value={rel.pPremioPorConcursoStr} />
          <Mini label="Custo por concurso" value={`R$ ${rel.custoPorConcurso.toFixed(2)}`} />
          <Mini label="Concursos até prêmio" value={`~${rel.concursosAteOPrimeiroPremio}`} />
          <Mini label="Custo até prêmio" value={`R$ ${rel.custoAteOPrimeiroPremio.toFixed(0)}`} />
        </div>

        <div className={`rounded-lg p-2 text-[11px] ${
          rel.orcamento.dentroDoLimite
            ? "bg-emerald-900/20 border border-emerald-700/40 text-emerald-200"
            : "bg-red-900/20 border border-red-700/40 text-red-200"
        }`}>
          Gasto anual estimado: <b>R$ {rel.orcamento.gastoAnualEstimado.toLocaleString("pt-BR")}</b>
          {" · "}orçamento anual: <b>R$ {rel.orcamento.anual.toLocaleString("pt-BR")}</b>
          {!rel.orcamento.dentroDoLimite && " · ESTOURA o orçamento"}
        </div>

        <details className="text-[11px]">
          <summary className="cursor-pointer text-white/70 hover:text-white">
            P(≥k acertos) por fechamento — matemática exata
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-center">
              <thead className="text-white/40">
                <tr><th className="py-1">K</th><th>P(≥11)</th><th>P(≥12)</th><th>P(≥13)</th></tr>
              </thead>
              <tbody className="text-white">
                {tabelaFech.map(r => (
                  <tr key={r.K} className="border-t border-line">
                    <td className="py-1 font-bold text-gold">{r.K}</td>
                    <td>{(r.p11 * 100).toFixed(2)}%</td>
                    <td>{(r.p12 * 100).toFixed(2)}%</td>
                    <td>{(r.p13 * 100).toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <div className="text-[10px] text-white/40 leading-relaxed">
          Kelly criterion: <b className="text-white/70">{rel.kelly.recomendacao}</b>.
          Modelo hipergeométrico C({JOGOS.lotofacil.totalNumeros},{JOGOS.lotofacil.numerosPorJogo}) = {(3268760).toLocaleString("pt-BR")} sorteios possíveis.
        </div>
      </div>
    </section>
  );
}

function FrequencyGrid({ freq, atr }) {
  const max = Math.max(...Object.values(freq), 1);
  const nums = Object.keys(freq).map(Number).sort((a, b) => a - b);
  return (
    <div className="grid grid-cols-5 gap-2">
      {nums.map(n => {
        const intensity = freq[n] / max;
        return (
          <div key={n} className="rounded-lg border border-line bg-ink/40 p-2 text-center">
            <div
              className="text-sm font-bold"
              style={{ color: `rgba(245, 196, 81, ${0.4 + intensity * 0.6})` }}
            >
              {String(n).padStart(2, "0")}
            </div>
            <div className="text-[10px] text-white/50">{freq[n]}× · {atr[n]}atr</div>
          </div>
        );
      })}
    </div>
  );
}
