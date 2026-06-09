import React from "react";
import { fmtN, digitosParaValor } from "../../lib/format.js";

/**
 * Input de dinheiro com máscara "estilo caixa": o usuário digita só números e
 * os 2 últimos viram centavos automaticamente (sem precisar da vírgula).
 *
 * Props:
 *   value     — número em reais (ex.: 1500.5). "" / null = vazio.
 *   onChange  — recebe o número em reais a cada digitação.
 *   prefix    — texto antes do valor (default "R$"). Passe "" pra esconder.
 *   ...rest   — repassado ao <input> (style, placeholder, disabled, etc.).
 */
export default function MoneyInput({ value, onChange, prefix = "R$", placeholder = "0,00", ...rest }) {
  const vazio = value === "" || value == null;
  const formatado = vazio ? "" : fmtN(Number(value) || 0, 2); // 1.500,50
  const display = vazio ? "" : (prefix ? `${prefix} ${formatado}` : formatado);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={prefix ? `${prefix} ${placeholder}` : placeholder}
      onChange={(e) => onChange(digitosParaValor(e.target.value))}
      {...rest}
    />
  );
}
