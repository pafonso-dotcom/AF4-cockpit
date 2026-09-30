/**
 * Agrupamento SUGERIDO de categorias (🪄, pedido 2026-09-23): casa os nomes
 * das categorias soltas com grupos comuns de finanças pessoais e devolve a
 * proposta pai → filhas pro usuário REVISAR e aplicar. Aplicar só cria os
 * pais que faltam e seta `parentId` nas filhas — NENHUMA transação muda e
 * desfazer é limpar o pai na tela de Categorias.
 */
import { normNomeCat } from "./categoriasDiagnostico.js";

// Regras calibradas pela lista real do usuário (print de 2026-09-23;
// ampliadas em 2026-09-30 pra alinhar com a estrutura do pacote Completo —
// pedido "arruma a minha árvore, está uma bagunça").
// `chaves` são substrings comparadas sobre o nome normalizado; `exatas` são
// nomes que só casam por igualdade (pra siglas curtas tipo "IA", que como
// substring pegariam "farmácia"/"diária").
export const GRUPOS_SUGERIDOS = [
  // "gas" é exata: como substring capturaria "gasolina" (que é do Transporte).
  { pai: "Casa", chaves: ["iptu", "obras", "reforma", "manutencao da casa", "manutenção da casa", "piscineiro", "jardineiro", "condominio", "aluguel", "despesa de casa", "luz", "energia", "agua", "moradia", "conta de gas"], exatas: ["gas"] },
  { pai: "Assinaturas & Telecom", chaves: ["internet", "telefonia", "celular", "tik tok", "tiktok", "streaming", "spotify", "netflix", "assinatura", "chatgpt", "openai", "claude", "software", "aplicativo"], exatas: ["ia", "apps"] },
  { pai: "Transporte", chaves: ["transporte", "combustivel", "licenciamento", "ipva", "lavagem", "revisao", "estacionamento", "pedagio", "uber", "gasolina", "carro", "mecanica", "oficina"] },
  // Compras vem ANTES de Alimentação: "mercadolivre" precisa casar aqui,
  // senão a chave "mercado" da Alimentação o capturaria.
  { pai: "Compras", chaves: ["mercadolivre", "mercado livre", "vestuario", "shopee", "amazon", "eletronico", "roupa", "calcado", "cosmetico", "barbearia", "cabeleireiro", "salao"] },
  { pai: "Alimentação", chaves: ["alimentacao", "mercado", "padaria", "restaurante", "lanche", "ifood", "acougue", "hortifruti", "delivery", "feira"] },
  { pai: "Saúde", chaves: ["saude", "unimed", "medicamento", "farmacia", "suplemento", "suplimento", "dentista", "plano", "academia", "consulta", "exame", "terapia", "psicolog"] },
  { pai: "Educação", chaves: ["educacao", "faculdade", "curso", "livro", "material escolar"] },
  { pai: "Lazer & Viagens", chaves: ["lazer", "viagem", "viagens", "hotel", "loteria", "aposta", "cinema", "show", "hobby", "festa"] },
  { pai: "Tarifas, Juros & Impostos", chaves: ["iof", "juros", "tarifa", "taxa", "irrf", "imposto", "anuidade", "multa", "capitalizacao"] },
  { pai: "Família & Pets", chaves: ["mesada", "pets", "escola", "presente", "filho", "filhos", "brinquedo", "racao", "veterinario", "banho e tosa", "crianca"] },
  { pai: "Seguros", chaves: ["seguro"] },
  { pai: "Doações", chaves: ["doacao", "dizimo", "caridade"] },
  { pai: "Dívidas & Empréstimos", chaves: ["emprestimo", "financiamento", "consorcio", "divida"] },
  { pai: "Investimentos & Capital", chaves: ["investimento", "capital social", "aporte", "reserva de emergencia"] },
  { pai: "Movimentações", chaves: ["transferencia", "transf", "pag. diversos", "pag diversos", "pagamento fatura", "entre bancos"] },
];

const norm = (s) => normNomeCat(s);

// Acha o grupo de uma categoria pelo nome (1ª regra que casar; null = solta).
export function grupoDoNome(nome) {
  const n = norm(nome);
  if (!n) return null;
  for (const g of GRUPOS_SUGERIDOS) {
    // nome idêntico ao do grupo não é "filha" — é o próprio pai
    if (n === norm(g.pai)) return g.pai;
    if ((g.exatas || []).some(ex => n === norm(ex))) return g.pai;
    if (g.chaves.some(ch => n.includes(norm(ch)))) return g.pai;
  }
  return null;
}

/**
 * Monta a proposta a partir das categorias atuais.
 * Considera só RAÍZES de DESPESA (sem parentId) — quem já tem pai fica quieto.
 * Retorna { grupos: [{ paiNome, paiExistente, filhas }], soltas: [cat] }.
 * Grupo sem pai existente e com menos de 2 filhas é descartado (não vale
 * criar um pai pra uma filha só).
 */
export function sugerirAgrupamento(categorias = []) {
  const raizes = (categorias || []).filter(c =>
    c && !c.parentId && (c.tipo || "despesa") === "despesa");

  const porGrupo = {};
  const soltas = [];
  for (const c of raizes) {
    const g = grupoDoNome(c.nome);
    if (!g) { soltas.push(c); continue; }
    (porGrupo[g] ||= { paiExistente: null, filhas: [] });
    if (norm(c.nome) === norm(g)) porGrupo[g].paiExistente = c;
    else porGrupo[g].filhas.push(c);
  }

  const grupos = [];
  for (const g of GRUPOS_SUGERIDOS) {
    const e = porGrupo[g.pai];
    if (!e) continue;
    if (!e.filhas.length) continue; // só o pai, nada a agrupar
    if (!e.paiExistente && e.filhas.length < 2) { soltas.push(...e.filhas); continue; }
    grupos.push({ paiNome: g.pai, paiExistente: e.paiExistente, filhas: e.filhas });
  }
  return { grupos, soltas };
}

/**
 * Aplica os grupos ACEITOS: cria o pai que faltar e seta parentId nas filhas.
 * Puro — retorna a NOVA lista de categorias. `gerarId` injeta o uid().
 */
export function aplicarAgrupamento(gruposAceitos = [], categorias = [], gerarId = () => Math.random().toString(36).slice(2)) {
  let lista = [...(categorias || [])];
  let paisCriados = 0;
  let filhasAgrupadas = 0;

  for (const g of gruposAceitos) {
    if (!g.filhas?.length) continue;
    let paiId = g.paiExistente?.id;
    if (!paiId) {
      paiId = gerarId();
      lista.push({
        id: paiId, nome: g.paiNome, tipo: "despesa",
        cor: g.filhas[0]?.cor || "#9ca3af", limite: null,
      });
      paisCriados++;
    }
    const idsFilhas = new Set(g.filhas.map(f => f.id));
    lista = lista.map(c => idsFilhas.has(c.id) ? { ...c, parentId: paiId } : c);
    filhasAgrupadas += idsFilhas.size;
  }
  return { categorias: lista, paisCriados, filhasAgrupadas };
}
