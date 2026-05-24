import React, { useState, useEffect } from "react";
import { T, THEMES, applyTheme } from "../../lib/theme.js";
import { saveAll, loadAll } from "../../lib/storage.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import { CARDS_DISPONIVEIS, lerCardsConfig, salvarCardsConfig } from "../../lib/dashboardConfig.js";
import {
  getSyncToken, setSyncToken, gerarToken, pingSync,
  cloudFetchState, cloudSaveState,
} from "../../lib/cloudSync.js";

/**
 * Configurações centralizadas (estilo demo v3).
 * Recebe `subtab` para escolher qual aba mostrar.
 */
export default function Configuracoes({
  subtab = "cfg-aparencia",
  themeId, setThemeId,
  apiKeys, setApiKeys,
  modulesEnabled, setModulesEnabled,
  onClearModule,
}) {
  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="eb">Sistema · Configurações</div>
      <h1 className="h1">Painel de <em>controle.</em></h1>
      <p className="hs">Tema, integrações de API, módulos ativos e backup de dados.</p>

      {subtab === "cfg-aparencia" && (
        <Aparencia themeId={themeId} setThemeId={setThemeId} />
      )}
      {subtab === "cfg-apis" && (
        <APIs apiKeys={apiKeys} setApiKeys={setApiKeys} />
      )}
      {subtab === "cfg-modulos" && (
        <Modulos modulesEnabled={modulesEnabled} setModulesEnabled={setModulesEnabled}
                 onClearModule={onClearModule} />
      )}
      {subtab === "cfg-backup" && (
        <>
          <SyncCloud />
          <Backup />
        </>
      )}
    </div>
  );
}

