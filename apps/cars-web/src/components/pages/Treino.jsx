import React, { useMemo, useState, useEffect } from "react";
import {
  Dumbbell, Plus, Check, Edit3, Trash2, ChevronLeft, ChevronRight,
  Sparkles, X, Save, Bike, Zap, Trophy, TrendingUp, TrendingDown, Minus,
  Image as ImageIcon,
} from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid, todayISO } from "../../lib/format.js";
import { carregarCatalogo, equipamentoPT } from "../../lib/exercicioCatalogo.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";
import Modal from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";

const MODALIDADE_COR = {
  musculacao: "#f87171",
  corrida: "#34d399",
  ciclismo: "#60a5fa",
};

const MODALIDADE_ICON = {
  musculacao: Dumbbell,
  corrida: Zap,
  ciclismo: Bike,
};

const MODALIDADE_LABEL = {
  musculacao: "Musculação",
  corrida: "Corrida",
  ciclismo: "Ciclismo",
};

function miniCalendario(mesOffset, treinos) {
  const hoje = new Date();
  const ref = new Date(hoje.getFullYear(), hoje.getMonth() + mesOffset, 1);
  const ano = ref.getFullYear();
  const mes = ref.getMonth();
  const label = ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const totalDias = new Date(ano, mes + 1, 0).getDate();

  const treinosPorDia = {};
  treinos.filter(t => {
    const d = new Date(t.data + "T00:00");
    return d.getFullYear() === ano && d.getMonth() === mes;
  }).forEach(t => {
    const dia = Number(t.data.slice(8));
    if (!treinosPorDia[dia]) treinosPorDia[dia] = [];
    treinosPorDia[dia].push(t);
  });

  return { label, primeiroDia, totalDias, treinosPorDia, ano, mes };
}

// 1RM estimado (fórmula de Epley): carga * (1 + reps/30).
const estimar1RM = (carga, reps) => Math.round((Number(carga) || 0) * (1 + (Number(reps) || 0) / 30));

const dataCurta = (iso) => {
  try { return new Date(iso + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); }
  catch { return iso; }
};

// Recordes pessoais (PRs) e progressão de carga, derivados do histórico de treinos.
// Só musculação (onde a carga importa). Para cada exercício: maior carga (peso ×
// reps + data), 1RM estimado, e a série de carga máxima por sessão (progressão).
function calcRecordes(treinos, exerciciosDB) {
  const nomeDe = (id) => exerciciosDB.find(e => e.id === id)?.nome || "Exercício";
  const sorted = [...treinos].sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  const porEx = {};
  sorted.forEach(s => {
    if (s.modalidade && s.modalidade !== "musculacao") return;
    (s.exerciciosFeitos || []).forEach(ef => {
      const series = (ef.series || []).filter(se => (Number(se.carga) || 0) > 0);
      if (!series.length) return;
      const exId = ef.exercicioId;
      const r = porEx[exId] || (porEx[exId] = { exId, nome: nomeDe(exId), prCarga: 0, prReps: 0, prData: null, e1rm: 0, sessoes: [] });
      let maxCargaSessao = 0;
      series.forEach(se => {
        const c = Number(se.carga) || 0, reps = Number(se.reps) || 0;
        if (c > maxCargaSessao) maxCargaSessao = c;
        const e1 = estimar1RM(c, reps);
        if (e1 > r.e1rm) r.e1rm = e1;
        if (c > r.prCarga) { r.prCarga = c; r.prReps = reps; r.prData = s.data; }
      });
      r.sessoes.push({ data: s.data, maxCarga: maxCargaSessao });
    });
  });
  return Object.values(porEx)
    .filter(r => r.prCarga > 0)
    .map(r => {
      const n = r.sessoes.length;
      const atual = r.sessoes[n - 1]?.maxCarga || 0;
      const anterior = n > 1 ? r.sessoes[n - 2]?.maxCarga || 0 : null;
      const delta = anterior != null ? atual - anterior : 0;
      const novoPR = atual >= r.prCarga && r.sessoes[n - 1]?.data === r.prData;
      return { ...r, atual, anterior, delta, novoPR };
    })
    .sort((a, b) => b.prCarga - a.prCarga);
}

// Mini gráfico de barras da progressão de carga (últimas N sessões).
function Sparkline({ valores, cor }) {
  const vals = valores.slice(-8);
  const max = Math.max(...vals, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 28 }}>
      {vals.map((v, i) => (
        <div key={i} title={`${v} kg`} style={{
          width: 6, height: `${Math.max(10, (v / max) * 100)}%`,
          background: i === vals.length - 1 ? cor : `${cor}66`, borderRadius: 1,
        }} />
      ))}
    </div>
  );
}

