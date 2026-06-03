import React, { useState } from "react";
import { LogIn, UserPlus, Mail, KeyRound } from "lucide-react";
import { signIn, signUp, resetPassword, updatePassword } from "../lib/supabase.js";
import Logo from "./ui/Logo.jsx";
import { BRAND_SUFIXO } from "../lib/brand.js";

/**
 * Tela de autenticação (Supabase Auth · e-mail + senha).
 * Modos: login · signup · reset (pedir link) · update (definir nova senha).
 * Só é renderizada pelo AuthGate quando o Supabase está configurado.
 */
export default function Login({ mode: initialMode = "login", onPasswordUpdated }) {
  const [mode,  setMode]  = useState(initialMode); // login | signup | reset | update
  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");
  const [pwd,   setPwd]   = useState("");
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState(null);
  const [msg,   setMsg]   = useState(null);

  const go = (m) => { setMode(m); setErr(null); setMsg(null); setPwd(""); };

  const needsName  = mode === "signup";
  const needsEmail = mode === "login" || mode === "signup" || mode === "reset";
  const needsPwd   = mode === "login" || mode === "signup" || mode === "update";

  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (needsName && !name.trim()) return;
    if (needsEmail && !email) return;
    if (needsPwd && !pwd) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp(email.trim(), pwd, name);
        setMsg("Cadastro criado. Confirme seu e-mail pelo link que enviamos antes de fazer login.");
        setMode("login");
        setPwd("");
      } else if (mode === "reset") {
        await resetPassword(email.trim());
        setMsg("Se houver uma conta com esse e-mail, enviamos um link para redefinir a senha.");
      } else if (mode === "update") {
        await updatePassword(pwd);
        onPasswordUpdated?.();
      } else {
        await signIn(email.trim(), pwd);
        // AuthGate detecta a nova sessão via onAuthChange.
      }
    } catch (e2) {
      setErr(traduzir(e2?.message ?? "Erro"));
    } finally {
      setBusy(false);
    }
  };

  const act = ACTIONS[mode];

  return (
    <div style={shellStyle}>
      <form onSubmit={submit} style={cardStyle}>
        <Brand />
        <div style={{ color: "var(--tm)", fontSize: 13, marginTop: 8, fontStyle: "italic" }}>
          {TITLES[mode]}
        </div>

        {needsName && (
          <div style={{ marginTop: 20 }}>
            <label style={labelStyle}>Nome</label>
            <input type="text" required autoFocus autoComplete="name"
                   value={name} onChange={(e) => setName(e.target.value)}
                   placeholder="Como devemos te chamar" style={inputStyle} />
          </div>
        )}

        {needsEmail && (
          <div style={{ marginTop: needsName ? 14 : 20 }}>
            <label style={labelStyle}>E-mail</label>
            <input type="email" required autoFocus={!needsName} autoComplete="email"
                   value={email} onChange={(e) => setEmail(e.target.value)}
                   placeholder="voce@exemplo.com" style={inputStyle} />
          </div>
        )}

        {needsPwd && (
          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>{mode === "update" ? "Nova senha" : "Senha"}</label>
            <input type="password" required minLength={6}
                   autoFocus={mode === "update"}
                   autoComplete={mode === "login" ? "current-password" : "new-password"}
                   value={pwd} onChange={(e) => setPwd(e.target.value)}
                   placeholder="••••••••" style={inputStyle} />
          </div>
        )}

        {err && <div style={alertErr}>{err}</div>}
        {msg && <div style={alertOk}>{msg}</div>}

        <button type="submit" disabled={busy} className="btn-gold"
                style={{ marginTop: 18, width: "100%", justifyContent: "center" }}>
          {act.icon}
          {busy ? act.busy : act.label}
        </button>

        {mode === "login" && (
          <>
            <LinkBtn onClick={() => go("reset")}>Esqueci minha senha</LinkBtn>
            <LinkBtn onClick={() => go("signup")}>
              Não tem conta? <span style={{ color: "var(--ac)" }}>Cadastre-se</span>
            </LinkBtn>
          </>
        )}
        {mode === "signup" && (
          <LinkBtn onClick={() => go("login")}>
            Já tem conta? <span style={{ color: "var(--ac)" }}>Faça login</span>
          </LinkBtn>
        )}
        {mode === "reset" && (
          <LinkBtn onClick={() => go("login")}>
            <span style={{ color: "var(--ac)" }}>Voltar ao login</span>
          </LinkBtn>
        )}
      </form>
    </div>
  );
}

const TITLES = {
  login:  "Entre com sua conta.",
  signup: "Crie sua conta para acessar a plataforma.",
  reset:  "Informe seu e-mail para receber o link de redefinição.",
  update: "Defina uma nova senha para sua conta.",
};

const ACTIONS = {
  login:  { icon: <LogIn size={14} />,    label: "Entrar",            busy: "Entrando..." },
  signup: { icon: <UserPlus size={14} />, label: "Cadastrar",         busy: "Cadastrando..." },
  reset:  { icon: <Mail size={14} />,     label: "Enviar link",       busy: "Enviando..." },
  update: { icon: <KeyRound size={14} />, label: "Salvar nova senha", busy: "Salvando..." },
};

function LinkBtn({ onClick, children }) {
  return (
    <button type="button" onClick={onClick}
            style={{
              marginTop: 12, width: "100%", padding: 8,
              background: "transparent", border: "none",
              color: "var(--tm)", fontSize: 12, fontFamily: "inherit", cursor: "pointer",
            }}>
      {children}
    </button>
  );
}

function Brand() {
  return <Logo size={30} sufixo={BRAND_SUFIXO} bg="var(--bg)" />;
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

const alertErr = {
  marginTop: 14, padding: "10px 12px", fontSize: 13,
  background: "color-mix(in srgb, var(--dn) 12%, transparent)",
  color: "var(--dn)",
  border: "1px solid color-mix(in srgb, var(--dn) 30%, transparent)",
  borderRadius: 8,
};

const alertOk = {
  marginTop: 14, padding: "10px 12px", fontSize: 13,
  background: "color-mix(in srgb, var(--sc) 12%, transparent)",
  color: "var(--sc)",
  border: "1px solid color-mix(in srgb, var(--sc) 30%, transparent)",
  borderRadius: 8,
};

function traduzir(msg) {
  const map = {
    "Invalid login credentials": "E-mail ou senha incorretos.",
    "Email not confirmed":       "Confirme seu e-mail pelo link que enviamos antes de entrar.",
    "User already registered":   "Esse e-mail já está cadastrado.",
    "Signups not allowed for this instance": "O cadastro de novas contas está desativado no servidor.",
    "Email signups are disabled": "O cadastro por e-mail está desativado no servidor.",
    "Password should be at least 6 characters": "A senha deve ter no mínimo 6 caracteres.",
    "New password should be different from the old password.": "A nova senha deve ser diferente da anterior.",
    "Unable to validate email address: invalid format": "E-mail inválido.",
    "Email rate limit exceeded": "Muitas tentativas. Aguarde um momento e tente novamente.",
    "For security purposes, you can only request this after 60 seconds.": "Aguarde um minuto antes de tentar novamente.",
    "Auth session missing!": "Link expirado. Solicite um novo e-mail de redefinição.",
    "Supabase nao configurado":  "Servidor de autenticação não configurado.",
  };
  return map[msg] ?? msg;
}
