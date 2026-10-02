/**
 * Evolução do treino (pedido 2026-10-02): volume, frequência, progressão de
 * carga por exercício, séries por grupo muscular e análise automática.
 * Funções puras — recebem treinos[] e exerciciosDB[] e devolvem números.
 */
export const epley = (carga, reps) => Math.round((Number(carga) || 0) * (1 + (Number(reps) || 0) / 30));

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const segundaDe = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const diasEntre = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000);

// Séries que contam: as marcadas como feitas; se a sessão não marcou nenhuma, todas.
function seriesValidas(ef) {
  const s = ef.series || [];
  return s.some(x => x.feita) ? s.filter(x => x.feita) : s;
}

/** Números de uma sessão: volume (kg × reps), séries, km, minutos. */
export function resumoSessao(s) {
  let volume = 0, series = 0, km = 0, minutos = 0;
  for (const ef of s.exerciciosFeitos || []) {
    if (ef.series) for (const se of seriesValidas(ef)) { volume += (Number(se.carga) || 0) * (Number(se.reps) || 0); series++; }
    km += Number(ef.distanciaKm) || 0;
    minutos += Number(ef.tempoMinutos) || 0;
  }
  return { volume, series, km, minutos };
}

/** Semanas (segunda a domingo) das últimas N, com treinos, volume, séries e km. */
export function semanas(treinos = [], n = 12, hoje = new Date()) {
  const fim = segundaDe(hoje);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const ini = new Date(fim); ini.setDate(ini.getDate() - 7 * i);
    const ate = new Date(ini); ate.setDate(ate.getDate() + 6);
    out.push({ ini: iso(ini), fim: iso(ate), rotulo: `${String(ini.getDate()).padStart(2, "0")}/${String(ini.getMonth() + 1).padStart(2, "0")}`, treinos: 0, volume: 0, series: 0, km: 0 });
  }
  for (const s of treinos) {
    const w = out.find(x => s.data >= x.ini && s.data <= x.fim);
    if (!w) continue;
    const r = resumoSessao(s);
    w.treinos++; w.volume += r.volume; w.series += r.series; w.km += r.km;
  }
  return out;
}

/** Progressão de um exercício: por sessão, maior carga e 1RM estimado. */
export function progressaoExercicio(treinos = [], exercicioId) {
  return [...treinos].sort((a, b) => (a.data || "").localeCompare(b.data || ""))
    .map(s => {
      const ef = (s.exerciciosFeitos || []).find(e => e.exercicioId === exercicioId);
      if (!ef || !ef.series) return null;
      const ss = seriesValidas(ef).filter(x => (Number(x.carga) || 0) > 0);
      if (!ss.length) return null;
      return { data: s.data, rotulo: `${s.data.slice(8, 10)}/${s.data.slice(5, 7)}`,
        carga: Math.max(...ss.map(x => Number(x.carga) || 0)), e1rm: Math.max(...ss.map(x => epley(x.carga, x.reps))) };
    }).filter(Boolean);
}

/** Exercícios com carga registrada, do mais treinado pro menos. */
export function exerciciosComCarga(treinos = [], exerciciosDB = []) {
  const cont = {};
  for (const s of treinos) for (const ef of s.exerciciosFeitos || [])
    if ((ef.series || []).some(x => (Number(x.carga) || 0) > 0)) cont[ef.exercicioId] = (cont[ef.exercicioId] || 0) + 1;
  return Object.entries(cont).sort((a, b) => b[1] - a[1])
    .map(([id, n]) => ({ id, n, nome: exerciciosDB.find(e => e.id === id)?.nome || "Exercício" }));
}

/** Séries por grupo muscular nos últimos `dias`. */
export function seriesPorGrupo(treinos = [], exerciciosDB = [], dias = 30, hoje = new Date()) {
  const corte = new Date(hoje); corte.setDate(corte.getDate() - dias);
  const c = iso(corte);
  const acc = {};
  for (const s of treinos) {
    if ((s.data || "") < c) continue;
    for (const ef of s.exerciciosFeitos || []) {
      if (!ef.series) continue;
      const g = exerciciosDB.find(e => e.id === ef.exercicioId)?.grupoMuscular || "Outros";
      acc[g] = (acc[g] || 0) + seriesValidas(ef).length;
    }
  }
  return Object.entries(acc).map(([grupo, series]) => ({ grupo, series })).sort((a, b) => b.series - a.series);
}

