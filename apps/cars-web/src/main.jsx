import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AuthGate from "./AuthGate.jsx";
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";
import "./index.css";

// AuthGate envolve o app: sem sessão Supabase → tela de Login.
// Em produção, se as credenciais Supabase faltarem, bloqueia (fail-closed).
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthGate>
        <App />
      </AuthGate>
    </ErrorBoundary>
  </React.StrictMode>
);
