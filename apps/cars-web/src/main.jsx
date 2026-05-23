import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";
import "./index.css";

// Autenticação desativada temporariamente — o app abre direto, sem login.
// Para reativar: reimporte AuthGate de "./AuthGate.jsx" e envolva <App />
// com <AuthGate>...</AuthGate>.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
