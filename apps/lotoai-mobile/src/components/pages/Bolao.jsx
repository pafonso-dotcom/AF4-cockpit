import React, { useEffect, useMemo, useState } from "react";
import {
  Users, Plus, Trash2, ArrowLeft, Eye, Check, X,
  UserPlus, Wand2, Layers, Receipt, TrendingUp,
} from "lucide-react";
import Ball from "../ui/Ball.jsx";
import { gerarJogos } from "../../lib/generator.js";
import { gerarFechamentoCompleto, loadCoverings, matrizesPara, aplicarMatriz } from "../../lib/fechamentos.js";
import { scores as calcScores } from "../../lib/stats.js";
import {
  listarBoloes, salvarBolao, removerBolao, montarBolao,
  conferirBolao, calcularCotas, calcularCusto,
} from "../../lib/bolao.js";

export default function Bolao({ historico }) {
  const [view, setView] = useState("lista"); // lista | criar | detalhe
  const [boloes, setBoloes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecionado, setSelecionado] = useState(null);

  useEffect(() => { recarregar(); }, []);

  async function recarregar() {
    setLoading(true);
    setBoloes(await listarBoloes());
    setLoading(false);
  }

  async function onCriado(novo) {
    await salvarBolao(novo);
    await recarregar();
    setSelecionado(novo);
    setView("detalhe");
  }

  async function onRemover(id) {
    await removerBolao(id);
    await recarregar();
    if (selecionado?.id === id) { setSelecionado(null); setView("lista"); }
  }

  if (view === "criar") {
    return <CriarBolao historico={historico} onCriado={onCriado} onCancelar={() => setView("lista")} />;
  }
  if (view === "detalhe" && selecionado) {
    return (
      <DetalheBolao
        bolao={selecionado}
        historico={historico}
        onVoltar={() => setView("lista")}
        onRemover={() => onRemover(selecionado.id)}
        onAtualizar={async (b) => { await salvarBolao(b); setSelecionado(b); await recarregar(); }}
      />
    );
  }

  return (
    <div className="px-4 pt-4 pb-28 space-y-4">
      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-gold" />
            <h2 className="font-semibold">Meus bolões</h2>
          </div>
          <button onClick={() => setView("criar")} className="btn-gold !py-2 !px-3 text-sm flex items-center gap-1.5">
            <Plus size={14} /> Novo
          </button>
        </div>

        {loading && <p className="text-sm text-white/50 text-center py-6">Carregando…</p>}

        {!loading && !boloes.length && (
          <div className="text-center py-8">
            <Users className="mx-auto text-white/20 mb-3" size={48} />
            <p className="text-sm text-white/60 mb-1">Nenhum bolão ainda</p>
            <p className="text-[11px] text-white/40">Crie um pra dividir apostas e prêmios com a galera</p>
          </div>
        )}

        <div className="space-y-2">
          {boloes.map(b => (
            <BolaoCard key={b.id} bolao={b} onAbrir={() => { setSelecionado(b); setView("detalhe"); }} />
          ))}
        </div>
      </section>
    </div>
  );
}