/* ============ APARÊNCIA ============ */
function Aparencia({ themeId, setThemeId }) {
  const trocar = (id) => {
    setThemeId(id);
    applyTheme(id);
    toast.success(`Paleta "${THEMES[id].nome}" aplicada.`);
  };

  // Layout (horizontal/vertical)
  const [layoutPref, setLayoutPref] = useState(() => {
    try { return localStorage.getItem("af4:layout") || "horizontal"; }
    catch { return "horizontal"; }
  });
  const mudarLayout = (v) => {
    try { localStorage.setItem("af4:layout", v); } catch {}
    setLayoutPref(v);
    window.dispatchEvent(new CustomEvent("af4:layout-changed", { detail: v }));
    toast.success(`Layout: ${v === "vertical" ? "Sidebar lateral" : "Topo (horizontal)"}.`);
  };

  // Cards do Painel (Visão Geral)
  const [cardsCfg, setCardsCfg] = useState(lerCardsConfig());
  const toggleCardLocal = (id) => {
    const novo = { ...cardsCfg, [id]: !cardsCfg[id] };
    setCardsCfg(novo);
    salvarCardsConfig(novo);
  };

  return (
    <>
      <div className="st"><h2>Layout das abas</h2><div className="mt">Como você quer navegar</div></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        <button onClick={() => mudarLayout("horizontal")}
          style={{
            padding: "14px 16px", textAlign: "left",
            border: `${layoutPref === "horizontal" ? "2px" : "1px"} solid ${layoutPref === "horizontal" ? T.gold : T.border}`,
            background: layoutPref === "horizontal" ? `${T.gold}11` : T.card,
            borderRadius: 8, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 12,
          }}>
          <div style={{ fontSize: 22 }}>📊</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Horizontal (topo)</div>
            <div style={{ fontSize: 11, color: T.muted }}>Padrão atual · subtabs no header</div>
          </div>
        </button>
        <button onClick={() => mudarLayout("vertical")}
          style={{
            padding: "14px 16px", textAlign: "left",
            border: `${layoutPref === "vertical" ? "2px" : "1px"} solid ${layoutPref === "vertical" ? T.gold : T.border}`,
            background: layoutPref === "vertical" ? `${T.gold}11` : T.card,
            borderRadius: 8, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 12,
          }}>
          <div style={{ fontSize: 22 }}>📋</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Vertical (sidebar)</div>
            <div style={{ fontSize: 11, color: T.muted }}>Menu à esquerda · mais info na tela</div>
          </div>
        </button>
      </div>
      <div style={{
        marginBottom: 24, padding: 10, fontSize: 11, color: T.muted,
        background: T.bgSoft, borderRadius: 6, fontStyle: "italic",
      }}>
        ℹ️ Em celular portrait o layout sempre força horizontal automaticamente.
      </div>

      <div className="st"><h2>Paletas disponíveis</h2><div className="mt">10 opções</div></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {Object.values(THEMES).map(theme => {
          const active = themeId === theme.id;
          return (
            <div key={theme.id} onClick={() => trocar(theme.id)}
                 style={{
                   background: T.card,
                   border: `2px solid ${active ? theme.gold : T.border}`,
                   borderRadius: 12, padding: 16, cursor: "pointer",
                   transition: "all .2s", position: "relative",
                 }}>
              <div style={{
                width: "100%", height: 60, borderRadius: 8,
                background: `linear-gradient(135deg, ${theme.gold}, ${theme.goldHi})`,
                marginBottom: 12,
              }} />
              <div style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>{theme.nome}</div>
              <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3 }}>{theme.subtitulo}</div>
              {active && (
                <div style={{
                  position: "absolute", top: 8, right: 8,
                  background: theme.gold, color: T.bg,
                  width: 20, height: 20, borderRadius: "50%",
                  display: "grid", placeItems: "center",
                  fontSize: 11, fontWeight: 700,
                }}>✓</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="ar" style={{ marginTop: 24 }}>
        <div className="ai">💡</div>
        <div className="at"><strong>Dica:</strong><p>Você também pode trocar a paleta pelo header — basta clicar nas bolinhas coloridas ao lado do logo.</p></div>
      </div>

      {/* Cards do Painel */}
      <div className="st" style={{ marginTop: 28 }}>
        <h2>Cards do Painel</h2>
        <div className="mt">Visão Geral</div>
      </div>
      <p style={{ fontSize: 12, color: T.faint, marginBottom: 12 }}>
        Escolha o que aparece na tela inicial. Os gráficos marcados como <strong>NOVO</strong> vêm desligados.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {CARDS_DISPONIVEIS.map(card => (
          <label key={card.id} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
            background: T.bgSoft, borderRadius: 7,
            cursor: card.fixo ? "default" : "pointer",
            opacity: card.fixo ? 0.7 : 1,
          }}>
            <input type="checkbox" checked={!!cardsCfg[card.id]} disabled={card.fixo}
                   onChange={() => !card.fixo && toggleCardLocal(card.id)}
                   style={{ width: 15, height: 15, accentColor: T.gold }} />
            <span style={{ fontSize: 13, fontWeight: 500, flex: 1, color: T.ink }}>{card.label}</span>
            {card.fase === 2 && (
              <span style={{ fontSize: 9, padding: "1px 6px", background: `${T.gold}22`, color: T.gold, borderRadius: 3, fontWeight: 700, letterSpacing: ".05em" }}>NOVO</span>
            )}
            {card.fixo && (
              <span style={{ fontSize: 9, color: T.faint, letterSpacing: ".05em" }}>fixo</span>
            )}
          </label>
        ))}
      </div>
    </>
  );
}

/* ============ APIs ============ */
function APIs({ apiKeys, setApiKeys }) {
  // Carrega edit.brapi do localStorage se já existir lá (precedência sobre apiKeys, pra ter
  // o mesmo valor que a lib brapi.js usa)
  const [edit, setEdit] = useState(() => {
    const base = apiKeys || {};
    try {
      const lsBrapi = localStorage.getItem("af4:brapi-token");
      if (lsBrapi && !base.brapi) return { ...base, brapi: lsBrapi };
    } catch {}
    return base;
  });

  // Gemini key vive em localStorage separado (af4:gemini-key), não no apiKeys
  const [geminiKeyDraft, setGeminiKeyDraft] = useState(() => {
    try { return localStorage.getItem("af4:gemini-key") || ""; }
    catch { return ""; }
  });
  const [statusTesteGemini, setStatusTesteGemini] = useState(null);

  const salvarChaveGemini = () => {
    try {
      localStorage.setItem("af4:gemini-key", (geminiKeyDraft || "").trim());
      toast.success("Chave do Gemini salva.");
      setStatusTesteGemini(null);
    } catch (e) {
      toast.error("Falha ao salvar a chave.");
    }
  };

  const testarGemini = async () => {
    setStatusTesteGemini({ ok: null, resposta: "Testando…" });
    try {
      const { pingGemini } = await import("../../lib/gemini.js");
      // Usa a chave que está sendo digitada (não salva ainda) — útil pra validar antes de salvar
      const r = await pingGemini((geminiKeyDraft || "").trim());
      setStatusTesteGemini(r);
    } catch (e) {
      setStatusTesteGemini({ ok: false, erro: e.message });
    }
  };

  // BRAPI: token vive em apiKeys.brapi (estado) E em localStorage("af4:brapi-token") (lido pela lib brapi.js)
  const [statusTesteBrapi, setStatusTesteBrapi] = useState(null);
  const testarBrapi = async () => {
    setStatusTesteBrapi({ ok: null, resposta: "Testando…" });
    try {
      const { pingBRAPI } = await import("../../lib/brapi.js");
      const r = await pingBRAPI((edit.brapi || "").trim());
      setStatusTesteBrapi(r);
    } catch (e) {
      setStatusTesteBrapi({ ok: false, erro: e.message });
    }
  };

  const save = () => {
    setApiKeys(edit);
    // Sincroniza com localStorage pra que lib/brapi.js encontre
    try {
      if (edit.brapi) localStorage.setItem("af4:brapi-token", (edit.brapi || "").trim());
      else localStorage.removeItem("af4:brapi-token");
    } catch {}
    toast.success("Chaves de API salvas.");
  };

  return (
    <>
      <div className="st"><h2>Integrações</h2><div className="mt">Chaves de API</div></div>

      <div className="fb">
        <h4>Mercado Financeiro</h4>
        <div className="fr">
          <div className="ff">
            <label>Brapi.dev (Cotações B3: ações, FIIs, BDRs, ETFs)</label>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="password" value={edit.brapi || ""}
                     onChange={e => setEdit({ ...edit, brapi: e.target.value })}
                     placeholder="Cole o token aqui"
                     style={{ flex: 1 }} />
              <button onClick={testarBrapi} className="btn-ghost" style={{ padding: "0 10px", fontSize: 10, whiteSpace: "nowrap" }}>
                🧪 Testar
              </button>
            </div>
            <div className="hint">Gratuito · 1.000 req/mês · <a href="https://brapi.dev" target="_blank" rel="noopener noreferrer" style={{ color: T.gold }}>brapi.dev</a></div>
            {statusTesteBrapi && (
              <div style={{
                marginTop: 6, padding: "6px 10px", borderRadius: 5, fontSize: 11,
                background: statusTesteBrapi.ok ? `${T.green}15` : `${T.red}15`,
                color: statusTesteBrapi.ok ? T.green : T.red,
              }}>
                {statusTesteBrapi.ok
                  ? `✓ Conectado · ${statusTesteBrapi.resposta || "ok"}`
                  : `✗ ${statusTesteBrapi.erro}`}
              </div>
            )}
          </div>
          <div className="ff">
            <label>Alpha Vantage (Internacional)</label>
            <input type="password" value={edit.alphavantage || ""}
                   onChange={e => setEdit({ ...edit, alphavantage: e.target.value })}
                   placeholder="Cole sua chave aqui" />
            <div className="hint">Gratuito · 500 req/dia</div>
          </div>
        </div>
      </div>

      <div className="fb">
        <h4>🤖 Inteligência Artificial</h4>
        <p style={{ fontSize: 11.5, color: T.muted, marginTop: -4, marginBottom: 10 }}>
          Análise de fatura usa <strong>Google Gemini 2.5 Flash</strong> (1.500 análises/dia grátis).
          Crie sua chave em <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer"
                                style={{ color: T.gold }}>aistudio.google.com</a>.
        </p>
        <div className="fr">
          <div className="ff" style={{ gridColumn: "1 / -1" }}>
            <label>Gemini API Key</label>
            <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
              <input type="password"
                     value={geminiKeyDraft}
                     onChange={e => setGeminiKeyDraft(e.target.value)}
                     placeholder="AIzaSy..."
                     style={{ flex: 1 }} />
              <button onClick={salvarChaveGemini} className="btn-gold" style={{ padding: "0 14px", fontSize: 11, whiteSpace: "nowrap" }}>
                Salvar
              </button>
              <button onClick={testarGemini} className="btn-ghost" style={{ padding: "0 14px", fontSize: 11, whiteSpace: "nowrap" }}>
                🧪 Testar
              </button>
            </div>
            {statusTesteGemini && (
              <div style={{
                marginTop: 10, padding: "8px 12px", borderRadius: 6, fontSize: 11.5,
                background: statusTesteGemini.ok ? `${T.green}15` : `${T.red}15`,
                color: statusTesteGemini.ok ? T.green : T.red,
                border: `1px solid ${statusTesteGemini.ok ? T.green : T.red}55`,
              }}>
                {statusTesteGemini.ok
                  ? `✓ Conectado · resposta: "${statusTesteGemini.resposta}"`
                  : `✗ ${statusTesteGemini.erro}`}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fb">
        <h4>Comportamento</h4>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 0" }}>
          <input type="checkbox"
                 checked={edit.useRealMarket !== false}
                 onChange={e => setEdit({ ...edit, useRealMarket: e.target.checked })}
                 style={{ width: 16, height: 16, cursor: "pointer" }} />
          <span style={{ fontSize: 13, color: T.ink }}>
            Usar cotações reais (precisa da chave Brapi)
          </span>
        </label>
        <div className="hint">Quando desligado, usa cotações simuladas com variação aleatória.</div>
      </div>

      <button className="btn-gold" onClick={save}>Salvar chaves</button>
    </>
  );
}

/* ============ MÓDULOS ============ */
function Modulos({ modulesEnabled, setModulesEnabled, onClearModule }) {
  const modulos = [
    { id: "financas", label: "Finanças", desc: "Contas, cartões, transações, categorias, calendário, despesas, análise IA" },
    { id: "invest",   label: "Investimentos", desc: "Carteira, performance, proventos, mercado, simulador" },
  ];

  const toggle = (id) => {
    const next = { ...modulesEnabled, [id]: !modulesEnabled?.[id] };
    setModulesEnabled(next);
    toast.success(`Módulo ${id} ${next[id] ? "ativado" : "desativado"}.`);
  };

  const limpar = async (id) => {
    const label = modulos.find(m => m.id === id)?.label ?? id;
    const ok = await confirm({
      title: `Limpar dados de "${label}"?`,
      body: "Todos os dados desse módulo serão removidos do navegador E do Supabase (se você está logado). Esta ação não pode ser desfeita.",
      danger: true, confirmLabel: "Limpar tudo",
    });
    if (!ok) return;
    if (typeof onClearModule === "function") {
      await onClearModule(id);
      toast.success(`Dados de "${label}" foram apagados.`);
    } else {
      toast.error("Não foi possível limpar — recarregue a página e tente de novo.");
    }
  };

  return (
    <>
      <div className="st"><h2>Módulos do App</h2><div className="mt">Ligar/desligar</div></div>

      {modulos.map(m => {
        const ativo = modulesEnabled?.[m.id] !== false;
        return (
          <div key={m.id} style={{
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
            padding: 18, marginBottom: 12,
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
          }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: T.ink, marginBottom: 4 }}>
                {m.label}
              </div>
              <div style={{ fontSize: 11, color: T.muted }}>{m.desc}</div>
            </div>
            <button onClick={() => toggle(m.id)}
                    style={{
                      width: 44, height: 24, borderRadius: 100,
                      background: ativo ? T.gold : T.border,
                      border: "none", position: "relative", cursor: "pointer",
                      transition: "all .2s",
                    }}>
              <div style={{
                position: "absolute", top: 2, left: ativo ? 22 : 2,
                width: 20, height: 20, borderRadius: "50%",
                background: "#fff", transition: "all .2s",
              }} />
            </button>
            <button className="btn bd" onClick={() => limpar(m.id)}
                    style={{ fontSize: 10 }}>
              Limpar dados
            </button>
          </div>
        );
      })}
    </>
  );
}

/* ============ BACKUP ============ */
function Backup() {
  const exportar = async () => {
    try {
      const data = await loadAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `af4-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup exportado.");
    } catch (e) {
      toast.error("Falha ao exportar.");
    }
  };

  const importar = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        await saveAll(data);
        toast.success("Backup importado. Recarregue a página.");
      } catch {
        toast.error("Arquivo inválido.");
      }
    };
    input.click();
  };

  return (
    <>
      <div className="st"><h2>Backup & Restauração</h2><div className="mt">JSON</div></div>

      <div className="fb">
        <h4>Exportar</h4>
        <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>
          Baixa todos os seus dados (contas, transações, cartões, investimentos, configurações) em um único arquivo JSON.
        </p>
        <button className="btn-gold" onClick={exportar}>↓ Baixar backup completo</button>
      </div>

      <div className="fb">
        <h4>Importar</h4>
        <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>
          Restaura um backup previamente exportado. <strong>Atenção:</strong> isso substitui os dados atuais.
        </p>
        <button className="btn" onClick={importar}>↑ Selecionar arquivo</button>
      </div>

      <div className="ar">
        <div className="ai">💾</div>
        <div className="at"><strong>Recomendação</strong><p>Faça backup pelo menos uma vez por semana. Guarde o arquivo em Google Drive, iCloud ou pen-drive.</p></div>
      </div>
    </>
  );
}

/* ============ SINCRONIZAÇÃO NA NUVEM (MANUAL) ============ */
function SyncCloud() {
  const [token, setToken] = useState(() => getSyncToken());
  const [salvo, setSalvo] = useState(() => getSyncToken());
  const [ping, setPing] = useState(null);
  const [busy, setBusy] = useState(null); // null | "upload" | "download"
  const [msg, setMsg] = useState(null);    // { ok, texto }

  useEffect(() => {
    pingSync().then(setPing);
  }, []);

  const gerar = () => {
    const novo = gerarToken();
    setToken(novo);
    setSyncToken(novo);
    setSalvo(novo);
    setMsg({ ok: true, texto: "Token gerado e salvo." });
  };

  const salvar = () => {
    setSyncToken(token);
    setSalvo(token);
    setMsg({ ok: true, texto: token ? "Token salvo." : "Token removido." });
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(token);
      toast.success("Token copiado.");
    } catch {
      toast.error("Não foi possível copiar — selecione e copie manualmente.");
    }
  };

  const upload = async () => {
    if (!token) { setMsg({ ok: false, texto: "Configure um token primeiro." }); return; }
    setBusy("upload"); setMsg(null);
    try {
      setSyncToken(token); // garante que o token está salvo
      const dados = await loadAll();
      if (!dados) {
        setMsg({ ok: false, texto: "Nada pra enviar — localStorage vazio." });
        return;
      }
      const r = await cloudSaveState(dados);
      const bytes = r?.bytes ? ` (${(r.bytes / 1024).toFixed(1)} KB)` : "";
      setMsg({ ok: true, texto: `✓ Dados enviados pra nuvem${bytes}. Agora vá em outro dispositivo, cole o mesmo token e clique "Baixar da nuvem".` });
    } catch (e) {
      setMsg({ ok: false, texto: `Erro ao enviar: ${e?.message || e}` });
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    if (!token) { setMsg({ ok: false, texto: "Configure um token primeiro." }); return; }
    setBusy("download"); setMsg(null);
    try {
      setSyncToken(token);
      const remoto = await cloudFetchState();
      if (!remoto) {
        setMsg({ ok: false, texto: "Nada na nuvem pra esse token. Faz upload de outro dispositivo primeiro." });
        return;
      }
      const ok = await confirm({
        title: "Substituir dados locais?",
        body: "Os dados da nuvem vão SUBSTITUIR tudo que está nesse navegador. Faça backup antes se não tiver certeza.",
        danger: true,
        confirmLabel: "Substituir",
      });
      if (!ok) { setBusy(null); return; }
      await saveAll(remoto, { immediate: true });
      setMsg({ ok: true, texto: "✓ Dados baixados da nuvem. Recarregue a página." });
    } catch (e) {
      setMsg({ ok: false, texto: `Erro ao baixar: ${e?.message || e}` });
    } finally {
      setBusy(null);
    }
  };

  const dirty = token.trim() !== (salvo || "").trim();
  const kvOk = ping?.ok && ping?.kv;

  return (
    <>
      <div className="st"><h2>Sincronização entre dispositivos</h2><div className="mt">Cloudflare KV · Manual</div></div>

      <div className="fb">
        <h4>Status do servidor</h4>
        <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 10 }}>
          {ping == null && "Verificando..."}
          {ping?.ok && ping.kv && (
            <span style={{ color: T.green }}>● Servidor pronto. {ping.version && <em style={{ color: T.faint }}>(v{ping.version})</em>}</span>
          )}
          {ping?.ok && !ping.kv && (
            <span style={{ color: T.red }}>
              ● O Worker está online, mas o KV namespace <strong>AF4_KV</strong> não foi vinculado. Veja instruções abaixo.
            </span>
          )}
          {ping?.ok === false && (
            <span style={{ color: T.red }}>● Não foi possível alcançar o servidor: {ping.erro}</span>
          )}
        </div>
      </div>

      <div className="fb">
        <h4>1. Seu token</h4>
        <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 12 }}>
          Cada dispositivo que tiver o <strong>mesmo token</strong> pode trocar dados via "Enviar" e "Baixar".
          Mantenha o token em segurança — quem tem o token tem seus dados.
        </p>

        <div style={{ display: "flex", gap: 6, alignItems: "stretch", flexWrap: "wrap" }}>
          <input
            type="text"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="Cole o token aqui ou clique em Gerar novo"
            style={{ flex: "1 1 280px", minWidth: 220, fontFamily: T.mono, fontSize: 13 }}
            autoCorrect="off" autoCapitalize="off" spellCheck={false}
          />
          <button onClick={gerar} className="btn-ghost" style={{ whiteSpace: "nowrap" }}>
            Gerar novo
          </button>
          {token && (
            <button onClick={copiar} className="btn-ghost" style={{ whiteSpace: "nowrap" }}>
              Copiar
            </button>
          )}
        </div>

        {dirty && (
          <button onClick={salvar} className="btn-gold" style={{ marginTop: 10 }}>
            {token ? "Salvar token" : "Remover token"}
          </button>
        )}
      </div>

      <div className="fb">
        <h4>2. Enviar e baixar</h4>
        <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 12 }}>
          Sincronização <strong>manual</strong>: você decide quando enviar pra nuvem ou baixar.
          Nada acontece automaticamente.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button onClick={upload}
            className="btn-gold"
            disabled={!salvo || !kvOk || busy === "upload"}
            style={{
              opacity: (!salvo || !kvOk) ? 0.5 : 1,
              cursor: (!salvo || !kvOk) ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            {busy === "upload" ? "Enviando..." : "☁️ ↑ Enviar pra nuvem"}
          </button>
          <button onClick={download}
            className="btn"
            disabled={!salvo || !kvOk || busy === "download"}
            style={{
              background: T.bgSoft, color: T.ink, border: `1px solid ${T.border}`,
              padding: "10px 20px", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em",
              textTransform: "uppercase", cursor: (!salvo || !kvOk) ? "not-allowed" : "pointer",
              opacity: (!salvo || !kvOk) ? 0.5 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            {busy === "download" ? "Baixando..." : "☁️ ↓ Baixar da nuvem"}
          </button>
        </div>

        {msg && (
          <div style={{
            marginTop: 12, padding: "10px 14px", borderRadius: 6, fontSize: 12,
            background: msg.ok ? `${T.green}15` : `${T.red}15`,
            color: msg.ok ? T.green : T.red,
            border: `1px solid ${msg.ok ? T.green : T.red}55`,
            lineHeight: 1.5,
          }}>
            {msg.texto}
          </div>
        )}

        {!salvo && (
          <div style={{ marginTop: 10, fontSize: 11.5, color: T.muted, fontStyle: "italic" }}>
            Salve um token primeiro pra habilitar os botões.
          </div>
        )}
      </div>

      {!kvOk && ping?.ok === true && (
        <div className="fb" style={{ borderColor: T.gold }}>
          <h4>⚙️ Setup inicial (uma vez)</h4>
          <ol style={{ paddingLeft: 18, fontSize: 12.5, color: T.muted, lineHeight: 1.7 }}>
            <li>Abra <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer" style={{ color: T.gold }}>dash.cloudflare.com</a></li>
            <li>Workers & Pages → <strong>KV</strong> → <em>Create a namespace</em> → nome: <code style={{ background: T.bgSoft, padding: "1px 5px", borderRadius: 3 }}>af4-state</code></li>
            <li>Workers & Pages → <strong>af4cockpit</strong> → <em>Bindings</em> → <em>Add binding</em>: KV namespace, variable <code style={{ background: T.bgSoft, padding: "1px 5px", borderRadius: 3 }}>AF4_KV</code>, namespace <code style={{ background: T.bgSoft, padding: "1px 5px", borderRadius: 3 }}>af4-state</code></li>
            <li>Save · aguarde ~30s · recarregue</li>
          </ol>
        </div>
      )}

      <div className="ar" style={{ marginTop: 16 }}>
        <div className="ai">💡</div>
        <div className="at">
          <strong>Como usar no dia a dia</strong>
          <p>
            <strong>Dispositivo principal:</strong> quando quiser sincronizar, vem aqui → "Enviar pra nuvem".<br />
            <strong>Outros dispositivos:</strong> cola o mesmo token → "Baixar da nuvem" → recarrega a página.
          </p>
        </div>
      </div>
    </>
  );
}
