import React, { useMemo, useState } from "react";
import { Plane, Search, Bell, Trash2, TrendingDown, RefreshCw, ArrowRightLeft } from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid, fmt } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";
import Modal from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";
import {
  AEROPORTOS, nomeCia, simplificarOfertas, aplicarFiltros,
  analisarTendencias, registrarChecagem, fmtDuracao,
} from "../../lib/voos.js";

const HOJE = () => new Date().toISOString().slice(0, 10);
const HORARIOS_OPCOES = ["08:00", "12:00", "16:00", "20:00"];

const inputSty = { fontSize: 13, padding: "8px 10px", border: `1px solid ${T.border}`, borderRadius: 12, background: T.bg, color: T.ink, width: "100%", boxSizing: "border-box" };

function nomeAeroporto(code) {
  return AEROPORTOS.find(a => a.code === (code || "").toUpperCase())?.nome || (code || "").toUpperCase();
}

const dataBR = (iso) => { try { return iso ? iso.split("-").reverse().join("/") : ""; } catch { return iso; } };
const diaBR = (isoDt) => { try { return (isoDt || "").slice(0, 10).split("-").reverse().slice(0, 2).join("/"); } catch { return ""; } };

// Linha de um itinerário (ida ou volta) com as PARADAS destacadas.
function LinhaItinerario({ it, rotulo }) {
  const direto = it.paradas === 0;
  return (
    <div style={{ fontSize: 12.5, color: T.ink, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: "3px 0" }}>
      {rotulo && <span style={{ fontSize: 10, color: T.faint, width: 34 }}>{rotulo}</span>}
      <strong>{it.segmentos[0]?.de}</strong> {it.horaSaida}
      <span style={{ color: T.muted }}>→</span>
      <strong>{it.segmentos[it.segmentos.length - 1]?.para}</strong> {it.horaChegada}
      <span style={{ fontSize: 11, color: T.muted }}>· {diaBR(it.saida)} · {fmtDuracao(it.duracaoMin)}</span>
      {direto ? (
        <span style={{ fontSize: 10, fontWeight: 700, color: T.green, background: `${T.green}18`, border: `1px solid ${T.green}55`, borderRadius: 100, padding: "1px 8px" }}>Direto</span>
      ) : (
        <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", background: "#f59e0b18", border: "1px solid #f59e0b55", borderRadius: 100, padding: "1px 8px" }}>
          {it.paradas} parada{it.paradas > 1 ? "s" : ""} · {it.escalas.map(e => `${fmtDuracao(e.esperaMin)} em ${e.aeroporto}`).join(" · ")}
        </span>
      )}
    </div>
  );
}

