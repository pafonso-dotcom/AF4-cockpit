/**
 * Multi-usuário · sistema de perfis com permissões.
 *
 * Sem backend, isso é "soft auth" — o app simplesmente esconde abas
 * conforme o perfil ativo.
 *
 * Persistência: af4:perfis:v1 (lista) · af4:perfil-ativo:v1 (id atual)
 */

const KEY_PERFIS = "af4:perfis:v1";
const KEY_ATIVO  = "af4:perfil-ativo:v1";

const PERFIL_PADRAO = {
  id: "paulo",
  nome: "Paulo Afonso",
  email: "",
  cor: "#c9a961",
  role: "admin", // admin | viewer
  permissoes: {
    financas: true,
    invest: true,
    config: true,
  },
};

const ROLES = {
  admin: {
    label: "Administrador",
    cor: "#c9a961",
    permissoes: { financas: true, invest: true, config: true },
  },
  viewer: {
    label: "Visualizador",
    cor: "#9ca3af",
    permissoes: { financas: "view", invest: "view", config: false },
  },
};

const safe = (fn, fb) => { try { return fn(); } catch { return fb; } };

export function getPerfis() {
  return safe(() => {
    const raw = localStorage.getItem(KEY_PERFIS);
    const arr = JSON.parse(raw || "null");
    if (Array.isArray(arr) && arr.length > 0) return arr;
    // Primeira vez: cria o perfil padrão
    const lista = [PERFIL_PADRAO];
    localStorage.setItem(KEY_PERFIS, JSON.stringify(lista));
    return lista;
  }, [PERFIL_PADRAO]);
}

export function getPerfilAtivo() {
  const lista = getPerfis();
  const id = safe(() => localStorage.getItem(KEY_ATIVO), null);
  return lista.find(p => p.id === id) || lista[0];
}

export function setPerfilAtivo(id) {
  safe(() => localStorage.setItem(KEY_ATIVO, id));
}

export function savePerfis(lista) {
  safe(() => localStorage.setItem(KEY_PERFIS, JSON.stringify(lista)));
}

export function addPerfil(perfil) {
  const lista = getPerfis();
  const role = perfil.role || "vendedor";
  const novo = {
    id: perfil.id || `u-${Date.now().toString(36)}`,
    nome: perfil.nome,
    email: perfil.email || "",
    cor: perfil.cor || ROLES[role].cor,
    role,
    permissoes: { ...ROLES[role].permissoes, ...(perfil.permissoes || {}) },
  };
  lista.push(novo);
  savePerfis(lista);
  return novo;
}

export function removePerfil(id) {
  const lista = getPerfis().filter(p => p.id !== id);
  // Sempre mantém pelo menos um perfil
  if (lista.length === 0) lista.push(PERFIL_PADRAO);
  savePerfis(lista);
  // Se removeu o ativo, troca pro primeiro
  const ativo = getPerfilAtivo();
  if (!lista.find(p => p.id === ativo.id)) {
    setPerfilAtivo(lista[0].id);
  }
}

export function updatePerfil(id, patch) {
  const lista = getPerfis().map(p => {
    if (p.id !== id) return p;
    const role = patch.role || p.role;
    return {
      ...p,
      ...patch,
      role,
      permissoes: patch.permissoes ?? (patch.role ? ROLES[role].permissoes : p.permissoes),
    };
  });
  savePerfis(lista);
}

export function getRoles() { return ROLES; }

/**
 * Hook utilitário pra checar se o perfil ativo tem acesso a um módulo.
 * Aceita "financas" | "invest" | "config".
 * Retorna: true (full) · "view" (só leitura) · false (sem acesso).
 */
export function temPermissao(modulo) {
  const p = getPerfilAtivo();
  return p?.permissoes?.[modulo] ?? false;
}
