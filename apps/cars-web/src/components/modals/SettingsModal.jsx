import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, RefreshCw, X, AlertCircle, CheckCircle2, ExternalLink, Download, Upload } from "lucide-react";
import { T } from "../../lib/theme.js";
import { API } from "../../lib/api.js";
import { exportBackup, importBackup } from "../../lib/backup.js";
import { listBackups, createBackup, readBackup, deleteBackup, formatBackupDate } from "../../lib/autoBackup.js";
import { getConfig as getNotifCfg, setConfig as setNotifCfg, requestPermission, getPermission, isSupported } from "../../lib/notifications.js";
import SincronizacaoModal from "./SincronizacaoModal.jsx";
import { confirm } from "../../lib/confirm.js";

export default function SettingsModal({ apiKeys, setApiKeys, onClose }) {
  const ref = useRef();
  const [draft, setDraft] = useState(apiKeys);
  const [showBrapi, setShowBrapi] = useState(false);
  const [showAlpha, setShowAlpha] = useState(false);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState({});

  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const save = () => {
    setApiKeys(draft);
    onClose();
  };

  const testKey = async (which) => {
    setTesting(which);
    setTestResult(prev => ({ ...prev, [which]: null }));
    let res;
    if (which === "brapi") res = await API.testBrapi(draft.brapi);
    else if (which === "alphavantage") res = await API.testAlphaVantage(draft.alphavantage);
    setTestResult(prev => ({ ...prev, [which]: res }));
    setTesting(null);
  };

  return createPortal((
    <div onClick={(e) => { if (e.target === ref.current) onClose(); }} ref={ref}
         style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000,
                  display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: T.card, border: `1px solid ${T.borderHi}`, maxWidth: 640, width: "100%",
                    maxHeight: "90vh", overflowY: "auto", padding: 32, position: "relative",
                    borderRadius: 12, boxShadow: "0 24px 60px rgba(0,0,0,.6)" }}>
        <button onClick={onClose}
                style={{ position: "absolute", top: 16, right: 16, color: T.muted,
                         background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
          <X size={20} />
        </button>

        <div className="label-eyebrow">Configurações</div>
        <h3 style={{ fontFamily: T.serif, fontSize: 32, color: T.ink, marginTop: 6, marginBottom: 6, letterSpacing: "-0.02em" }}>
          Mercado em tempo real
        </h3>
        <div style={{ color: T.muted, fontSize: 15, fontStyle: "italic", marginBottom: 20 }}>
          Cotações de ações, FIIs e cripto a partir de APIs públicas. Chaves são opcionais e aumentam limites.
        </div>

        {/* Real market toggle */}
        <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, padding: 16, marginBottom: 20 }}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={!!draft.useRealMarket}
                   onChange={e => setDraft({ ...draft, useRealMarket: e.target.checked })}
                   style={{ width: 18, height: 18, accentColor: T.gold, marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: T.serif, fontSize: 18, color: T.ink, lineHeight: 1.2 }}>
                Usar dados reais de mercado
              </div>
              <div style={{ color: T.muted, fontSize: 13, fontStyle: "italic", marginTop: 4 }}>
                Quando ativo, o botão de atualização busca cotações reais.
                Ativos sem fonte (Tesouro, CDB) seguem em simulação.
              </div>
            </div>
          </label>
        </div>

        {/* Security warning */}
        <div style={{ background: `${T.gold}15`, border: `1px solid ${T.gold}55`, padding: 14, marginBottom: 20, display: "flex", gap: 12 }}>
          <AlertCircle size={18} style={{ color: T.gold, flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>
            <strong style={{ fontFamily: T.serif, fontStyle: "italic", fontSize: 15 }}>Aviso de segurança · </strong>
            chaves inseridas aqui ficam armazenadas localmente no seu navegador.
            Use apenas chaves com permissão de leitura. Nunca cole chaves de produção
            ou que dêem acesso a contas com saldo.
          </div>
        </div>

        {/* Brapi key */}
        <ApiKeyField
          label="Brapi · Ações e FIIs Brasileiros"
          help="Funciona sem chave (limite reduzido). Crie uma gratuita em brapi.dev para acesso completo."
          link="https://brapi.dev"
          value={draft.brapi}
          onChange={v => setDraft({ ...draft, brapi: v })}
          show={showBrapi} setShow={setShowBrapi}
          testing={testing === "brapi"}
          result={testResult.brapi}
          onTest={() => testKey("brapi")}
          placeholder="Cole seu token aqui (opcional)"
        />

        {/* Alpha Vantage */}
        <ApiKeyField
          label="Alpha Vantage · Ações Globais (US, etc.)"
          help="Chave gratuita em alphavantage.co/support/#api-key. Limite: 25 req/dia."
          link="https://www.alphavantage.co/support/#api-key"
          value={draft.alphavantage}
          onChange={v => setDraft({ ...draft, alphavantage: v })}
          show={showAlpha} setShow={setShowAlpha}
          testing={testing === "alphavantage"}
          result={testResult.alphavantage}
          onTest={() => testKey("alphavantage")}
          placeholder="Cole sua chave aqui"
        />

        {/* APIs sem chave */}
        <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, padding: 16, marginTop: 4 }}>
          <div className="label-eyebrow mb-2">Já incluído · sem chave necessária</div>
          <div className="space-y-2">
            <ApiRow nome="CoinGecko" desc="Cotações de cripto · BTC, ETH e mais 10+ moedas" url="https://www.coingecko.com" />
            <ApiRow nome="AwesomeAPI" desc="Câmbio · USD, EUR, GBP, BTC em BRL" url="https://docs.awesomeapi.com.br" />
          </div>
        </div>

        {/* AI section divider */}
        <div className="ornament" style={{ marginTop: 32, marginBottom: 8 }}>
          <span style={{ fontSize: 12, letterSpacing: "0.3em", textTransform: "uppercase", fontStyle: "normal" }}>
            Inteligência Artificial
          </span>
        </div>
        <div style={{ color: T.muted, fontSize: 14, fontStyle: "italic", marginBottom: 16 }}>
          Para análise automática de fatura na aba <em style={{ color: T.gold }}>Análise IA</em>.
          No artifact do Claude funciona automaticamente. Em produção, configure sua chave Anthropic.
        </div>
        <ApiKeyField
          label="Anthropic · Análise de Fatura com IA"
          help="Crie uma chave em console.anthropic.com. Custo aproximado: R$ 0,05 por fatura analisada."
          link="https://console.anthropic.com/settings/keys"
          value={draft.anthropic || ""}
          onChange={v => setDraft({ ...draft, anthropic: v })}
          show={false} setShow={() => {}}
          placeholder="sk-ant-... (opcional no artifact, obrigatória em produção)"
        />

        <BackupRestore />
        <SyncBlock />
        <NotificationsBlock />

        <div className="flex gap-3 mt-6">
          <button className="btn-gold" onClick={save}>Salvar configurações</button>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  ), document.body);
}

