# JARVIS OS

Assistente pessoal por voz: Claude Code (motor) + vault markdown (memória) + voz 100% local (Whisper + `say`) + HUD de tela única.

## Rodar

```bash
node jarvis/server/server.js
```

Abra <http://127.0.0.1:4780>. No Claude Code desktop, o servidor também está em `.claude/launch.json` (nome `jarvis`).

## Como usar

- **Segure ESPAÇO** (ou o botão ● REC) e fale; solte para transcrever e enviar. Ou digite e dê Enter.
- A resposta volta no console e é falada em voz alta (voz Luciana, pt-BR).
- Comandos que ativam as skills:
  - "resumo da manhã" → briefing do dia (`jarvis-resumo`)
  - "planeje o dia: X, Y, Z" → grava o top 3 em `Hoje.md` (`jarvis-plano`)
  - "registre a métrica patrimônio = R$ …" / "como estão meus números" (`jarvis-metricas`)
  - "análise da semana" (`jarvis-tendencias`)
  - "lembre que…", "adicione a tarefa…", "encerre o dia" (`jarvis-vault`)

## Peças

| Pasta | O quê |
|---|---|
| `vault/` | Memória em markdown (Hoje, Tarefas, Metricas, Memoria, Diario/). Abra como vault do Obsidian se quiser. |
| `server/server.js` | Servidor Node sem dependências: HUD + `/api/ask` (Claude Code CLI) + `/api/stt` (whisper.cpp) + `/api/tts` (`say`). |
| `hud/` | A tela única (HTML puro). |
| `runtime/` | `bin/whisper-cli` (compilado local, Metal) e `models/ggml-small-q5_1.bin` (não versionado). |
| `../.claude/skills/jarvis-*` | As 5 skills que o motor usa. |

## Privacidade

Áudio nunca sai da máquina: STT é whisper.cpp local (Metal), TTS é o `say` do macOS. O texto dos comandos vai para o Claude Code CLI normal.

## Config (env)

`JARVIS_PORT` (4780), `JARVIS_VOICE` (Luciana), `JARVIS_WHISPER`, `JARVIS_MODEL`, `CLAUDE_BIN`.

## Restaurar o whisper em outra máquina

```bash
git clone --depth 1 https://github.com/ggml-org/whisper.cpp && cd whisper.cpp
cmake -B build -DBUILD_SHARED_LIBS=OFF && cmake --build build -j --target whisper-cli
cp build/bin/whisper-cli ../jarvis/runtime/bin/
curl -L -o ../jarvis/runtime/models/ggml-small-q5_1.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin
```
