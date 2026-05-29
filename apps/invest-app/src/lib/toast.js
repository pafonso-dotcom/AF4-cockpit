/* ============================================================
   TOAST · sistema de notificações leve, sem dependências
   Uso:
     import { toast } from "@/lib/toast";
     toast.success("Salvo!");
     toast.error("Falhou");
     toast.info("Mensagem", { action: { label: "Desfazer", onClick: () => {...} } });
   ============================================================ */

let listeners = [];
let nextId = 1;

const emit = (event) => listeners.forEach((fn) => fn(event));

export const toast = {
  show: (msg, opts = {}) => {
    const id = nextId++;
    const item = {
      id,
      msg,
      type: opts.type || "info",
      duration: opts.duration ?? (opts.action ? 6000 : 4000),
      action: opts.action || null,
    };
    emit({ type: "add", toast: item });
    return id;
  },
  success: (msg, opts) => toast.show(msg, { ...opts, type: "success" }),
  error:   (msg, opts) => toast.show(msg, { ...opts, type: "error" }),
  info:    (msg, opts) => toast.show(msg, { ...opts, type: "info" }),
  dismiss: (id) => emit({ type: "remove", id }),
  clear:   () => emit({ type: "clear" }),

  // Internal — para ToastContainer subscrever
  _subscribe: (fn) => {
    listeners.push(fn);
    return () => { listeners = listeners.filter((l) => l !== fn); };
  },
};