function BolaoCard({ bolao, onAbrir }) {
  const { totalCotas } = calcularCotas(bolao.participantes);
  return (
    <button onClick={onAbrir} className="w-full text-left bg-ink/50 border border-line rounded-xl p-3 active:scale-[.98] transition">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold text-white truncate flex-1">{bolao.nome}</h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          bolao.status === "encerrado" ? "bg-white/10 text-white/50" : "bg-accent/20 text-accent border border-accent/40"
        }`}>
          {bolao.status === "encerrado" ? "ENCERRADO" : "ATIVO"}
        </span>
      </div>
      <div className="text-[11px] text-white/50 flex items-center gap-3 flex-wrap">
        <span>{bolao.participantes.length} {bolao.participantes.length === 1 ? "pessoa" : "pessoas"} · {totalCotas} cotas</span>
        <span>{bolao.jogos.length} {bolao.jogos.length === 1 ? "aposta" : "apostas"}</span>
        <span className="text-gold">R$ {bolao.custoTotal.toFixed(2)}</span>
        {bolao.concursoAlvo && <span>#{bolao.concursoAlvo}</span>}
      </div>
    </button>
  );
}

/* ============================================================
   CRIAR BOLÃO
   ============================================================ */

function CriarBolao({ historico, onCriado, onCancelar }) {
  const proximoConcurso = historico.length ? historico[historico.length - 1].numero + 1 : "";
  const [nome, setNome] = useState("");
  const [concursoAlvo, setConcursoAlvo] = useState(proximoConcurso);
  const [participantes, setParticipantes] = useState([{ id: 1, nome: "", cotas: 1 }]);
  const [estrategia, setEstrategia] = useState("ponderado"); // ponderado | fechamento
  const [qtdJogos, setQtdJogos] = useState(5);
  const [kFechamento, setKFechamento] = useState(16);
  const [matrizSel, setMatrizSel] = useState(null);
  const [coverings, setCoverings] = useState(null);
  const [erro, setErro] = useState("");
  const [criando, setCriando] = useState(false);

  useEffect(() => { loadCoverings().then(setCoverings); }, []);

  const matrizes = useMemo(() => matrizesPara(coverings, kFechamento), [coverings, kFechamento]);
  useEffect(() => { setMatrizSel(matrizes[0] || null); }, [matrizes]);

  function setPart(i, patch) {
    setParticipantes(prev => prev.map((p, idx) => idx === i ? { ...p, ...patch } : p));
  }
  function addPart() {
    setParticipantes(prev => [...prev, { id: Date.now(), nome: "", cotas: 1 }]);
  }
  function rmPart(i) {
    setParticipantes(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev);
  }

  // gera os jogos previstos (preview) para mostrar custo
  const jogosPreview = useMemo(() => {
    if (estrategia === "ponderado") {
      try {
        return gerarJogos({
          quantidade: qtdJogos,
          estrategia: "ponderado",
          historico: historico.map(c => c.dezenas),
        });
      } catch { return []; }
    }
    if (estrategia === "fechamento") {
      if (!historico.length) return [];
      try {
        const s = calcScores(historico.map(c => c.dezenas));
        const top = Object.entries(s)
          .sort((a, b) => b[1] - a[1])
          .slice(0, kFechamento)
          .map(([n]) => +n)
          .sort((a, b) => a - b);
        if (matrizSel) return aplicarMatriz(matrizSel.matriz, top);
        return gerarFechamentoCompleto(top);
      } catch { return []; }
    }
    return [];
  }, [estrategia, qtdJogos, kFechamento, matrizSel, historico]);

  const custoTotal = calcularCusto(jogosPreview);
  const { totalCotas } = calcularCotas(participantes);
  const custoPorCota = totalCotas ? +(custoTotal / totalCotas).toFixed(2) : 0;

  async function criar() {
    if (!nome.trim()) { setErro("dê um nome ao bolão"); return; }
    if (!participantes.some(p => p.nome.trim())) { setErro("inclua pelo menos uma pessoa"); return; }
    if (!jogosPreview.length) { setErro("estratégia não gerou nenhum jogo"); return; }
    setErro("");
    setCriando(true);
    const bolao = montarBolao({
      nome,
      concursoAlvo: Number(concursoAlvo) || null,
      jogos: jogosPreview,
      participantes: participantes.filter(p => p.nome.trim()).map(p => ({
        ...p,
        valorPago: +(p.cotas * custoPorCota).toFixed(2),
      })),
      estrategia: estrategia === "fechamento"
        ? `fechamento-${kFechamento}${matrizSel ? `-g${matrizSel.g}` : ""}`
        : "ponderado",
    });
    await onCriado(bolao);
    setCriando(false);
  }

  return (
    <div className="px-4 pt-4 pb-28 space-y-4">
      <button onClick={onCancelar} className="text-sm text-white/60 flex items-center gap-1 -ml-1">
        <ArrowLeft size={14} /> Voltar
      </button>

      <section className="card space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Users size={18} className="text-gold" /> Novo bolão
        </h2>

        <Field label="Nome">
          <input
            value={nome} onChange={e => setNome(e.target.value)}
            placeholder="Ex: Bolão da galera"
            className="w-full bg-ink/60 border border-line rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold outline-none"
          />
        </Field>

        <Field label="Concurso alvo">
          <input
            type="number" inputMode="numeric"
            value={concursoAlvo} onChange={e => setConcursoAlvo(e.target.value)}
            placeholder="próximo concurso"
            className="w-full bg-ink/60 border border-line rounded-lg px-3 py-2 text-sm text-white focus:border-gold outline-none"
          />
        </Field>
      </section>

      {/* Participantes */}
      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><UserPlus size={16} /> Participantes</h3>
          <button onClick={addPart} className="text-xs text-gold flex items-center gap-1 active:scale-95">
            <Plus size={12} /> adicionar
          </button>
        </div>
        <div className="space-y-2">
          {participantes.map((p, i) => (
            <div key={p.id} className="flex gap-2 items-center">
              <input
                value={p.nome} onChange={e => setPart(i, { nome: e.target.value })}
                placeholder="Nome"
                className="flex-1 bg-ink/60 border border-line rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold outline-none"
              />
              <input
                type="number" min={1} max={99}
                value={p.cotas} onChange={e => setPart(i, { cotas: +e.target.value || 1 })}
                className="w-16 bg-ink/60 border border-line rounded-lg px-2 py-2 text-sm text-white text-center focus:border-gold outline-none"
                aria-label="Cotas"
              />
              <button
                onClick={() => rmPart(i)}
                disabled={participantes.length === 1}
                className="text-white/40 active:text-red-400 disabled:opacity-30 p-1"
                aria-label="Remover"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-white/50 pt-1 border-t border-line">
          <span>Total de cotas: <b className="text-white">{totalCotas}</b></span>
          <span>Custo por cota: <b className="text-gold">R$ {custoPorCota.toFixed(2)}</b></span>
        </div>
      </section>

      {/* Estratégia */}
      <section className="card space-y-3">
        <h3 className="font-semibold">Estratégia</h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setEstrategia("ponderado")}
            className={`rounded-xl px-2 py-3 border text-left transition ${
              estrategia === "ponderado" ? "border-gold bg-gold/10" : "border-line bg-ink/40"
            }`}
          >
            <div className="text-sm font-semibold flex items-center gap-1.5"><Wand2 size={12} /> Gerar N jogos</div>
            <div className="text-[10px] text-white/50">IA ponderada</div>
          </button>
          <button
            onClick={() => setEstrategia("fechamento")}
            className={`rounded-xl px-2 py-3 border text-left transition ${
              estrategia === "fechamento" ? "border-gold bg-gold/10" : "border-line bg-ink/40"
            }`}
          >
            <div className="text-sm font-semibold flex items-center gap-1.5"><Layers size={12} /> Fechamento</div>
            <div className="text-[10px] text-white/50">Top-K mais frequentes</div>
          </button>
        </div>

        {estrategia === "ponderado" && (
          <Field label={`Quantidade · ${qtdJogos} jogo${qtdJogos > 1 ? "s" : ""}`}>
            <input
              type="range" min={1} max={30} value={qtdJogos}
              onChange={e => setQtdJogos(+e.target.value)}
              className="w-full accent-gold"
            />
          </Field>
        )}

        {estrategia === "fechamento" && (
          <>
            <Field label={`Dezenas-base · ${kFechamento}`}>
              <input
                type="range" min={15} max={19} value={kFechamento}
                onChange={e => setKFechamento(+e.target.value)}
                className="w-full accent-gold"
              />
            </Field>
            {matrizes.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-white/40 mb-1.5">Matriz de garantia</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {matrizes.map(m => (
                    <button
                      key={m.g}
                      onClick={() => setMatrizSel(m)}
                      className={`rounded-lg px-2 py-1.5 border text-center ${
                        matrizSel?.g === m.g ? "border-gold bg-gold/10" : "border-line bg-ink/40"
                      }`}
                    >
                      <div className="text-sm font-bold text-gold">{m.g} pts</div>
                      <div className="text-[10px] text-white/60">{m.apostas} apostas</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-line">
          <Stat label="Apostas" value={jogosPreview.length} />
          <Stat label="Custo total" value={`R$ ${custoTotal.toFixed(2)}`} tone="gold" />
          <Stat label="Por cota" value={`R$ ${custoPorCota.toFixed(2)}`} />
        </div>
      </section>

      {erro && <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/40 rounded-lg p-2">{erro}</div>}

      <button
        onClick={criar}
        disabled={criando || !jogosPreview.length}
        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Users size={16} /> {criando ? "Criando…" : "Criar bolão"}
      </button>
    </div>
  );
}

/* ============================================================
   DETALHE DO BOLÃO
   ============================================================ */

function DetalheBolao({ bolao, historico, onVoltar, onRemover, onAtualizar }) {
  const concurso = useMemo(() => {
    if (!bolao.concursoAlvo) return null;
    return historico.find(c => c.numero === bolao.concursoAlvo) || null;
  }, [bolao.concursoAlvo, historico]);

  const resultado = useMemo(() => {
    if (!concurso) return null;
    return conferirBolao(bolao, concurso.dezenas);
  }, [bolao, concurso]);

  async function encerrar() {
    await onAtualizar({
      ...bolao,
      status: "encerrado",
      resultado: resultado ? { ...resultado, concurso: concurso.numero } : null,
    });
  }

  return (
    <div className="px-4 pt-4 pb-28 space-y-4">
      <button onClick={onVoltar} className="text-sm text-white/60 flex items-center gap-1 -ml-1">
        <ArrowLeft size={14} /> Voltar
      </button>

      <section className="card space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-bold text-lg">{bolao.nome}</h2>
            <div className="text-[11px] text-white/50">
              {bolao.estrategia} · concurso alvo {bolao.concursoAlvo ? `#${bolao.concursoAlvo}` : "—"}
            </div>
          </div>
          <button onClick={onRemover} className="text-white/40 active:text-red-400 p-1" aria-label="Remover">
            <Trash2 size={14} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <Stat label="Apostas" value={bolao.jogos.length} />
          <Stat label="Participantes" value={bolao.participantes.length} />
          <Stat label="Custo total" value={`R$ ${bolao.custoTotal.toFixed(2)}`} tone="gold" />
        </div>
      </section>

      {/* Resultado */}
      {concurso ? (
        <section className="card space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Eye size={16} /> Resultado · #{concurso.numero}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {concurso.dezenas.map(n => <Ball key={n} n={n} size="sm" highlight />)}
          </div>
          {resultado && (
            <>
              <div className="grid grid-cols-5 gap-1 text-center text-xs">
                {[15, 14, 13, 12, 11].map(k => (
                  <div key={k} className="bg-panel border border-line rounded-lg py-1.5">
                    <div className="text-[10px] text-white/40">{k} pts</div>
                    <div className="font-bold text-gold">{resultado.dist[k] || 0}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Prêmio total" value={`R$ ${resultado.premioTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} tone="gold" />
                <Stat label="Por cota" value={`R$ ${resultado.premioPorCota.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} tone={resultado.premioPorCota > 0 ? "gold" : "neutral"} />
              </div>
              {resultado.premiavel && bolao.status !== "encerrado" && (
                <button onClick={encerrar} className="btn-gold w-full text-sm">Encerrar bolão</button>
              )}
            </>
          )}
        </section>
      ) : (
        <section className="card">
          <p className="text-xs text-white/50 text-center py-2">
            Aguardando concurso #{bolao.concursoAlvo} · ele ainda não foi sorteado.
          </p>
        </section>
      )}

      {/* Distribuição */}
      <section className="card">
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          <TrendingUp size={16} /> Distribuição
        </h3>
        <div className="space-y-1.5">
          {(resultado?.distribuicao || bolao.participantes.map(p => ({ ...p, custo: 0, premio: 0, lucro: 0 }))).map(p => (
            <div key={p.id} className="flex items-center justify-between bg-ink/40 rounded-lg px-3 py-2 text-sm">
              <div className="flex-1">
                <div className="font-medium">{p.nome}</div>
                <div className="text-[11px] text-white/50">{p.cotas} cota{p.cotas > 1 ? "s" : ""}</div>
              </div>
              <div className="text-right text-xs">
                {resultado ? (
                  <>
                    <div className={`font-bold ${p.lucro > 0 ? "text-green-400" : p.lucro < 0 ? "text-red-400" : "text-white"}`}>
                      {p.lucro > 0 ? "+" : ""}R$ {p.lucro.toFixed(2)}
                    </div>
                    <div className="text-white/40">R$ {p.premio.toFixed(2)} − R$ {p.custo.toFixed(2)}</div>
                  </>
                ) : (
                  <div className="text-white/60">R$ {p.valorPago?.toFixed(2) || "0.00"} pago</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Apostas */}
      <section className="card">
        <details>
          <summary className="cursor-pointer text-sm font-semibold flex items-center gap-2">
            <Receipt size={14} /> Apostas ({bolao.jogos.length})
          </summary>
          <div className="space-y-2 mt-3">
            {bolao.jogos.slice(0, 30).map((j, i) => {
              const setSorteio = concurso ? new Set(concurso.dezenas) : null;
              return (
                <div key={i} className="bg-ink/50 border border-line rounded-lg p-2">
                  <div className="text-[10px] text-white/40 mb-1 flex justify-between">
                    <span>Aposta {i + 1}</span>
                    {resultado && <span className="text-gold font-bold">{resultado.pontos[i]} pts</span>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {j.map(n => {
                      const acertou = setSorteio?.has(n);
                      return (
                        <span
                          key={n}
                          className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${
                            acertou === true
                              ? "bg-gradient-to-br from-gold to-amber-500 text-ink"
                              : acertou === false
                              ? "bg-ink/60 border border-line text-white/40"
                              : "bg-gradient-to-br from-accent/80 to-indigo-700 text-white"
                          }`}
                        >
                          {String(n).padStart(2, "0")}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {bolao.jogos.length > 30 && (
              <div className="text-[11px] text-white/40 text-center">… e mais {bolao.jogos.length - 30} apostas</div>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}

/* ---------- helpers UI ---------- */

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-white/40 block mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }) {
  const color =
    tone === "gold" ? "text-gold"
    : tone === "red" ? "text-red-400"
    : "text-white";
  return (
    <div className="bg-ink/60 border border-line rounded-xl py-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className={`font-bold ${color}`}>{value}</div>
    </div>
  );
}