/** Análise geral: KPIs + frases de leitura. */
export function analisarEvolucao(treinos = [], exerciciosDB = [], hoje = new Date()) {
  const hj = iso(hoje);
  const em = (dIni, dFim) => treinos.filter(s => { const d = diasEntre(s.data, hj); return d >= dIni && d < dFim; });
  const ult30 = em(0, 30), ant30 = em(30, 60);
  const vol = (arr) => arr.reduce((t, s) => t + resumoSessao(s).volume, 0);
  const v30 = vol(ult30), vAnt = vol(ant30);
  const varVolume = vAnt > 0 ? ((v30 - vAnt) / vAnt) * 100 : null;
  const sem = semanas(treinos, 12, hoje);
  // Sequência: semanas seguidas (até a atual ou a anterior) com pelo menos 1 treino.
  let seq = 0;
  for (let i = sem.length - 1; i >= 0; i--) {
    if (sem[i].treinos > 0) seq++;
    else if (i === sem.length - 1) continue; // semana atual ainda vazia não quebra
    else break;
  }
  const ultimo = [...treinos].map(s => s.data).sort().pop() || null;
  const diasSemTreino = ultimo ? diasEntre(ultimo, hj) : null;
  const mediaSemana = ult30.length / (30 / 7);

  const frases = [];
  if (!treinos.length) return { treinos30: 0, mediaSemana: 0, volume30: 0, varVolume: null, sequencia: 0, diasSemTreino: null, frases: ["Registre o primeiro treino pra começar a ver sua evolução."] };
  if (varVolume != null) {
    if (varVolume >= 5) frases.push({ tipo: "bom", txt: `Volume ${Math.round(varVolume)}% maior que nos 30 dias anteriores — você está treinando mais pesado.` });
    else if (varVolume <= -10) frases.push({ tipo: "alerta", txt: `Volume ${Math.abs(Math.round(varVolume))}% menor que nos 30 dias anteriores.` });
    else frases.push({ tipo: "info", txt: "Volume estável em relação aos 30 dias anteriores." });
  }
  if (mediaSemana >= 3) frases.push({ tipo: "bom", txt: `Ótima frequência: ${mediaSemana.toFixed(1).replace(".", ",")} treinos por semana.` });
  else if (mediaSemana > 0) frases.push({ tipo: "info", txt: `Frequência de ${mediaSemana.toFixed(1).replace(".", ",")} treino(s) por semana — 3 ou mais acelera os resultados.` });
  if (diasSemTreino != null && diasSemTreino >= 5) frases.push({ tipo: "alerta", txt: `${diasSemTreino} dias sem treinar.` });
  if (seq >= 3) frases.push({ tipo: "bom", txt: `${seq} semanas seguidas treinando. 🔥` });

  // PRs recentes e exercícios estagnados.
  const prs = [], parados = [];
  for (const ex of exerciciosComCarga(treinos, exerciciosDB)) {
    const p = progressaoExercicio(treinos, ex.id);
    if (p.length < 2) continue;
    const melhorAntes = Math.max(...p.slice(0, -1).map(x => x.e1rm));
    const ult = p[p.length - 1];
    if (ult.e1rm > melhorAntes && diasEntre(ult.data, hj) <= 30) prs.push(ex.nome);
    if (p.length >= 4) {
      const ult4 = p.slice(-4).map(x => x.e1rm);
      if (Math.max(...ult4) <= ult4[0]) parados.push(ex.nome);
    }
  }
  if (prs.length) frases.push({ tipo: "bom", txt: `Recorde nos últimos 30 dias: ${prs.slice(0, 4).join(", ")}${prs.length > 4 ? "…" : ""}.` });
  if (parados.length) frases.push({ tipo: "alerta", txt: `Sem progresso nas últimas 4 sessões: ${parados.slice(0, 3).join(", ")}. Tente subir a carga ou mudar as repetições.` });

  const grupos = seriesPorGrupo(treinos, exerciciosDB, 30, hoje);
  const principais = ["Peito", "Costas", "Pernas", "Ombros"];
  const faltando = principais.filter(g => !grupos.some(x => x.grupo === g));
  if (grupos.length && faltando.length && faltando.length < principais.length) frases.push({ tipo: "info", txt: `Nos últimos 30 dias não teve treino de ${faltando.join(", ")}.` });

  return { treinos30: ult30.length, mediaSemana, volume30: v30, varVolume, sequencia: seq, diasSemTreino, frases };
}
