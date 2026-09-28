#!/usr/bin/env node
/**
 * JARVIS OS — servidor local (zero dependências).
 * Serve o HUD, roteia voz (STT/TTS locais) e conversa com o Claude Code CLI.
 *
 *   node jarvis/server/server.js
 *
 * Endpoints:
 *   GET  /            HUD
 *   GET  /api/state   estado: vault + status dos subsistemas + histórico
 *   POST /api/ask     { text } -> resposta do Claude Code (com skills jarvis-*)
 *   POST /api/stt     corpo = WAV 16kHz mono -> { text } via whisper.cpp
 *   POST /api/tts     { text } -> fala com a voz do macOS (local)
 *   POST /api/tts/stop
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const JARVIS = path.join(ROOT, 'jarvis');
const VAULT = path.join(JARVIS, 'vault');
const HUD = path.join(JARVIS, 'hud');
const RUNTIME = path.join(JARVIS, 'runtime');
const HISTORY_FILE = path.join(RUNTIME, 'history.jsonl');

const PORT = Number(process.env.JARVIS_PORT || 4780);
const VOICE = process.env.JARVIS_VOICE || 'Luciana';
const WHISPER_BIN = process.env.JARVIS_WHISPER || path.join(RUNTIME, 'bin', 'whisper-cli');
const WHISPER_MODEL = process.env.JARVIS_MODEL || path.join(RUNTIME, 'models', 'ggml-small-q5_1.bin');

const SYSTEM_PROMPT = [
  'Você é o JARVIS, o assistente pessoal do Paulo neste repositório (AF4-cockpit).',
  'Responda SEMPRE em português do Brasil, curto e direto — sua resposta será lida em voz alta.',
  'Sem markdown, sem listas longas, sem blocos de código na resposta final: fale como uma pessoa.',
  'O cofre de memória fica em jarvis/vault/ (Hoje.md, Tarefas.md, Metricas.md, Memoria.md, Diario/).',
  'Quando o pedido casar, use as skills: jarvis-resumo (resumo da manhã), jarvis-plano (top 3 do dia),',
  'jarvis-metricas (registrar/ler métricas), jarvis-tendencias (análise semanal), jarvis-vault (ler/gravar memória).',
  'Se alterar arquivos do vault, confirme em uma frase o que gravou.',
].join(' ');

function findClaude() {
  const candidates = [
    process.env.CLAUDE_BIN,
    path.join(os.homedir(), '.local', 'bin', 'claude'),
    '/usr/local/bin/claude',
    '/opt/homebrew/bin/claude',
    path.join(os.homedir(), '.local', 'node-v22.15.0-darwin-x64', 'bin', 'claude'),
  ].filter(Boolean);
  for (const c of candidates) { try { fs.accessSync(c, fs.constants.X_OK); return c; } catch {} }
  try { return execFileSync('/usr/bin/which', ['claude'], { encoding: 'utf8' }).trim() || null; } catch { return null; }
}
const CLAUDE_BIN = findClaude();

// Ambiente limpo para subprocessos do Claude (evita herdar estado da sessão que iniciou o servidor)
function claudeEnv() {
  const env = { ...process.env };
  // remove só o que faz o CLI achar que está aninhado em outra sessão
  for (const k of ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_SSE_PORT']) delete env[k];
  return env;
}

// ---------------------------------------------------------------- histórico
let history = [];
try {
  fs.mkdirSync(RUNTIME, { recursive: true });
  if (fs.existsSync(HISTORY_FILE)) {
    history = fs.readFileSync(HISTORY_FILE, 'utf8').trim().split('\n').filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean).slice(-50);
  }
} catch {}
function logEntry(entry) {
  const e = { ts: new Date().toISOString(), ...entry };
  history.push(e);
  if (history.length > 50) history = history.slice(-50);
  try { fs.appendFileSync(HISTORY_FILE, JSON.stringify(e) + '\n'); } catch {}
  return e;
}

// ---------------------------------------------------------------- vault
function readVaultFile(name) {
  try { return fs.readFileSync(path.join(VAULT, name), 'utf8'); } catch { return null; }
}
function todayDiario() {
  const d = new Date();
  const name = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.md`;
  return { name, content: readVaultFile(path.join('Diario', name)) };
}

// ---------------------------------------------------------------- subsistemas
function sttReady() {
  try { fs.accessSync(WHISPER_BIN, fs.constants.X_OK); fs.accessSync(WHISPER_MODEL); return true; } catch { return false; }
}

let askBusy = false;
function runClaude(text, cb) {
  if (!CLAUDE_BIN) return cb(new Error('Claude Code CLI não encontrado'));
  if (askBusy) return cb(new Error('Já estou processando um pedido — aguarde.'));
  askBusy = true;
  const args = ['-p', text, '--output-format', 'text', '--permission-mode', 'acceptEdits', '--append-system-prompt', SYSTEM_PROMPT];
  let child;
  try {
    child = spawn(CLAUDE_BIN, args, { cwd: ROOT, env: claudeEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    askBusy = false;
    return cb(new Error(`Falha ao iniciar o Claude CLI (${e.code || e.message}). Verifique a instalação em ~/.local/bin/claude.`));
  }
  let out = '', err = '';
  const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 240000);
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { err += d; });
  child.on('error', (e) => { clearTimeout(timer); askBusy = false; cb(e); });
  child.on('close', (code) => {
    clearTimeout(timer); askBusy = false;
    if (code === 0 && out.trim()) return cb(null, out.trim());
    const errClean = err.split('\n').filter((l) => l && !/AVX|bun-v|^\s*$/.test(l)).join(' ').trim();
    let msg = out.trim() || errClean || `claude saiu com código ${code}`;
    if (/not logged in|\/login/i.test(msg)) {
      msg = 'O Claude Code CLI não está logado. Abra um terminal, rode "claude /login" uma vez e tente de novo.';
    }
    cb(new Error(msg));
  });
}

function runWhisper(wavPath, cb) {
  const args = ['-m', WHISPER_MODEL, '-f', wavPath, '-l', 'pt', '--no-timestamps', '-np', '-t', String(Math.max(4, os.cpus().length - 2))];
  let child;
  try { child = spawn(WHISPER_BIN, args); } catch (e) { return cb(e); }
  let out = '', err = '';
  const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 60000);
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { err += d; });
  child.on('error', (e) => { clearTimeout(timer); cb(e); });
  child.on('close', (code) => {
    clearTimeout(timer);
    if (code !== 0) return cb(new Error(err.slice(-400) || `whisper saiu com código ${code}`));
    cb(null, out.replace(/\s+/g, ' ').trim());
  });
}

let ttsChild = null;
function speak(text) {
  try { if (ttsChild) ttsChild.kill('SIGKILL'); } catch {}
  ttsChild = spawn('/usr/bin/say', ['-v', VOICE, text]);
  ttsChild.on('close', () => { ttsChild = null; });
}

// ---------------------------------------------------------------- http
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readBody(req, limit, cb) {
  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > limit) { req.destroy(); cb(new Error('payload muito grande')); cb = () => {}; return; }
    chunks.push(c);
  });
  req.on('end', () => cb(null, Buffer.concat(chunks)));
  req.on('error', (e) => cb(e));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/api/state') {
    const diario = todayDiario();
    return json(res, 200, {
      now: new Date().toISOString(),
      status: {
        claude: Boolean(CLAUDE_BIN),
        stt: sttReady(),
        tts: true,
        voice: VOICE,
        busy: askBusy,
        speaking: Boolean(ttsChild),
      },
      vault: {
        hoje: readVaultFile('Hoje.md'),
        tarefas: readVaultFile('Tarefas.md'),
        metricas: readVaultFile('Metricas.md'),
        memoria: readVaultFile('Memoria.md'),
        diario: diario.content,
        diarioNome: diario.name,
      },
      history: history.slice(-20),
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/ask') {
    return readBody(req, 1e6, (err, buf) => {
      if (err) return json(res, 400, { error: err.message });
      let text = '';
      try { text = String(JSON.parse(buf.toString('utf8')).text || '').trim(); } catch {}
      if (!text) return json(res, 400, { error: 'texto vazio' });
      if (askBusy) return json(res, 429, { error: 'Já estou processando um pedido — aguarde.' });
      logEntry({ role: 'user', text });
      // responde já e entrega o resultado via /api/state (histórico) + fala no servidor:
      // requisições longas morrem em ~60s no Safari.
      runClaude(text, (e, reply) => {
        if (e) return logEntry({ role: 'error', text: e.message });
        logEntry({ role: 'jarvis', text: reply });
        speak(reply.slice(0, 2000));
      });
      json(res, 200, { queued: true });
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/stt') {
    if (!sttReady()) return json(res, 503, { error: 'STT indisponível (whisper ainda não instalado)' });
    return readBody(req, 30e6, (err, buf) => {
      if (err) return json(res, 400, { error: err.message });
      if (buf.length < 1000) return json(res, 400, { error: 'áudio muito curto' });
      const wav = path.join(os.tmpdir(), `jarvis-${Date.now()}.wav`);
      fs.writeFile(wav, buf, (werr) => {
        if (werr) return json(res, 500, { error: werr.message });
        runWhisper(wav, (e, text) => {
          fs.unlink(wav, () => {});
          if (e) return json(res, 500, { error: e.message });
          json(res, 200, { text });
        });
      });
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/tts') {
    return readBody(req, 1e6, (err, buf) => {
      if (err) return json(res, 400, { error: err.message });
      let text = '';
      try { text = String(JSON.parse(buf.toString('utf8')).text || '').trim(); } catch {}
      if (!text) return json(res, 400, { error: 'texto vazio' });
      speak(text.slice(0, 2000));
      json(res, 200, { ok: true });
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/tts/stop') {
    try { if (ttsChild) ttsChild.kill('SIGKILL'); } catch {}
    ttsChild = null;
    return json(res, 200, { ok: true });
  }

  // estático (HUD)
  if (req.method === 'GET') {
    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    file = path.normalize(file).replace(/^(\.\.[/\\])+/, '');
    const full = path.join(HUD, file);
    if (!full.startsWith(HUD)) { res.writeHead(403); return res.end(); }
    return fs.readFile(full, (err, data) => {
      if (err) { res.writeHead(404); return res.end('não encontrado'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
      res.end(data);
    });
  }

  res.writeHead(405);
  res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`JARVIS OS no ar: http://127.0.0.1:${PORT}`);
  console.log(`  claude: ${CLAUDE_BIN || 'NÃO ENCONTRADO'}`);
  console.log(`  stt:    ${sttReady() ? 'ok' : 'pendente (whisper)'}  tts: voz ${VOICE}`);
});
