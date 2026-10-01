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
    el.style.setProperty("--ry", `${(x * MAX * 2).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-y * MAX * 2).toFixed(2)}deg`);
    el.classList.add("inclinando");
    atual = el;
  };
  document.addEventListener("pointermove", mover, { passive: true });
  document.addEventListener("pointerdown", mover, { passive: true });
  document.addEventListener("pointerup", soltar, { passive: true });
  document.addEventListener("pointercancel", soltar, { passive: true });
  document.addEventListener("pointerleave", soltar, { passive: true });
  window.addEventListener("scroll", soltar, { passive: true });
  return () => {
    document.removeEventListener("pointermove", mover);
    document.removeEventListener("pointerdown", mover);
    document.removeEventListener("pointerup", soltar);
    document.removeEventListener("pointercancel", soltar);
    document.removeEventListener("pointerleave", soltar);
    window.removeEventListener("scroll", soltar);
  };
}
