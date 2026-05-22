import React, { useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { signIn, signUp, supabaseConfigured } from "../lib/supabase.js";

/**
 * Tela de login Supabase Auth (e-mail + senha).
 * Renderiza quando supabase está configurado mas usuário não logou.
 * Se o user NUNCA configurar Supabase, esse component nem aparece —
 * o app roda direto no modo localStorage.
 */
export default function Login({ onLoggedIn }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [pwd,   setPwd]   = useState("");
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState(null);
  const [msg,   setMsg]   = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !pwd) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      if (mode === "signup") {
        await signUp(email.trim(), pwd);
        setMsg("Cadastro criado. Verifique seu e-mail (se confirmação estiver ativa) e faça login.");
        setMode("login");
      } else {
        await signIn(email.trim(), pwd);
        onLoggedIn?.();
      }
    } catch (e2) {
      setErr(traduzir(e2?.message ?? "Erro"));
    } finally {
      setBusy(false);
    }
  };

  if (!supabaseConfigured) {
    return (
      <div style={shellStyle}>
        <div style={cardStyle}>
          <Brand />
          <p style={{ color: "var(--tm)", fontSize: 14, fontStyle: "italic", marginTop: 14, lineHeight: 1.6 }}>
            Supabase não configurado nesta instalação. O app está rodando em modo
            <strong style={{ color: "var(--tx)" }}> 100% local</strong> (dados ficam no navegador). Pra ativar
            sync entre dispositivos, defina <code style={codeStyle}>VITE_SUPABASE_URL</code> e
            <code style={codeStyle}>VITE_SUPABASE_ANON_KEY</code> no build.
          </p>
          <button onClick={onLoggedIn} className="btn-gold" style={{ marginTop: 18 }}>
            Continuar offline
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <form onSubmit={submit} style={cardStyle}>
        <Brand />
        <div style={{ color: "var(--tm)", fontSize: 13, marginTop: 8, fontStyle: "italic" }}>
          {mode === "login" ? "Entre com sua conta." : "Crie sua conta — dados ficam no seu Supabase."}
        </div>

        <div style={{ marginTop: 20 }}>
          <label style={labelStyle}>E-mail</label>
          <input type="email" required autoFocus autoComplete="email"
                 value={email} onChange={(e) => setEmail(e.target.value)}
                 placeholder="voce@exemplo.com" style={inputStyle} />
        </div>

        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>Senha</label>
          <input type="password" required minLength={6}
                 autoComplete={mode === "login" ? "current-password" : "new-password"}
                 value={pwd} onChange={(e) => setPwd(e.target.value)}
                 placeholder="••••••••" style={inputStyle} />
        </div>

        {err && (
          <div style={{
            marginTop: 14, padding: "10px 12px", fontSize: 13,
            background: "color-mix(in srgb, var(--dn) 12%, transparent)",
            color: "var(--dn)",
            border: "1px solid color-mix(in srgb, var(--dn) 30%, transparent)",
            borderRadius: 8,
          }}>{err}</div>
        )}

        {msg && (
          <div style={{
            marginTop: 14, padding: "10px 12px", fontSize: 13,
            background: "color-mix(in srgb, var(--sc) 12%, transparent)",
            color: "var(--sc)",
            border: "1px solid color-mix(in srgb, var(--sc) 30%, transparent)",
            borderRadius: 8,
          }}>{msg}</div>
        )}

        <button type="submit" disabled={busy} className="btn-gold"
                style={{ marginTop: 18, width: "100%", justifyContent: "center" }}>
          {mode === "login" ? <LogIn size={14} /> : <UserPlus size={14} />}
          {busy ? (mode === "login" ? "Entrando..." : "Cadastrando...") : (mode === "login" ? "Entrar" : "Cadastrar")}
        </button>

        <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(null); setMsg(null); }}
                style={{
                  marginTop: 14, width: "100%", padding: 8,
                  background: "transparent", border: "none",
                  color: "var(--tm)", fontSize: 12, fontFamily: "inherit", cursor: "pointer",
                }}>
          {mode === "login"
            ? <>Não tem conta? <span style={{ color: "var(--ac)" }}>Cadastre-se</span></>
            : <>Já tem conta? <span style={{ color: "var(--ac)" }}>Faça login</span></>}
        </button>

        <button type="button" onClick={onLoggedIn}
                style={{
                  marginTop: 6, width: "100%", padding: 8,
                  background: "transparent", border: "none",
                  color: "var(--td)", fontSize: 11, fontFamily: "inherit", cursor: "pointer",
                  letterSpacing: ".1em", textTransform: "uppercase",
                }}>
          Pular · usar modo offline
        </button>
      </form>
    </div>
  );
}

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 44, height: 44, borderRadius: 11,
        background: "linear-gradient(135deg, var(--ac), var(--ac2))",
        display: "grid", placeItems: "center",
        color: "var(--bg)", fontWeight: 700, fontSize: 18,
      }}>A</div>
      <div>
        <div style={{ fontSize: 11, letterSpacing: ".25em", textTransform: "uppercase", fontWeight: 500, color: "var(--tx)" }}>
          AF4 Cockpit
        </div>
        <div style={{ fontSize: 9, letterSpacing: ".2em", color: "var(--td)", marginTop: 2 }}>
          Multi-Módulo · v3
        </div>
      </div>
    </div>
  );
}

const shellStyle = {
  minHeight: "100vh", display: "grid", placeItems: "center",
  padding: 16, background: "var(--bg)", position: "relative",
};

const cardStyle = {
  width: "100%", maxWidth: 380,
  background: "var(--bc)", border: "1px solid var(--bd)", borderRadius: 14,
  padding: 28, position: "relative", zIndex: 1,
};

const labelStyle = {
  display: "block", fontSize: 10, letterSpacing: ".15em",
  textTransform: "uppercase", color: "var(--td)",
  marginBottom: 6, fontWeight: 500,
};

const inputStyle = {
  width: "100%", padding: "11px 12px",
  background: "var(--be)", color: "var(--tx)",
  border: "1px solid var(--bd)", borderRadius: 8,
  fontSize: 14, fontFamily: "inherit", outline: "none",
};

const codeStyle = {
  background: "var(--be)", padding: "1px 5px",
  fontSize: 12, fontFamily: "ui-monospace, monospace",
  color: "var(--ac)", borderRadius: 4,
};

function traduzir(msg) {
  const map = {
    "Invalid login credentials": "E-mail ou senha incorretos.",
    "Email not confirmed":       "Verifique seu e-mail antes de entrar.",
    "User already registered":   "Esse e-mail já está cadastrado.",
    "Password should be at least 6 characters": "Senha deve ter no mínimo 6 caracteres.",
    "Supabase nao configurado":  "Servidor de sync não configurado.",
  };
  return map[msg] ?? msg;
}
