import React, { useMemo, useState } from "react";
import { Plus, Check, X, Search, ChevronLeft, Trash2 } from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { BIBLIOTECA, TREINOS_PRONTOS } from "../../lib/bibliotecaTreino.js";
import Modal from "../ui/Modal.jsx";

/**
 * Montar treino com fotos (pedido 2026-10-02): biblioteca visual de exercícios
 * em português + treinos prontos de exemplo. As fotos vêm do free-exercise-db
 * (domínio público) — 2 quadros (início/fim) alternando, como um GIF.
 */
const CDN = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/";
export const urlFoto = (p) => (p ? CDN + p : "");
const PORID = Object.fromEntries(BIBLIOTECA.map(e => [e.id, e]));
const GRUPOS = ["Todos", ...Array.from(new Set(BIBLIOTECA.map(e => e.grupo)))];

/** Foto "animada": alterna início/fim do movimento. `children` vai por cima
 *  (com degradê escuro embaixo) — título sobre a foto, estilo app de treino. */
export function FotoMov({ imagens = [], altura = 120, raio = 14, children, encaixar = false }) {
  const [a, b] = imagens;
  const fit = encaixar ? "contain" : "cover";
  return (
    <div style={{ position: "relative", width: "100%", height: altura, borderRadius: raio, overflow: "hidden", background: "#15181d" }}>
      <img src={urlFoto(a)} alt="" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit }} />
      {b && <img src={urlFoto(b)} alt="" loading="lazy" className="foto-mov-b"
                 style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit }} />}
      {children && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: 12,
                      background: "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,.82) 100%)", color: "#fff" }}>
          {children}
        </div>
      )}
    </div>
  );
}

const pilula = (txt, forte) => (
  <span key={txt} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", padding: "3px 9px", borderRadius: 999,
                           background: forte ? "#4DD9C0" : "rgba(255,255,255,.18)", color: forte ? "#0d1f1b" : "#fff",
                           backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", whiteSpace: "nowrap" }}>{txt}</span>
);

// Garante que o exercício da biblioteca existe no banco do usuário; devolve o id.
function garantirNoBanco(item, banco, novos) {
  const nomeLc = item.nome.toLowerCase();
  const ja = [...banco, ...novos].find(x => x.id === "bib-" + item.id || (x.nome || "").toLowerCase() === nomeLc);
  if (ja) return ja.id;
  const ex = {
    id: "bib-" + item.id, nome: item.nome, grupoMuscular: item.grupo, equipamento: item.equipamento,
    modalidade: "musculacao", imagem: urlFoto(item.imagens[0]), imagens: item.imagens.map(urlFoto),
    dicas: item.dicas, isCustom: false,
  };
  novos.push(ex);
  return ex.id;
}