export default function Voos({ voos = { monitores: [] }, setVoos, apiKeys = {} }) {
  const creds = { key: apiKeys.amadeusKey, secret: apiKeys.amadeusSecret };
  const temChaves = !!(creds.key && creds.secret);

  // ---- Busca ----
  const [busca, setBusca] = useState({ origem: "GRU", destino: "LIS", dataIda: "", dataVolta: "", adultos: 1, semEscala: false });
  const [buscando, setBuscando] = useState(false);
  const [ofertas, setOfertas] = useState(null); // null = nunca buscou
  const [filtros, setFiltros] = useState({ semEscala: false, cias: [], janela: "" });
  const [monitorNovo, setMonitorNovo] = useState(null); // oferta escolhida p/ monitorar
  const [tendencia, setTendencia] = useState(null); // { monitor, dados|erro, carregando }

  const buscar = async () => {
    if (!temChaves) { toast.error("Configura as chaves grátis do Amadeus em Configurações → APIs."); return; }
    if (!busca.origem || !busca.destino || !busca.dataIda) { toast.error("Preenche origem, destino e data de ida."); return; }
    setBuscando(true);
    try {
      const { buscarVoos } = await import("../../lib/amadeus.js");
      const json = await buscarVoos(busca, creds);
      const lista = simplificarOfertas(json);
      setOfertas(lista);
      setFiltros({ semEscala: false, cias: [], janela: "" });
      if (!lista.length) toast.info("Nenhum voo achado pra essa rota/data (o plano grátis cobre as rotas principais).");
    } catch (e) {
      toast.error(e.message || "Erro na busca de voos.");
    } finally {
      setBuscando(false);
    }
  };

  const ciasDisponiveis = useMemo(() => Array.from(new Set((ofertas || []).flatMap(o => o.cias))), [ofertas]);
  const filtradas = useMemo(() => aplicarFiltros(ofertas || [], filtros), [ofertas, filtros]);

  // ---- Monitores ----
  const monitores = voos.monitores || [];
  const salvarMonitores = (novos) => setVoos(prev => ({ ...(prev || {}), monitores: novos }));

  const criarMonitor = (dados) => {
    salvarMonitores([...monitores, {
      id: uid(), criadoEm: new Date().toISOString(),
      origem: dados.origem, destino: dados.destino,
      dataIda: dados.dataIda, dataVolta: dados.dataVolta || "",
      adultos: dados.adultos || 1, semEscala: !!dados.semEscala,
      alvo: Number(dados.alvo) || 0,
      horariosChecagem: dados.horariosChecagem?.length ? dados.horariosChecagem : ["08:00", "20:00"],
      historico: dados.precoAtual ? [{ em: new Date().toISOString(), preco: dados.precoAtual }] : [],
      ultimoPreco: dados.precoAtual || 0, melhorPreco: dados.precoAtual || 0,
      ultimaChecagem: dados.precoAtual ? new Date().toISOString() : null,
    }]);
    toast.success("🔔 Monitor criado! Aviso quando o preço bater o alvo.");
  };

  const checarMonitor = async (m, { silencioso = false } = {}) => {
    if (!temChaves) { if (!silencioso) toast.error("Configura as chaves do Amadeus primeiro."); return; }
    try {
      const { buscarVoos } = await import("../../lib/amadeus.js");
      const json = await buscarVoos({ origem: m.origem, destino: m.destino, dataIda: m.dataIda, dataVolta: m.dataVolta, adultos: m.adultos, semEscala: m.semEscala, max: 5 }, creds);
      const melhor = simplificarOfertas(json)[0];
      if (!melhor) { if (!silencioso) toast.info(`${m.origem}→${m.destino}: nada encontrado agora.`); return; }
      const { monitor, atingiuAlvo } = registrarChecagem(m, melhor.preco);
      salvarMonitores((voos.monitores || []).map(x => x.id === m.id ? monitor : x));
      if (atingiuAlvo) toast.success(`🎯 ${m.origem}→${m.destino} bateu o alvo: ${fmt(melhor.preco)} (alvo ${fmt(m.alvo)})!`);
      else if (!silencioso) toast.success(`${m.origem}→${m.destino}: ${fmt(melhor.preco)} agora.`);
    } catch (e) {
      if (!silencioso) toast.error(e.message);
    }
  };

  // A checagem automática nos horários configurados roda no App (efeito
  // global, ao abrir e a cada 30min) — aqui só a manual do botão ↻.
  const excluirMonitor = async (m) => {
    const ok = await confirm({ title: `Parar de monitorar ${m.origem}→${m.destino}?`, confirmLabel: "Excluir", danger: true });
    if (ok) salvarMonitores(monitores.filter(x => x.id !== m.id));
  };

  const verTendencias = async (m) => {
    setTendencia({ monitor: m, carregando: true });
    try {
      const { calendarioPrecos } = await import("../../lib/amadeus.js");
      const json = await calendarioPrecos({ origem: m.origem, destino: m.destino, somenteIda: !m.dataVolta, semEscala: m.semEscala }, creds);
      setTendencia({ monitor: m, dados: analisarTendencias(json) });
    } catch (e) {
      setTendencia({ monitor: m, erro: e.message });
    }
  };

  const selSty = { ...inputSty, width: "auto" };

  return (
    <div className="fade-up py-8">
      <PageHeader eyebrow="Agenda" title="Voos" sub="Busca passagens, monitora o preço-alvo e mostra o mês mais barato — API grátis do Amadeus." />

      {!temChaves && (
        <div style={{ background: `${T.gold}12`, border: `1px solid ${T.gold}66`, borderRadius: 16, padding: "12px 16px", marginBottom: 16, fontSize: 12.5, color: T.ink }}>
          ✈️ Pra ativar: cria uma conta grátis em <strong>developers.amadeus.com</strong>, gera <strong>API Key + Secret</strong> e cola em <strong>Configurações → APIs</strong>. Leva 5 minutos e não tem custo.
        </div>
      )}

      {/* ---- BUSCA ---- */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <datalist id="aeroportos">
          {AEROPORTOS.map(a => <option key={a.code} value={a.code}>{a.nome}</option>)}
        </datalist>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 120px" }}>
            <label style={{ fontSize: 10.5, color: T.muted }}>Origem</label>
            <input list="aeroportos" value={busca.origem} onChange={e => setBusca(b => ({ ...b, origem: e.target.value.toUpperCase() }))} maxLength={3} style={inputSty} placeholder="GRU" />
          </div>
          <button onClick={() => setBusca(b => ({ ...b, origem: b.destino, destino: b.origem }))} title="Inverter"
            style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 12, padding: 8, cursor: "pointer", color: T.muted }}>
            <ArrowRightLeft size={14} />
          </button>
          <div style={{ flex: "1 1 120px" }}>
            <label style={{ fontSize: 10.5, color: T.muted }}>Destino</label>
            <input list="aeroportos" value={busca.destino} onChange={e => setBusca(b => ({ ...b, destino: e.target.value.toUpperCase() }))} maxLength={3} style={inputSty} placeholder="LIS" />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label style={{ fontSize: 10.5, color: T.muted }}>Ida</label>
            <input type="date" min={HOJE()} value={busca.dataIda} onChange={e => setBusca(b => ({ ...b, dataIda: e.target.value }))} style={inputSty} />
          </div>
          <div style={{ flex: "1 1 140px" }}>
            <label style={{ fontSize: 10.5, color: T.muted }}>Volta (opcional)</label>
            <input type="date" min={busca.dataIda || HOJE()} value={busca.dataVolta} onChange={e => setBusca(b => ({ ...b, dataVolta: e.target.value }))} style={inputSty} />
          </div>
          <div>
            <label style={{ fontSize: 10.5, color: T.muted }}>Adultos</label>
            <select value={busca.adultos} onChange={e => setBusca(b => ({ ...b, adultos: Number(e.target.value) }))} style={selSty}>
              {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.ink, paddingBottom: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={busca.semEscala} onChange={e => setBusca(b => ({ ...b, semEscala: e.target.checked }))} />
            Só voo direto
          </label>
          <button className="btn-gold" onClick={buscar} disabled={buscando} style={{ padding: "9px 18px" }}>
            {buscando ? "Buscando…" : <><Search size={13} className="inline mr-1" /> Buscar voos</>}
          </button>
        </div>
      </div>

      {/* ---- RESULTADOS ---- */}
      {ofertas !== null && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: T.muted, fontWeight: 700 }}>{filtradas.length} de {ofertas.length} voo(s)</span>
            <select value={filtros.janela} onChange={e => setFiltros(f => ({ ...f, janela: e.target.value }))} style={selSty}>
              <option value="">Saída · qualquer hora</option>
              <option value="manha">Manhã (5h–12h)</option>
              <option value="tarde">Tarde (12h–18h)</option>
              <option value="noite">Noite (18h–5h)</option>
            </select>
            <select value={filtros.cias[0] || ""} onChange={e => setFiltros(f => ({ ...f, cias: e.target.value ? [e.target.value] : [] }))} style={selSty}>
              <option value="">Todas as companhias</option>
              {ciasDisponiveis.map(c => <option key={c} value={c}>{nomeCia(c)}</option>)}
            </select>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.ink, cursor: "pointer" }}>
              <input type="checkbox" checked={filtros.semEscala} onChange={e => setFiltros(f => ({ ...f, semEscala: e.target.checked }))} />
              Sem escala
            </label>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtradas.map(o => (
              <div key={o.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "12px 14px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: "1 1 300px", minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, marginBottom: 3 }}>{o.ciasNomes.join(" + ")}</div>
                  {o.itinerarios.map((it, i) => (
                    <LinhaItinerario key={i} it={it} rotulo={o.itinerarios.length > 1 ? (i === 0 ? "IDA" : "VOLTA") : ""} />
                  ))}
                </div>
                <div style={{ textAlign: "right", marginLeft: "auto" }}>
                  <div className="num" style={{ fontSize: 18, fontWeight: 800, color: T.ink }}>{fmt(o.preco)}</div>
                  {o.assentosRestantes <= 4 && o.assentosRestantes > 0 && (
                    <div style={{ fontSize: 10, color: T.red }}>só {o.assentosRestantes} assento(s)</div>
                  )}
                  <button onClick={() => setMonitorNovo({ ...busca, precoAtual: o.preco, alvo: "", horariosChecagem: ["08:00", "20:00"] })}
                    style={{ marginTop: 4, fontSize: 11, fontWeight: 700, color: T.gold, background: `${T.gold}14`, border: `1px solid ${T.gold}66`, borderRadius: 100, padding: "4px 10px", cursor: "pointer" }}>
                    <Bell size={10} className="inline mr-1" /> Monitorar
                  </button>
                </div>
              </div>
            ))}
            {filtradas.length === 0 && <div style={{ padding: 20, textAlign: "center", color: T.muted, fontSize: 12.5 }}>Nenhum voo com esses filtros.</div>}
          </div>
        </div>
      )}

      {/* ---- MONITORES ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em" }}>
          🔔 Monitores de preço ({monitores.length})
        </div>
        <button onClick={() => setMonitorNovo({ ...busca, precoAtual: 0, alvo: "", horariosChecagem: ["08:00", "20:00"] })}
          style={{ fontSize: 11, color: T.gold, background: "none", border: `1px dashed ${T.gold}88`, borderRadius: 100, padding: "3px 10px", cursor: "pointer" }}>
          + Novo monitor
        </button>
      </div>
      {monitores.length === 0 ? (
        <p style={{ fontSize: 12.5, color: T.muted }}>Nenhum monitor. Busca um voo e toca em "Monitorar" — eu checo o preço nos horários que você escolher e aviso no sino 🔔 quando bater o alvo.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {monitores.map(m => {
            const bateu = m.alvo > 0 && m.ultimoPreco > 0 && m.ultimoPreco <= m.alvo;
            return (
              <div key={m.id} style={{ background: T.card, border: `1px solid ${bateu ? T.green : T.border}`, borderRadius: 16, padding: "12px 14px" }}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <Plane size={15} style={{ color: bateu ? T.green : T.gold }} />
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>
                      {m.origem} → {m.destino}
                      {bateu && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: T.green, background: `${T.green}18`, border: `1px solid ${T.green}55`, borderRadius: 100, padding: "1px 8px" }}>🎯 alvo atingido!</span>}
                    </div>
                    <div style={{ fontSize: 11, color: T.muted }}>
                      {dataBR(m.dataIda)}{m.dataVolta ? ` – ${dataBR(m.dataVolta)}` : " · só ida"} · {m.adultos} adulto(s){m.semEscala ? " · direto" : ""}
                      {" · checa às "}{(m.horariosChecagem || []).join(", ")}
                    </div>
                    <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>
                      Alvo <strong style={{ color: T.gold }}>{fmt(m.alvo)}</strong>
                      {m.ultimoPreco > 0 && <> · último <strong style={{ color: bateu ? T.green : T.ink }}>{fmt(m.ultimoPreco)}</strong></>}
                      {m.melhorPreco > 0 && m.melhorPreco !== m.ultimoPreco && <> · melhor {fmt(m.melhorPreco)}</>}
                      {m.ultimaChecagem && <> · {new Date(m.ultimaChecagem).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => checarMonitor(m)} title="Checar preço agora" className="btn-ghost" style={{ padding: "6px 10px" }}>
                      <RefreshCw size={13} />
                    </button>
                    <button onClick={() => verTendencias(m)} title="Mês mais barato / descontos" className="btn-ghost" style={{ padding: "6px 10px" }}>
                      <TrendingDown size={13} />
                    </button>
                    <button onClick={() => excluirMonitor(m)} title="Excluir monitor" style={{ background: "none", border: "none", color: T.red, cursor: "pointer", padding: 6 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- MODAL: novo monitor ---- */}
      {monitorNovo && (
        <Modal title="🔔 Monitorar preço" onClose={() => setMonitorNovo(null)}>
          <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 12 }}>
            {monitorNovo.origem} → {monitorNovo.destino} · {dataBR(monitorNovo.dataIda)}{monitorNovo.dataVolta ? ` – ${dataBR(monitorNovo.dataVolta)}` : ""}
            {monitorNovo.precoAtual > 0 && <> · preço atual <strong>{fmt(monitorNovo.precoAtual)}</strong></>}
          </p>
          <Field label="Quero pagar até (R$)" hint="Quando o preço encostar nesse valor, aviso no sino e aqui.">
            <input type="number" min="0" step="50" autoFocus value={monitorNovo.alvo}
              onChange={e => setMonitorNovo(n => ({ ...n, alvo: e.target.value }))} placeholder="9000" />
          </Field>
          <div style={{ margin: "12px 0" }}>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 6 }}>Checar o preço nestes horários (quando o app abrir depois deles):</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {HORARIOS_OPCOES.map(h => {
                const on = monitorNovo.horariosChecagem.includes(h);
                return (
                  <button key={h} onClick={() => setMonitorNovo(n => ({
                    ...n, horariosChecagem: on ? n.horariosChecagem.filter(x => x !== h) : [...n.horariosChecagem, h].sort(),
                  }))}
                    style={{ fontSize: 12, fontWeight: 700, padding: "6px 12px", borderRadius: 100, cursor: "pointer",
                             background: on ? `${T.gold}18` : "transparent", color: on ? T.gold : T.muted,
                             border: `1px solid ${on ? T.gold : T.border}` }}>
                    {h}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-ghost" onClick={() => setMonitorNovo(null)}>Cancelar</button>
            <button className="btn-gold" onClick={() => {
              if (!(Number(monitorNovo.alvo) > 0)) { toast.error("Coloca o valor-alvo."); return; }
              if (!monitorNovo.dataIda) { toast.error("O monitor precisa da data de ida (faz a busca primeiro)."); return; }
              criarMonitor(monitorNovo);
              setMonitorNovo(null);
            }}>
              <Bell size={12} className="inline mr-1" /> Criar monitor
            </button>
          </div>
        </Modal>
      )}

      {/* ---- MODAL: tendências ---- */}
      {tendencia && (
        <Modal title={`📉 Tendências · ${tendencia.monitor.origem} → ${tendencia.monitor.destino}`} onClose={() => setTendencia(null)}>
          {tendencia.carregando && <p style={{ fontSize: 13, color: T.muted, padding: 12 }}>Consultando calendário de preços…</p>}
          {tendencia.erro && (
            <p style={{ fontSize: 12.5, color: T.muted, padding: 6 }}>
              Não rolou pra essa rota: {tendencia.erro}<br /><br />
              <span style={{ fontSize: 11.5 }}>O calendário do plano grátis cobre só parte das rotas — a busca normal e o monitor continuam funcionando.</span>
            </p>
          )}
          {tendencia.dados && (
            tendencia.dados.meses.length === 0 ? (
              <p style={{ fontSize: 12.5, color: T.muted }}>Sem dados de calendário pra essa rota.</p>
            ) : (
              <>
                <p style={{ fontSize: 12.5, color: T.ink, marginBottom: 10 }}>
                  Mês mais barato: <strong style={{ color: T.green }}>{tendencia.dados.maisBarato.rotulo}</strong> — {fmt(tendencia.dados.maisBarato.preco)}
                  {" "}(dia {dataBR(tendencia.dados.maisBarato.data)})
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {tendencia.dados.meses.map(m => {
                    const max = Math.max(...tendencia.dados.meses.map(x => x.preco));
                    const eMaisBarato = m.mes === tendencia.dados.maisBarato.mes;
                    return (
                      <div key={m.mes} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <span style={{ width: 46, color: eMaisBarato ? T.green : T.muted, fontWeight: eMaisBarato ? 700 : 500 }}>{m.rotulo}</span>
                        <div style={{ flex: 1, height: 10, background: T.border, borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ width: `${Math.round((m.preco / max) * 100)}%`, height: "100%", background: eMaisBarato ? T.green : T.gold, borderRadius: 99 }} />
                        </div>
                        <span className="num" style={{ width: 86, textAlign: "right", color: T.ink }}>{fmt(m.preco)}</span>
                        <span style={{ width: 44, textAlign: "right", fontSize: 11, color: m.descontoPct > 0 ? T.green : T.muted }}>
                          {m.descontoPct > 0 ? `-${m.descontoPct}%` : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: 10.5, color: T.faint, marginTop: 10 }}>% = desconto vs o preço mediano da rota. Fonte: Amadeus (plano grátis, preços indicativos).</p>
              </>
            )
          )}
        </Modal>
      )}
    </div>
  );
}
