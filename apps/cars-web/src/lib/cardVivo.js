/**
 * Cards animados (pedido 2026-10-01): inclinação 3D que segue o dedo/mouse
 * nos elementos .card-vivo. Um único ouvinte no documento (delegação);
 * brilho, gradiente e entrada são CSS (index.css). Respeita "reduzir movimento".
 */
const MAX = 7; // graus

export function instalarCardVivo() {
  if (typeof window === "undefined") return () => {};
  const reduz = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let atual = null;
  const soltar = () => {
    if (!atual) return;
    atual.style.removeProperty("--rx");
    atual.style.removeProperty("--ry");
    atual.classList.remove("inclinando");
    atual = null;
  };
  const mover = (e) => {
    if (reduz?.matches) return;
    const el = e.target?.closest?.(".card-vivo");
    if (el !== atual) soltar();
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    // Card grande (calendário, Centro de Controle) inclina menos.
    const max = MAX * Math.min(1, 280 / Math.max(r.width, r.height));
    el.style.setProperty("--ry", `${(x * max * 2).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-y * max * 2).toFixed(2)}deg`);
    el.classList.add("inclinando");
    atual = el;
  };
  // Cards sem --i (ex.: Card do Painel) ganham a posição na tela, pra
  // entrada em sequência e brilho em momentos diferentes.
  let agendado = false;
  const numerar = () => {
    agendado = false;
    let i = 0;
    document.querySelectorAll(".card-vivo").forEach((el) => {
      if (!el.style.getPropertyValue("--i") || el.dataset.vivoAuto) {
        el.style.setProperty("--i", String(Math.min(i, 12)));
        el.dataset.vivoAuto = "1";
      }
      i++;
    });
  };
  const obs = typeof MutationObserver !== "undefined"
    ? new MutationObserver(() => { if (!agendado) { agendado = true; requestAnimationFrame(numerar); } })
    : null;
  obs?.observe(document.body, { childList: true, subtree: true });
  numerar();
  document.addEventListener("pointermove", mover, { passive: true });
  document.addEventListener("pointerdown", mover, { passive: true });
  document.addEventListener("pointerup", soltar, { passive: true });
  document.addEventListener("pointercancel", soltar, { passive: true });
  document.addEventListener("pointerleave", soltar, { passive: true });
  window.addEventListener("scroll", soltar, { passive: true });
  return () => {
    obs?.disconnect();
    document.removeEventListener("pointermove", mover);
    document.removeEventListener("pointerdown", mover);
    document.removeEventListener("pointerup", soltar);
    document.removeEventListener("pointercancel", soltar);
    document.removeEventListener("pointerleave", soltar);
    window.removeEventListener("scroll", soltar);
  };
}
