# 🚀 Checklist — Catálogo AF4 em produção

Lista de tarefas pra colocar o catálogo no ar. Marcado com:
- 🧑 = depende de você (dados, contas, decisão)
- 🤖 = posso fazer / já automatizado
- ⏱️ = estimativa rápida

---

## 1. Conteúdo real (substituir o exemplo)
- [ ] 🧑 Definir os **veículos reais** do estoque (marca, modelo, versão, ano, km, câmbio, combustível, cor, preço, opcionais).
- [ ] 🧑 Reunir as **fotos** de cada carro (de preferência boa qualidade, proporção paisagem). Colocar em `apps/catalogo/public/` ou usar links.
- [ ] 🤖 Preencher `src/data/veiculos.js` com os carros reais (me manda a lista que eu insiro).
- [ ] 🧑 Conferir **preços e disponibilidade** (o que está vendido marca `vendido: true`).

## 2. Dados da loja / vendedor (`src/config.js`)
- [ ] 🧑 Confirmar **nome da loja** (AF4) e chamada.
- [ ] 🧑 **WhatsApp real** (formato `55` + DDD + número, só dígitos).
- [ ] 🧑 **Instagram** real (@ e link).
- [ ] 🧑 **Cidade / região** de atendimento.
- [ ] 🧑 Nome do **vendedor** (ou da loja) e foto/logo (opcional).
- [ ] 🤖 Aplicar tudo no `config.js` e testar o link do WhatsApp (mensagem pré-preenchida).

## 3. Identidade visual
- [x] 🤖 Paleta definida (laranja + vermelho + verde nos preços).
- [x] 🤖 Logo "AF" laranja / "4" vermelho.
- [ ] 🧑 (Opcional) Logo oficial em imagem (PNG/SVG) se houver — substituo o texto.
- [ ] 🤖 **Favicon** (ícone da aba) com a marca AF4.
- [ ] 🤖 **Imagem de preview (Open Graph)** — a “capa” que aparece ao compartilhar no WhatsApp/Instagram.

## 4. Deploy / hospedagem
- [ ] 🧑 Escolher **onde hospedar**: GitHub Pages (grátis), Cloudflare Pages (mesmo provedor dos outros apps) ou outro.
- [ ] 🧑 (Se quiser **domínio próprio**, ex.: `catalogo.af4...`) ter o domínio em mãos.
- [ ] 🤖 Configurar o **deploy automático** (build → publicar) na opção escolhida.
- [ ] 🤖 Gerar o **link público** e testar no celular.

## 5. Qualidade antes de publicar
- [ ] 🤖 Rodar `pnpm catalogo:build` e garantir build limpo.
- [ ] 🧑/🤖 Testar no **celular** (layout, rolagem, abrir card, botão WhatsApp).
- [ ] 🧑/🤖 Testar a **busca e filtros** (marca, câmbio, ordenação).
- [ ] 🤖 Conferir que as **fotos carregam** (e o fallback aparece quando faltar).
- [ ] 🧑 Revisar **textos e preços** (sem erro de digitação).

## 6. Publicação (PR #281)
- [ ] 🤖 Tirar o **PR #281 de draft** (pronto pra revisão).
- [ ] 🧑 **Aprovar / mandar mergear** pra `main`.
- [ ] 🤖 Confirmar o **deploy no ar** e mandar o link final.

## 7. Pós-produção (opcional, depois)
- [ ] 🤖 Integrar com o estoque do módulo **Negócio/Veículos** (catálogo puxa os carros disponíveis automaticamente).
- [ ] 🤖 **Analytics** (quantas visitas / cliques no WhatsApp).
- [ ] 🤖 Botão de **compartilhar** e/ou QR Code do catálogo pra divulgar.

---

### Caminho mais rápido pra amanhã (mínimo viável)
1. Você me manda **lista de carros + fotos** e os **dados reais** (WhatsApp, Instagram, cidade).
2. Eu **preencho**, gero **favicon + capa de compartilhamento**, e **configuro o deploy**.
3. Testamos no celular, **tiro o PR de draft** e mergeamos.
4. Mando o **link público** → no ar. ✅

> Estimativa: se os dados/fotos estiverem prontos, dá pra ir ao ar em **~1-2h** de trabalho.
