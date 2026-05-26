import React, { useMemo, useState } from "react";
import { Layers, Sparkles, Eye, AlertTriangle, Save } from "lucide-react";
import Ball from "../ui/Ball.jsx";
import { NUMEROS } from "../../lib/lotofacil.js";
import { scores as calcScores } from "../../lib/stats.js";
import {
  gerarFechamentoCompleto,
  analisarFechamento,
  resumoFechamento,
  sugerirBase,
} from "../../lib/fechamentos.js";
import { salvarJogos } from "../../lib/supabase.js";

const CUSTO_MAX_RECOMENDADO = 500; // R$

export default function Fechamentos({ historico }) {
  const [base, setBase] = useState(() => Array.from({ length: 16 }, (_, i) => i + 1));
  const [jogos, setJogos] = useState([]);
  const [analise, setAnalise] = useState(null);
  const [savedMsg, setSavedMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  const resumo = useMemo(() => resumoFechamento(base.length), [base.length]);
  const ultimo = historico[historico.length - 1];

  function toggle(n) {
    setBase(prev => {
      const next = prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n];
      if (next.length > 20) return prev;
      return next.sort((a, b) => a - b);
    });
    setJogos([]);
    setAnalise(null);
  }

  function sugerir() {
    if (!historico.length) return;
    const s = calcScores(historico.map(c => c.dezenas));
    setBase(sugerirBase(s, base.length || 18));
    setJogos([]);
    setAnalise(null);
  }

  function gerar() {
    if (base.length < 15 || base.length > 20) return;
    const j = gerarFechamentoCompleto(base);
    setJogos(j);
    setAnalise(null);
  }

  function conferir() {
    if (!jogos.length || !ultimo) return;
    setAnalise(analisarFechamento(jogos, ultimo.dezenas));
  }

  async function salvar() {
    if (!jogos.length) return;
    setSalvando(true);
    const res = await salvarJogos(jogos, { estrategia: `fechamento-${base.length}` });
    setSalvando(false);
    setSavedMsg(res.remote ? "Salvo no Supabase" : "Salvo localmente");
    setTimeout(() => setSavedMsg(""), 2500);
  }

  const valido = base.length >= 15 && base.length <= 20;
  const muitoCaro = resumo.custo > CUSTO_MAX_RECOMENDADO;

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
        <div className="grid grid-cols-5 gap-2">
          {NUMEROS.map(n => {
            const on = base.includes(n);
            const cheio = base.length >= 20 && !on;
            return (
              <button
                key={n}
                disabled={cheio}
                onClick={() => toggle(n)}
                className={`aspect-square rounded-lg text-sm font-bold transition ${
                  on
                    ? "bg-gradient-to-br from-gold to-amber-500 text-ink"
                    : cheio
                    ? "bg-ink/40 border border-line text-white/20"
                    : "bg-ink/60 border border-line text-white/70 active:scale-95"
                }`}
              >
                {String(n).padStart(2, "0")}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Dezenas" value={resumo.dezenasBase} />
          <Stat label="Apostas" value={resumo.apostas.toLocaleString("pt-BR")} />
          <Stat
            label="Custo"
            value={`R$ ${resumo.custo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            tone={muitoCaro ? "red" : "gold"}
          />
        </div>

        {muitoCaro && (
          <div className="flex gap-2 items-start text-xs text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded-lg p-2">
            <AlertTriangle size={14} className="flex-none mt-0.5" />
            <div>
              Custo alto. Com 18 dezenas são 816 apostas (R$ 2.856). Considere
              começar com 16–17 dezenas, ou em produção usar uma <em>matriz de
              garantia</em> que reduz o nº de apostas.
            </div>
          </div>
        )}

        <div>
          <h4 className="text-xs uppercase tracking-wider text-white/40 mb-2">
            Garantias matemáticas
          </h4>
          <div className="space-y-1 text-sm">
            {resumo.garantias.map(g => (
              <div key={g.acertosBase} className="flex justify-between bg-ink/40 rounded-lg px-3 py-1.5">
                <span className="text-white/60">
                  Se <b className="text-white">{g.acertosBase}</b> das suas dezenas saírem
                </span>
                <span className="text-gold font-semibold">→ {g.garantiaPontos} pontos garantidos</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={gerar}
          disabled={!valido}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Layers size={16} /> Gerar fechamento
        </button>
      </section>

      {jogos.length > 0 && (
        <section className="card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{jogos.length} aposta{jogos.length > 1 ? "s" : ""} geradas</h3>
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