function SyncBlock() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div style={{
        marginTop: 18, padding: 14,
        border: `1px dashed ${T.border}`, background: T.bgSoft,
        borderRadius: 7,
      }}>
        <div className="label-eyebrow" style={{ color: T.muted, marginBottom: 6 }}>
          📲 Sincronizar entre dispositivos
        </div>
        <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 10, lineHeight: 1.55 }}>
          Migre seus dados pra outro Mac, iPhone ou navegador <strong>sem servidor</strong>.
          Gera um texto, você cola no outro aparelho. Funciona offline. Use WhatsApp pessoal pra arquivar fácil.
        </div>
        <button onClick={() => setOpen(true)} className="btn-gold">
          Abrir sincronização
        </button>
      </div>
      {open && <SincronizacaoModal onClose={() => setOpen(false)} />}
    </>
  );
}

function NotificationsBlock() {
  const [cfg, setCfg] = useState(getNotifCfg());
  const [perm, setPerm] = useState(getPermission());
  const [msg, setMsg] = useState(null);

  const supported = isSupported();

  // Aplica um updater (prev => next) ao cfg, persistindo o resultado.
  const persistir = (updater) => {
    setCfg(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setNotifCfg(next);
      return next;
    });
  };

  const pedirPermissao = async () => {
    const result = await requestPermission();
    setPerm(result);
    if (result === "granted") {
      persistir(prev => ({ ...prev, habilitada: true }));
      setMsg({ tipo: "ok", txt: "Notificações ativadas! Você receberá avisos de vencimentos." });
    } else if (result === "denied") {
      setMsg({ tipo: "erro", txt: "Permissão negada. Habilite nas configurações do navegador." });
    }
  };

  const desativar = () => {
    persistir(prev => ({ ...prev, habilitada: false }));
    setMsg({ tipo: "ok", txt: "Notificações desativadas." });
  };

  const toggleTipo = (tipo) => {
    persistir(prev => ({ ...prev, tipos: { ...prev.tipos, [tipo]: !prev.tipos?.[tipo] } }));
  };

  return (
    <div style={{
      marginTop: 18, padding: 14,
      border: `1px ${cfg.habilitada && perm === "granted" ? "solid" : "dashed"} ${cfg.habilitada && perm === "granted" ? T.gold : T.border}`,
      background: cfg.habilitada && perm === "granted" ? `${T.gold}11` : T.bgSoft,
      borderRadius: 7,
    }}>
      <div className="label-eyebrow" style={{ color: cfg.habilitada && perm === "granted" ? T.gold : T.muted, marginBottom: 6 }}>
        🔔 Notificações de Vencimentos
      </div>
      <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 10, lineHeight: 1.55 }}>
        {!supported
          ? "Seu navegador não suporta notificações."
          : perm === "denied"
          ? "Permissão de notificações foi negada. Reabilite nas configurações do navegador (ícone de cadeado na barra de endereço)."
          : cfg.habilitada && perm === "granted"
          ? "Você recebe avisos automáticos antes de vencimentos. Os tipos abaixo controlam o que vai chegar."
          : "Receba avisos antes que cheques, dívidas ou recebimentos vençam — mesmo com o app fechado."}
      </div>

      {supported && perm !== "denied" && (
        <>
          {!cfg.habilitada || perm !== "granted" ? (
            <button onClick={pedirPermissao} className="btn-gold">
              ▶ Ativar notificações
            </button>
          ) : (
            <>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: T.muted, display: "block", marginBottom: 4 }}>
                  Avisar com antecedência de:
                </label>
                <select value={cfg.antecedenciaDias}
                        onChange={e => { const v = parseInt(e.target.value); persistir(prev => ({ ...prev, antecedenciaDias: v })); }}
                        style={{ padding: "6px 10px", background: T.bgSoft, border: `1px solid ${T.border}`, color: T.ink, fontSize: 12, borderRadius: 5 }}>
                  <option value="1">1 dia</option>
                  <option value="2">2 dias</option>
                  <option value="3">3 dias</option>
                  <option value="5">5 dias</option>
                  <option value="7">1 semana</option>
                </select>
              </div>
              <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                {[
                  { key: "cheques",      label: "Cheques a compensar" },
                  { key: "dividas",      label: "Dívidas a pagar" },
                  { key: "recebimentos", label: "Recebimentos (devedores)" },
                  { key: "backups",      label: "Backups automáticos" },
                ].map(t => (
                  <label key={t.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!cfg.tipos[t.key]} onChange={() => toggleTipo(t.key)} />
                    <span style={{ color: cfg.tipos[t.key] ? T.ink : T.muted }}>{t.label}</span>
                  </label>
                ))}
              </div>
              <button onClick={desativar} className="btn-ghost" style={{ color: T.red, borderColor: T.red }}>
                Desativar notificações
              </button>
            </>
          )}
        </>
      )}

      {msg && (
        <div style={{
          marginTop: 10, padding: 8,
          background: msg.tipo === "ok" ? `${T.green}22` : `${T.red}22`,
          color: msg.tipo === "ok" ? T.green : T.red,
          fontSize: 12, borderRadius: 5,
        }}>
          {msg.txt}
        </div>
      )}
    </div>
  );
}

