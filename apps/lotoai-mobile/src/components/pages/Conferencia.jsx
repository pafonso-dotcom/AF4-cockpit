import React, { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Plus, Trash2, Search, Check, X, Save } from "lucide-react";
import Ball from "../ui/Ball.jsx";
import { parseJogo, conferir, LOTOFACIL } from "../../lib/lotofacil.js";
import { listarJogos, salvarJogos, removerJogo } from "../../lib/supabase.js";

const PREMIO_MEDIO = { 11: 6, 12: 12, 13: 30, 14: 2000, 15: 1500000 };

export default function Conferencia({ historico }) {
  const [jogos, setJogos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [novo, setNovo] = useState("");
  const [erros, setErros] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const [concursoNum, setConcursoNum] = useState(() =>
    historico.length ? historico[historico.length - 1].numero : ""
  );

  const concursoSel = useMemo(() => {
    if (concursoNum === "" || concursoNum === null) return null;
    const n = +concursoNum;
    return historico.find(c => c.numero === n) || null;
  }, [historico, concursoNum]);

  useEffect(() => { recarregar(); }, []);

  async function recarregar() {
    setLoading(true);
    const list = await listarJogos({ limite: 200 });
    setJogos(list);
    setLoading(false);
  }

  async function adicionar() {
    const { ok, jogo, erros } = parseJogo(novo);
    if (!ok) { setErros(erros); return; }
    setErros([]);
    setSalvando(true);
    await salvarJogos([jogo], { estrategia: "manual" });
    setNovo("");
    setSalvando(false);
    await recarregar();
  }

  async function remover(id) {
    await removerJogo(id);
    setJogos(prev => prev.filter(j => j.id !== id));
  }

  const conferencias = useMemo(() => {
    if (!concursoSel) return null;
    return jogos.map(j => ({
      id: j.id,
      jogo: j,
      resultado: conferir(j.dezenas, concursoSel.dezenas),
    }));
  }, [jogos, concursoSel]);

  const resumo = useMemo(() => {
    if (!conferencias) return null;
    const dist = { 15: 0, 14: 0, 13: 0, 12: 0, 11: 0 };
    let premio = 0;
    for (const c of conferencias) {
      const p = c.resultado.pontos;
      if (p in dist) { dist[p]++; premio += PREMIO_MEDIO[p] || 0; }
    }
    return { dist, premio: +premio.toFixed(2), total: conferencias.length };
  }, [conferencias]);

  return (
    <div className="px-4 pt-4 pb-28 space-y-4">
      {/* Adicionar jogo */}
      <section className="card space-y-2">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={18} className="text-gold" />
          <h2 className="font-semibold">Adicionar bilhete</h2>
        </div>
        <textarea
          value={novo}
          onChange={e => setNovo(e.target.value)}
          rows={2}
          placeholder="Cole ou digite 15 dezenas (1 a 25), separadas por espaços, vírgulas ou hífens"
          className="w-full bg-ink/60 border border-line rounded-lg p-2 text-sm text-white placeholder:text-white/30 focus:border-gold outline-none"
        />
        {erros.length > 0 && (
          <ul className="text-xs text-red-400">
            {erros.map((e, i) => <li key={i}>• {e}</li>)}
          </ul>
        )}
        <button
          onClick={adicionar}
          disabled={salvando || !novo.trim()}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Plus size={16} /> {salvando ? "Salvando…" : "Adicionar"}
        </button>
      </section>

      {/* Conferência */}
      <section className="card space-y-3">
        <div className="flex items-center gap-2">
          <Search size={16} className="text-gold" />
          <h3 className="font-semibold">Conferir contra concurso</h3>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={historico.length ? historico[historico.length - 1].numero : 9999}
            value={concursoNum}
            onChange={e => setConcursoNum(e.target.value)}
            className="flex-1 bg-ink/60 border border-line rounded-lg px-3 py-2 text-sm text-white focus:border-gold outline-none"
          />
          <button
            onClick={() => setConcursoNum(historico[historico.length - 1]?.numero ?? "")}
            className="btn-ghost !py-2 !px-3 text-xs"
          >
            Último
          </button>
        </div>
        {concursoSel ? (
          <div className="bg-ink/40 border border-line rounded-lg p-3">
            <div className="text-xs text-white/50 mb-2">
              Concurso #{concursoSel.numero} · {concursoSel.data}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {concursoSel.dezenas.map(n => <Ball key={n} n={n} size="sm" highlight />)}
            </div>
          </div>
        ) : (
          <div className="text-xs text-white/50">Concurso não encontrado no histórico.</div>
        )}

        {resumo && resumo.total > 0 && (
          <div className="grid grid-cols-5 gap-1 text-center">
            {[15, 14, 13, 12, 11].map(k => (
              <div key={k} className="bg-panel border border-line rounded-lg py-1.5">
                <div className="text-[10px] text-white/40">{k} pts</div>
                <div className="font-bold text-gold">{resumo.dist[k] || 0}</div>
              </div>
            ))}
          </div>
        )}
        {resumo && resumo.premio > 0 && (
          <div className="text-xs text-white/60 text-center">
            Prêmio estimado: <b className="text-gold">R$ {resumo.premio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b>
          </div>
        )}
      </section>

      {/* Lista de jogos */}
      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Meus bilhetes ({jogos.length})</h3>
          {loading && <span className="text-xs text-white/50">Carregando…</span>}
        </div>

        {!loading && !jogos.length && (
          <p className="text-sm text-white/50 text-center py-6">
            Nenhum bilhete salvo. Use "Adicionar" acima, ou salve jogos nas abas Gerar / Fechar.
          </p>
        )}

        <div className="space-y-2">
          {(conferencias || jogos.map(j => ({ id: j.id, jogo: j, resultado: null }))).map(({ id, jogo, resultado }) => (
            <BilheteCard
              key={id}
              jogo={jogo}
              resultado={resultado}
              onRemover={() => remover(id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function BilheteCard({ jogo, resultado, onRemover }) {
  const acertSet = resultado ? new Set(resultado.acertadas) : null;
  const data = jogo.created_at ? new Date(jogo.created_at).toLocaleDateString("pt-BR") : "";

  return (
    <div className="bg-ink/50 border border-line rounded-xl p-3">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-[11px] text-white/40 truncate">
          {jogo.estrategia || "manual"} · {data}
        </div>
        <div className="flex items-center gap-2">
          {resultado && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              resultado.premiavel
                ? "bg-gold/20 text-gold border border-gold/40"
                : "bg-ink/60 text-white/60 border border-line"
            }`}>
              {resultado.pontos} pts
            </span>
          )}
          <button
            onClick={onRemover}
            className="text-white/40 active:text-red-400 active:scale-95"
            aria-label="Remover"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {jogo.dezenas.map(n => {
          const acertou = acertSet?.has(n);
          return (
            <span
              key={n}
              className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                acertou === true
                  ? "bg-gradient-to-br from-gold to-amber-500 text-ink"
                  : acertou === false
                  ? "bg-ink/60 border border-line text-white/40 line-through"
                  : "bg-gradient-to-br from-accent/80 to-indigo-700 text-white"
              }`}
            >
              {String(n).padStart(2, "0")}
            </span>
          );
        })}
      </div>
      {resultado && resultado.premiavel && (
        <div className="flex items-center gap-1 mt-1.5 text-xs text-gold">
          <Check size={12} /> Premiável
        </div>
      )}
    </div>
  );
}
