import React, { useEffect, useState } from "react";
import { supabaseConfigured, getSession, onAuthChange, signOut } from "./lib/supabase.js";
import Login from "./components/Login.jsx";

/**
 * AuthGate:
 *  - Se Supabase NÃO configurado → renderiza App direto (modo local).
 *  - Se Supabase configurado + sem sessão → mostra Login.
 *  - Se logado OU usuário escolher "pular" → renderiza App.
 *
 * Expõe via window.__af4Logout uma função pra deslogar, pra o app
 * (ConfiguraçÕes) poder chamar sem precisar passar prop fundo.
 */
export default function AuthGate({ children }) {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) { setReady(true); return; }
    let unsub = () => {};
    (async () => {
      const s = await getSession();
      setHasSession(!!s);
      setReady(true);
      unsub = onAuthChange((sess) => setHasSession(!!sess));
    })();
    return () => unsub();
  }, []);

  // Atalho de logout pra ser usado em qualquer lugar do app
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.__af4Logout = async () => {
      await signOut();
      setSkipped(false);
    };
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

  // Sem Supabase OU já logado OU usuário pulou → app
  if (!supabaseConfigured || hasSession || skipped) {
    return <>{children}</>;
  }

  return <Login onLoggedIn={() => setSkipped(true)} />;
}