function BackupRestore() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const fileRef = useRef();
  const [includeKeys, setIncludeKeys] = useState(false);

  const handleExport = async () => {
    setBusy(true); setMsg(null);
    try {
      await exportBackup(includeKeys);
      setMsg({ tipo: "ok", txt: "Backup baixado com sucesso." });
    } catch (e) {
      setMsg({ tipo: "erro", txt: "Falha ao gerar backup: " + (e?.message || "erro") });
    }
    setBusy(false);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await confirm({
      title: "Restaurar substitui TODOS os dados atuais",
      body: "Você tem um backup do estado atual? Recomendamos baixar antes. Esta ação não pode ser desfeita.",
      danger: true, confirmLabel: "Sim, restaurar",
    });
    if (!ok) {
      e.target.value = "";
      return;
    }
    setBusy(true); setMsg(null);
    const result = await importBackup(file);
    if (result.ok) {
      const s = result.summary;
      setMsg({
        tipo: "ok",
        txt: `Restaurado: ${s.contas} contas · ${s.transacoes} transações · ${s.cartoes} cartões · ${s.ativos} ativos. Recarregando…`,
      });
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setMsg({ tipo: "erro", txt: result.error });
    }
    setBusy(false);
    e.target.value = "";
  };

  return (
    <div style={{
      background: T.bgSoft, border: `1px solid ${T.border}`,
      padding: 16, marginTop: 24,
    }}>
      <div className="label-eyebrow mb-2">Backup & Restauração</div>
      <div style={{ color: T.muted, fontSize: 13, marginBottom: 12, fontStyle: "italic" }}>
        Exporte um JSON com todos os seus dados. Use para sincronizar entre navegadores ou como
        seguro contra perda de dados (limpar cache do navegador apaga tudo).
      </div>

      <label className="flex items-center gap-2 mb-3" style={{ color: T.ink, fontSize: 13, cursor: "pointer" }}>
        <input type="checkbox" checked={includeKeys} onChange={e => setIncludeKeys(e.target.checked)} />
        Incluir chaves de API no backup
        <span style={{ color: T.faint, fontSize: 11 }}>(sensível — só ative se for arquivo pessoal)</span>
      </label>

      <div className="flex gap-2 flex-wrap">
        <button onClick={handleExport} disabled={busy}
                style={{
                  background: "transparent", color: T.gold, border: `1px solid ${T.gold}`,
                  padding: "10px 16px", fontFamily: T.sans, fontSize: 12,
                  letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500,
                  cursor: busy ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8,
                }}>
          <Download size={13} /> Baixar backup
        </button>
        <button onClick={() => fileRef.current?.click()} disabled={busy}
                style={{
                  background: "transparent", color: T.ink, border: `1px solid ${T.border}`,
                  padding: "10px 16px", fontFamily: T.sans, fontSize: 12,
                  letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 500,
                  cursor: busy ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8,
                }}>
          <Upload size={13} /> Restaurar de arquivo
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json"
               onChange={handleImport} style={{ display: "none" }} />
      </div>

      {msg && (
        <div style={{
          marginTop: 12, padding: 10,
          background: msg.tipo === "ok" ? `${T.green}22` : `${T.red}22`,
          color: msg.tipo === "ok" ? T.green : T.red,
          fontSize: 13, border: `1px solid ${msg.tipo === "ok" ? T.green : T.red}`,
        }}>
          {msg.txt}
        </div>
      )}

      {/* Backups automáticos */}
      <AutoBackupsList />
    </div>
  );
}

