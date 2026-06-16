import React, { useState, useMemo } from "react";
import { Copy, Check, MessageCircle, Mail, Upload, AlertCircle } from "lucide-react";
import { T } from "../../lib/theme.js";
import { snapshot, snapshotParaTexto, textoParaSnapshot, aplicarSnapshot, tamanho, compartilharWhatsApp, compartilharEmail, copiarTexto } from "../../lib/syncCompartilhavel.js";
import { audit } from "../../lib/auditLog.js";
import { confirm } from "../../lib/confirm.js";
import { toast } from "../../lib/toast.js";
import Modal from "../ui/Modal.jsx";

/**
 * Modal de sincronização · 2 abas:
 *  - Exportar: gera o texto, oferece copiar/whatsapp/email
 *  - Importar: cola texto, vê preview e confirma
 */
export default function SincronizacaoModal({ onClose }) {
  const [aba, setAba] = useState("exportar"); // exportar | importar
  const [copiado, setCopiado] = useState(false);
  const [textoImport, setTextoImport] = useState("");
  const [erroImport, setErroImport] = useState("");
  const [previewImport, setPreviewImport] = useState(null);

  const textoExport = useMemo(() => {
    try { return snapshotParaTexto(snapshot()); }
    catch { return ""; }
  }, []);

  const copiar = async () => {
    const ok = await copiarTexto(textoExport);
    if (ok) {
      setCopiado(true);
      toast.success("Backup copiado pra área de transferência!");
      setTimeout(() => setCopiado(false), 2500);
    } else {
      toast.error("Falha ao copiar. Selecione manualmente.");
    }
  };

  const tentarImportar = () => {
    setErroImport("");
    setPreviewImport(null);
    try {
      const snap = textoParaSnapshot(textoImport);
      setPreviewImport(snap);
    } catch (err) {
      setErroImport(err.message);
    }
  };

  const confirmarImport = async () => {
    if (!previewImport) return;
    const ok = await confirm({
      title: "Substituir todos os dados atuais?",
      body: "Seus dados atuais serão perdidos e substituídos pelo backup carregado. Recomendo gerar um backup local antes (botão acima).",
      danger: true, confirmLabel: "Sim, substituir",
    });
    if (!ok) return;
    try {
      aplicarSnapshot(previewImport);
      audit.system("Restaurou backup completo via Sincronização", {
        geradoEm: previewImport.geradoEm,
        dispositivo: previewImport.dispositivo,
      });
      toast.success("Backup restaurado. Recarregando…");
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Modal title="Sincronizar entre dispositivos" onClose={onClose} wide>
      <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14, lineHeight: 1.6 }}>
        Mova seus dados entre Mac, iPhone, navegadores diferentes — <strong style={{ color: T.gold }}>sem precisar de servidor</strong>.
        Gere um backup compartilhável aqui e cole em outro dispositivo.
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${T.border}` }}>
        <button onClick={() => setAba("exportar")}
                style={{
                  padding: "10px 16px", background: "transparent", border: "none",
                  fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600,
                  color: aba === "exportar" ? T.gold : T.muted,
                  borderBottom: `2px solid ${aba === "exportar" ? T.gold : "transparent"}`,
                  cursor: "pointer", marginBottom: -1,
                }}>
          ⬆ Enviar deste dispositivo
        </button>
        <button onClick={() => setAba("importar")}
                style={{
                  padding: "10px 16px", background: "transparent", border: "none",
                  fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600,
                  color: aba === "importar" ? T.gold : T.muted,
                  borderBottom: `2px solid ${aba === "importar" ? T.gold : "transparent"}`,
                  cursor: "pointer", marginBottom: -1,
                }}>
          ⬇ Receber em outro
        </button>
      </div>

      {aba === "exportar" && (
        <>
          <div style={{
            background: T.bgSoft, padding: 12, borderRadius: 12,
            fontSize: 11.5, color: T.muted, marginBottom: 12, lineHeight: 1.55,
          }}>
            <strong style={{ color: T.gold }}>Como funciona:</strong>
            <ol style={{ margin: "5px 0 0 18px", padding: 0 }}>
              <li>Escolha um destino (WhatsApp / Email / Copiar)</li>
              <li>O texto vai pro outro dispositivo</li>
              <li>Lá, abra Configurações → Sincronizar → "Receber em outro" e cole</li>
              <li>Pronto · seus dados ficam idênticos</li>
            </ol>
          </div>

          <div style={{
            padding: 10, marginBottom: 12,
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 12, fontSize: 11, color: T.muted,
            display: "flex", justifyContent: "space-between",
          }}>
            <span>📦 Backup gerado</span>
            <span style={{ color: T.gold, fontFamily: "monospace" }}>{tamanho(textoExport)}</span>
          </div>

          <textarea readOnly value={textoExport}
                    style={{
                      width: "100%", padding: 10, height: 100,
                      background: T.bgSoft, color: T.faint,
                      border: `1px solid ${T.border}`, borderRadius: 11,
                      fontSize: 10, fontFamily: "monospace",
                      resize: "vertical", outline: "none",
                      wordBreak: "break-all",
                    }} />

          <div style={{ display: "grid", gap: 8, marginTop: 14, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <button onClick={copiar} className="btn-gold"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {copiado ? <><Check size={13} /> Copiado!</> : <><Copy size={13} /> Copiar texto</>}
            </button>
            <button onClick={() => compartilharWhatsApp(textoExport)}
                    style={{
                      background: "#25D366", color: "#fff", border: "none",
                      padding: "10px 14px", fontSize: 11, fontWeight: 600,
                      letterSpacing: ".1em", textTransform: "uppercase", borderRadius: 12,
                      cursor: "pointer", display: "inline-flex",
                      alignItems: "center", justifyContent: "center", gap: 6,
                    }}>
              <MessageCircle size={13} /> WhatsApp
            </button>
            <button onClick={() => compartilharEmail(textoExport)} className="btn-ghost"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Mail size={13} /> E-mail
            </button>
          </div>

          <div style={{ marginTop: 14, padding: 10, background: T.bgSoft, borderRadius: 11, fontSize: 10.5, color: T.faint, lineHeight: 1.55 }}>
            <strong style={{ color: T.gold }}>💡 Dica:</strong> envie pelo WhatsApp pro seu próprio número. Ele fica salvo no seu chat de "Conversa consigo mesmo" e você acessa em qualquer dispositivo logado.
          </div>
        </>
      )}

      {aba === "importar" && (
        <>
          <p style={{ fontSize: 12, color: T.muted, marginBottom: 10, lineHeight: 1.55 }}>
            Cole abaixo o texto gerado em outro dispositivo (começa com <code style={{ color: T.gold }}>AF4SYNCv1:</code>).
          </p>

          <textarea
            value={textoImport}
            onChange={e => setTextoImport(e.target.value)}
            placeholder="AF4SYNCv1:..."
            rows={6}
            style={{
              width: "100%", padding: 10,
              background: T.bgSoft, color: T.ink,
              border: `1px solid ${T.border}`, borderRadius: 11,
              fontSize: 11, fontFamily: "monospace",
              resize: "vertical", outline: "none",
              wordBreak: "break-all",
            }}
          />

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={tentarImportar} disabled={!textoImport.trim()}
                    className="btn-ghost"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      opacity: !textoImport.trim() ? 0.5 : 1,
                    }}>
              <Upload size={13} /> Verificar
            </button>
          </div>

          {erroImport && (
            <div style={{
              marginTop: 14, padding: 10,
              background: `${T.red}22`, color: T.red,
              border: `1px solid ${T.red}`, borderRadius: 11,
              fontSize: 12, display: "flex", alignItems: "center", gap: 8,
            }}>
              <AlertCircle size={14} /> {erroImport}
            </div>
          )}

          {previewImport && (
            <div style={{ marginTop: 14, padding: 14, background: T.card, border: `1px solid ${T.gold}`, borderRadius: 12 }}>
              <div className="label-eyebrow" style={{ color: T.gold, marginBottom: 8 }}>
                ✓ Backup válido detectado
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 6, fontSize: 12, color: T.muted }}>
                <span>Gerado em:</span>
                <strong style={{ color: T.ink }}>{new Date(previewImport.geradoEm).toLocaleString("pt-BR")}</strong>
                <span>Dispositivo:</span>
                <strong style={{ color: T.ink }}>{previewImport.dispositivo || "?"}</strong>
                <span>Contas:</span>
                <strong style={{ color: T.ink }}>{previewImport.dados?.contas?.length || 0}</strong>
                <span>Transações:</span>
                <strong style={{ color: T.ink }}>{previewImport.dados?.transacoes?.length || 0}</strong>
                <span>Vendas Loja:</span>
                <strong style={{ color: T.ink }}>{previewImport.dados?.vendas?.length || 0}</strong>
              </div>
              <button onClick={confirmarImport} className="btn-gold"
                      style={{ marginTop: 12, width: "100%" }}>
                ↓ Aplicar e substituir dados atuais
              </button>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
