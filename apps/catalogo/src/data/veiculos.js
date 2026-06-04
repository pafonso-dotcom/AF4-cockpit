// =============================================================
//  ESTOQUE DO CATÁLOGO  (dados de exemplo — edite à vontade)
//
//  Cada veículo:
//    {
//      id:        identificador único (qualquer string)
//      marca:     "Volkswagen"
//      modelo:    "T-Cross"
//      versao:    "200 TSI Automático"        (opcional)
//      ano:       "2022/2023"
//      km:        38000                        (em km, número — opcional)
//      cambio:    "Automático" | "Manual"
//      combustivel: "Flex" | "Gasolina" | "Diesel" | "Híbrido" | "Elétrico"
//      cor:       "Branco"                     (opcional)
//      preco:     89900                        (número, em reais)
//      destaque:  true                         (opcional — fita "Destaque")
//      vendido:   false                        (true esconde/risca o card)
//      foto:      "https://..."                (opcional — sem foto vira placeholder)
//      extras:    ["Completo", "Único dono"]   (opcional — chips)
//    }
//
//  Dica: as fotos abaixo apontam pra Unsplash. Se estiver offline ou
//  quiser usar fotos próprias, troque a URL ou coloque a imagem em
//  /public e use "/minha-foto.jpg". Sem foto, o card mostra um
//  placeholder elegante — nada quebra.
// =============================================================

export const VEICULOS = [
  {
    id: "tcross",
    marca: "Volkswagen",
    modelo: "T-Cross",
    versao: "200 TSI Automático",
    ano: "2022/2023",
    km: 31200,
    cambio: "Automático",
    combustivel: "Flex",
    cor: "Branco",
    preco: 89900,
    destaque: true,
    vendido: false,
    foto: "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=1200&q=80",
    extras: ["Completo", "Único dono", "Revisado"],
  },
  {
    id: "corolla",
    marca: "Toyota",
    modelo: "Corolla",
    versao: "XEI 2.0 Flex",
    ano: "2021/2022",
    km: 45800,
    cambio: "Automático",
    combustivel: "Flex",
    cor: "Prata",
    preco: 109900,
    destaque: false,
    vendido: false,
    foto: "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?auto=format&fit=crop&w=1200&q=80",
    extras: ["Completo", "Couro", "Multimídia"],
  },
  {
    id: "civic",
    marca: "Honda",
    modelo: "Civic",
    versao: "EXL 2.0 Flex",
    ano: "2020/2020",
    km: 52300,
    cambio: "Automático",
    combustivel: "Flex",
    cor: "Preto",
    preco: 114900,
    destaque: true,
    vendido: false,
    foto: "https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?auto=format&fit=crop&w=1200&q=80",
    extras: ["Completo", "Teto solar", "Couro"],
  },
  {
    id: "captur",
    marca: "Renault",
    modelo: "Captur",
    versao: "Intense 1.6 Flex",
    ano: "2022/2023",
    km: 28700,
    cambio: "Automático",
    combustivel: "Flex",
    cor: "Vermelho",
    preco: 94900,
    destaque: false,
    vendido: false,
    foto: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80",
    extras: ["Completo", "Revisado"],
  },
  {
    id: "hbgol",
    marca: "Volkswagen",
    modelo: "Nivus",
    versao: "Highline 200 TSI",
    ano: "2021/2022",
    km: 39400,
    cambio: "Automático",
    combustivel: "Flex",
    cor: "Cinza",
    preco: 99900,
    destaque: false,
    vendido: false,
    foto: "https://images.unsplash.com/photo-1542362567-b07e54358753?auto=format&fit=crop&w=1200&q=80",
    extras: ["Completo", "Multimídia"],
  },
  {
    id: "hilux",
    marca: "Toyota",
    modelo: "Hilux",
    versao: "SRX 2.8 Diesel 4x4",
    ano: "2020/2021",
    km: 78900,
    cambio: "Automático",
    combustivel: "Diesel",
    cor: "Branco",
    preco: 239900,
    destaque: true,
    vendido: false,
    foto: "https://images.unsplash.com/photo-1559416523-140ddc3d238c?auto=format&fit=crop&w=1200&q=80",
    extras: ["4x4", "Couro", "Completo"],
  },
  {
    id: "compass",
    marca: "Jeep",
    modelo: "Compass",
    versao: "Longitude 1.3 T270",
    ano: "2022/2022",
    km: 41200,
    cambio: "Automático",
    combustivel: "Flex",
    cor: "Prata",
    preco: 129900,
    destaque: false,
    vendido: false,
    foto: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=80",
    extras: ["Completo", "Multimídia", "Revisado"],
  },
  {
    id: "onix",
    marca: "Chevrolet",
    modelo: "Onix",
    versao: "Premier 1.0 Turbo",
    ano: "2021/2022",
    km: 36500,
    cambio: "Automático",
    combustivel: "Flex",
    cor: "Branco",
    preco: 79900,
    destaque: false,
    vendido: true,
    foto: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1200&q=80",
    extras: ["Completo", "Único dono"],
  },
];
