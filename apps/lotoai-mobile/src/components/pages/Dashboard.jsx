import React, { useMemo } from "react";
import { Flame, Snowflake, Hash, TrendingUp } from "lucide-react";
import Ball from "../ui/Ball.jsx";
import { frequencias, atrasos, quentes, frias } from "../../lib/stats.js";
import { analisarJogo } from "../../lib/lotofacil.js";

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
