import React, { useMemo, useState, useEffect } from "react";
import { Flame, Snowflake, Hash, TrendingUp, Calculator, Info, Sparkles, RefreshCw, Save, Trophy, Zap, Check } from "lucide-react";
import Ball from "../ui/Ball.jsx";
import { frequencias, atrasos, quentes, frias } from "../../lib/stats.js";
import { analisarJogo } from "../../lib/lotofacil.js";
import { JOGOS } from "../../lib/jogos.js";
import { relatorioMatematico, pFechamentoCompletoPeloMenos, pPeloMenosUmPremio, pAcertosPeloMenos } from "../../lib/probabilidade.js";
import { gerarJogos } from "../../lib/generator.js";
import { salvarJogos, mergeConcursos } from "../../lib/supabase.js";
import { analisarCiclos, distPorLinha, distPorColuna, LINHAS, COLUNAS, topTrincas } from "../../lib/analiseAvancada.js";
import { loadTuning, recomputarTuningLocal, invalidarCacheTuning } from "../../lib/tuning.js";
import { calcularPlacar } from "../../lib/placar.js";
import { importarNovos } from "../../lib/import.js";
import { temVersaoNova, forcarAtualizacao } from "../../lib/versionCheck.js";

export default function Dashboard({ historico, onHistoricoUpdate }) {
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
    <div className="px-4 pt-4 pb-28 space-y-3">
      <JogoDoDia historico={historico} />

      <PainelPlacar historico={historico} onHistoricoUpdate={onHistoricoUpdate} />

      <PainelGuru historico={historico} />

      {ultimo && (
        <section className="card">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-wider text-white/40">
              Último · <span className="text-gold">#{ultimo.numero}</span>
              <span className="text-white/40 ml-1.5 normal-case tracking-normal">{ultimo.data}</span>
            </div>
            {analise && (
              <div className="text-[10px] text-white/50 flex gap-2">
                <span>{analise.pares}P</span>
                <span>{analise.primos}Pr</span>
                <span>{analise.moldura}M</span>
                <span className="text-gold">Σ{analise.soma}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ultimo.dezenas.map(n => <Ball key={n} n={n} size="sm" highlight />)}
          </div>
        </section>
      )}

      {stats && (
        <>
          <PainelAnalise historico={historico} ultimo={ultimo} stats={stats} />

          {/* Mais análise: colapsado por padrão */}
          <details className="card">
            <summary className="cursor-pointer flex items-center justify-between list-none">
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-gold" />
                <span className="font-semibold">Mais análise</span>
              </div>
              <span className="text-[10px] text-white/40">toque para abrir</span>
            </summary>
            <div className="mt-3 space-y-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
                  Mapa de frequência
                </div>
                <FrequencyGrid freq={stats.freq} atr={stats.atr} />
              </div>
              <PainelProbabilidade />
            </div>
          </details>
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
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Calculator size={16} className="text-emerald-400" />
        <h3 className="font-semibold">Probabilidade & estratégia</h3>
        <span className="chip ml-auto">matemática exata</span>
      </div>
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
    </div>
  );
}

/* ============================================================
   PAINEL PLACAR + ATUALIZAR SISTEMA
   Mostra resumo dos bilhetes salvos (auto-conferidos contra o
   histórico) + botão "Atualizar tudo" que:
     1. Busca concursos novos via worker/api/lotofacil/latest
     2. Recalcula o placar automaticamente
     3. Força reload do bundle (pega auto-deploy novo)
   ============================================================ */
/* ============================================================
   PAINEL ANÁLISE (consolidado)
   3 abas: Ciclo · Trincas · Quentes/Frias
   ============================================================ */
function PainelAnalise({ historico, ultimo, stats }) {
  const [tab, setTab] = useState("ciclo"); // ciclo | trincas | quentes

  const ciclos = useMemo(() => {
    if (!historico?.length) return null;
    return analisarCiclos(historico.map(c => c.dezenas));
  }, [historico]);

  const trincas = useMemo(() => {
    if (!historico?.length) return [];
    return topTrincas(historico.map(c => c.dezenas), 6, { minCount: 40 });
  }, [historico]);

  const linhaDist = useMemo(() => ultimo ? distPorLinha(ultimo.dezenas) : null, [ultimo]);
  const colDist  = useMemo(() => ultimo ? distPorColuna(ultimo.dezenas) : null, [ultimo]);

  const TABS = [
    { id: "ciclo",   label: "Ciclo",   icon: <RefreshCw size={12} /> },
    { id: "trincas", label: "Trincas", icon: <TrendingUp size={12} /> },
    { id: "quentes", label: "Quentes", icon: <Flame size={12} /> },
  ];

  return (
    <section className="card">
      <div className="flex gap-1 mb-3 -mx-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1 text-[11px] font-semibold py-1.5 rounded-md ${
              tab === t.id ? "bg-gold/15 text-gold" : "text-white/50"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "ciclo" && ciclos && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <div className="text-xs text-white/60">
              Ciclo <b className="text-white">#{ciclos.cicloAtual}</b> · {ciclos.concursosNoCiclo}c
              {ciclos.tamanhoMedio && <span className="text-white/40 ml-1">/ média {ciclos.tamanhoMedio.toFixed(1)}</span>}
            </div>
            <div className="text-lg font-bold text-gold">{ciclos.dezenasFaltando.length} <span className="text-[10px] text-white/50 font-normal">faltam</span></div>
          </div>
          {ciclos.tamanhoMedio && (
            <div className="h-1 bg-ink/60 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-gold"
                   style={{ width: `${Math.min(100, (ciclos.concursosNoCiclo / ciclos.tamanhoMedio) * 100)}%` }} />
            </div>
          )}
          {ciclos.dezenasFaltando.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {ciclos.dezenasFaltando.map(n => (
                <span key={n} className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {String(n).padStart(2, "0")}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-[11px] text-emerald-300">✓ Ciclo fechou · novo começa agora</div>
          )}
          {(linhaDist || colDist) && (
            <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
              {linhaDist && (
                <div>
                  <div className="text-white/40 mb-1">Último · linhas (alvo 3)</div>
                  <div className="flex gap-0.5">
                    {linhaDist.map((n, i) => (
                      <span key={i} className={`flex-1 py-0.5 text-center rounded font-bold ${n === 3 ? "bg-emerald-500/20 text-emerald-300" : "bg-ink/60 text-white/70"}`}>{n}</span>
                    ))}
                  </div>
                </div>
              )}
              {colDist && (
                <div>
                  <div className="text-white/40 mb-1">Último · colunas (alvo 3)</div>
                  <div className="flex gap-0.5">
                    {colDist.map((n, i) => (
                      <span key={i} className={`flex-1 py-0.5 text-center rounded font-bold ${n === 3 ? "bg-emerald-500/20 text-emerald-300" : "bg-ink/60 text-white/70"}`}>{n}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "trincas" && (
        <div className="space-y-1.5">
          <div className="text-[10px] text-white/50 mb-1">3 dezenas que saem juntas mais que o esperado</div>
          {trincas.length === 0 && <div className="text-xs text-white/50">Histórico insuficiente.</div>}
          {trincas.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-4 text-white/40 tabular-nums">#{i + 1}</span>
              <div className="flex gap-0.5">
                {t.dezenas.map(n => (
                  <span key={n} className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                    i === 0 ? "bg-gradient-to-br from-gold to-amber-500 text-ink" : "bg-ink/60 border border-line text-white/80"
                  }`}>
                    {String(n).padStart(2, "0")}
                  </span>
                ))}
              </div>
              <span className="ml-auto text-white/50 tabular-nums">{t.lift.toFixed(3)}</span>
              <span className="text-white/40 tabular-nums w-8 text-right">{t.count}×</span>
            </div>
          ))}
        </div>
      )}

      {tab === "quentes" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-orange-300/70 mb-1.5 flex items-center gap-1">
              <Flame size={10} /> Quentes
            </div>
            <div className="flex flex-wrap gap-1">
              {stats.quentes.map(n => <Ball key={n} n={n} size="sm" />)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-sky-300/70 mb-1.5 flex items-center gap-1">
              <Snowflake size={10} /> Frias
            </div>
            <div className="flex flex-wrap gap-1">
              {stats.frias.map(n => <Ball key={n} n={n} size="sm" />)}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ============================================================
   PAINEL PLACAR + ATUALIZAR SISTEMA (mantido, mas usado como estava)
   ============================================================ */
function PainelPlacar({ historico, onHistoricoUpdate }) {
  const [placar, setPlacar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState("idle"); // idle | loading | done | erro
  const [info, setInfo] = useState(null);
  const [progresso, setProgresso] = useState(null);
  const [versaoNovaDisponivel, setVersaoNovaDisponivel] = useState(false);

  useEffect(() => {
    setLoading(true);
    calcularPlacar(historico).then(p => { setPlacar(p); setLoading(false); });
  }, [historico]);

  // Checa versão nova ao carregar + a cada 5min
  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const nova = await temVersaoNova();
        if (mounted) setVersaoNovaDisponivel(nova);
      } catch {}
    };
    check();
    const iv = setInterval(check, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  async function atualizarTudo() {
    setEstado("loading");
    setInfo(null);
    setProgresso(null);
    try {
      // Loop até fechar o gap. Cada rodada baixa até 100 concursos.
      // Total limitado a 2000 concursos (aprox 15 anos de Lotofácil) por segurança.
      const MAX_POR_RODADA = 100;
      const MAX_TOTAL = 2000;
      let historicoFinal = historico;
      let totalBaixados = 0;
      let ultimoRemotoNum = 0;
      let ultimoLocalInicial = historico.length ? historico[historico.length - 1].numero : 0;

      for (let rodada = 0; rodada < 20; rodada++) {
        const gap = ultimoRemotoNum
          ? (ultimoRemotoNum - historicoFinal[historicoFinal.length - 1]?.numero)
          : null;
        setProgresso({
          atual: totalBaixados,
          total: gap != null ? totalBaixados + gap : totalBaixados + 1,
          novos: totalBaixados,
        });

        const { novos, ultimoRemoto } = await importarNovos(historicoFinal, {
          max: MAX_POR_RODADA,
          onProgresso: (p) => {
            setProgresso({
              atual: totalBaixados + p.atual,
              total: totalBaixados + p.total,
              novos: totalBaixados + p.novos,
            });
          },
        });
        ultimoRemotoNum = ultimoRemoto.numero;
        if (!novos.length) break;
        historicoFinal = await mergeConcursos(historicoFinal, novos);
        onHistoricoUpdate?.(historicoFinal);
        totalBaixados += novos.length;
        const ultimoLocalAgora = historicoFinal[historicoFinal.length - 1].numero;
        if (ultimoLocalAgora >= ultimoRemotoNum) break;
        if (totalBaixados >= MAX_TOTAL) break;
      }

      const novoPlacar = await calcularPlacar(historicoFinal);
      setPlacar(novoPlacar);

      // Re-tuna o Guru local se importou concursos novos (aprende com os dados novos)
      if (totalBaixados > 0) {
        setInfo(`+${totalBaixados} concurso${totalBaixados > 1 ? "s" : ""} · Guru re-aprendendo…`);
        try {
          invalidarCacheTuning();
          await recomputarTuningLocal(historicoFinal, {
            onProgresso: (p) => setInfo(`Guru avaliando ${p.nome} (${p.i + 1}/${p.total})…`),
          });
        } catch (e) { console.warn("[Guru] re-tune falhou:", e); }
      }

      const msg = totalBaixados
        ? `✓ +${totalBaixados} concurso${totalBaixados > 1 ? "s" : ""} · agora #${ultimoRemotoNum} · Guru atualizado`
        : `Tudo em dia · último #${ultimoLocalInicial}`;
      setInfo(msg);
      setEstado("done");
    } catch (e) {
      console.warn("[Placar] atualizar falhou:", e);
      setInfo(e.message || "Falha na atualização");
      setEstado("erro");
    }
    setTimeout(() => { setEstado("idle"); setInfo(null); setProgresso(null); }, 6000);
  }

  return (
    <section className="card">
      {/* Banner de versão nova */}
      {versaoNovaDisponivel && (
        <div className="bg-gold/15 border border-gold/50 rounded-lg p-2 mb-3 flex items-center gap-2">
          <Sparkles size={14} className="text-gold flex-none" />
          <div className="text-[11px] text-white/90 flex-1">
            <b className="text-gold">Nova versão disponível!</b> Toque pra atualizar.
          </div>
          <button
            onClick={forcarAtualizacao}
            className="text-[11px] font-bold px-3 py-1 rounded-lg bg-gold text-ink"
          >
            Atualizar
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <Trophy size={14} className="text-gold" />
        <h3 className="font-semibold text-sm">Meu placar</h3>
        <button
          onClick={atualizarTudo}
          disabled={estado === "loading"}
          className={`ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 disabled:opacity-60 ${
            estado === "done" ? "bg-emerald-500/20 text-emerald-300"
            : estado === "erro" ? "bg-red-500/20 text-red-300"
            : "bg-accent/20 text-accent hover:bg-accent/30"
          }`}
        >
          {estado === "loading" ? <><RefreshCw size={11} className="animate-spin" /> Atualizando…</>
          : estado === "done" ? <><Check size={11} /> OK</>
          : estado === "erro" ? <><Info size={11} /> Erro</>
          : <><Zap size={11} /> Atualizar</>}
        </button>
        <button
          onClick={forcarAtualizacao}
          title="Forçar recarregar app (limpa cache)"
          aria-label="Forçar recarregar app"
          className="text-white/40 active:text-white p-1 rounded"
        >
          <RefreshCw size={11} />
        </button>
      </div>

      {loading && <div className="text-xs text-white/50 text-center py-2">Carregando…</div>}

      {placar && !loading && placar.totalApostas === 0 && (
        <div className="text-[11px] text-white/50 text-center py-2">
          Sem bilhetes ainda · salve jogos em Gerar / Fechar / Bolão
        </div>
      )}

      {placar && !loading && placar.totalApostas > 0 && (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            <MiniStat label="Bilhetes" value={placar.totalApostas} />
            <MiniStat label="Premiadas" value={`${placar.premiadas}/${placar.conferidas}`} tone={placar.premiadas > 0 ? "gold" : "gray"} />
            <MiniStat label="Prêmio" value={`R$ ${placar.premioTotal.toLocaleString("pt-BR")}`} tone={placar.premioTotal > 0 ? "gold" : "gray"} />
            <MiniStat label="Melhor" value={placar.melhor > 0 ? `${placar.melhor}` : "—"} tone={placar.melhor >= 11 ? "gold" : "gray"} />
          </div>

          {placar.premiadas > 0 && (
            <div className="mt-2 text-[10px] text-gold text-center">
              🏆 {placar.premiadas} premiada{placar.premiadas > 1 ? "s" : ""} · ROI{" "}
              <b className={placar.roi > 0 ? "text-green-400" : "text-red-400"}>
                {placar.roi > 0 ? "+" : ""}{placar.roi}%
              </b>
            </div>
          )}
          {placar.pendentes > 0 && (
            <div className="mt-1 text-[10px] text-white/40 text-center">
              {placar.pendentes} aguardando sorteio
            </div>
          )}
        </>
      )}

      {(progresso || info) && (
        <div className="text-[11px] text-white/60 text-center mt-2">
          {estado === "loading" && progresso
            ? `Baixando ${progresso.atual}/${progresso.total}…`
            : info}
        </div>
      )}
    </section>
  );
}

/* ============================================================
   PAINEL GURU IA · insight ajustado automaticamente
   Lê public/tuning.json (regenerado após cada import de concursos)
   ============================================================ */
function PainelGuru({ historico }) {
  const [tuning, setTuning] = useState(null);
  const [open, setOpen] = useState(false);
  const [retreinando, setRetreinando] = useState(false);
  const [retreinoInfo, setRetreinoInfo] = useState(null);

  useEffect(() => { loadTuning().then(setTuning); }, []);

  async function retreinar() {
    if (!historico?.length) return;
    setRetreinando(true);
    setRetreinoInfo("Preparando…");
    try {
      invalidarCacheTuning();
      const novo = await recomputarTuningLocal(historico, {
        onProgresso: (p) => setRetreinoInfo(`Avaliando ${p.nome} (${p.i + 1}/${p.total})…`),
      });
      if (novo) {
        setTuning(novo);
        setRetreinoInfo(`✓ Guru retreinado com ${historico.length} concursos`);
      } else {
        setRetreinoInfo("Histórico curto demais pra treinar");
      }
    } catch (e) {
      setRetreinoInfo("Falhou: " + (e.message || "erro"));
    }
    setRetreinando(false);
    setTimeout(() => setRetreinoInfo(null), 4000);
  }

  if (!tuning) return null;
  const { insight, ranking, atualizadoEm, ultimoConcurso, janelaBacktest, contexto, origem } = tuning;
  const data = new Date(atualizadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const ultimoLocal = historico?.[historico.length - 1]?.numero || 0;
  const defasado = ultimoLocal > ultimoConcurso;

  return (
    <section className="card bg-gradient-to-br from-emerald-900/20 to-panel border-emerald-500/30">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles size={14} className="text-emerald-300" />
          <div className="text-[11px] uppercase tracking-wider text-emerald-300 font-bold">
            Guru IA · análise
          </div>
        </div>
        <span className="text-[10px] text-white/40">{data} · #{ultimoConcurso}</span>
      </div>
      <div className="text-[13px] text-white/85 leading-snug">
        {insight.paragrafos[0].replace(/\*\*/g, "").split("Recebeu peso")[0].trim()}
      </div>

      {defasado && (
        <div className="mt-2 text-[11px] text-amber-300 flex items-center gap-1">
          <Info size={11} /> Guru até #{ultimoConcurso}, você tem até #{ultimoLocal}. Retreine.
        </div>
      )}

      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="text-[11px] text-emerald-300/70 hover:text-emerald-300"
        >
          {open ? "▲ menos" : "▼ ranking + dezenas"}
        </button>
        {origem === "client-local" && !defasado && (
          <span className="text-[10px] text-emerald-300/60" title="Treinado localmente com seus dados">✓ local</span>
        )}
        <button
          onClick={retreinar}
          disabled={retreinando || !historico?.length}
          className={`ml-auto text-[11px] px-2 py-0.5 rounded-lg border flex items-center gap-1 disabled:opacity-50 ${
            defasado
              ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
              : "border-emerald-500/40 text-emerald-300/70 hover:bg-emerald-500/10"
          }`}
        >
          {retreinando
            ? <><RefreshCw size={10} className="animate-spin" /> …</>
            : <><Sparkles size={10} /> Retreinar</>}
        </button>
      </div>
      {retreinoInfo && (
        <div className="text-[10px] text-white/60 mt-1.5">{retreinoInfo}</div>
      )}

      {open && (
        <div className="mt-3 space-y-3 pt-3 border-t border-emerald-500/20">
          {/* Ranking */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">
              Ranking · {janelaBacktest} concursos
            </div>
            <div className="space-y-1">
              {ranking.map(r => (
                <div key={r.estrategia} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 text-white/80">{r.nome}</span>
                  <span className="text-white/50 tabular-nums">{r.pctPremio}%</span>
                  <div className="w-16 h-1.5 bg-ink/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-gold"
                      style={{ width: `${r.peso * 100 * 4}%` }}
                    />
                  </div>
                  <span className="text-gold font-bold tabular-nums w-8 text-right">{Math.round(r.peso * 100)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contexto */}
          {contexto && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-orange-300/70 mb-1">
                  Quentes 30
                </div>
                <div className="flex flex-wrap gap-1">
                  {contexto.quentes30.map(n => (
                    <span key={n} className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40">
                      {String(n).padStart(2, "0")}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-sky-300/70 mb-1">
                  Frias 30
                </div>
                <div className="flex flex-wrap gap-1">
                  {contexto.frias30.map(n => (
                    <span key={n} className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                      {String(n).padStart(2, "0")}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
          {contexto?.maisAtrasadas?.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
                Mais atrasadas
              </div>
              <div className="flex flex-wrap gap-1">
                {contexto.maisAtrasadas.map(({ dezena, atraso }) => (
                  <span key={dezena} className="inline-flex items-center gap-1 px-1.5 h-6 rounded-full text-[10px] font-bold bg-gold/10 text-gold border border-gold/40">
                    {String(dezena).padStart(2, "0")}
                    <span className="text-[9px] font-normal text-white/50">·{atraso}c</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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
   PAINEL TRINCAS DOURADAS
   Top N combinações de 3 dezenas que saem juntas MAIS do que
   o aleatório esperaria (lift > 1). Usadas como "âncora" por
   apostadores experientes.
   ============================================================ */
function PainelTrincas({ historico }) {
  const [open, setOpen] = useState(false);
  const trincas = useMemo(() => {
    if (!historico?.length) return [];
    return topTrincas(historico.map(c => c.dezenas), 8, { minCount: 40 });
  }, [historico]);

  if (!trincas.length) return null;
  const top = trincas[0];

  return (
    <section className="card">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp size={14} className="text-gold" />
        <h3 className="font-semibold">Trincas douradas</h3>
        <span className="chip ml-auto">top 8 · lift &gt; 1</span>
      </div>
      <div className="text-xs text-white/60 mb-2">
        3 dezenas que saem juntas MAIS do que o aleatório esperaria.
        Muitos apostadores usam como âncora do jogo.
      </div>

      {/* Top-1 destacado */}
      <div className="bg-ink/40 border border-gold/30 rounded-lg p-2 flex items-center gap-2 mb-2">
        <div className="flex gap-1">
          {top.dezenas.map(n => (
            <span key={n} className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold bg-gradient-to-br from-gold to-amber-500 text-ink">
              {String(n).padStart(2, "0")}
            </span>
          ))}
        </div>
        <div className="text-[11px] text-white/70 flex-1">
          <span className="text-gold font-bold">#1</span> · lift {top.lift.toFixed(3)} · saiu {top.count}× no histórico
        </div>
      </div>

      <button
        onClick={() => setOpen(o => !o)}
        className="text-[11px] text-white/60 hover:text-white"
      >
        {open ? "▲ menos" : "▼ ver top 8"}
      </button>

      {open && (
        <div className="mt-2 space-y-1">
          {trincas.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-4 text-white/40 tabular-nums">#{i + 1}</span>
              <div className="flex gap-0.5">
                {t.dezenas.map(n => (
                  <span key={n} className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                    i === 0
                      ? "bg-gradient-to-br from-gold to-amber-500 text-ink"
                      : "bg-ink/60 border border-line text-white/80"
                  }`}>
                    {String(n).padStart(2, "0")}
                  </span>
                ))}
              </div>
              <span className="ml-auto text-white/50 tabular-nums">{t.lift.toFixed(3)}</span>
              <span className="text-white/40 tabular-nums">{t.count}×</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ============================================================
   JOGO DO DIA · gerador em 1 clique
   Usa Combo IA (mix de estratégias) por padrão. 1 tap = 1 jogo
   com análise instantânea (primos, pares, soma, faixa).
   ============================================================ */
function JogoDoDia({ historico }) {
  const [tuning, setTuning] = useState(null);
  const [jogo, setJogo] = useState(() => gerar(historico, null));
  const [savedMsg, setSavedMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    loadTuning().then(t => {
      setTuning(t);
      // Após carregar tuning, regenera o jogo com pesos ajustados
      if (t?.pesos) setJogo(gerar(historico, t.pesos));
    });
  }, [historico]);

  function gerarNovo() {
    setJogo(gerar(historico, tuning?.pesos));
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

function gerar(historico, pesosAjustados = null) {
  try {
    const [j] = gerarJogos({
      quantidade: 1,
      estrategia: "combo",
      historico: historico.map(c => c.dezenas),
      pesosAjustados,
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
