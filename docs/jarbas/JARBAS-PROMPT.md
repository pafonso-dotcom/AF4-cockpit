# PROJETO JARBAS — ⏸️ pausado em 2026-09-23

Assistente pessoal de voz estilo Jarvis do app **Afinanças** (`apps/cars-web`).
Removido da UI pra ser aperfeiçoado FORA do sistema; **todo o código continua
no repo, dormente e testado** — é só replugar (seção "Como replugar").

---

## 1 · Visão

Uma IA pessoal que o Paulo abre por uma bolha flutuante e conversa **por voz,
sem apertar botão**: ela dá bom-dia com o resumo do dia, responde qualquer
pergunta sobre os dados do app (saldos, cartões, vencimentos, carteira),
pesquisa na internet quando precisa, lembra o que ele pedir pra lembrar e
mostra os valores por escrito na tela. Custo alvo: **R$ 0** (tudo na cota
gratuita do Gemini; a chave já fica em Configurações → APIs).

## 2 · O que JÁ FUNCIONA (arquivos no repo)

| Peça | Arquivo | O que faz |
|---|---|---|
| Lógica/prompts | `apps/cars-web/src/lib/jarbas.js` | Persona pt-BR falável; bom-dia LOCAL (`montarBomDia`, sem API; modo oculto não fala saldo); contexto COMPLETO (`montarContextoJarbas`: resumo do mês + contas por nome + cartões c/ fatura pendente/limite/fechamento + vence em 7 dias + agenda de hoje + MEMÓRIAS); prompts de áudio/texto/web com campos `destaques`/`memorizar`/`buscaWeb` |
| Fala (TTS) | `apps/cars-web/src/lib/tts.js` | Gemini TTS voz **"Charon"** (masculina, grave) via `gemini-2.5-flash-preview-tts` (PCM→WAV, `pcmParaWav`); fallback automático pra voz nativa (prioriza Felipe/Daniel pt-BR); `falar({aoIniciar})` e `pararFala()` interrompível (barge-in) |
| Detecção de fala | `apps/cars-web/src/lib/vad.js` | VAD por RMS com histerese: fim de turno após 1,1s de silêncio (mín. 250ms de voz); modo "falando" só detecta fala ALTA e sustentada ≥550ms (barge-in à prova de eco). `avaliarVad` pura + `criarMonitorFala` (AudioContext) |
| Tela da chamada | `apps/cars-web/src/components/JarbasChamada.jsx` | HUD cinematográfico (fundo blueprint, paleta ciano própria); loop ouvindo→pensando→(web)→voz→falando→ouvindo; MediaRecorder iOS-safe; barge-in; barrinha de texto ⌨️; cartões de **destaques** (valores grandes); **fontes** da web em chips; painel 🧠 de memórias; "← Voltar" no topo + safe-area + popstate (voltar do sistema fecha só o Jarbas); nível do mic via CSS var `--jnivel` (zero re-render) |
| Orbe HUD | `apps/cars-web/src/components/JarbasOrbe.jsx` | SVG+CSS puro: anéis de ticks, arcos em contra-rotação, glow GPU-barato reativo à voz, power-up; modo `estatico` pra bolha |
| Bolha | `apps/cars-web/src/components/JarbasBolha.jsx` | Chat head arrastável (posição em `af4:jarbas-bolha:v1`), abre a conversa com 1 toque |
| Busca web | `apps/cars-web/src/lib/gemini.js` | `gerarTextoGeminiComBusca` (Google Search grounding) + `extrairFontesGrounding` (pura, testada); também `gerarJSONGeminiComAudio` (transcreve E responde numa chamada) |
| Testes | `lib/__tests__/{jarbas,vad}.test.js` | 14 testes verdes (bom-dia, contexto, VAD, barge-in, fontes, WAV) |

## 3 · Decisões tomadas
- Voz **masculina** (Charon) mantida mesmo custando 2-6s de geração — usuário escolheu qualidade sobre velocidade; a espera é transparente ("Preparando a voz…" + texto aparece na hora).
- **Barge-in ligado** (falar por cima interrompe), com echoCancellation + limiar alto.
- **Sem modal de chat** — só a tela HUD; texto é uma barrinha embutida.
- Memórias e (na época) `jarbasMemoria` sincronizavam no estado com lápides (`tumbas`) na exclusão.
- Limitações de PWA aceitas: áudio só após 1 toque; nada de escuta com app fechado.

## 4 · Dores conhecidas / o que aperfeiçoar
- **Latência**: turno completo ~4-8s (Gemini entender ~2-4s + TTS ~2-6s). Ideias: TTS nativo opcional "⚡ rápido", streaming, modelo flash-lite.
- **VAD fixo**: limiares únicos — ambiente barulhento pode cortar cedo/tarde (falta controle de sensibilidade).
- **Pendências do plano "IA pessoal"** (itens 3-6): ações por voz (criar transação/lembrete/tarefa com confirmação), histórico completo rolável na tela, proatividade ao abrir (comentar o urgente primeiro), legenda em tempo real.

## 5 · Como replugar no app (fiação removida em 2026-09-23)
1. `App.jsx`: estados `jarbasOpen`(bool)/`jarbasMsgs`/`jarbasMemoria` + `setJarbasMemoria` no SETTERS + `jarbasMemoria` no `montarDados()` e nas deps do save; lazies `JarbasChamada`/`JarbasBolha`; render `{jarbasOpen && <JarbasChamada dados={{contas, cartoes, transacoes, ativos, devedores, dividas, cheques, fixas, fixaOcorrencias, parcelamentos, agenda, lembretes, tarefas, memorias: jarbasMemoria}} apiKeys msgs setMsgs onMemorizar onEsquecer(+tumba "jarbasMemoria") onEncerrar/>}` + `{!loading && !jarbasOpen && <JarbasBolha onAbrir/>}`; item 🤖 no FAB.
2. `Header.jsx`: prop `onAbrirJarbas` nas duas variantes + botão `Bot` nas fileiras de utilitários.
3. `appPersistencia.js`: `if (S.setJarbasMemoria) S.setJarbasMemoria(data.jarbasMemoria || [])` (+ `[]` no seeds).
4. (Opcional) Olhada rápida: botões "▶ Ouvir o bom-dia" (`falar(montarBomDia(...))`) e "🤖 Perguntar".

## 6 · PROMPT DE RETOMADA (colar numa sessão nova)

```
Quero continuar o projeto JARBAS — assistente pessoal de voz estilo Jarvis.
Leia docs/jarbas/JARBAS-PROMPT.md do repo pafonso-dotcom/AF4-cockpit: lá está
a visão, tudo que já funciona (código dormente em apps/cars-web/src/lib/
{jarbas,tts,vad}.js e components/Jarbas*.jsx, com testes verdes), as decisões
tomadas, as dores conhecidas e como replugar no app.

Contexto: app pessoal Afinanças (apps/cars-web; NUNCA mexer no numvi-financas),
React+Vite PWA no Cloudflare, chave Gemini do usuário em Configurações → APIs
(cota grátis; voz TTS "Charon"). Branch claude/numvi-pessoal-changes-YHaEK;
auto-merge liberado (testes+build verdes → squash no main).

Objetivo desta fase: aperfeiçoar o Jarbas FORA da UI do app (pode criar uma
página/ambiente próprio de testes) até ficar redondo — foco em: [PREENCHER:
latência / ações por voz / proatividade / ...]. Quando eu aprovar, replugar
no app seguindo a seção "Como replugar".
```

---
*Histórico: construído em 2026-09-22 (PRs #768-#773) · pausado em 2026-09-23.*
