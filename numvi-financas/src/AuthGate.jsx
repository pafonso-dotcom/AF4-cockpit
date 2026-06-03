import React, { useEffect, useState } from "react";
import { supabaseConfigured, getSession, onAuthChange, signOut } from "./lib/supabase.js";
import Login from "./components/Login.jsx";

/**
 * AuthGate:
 *  - Supabase configurado → login obrigatório (sem sessão = tela de Login).
 *  - Link de redefinição de senha → tela para definir a nova senha.
 *  - Supabase ausente em produção → bloqueia o acesso (fail-closed): build
 *    sem credenciais não pode expor a plataforma sem autenticação.
 *  - Supabase ausente em dev → app em modo local, para desenvolvimento.
 *
 * Expõe window.__af4Logout para o app deslogar de qualquer lugar.
 */
export default function AuthGate({ children }) {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [recovering, setRecovering] = useState(false);

  // Link de recuperação de senha traz "type=recovery" no hash da URL.
  useEffect(() => {
    if (!supabaseConfigured) return;
    if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
      setRecovering(true);
    }
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) { setReady(true); return; }
    let unsub = () => {};
    (async () => {
      const s = await getSession();
      setHasSession(!!s);
      setReady(true);
      unsub = onAuthChange((sess, event) => {
        if (event === "PASSWORD_RECOVERY") setRecovering(true);
        setHasSession(!!sess);
      });
    })();
    return () => unsub();
  }, []);

  // Atalho de logout pra ser usado em qualquer lugar do app
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__af4Logout = async () => { await signOut(); };
    return () => { delete window.__af4Logout; };
  }, []);

  if (!ready) return <Splash>carregando…</Splash>;

  // Veio do link de redefinição → definir nova senha
  if (recovering) {
    return <Login mode="update" onPasswordUpdated={() => setRecovering(false)} />;
  }

  // Sem Supabase no build:
  //  - produção → bloqueia (credenciais faltando, não expor a plataforma)
  //  - dev → modo local liberado
  if (!supabaseConfigured) {
    if (import.meta.env.PROD) return <ConfigError />;
    return <>{children}</>;
  }

  // Login obrigatório
  if (hasSession) return <>{children}</>;
  return <Login />;
}

function Splash({ children }) {
  return (
    <div style={{
      minHeight: "100vh", display: "grid", placeItems: "center",
      background: "var(--bg)", color: "var(--tm)",
    }}>
      <div style={{ fontSize: 12, letterSpacing: ".3em", textTransform: "uppercase" }}>
        {children}
      </div>
    </div>
  );
}

function ConfigError() {
  return (
    <div style={{
      minHeight: "100vh", display: "grid", placeItems: "center",
      background: "var(--bg)", color: "var(--tm)", padding: 24,
    }}>
      <div style={{ maxWidth: 380, textAlign: "center" }}>
        <div style={{
          fontSize: 12, letterSpacing: ".3em", textTransform: "uppercase",
          color: "var(--dn)", marginBottom: 12,
        }}>
          Acesso indisponível
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.65, color: "var(--tm)" }}>
          A autenticação não está configurada neste site. O administrador
          precisa definir as credenciais do Supabase nas variáveis de build.
        </div>
      </div>
    </div>
  );
}