function RecordeCard({ r, cor }) {
  const TrendIcon = r.delta > 0 ? TrendingUp : r.delta < 0 ? TrendingDown : Minus;
  const trendCor = r.delta > 0 ? "#34d399" : r.delta < 0 ? "#f87171" : T.muted;
  return (
    <div style={{
      background: T.card, border: `1px solid ${r.novoPR ? `${T.gold}66` : T.border}`,
      borderLeft: `3px solid ${cor}`, borderRadius: 14, padding: "10px 14px",
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
    }}>
      <div style={{ flex: "1 1 160px", minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, display: "flex", alignItems: "center", gap: 6 }}>
          {r.nome}
          {r.novoPR && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, fontWeight: 700, color: T.gold, background: `${T.gold}1a`, padding: "1px 6px", borderRadius: 100 }}>
              <Trophy size={10} /> novo PR
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
          PR <strong style={{ color: T.ink }}>{r.prCarga} kg</strong> × {r.prReps} · {dataCurta(r.prData)} · 1RM est. {r.e1rm} kg
        </div>
      </div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: trendCor, fontWeight: 600, flexShrink: 0 }}>
        <TrendIcon size={14} />
        {r.atual} kg
        {r.anterior != null && r.delta !== 0 && (
          <span style={{ fontSize: 10, opacity: .8 }}>({r.delta > 0 ? "+" : ""}{r.delta})</span>
        )}
      </div>
      <Sparkline valores={r.sessoes.map(s => s.maxCarga)} cor={cor} />
    </div>
  );
}

