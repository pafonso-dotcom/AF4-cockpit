import React, { useEffect, useMemo, useState } from "react";
import { Layers, Sparkles, Eye, AlertTriangle, Save, Shrink, Expand, Lock } from "lucide-react";
import Ball from "../ui/Ball.jsx";
import { NUMEROS } from "../../lib/lotofacil.js";
import { scores as calcScores } from "../../lib/stats.js";
import {
  gerarFechamentoCompleto,
  analisarFechamento,
  resumoFechamento,
  sugerirBase,
  loadCoverings,
  matrizesPara,
  aplicarMatriz,
  gerarFixasRotativas,
  resumoFixasRotativas,
} from "../../lib/fechamentos.js";
import { salvarJogos } from "../../lib/supabase.js";

const CUSTO_MAX_RECOMENDADO = 500;

export default function Fechamentos({ historico }) {
  const [base, setBase] = useState(() => Array.from({ length: 16 }, (_, i) => i + 1));
  const [modo, setModo] = useState("matriz"); // "matriz" | "completo" | "fixas"
  const [fixasSet, setFixasSet] = useState(new Set()); // subset da base
  const [coverings, setCoverings] = useState(null);
  const [matrizSel, setMatrizSel] = useState(null);
  const [jogos, setJogos] = useState([]);
  const [analise, setAnalise] = useState(null);
  const [savedMsg, setSavedMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { loadCoverings().then(setCoverings); }, []);

  const matrizesDisponiveis = useMemo(() => matrizesPara(coverings, base.length), [coverings, base.length]);
  const resumoCompleto = useMemo(() => resumoFechamento(base.length), [base.length]);
  const ultimo = historico[historico.length - 1];

  // ao mudar base, escolhe a matriz de maior garantia disponível
  useEffect(() => {
    if (matrizesDisponiveis.length) setMatrizSel(matrizesDisponiveis[0]);
    else setMatrizSel(null);
    setJogos([]);
    setAnalise(null);
  }, [matrizesDisponiveis]);

  function toggle(n) {
    if (modo === "fixas") {
      // No modo fixas: ciclo off → rotativa (na base) → fixa (subset) → off
      setBase(prev => {
        const onBase = prev.includes(n);
        const onFixa = fixasSet.has(n);
        if (!onBase) {
          // adiciona como rotativa
          const next = [...prev, n].sort((a, b) => a - b);
          if (next.length > 20) return prev;
          return next;
        }
        if (!onFixa) {
          // promove a fixa
          setFixasSet(s => { const nx = new Set(s); nx.add(n); return nx; });
          return prev;
        }
        // remove tudo
        setFixasSet(s => { const nx = new Set(s); nx.delete(n); return nx; });
        return prev.filter(x => x !== n);
      });
    } else {
      setBase(prev => {
        const next = prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n];
        if (next.length > 20) return prev;
        return next.sort((a, b) => a - b);
      });
      // remove das fixas se sair da base
      setFixasSet(s => { const nx = new Set(s); nx.delete(n); return nx; });
    }
  }

  function sugerir() {
    if (!historico.length) return;
    const s = calcScores(historico.map(c => c.dezenas));
    setBase(sugerirBase(s, base.length || 18));
  }

  function gerar() {
    if (modo === "fixas") {
      const fixas = base.filter(n => fixasSet.has(n));
      const rotativas = base.filter(n => !fixasSet.has(n));
      const restam = 15 - fixas.length;
      if (restam < 0 || restam > rotativas.length) return;
      setJogos(gerarFixasRotativas(fixas, rotativas));
    } else {
      if (base.length < 15 || base.length > 20) return;
      if (modo === "completo") {
        setJogos(gerarFechamentoCompleto(base));
      } else if (matrizSel) {
        setJogos(aplicarMatriz(matrizSel.matriz, base));
      }
    }
    setAnalise(null);
  }

  function conferir() {
    if (!jogos.length || !ultimo) return;
    setAnalise(analisarFechamento(jogos, ultimo.dezenas));
  }

  async function salvar() {
    if (!jogos.length) return;
    setSalvando(true);
    const tag =
      modo === "completo" ? `fech-completo-${base.length}`
      : modo === "fixas" ? `fech-fixas-${nFixas}-rot-${nRotativas}`
      : `fech-matriz-${matrizSel.K}-${matrizSel.g}`;
    const res = await salvarJogos(jogos, { estrategia: tag });
    setSalvando(false);
    setSavedMsg(res.remote ? "Salvo no Supabase" : "Salvo localmente");
    setTimeout(() => setSavedMsg(""), 2500);
  }

  const nFixas = base.filter(n => fixasSet.has(n)).length;
  const nRotativas = base.filter(n => !fixasSet.has(n)).length;
  const resumoFR = useMemo(
    () => resumoFixasRotativas(nFixas, nRotativas),
    [nFixas, nRotativas]
  );
  const valido =
    modo === "fixas"
      ? resumoFR.valido && nFixas <= 14
      : base.length >= 15 && base.length <= 20;
  const apostas =
    modo === "completo" ? resumoCompleto.apostas
    : modo === "fixas" ? resumoFR.apostas
    : (matrizSel?.apostas || 0);
  const custo =
    modo === "completo" ? resumoCompleto.custo
    : modo === "fixas" ? resumoFR.custo
    : (matrizSel?.custo || 0);
  const muitoCaro = custo > CUSTO_MAX_RECOMENDADO;

  return (
    <div className="px-4 pt-4 pb-28 space-y-4">
      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Layers size={18} className="text-gold" /> Dezenas-base
            </h2>
            <p className="text-[11px] text-white/50">Escolha 15 a 20 dezenas</p>
          </div>
          <button
            onClick={sugerir}
            disabled={!historico.length}
            className="text-xs px-3 py-2 rounded-lg border border-line text-white/70 flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
          >
            <Sparkles size={12} /> Sugerir top-{base.length || 18}
          </button>
        </div>
        {modo === "fixas" && (
          <div className="text-[11px] text-white/60 bg-ink/40 rounded-lg p-2 mb-2">
            💡 <b>Toque:</b> off → rotativa (roxa) → fixa (dourada) → off
          </div>
        )}
        <div className="grid grid-cols-5 gap-2">
          {NUMEROS.map(n => {
            const on = base.includes(n);
            const cheio = base.length >= 20 && !on;
            const fixa = fixasSet.has(n);
            let cls;
            if (modo === "fixas") {
              cls = fixa
                ? "bg-gradient-to-br from-gold to-amber-500 text-ink ring-2 ring-gold/60"
                : on
                ? "bg-gradient-to-br from-accent/80 to-indigo-700 text-white"
                : cheio
                ? "bg-ink/40 border border-line text-white/20"
                : "bg-ink/60 border border-line text-white/70 active:scale-95";
            } else {
              cls = on
                ? "bg-gradient-to-br from-gold to-amber-500 text-ink"
                : cheio
                ? "bg-ink/40 border border-line text-white/20"
                : "bg-ink/60 border border-line text-white/70 active:scale-95";
            }
            return (
              <button
                key={n}
                disabled={cheio}
                onClick={() => toggle(n)}
                className={`relative aspect-square rounded-lg text-sm font-bold transition ${cls}`}
              >
                {String(n).padStart(2, "0")}
                {modo === "fixas" && fixa && (
                  <Lock size={9} className="absolute top-0.5 right-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card space-y-3">
        {/* Toggle modo · 3 opções */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setModo("matriz")}
            disabled={!matrizesDisponiveis.length}
            className={`rounded-xl px-2 py-3 border text-left transition ${
              modo === "matriz" ? "border-gold bg-gold/10" : "border-line bg-ink/40"
            } disabled:opacity-40`}
          >
            <div className="flex items-center gap-1 text-xs font-semibold">
              <Shrink size={12} className="text-gold" /> Matriz
            </div>
            <div className="text-[9px] text-white/50">Mín. apostas c/ garantia</div>
          </button>
          <button
            onClick={() => setModo("completo")}
            className={`rounded-xl px-2 py-3 border text-left transition ${
              modo === "completo" ? "border-gold bg-gold/10" : "border-line bg-ink/40"
            }`}
          >
            <div className="flex items-center gap-1 text-xs font-semibold">
              <Expand size={12} className="text-gold" /> Completo
            </div>
            <div className="text-[9px] text-white/50">Todas as C(K,15)</div>
          </button>
          <button
            onClick={() => setModo("fixas")}
            className={`rounded-xl px-2 py-3 border text-left transition relative ${
              modo === "fixas" ? "border-gold bg-gold/10" : "border-line bg-ink/40"
            }`}
          >
            <span className="absolute -top-1.5 -right-1 text-[7px] font-bold px-1 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              NOVO
            </span>
            <div className="flex items-center gap-1 text-xs font-semibold">
              <Lock size={12} className="text-gold" /> Fixas & Rotat.
            </div>
            <div className="text-[9px] text-white/50">N fixas + pool rotação</div>
          </button>
        </div>

        {/* Seletor de garantia (modo matriz) */}
        {modo === "matriz" && matrizesDisponiveis.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wider text-white/40 mb-2">Garantia desejada</div>
            <div className="grid grid-cols-3 gap-2">
              {matrizesDisponiveis.map(m => (
                <button
                  key={`${m.K}-${m.g}`}
                  onClick={() => setMatrizSel(m)}
                  className={`rounded-xl px-2 py-2 border transition ${
                    matrizSel?.g === m.g
                      ? "border-gold bg-gold/10"
                      : "border-line bg-ink/40"
                  }`}
                >
                  <div className="text-base font-bold text-gold">{m.g} pts</div>
                  <div className="text-[10px] text-white/60">{m.apostas} apostas</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {modo === "matriz" && !matrizesDisponiveis.length && (
          <div className="text-xs text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded-lg p-2">
            Não há matriz pré-calculada para {base.length} dezenas. Use o modo completo ou mude a quantidade.
          </div>
        )}

        {modo === "fixas" && (
          <div className="bg-ink/40 border border-line rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-white/60 flex items-center gap-1">
                <Lock size={11} className="text-gold" /> Fixas (em TODOS os jogos)
              </span>
              <span className="text-gold font-bold">{nFixas}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">Pool de rotação</span>
              <span className="text-accent font-bold">{nRotativas}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-1 text-[11px]">
              <span className="text-white/50">Preciso de {15 - nFixas} dezena{15 - nFixas === 1 ? "" : "s"} do pool por jogo</span>
              <span className="text-white/70">C({nRotativas}, {15 - nFixas}) = {apostas}</span>
            </div>
            {!resumoFR.valido && (
              <div className="text-xs text-amber-300 mt-1">
                {nFixas > 14 && "Máximo 14 fixas (precisa ≥1 rotativa)."}
                {nFixas + nRotativas < 15 && "Base incompleta: fixas + rotativas ≥ 15."}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat
            label={modo === "fixas" ? "Base" : "Dezenas"}
            value={modo === "fixas" ? `${nFixas}+${nRotativas}` : base.length}
          />
          <Stat label="Apostas" value={apostas.toLocaleString("pt-BR")} />
          <Stat
            label="Custo"
            value={`R$ ${custo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            tone={muitoCaro ? "red" : "gold"}
          />
        </div>

        {muitoCaro && (
          <div className="flex gap-2 items-start text-xs text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded-lg p-2">
            <AlertTriangle size={14} className="flex-none mt-0.5" />
            <div>
              Custo alto. Backtest sobre 200 concursos mostrou ROI negativo (~-77%) mesmo com matrizes ótimas. Considere diminuir K ou a garantia.
            </div>
          </div>
        )}

        {modo === "matriz" && matrizSel && (
          <div className="bg-ink/40 border border-line rounded-lg p-3 text-sm">
            <div className="text-white">
              <b className="text-gold">{matrizSel.g} pontos garantidos</b> se{" "}
              <b className="text-white">{matrizSel.g}</b> das suas <b>{matrizSel.K}</b> dezenas saírem no sorteio.
            </div>
            <div className="text-[11px] text-white/50 mt-1">
              Garantia matemática verificada (cobertura 100%) via algoritmo greedy de set-cover.
            </div>
          </div>
        )}

        {modo === "completo" && (
          <div>
            <h4 className="text-xs uppercase tracking-wider text-white/40 mb-2">Garantias matemáticas</h4>
            <div className="space-y-1 text-sm">
              {resumoCompleto.garantias.map(g => (
                <div key={g.acertosBase} className="flex justify-between bg-ink/40 rounded-lg px-3 py-1.5">
                  <span className="text-white/60">Se {g.acertosBase} das suas dezenas saírem</span>
                  <span className="text-gold font-semibold">→ {g.garantiaPontos} pts</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={gerar}
          disabled={!valido || (modo === "matriz" && !matrizSel)}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Layers size={16} /> Gerar fechamento
        </button>
      </section>

      {jogos.length > 0 && (
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{jogos.length} aposta{jogos.length > 1 ? "s" : ""}</h3>
            <div className="flex gap-2">
              <button onClick={conferir} disabled={!ultimo} className="btn-ghost !py-2 !px-3 text-sm flex items-center gap-1.5">
                <Eye size={14} /> Conferir #{ultimo?.numero}
              </button>
              <button onClick={salvar} disabled={salvando} className="btn-gold !py-2 !px-3 text-sm flex items-center gap-1.5">
                <Save size={14} /> {salvando ? "..." : "Salvar"}
              </button>
            </div>
          </div>
          {savedMsg && <div className="text-xs text-green-400">{savedMsg}</div>}

          {analise && (
            <div className="bg-ink/40 border border-line rounded-xl p-3">
              <div className="text-sm font-semibold mb-2">
                Melhor pontuação no concurso #{ultimo.numero}:{" "}
                <span className="text-gold text-lg">{analise.melhor}</span>
              </div>
              <div className="grid grid-cols-5 gap-1 text-center text-xs">
                {[15, 14, 13, 12, 11].map(k => (
                  <div key={k} className="bg-panel border border-line rounded-lg py-1.5">
                    <div className="text-[10px] text-white/40">{k} pts</div>
                    <div className="font-bold text-gold">{analise.dist[k] || 0}</div>
                  </div>
                ))}
              </div>
              <div className="text-[11px] text-white/50 mt-2">
                Prêmio estimado: R$ {analise.premioEstimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
            </div>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer text-white/60 hover:text-white">
              Ver primeiros {Math.min(20, jogos.length)} jogos
            </summary>
            <div className="space-y-2 mt-2">
              {jogos.slice(0, 20).map((j, i) => (
                <div key={i} className="bg-ink/50 border border-line rounded-lg p-2">
                  <div className="text-[10px] text-white/40 mb-1">Aposta {i + 1}</div>
                  <div className="flex flex-wrap gap-1">
                    {j.map(n => <Ball key={n} n={n} size="sm" />)}
                  </div>
                </div>
              ))}
            </div>
          </details>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }) {
  const color =
    tone === "red" ? "text-red-400"
    : tone === "gold" ? "text-gold"
    : "text-white";
  return (
    <div className="bg-ink/60 border border-line rounded-xl py-2">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={`font-bold ${color}`}>{value}</div>
    </div>
  );
}