export default function TreinoMontar({ exerciciosDB = [], setExerciciosDB, setTreinoTemplates, onClose }) {
  const [aba, setAba] = useState("prontos"); // prontos | biblioteca
  const [grupo, setGrupo] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [detalhe, setDetalhe] = useState(null);      // item da biblioteca
  const [programa, setPrograma] = useState(null);    // treino pronto aberto
  const [montando, setMontando] = useState([]);      // [{ id, series, reps }]
  const [nomeTreino, setNomeTreino] = useState("");
  const [verMontagem, setVerMontagem] = useState(false);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return BIBLIOTECA.filter(e => (grupo === "Todos" || e.grupo === grupo) &&
      (!q || e.nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q)));
  }, [grupo, busca]);

  const naMontagem = (id) => montando.some(m => m.id === id);
  const alternar = (id) => setMontando(m => naMontagem(id) ? m.filter(x => x.id !== id) : [...m, { id, series: 3, reps: 12 }]);

  // Salva um ou mais dias como templates (cria os exercícios que faltam no banco).
  const salvarTemplates = (dias) => {
    const novos = [];
    const templates = dias.map(d => ({
      id: uid(), nome: d.nome, modalidade: "musculacao", geradoPorIA: false, createdAt: new Date().toISOString(),
      exercicios: d.exercicios.map((e, i) => ({
        exercicioId: garantirNoBanco(PORID[e.id], exerciciosDB, novos), series: e.series, reps: e.reps, carga: 0, ordem: i,
      })),
    }));
    if (novos.length) setExerciciosDB(prev => [...(prev || []), ...novos]);
    setTreinoTemplates(prev => [...(prev || []), ...templates]);
    return templates.length;
  };

  const usarPrograma = (p) => {
    const n = salvarTemplates(p.dias.map(d => ({ ...d, nome: p.dias.length > 1 ? `${p.nome} · ${d.nome}` : p.nome })));
    toast.success(`✅ ${n} treino${n > 1 ? "s" : ""} salvo${n > 1 ? "s" : ""} em Templates — é só "Iniciar treino".`);
    onClose?.();
  };

  const salvarMontagem = () => {
    if (!montando.length) return;
    const nome = nomeTreino.trim() || "Meu treino";
    salvarTemplates([{ nome, exercicios: montando }]);
    toast.success(`✅ "${nome}" salvo em Templates.`);
    onClose?.();
  };

  const chip = (ativo) => ({
    padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
    border: `1px solid ${ativo ? T.gold : T.border}`, background: ativo ? `${T.gold}22` : "transparent", color: ativo ? T.gold : T.muted,
  });
  const estilos = (
    <style>{`
      .foto-mov-b { animation: fotoMov 1.8s steps(1, end) infinite; }
      @keyframes fotoMov { 0% { opacity: 0; } 50% { opacity: 1; } }
      .tm-card { transition: transform .2s ease, box-shadow .2s ease; }
      .tm-card:hover { transform: translateY(-3px); }
      .tm-card:active { transform: scale(.98); }
      .tm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
      @media (max-width: 560px) { .tm-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    `}</style>
  );

  // ---- Detalhe de um exercício ----
  if (detalhe) {
    const add = naMontagem(detalhe.id);
    return (
      <Modal title={detalhe.nome} onClose={() => setDetalhe(null)} wide>
        {estilos}
        <FotoMov imagens={detalhe.imagens} altura={280} raio={18}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[detalhe.grupo, detalhe.equipamento, detalhe.nivel].filter(Boolean).map((t, i) => pilula(t, i === 0))}
          </div>
        </FotoMov>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em", margin: "16px 0 10px" }}>Como fazer</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {detalhe.dicas.map((d, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: "#4DD9C022", color: "#4DD9C0", fontSize: 12, fontWeight: 800,
                             display: "grid", placeItems: "center", flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 14, color: T.ink, lineHeight: 1.45, paddingTop: 2 }}>{d}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button className="btn-ghost" onClick={() => setDetalhe(null)}><ChevronLeft size={13} className="inline mr-1" />Voltar</button>
          <button className={add ? "btn-ghost" : "btn-gold"} onClick={() => { alternar(detalhe.id); setDetalhe(null); }}>
            {add ? <><X size={13} className="inline mr-1" />Tirar do meu treino</> : <><Plus size={13} className="inline mr-1" />Adicionar ao meu treino</>}
          </button>
        </div>
      </Modal>
    );
  }

  // ---- Um treino pronto aberto ----
  if (programa) {
    return (
      <Modal title={`${programa.icone} ${programa.nome}`} onClose={() => setPrograma(null)} wide>
        {estilos}
        <div style={{ fontSize: 13, color: T.muted, marginBottom: 12 }}>{programa.nivel} · {programa.frequencia} · {programa.foco}</div>
        {programa.dias.map(d => (
          <div key={d.nome} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, marginBottom: 8 }}>{d.nome}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {d.exercicios.map(e => {
                const it = PORID[e.id];
                return (
                  <button key={e.id} onClick={() => setDetalhe(it)}
                          style={{ display: "flex", alignItems: "center", gap: 12, padding: 8, borderRadius: 16, border: "none", background: T.bgSoft, cursor: "pointer", textAlign: "left" }}>
                    <div style={{ width: 84, flexShrink: 0 }}><FotoMov imagens={it.imagens} altura={64} raio={12} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{it.nome}</div>
                      <div style={{ fontSize: 11.5, color: T.muted }}>{it.grupo} · {it.equipamento}</div>
                    </div>
                    <div className="num" style={{ fontSize: 13, fontWeight: 800, color: "#0d1f1b", background: "#4DD9C0", borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap" }}>
                      {e.series} × {e.reps}{["Plank", "Mountain_Climbers"].includes(e.id) ? "s" : ""}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, position: "sticky", bottom: 0, background: T.card, paddingTop: 8 }}>
          <button className="btn-ghost" onClick={() => setPrograma(null)}><ChevronLeft size={13} className="inline mr-1" />Voltar</button>
          <button className="btn-gold" onClick={() => usarPrograma(programa)}><Check size={13} className="inline mr-1" />Usar este treino</button>
        </div>
      </Modal>
    );
  }

  // ---- Revisar o treino que estou montando ----
  if (verMontagem) {
    return (
      <Modal title="Meu treino" onClose={() => setVerMontagem(false)} wide>
        {estilos}
        <input value={nomeTreino} onChange={e => setNomeTreino(e.target.value)} placeholder="Nome do treino (ex.: Treino A — Peito)"
               style={{ width: "100%", marginBottom: 12 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {montando.map((m, i) => {
            const it = PORID[m.id];
            const num = (campo) => (
              <input type="number" min="1" value={m[campo]} inputMode="numeric"
                     onChange={e => setMontando(arr => arr.map(x => x.id === m.id ? { ...x, [campo]: Math.max(1, Number(e.target.value) || 1) } : x))}
                     style={{ width: 52, padding: "6px", textAlign: "center" }} />
            );
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 12, border: `1px solid ${T.border}`, background: T.card }}>
                <div style={{ width: 64, flexShrink: 0 }}><FotoMov imagens={it.imagens} altura={50} raio={8} /></div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: T.ink }}>{i + 1}. {it.nome}</div>
                {num("series")}<span style={{ color: T.muted }}>×</span>{num("reps")}
                <button onClick={() => alternar(m.id)} aria-label="Tirar" style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer" }}><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn-ghost" onClick={() => setVerMontagem(false)}><Plus size={13} className="inline mr-1" />Adicionar mais</button>
          <button className="btn-gold" onClick={salvarMontagem} disabled={!montando.length}><Check size={13} className="inline mr-1" />Salvar treino</button>
        </div>
      </Modal>
    );
  }

  // ---- Tela principal ----
  return (
    <Modal title="Montar treino" onClose={onClose} wide>
      {estilos}
      <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 999, background: T.bgSoft, marginBottom: 16 }}>
        {[["prontos", "⭐ Treinos prontos"], ["biblioteca", `📚 Exercícios (${BIBLIOTECA.length})`]].map(([id, rot]) => (
          <button key={id} onClick={() => setAba(id)}
                  style={{ flex: 1, padding: "9px 10px", borderRadius: 999, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
                           background: aba === id ? T.card : "transparent", color: aba === id ? T.ink : T.muted,
                           boxShadow: aba === id ? "0 2px 8px rgba(0,0,0,.18)" : "none", transition: "all .2s" }}>{rot}</button>
        ))}
      </div>

      {aba === "prontos" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {TREINOS_PRONTOS.map(p => {
            const capa = PORID[p.capa] || PORID[p.dias[0].exercicios[0].id];
            const total = p.dias.reduce((s, d) => s + d.exercicios.length, 0);
            return (
              <button key={p.id} onClick={() => setPrograma(p)} className="tm-card"
                      style={{ all: "unset", cursor: "pointer", display: "block", borderRadius: 18, overflow: "hidden", boxShadow: "0 10px 24px rgba(0,0,0,.22)" }}>
                <FotoMov imagens={capa.imagens} altura={190} raio={18}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                    {pilula(p.nivel, true)}{pilula(`${p.dias.length} ${p.dias.length > 1 ? "dias" : "dia"}`)}{pilula(`${total} exercícios`)}
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.01em", lineHeight: 1.15 }}>{p.icone} {p.nome}</div>
                  <div style={{ fontSize: 12, opacity: .85, marginTop: 3 }}>{p.frequencia} · {p.foco}</div>
                </FotoMov>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div style={{ position: "relative", marginBottom: 10 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.faint }} />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar exercício (ex.: supino, agachamento)"
                   style={{ width: "100%", paddingLeft: 30 }} />
          </div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 10 }}>
            {GRUPOS.map(g => <button key={g} style={chip(grupo === g)} onClick={() => setGrupo(g)}>{g}</button>)}
          </div>
          <div className="tm-grid">
            {lista.map(e => {
              const add = naMontagem(e.id);
              return (
                <div key={e.id} className="tm-card" style={{ position: "relative", borderRadius: 16, overflow: "hidden",
                     boxShadow: add ? `0 0 0 2px ${T.gold}, 0 8px 18px rgba(0,0,0,.2)` : "0 8px 18px rgba(0,0,0,.18)" }}>
                  <button onClick={() => setDetalhe(e)} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
                    <FotoMov imagens={e.imagens} altura={150} raio={16}>
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{e.nome}</div>
                      <div style={{ fontSize: 10.5, opacity: .8, marginTop: 2 }}>{e.grupo} · {e.equipamento}</div>
                    </FotoMov>
                  </button>
                  <button onClick={() => alternar(e.id)} aria-label={add ? "Tirar do treino" : "Adicionar ao treino"}
                          style={{ position: "absolute", top: 8, right: 8, width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(255,255,255,.35)", cursor: "pointer",
                                   display: "grid", placeItems: "center", minHeight: 0, padding: 0, color: add ? "#0d1f1b" : "#fff",
                                   background: add ? "#4DD9C0" : "rgba(0,0,0,.35)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
                    {add ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={2.5} />}
                  </button>
                </div>
              );
            })}
          </div>
          {lista.length === 0 && <div style={{ textAlign: "center", color: T.muted, padding: 20, fontSize: 13 }}>Nada encontrado.</div>}
        </>
      )}

      {montando.length > 0 && (
        <div style={{ position: "sticky", bottom: 0, marginTop: 12, paddingTop: 8, background: T.card }}>
          <button onClick={() => setVerMontagem(true)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px 10px 10px", borderRadius: 999, border: "none", cursor: "pointer",
                           background: "linear-gradient(90deg, #4DD9C0, #3bb8a2)", color: "#0d1f1b", fontWeight: 800, fontSize: 14,
                           boxShadow: "0 10px 24px rgba(77,217,192,.35)" }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", background: "#0d1f1b", color: "#4DD9C0", display: "grid", placeItems: "center", fontSize: 13 }}>{montando.length}</span>
            <span style={{ flex: 1, textAlign: "left" }}>Meu treino</span>
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>Revisar e salvar →</span>
          </button>
        </div>
      )}
      <div style={{ fontSize: 10.5, color: T.faint, marginTop: 10 }}>Fotos: free-exercise-db (domínio público).</div>
    </Modal>
  );
}