// Comprime uma imagem (foto da câmera/galeria) pra um JPEG pequeno (data-URI),
// pra não pesar a sincronização dos dados. Redimensiona pro maior lado = maxDim.
function comprimirImagem(file, maxDim = 360, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const im = new window.Image();
      im.onload = () => {
        let { width, height } = im;
        if (width >= height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(im, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      im.onerror = reject;
      im.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Miniatura + editor da imagem de execução de um exercício (banco de imagens).
// A imagem fica no exercício (exerciciosDB), então aparece em toda sessão/template
// que use esse exercício. Aceita link (URL) ou foto (comprimida).
function ExImagem({ exercicio, setExerciciosDB, size = 38 }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(exercicio?.imagem || "");
  if (!exercicio || !setExerciciosDB) return null;
  const img = exercicio.imagem;
  const salvar = (valor) => {
    setExerciciosDB(prev => (prev || []).map(e => e.id === exercicio.id ? { ...e, imagem: valor || "" } : e));
  };
  const onFile = async (file) => {
    if (!file) return;
    try {
      const dataUri = await comprimirImagem(file);
      salvar(dataUri); setUrl(dataUri); setOpen(false);
      toast.success("Imagem do exercício salva.");
    } catch { toast.error("Não consegui processar a imagem."); }
  };
  return (
    <>
      <button onClick={(e) => { e.stopPropagation(); setOpen(true); }} title="Imagem de execução"
        style={{
          width: size, height: size, borderRadius: 14, flexShrink: 0, padding: 0, overflow: "hidden",
          border: `1px ${img ? "solid" : "dashed"} ${T.border}`, background: T.bg, cursor: "pointer",
          display: "grid", placeItems: "center",
        }}>
        {img ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
             : <ImageIcon size={16} style={{ color: T.muted }} />}
      </button>
      {open && (
        <Modal title={`Imagem · ${exercicio.nome || "exercício"}`} onClose={() => setOpen(false)}>
          {img && <img src={img} alt="" style={{ width: "100%", maxHeight: 240, objectFit: "contain", borderRadius: 14, marginBottom: 12, background: T.bgSoft }} />}
          <Field label="Link da imagem/GIF (URL)" hint="Cole o endereço de uma figura/animação de execução.">
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
          </Field>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button className="btn-gold" onClick={() => { salvar(url.trim()); setOpen(false); }}>Usar link</button>
            <label className="btn-ghost" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
              📷 Subir foto
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => onFile(e.target.files?.[0])} />
            </label>
            {img && <button className="btn-ghost" onClick={() => { salvar(""); setUrl(""); setOpen(false); }}>Remover</button>}
          </div>
        </Modal>
      )}
    </>
  );
}

export default function Treino({ treinos = [], setTreinos, exerciciosDB = [], setExerciciosDB, treinoTemplates = [], setTreinoTemplates, apiKeys = {} }) {
  const [mesOffset, setMesOffset] = useState(0);
  const [sessaoModal, setSessaoModal] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [bancoModal, setBancoModal] = useState(false);
  const [iaModal, setIaModal] = useState(false);
  const [sessaoAtiva, setSessaoAtiva] = useState(null);
  const hoje = todayISO();

  const sessoesHoje = useMemo(() => treinos.filter(t => t.data === hoje), [treinos, hoje]);
  const ultimos = useMemo(() => [...treinos].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 10), [treinos]);
  const recordes = useMemo(() => calcRecordes(treinos, exerciciosDB), [treinos, exerciciosDB]);
  const cal = useMemo(() => miniCalendario(mesOffset, treinos), [mesOffset, treinos]);

  const iniciarTreino = (template) => {
    const sessao = {
      id: uid(),
      templateId: template?.id || null,
      data: hoje,
      modalidade: template?.modalidade || "musculacao",
      exerciciosFeitos: (template?.exercicios || []).map(e => ({
        exercicioId: e.exercicioId,
        series: Array.from({ length: e.series }, () => ({ reps: e.reps, carga: e.carga || 0, feita: false })),
      })),
      concluido: false,
      createdAt: new Date().toISOString(),
    };
    setTreinos(prev => [...prev, sessao]);
    setSessaoAtiva(sessao.id);
    setSessaoModal(false);
    toast.success("Treino iniciado!");
  };

  const iniciarSemTemplate = (modalidade) => {
    const sessao = {
      id: uid(), templateId: null, data: hoje, modalidade,
      exerciciosFeitos: [], concluido: false,
      createdAt: new Date().toISOString(),
    };
    setTreinos(prev => [...prev, sessao]);
    setSessaoAtiva(sessao.id);
    setSessaoModal(false);
    toast.success("Treino iniciado!");
  };

  const atualizarSessao = (sessaoId, novaData) => {
    setTreinos(prev => prev.map(s => s.id === sessaoId ? { ...s, ...novaData } : s));
  };

  const concluirSessao = (sessaoId) => {
    atualizarSessao(sessaoId, { concluido: true });
    setSessaoAtiva(null);
    toast.success("Treino concluído! 💪");
  };

  const excluirSessao = async (sessaoId) => {
    const ok = await confirm({ title: "Excluir este treino?", confirmLabel: "Excluir", danger: true });
    if (!ok) return;
    setTreinos(prev => prev.filter(s => s.id !== sessaoId));
    if (sessaoAtiva === sessaoId) setSessaoAtiva(null);
  };

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Agenda"
        title="Treino"
        sub="Musculação, corrida e ciclismo. Registre seus treinos e acompanhe a evolução."
        action={
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn-ghost" onClick={() => setBancoModal(true)}>Banco</button>
            <button className="btn-ghost" onClick={() => setTemplateModal(true)}>Templates</button>
            <button className="btn-gold" onClick={() => setSessaoModal(true)}>
              <Plus size={13} className="inline mr-1" /> Iniciar treino
            </button>
          </div>
        }
      />

      {/* Treino de Hoje */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
          Treino de Hoje
        </div>
        {sessoesHoje.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "32px 24px",
            background: T.card, border: `1px dashed ${T.border}`, borderRadius: 16,
          }}>
            <Dumbbell size={28} style={{ color: T.muted, marginBottom: 8 }} />
            <div style={{ fontSize: 13, color: T.muted }}>
              Sem treino hoje.{" "}
              <button onClick={() => setSessaoModal(true)}
                style={{ background: "none", border: "none", color: T.gold, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                Iniciar agora
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sessoesHoje.map(sessao => (
              <SessaoCard
                key={sessao.id}
                sessao={sessao}
                exerciciosDB={exerciciosDB}
                ativa={sessaoAtiva === sessao.id}
                onToggleAtiva={() => setSessaoAtiva(p => p === sessao.id ? null : sessao.id)}
                onAtualizar={(data) => atualizarSessao(sessao.id, data)}
                onConcluir={() => concluirSessao(sessao.id)}
                onExcluir={() => excluirSessao(sessao.id)}
                setExerciciosDB={setExerciciosDB}
              />
            ))}
          </div>
        )}
      </div>

      {/* Calendário */}
      <div style={{ marginBottom: 24, background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <button onClick={() => setMesOffset(o => o - 1)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.ink, textTransform: "capitalize" }}>{cal.label}</span>
          <button onClick={() => setMesOffset(o => o + 1)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer" }}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, textAlign: "center" }}>
          {["D","S","T","Q","Q","S","S"].map((d, i) => (
            <div key={i} style={{ fontSize: 9, color: T.faint, fontWeight: 700, paddingBottom: 4 }}>{d}</div>
          ))}
          {Array.from({ length: cal.primeiroDia }).map((_, i) => <div key={"e" + i} />)}
          {Array.from({ length: cal.totalDias }).map((_, i) => {
            const dia = i + 1;
            const sessoes = cal.treinosPorDia[dia] || [];
            const concluidos = sessoes.filter(s => s.concluido);
            const diaISO = `${cal.ano}-${String(cal.mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
            const ehHoje = diaISO === hoje;
            return (
              <div key={dia} style={{
                position: "relative", paddingBottom: 6,
                background: ehHoje ? `${T.gold}22` : "transparent",
                borderRadius: 4,
              }}>
                <div style={{ fontSize: 11, color: ehHoje ? T.gold : T.ink, fontWeight: ehHoje ? 700 : 400 }}>{dia}</div>
                {sessoes.length > 0 && (
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%", margin: "2px auto 0",
                    background: concluidos.length > 0 ? T.green : "#fbbf24",
                  }} />
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 10, fontSize: 10, color: T.muted }}>
          <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: T.green, marginRight: 4 }} />Concluído</span>
          <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#fbbf24", marginRight: 4 }} />Parcial</span>
        </div>
      </div>

      {/* Recordes & Progressão (PRs) — musculação */}
      {recordes.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Trophy size={12} style={{ color: T.gold }} /> Recordes & Progressão
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recordes.map(r => (
              <RecordeCard key={r.exId} r={r} cor={MODALIDADE_COR.musculacao} />
            ))}
          </div>
        </div>
      )}

      {/* Histórico */}
      {ultimos.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
            Histórico
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ultimos.map(s => {
              const cor = MODALIDADE_COR[s.modalidade] || T.gold;
              const Icon = MODALIDADE_ICON[s.modalidade] || Dumbbell;
              const template = treinoTemplates.find(t => t.id === s.templateId);
              return (
                <div key={s.id} style={{
                  background: T.card, border: `1px solid ${T.border}`,
                  borderLeft: `3px solid ${cor}`, borderRadius: 14,
                  padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
                }}>
                  <Icon size={16} style={{ color: cor, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
                      {template?.nome || MODALIDADE_LABEL[s.modalidade]}
                    </div>
                    <div style={{ fontSize: 11, color: T.muted }}>{s.data}</div>
                  </div>
                  {s.concluido
                    ? <span style={{ fontSize: 10, padding: "2px 6px", background: `${T.green}22`, color: T.green, borderRadius: 4, fontWeight: 700 }}>✓ Concluído</span>
                    : <span style={{ fontSize: 10, padding: "2px 6px", background: "#fbbf2422", color: "#fbbf24", borderRadius: 4, fontWeight: 700 }}>Parcial</span>
                  }
                  <button onClick={() => excluirSessao(s.id)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 4 }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Iniciar treino */}
      {sessaoModal && (
        <Modal title="Iniciar Treino" onClose={() => setSessaoModal(false)}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>
              Template existente
            </div>
            {treinoTemplates.length === 0 ? (
              <p style={{ fontSize: 12, color: T.muted }}>Nenhum template. Crie um abaixo ou use a IA.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {treinoTemplates.map(t => {
                  const cor = MODALIDADE_COR[t.modalidade] || T.gold;
                  return (
                    <button key={t.id} onClick={() => iniciarTreino(t)}
                      style={{
                        background: T.card, border: `1px solid ${cor}55`,
                        borderLeft: `3px solid ${cor}`, borderRadius: 14,
                        padding: "10px 14px", textAlign: "left", cursor: "pointer",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}>
                      <span style={{ fontWeight: 600, color: T.ink, fontSize: 13 }}>{t.nome}</span>
                      <span style={{ fontSize: 10, color: cor, fontWeight: 700 }}>{MODALIDADE_LABEL[t.modalidade]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>
              Iniciar do zero
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["musculacao", "corrida", "ciclismo"].map(m => {
                const cor = MODALIDADE_COR[m];
                const Icon = MODALIDADE_ICON[m];
                return (
                  <button key={m} onClick={() => iniciarSemTemplate(m)}
                    style={{
                      flex: 1, background: `${cor}15`, border: `1px solid ${cor}55`,
                      borderRadius: 14, padding: "10px 8px", cursor: "pointer",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    }}>
                    <Icon size={20} style={{ color: cor }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: cor }}>{MODALIDADE_LABEL[m]}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => { setSessaoModal(false); setIaModal(true); }}>
              <Sparkles size={12} className="inline mr-1" /> Criar com IA
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: IA */}
      {iaModal && (
        <IAModal
          exerciciosDB={exerciciosDB}
          apiKeys={apiKeys}
          onSalvar={(template) => {
            setTreinoTemplates(prev => [...prev, template]);
            setIaModal(false);
            iniciarTreino(template);
          }}
          onClose={() => setIaModal(false)}
        />
      )}

      {/* Modal: Gerenciar templates */}
      {templateModal && (
        <TemplateModal
          templates={treinoTemplates}
          exerciciosDB={exerciciosDB}
          setExerciciosDB={setExerciciosDB}
          onSalvar={(t) => {
            setTreinoTemplates(prev => {
              const idx = prev.findIndex(x => x.id === t.id);
              return idx >= 0 ? prev.map(x => x.id === t.id ? t : x) : [...prev, t];
            });
          }}
          onExcluir={async (id) => {
            const ok = await confirm({ title: "Excluir template?", confirmLabel: "Excluir", danger: true });
            if (!ok) return;
            setTreinoTemplates(prev => prev.filter(t => t.id !== id));
          }}
          onClose={() => setTemplateModal(false)}
        />
      )}

      {/* Modal: Banco aberto de exercícios */}
      {bancoModal && (
        <BancoExerciciosModal
          exerciciosDB={exerciciosDB}
          setExerciciosDB={setExerciciosDB}
          onClose={() => setBancoModal(false)}
        />
      )}
    </div>
  );
}

/* ---- SessaoCard ---- */
function SessaoCard({ sessao, exerciciosDB, ativa, onToggleAtiva, onAtualizar, onConcluir, onExcluir, setExerciciosDB }) {
  const cor = MODALIDADE_COR[sessao.modalidade] || T.gold;
  const Icon = MODALIDADE_ICON[sessao.modalidade] || Dumbbell;
  const totalEx = sessao.exerciciosFeitos.length;
  const concluidosEx = sessao.exerciciosFeitos.filter(e =>
    sessao.modalidade === "musculacao"
      ? e.series?.every(s => s.feita)
      : e.concluido
  ).length;
  const pct = totalEx > 0 ? Math.round((concluidosEx / totalEx) * 100) : 0;

  const marcarSerie = (exIdx, serieIdx, feita) => {
    const novas = sessao.exerciciosFeitos.map((e, ei) => {
      if (ei !== exIdx) return e;
      return { ...e, series: e.series.map((s, si) => si === serieIdx ? { ...s, feita } : s) };
    });
    onAtualizar({ exerciciosFeitos: novas });
  };

  const atualizarSerieCampo = (exIdx, serieIdx, campo, valor) => {
    const novas = sessao.exerciciosFeitos.map((e, ei) => {
      if (ei !== exIdx) return e;
      return { ...e, series: e.series.map((s, si) => si === serieIdx ? { ...s, [campo]: Number(valor) } : s) };
    });
    onAtualizar({ exerciciosFeitos: novas });
  };

  const atualizarCardio = (exIdx, campo, valor) => {
    const novas = sessao.exerciciosFeitos.map((e, ei) =>
      ei === exIdx ? { ...e, [campo]: valor, concluido: campo === "concluido" ? valor : e.concluido } : e
    );
    onAtualizar({ exerciciosFeitos: novas });
  };

  const adicionarExercicio = (exercicioId) => {
    const ex = exerciciosDB.find(e => e.id === exercicioId);
    if (!ex) return;
    const novo = sessao.modalidade === "musculacao"
      ? { exercicioId, series: [{ reps: 12, carga: 0, feita: false }] }
      : { exercicioId, distanciaKm: 0, tempoMinutos: 0, concluido: false };
    onAtualizar({ exerciciosFeitos: [...sessao.exerciciosFeitos, novo] });
  };

  const exerciciosFiltrados = exerciciosDB.filter(e => e.modalidade === sessao.modalidade);

  return (
    <div style={{ background: T.card, border: `1px solid ${cor}55`, borderTop: `3px solid ${cor}`, borderRadius: 16, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Icon size={18} style={{ color: cor }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>{MODALIDADE_LABEL[sessao.modalidade]}</div>
          {totalEx > 0 && (
            <div style={{ fontSize: 11, color: T.muted }}>{concluidosEx}/{totalEx} exercícios · {pct}%</div>
          )}
        </div>
        {sessao.concluido
          ? <span style={{ fontSize: 10, padding: "2px 8px", background: `${T.green}22`, color: T.green, borderRadius: 4, fontWeight: 700 }}>✓ Concluído</span>
          : (
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={onToggleAtiva} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 11, padding: "4px 10px", cursor: "pointer", fontSize: 11, color: T.muted }}>
                {ativa ? "Recolher" : "Expandir"}
              </button>
              <button onClick={onConcluir} style={{ background: T.green, color: "#fff", border: "none", borderRadius: 11, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                Concluir
              </button>
            </div>
          )
        }
        <button onClick={onExcluir} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 4 }}>
          <Trash2 size={13} />
        </button>
      </div>

      {totalEx > 0 && (
        <div style={{ height: 5, background: T.border, borderRadius: 999, marginBottom: 12, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: cor, borderRadius: 999, transition: "width .3s" }} />
        </div>
      )}

      {ativa && !sessao.concluido && (
        <>
          {sessao.exerciciosFeitos.map((ef, ei) => {
            const ex = exerciciosDB.find(e => e.id === ef.exercicioId);
            return (
              <div key={ei} style={{ marginBottom: 14, padding: "10px 12px", background: T.bgSoft, borderRadius: 14, border: `1px solid ${T.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  {ex && <ExImagem exercicio={ex} setExerciciosDB={setExerciciosDB} />}
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
                    {ex?.nome || ef.exercicioId}
                  </div>
                </div>
                {sessao.modalidade === "musculacao" ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {(ef.series || []).map((s, si) => (
                      <div key={si} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: T.muted, width: 40 }}>Série {si + 1}</span>
                        <input type="number" min="0" value={s.reps}
                          onChange={e => atualizarSerieCampo(ei, si, "reps", e.target.value)}
                          style={{ width: 52, fontSize: 12, padding: "3px 6px", border: `1px solid ${T.border}`, borderRadius: 5, background: T.bg }}
                          placeholder="reps" />
                        <span style={{ fontSize: 11, color: T.muted }}>×</span>
                        <input type="number" min="0" step="0.5" value={s.carga}
                          onChange={e => atualizarSerieCampo(ei, si, "carga", e.target.value)}
                          style={{ width: 60, fontSize: 12, padding: "3px 6px", border: `1px solid ${T.border}`, borderRadius: 5, background: T.bg }}
                          placeholder="kg" />
                        <span style={{ fontSize: 11, color: T.muted }}>kg</span>
                        <button onClick={() => marcarSerie(ei, si, !s.feita)}
                          style={{
                            width: 24, height: 24, borderRadius: "50%",
                            background: s.feita ? T.green : "transparent",
                            border: `2px solid ${s.feita ? T.green : T.border}`,
                            cursor: "pointer", display: "grid", placeItems: "center",
                          }}>
                          {s.feita && <Check size={11} style={{ color: "#fff" }} />}
                        </button>
                      </div>
                    ))}
                    <button onClick={() => {
                      const ultima = ef.series[ef.series.length - 1] || { reps: 12, carga: 0 };
                      const novas = sessao.exerciciosFeitos.map((e, idx) =>
                        idx === ei ? { ...e, series: [...e.series, { reps: ultima.reps, carga: ultima.carga, feita: false }] } : e
                      );
                      onAtualizar({ exerciciosFeitos: novas });
                    }} style={{ fontSize: 10, color: T.gold, background: "none", border: "none", cursor: "pointer", padding: "2px 0", textAlign: "left" }}>
                      + Adicionar série
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <label style={{ fontSize: 10, color: T.muted }}>Distância (km)</label>
                      <input type="number" step="0.1" min="0" value={ef.distanciaKm || ""}
                        onChange={e => atualizarCardio(ei, "distanciaKm", parseFloat(e.target.value) || 0)}
                        style={{ width: 80, fontSize: 13, padding: "4px 8px", border: `1px solid ${T.border}`, borderRadius: 5, background: T.bg }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <label style={{ fontSize: 10, color: T.muted }}>Tempo (min)</label>
                      <input type="number" min="0" value={ef.tempoMinutos || ""}
                        onChange={e => atualizarCardio(ei, "tempoMinutos", parseInt(e.target.value) || 0)}
                        style={{ width: 80, fontSize: 13, padding: "4px 8px", border: `1px solid ${T.border}`, borderRadius: 5, background: T.bg }} />
                    </div>
                    {sessao.modalidade === "corrida" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <label style={{ fontSize: 10, color: T.muted }}>Pace (min/km)</label>
                        <input type="text" value={ef.paceMinKm || ""}
                          onChange={e => atualizarCardio(ei, "paceMinKm", e.target.value)}
                          placeholder="5:30"
                          style={{ width: 80, fontSize: 13, padding: "4px 8px", border: `1px solid ${T.border}`, borderRadius: 5, background: T.bg }} />
                      </div>
                    )}
                    {sessao.modalidade === "ciclismo" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <label style={{ fontSize: 10, color: T.muted }}>Veloc. média (km/h)</label>
                        <input type="number" step="0.1" min="0" value={ef.velocidadeMediaKmh || ""}
                          onChange={e => atualizarCardio(ei, "velocidadeMediaKmh", parseFloat(e.target.value) || 0)}
                          style={{ width: 80, fontSize: 13, padding: "4px 8px", border: `1px solid ${T.border}`, borderRadius: 5, background: T.bg }} />
                      </div>
                    )}
                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                      <button onClick={() => atualizarCardio(ei, "concluido", !ef.concluido)}
                        style={{
                          background: ef.concluido ? T.green : "transparent",
                          border: `2px solid ${ef.concluido ? T.green : T.border}`,
                          borderRadius: 11, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700,
                          color: ef.concluido ? "#fff" : T.muted,
                        }}>
                        {ef.concluido ? "✓ Feito" : "Marcar feito"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ marginTop: 8 }}>
            <select onChange={e => { if (e.target.value) { adicionarExercicio(e.target.value); e.target.value = ""; } }}
              style={{ fontSize: 12, padding: "6px 10px", border: `1px dashed ${T.gold}`, borderRadius: 11, background: T.bg, color: T.muted, cursor: "pointer", width: "100%" }}>
              <option value="">+ Adicionar exercício...</option>
              {exerciciosFiltrados.map(e => (
                <option key={e.id} value={e.id}>{e.nome} {e.grupoMuscular ? `(${e.grupoMuscular})` : ""}</option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );
}

/* ---- TemplateModal ---- */
function TemplateModal({ templates, exerciciosDB, setExerciciosDB, onSalvar, onExcluir, onClose }) {
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(null);

  const abrirNovo = () => {
    setForm({ id: uid(), nome: "", modalidade: "musculacao", exercicios: [], geradoPorIA: false, createdAt: new Date().toISOString() });
    setEditando("novo");
  };

  const salvarForm = () => {
    if (!form?.nome?.trim()) { toast.error("Nome obrigatório"); return; }
    onSalvar({ ...form, nome: form.nome.trim() });
    setEditando(null);
    toast.success("Template salvo.");
  };

  const adicionarExToTemplate = (exercicioId) => {
    if (!exercicioId) return;
    setForm(f => ({
      ...f,
      exercicios: [...f.exercicios, { exercicioId, series: 3, reps: 12, carga: 0, ordem: f.exercicios.length }],
    }));
  };

  if (editando) {
    const exerciciosFiltrados = exerciciosDB.filter(e => e.modalidade === form.modalidade);
    return (
      <Modal title={editando === "novo" ? "Novo Template" : "Editar Template"} onClose={() => setEditando(null)} wide>
        <Field label="Nome">
          <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} autoFocus placeholder="Ex.: Treino A — Peito/Tríceps" />
        </Field>
        <Field label="Modalidade">
          <select value={form.modalidade} onChange={e => setForm({ ...form, modalidade: e.target.value, exercicios: [] })}>
            <option value="musculacao">Musculação</option>
            <option value="corrida">Corrida</option>
            <option value="ciclismo">Ciclismo</option>
          </select>
        </Field>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>
            Exercícios ({form.exercicios.length})
          </div>
          {form.exercicios.map((ex, i) => {
            const exBase = exerciciosDB.find(e => e.id === ex.exercicioId);
            return (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, padding: "6px 10px", background: T.bgSoft, borderRadius: 11 }}>
                {exBase && <ExImagem exercicio={exBase} setExerciciosDB={setExerciciosDB} size={32} />}
                <span style={{ flex: 1, fontSize: 12, color: T.ink }}>{exBase?.nome || ex.exercicioId}</span>
                <input type="number" min="1" value={ex.series} onChange={e => setForm(f => ({ ...f, exercicios: f.exercicios.map((x, xi) => xi === i ? { ...x, series: Number(e.target.value) } : x) }))}
                  style={{ width: 40, fontSize: 12, padding: "2px 5px", border: `1px solid ${T.border}`, borderRadius: 4, background: T.bg }} />
                <span style={{ fontSize: 11, color: T.muted }}>×</span>
                <input type="number" min="1" value={ex.reps} onChange={e => setForm(f => ({ ...f, exercicios: f.exercicios.map((x, xi) => xi === i ? { ...x, reps: Number(e.target.value) } : x) }))}
                  style={{ width: 40, fontSize: 12, padding: "2px 5px", border: `1px solid ${T.border}`, borderRadius: 4, background: T.bg }} />
                <button onClick={() => setForm(f => ({ ...f, exercicios: f.exercicios.filter((_, xi) => xi !== i) }))}
                  style={{ background: "none", border: "none", color: T.red, cursor: "pointer", padding: 2 }}>
                  <X size={13} />
                </button>
              </div>
            );
          })}
          <select onChange={e => { adicionarExToTemplate(e.target.value); e.target.value = ""; }}
            style={{ fontSize: 12, padding: "6px 10px", border: `1px dashed ${T.gold}`, borderRadius: 11, background: T.bg, color: T.muted, cursor: "pointer", width: "100%", marginTop: 4 }}>
            <option value="">+ Adicionar exercício...</option>
            {exerciciosFiltrados.map(e => (
              <option key={e.id} value={e.id}>{e.nome}{e.grupoMuscular ? ` (${e.grupoMuscular})` : ""}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <button className="btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
          <button className="btn-gold" onClick={salvarForm}><Save size={12} className="inline mr-1" /> Salvar</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Templates de Treino" onClose={onClose} wide>
      <button className="btn-gold" style={{ marginBottom: 14 }} onClick={abrirNovo}>
        <Plus size={12} className="inline mr-1" /> Novo template
      </button>
      {templates.length === 0 && <p style={{ color: T.muted, fontSize: 12 }}>Nenhum template ainda.</p>}
      {templates.map(t => {
        const cor = MODALIDADE_COR[t.modalidade] || T.gold;
        return (
          <div key={t.id} style={{
            background: T.card, border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${cor}`, borderRadius: 14,
            padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{t.nome}</div>
              <div style={{ fontSize: 11, color: T.muted }}>{MODALIDADE_LABEL[t.modalidade]} · {t.exercicios.length} exercícios</div>
            </div>
            <button onClick={() => { setForm({ ...t }); setEditando(t.id); }} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 4 }}>
              <Edit3 size={13} />
            </button>
            <button onClick={() => onExcluir(t.id)} style={{ background: "none", border: "none", color: T.red, cursor: "pointer", padding: 4 }}>
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}
    </Modal>
  );
}

/* ---- IAModal ---- */
function IAModal({ exerciciosDB, apiKeys, onSalvar, onClose }) {
  const [prompt, setPrompt] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [preview, setPreview] = useState(null);

  const gerar = async () => {
    if (!prompt.trim()) return;
    const key = apiKeys.anthropic || apiKeys.gemini;
    if (!key) { toast.error("Configure uma chave de IA nas Configurações."); return; }
    setCarregando(true);

    const listaExercicios = exerciciosDB
      .filter(e => e.modalidade === "musculacao")
      .map(e => `${e.id}: ${e.nome} (${e.grupoMuscular})`)
      .join("\n");

    const systemPrompt = `Você é um personal trainer. Crie um treino de musculação baseado na descrição do usuário.
Exercícios disponíveis (use apenas estes IDs):
${listaExercicios}

Retorne APENAS JSON válido no formato:
{
  "nome": "Nome do Treino",
  "modalidade": "musculacao",
  "exercicios": [
    { "exercicioId": "id-do-exercicio", "series": 4, "reps": 12, "carga": 40, "ordem": 0 }
  ]
}`;

    try {
      let raw;
      if (apiKeys.anthropic) {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic({ apiKey: apiKeys.anthropic, dangerouslyAllowBrowser: true });
        const msg = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
        });
        raw = msg.content[0].text;
      } else {
        const { callGemini } = await import("../../lib/gemini.js");
        raw = await callGemini(systemPrompt + "\n\nDescrição: " + prompt, apiKeys.gemini);
      }
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      setPreview({ ...parsed, id: uid(), geradoPorIA: true, createdAt: new Date().toISOString() });
    } catch (e) {
      toast.error("Erro ao gerar treino. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <Modal title="Criar treino com IA" onClose={onClose}>
      {!preview ? (
        <>
          <Field label="Descreva o treino que quer">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Ex.: treino de peito e tríceps, tenho 1h, nível intermediário"
              rows={3}
              style={{ width: "100%", fontSize: 13, padding: "8px 10px", borderRadius: 11, border: `1px solid ${T.border}`, background: T.bg, resize: "vertical" }}
            />
          </Field>
          <div className="flex gap-3 justify-end mt-4">
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn-gold" onClick={gerar} disabled={carregando || !prompt.trim()}>
              {carregando ? "Gerando..." : <><Sparkles size={12} className="inline mr-1" /> Gerar treino</>}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ background: T.card, border: `1px solid ${T.gold}55`, borderRadius: 14, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 6 }}>{preview.nome}</div>
            {preview.exercicios.map((ex, i) => {
              const exBase = exerciciosDB.find(e => e.id === ex.exercicioId);
              return (
                <div key={i} style={{ fontSize: 12, color: T.muted, padding: "3px 0" }}>
                  {i + 1}. {exBase?.nome || ex.exercicioId} — {ex.series}×{ex.reps} @ {ex.carga}kg
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 justify-end">
            <button className="btn-ghost" onClick={() => setPreview(null)}>Gerar outro</button>
            <button className="btn-gold" onClick={() => onSalvar(preview)}>Usar este treino</button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ---- BancoExerciciosModal: catálogo aberto (free-exercise-db) ---- */
function BancoExerciciosModal({ exerciciosDB, setExerciciosDB, onClose }) {
  const [estado, setEstado] = useState("carregando"); // carregando | ok | erro
  const [todos, setTodos] = useState([]);
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState("todos");
  const [equip, setEquip] = useState("todos");
  const [limite, setLimite] = useState(40);

  useEffect(() => {
    let vivo = true;
    carregarCatalogo()
      .then(data => { if (vivo) { setTodos(data); setEstado("ok"); } })
      .catch(() => { if (vivo) setEstado("erro"); });
    return () => { vivo = false; };
  }, []);

  const grupos = useMemo(() => ["todos", ...Array.from(new Set(todos.map(e => e.grupoMuscular).filter(Boolean))).sort()], [todos]);
  const equips = useMemo(() => ["todos", ...Array.from(new Set(todos.map(e => e.equipamento).filter(Boolean))).sort()], [todos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return todos.filter(e =>
      (grupo === "todos" || e.grupoMuscular === grupo) &&
      (equip === "todos" || e.equipamento === equip) &&
      (!q || e.nome.toLowerCase().includes(q))
    );
  }, [todos, busca, grupo, equip]);

  const jaTem = (e) => (exerciciosDB || []).some(x => x.id === e.id || (x.nome || "").toLowerCase() === e.nome.toLowerCase());

  const adicionar = (e) => {
    if (jaTem(e)) { toast.info("Esse exercício já está no seu banco."); return; }
    setExerciciosDB(prev => [...(prev || []), {
      id: e.id, nome: e.nome, grupoMuscular: e.grupoMuscular,
      equipamento: e.equipamento, modalidade: e.modalidade,
      imagem: e.imagem, isCustom: false,
    }]);
    toast.success(`"${e.nome}" adicionado ao seu banco.`);
  };

  const selSty = { fontSize: 12, padding: "6px 8px", border: `1px solid ${T.border}`, borderRadius: 11, background: T.bg, color: T.ink };

  return (
    <Modal title="Banco de exercícios" onClose={onClose} wide>
      {estado === "carregando" && (
        <div style={{ padding: 30, textAlign: "center", color: T.muted, fontSize: 13 }}>Carregando catálogo aberto…</div>
      )}
      {estado === "erro" && (
        <div style={{ padding: 20, textAlign: "center", color: T.muted, fontSize: 12.5 }}>
          Não consegui carregar o catálogo agora (precisa de internet). Tente de novo mais tarde — você pode criar exercícios manualmente e anexar a imagem.
        </div>
      )}
      {estado === "ok" && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <input value={busca} onChange={e => { setBusca(e.target.value); setLimite(40); }}
              placeholder="Buscar exercício…" style={{ ...selSty, flex: "1 1 180px", minWidth: 160 }} />
            <select value={grupo} onChange={e => { setGrupo(e.target.value); setLimite(40); }} style={selSty}>
              {grupos.map(g => <option key={g} value={g}>{g === "todos" ? "Todos os grupos" : g}</option>)}
            </select>
            <select value={equip} onChange={e => { setEquip(e.target.value); setLimite(40); }} style={selSty}>
              {equips.map(g => <option key={g} value={g}>{g === "todos" ? "Todo equipamento" : equipamentoPT(g)}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>{filtrados.length} exercício(s) · catálogo aberto (domínio público)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "55vh", overflowY: "auto" }}>
            {filtrados.slice(0, limite).map(e => {
              const tem = jaTem(e);
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", background: T.bgSoft, borderRadius: 14, border: `1px solid ${T.border}` }}>
                  <div style={{ width: 44, height: 44, borderRadius: 11, overflow: "hidden", flexShrink: 0, background: T.bg, display: "grid", placeItems: "center" }}>
                    {e.imagem ? <img src={e.imagem} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Dumbbell size={16} style={{ color: T.muted }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>{e.nome}</div>
                    <div style={{ fontSize: 10.5, color: T.muted }}>{e.grupoMuscular}{e.equipamento ? ` · ${equipamentoPT(e.equipamento)}` : ""}{e.nivel ? ` · ${e.nivel}` : ""}</div>
                  </div>
                  <button onClick={() => adicionar(e)} disabled={tem}
                    style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 11, cursor: tem ? "default" : "pointer",
                      background: tem ? "transparent" : `${T.green}22`, color: tem ? T.muted : T.green, border: `1px solid ${tem ? T.border : T.green}` }}>
                    {tem ? "✓ no banco" : "+ Adicionar"}
                  </button>
                </div>
              );
            })}
            {filtrados.length > limite && (
              <button className="btn-ghost" onClick={() => setLimite(l => l + 40)} style={{ marginTop: 4 }}>
                Mostrar mais ({filtrados.length - limite})
              </button>
            )}
            {filtrados.length === 0 && <div style={{ padding: 16, textAlign: "center", color: T.muted, fontSize: 12.5 }}>Nada encontrado.</div>}
          </div>
        </>
      )}
    </Modal>
  );
}
