// Backups automáticos locais — "pontos de restauração" do estado do app.
// Guardados em IndexedDB (quota grande; não estoura como o localStorage nem
// concorre com o STORE_KEY). Mantém os últimos MAX; cria um por dia e um antes
// de ações destrutivas. Restaura o estado inteiro. Tudo tolerante a falha
// (try/catch) — se o IndexedDB não existir (SSR/testes), degrada pra no-op.

const DB_NOME = "af4-backups";
const STORE = "snapshots";
const MAX = 12;

// ---- helpers puros (testáveis) ----
export function ehDeHoje(ts, agora = Date.now()) {
  return new Date(ts).toDateString() === new Date(agora).toDateString();
}
// dado uma lista de ids (crescente) e o máximo, quais remover (os mais antigos).
export function idsAExcluir(ids = [], max = MAX) {
  const ordenados = [...ids].sort((a, b) => a - b);
  return ordenados.length <= max ? [] : ordenados.slice(0, ordenados.length - max);
}

// ---- IndexedDB glue ----
function abrir() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("sem IndexedDB"));
    const req = indexedDB.open(DB_NOME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const store = (db, modo) => db.transaction(STORE, modo).objectStore(STORE);

async function getAll(db) {
  return new Promise((res, rej) => {
    const r = store(db, "readonly").getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error);
  });
}

async function podar(db) {
  const arr = await getAll(db);
  const excluir = idsAExcluir(arr.map((x) => x.id), MAX);
  if (!excluir.length) return;
  await new Promise((res) => {
    const s = store(db, "readwrite");
    excluir.forEach((id) => s.delete(id));
    s.transaction.oncomplete = () => res();
    s.transaction.onerror = () => res();
  });
}

/** Lista os backups (metadados, sem o blob) — mais recente primeiro. */
export async function listarBackups() {
  try {
    const db = await abrir();
    const arr = await getAll(db);
    return arr
      .map((v) => ({ id: v.id, ts: v.ts, motivo: v.motivo, bytes: v.bytes || 0 }))
      .sort((a, b) => b.ts - a.ts);
  } catch { return []; }
}

/** Cria um ponto de restauração agora. `dados` = blob completo do estado. */
export async function criarBackup(dados, motivo = "manual") {
  try {
    if (!dados) return false;
    const db = await abrir();
    const bytes = JSON.stringify(dados).length;
    await new Promise((res, rej) => {
      const r = store(db, "readwrite").add({ ts: Date.now(), motivo, bytes, dados });
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    await podar(db);
    return true;
  } catch { return false; }
}

/** Cria o snapshot do dia só se ainda não houver um de hoje. */
export async function backupDiario(dados) {
  try {
    const lista = await listarBackups();
    if (lista.some((b) => ehDeHoje(b.ts))) return false;
    return await criarBackup(dados, "diário");
  } catch { return false; }
}

/** Devolve o blob completo de um backup pra restaurar. */
export async function obterBackup(id) {
  try {
    const db = await abrir();
    return await new Promise((res, rej) => {
      const r = store(db, "readonly").get(id);
      r.onsuccess = () => res(r.result?.dados || null);
      r.onerror = () => rej(r.error);
    });
  } catch { return null; }
}

export async function apagarBackup(id) {
  try {
    const db = await abrir();
    await new Promise((res) => {
      const r = store(db, "readwrite").delete(id);
      r.onsuccess = () => res();
      r.onerror = () => res();
    });
    return true;
  } catch { return false; }
}
