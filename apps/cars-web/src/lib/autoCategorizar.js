// Auto-categorização por palavra-chave da descrição.
// Serve pra limpar em massa as transações que ficaram em "Outros" (ou sem
// categoria) — tipicamente importadas de extrato bancário.
//
// A engine é PURA: só SUGERE. Quem aplica é a UI, depois da aprovação do usuário.
// Regra de ouro: só sugere categoria que JÁ EXISTE no cadastro do usuário
// (não inventa categoria nova, não cria órfã).

// Cada regra: { cat: nome-da-categoria-alvo, re: /regex na descrição/, tipo?: "despesa"|"receita" }
// A ordem importa — a primeira que casar vence.
export const REGRAS = [
  { cat: "Taxas Bancos", re: /\btarifa\b|\biof\b|cblc|anuidade|\bjuros\b|manuten[çc][aã]o de conta|\btaxa\b|cesta de servi/i },
  { cat: "Investimento", re: /capitaliza|aplica[çc]|resgate|\baporte\b|tesouro direto|\bcdb\b|renda fixa|previd[êe]ncia|compra de a[çc][õo]es|c\/c invest/i },
  { cat: "Alimentação", re: /mercad|padaria|super\b|superm|hortifruti|a[çc]ougue|restaurante|lanchonete|ifood|rappi|sonoda|bolos?|pizzar|panific|\bp[ãa]o\b|confeitar|churrasc|adega|empório|emporio/i },
  { cat: "Transporte", re: /\bposto\b|combust|gasolin|\buber\b|99app|99\s*tecnolog|cabify|estacionament|ped[áa]gio|\bipva\b|\bshell\b|ipiranga|petrobr/i },
  { cat: "Saúde", re: /farm[áa]c|drogaria|drogas|hospital|cl[íi]nic|laborat|dentist|\bexame|psic[óo]log|fisioterap|[óo]tica/i },
  { cat: "Loterias e Apostas", re: /loteria|\baposta|\bbet\b|betano|\bblaze\b|caixa loterias/i },
  { cat: "Suplementos", re: /suplement|\bwhey\b|creatina|\bmax titanium|growth\b/i },
  { cat: "Assinaturas", re: /netflix|spotify|prime video|disney|hbo|max\b|youtube premium|assinatura|amazon prime/i },
  { cat: "Compra Internet", re: /aliexpress|shopee|amazon\.com|amzn|mercado ?livre|mercadolivre|magalu|americanas/i },
];

// Uma transação "precisa de categoria" quando está em Outros, vazia ou fora do
// cadastro (órfã).
export function precisaCategoria(t, nomesValidos) {
  const c = (t?.categoria || "").trim();
  if (!c) return true;
  if (c.toLowerCase() === "outros") return true;
  return !nomesValidos.has(c);
}

/**
 * Sugere categorias pras transações que precisam, aplicando as REGRAS na ordem.
 * @param {Array} transacoes
 * @param {Array} categorias  cadastro (objetos { nome, tipo })
 * @param {object} [opts] { regras }
 * @returns {{
 *   sugestoes: Array<{ id, descricao, valor, tipo, atual, sugerida }>,
 *   porCategoria: Record<string, Array>,   // agrupado pela sugestão
 *   semSugestao: number                     // quantas precisam mas nenhuma regra casou
 * }}
 */
export function sugerirCategorias(transacoes = [], categorias = [], opts = {}) {
  const regras = opts.regras || REGRAS;
  const nomesValidos = new Set((categorias || []).map((c) => c.nome).filter(Boolean));
  const sugestoes = [];
  let semSugestao = 0;

  (transacoes || []).forEach((t) => {
    if (!precisaCategoria(t, nomesValidos)) return;
    const desc = t?.descricao || "";
    const regra = regras.find((r) => (!r.tipo || r.tipo === t.tipo) && r.re.test(desc) && nomesValidos.has(r.cat));
    if (!regra) { semSugestao += 1; return; }
    if (regra.cat === (t.categoria || "")) return; // já está lá
    sugestoes.push({
      id: t.id,
      descricao: desc,
      valor: Number(t.valor) || 0,
      tipo: t.tipo,
      atual: t.categoria || "",
      sugerida: regra.cat,
    });
  });

  const porCategoria = {};
  sugestoes.forEach((s) => {
    (porCategoria[s.sugerida] = porCategoria[s.sugerida] || []).push(s);
  });

  return { sugestoes, porCategoria, semSugestao };
}
