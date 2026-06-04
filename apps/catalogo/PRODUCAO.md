# 🚀 Checklist — Catálogo AF4 em produção

Lista de tarefas pra colocar o catálogo no ar. Marcado com:
- 🧑 = depende de você (dados, contas, decisão)
- 🤖 = posso fazer / já automatizado

> **Status (04/06):** estrutura, visual, favicon, capa, deploy e o 1º carro
> real (VW Polo) já estão prontos. Falta principalmente **conteúdo real**
> (fotos + demais carros + dados do vendedor) e **ativar o GitHub Pages**.

---

## 1. Conteúdo real (substituir o exemplo)
- [~] 🧑 Veículos reais — **1 de N** cadastrado (VW Polo 1.0 Track 2025). Faltam os demais.
- [ ] 🧑 Reunir as **fotos** de cada carro (paisagem, boa qualidade).
- [~] 🤖 Preencher `src/data/veiculos.js` — Polo inserido; insiro o resto quando chegar.
- [ ] 🧑 Conferir **preços e disponibilidade** (vendido → `vendido: true`).
- [ ] 🧑 Decidir: **remover os carros de exemplo** (deixar só os reais)?

## 2. Dados da loja / vendedor (`src/config.js`)
- [x] 🤖 Nome da loja **AF4** e chamada.
- [x] 🤖 **WhatsApp real** — (15) 99823-3299 (testado, mensagem pré-preenchida OK).
- [ ] 🧑 **Instagram** real (@ e link).
- [ ] 🧑 **Cidade / região** de atendimento (DDD 15 ≈ Sorocaba? confirmar).
- [ ] 🧑 Nome do **vendedor** (hoje placeholder "João Silva") e foto/logo (opcional).

## 3. Identidade visual
- [x] 🤖 Paleta (laranja + vermelho + verde nos preços).
- [x] 🤖 Logo "AF" laranja / "4" vermelho.
- [x] 🤖 **Favicon** (ícone da aba) AF4.
- [x] 🤖 **Apple touch icon** (ícone ao salvar na tela inicial).
- [x] 🤖 **Imagem de capa (Open Graph)** pra compartilhar.
- [ ] 🧑 (Opcional) Logo oficial em imagem, se houver.

## 4. Deploy / hospedagem
- [x] 🤖 **Deploy configurado** — workflow GitHub Pages (`.github/workflows/catalogo-pages.yml`).
- [ ] 🧑 **Ativar o Pages**: Settings → Pages → Source: **"GitHub Actions"** (uma vez).
- [ ] 🧑 (Opcional) **Domínio próprio**.
- [ ] 🤖 Confirmar o **link público** e testar no celular (após ativar o Pages + merge).

## 5. Qualidade antes de publicar
- [x] 🤖 Build limpo (`pnpm catalogo:build`).
- [x] 🤖 Testado layout desktop/mobile, busca, filtros, galeria, fallback de foto.
- [ ] 🧑 Revisar **textos e preços** finais (sem erro de digitação).

## 6. Publicação (PR #281)
- [x] 🤖 PR pronto pra revisão (saiu de draft).
- [ ] 🧑 **Aprovar / mergear** pra `main`.
- [ ] 🤖 Confirmar o **deploy no ar** e mandar o link final.

## 7. Pós-produção (opcional, depois)
- [ ] 🤖 Integrar com o estoque do módulo **Negócio/Veículos** (catálogo automático).
- [ ] 🤖 **Analytics** (visitas / cliques no WhatsApp).
- [ ] 🤖 Botão de **compartilhar** e/ou **QR Code** pra divulgar.

---

### Pra amanhã (o que falta, em ordem)
1. 🧑 Me manda **as 5 fotos do Polo** + os **demais carros** (com fotos).
2. 🧑 **Nome do vendedor**, **Instagram** e **cidade**.
3. 🤖 Eu cadastro tudo, removo os exemplos (se você confirmar) e reviso.
4. 🧑 **Ativar o GitHub Pages** (Settings → Pages → GitHub Actions).
5. 🧑 **Mergear o PR #281** → 🤖 confirmo o site no ar e mando o link. ✅

> Com fotos e dados em mãos, fechamos em **~1-2h**.
