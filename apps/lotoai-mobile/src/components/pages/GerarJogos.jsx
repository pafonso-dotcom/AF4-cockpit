import React, { useState } from "react";
import { Wand2, Save, RefreshCw, Lock, Ban } from "lucide-react";
import Ball from "../ui/Ball.jsx";
import { gerarJogos } from "../../lib/generator.js";
import { analisarJogo, NUMEROS, custoAposta } from "../../lib/lotofacil.js";
import { salvarJogos } from "../../lib/supabase.js";

const ESTRATEGIAS = [
  { id: "zonas",         nome: "Zonas + Primos", hint: "8 de 1–15 + 7 de 16–25 · primos primeiro" },
  { id: "estratificado", nome: "Estratificada",  hint: "Cobre estratos do espaço (max P(prêmio))" },
  { id: "bayesiano",     nome: "Bayesiana",      hint: "Posterior Beta · prior Beta(15,10)" },
  { id: "ponderado",     nome: "IA Ponderada",   hint: "Frequência + atraso" },
  { id: "balanceado",    nome: "Balanceada",     hint: "Pares 7–8 alvo" },
  { id: "aleatorio",     nome: "Aleatória",      hint: "Surpresinha pura" },
];

export default function GerarJogos({ historico }) {
  const [quantidade, setQuantidade] = useState(5);
  const [estrategia, setEstrategia] = useState("ponderado");
  const [fixos, setFixos] = useState([]);
  const [excluir, setExcluir] = useState([]);
  const [jogos, setJogos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  const toggle = (lista, setLista, n, outraLista) => {
    if (outraLista.includes(n)) return;
    setLista(lista.includes(n) ? lista.filter(x => x !== n) : [...lista, n].slice(0, 14));
  };

  function gerar() {
    const out = gerarJogos({
      quantidade,
      estrategia,
      historico: historico.map(c => c.dezenas),
      fixos,
      excluir,
    });
    setJogos(out);
    setSavedMsg("");
  }

  async function salvar() {
    if (!jogos.length) return;
    setSalvando(true);
    const res = await salvarJogos(jogos, { estrategia });
    setSalvando(false);
    setSavedMsg(res.remote ? "Salvo no Supabase" : "Salvo localmente");
    setTimeout(() => setSavedMsg(""), 2500);
  }

  const custoTotal = +(jogos.length * custoAposta(15)).toFixed(2);

  return (
    <div className="px-4 pt-4 pb-28 space-y-4">
      <section className="card space-y-4">
        <div>
          <label className="text-xs uppercase tracking-wider text-white/40">Estratégia</label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {ESTRATEGIAS.map(e => (
              <button
                key={e.id}
                onClick={() => setEstrategia(e.id)}
                className={`rounded-xl px-2 py-3 text-left border transition ${
                  estrategia === e.id
                    ? "border-gold bg-gold/10"
                    : "border-line bg-ink/40"
                }`}
              >
                <div className="text-sm font-semibold">{e.nome}</div>
                <div className="text-[10px] text-white/50">{e.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-white/40">
            Quantidade · {quantidade} jogo{quantidade > 1 ? "s" : ""}
          </label>
          <input
            type="range"
            min="1"
            max="20"
            value={quantidade}
            onChange={e => setQuantidade(+e.target.value)}
            className="w-full mt-2 accent-gold"
          />
        </div>

        <FiltrosDezenas
          icon={<Lock size={14} className="text-gold" />}
          titulo="Dezenas fixas"
          selecionadas={fixos}
          outra={excluir}
          onToggle={n => toggle(fixos, setFixos, n, excluir)}
        />
        <FiltrosDezenas
          icon={<Ban size={14} className="text-red-400" />}
          titulo="Dezenas excluídas"
          selecionadas={excluir}
          outra={fixos}
          onToggle={n => toggle(excluir, setExcluir, n, fixos)}
        />

        <div className="flex gap-2">
          <button onClick={gerar} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Wand2 size={16} /> Gerar
          </button>
          {jogos.length > 0 && (
            <button onClick={gerar} className="btn-ghost px-4">
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </section>

      {jogos.length > 0 && (
        <section className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">{jogos.length} jogo{jogos.length > 1 ? "s" : ""} · R$ {custoTotal.toFixed(2)}</h3>
            <button
              onClick={salvar}
              disabled={salvando}
              className="btn-gold !py-2 !px-3 text-sm flex items-center gap-1.5"
            >
              <Save size={14} /> {salvando ? "..." : "Salvar"}
            </button>
          </div>
          {savedMsg && <div className="text-xs text-green-400 mb-2">{savedMsg}</div>}
          <div className="space-y-3">
            {jogos.map((jogo, i) => {
              const a = analisarJogo(jogo);
              return (
                <div key={i} className="bg-ink/50 border border-line rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/50">Jogo {i + 1}</span>
                    <span className="text-[10px] text-white/40">
                      {a.pares}P · {a.primos}Pr · soma {a.soma}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {jogo.map(n => <Ball key={n} n={n} size="sm" highlight={fixos.includes(n)} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function FiltrosDezenas({ icon, titulo, selecionadas, outra, onToggle }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/40">
          {icon} {titulo}
        </div>
        <span className="text-[10px] text-white/40">{selecionadas.length} selecionada{selecionadas.length === 1 ? "" : "s"}</span>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {NUMEROS.map(n => {
          const on = selecionadas.includes(n);
          const off = outra.includes(n);
          return (
            <button
              key={n}
              disabled={off}
              onClick={() => onToggle(n)}
              className={`aspect-square rounded-md text-[11px] font-semibold transition ${
                on
                  ? "bg-gold text-ink"
                  : off
                  ? "bg-red-900/30 text-white/30 line-through"
                  : "bg-ink/60 border border-line text-white/70 active:scale-95"
              }`}
            >
              {String(n).padStart(2, "0")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
