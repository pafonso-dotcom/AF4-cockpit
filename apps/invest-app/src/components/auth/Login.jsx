import React, { useState } from "react";
import { T } from "../../lib/theme.js";
import { signIn, signUp, resetPassword } from "../../lib/supabase.js";

/**
 * Tela de autenticação do produto: login, cadastro e recuperação de senha.
 * Self-service — o próprio cliente cria a conta.
 */
export default function Login() {
  const [modo, setModo] = useState("login"); // login | signup | reset
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { tipo: "erro"|"ok", texto }

  const submit = async (e) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      if (modo === "login") {
        await signIn(email.trim(), senha);
        // onAuthChange no AuthGate cuida de renderizar o app.
      } else if (modo === "signup") {
        if (senha.length < 6) throw new Error("A senha precisa de pelo menos 6 caracteres.");
        await signUp(email.trim(), senha);
        setMsg({ tipo: "ok", texto: "Conta criada! Verifique seu e-mail para confirmar e depois faça login." });
        setModo("login");
      } else {
        await resetPassword(email.trim());
        setMsg({ tipo: "ok", texto: "Enviamos um link de redefinição pro seu e-mail." });
        setModo("login");
      }
    } catch (err) {
      setMsg({ tipo: "erro", texto: traduzErro(err?.message) });
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
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 4 }}>
            {modo === "signup" ? "Crie sua conta" : modo === "reset" ? "Recuperar acesso" : "Acesse sua carteira"}
          </div>
        </div>

        <form onSubmit={submit} style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
          padding: 22, display: "grid", gap: 12,
        }}>
          <label style={lbl}>E-mail
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                   autoComplete="email" placeholder="voce@email.com" style={inp} />
          </label>

          {modo !== "reset" && (
            <label style={lbl}>Senha
              <input type="password" required value={senha} onChange={e => setSenha(e.target.value)}
                     autoComplete={modo === "signup" ? "new-password" : "current-password"}
                     placeholder="••••••••" style={inp} />
            </label>
          )}

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
            {busy ? "Aguarde…" : modo === "signup" ? "Criar conta" : modo === "reset" ? "Enviar link" : "Entrar"}
          </button>
        </form>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontSize: 12 }}>
          {modo !== "login" ? (
            <button onClick={() => { setModo("login"); setMsg(null); }} style={linkBtn}>← Voltar pro login</button>
          ) : (
            <>
              <button onClick={() => { setModo("signup"); setMsg(null); }} style={linkBtn}>Criar conta</button>
              <button onClick={() => { setModo("reset"); setMsg(null); }} style={linkBtn}>Esqueci a senha</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function traduzErro(m = "") {
  const s = m.toLowerCase();
  if (s.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (s.includes("already registered") || s.includes("already exists")) return "Esse e-mail já tem conta. Faça login.";
  if (s.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (s.includes("rate limit")) return "Muitas tentativas. Aguarde um pouco.";
  return m || "Algo deu errado. Tente de novo.";
}

const lbl = { display: "grid", gap: 5, fontSize: 11, color: T.muted, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" };
const inp = { padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.bgSoft, color: T.ink, fontSize: 14 };
const linkBtn = { background: "transparent", border: "none", color: T.gold, cursor: "pointer", fontSize: 12, padding: 0 };
