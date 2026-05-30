# 📷 Escanear recibo por foto — Cronograma (PRÓXIMA FEATURE)

> **Status:** 🔖 Marcado para a próxima — ainda não iniciado.
> **Decisão tomada:** rota **Foto → Worker Cloudflare (Claude Vision)**.
> Melhor precisão e mantém a `ANTHROPIC_API_KEY` no Worker (nunca no app).

## Arquitetura (visão geral)

```
Telefone (app no navegador)
  │  tira foto (câmera) → comprime no cliente
  ▼
Worker Cloudflare  /api/recibo   ← guarda ANTHROPIC_API_KEY (secret)
  │  chama Claude Vision (Haiku 4.5) com schema JSON
  ▼
Retorna { loja, cnpj, data, valor, itens[], categoriaSugerida, pagamento }
  │
  ▼
Tela de confirmação (pré-preenchida) → cria transação
  (usa a detecção de duplicidade que já existe — chaveTransacao)
```

Nada é gravado no servidor — a imagem só transita, o resultado volta e fica
**local** no telefone. Mantém o app local-first; só a extração é remota.

## Fases

### Fase 0 — Setup & decisões · ~0,5 sessão
- [ ] Definir modelo de visão: **Claude Haiku 4.5** (barato/rápido); Sonnet só se precisar de mais precisão
- [ ] Definir o **schema de campos** (loja, CNPJ, data, valor total, itens, categoria, forma de pagamento)
- [ ] Criar secret `ANTHROPIC_API_KEY` no Worker
- [ ] **Proteção do endpoint** (endpoint público gasta a API): header secreto/PIN na config do app + rate limit

### Fase 1 — Backend: Worker de extração · ~1 sessão
- [ ] Endpoint `POST /api/recibo` (imagem base64/multipart)
- [ ] Validação de tamanho/tipo + rate limit + auth por header secreto
- [ ] Chamada Claude Vision com **tool/JSON schema** (saída estruturada) + **prompt caching** no system prompt
- [ ] Normalização da resposta + tratamento de erro (foto ruim, sem valor, etc.)
- [ ] Testes (mock da API) + deploy do Worker

### Fase 2 — Frontend: captura & upload · ~1 sessão
- [ ] Botão **"📷 Escanear recibo"** no fluxo de nova transação / no extrato
- [ ] `<input capture="environment">` abre a câmera; preview + opção *refazer*
- [ ] **Compressão no cliente** (canvas → ~1024px, JPEG) pra baixar custo/upload
- [ ] Estados de loading / erro

### Fase 3 — Revisão & importação · ~1 sessão
- [ ] Tela de confirmação **pré-preenchida** (loja, data, valor, categoria)
- [ ] Mapear **categoria sugerida → categorias existentes** do cockpit
- [ ] Criar transação reaproveitando a **detecção de duplicidade** (`chaveTransacao`)
- [ ] Opção de anexar a foto (thumbnail no IndexedDB) ou descartar

### Fase 4 — Polimento & "app no telefone" · ~0,5–1 sessão
- [ ] Mensagens de erro amigáveis + comportamento offline
- [ ] **Manifest PWA / "Adicionar à tela inicial"** → abre como app no celular
- [ ] (opcional) recibo com vários itens → dividir em transações
- [ ] Build + testes + merge

### Fase 5 — Futuro (opcional)
- Histórico de recibos escaneados
- Fallback OCR local (Tesseract) se o Worker cair
- Leitura de **QR Code de NFC-e** como caminho alternativo (dados 100% exatos)

## Resumo de esforço

| Fase | Esforço | Entrega |
|---|---|---|
| 0 Setup | ~0,5 | Worker + secret + schema |
| 1 Backend | ~1 | `/api/recibo` no ar |
| 2 Captura | ~1 | Foto pelo telefone |
| 3 Importação | ~1 | Vira transação |
| 4 Polimento | ~0,5–1 | PWA + erros |
| **Total MVP (0–3)** | **~3,5 sessões** | fluxo completo funcionando |

## ⚠️ Pontos de atenção
- **Custo:** ~centavos por foto (Haiku). Com rate limit, controlado.
- **Endpoint público:** precisa do PIN/secret (Fase 0), senão qualquer um gasta a API.
- **Privacidade:** a imagem passa por Anthropic na extração; nada fica armazenado no servidor.
