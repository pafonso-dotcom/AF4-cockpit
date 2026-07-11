import React, { useEffect, useState } from "react";
import { T } from "./lib/theme.js";
import { supabaseConfigured, getSession, onAuthChange } from "./lib/supabase.js";
import Login from "./components/auth/Login.jsx";
import NovaSenha from "./components/auth/NovaSenha.jsx";

// ⚠️ PROVISÓRIO — login DESATIVADO enquanto fazemos as alterações.
// Entra direto no app (dados no localStorage). Para REATIVAR o login,
// troque para false (ou remova este bloco e o `if (BYPASS_LOGIN)` abaixo).
const BYPASS_LOGIN = true;

// Link de recuperação de senha chega com "#type=recovery&..." na URL.
const hashRecovery = () =>
  typeof window !== "undefined" && /type=recovery/.test(window.location.hash || "");

/**
 * Porta de entrada do produto.
 * - Supabase configurado → exige login (multi-tenant). Sem sessão → tela de Login.
 * - Supabase NÃO configurado → modo local (sem login, dados só no navegador),
 *   útil em desenvolvimento. Mostra um aviso discreto.
 */
export default function AuthGate({ children }) {
  const [carregando, setCarregando] = useState(true);
  const [sessao, setSessao] = useState(null);
  const [recuperando, setRecuperando] = useState(hashRecovery());

  useEffect(() => {
    if (!supabaseConfigured) { setCarregando(false); return; }
    let vivo = true;
    getSession().then(s => { if (vivo) { setSessao(s); setCarregando(false); } });
    const off = onAuthChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecuperando(true);
      setSessao(s);
    });
    return () => { vivo = false; off(); };
  }, []);

  // ⚠️ PROVISÓRIO — login desativado: entra direto no app.
  if (BYPASS_LOGIN) {
    return (
      <>
        <div style={{
          position: "fixed", bottom: 8, right: 8, zIndex: 9999,
          fontSize: 10.5, color: "#1a1407", background: T.gold,
          borderRadius: 6, padding: "4px 8px", fontWeight: 600, opacity: 0.9,
        }}>
          🔓 login desativado (provisório)
        </div>
        {children}
      </>
    );
  }

  // Modo local (dev) — sem backend configurado.
  if (!supabaseConfigured) {
    return (
      <>
        <div style={{
          position: "fixed", bottom: 8, right: 8, zIndex: 9999,
          fontSize: 10.5, color: T.muted, background: T.card,
          border: `1px solid ${T.border}`, borderRadius: 6, padding: "4px 8px", opacity: 0.85,
        }}>
          modo local (sem nuvem) — configure o Supabase pra multi-cliente
        </div>
        {children}
      </>
    );
  }

  if (carregando) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: T.bg, color: T.muted }}>
        Carregando…
      </div>
    );
  }

  // Fluxo de recuperação de senha (chegou pelo link do e-mail).
  if (recuperando) return <NovaSenha onPronto={() => setRecuperando(false)} />;

  if (!sessao) return <Login />;

  return children;
}
