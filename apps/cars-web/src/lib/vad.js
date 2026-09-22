/**
 * VAD — detecção de fala/silêncio pro Modo Conversa do Jarbas.
 *
 * Parte PURA (avaliarVad): máquina de estados que recebe o nível RMS (0..1)
 * do microfone e diz quando o usuário COMEÇOU a falar, quando TERMINOU
 * (silêncio prolongado após fala → hora de enviar o áudio) e quando há fala
 * SUSTENTADA (pro barge-in: interromper o Jarbas falando, com limiar mais
 * alto e duração maior pra não confundir com o eco do alto-falante).
 *
 * Wrapper de navegador (criarMonitorFala): AudioContext + AnalyserNode.
 */

export const VAD_DEFAULTS = {
  limiarFala: 0.045,     // nível pra considerar "tem voz"
  limiarSilencio: 0.028, // abaixo disso conta como silêncio (histerese)
  minFalaMs: 300,        // voz contínua mínima pra valer como fala
  silencioMs: 1400,      // silêncio após fala → terminou o turno
  limiarBarge: 0.09,     // barge-in: precisa falar mais alto (eco não passa)
  minBargeMs: 550,       // ... e por mais tempo
};

export function estadoInicialVad(agora = 0) {
  return { falouAlgo: false, emVoz: false, inicioVoz: 0, ultimoSom: agora, inicioBarge: 0 };
}

/**
 * Avalia um frame. Retorna { estado, terminouFala, falaSustentada }.
 * `modo`: "ouvindo" (detecta turno) | "falando" (só barge-in).
 */
export function avaliarVad(estado, nivel, agora, modo = "ouvindo", opts = {}) {
  const o = { ...VAD_DEFAULTS, ...opts };
  const e = { ...estado };
  let terminouFala = false;
  let falaSustentada = false;

  if (modo === "falando") {
    // Só interessa fala ALTA e SUSTENTADA (barge-in).
    if (nivel >= o.limiarBarge) {
      if (!e.inicioBarge) e.inicioBarge = agora;
      if (agora - e.inicioBarge >= o.minBargeMs) {
        falaSustentada = true;
        e.inicioBarge = 0;
      }
    } else {
      e.inicioBarge = 0;
    }
    return { estado: e, terminouFala, falaSustentada };
  }

  // modo "ouvindo"
  if (nivel >= o.limiarFala) {
    if (!e.emVoz) { e.emVoz = true; e.inicioVoz = agora; }
    e.ultimoSom = agora;
    if (!e.falouAlgo && agora - e.inicioVoz >= o.minFalaMs) e.falouAlgo = true;
  } else if (nivel < o.limiarSilencio) {
    e.emVoz = false;
    if (e.falouAlgo && agora - e.ultimoSom >= o.silencioMs) {
      terminouFala = true;
    }
  }
  // entre os dois limiares: histerese — mantém o estado atual

  return { estado: e, terminouFala, falaSustentada };
}

/**
 * Monitor de fala no navegador. `stream` = MediaStream do microfone.
 * Callbacks: aoNivel(rms 0..1), aoTerminarFala(), aoFalaSustentada().
 * Retorna { setModo, reiniciar, pausar, retomar, destruir }.
 */
export function criarMonitorFala(stream, { aoNivel, aoTerminarFala, aoFalaSustentada } = {}, opts = {}) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const fonte = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  fonte.connect(analyser);
  const buf = new Uint8Array(analyser.fftSize);

  let modo = "ouvindo";
  let estado = estadoInicialVad(performance.now());
  let pausado = false;
  let vivo = true;

  const tick = () => {
    if (!vivo) return;
    if (!pausado) {
      analyser.getByteTimeDomainData(buf);
      let soma = 0;
      for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; soma += d * d; }
      const rms = Math.sqrt(soma / buf.length);
      aoNivel?.(rms);
      const r = avaliarVad(estado, rms, performance.now(), modo, opts);
      estado = r.estado;
      if (r.terminouFala) { estado = estadoInicialVad(performance.now()); aoTerminarFala?.(); }
      if (r.falaSustentada) { estado = estadoInicialVad(performance.now()); aoFalaSustentada?.(); }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return {
    setModo: (m) => { modo = m; estado = estadoInicialVad(performance.now()); },
    reiniciar: () => { estado = estadoInicialVad(performance.now()); },
    pausar: () => { pausado = true; },
    retomar: () => { pausado = false; estado = estadoInicialVad(performance.now()); },
    destruir: () => { vivo = false; try { ctx.close(); } catch {} },
  };
}
