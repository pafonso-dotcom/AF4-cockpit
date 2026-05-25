import React, { useState } from "react";
import { FlaskConical, Play } from "lucide-react";
import { rodarBacktest } from "../../lib/backtest.js";

const ESTRATEGIAS = [
  { id: "ponderado",  nome: "IA Ponderada" },
  { id: "balanceado", nome: "Balanceada" },
  { id: "aleatorio",  nome: "Aleatória" },
];

export default function Simulacoes({ historico }) {
  const [janela, setJanela] = useState(50);
  const [jogosPorConcurso, setJogosPorConcurso] = useState(1);
  const [estrategia, setEstrategia] = useState("ponderado");
  const [resultado, setResultado] = useState(null);
  const [rodando, setRodando] = useState(false);

  function rodar() {
    setRodando(true);
    setResultado(null);
    requestAnimationFrame(() => {
      const r = rodarBacktest({
        historico: historico.map(c => c.dezenas),
        janela: Math.min(janela, historico.length),
        jogosPorConcurso,
        geradorOpts: { estrategia },
      });
      setResultado(r);
      setRodando(false);
    });
  }

  return (
    <div className="px-4 pt-4 pb-28 space-y-4">
      <section className="card space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wider text-white/40">Estratégia</label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {ESTRATEGIAS.map(e => (
              <button
                key={e.id}
                onClick={() => setEstrategia(e.id)}
                className={`rounded-xl px-2 py-3 text-sm font-semibold border transition ${
                  estrategia === e.id ? "border-gold bg-gold/10" : "border-line bg-ink/40"
                }`}
              >
                {e.nome}
              </button>
            ))}
          </div>
        </div>

        <Slider
          label={`Janela · últimos ${janela} concursos`}
          value={janela} min={10} max={Math.max(10, historico.length)} step={10}
          onChange={setJanela}
        />
        <Slider
          label={`Jogos por concurso · ${jogosPorConcurso}`}
          value={jogosPorConcurso} min={1} max={20} step={1}
          onChange={setJogosPorConcurso}
        />

        <button
          onClick={rodar}
          disabled={rodando || !historico.length}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {rodando
            ? <><FlaskConical size={16} className="animate-pulse" /> Simulando…</>
            : <><Play size={16} /> Rodar simulação</>}
        </button>
      </section>

      {resultado && (
        <section className="card space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Concursos" value={resultado.concursos} />
            <Stat label="Apostas" value={resultado.totalApostas} />
            <Stat label="ROI"
              value={`${resultado.roi > 0 ? "+" : ""}${resultado.roi}%`}
              tone={resultado.roi > 0 ? "green" : resultado.roi < 0 ? "red" : "neutral"}
            />
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wider text-white/40 mb-2">Distribuição de acertos</h4>
            <div className="space-y-1.5">
              {[15, 14, 13, 12, 11].map(k => {
                const v = resultado.distAcertos[k] || 0;
                const pct = resultado.totalApostas ? (v / resultado.totalApostas) * 100 : 0;
                return (
                  <div key={k} className="flex items-center gap-2">
                    <div className="w-10 text-sm font-bold text-gold">{k}</div>
                    <div className="flex-1 h-3 bg-ink/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-accent to-gold"
                        style={{ width: `${Math.max(pct * 3, v ? 4 : 0)}%` }}
                      />
                    </div>
                    <div className="w-12 text-right text-xs text-white/60">{v}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Stat label="Gasto" value={`R$ ${resultado.gastoTotal.toLocaleString("pt-BR")}`} />
            <Stat label="Prêmio est." value={`R$ ${resultado.premioTotal.toLocaleString("pt-BR")}`} tone="gold" />
          </div>
          <p className="text-[10px] text-white/40 text-center">
            Prêmios estimados em valores médios (referência). Não substituem a tabela oficial.
          </p>
        </section>
      )}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-white/40">{label}</label>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        className="w-full mt-2 accent-gold"
      />
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }) {
  const color =
    tone === "green" ? "text-green-400"
    : tone === "red" ? "text-red-400"
    : tone === "gold" ? "text-gold"
    : "text-white";
  return (
    <div className="bg-ink/60 border border-line rounded-xl py-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={`font-bold ${color}`}>{value}</div>
    </div>
  );
}
