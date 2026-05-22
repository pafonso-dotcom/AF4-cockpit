import React from "react";
import { AlertCircle } from "lucide-react";
import { T } from "../../lib/theme.js";

/**
 * Field — label + children + optional inline error.
 *
 * Usage:
 *   <Field label="Nome" error={errors.nome} required hint="Como vai aparecer">
 *     <input value={form.nome} onChange={...} />
 *   </Field>
 *
 * Backward compatible: <Field label="X">{children}</Field> still works.
 */
export default function Field({ label, children, error, required, hint }) {
  const hasError = !!error;
  return (
    <div className="mb-4">
      <div className="label-eyebrow mb-2 flex items-center gap-2" style={{
        color: hasError ? T.red : undefined,
      }}>
        <span>{label}</span>
        {required && <span style={{ color: T.gold, fontSize: 10 }} aria-label="campo obrigatório">*</span>}
      </div>
      <div style={{
        outline: hasError ? `1px solid ${T.red}` : "none",
        outlineOffset: 2,
        borderRadius: 2,
      }}>
        {children}
      </div>
      {hint && !hasError && (
        <div style={{
          color: T.muted, fontSize: 11, marginTop: 4, fontStyle: "italic",
        }}>
          {hint}
        </div>
      )}
      {hasError && (
        <div role="alert" style={{
          color: T.red, fontSize: 11, marginTop: 4,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <AlertCircle size={11} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
