import React, { useEffect, useState } from "react";
import { supabaseConfigured, getSession, onAuthChange, signOut } from "./lib/supabase.js";
import Login from "./components/Login.jsx";

/**
 * AuthGate:
 *  - Supabase configurado → login obrigatório (sem sessão = tela de Login).
 *  - Link de redefinição de senha → tela para definir a nova senha.
 *  - Supabase NÃO configurado (build sem env vars) → app em modo local.
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

  if (!ready) {
    return (
      <div style={{
        minHeight: "100vh", display: "grid", placeItems: "center",
        background: "var(--bg)", color: "var(--tm)",
      }}>
        <div style={{ fontSize: 12, letterSpacing: ".3em", textTransform: "uppercase" }}>
          carregando…
        </div>
      </div>
    );
  }

  // Veio do link de redefinição → definir nova senha
  if (recovering) {
    return <Login mode="update" onPasswordUpdated={() => setRecovering(false)} />;
  }

  // Sem Supabase no build → modo local. Com Supabase → login obrigatório.
  if (!supabaseConfigured || hasSession) {
    return <>{children}</>;
  }

  return <Login />;
}
