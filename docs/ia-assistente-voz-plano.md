# 🎙️ IA de Assistência Pessoal por Voz — Relatório de Trabalho (2026-10-01)

**Pedido do Paulo (2026-09-30):** "criar uma IA de assistência pessoal no
programa, com comando de voz — eu peço o valor de tal cartão e ela me
responde. Para celular primeiro."

**Exemplo-guia:** 🎙 *"Qual o valor do cartão XP?"* → 🔊 *"A fatura do XP em
aberto é R$ 8.000,33, vence dia 15."*

---

## O que JÁ EXISTE pra reaproveitar (meio caminho andado)

| Peça | Onde | Serve pra |
|---|---|---|
| Reconhecimento de voz pt-BR | `VoiceTransacao.jsx` (Web Speech API) | Ouvir a pergunta |
| Chat com IA + chave Anthropic | `PergunteAoClaude.jsx` + `lib/aiChat.js` | Perguntas livres (fase 2) |
| Dados prontos e agregados | `lib/agregador.js`, `lib/aPagar.js`, `lib/possoGastar.js`, `resumoDia` | As respostas em si |
| Síntese de voz (falar a resposta) | `speechSynthesis` do navegador (o Jarbas usava) | Responder falando |
| PWA instalado no iPhone | já em uso | Acesso rápido, 1 toque |

⚠️ O projeto Jarbas foi **encerrado e removido** (2026-09-28) — este é um
recomeço **enxuto e focado**: assistente de CONSULTA, não um app de conversa.

## Arquitetura — 3 fases

### Fase 1 · MVP local (grátis, instantâneo, privado) — manhã
Botão 🎙 flutuante (só mobile) → Web Speech Recognition pt-BR →
**intenções por regras locais** (sem IA, resposta < 1s, offline):

1. **Cartão**: "valor/fatura do cartão X" → fatura em aberto + vencimento;
2. **Conta**: "saldo da conta X" → saldo atual (+ prévia da planilha se tiver);
3. **Posso gastar**: "quanto posso gastar hoje?" → número do card 💸;
4. **A pagar**: "quanto tenho a pagar (este mês)?" → lib/aPagar;
5. **Patrimônio**: "qual meu patrimônio?" → patrimonioTotal;
6. **Vencimentos**: "o que vence essa semana?" → próximos 7 dias.

Resposta aparece num balão na tela **e é falada** (speechSynthesis pt-BR).
Motor de intenções = lib pura `lib/assistenteIntencoes.js` (nome da
conta/cartão casado por aproximação — "xp", "itaú" etc.) **com testes**.

### Fase 2 · Fallback IA — tarde
Pergunta que não casa com regra nenhuma → vai pro motor do "Pergunte ao
Claude" com um resumo compacto dos dados como contexto → resposta falada.
(Usa a chave Anthropic já configurada; avisa custo/latência na 1ª vez.)

### Fase 3 · Depois (se quiser)
- Ações por voz ("lança 50 reais de mercado") — integrar o VoiceTransacao;
- Atalho da Siri abrindo o app direto no 🎙;
- Voz de resposta melhor (ElevenLabs — chave pendente de setup antigo).

## Risco nº 1 (testar LOGO cedo)
**Web Speech Recognition dentro do PWA instalado no iOS** tem histórico de
caprichos (funciona no Safari; no standalone pode precisar de fallback).
Plano B pronto: campo de texto com o **ditado do teclado do iPhone** (mesmo
resultado, 100% confiável) — o motor de intenções é o mesmo.

## Critérios de pronto (fase 1)
- [ ] 6 intenções acima respondendo certo no iPhone (falado + na tela);
- [ ] Nome de conta/cartão casando por aproximação (testes na lib);
- [ ] Sem microfone/permissão negada → cai no modo texto sem quebrar;
- [ ] Nada de áudio armazenado; tudo processado no aparelho (fase 1).

## Cronograma de amanhã (2026-10-01)
1. **Manhã**: lib de intenções + testes → botão 🎙 mobile → fala da resposta
   → teste real no iPhone do Paulo (decidir voz vs. ditado);
2. **Tarde**: fallback "Pergunte ao Claude" + polimento visual do balão;
3. Prints de preview ANTES de subir (combinado) + deploy único.
