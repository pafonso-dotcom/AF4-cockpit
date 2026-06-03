/* ============================================================
   CONFIRM · diálogo de confirmação promise-based
   Uso:
     import { confirm } from "@/lib/confirm";
     const ok = await confirm({
       title: "Excluir HGRE11?",
       body: "Essa ação não pode ser desfeita.",
       confirmLabel: "Excluir",
       danger: true,
     });
     if (ok) { ... }
   ============================================================ */

let listeners = [];

export const confirm = (opts = {}) => {
  return new Promise((resolve) => {
    listeners.forEach((fn) => fn({
      title: opts.title || "Confirmar",
      body: opts.body || "",
      confirmLabel: opts.confirmLabel || "Confirmar",
      cancelLabel: opts.cancelLabel || "Cancelar",
      danger: !!opts.danger,
      resolve,
    }));
  });
};

confirm._subscribe = (fn) => {
  listeners.push(fn);
  return () => { listeners = listeners.filter((l) => l !== fn); };
};
