import { useEffect, useRef, useState } from "react";

/**
 * Lê uma lista de textos em voz alta, um atrás do outro (voz do aparelho, pt-BR).
 * No iPhone: precisa começar num toque (chamamos `ler` direto no clique) e o
 * botão do silencioso corta o som.
 */
export function useLeitorVoz() {
  const [atual, setAtual] = useState(-1);   // índice lendo agora (-1 = parado)
  const fila = useRef([]);
  const sessao = useRef(0); // invalida callbacks de falas canceladas
  const ok = typeof window !== "undefined" && "speechSynthesis" in window;

  const voz = () => {
    const vs = ok ? window.speechSynthesis.getVoices() : [];
    return vs.find(v => /pt-BR/i.test(v.lang) && /Luciana|Google|Natural|Premium|Enhanced/i.test(v.name))
      || vs.find(v => /pt-BR/i.test(v.lang)) || vs.find(v => /^pt/i.test(v.lang)) || null;
  };
  const falar = (i, tok = sessao.current) => {
    if (tok !== sessao.current) return;
    if (i >= fila.current.length) { setAtual(-1); return; }
    const u = new SpeechSynthesisUtterance(fila.current[i]);
    u.lang = "pt-BR"; u.rate = 1.05;
    const v = voz(); if (v) u.voice = v;
    u.onend = () => falar(i + 1, tok);
    u.onerror = () => { if (tok === sessao.current) setAtual(-1); };
    setAtual(i);
    window.speechSynthesis.speak(u);
  };
  const ler = (textos = [], inicio = 0) => {
    if (!ok) return false;
    sessao.current++;
    window.speechSynthesis.cancel();
    fila.current = textos;
    falar(inicio, sessao.current);
    return true;
  };
  const parar = () => { sessao.current++; if (ok) window.speechSynthesis.cancel(); fila.current = []; setAtual(-1); };
  const pular = () => {
    if (atual < 0) return;
    const i = atual, textos = fila.current;
    sessao.current++; window.speechSynthesis.cancel();
    fila.current = textos; falar(i + 1, sessao.current);
  };
  useEffect(() => () => { if (ok) window.speechSynthesis.cancel(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { ok, atual, lendo: atual >= 0, ler, parar, pular };
}
