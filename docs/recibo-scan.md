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

### Fase 1 — Backend: Worker de extração · ✅ FEITO
- [x] Endpoint `POST /api/recibo` — `worker/recibo.js`
- [x] Validação de tamanho (5 MB) / tipo (jpeg/png/webp/gif) + auth por header `x-recibo-pin`
- [x] Claude Vision (**Haiku 4.5**) com **tool/JSON schema** + **prompt caching** no system
- [x] Normalização (abs no valor, clamp confiança, data ISO) + erros 401/400/413/422/502
- [x] 11 testes (mock da API)

**Secrets a configurar no Worker (você roda na Cloudflare):**
```
wrangler secret put ANTHROPIC_API_KEY   # obrigatório
wrangler secret put RECIBO_PIN          # opcional, recomendado (protege o endpoint)
```
Sem `RECIBO_PIN` o endpoint fica aberto (só teste). Com ele, o app manda o header `x-recibo-pin`.

### Fase 2 — Frontend: captura & upload · ✅ FEITO
- [x] Modal de câmera já existia; agora aponta pro Worker `/api/recibo` (Claude),
      com **fallback** pro Gemini client-side se o Worker não estiver pronto
- [x] `<input capture="environment">` abre a câmera; preview + "Outra imagem"
- [x] **Compressão no cliente** (`lib/reciboWorker.js`: canvas → 1024px, JPEG 0.82)
- [x] Estados de loading / erro amigáveis (401/413/422/500/rede)
- [x] Campo **PIN do recibo** em Configurações → APIs (`af4:recibo-pin`)

### Fase 3 — Revisão & importação · ✅ FEITO
- [x] Tela de confirmação **pré-preenchida** (loja→descrição, data, valor, categoria, tipo)
- [x] **Categoria sugerida → categoria existente** do cockpit (case-insensitive)
- [x] Cria a transação (compensada) ao confirmar; badge mostra fonte + confiança
- [x] Obs recebe estabelecimento / forma de pagamento / alerta da IA
- Pendente (menor): anexar a foto como thumbnail; dedupe via chaveTransacao

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
