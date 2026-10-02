import React, { useMemo, useState } from "react";
import { useDolar, useEuro } from "../../lib/useDolar.js";
import { resumoOrcamento, duracaoViagem } from "../../lib/orcamentoViagem.js";
import ViagemOrcamento from "./ViagemOrcamento.jsx";
import { linksBuscaVoos, salvarOrigemPadrao, origemPadrao } from "../../lib/buscaVoos.js";
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

export default function Voos({ voos = { monitores: [] }, setVoos, apiKeys = {}, viagens = [], setViagens }) {
  const [vForm, setVForm] = useState({ titulo: "", destino: "", inicio: "", fim: "" });
  const [orcViagemId, setOrcViagemId] = useState(null); // ficha de orçamento aberta
  const usd = useDolar(), eur = useEuro();
  const cambio = useMemo(() => ({ USD: usd, EUR: eur }), [usd, eur]);
  const creds = { key: apiKeys.amadeusKey, secret: apiKeys.amadeusSecret };
  const temChaves = !!(creds.key && creds.secret);

  // ---- Busca ----
  const [busca, setBusca] = useState({ origem: origemPadrao(), destino: "LIS", dataIda: "", dataVolta: "", adultos: 1, semEscala: false });
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
      <PageHeader eyebrow="Agenda" title="Voos" sub="Pesquise passagens com preço real (sem reserva, só busca) e organize o orçamento das viagens." />


      {/* ---- BUSCA ---- */}
      <div className="card-vivo" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
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
          {temChaves && (
            <button className="btn-ghost" onClick={buscar} disabled={buscando} style={{ padding: "9px 14px" }} title="Busca dentro do app pela API Amadeus">
              {buscando ? "Buscando…" : <><Search size={13} className="inline mr-1" /> No app (Amadeus)</>}
            </button>
          )}
        </div>
        {/* Busca SEM cadastro (2026-10-02): abre a pesquisa pronta nos buscadores — só busca, sem reserva. */}
        {(() => {
          const links = linksBuscaVoos({ origem: busca.origem, destino: busca.destino, ida: busca.dataIda, volta: busca.dataVolta, adultos: busca.adultos });
          const pronto = !!busca.destino;
          return (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 14 }}>
              <span style={{ fontSize: 12, color: T.muted, fontWeight: 700 }}>🔎 Pesquisar preços reais em:</span>
              {links.map(l => (
                <a key={l.id} href={pronto ? l.url : undefined} target="_blank" rel="noopener noreferrer"
                   onClick={(e) => { if (!pronto) { e.preventDefault(); toast.info("Preencha pelo menos o destino."); } else salvarOrigemPadrao(busca.origem); }}
                   className={l.id === "google" ? "btn-gold" : "btn-ghost"}
                   style={{ padding: "8px 14px", fontSize: 11.5, textDecoration: "none", opacity: pronto ? 1 : 0.55 }}>
                  {l.nome} ↗
                </a>
              ))}
              {pronto && links.length === 1 && <span style={{ fontSize: 11, color: T.faint }}>Skyscanner e Kayak aparecem com códigos de 3 letras (ex.: GRU → LIS) e data de ida.</span>}
            </div>
          );
        })()}
        <div style={{ fontSize: 11, color: T.faint, marginTop: 8 }}>O app não faz reserva: abre a busca no site, você compara e anota o preço no orçamento da viagem.</div>
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
              <div className="card-vivo" key={o.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "12px 14px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
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
              <div className="card-vivo" key={m.id} style={{ background: T.card, border: `1px solid ${bateu ? T.green : T.border}`, borderRadius: 16, padding: "12px 14px" }}>
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

      {/* ============================================================
          🗓 VIAGENS & EXCURSÕES (2026-09-30): programa as viagens num
          calendário visual (mês atual + próximo) + lista com contagem
          regressiva. Coleção própria sincronizada (viagens[]).
          ============================================================ */}
      {setViagens && (() => {
        const hojeISO = new Date().toISOString().slice(0, 10);
        const ordenadas = [...(viagens || [])].sort((a, b) => String(a.inicio || "").localeCompare(String(b.inicio || "")));
        const CORES = ["#5aa477", "#7aa0c4", "#c9a96b", "#b58fce", "#d96d7a", "#6fa8c9"];
        const corDe = (id) => CORES[Math.abs(String(id).split("").reduce((h, c) => h * 31 + c.charCodeAt(0), 7)) % CORES.length];
        const cobre = (v, iso) => v.inicio && iso >= v.inicio && iso <= (v.fim || v.inicio);
        const Mes = ({ ano, mes /* 1-12 */ }) => {
          const nome = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][mes - 1];
          const primeiro = new Date(ano, mes - 1, 1);
          const dias = new Date(ano, mes, 0).getDate();
          const offset = primeiro.getDay();
          const celulas = [];
          for (let i = 0; i < offset; i++) celulas.push(null);
          for (let d = 1; d <= dias; d++) celulas.push(d);
          return (
            <div className="card-vivo" style={{ flex: "1 1 260px", minWidth: 240, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.ink, marginBottom: 8, textTransform: "capitalize" }}>{nome} {ano}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, fontSize: 10, color: T.faint, textAlign: "center", marginBottom: 4 }}>
                {["D","S","T","Q","Q","S","S"].map((d, i) => <span key={i}>{d}</span>)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
                {celulas.map((d, i) => {
                  if (!d) return <span key={i} />;
                  const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const vs = ordenadas.filter(v => cobre(v, iso));
                  const ehHoje = iso === hojeISO;
                  const cor = vs.length ? corDe(vs[0].id) : null;
                  return (
                    <span key={i} title={vs.map(v => `✈️ ${v.titulo}${v.destino ? ` · ${v.destino}` : ""}`).join("\n")}
                          style={{
                            textAlign: "center", fontSize: 11, padding: "4px 0", borderRadius: 8,
                            background: cor ? `${cor}33` : "transparent",
                            border: ehHoje ? `1.5px solid ${T.gold}` : `1px solid transparent`,
                            color: cor ? T.ink : T.muted, fontWeight: cor ? 700 : 400,
                          }}>
                      {d}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        };
        const agora = new Date();
        const prox = new Date(agora.getFullYear(), agora.getMonth() + 1, 1);
        const addViagem = () => {
          const t = (vForm.titulo || "").trim();
          if (!t || !vForm.inicio) { toast.error("Preencha o nome e a data de início."); return; }
          setViagens([...(viagens || []), {
            id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
            titulo: t, destino: (vForm.destino || "").trim(),
            inicio: vForm.inicio, fim: vForm.fim || vForm.inicio,
          }]);
          setVForm({ titulo: "", destino: "", inicio: "", fim: "" });
          toast.success(`✈️ "${t}" programada!`);
        };
        const viagemOrc = (viagens || []).find(x => x.id === orcViagemId);
        return (
          <div style={{ marginTop: 26 }}>
            {viagemOrc && (
              <ViagemOrcamento viagem={viagemOrc} cambio={cambio} onClose={() => setOrcViagemId(null)}
                               onSalvar={(orc) => setViagens(prev => (prev || []).map(x => x.id === viagemOrc.id ? { ...x, orcamento: orc } : x))} />
            )}
            <div className="label-eyebrow" style={{ marginBottom: 10 }}>🗓 Viagens & excursões programadas</div>
            {/* form */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
              <input value={vForm.titulo} onChange={e => setVForm(f => ({ ...f, titulo: e.target.value }))}
                     placeholder="Viagem/Excursão (ex.: Lisboa em família)"
                     style={{ flex: "2 1 180px", minWidth: 150, padding: "8px 11px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.bgSoft, color: T.ink, fontSize: 12.5 }} />
              <input value={vForm.destino} onChange={e => setVForm(f => ({ ...f, destino: e.target.value }))}
                     placeholder="Destino (opcional)"
                     style={{ flex: "1 1 110px", minWidth: 100, padding: "8px 11px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.bgSoft, color: T.ink, fontSize: 12.5 }} />
              <input type="date" value={vForm.inicio} onChange={e => setVForm(f => ({ ...f, inicio: e.target.value }))}
                     title="Início" style={{ flex: "0 0 150px", width: 150, padding: "7px 9px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.bgSoft, color: T.ink, fontSize: 12 }} />
              <input type="date" value={vForm.fim} onChange={e => setVForm(f => ({ ...f, fim: e.target.value }))}
                     title="Fim (opcional)" style={{ flex: "0 0 150px", width: 150, padding: "7px 9px", borderRadius: 12, border: `1px solid ${T.border}`, background: T.bgSoft, color: T.ink, fontSize: 12 }} />
              <button onClick={addViagem} className="btn-gold" style={{ padding: "8px 14px", fontSize: 11 }}>+ Programar</button>
            </div>
            {/* calendários: mês atual + próximo */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <Mes ano={agora.getFullYear()} mes={agora.getMonth() + 1} />
              <Mes ano={prox.getFullYear()} mes={prox.getMonth() + 1} />
            </div>
            {/* lista com contagem regressiva */}
            {ordenadas.length === 0 ? (
              <div style={{ padding: 18, textAlign: "center", color: T.muted, fontStyle: "italic", border: `1px dashed ${T.border}`, borderRadius: 12 }}>
                Nenhuma viagem programada — adiciona a primeira acima. ✈️
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {ordenadas.map(v => {
                  const fim = v.fim || v.inicio;
                  const dias = Math.ceil((new Date(v.inicio + "T00:00:00") - new Date(hojeISO + "T00:00:00")) / 86400000);
                  const status = fim < hojeISO ? { t: "concluída", c: T.faint }
                    : v.inicio <= hojeISO ? { t: "✈️ EM VIAGEM", c: T.green }
                    : { t: `faltam ${dias} dia${dias === 1 ? "" : "s"}`, c: dias <= 7 ? T.gold : T.muted };
                  const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
                  return (
                    <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: T.card, border: `1px solid ${T.border}`, borderLeft: `3px solid ${corDe(v.id)}`, borderRadius: 12, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: T.ink }}>{v.titulo}</span>
                      {v.destino && <span style={{ fontSize: 11.5, color: T.muted }}>📍 {v.destino}</span>}
                      <span className="num" style={{ fontSize: 11.5, color: T.muted }}>{br(v.inicio)}{fim !== v.inicio ? ` → ${br(fim)}` : ""}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: status.c }}>{status.t}</span>
                      {(() => {
                        const r = resumoOrcamento(v.orcamento, cambio, duracaoViagem(v));
                        const tem = r.total > 0;
                        return (
                          <button onClick={() => setOrcViagemId(v.id)} title="Orçamento da viagem"
                                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 99, cursor: "pointer", fontSize: 11.5, fontWeight: 700,
                                           border: `1px solid ${tem ? T.gold : T.border}`, background: tem ? `${T.gold}14` : "transparent", color: tem ? T.ink : T.muted }}>
                            💰 {tem ? <span className="num">{fmt(r.previsto)}{r.milhas ? ` + ${Math.round(r.milhas / 1000)} mil milhas` : ""}</span> : "Orçamento"}
                            {tem && r.previsto > 0 && (
                              <span style={{ width: 36, height: 4, borderRadius: 99, background: T.bgSoft, overflow: "hidden", display: "inline-block" }}>
                                <span style={{ display: "block", width: `${r.pctPago}%`, height: "100%", background: T.green }} />
                              </span>
                            )}
                          </button>
                        );
                      })()}
                      <button onClick={() => setViagens((viagens || []).filter(x => x.id !== v.id))} title="Excluir viagem"
                              style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer", padding: 4 }}>🗑</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
