import React, { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { T } from "../../lib/theme.js";

/**
 * Banner pra "Instalar como app" — aparece quando o navegador
 * detecta que a PWA pode ser instalada (Chrome/Edge/Brave/Samsung Internet).
 *
 * Safari iOS/iPadOS não dispara o evento; pra esses, mostramos instruções manuais.
 */
const DISMISS_KEY = "af4:pwa-dismiss:v1";
const DISMISS_DAYS = 14; // re-mostra após 14 dias

function shouldShow() {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return true;
    const days = (Date.now() - parseInt(ts)) / 86400000;
    return days > DISMISS_DAYS;
  } catch { return true; }
}

export default function InstallPWA() {
  const [deferred, setDeferred] = useState(null);
  const [show, setShow] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Já instalado? Não mostra
    if (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone) {
      setInstalled(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferred(e);
      if (shouldShow()) setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Detect iOS (não dispara evento)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS && shouldShow()) {
      // Atraso pequeno pra não atrapalhar o boot
      setTimeout(() => setShow(true), 5000);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const instalar = async () => {
    if (!deferred) return;
    deferred.prompt();
    const result = await deferred.userChoice;
    if (result.outcome === "accepted") {
      setInstalled(true);
      setShow(false);
    }
    setDeferred(null);
  };

  const dispensar = () => {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
  };

  if (installed || !show) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  return (
    <div className="no-print"
         style={{
           position: "fixed", bottom: 16, right: 16, left: 16,
           maxWidth: 380, marginLeft: "auto",
           background: T.card, border: `1px solid ${T.gold}`,
           borderRadius: 10, padding: 14,
           boxShadow: "0 12px 32px rgba(0,0,0,.4)",
           zIndex: 999, display: "flex", gap: 12,
           animation: "fadeUp .3s ease-out",
         }}>
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: `linear-gradient(135deg, ${T.gold}, ${T.goldHi})`,
        color: T.bg, display: "grid", placeItems: "center", flexShrink: 0,
      }}>
        <Smartphone size={18} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: T.ink, fontWeight: 600, marginBottom: 3 }}>
          Instalar AF4 finanças?
        </div>
        <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.45, marginBottom: 8 }}>
          {isIOS
            ? <>No Safari: toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>. App fica no Dock como nativo.</>
            : "Acessa offline, recebe notificações, abre como app nativo no Dock/Home."}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {!isIOS && deferred && (
            <button onClick={instalar} className="btn-gold" style={{ padding: "6px 12px", fontSize: 10, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Download size={11} /> Instalar agora
            </button>
          )}
          <button onClick={dispensar} className="btn-ghost" style={{ padding: "6px 12px", fontSize: 10 }}>
            Depois
          </button>
        </div>
      </div>
      <button onClick={dispensar} aria-label="Fechar"
              style={{
                background: "transparent", border: "none",
                color: T.muted, cursor: "pointer", padding: 2,
                alignSelf: "flex-start",
              }}>
        <X size={14} />
      </button>
    </div>
  );
}