function AutoBackupsList() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const refresh = async () => {
    setLoading(true);
    try { setBackups(await listBackups()); }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); }, []);

  const restaurar = async (id) => {
    const ok = await confirm({
      title: "Restaurar este backup?",
      body: "Vai SUBSTITUIR todos os dados atuais. Se quiser preservar o estado atual, baixe um backup antes.",
      danger: true, confirmLabel: "Restaurar",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const data = await readBackup(id);
      if (!data) { setMsg({ tipo: "erro", txt: "Não consegui ler o backup." }); return; }
      localStorage.setItem("financas:dados:v1", JSON.stringify(data));
      setMsg({ tipo: "ok", txt: "Backup restaurado. Recarregando…" });
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setMsg({ tipo: "erro", txt: "Erro ao restaurar: " + (e?.message || "") });
    } finally {
      setBusy(false);
    }
  };

  const apagar = async (id) => {
    const ok = await confirm({
      title: "Apagar este backup?",
      body: "A versão será removida permanentemente.",
      danger: true, confirmLabel: "Apagar",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteBackup(id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const criarAgora = async () => {
    // O snapshot dos dados é gerado pelo App.jsx no useEffect. Aqui só forçamos um manual usando o storage atual.
    const dados = safeParse(localStorage.getItem("financas:dados:v1"), null);
    if (!dados) { setMsg({ tipo: "erro", txt: "Sem dados pra fazer backup ainda." }); return; }
    setBusy(true);
    try {
      const m = await createBackup(dados, "manual");
      if (m) {
        setMsg({ tipo: "ok", txt: `Backup criado · ${m.sizeKb}KB · ${formatBackupDate(m.ts)}` });
        await refresh();
      } else {
        setMsg({ tipo: "erro", txt: "Não consegui criar o backup (sem sessão ou rede indisponível)." });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 16, padding: 12, border: `1px solid ${T.border}`, borderRadius: 7 }}>
      <div className="label-eyebrow" style={{ marginBottom: 8 }}>Backups da sua conta · últimos 5</div>
      <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 10, fontStyle: "italic" }}>
        A cada 6h o cockpit envia um snapshot da sua conta pro servidor (isolado dos outros usuários via RLS). Pode restaurar qualquer um a qualquer momento, de qualquer dispositivo.
      </div>

      {loading ? (
        <div style={{ padding: 12, fontSize: 12, color: T.faint, fontStyle: "italic", textAlign: "center" }}>
          Carregando backups…
        </div>
      ) : backups.length === 0 ? (
        <div style={{ padding: 12, fontSize: 12, color: T.faint, fontStyle: "italic", textAlign: "center" }}>
          Nenhum backup ainda — o primeiro será criado nas próximas horas.
        </div>
      ) : (
        <div>
          {backups.map(b => (
            <div key={b.id} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "7px 0",
              borderBottom: `1px dashed ${T.border}`, fontSize: 12,
            }}>
              <span style={{
                fontSize: 9, padding: "2px 7px", borderRadius: 100,
                background: b.label === "manual" ? `${T.gold}22` : `${T.green}22`,
                color: b.label === "manual" ? T.gold : T.green,
                letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 500,
              }}>{b.label}</span>
              <span style={{ flex: 1, color: T.ink }}>{formatBackupDate(b.ts)}</span>
              <span style={{ color: T.muted, fontSize: 11 }}>{b.sizeKb}KB</span>
              <button onClick={() => restaurar(b.id)} disabled={busy}
                style={{ background: "transparent", border: `1px solid ${T.gold}`, color: T.gold, padding: "4px 9px", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1, borderRadius: 4 }}>
                Restaurar
              </button>
              <button onClick={() => apagar(b.id)} disabled={busy}
                aria-label="Apagar backup"
                style={{ background: "transparent", border: "none", color: T.red, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1, padding: 4 }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <button onClick={criarAgora} disabled={busy}
        style={{ marginTop: 10, background: "transparent", color: T.muted, border: `1px solid ${T.border}`, padding: "7px 12px", fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 500, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1, borderRadius: 6 }}>
        {busy ? "Trabalhando…" : "+ Criar backup agora"}
      </button>

      {msg && (
        <div style={{
          marginTop: 10, padding: 8,
          background: msg.tipo === "ok" ? `${T.green}22` : `${T.red}22`,
          color: msg.tipo === "ok" ? T.green : T.red,
          fontSize: 12, borderRadius: 5,
        }}>
          {msg.txt}
        </div>
      )}
    </div>
  );
}

const safeParse = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };

function ApiKeyField({ label, help, link, value, onChange, show, setShow, testing, result, onTest, placeholder }) {
  return (
    <div style={{ marginBottom: 16, padding: 16, background: T.bgSoft, border: `1px solid ${T.border}` }}>
      <div className="flex items-baseline justify-between mb-1">
        <div style={{ fontFamily: T.serif, fontSize: 17, color: T.ink, lineHeight: 1.2 }}>{label}</div>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer"
             style={{ color: T.gold, fontSize: 11, fontFamily: T.sans, letterSpacing: "0.1em",
                      textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 4 }}>
            Obter <ExternalLink size={11} />
          </a>
        )}
      </div>
      <div style={{ color: T.muted, fontSize: 12, fontStyle: "italic", marginBottom: 10 }}>{help}</div>

      <div className="flex gap-2">
        <div style={{ position: "relative", flex: 1 }}>
          <input type={show ? "text" : "password"}
                 value={value} onChange={e => onChange(e.target.value)}
                 placeholder={placeholder}
                 style={{ paddingRight: 40 }} />
          <button onClick={() => setShow(!show)}
                  style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)",
                           background: "transparent", border: "none", color: T.muted, padding: 6, cursor: "pointer" }}>
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button onClick={onTest} disabled={testing}
                style={{ border: `1px solid ${T.border}`, color: T.gold, background: T.card,
                         padding: "0 14px", fontFamily: T.sans, fontSize: 11, letterSpacing: "0.1em",
                         textTransform: "uppercase", cursor: testing ? "wait" : "pointer", whiteSpace: "nowrap" }}>
          {testing ? <RefreshCw size={12} className="spin inline" /> : "Testar"}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 8, fontSize: 12, fontFamily: T.sans, letterSpacing: "0.05em",
                      color: result.ok ? T.green : T.red, display: "flex", alignItems: "center", gap: 6 }}>
          {result.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {result.msg}
        </div>
      )}
    </div>
  );
}

function ApiRow({ nome, desc, url }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div>
        <span style={{ color: T.green, fontSize: 11, fontFamily: T.sans, letterSpacing: "0.1em", textTransform: "uppercase" }}>● Ativo</span>
        <span style={{ color: T.ink, fontFamily: T.serif, fontSize: 15, marginLeft: 10 }}>{nome}</span>
        <div style={{ color: T.muted, fontSize: 12, fontStyle: "italic" }}>{desc}</div>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer"
         style={{ color: T.muted, fontSize: 11 }}>
        <ExternalLink size={12} />
      </a>
    </div>
  );
}



