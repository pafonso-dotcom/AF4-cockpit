import React, { useState } from "react";
import { T } from "../../lib/theme.js";
import { updatePassword } from "../../lib/supabase.js";

/**
 * Tela de redefinição de senha (fluxo "Esqueci a senha").
 * Mostrada quando o usuário chega pelo link do e-mail (evento PASSWORD_RECOVERY).
 */
export default function NovaSenha({ onPronto }) {
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (senha.length < 6) { setMsg({ tipo: "erro", texto: "A senha precisa de pelo menos 6 caracteres." }); return; }
    if (senha !== confirma) { setMsg({ tipo: "erro", texto: "As senhas não conferem." }); return; }
    setBusy(true);
    try {
      await updatePassword(senha);
      setMsg({ tipo: "ok", texto: "Senha alterada! Entrando…" });
      // Limpa o hash de recuperação da URL e segue pro app.
      try { history.replaceState(null, "", window.location.pathname); } catch {}
      setTimeout(() => onPronto?.(), 900);
    } catch (err) {
      setMsg({ tipo: "erro", texto: err?.message || "Não foi possível alterar a senha. Tente reabrir o link do e-mail." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: T.bg, padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontFamily: T.serif, fontSize: 30, fontWeight: 600, color: T.gold, letterSpacing: "-0.02em" }}>
            Investimentos
          </div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 4 }}>Defina sua nova senha</div>
        </div>

        <form onSubmit={submit} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 22, display: "grid", gap: 12 }}>
          <label style={lbl}>Nova senha
            <input type="password" required value={senha} onChange={e => setSenha(e.target.value)}
                   autoComplete="new-password" placeholder="••••••••" style={inp} />
          </label>
          <label style={lbl}>Confirmar senha
            <input type="password" required value={confirma} onChange={e => setConfirma(e.target.value)}
                   autoComplete="new-password" placeholder="••••••••" style={inp} />
          </label>

          {msg && (
            <div style={{
              fontSize: 12, padding: "8px 10px", borderRadius: 7,
              background: msg.tipo === "erro" ? `${T.red}18` : `${T.green}18`,
              color: msg.tipo === "erro" ? T.red : T.green,
              border: `1px solid ${(msg.tipo === "erro" ? T.red : T.green)}55`,
            }}>{msg.texto}</div>
          )}

          <button type="submit" disabled={busy} style={{
            marginTop: 4, padding: "11px 14px", borderRadius: 8, border: "none",
            background: T.gold, color: "#1a1407", fontWeight: 700, fontSize: 13.5,
            cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1,
          }}>
            {busy ? "Salvando…" : "Salvar nova senha"}
          </button>
        </form>
      </div>
    </div>
  );
}

const lbl = { display: "grid", gap: 5, fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" };
const inp = { padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgSoft, color: T.ink, fontSize: 14 };
