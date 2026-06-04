// =============================================================
//  CONFIGURAÇÃO DA LOJA / VENDEDOR
//  Edite aqui os dados que aparecem no topo e no rodapé do catálogo.
//  Nada de código pra mexer — só trocar os textos entre aspas.
// =============================================================

export const LOJA = {
  nome: "Seu Carro Seminovos",
  selo: "Seminovos selecionados",
  // Chamada principal do topo
  titulo: "Catálogo de Veículos",
  subtitulo: "Apresentação que vende!",
  descricao:
    "Veículos revisados, com garantia de qualidade e procedência comprovada. Escolha o seu e fale agora com o vendedor.",

  // Vendedor (rodapé)
  vendedor: "João Silva",
  vendedorCargo: "Atendimento personalizado para realizar seu sonho",
  // Telefone só com dígitos, com DDI 55 + DDD (usado no link do WhatsApp)
  whatsapp: "5511999999999",
  // Como o telefone aparece na tela
  telefoneExibicao: "(11) 99999-9999",
  instagram: "@joaosilvaveiculos",
  instagramUrl: "https://instagram.com/joaosilvaveiculos",
  cidade: "São Paulo - SP",
  // Foto/logo do vendedor (deixe "" pra usar as iniciais)
  vendedorFoto: "",
};

// Selos de confiança exibidos no topo
export const SELOS = [
  "Veículos revisados",
  "Garantia de qualidade",
  "Confiança e transparência",
  "Procedência comprovada",
];

// Monta a mensagem do WhatsApp pré-preenchida ao clicar num carro.
export function linkWhatsApp(carro) {
  const txt = carro
    ? `Olá ${LOJA.vendedor}! Tenho interesse no ${carro.marca} ${carro.modelo} ${
        carro.versao || ""
      } (${carro.ano}) por ${carro.precoFmt || ""}. Ainda está disponível?`
    : `Olá ${LOJA.vendedor}! Vi o catálogo e gostaria de mais informações.`;
  return `https://wa.me/${LOJA.whatsapp}?text=${encodeURIComponent(txt.trim())}`;
}
