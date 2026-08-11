import React, { useMemo, useState } from "react";
import { Flame, Snowflake, Hash, TrendingUp, Calculator, Info, Sparkles, RefreshCw, Save } from "lucide-react";
import Ball from "../ui/Ball.jsx";
import { frequencias, atrasos, quentes, frias } from "../../lib/stats.js";
import { analisarJogo } from "../../lib/lotofacil.js";
import { JOGOS } from "../../lib/jogos.js";
import { relatorioMatematico, pFechamentoCompletoPeloMenos, pPeloMenosUmPremio, pAcertosPeloMenos } from "../../lib/probabilidade.js";
import { gerarJogos } from "../../lib/generator.js";
import { salvarJogos } from "../../lib/supabase.js";
import { analisarCiclos, distPorLinha, distPorColuna, LINHAS, COLUNAS } from "../../lib/analiseAvancada.js";

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
      <JogoDoDia historico={historico} />

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

          <PainelCiclos historico={historico} ultimo={ultimo} />

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

/* ============================================================
   PAINEL CICLOS & GRUPOS · análise avançada do volante
   Mostra:
   - Ciclo atual (dezenas faltando pra fechar o ciclo)
   - Distribuição do último sorteio por linha e coluna
   ============================================================ */
function PainelCiclos({ historico, ultimo }) {
  const ciclos = useMemo(() => {
    if (!historico?.length) return null;
    return analisarCiclos(historico.map(c => c.dezenas));
  }, [historico]);

  const linhaDist = useMemo(() => ultimo ? distPorLinha(ultimo.dezenas) : null, [ultimo]);
  const colDist = useMemo(() => ultimo ? distPorColuna(ultimo.dezenas) : null, [ultimo]);

  if (!ciclos) return null;
  const pct = ciclos.tamanhoMedio
    ? Math.min(100, (ciclos.concursosNoCiclo / ciclos.tamanhoMedio) * 100)
    : 0;

  return (
    <section className="card">
      <div className="flex items-center gap-2 mb-3">
        <RefreshCw size={16} className="text-emerald-400" />
        <h3 className="font-semibold">Ciclos & Grupos</h3>
        <span className="text-[10px] text-white/40 ml-auto">análise avançada</span>
      </div>

      {/* Ciclo atual */}
      <div className="bg-ink/40 border border-line rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-white/60">
            Ciclo atual: <b className="text-white">#{ciclos.cicloAtual}</b> · {ciclos.concursosNoCiclo} concurso{ciclos.concursosNoCiclo === 1 ? "" : "s"}
          </span>
          {ciclos.tamanhoMedio && (
            <span className="text-white/40">média: {ciclos.tamanhoMedio.toFixed(1)}</span>
          )}
        </div>
        {ciclos.tamanhoMedio && (
          <div className="h-1.5 bg-ink/60 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-gold"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-gold">{ciclos.dezenasFaltando.length}</span>
          <span className="text-[11px] text-white/50">dezena{ciclos.dezenasFaltando.length === 1 ? "" : "s"} faltando</span>
        </div>
        {ciclos.dezenasFaltando.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {ciclos.dezenasFaltando.map(n => (
              <span key={n} className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {String(n).padStart(2, "0")}
              </span>
            ))}
          </div>
        )}
        {ciclos.dezenasFaltando.length === 0 && (
          <div className="text-[11px] text-emerald-300 mt-1">
            ✓ Ciclo fechou no último concurso · novo ciclo começa agora
          </div>
        )}
      </div>

      {/* Distribuição do último por linhas */}
      {linhaDist && (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
            Último sorteio · por linha (3 é o esperado)
          </div>
          <div className="grid grid-cols-5 gap-1">
            {linhaDist.map((n, i) => (
              <MiniBar key={i} label={`L${i+1}`} value={n} max={5} alvo={3} />
            ))}
          </div>
        </div>
      )}

      {/* Distribuição do último por colunas */}
      {colDist && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
            Último sorteio · por coluna
          </div>
          <div className="grid grid-cols-5 gap-1">
            {colDist.map((n, i) => (
              <MiniBar key={i} label={`C${i+1}`} value={n} max={5} alvo={3} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MiniBar({ label, value, max, alvo }) {
  const isAlvo = value === alvo;
  return (
    <div className="bg-ink/60 border border-line rounded-lg p-1.5 text-center">
      <div className="text-[9px] text-white/40">{label}</div>
      <div className={`text-sm font-bold ${isAlvo ? "text-emerald-300" : "text-white"}`}>{value}</div>
    </div>
  );
}

/* ============================================================
   JOGO DO DIA · gerador em 1 clique
   Usa Combo IA (mix de estratégias) por padrão. 1 tap = 1 jogo
   com análise instantânea (primos, pares, soma, faixa).
   ============================================================ */
function JogoDoDia({ historico }) {
  const [jogo, setJogo] = useState(() => gerar(historico));
  const [savedMsg, setSavedMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  function gerarNovo() {
    setJogo(gerar(historico));
    setSavedMsg("");
  }

  async function salvar() {
    if (!jogo) return;
    setSalvando(true);
    const r = await salvarJogos([jogo], { estrategia: "jogo-do-dia-combo" });
    setSalvando(false);
    setSavedMsg(r.remote ? "Salvo no Supabase" : "Salvo localmente");
    setTimeout(() => setSavedMsg(""), 2500);
  }

  if (!jogo) return null;
  const analise = analisarJogo(jogo);
  const primos = jogo.filter(n => [2,3,5,7,11,13,17,19,23].includes(n));
  const faixaTipica = analise.pares >= 6 && analise.pares <= 9 &&
                      analise.soma >= 170 && analise.soma <= 220 &&
                      analise.primos >= 4 && analise.primos <= 7;

  return (
    <section className="card bg-gradient-to-br from-panel to-panel/50 border-gold/30">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gold font-bold">
            <Sparkles size={13} /> Jogo do dia · IA
          </div>
          <div className="text-[11px] text-white/50 mt-0.5">
            Combo de 5 estratégias · 1 tap
          </div>
        </div>
        {faixaTipica && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            ✓ FAIXA TÍPICA
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {jogo.map(n => <Ball key={n} n={n} highlight markPrime />)}
      </div>

      <div className="grid grid-cols-4 gap-1.5 mb-3">
        <MiniStat label="Primos" value={`${primos.length}/9`} tone="emerald" />
        <MiniStat label="Pares" value={analise.pares} />
        <MiniStat label="Soma" value={analise.soma} />
        <MiniStat label="Moldura" value={`${analise.moldura}/16`} />
      </div>

      {savedMsg && <div className="text-xs text-green-400 mb-2">{savedMsg}</div>}

      <div className="flex gap-2">
        <button
          onClick={gerarNovo}
          className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm"
        >
          <RefreshCw size={14} /> Gerar outro
        </button>
        <button
          onClick={salvar}
          disabled={salvando}
          className="btn-gold flex-1 flex items-center justify-center gap-1.5 text-sm"
        >
          <Save size={14} /> {salvando ? "..." : "Salvar"}
        </button>
      </div>

      <div className="text-[10px] text-white/40 mt-2 text-center">
        Primos: <span className="text-emerald-300">{primos.map(n => String(n).padStart(2,"0")).join(", ") || "—"}</span>
      </div>
    </section>
  );
}

function gerar(historico) {
  try {
    const [j] = gerarJogos({
      quantidade: 1,
      estrategia: "combo",
      historico: historico.map(c => c.dezenas),
    });
    return j;
  } catch { return null; }
}

function MiniStat({ label, value, tone = "gold" }) {
  const color =
    tone === "emerald" ? "text-emerald-300"
    : tone === "gold" ? "text-gold"
    : "text-white";
  return (
    <div className="bg-ink/60 border border-line rounded-lg py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={`text-xs font-bold ${color}`}>{value}</div>
    </div>
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
