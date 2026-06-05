import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";
import "./index.css";

// ============================================================
// MODO MANUTENÇÃO (comercial fora do ar)
// Enquanto true, o app NÃO carrega: sem login, sem dados, sem nada.
// Encerra também qualquer sessão ativa por garantia.
// → Quando resolvermos tudo, mude para false e faça deploy.
// ============================================================
const MANUTENCAO = true;

function Manutencao() {
  return (
    <div style={{
      minHeight: "100vh", display: "grid", placeItems: "center",
      background: "#0f1115", color: "#e8e8ea", padding: 24, textAlign: "center",
      fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
    }}>
      <div style={{ maxWidth: 440 }}>
        <div style={{ fontSize: 44, marginBottom: 16 }}>🔧</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 10px" }}>Em manutenção</h1>
        <p style={{ fontSize: 15, lineHeight: 1.65, color: "#a8a8b0", margin: 0 }}>
          O <strong style={{ color: "#E8C25A" }}>AF4 finanças</strong> está passando por ajustes
          e voltará em breve. Obrigado pela paciência.
        </p>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));

if (MANUTENCAO) {
  // Por garantia, derruba qualquer sessão ativa (ninguém acessa dados).
  import("./lib/supabase.js").then(m => m.signOut?.()).catch(() => {});
  root.render(<React.StrictMode><Manutencao /></React.StrictMode>);
} else {
  // AuthGate envolve o app: sem sessão Supabase → tela de Login.
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <AuthGate>
          <App />
        </AuthGate>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
