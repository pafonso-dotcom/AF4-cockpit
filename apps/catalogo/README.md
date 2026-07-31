# Catálogo de Veículos · Seminovos

Página pública de **catálogo de carros usados** — "apresentação que vende".
Pensada pra compartilhar no **WhatsApp e Instagram**: visual escuro com
detalhes em vermelho, cards de veículo com foto, ficha (ano, câmbio,
combustível, km), preço em destaque e contato direto do vendedor.

App standalone do monorepo `af4-financecars` (Vite + React + Tailwind).

## Rodar

Na raiz do repositório:

```bash
pnpm install                # instala as dependências do workspace (uma vez)
pnpm catalogo:dev           # sobe em http://localhost:5173
```

Ou direto na pasta do app:

```bash
cd apps/catalogo
pnpm dev                    # desenvolvimento
pnpm build                  # gera dist/ (estático, pronto pra publicar)
pnpm start                  # preview do build (porta 3005)
```

O `build` gera uma pasta `dist/` estática — pode hospedar em qualquer
lugar (GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.).

## Como editar (sem mexer em código)

Tudo que você normalmente quer trocar está em **dois arquivos**:

### 1. Carros do catálogo — `src/data/veiculos.js`

Lista de objetos. Cada carro:

```js
{
  id: "tcross",                 // identificador único
  marca: "Volkswagen",
  modelo: "T-Cross",
  versao: "200 TSI Automático", // opcional
  ano: "2022/2023",
  km: 31200,                    // opcional (número)
  cambio: "Automático",         // "Automático" | "Manual"
  combustivel: "Flex",          // Flex | Gasolina | Diesel | Híbrido | Elétrico
  cor: "Branco",                // opcional
  preco: 89900,                 // número, em reais
  destaque: true,               // opcional — fita "Destaque"
  vendido: false,               // true risca/joga pro fim
  foto: "https://...",          // opcional — sem foto vira placeholder
  extras: ["Completo", "Único dono"], // opcional — chips
}
```

**Fotos:** pode usar URL externa ou colocar a imagem em `public/` e
referenciar como `"/minha-foto.jpg"`. Se a foto faltar ou não carregar
(ex.: offline), o card mostra um placeholder elegante — nada quebra.

### 2. Loja e vendedor — `src/config.js`

Nome da loja, chamada, e os dados do rodapé: **vendedor, WhatsApp,
Instagram, cidade**. O número do WhatsApp deve ter só dígitos, com
`55` + DDD (ex.: `5511999999999`). Os botões já montam a mensagem
pré-preenchida com o carro escolhido.

## Estrutura

```
src/
  config.js              loja + vendedor + link do WhatsApp
  data/veiculos.js       estoque (dados de exemplo)
  lib/format.js          formatação de preço e km
  components/
    Hero.jsx             cabeçalho + selos de confiança
    Filtros.jsx          busca + filtros (marca, câmbio, ordenação)
    CarroCard.jsx        card do veículo
    CarroModal.jsx       detalhes + CTA de WhatsApp
    CarImage.jsx         imagem com fallback
    Vendedor.jsx         rodapé do vendedor + "Comprar agora"
  App.jsx                monta tudo + estado dos filtros
```
