import React, { useState, useEffect } from "react";
import { T, THEMES, applyTheme } from "../../lib/theme.js";
import { saveAll, loadAll } from "../../lib/storage.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import { CARDS_DISPONIVEIS, lerCardsConfig, salvarCardsConfig } from "../../lib/dashboardConfig.js";
import {
  getGistToken, setGistToken, testGistToken,
  gistFetchState, gistSaveState,
} from "../../lib/gistSync.js";
import { migrarTudo } from "../../lib/db/migrate.js";
import { tabelasNovasExistem, snapshotContagens } from "../../lib/db/client.js";

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
  ehGestor = false,
}) {
  // APIs foi removida. Módulos é só do gestor. Se cair numa aba indisponível,
  // mostra Aparência.
  const sub = (subtab === "cfg-apis" || (!ehGestor && subtab === "cfg-modulos"))
    ? "cfg-aparencia" : subtab;
  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="eb">Sistema · Configurações</div>
      <h1 className="h1">Painel de <em>controle.</em></h1>
      <p className="hs">Tema, layout{ehGestor ? ", módulos" : ""} e backup dos seus dados.</p>

      {sub === "cfg-aparencia" && (
        <Aparencia themeId={themeId} setThemeId={setThemeId} />
      )}
      {sub === "cfg-modulos" && ehGestor && (
        <Modulos modulesEnabled={modulesEnabled} setModulesEnabled={setModulesEnabled}
                 onClearModule={onClearModule} />
      )}
      {sub === "cfg-backup" && (
        <Backup />
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
      <div className="cfg-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
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
      <style>{`
        @media (max-width: 480px) {
          .cfg-2col { grid-template-columns: 1fr !important; }
        }
      `}</style>
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

  // Gemini key: guardada em apiKeys.gemini (sincroniza na conta/nuvem) E
  // espelhada em localStorage("af4:gemini-key"), que é onde lib/gemini.js lê.
  // Assim o cliente configura uma vez e não precisa recolocar em outro aparelho.
  const [geminiKeyDraft, setGeminiKeyDraft] = useState(() => {
    try { return (apiKeys?.gemini) || localStorage.getItem("af4:gemini-key") || ""; }
    catch { return apiKeys?.gemini || ""; }
  });
  const [statusTesteGemini, setStatusTesteGemini] = useState(null);

  // PIN do scanner de recibo (Worker /api/recibo). Vive em localStorage.
  const [reciboPinDraft, setReciboPinDraft] = useState(() => {
    try { return localStorage.getItem("af4:recibo-pin") || ""; } catch { return ""; }
  });
  const salvarReciboPin = () => {
    try {
      localStorage.setItem("af4:recibo-pin", (reciboPinDraft || "").trim());
      toast.success("PIN do recibo salvo.");
    } catch {}
  };

  const salvarChaveGemini = () => {
    const key = (geminiKeyDraft || "").trim();
    try {
      localStorage.setItem("af4:gemini-key", key);
      // Também guarda em apiKeys → sincroniza com a conta (nuvem) e segue o
      // usuário em outros aparelhos, sem precisar recolocar.
      setApiKeys(prev => ({ ...prev, gemini: key }));
      setEdit(prev => ({ ...prev, gemini: key }));
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
        <h4>📷 Escanear recibo</h4>
        <p style={{ fontSize: 11.5, color: T.muted, marginTop: -4, marginBottom: 10 }}>
          O scanner usa o servidor (Claude Vision) com a chave protegida — você não precisa
          colar nenhuma chave de API aqui. Se o endpoint estiver protegido por <strong>PIN</strong>,
          informe o mesmo PIN configurado no Worker.
        </p>
        <div className="fr">
          <div className="ff" style={{ gridColumn: "1 / -1" }}>
            <label>PIN do recibo (opcional)</label>
            <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
              <input type="password"
                     value={reciboPinDraft}
                     onChange={e => setReciboPinDraft(e.target.value)}
                     placeholder="Só se o Worker exigir PIN"
                     style={{ flex: 1 }} />
              <button onClick={salvarReciboPin} className="btn-gold" style={{ padding: "0 14px", fontSize: 11, whiteSpace: "nowrap" }}>
                Salvar
              </button>
            </div>
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

/* ============ SINCRONIZAÇÃO VIA GITHUB GIST ============ */
function SyncGist() {
  const [token, setToken] = useState(() => getGistToken());
  const [salvo, setSalvo] = useState(() => getGistToken());
  const [user, setUser] = useState(null);   // { login, name } se conectado
  const [busy, setBusy] = useState(null);    // null | "test" | "upload" | "download"
  const [msg, setMsg] = useState(null);      // { ok, texto }

  // Valida o token salvo no boot pra mostrar quem está conectado
  useEffect(() => {
    if (!salvo) { setUser(null); return; }
    testGistToken(salvo).then(r => {
      if (r.ok) setUser({ login: r.login, name: r.name });
      else setUser(null);
    });
  }, [salvo]);

  const salvar = async () => {
    setBusy("test"); setMsg(null);
    const r = await testGistToken(token);
    if (r.ok) {
      setGistToken(token);
      setSalvo(token);
      setUser({ login: r.login, name: r.name });
      setMsg({ ok: true, texto: `✓ Conectado como @${r.login}. Token salvo neste navegador.` });
    } else {
      setMsg({ ok: false, texto: `Token inválido: ${r.erro}` });
    }
    setBusy(null);
  };

  const remover = () => {
    setGistToken("");
    setToken("");
    setSalvo("");
    setUser(null);
    setMsg({ ok: true, texto: "Token removido." });
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
    if (!salvo) { setMsg({ ok: false, texto: "Salve um token primeiro." }); return; }
    setBusy("upload"); setMsg(null);
    try {
      const dados = await loadAll();
      if (!dados) {
        setMsg({ ok: false, texto: "Nada pra enviar — localStorage vazio." });
        return;
      }
      const r = await gistSaveState(dados);
      const kb = r?.bytes ? `${(r.bytes / 1024).toFixed(1)} KB` : "ok";
      setMsg({ ok: true, texto: `✓ Dados enviados pra nuvem (${kb}). Em outro dispositivo, cole o mesmo token → "Baixar da nuvem".` });
    } catch (e) {
      setMsg({ ok: false, texto: `Erro ao enviar: ${e?.message || e}` });
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    if (!salvo) { setMsg({ ok: false, texto: "Salve um token primeiro." }); return; }
    setBusy("download"); setMsg(null);
    try {
      const remoto = await gistFetchState();
      if (!remoto) {
        setMsg({ ok: false, texto: "Nada na nuvem ainda. Faça upload primeiro de outro dispositivo." });
        return;
      }
      const ok = await confirm({
        title: "Substituir dados locais?",
        body: "Os dados da nuvem vão SUBSTITUIR tudo neste navegador. Faça backup JSON antes se quiser garantir.",
        danger: true,
        confirmLabel: "Substituir",
      });
      if (!ok) { setBusy(null); return; }
      await saveAll(remoto, { immediate: true });
      setMsg({ ok: true, texto: "✓ Dados baixados. Recarregue a página." });
    } catch (e) {
      setMsg({ ok: false, texto: `Erro ao baixar: ${e?.message || e}` });
    } finally {
      setBusy(null);
    }
  };

  const dirty = token.trim() !== (salvo || "").trim();
  const conectado = !!salvo && !!user;

  return (
    <>
      <div className="st"><h2>Sincronização entre dispositivos</h2><div className="mt">GitHub Gist</div></div>

      <div className="fb">
        <h4>1. Conectar com GitHub</h4>
        <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 12 }}>
          Use um <strong>Personal Access Token</strong> do GitHub com escopo <code style={{ background: T.bgSoft, padding: "1px 6px", borderRadius: 3 }}>gist</code>.
          Veja o passo a passo de como gerar logo abaixo.
        </p>

        <div style={{ display: "flex", gap: 6, alignItems: "stretch", flexWrap: "wrap" }}>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            style={{ flex: "1 1 280px", minWidth: 220, fontFamily: T.mono, fontSize: 13 }}
            autoCorrect="off" autoCapitalize="off" spellCheck={false}
          />
          {token && (
            <button onClick={copiar} className="btn-ghost" style={{ whiteSpace: "nowrap" }}>
              Copiar
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {dirty && (
            <button onClick={salvar} className="btn-gold" disabled={busy === "test"}>
              {busy === "test" ? "Validando..." : "Salvar e conectar"}
            </button>
          )}
          {salvo && (
            <button onClick={remover} className="btn-ghost">
              Remover token
            </button>
          )}
        </div>

        {conectado && !dirty && (
          <div style={{
            marginTop: 12, padding: "10px 14px", borderRadius: 6, fontSize: 12.5,
            background: `${T.green}15`, color: T.green, border: `1px solid ${T.green}55`,
          }}>
            ● Conectado como <strong>@{user.login}</strong>{user.name ? ` (${user.name})` : ""}.
          </div>
        )}

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
      </div>

      <div className="fb">
        <h4>2. Enviar e baixar</h4>
        <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 12 }}>
          <strong>Dispositivo principal</strong>: clica "Enviar pra nuvem" quando quiser sincronizar.<br />
          <strong>Outros dispositivos</strong>: cola o mesmo token → "Baixar da nuvem" → recarrega.
        </p>

        <div className="cfg-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button onClick={upload}
            className="btn-gold"
            disabled={!conectado || busy === "upload"}
            style={{
              opacity: !conectado ? 0.5 : 1,
              cursor: !conectado ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            {busy === "upload" ? "Enviando..." : "☁️ ↑ Enviar pra nuvem"}
          </button>
          <button onClick={download}
            disabled={!conectado || busy === "download"}
            style={{
              background: T.bgSoft, color: T.ink, border: `1px solid ${T.border}`,
              padding: "10px 20px", fontSize: 12, fontWeight: 600, letterSpacing: "0.1em",
              textTransform: "uppercase", cursor: !conectado ? "not-allowed" : "pointer",
              opacity: !conectado ? 0.5 : 1,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}>
            {busy === "download" ? "Baixando..." : "☁️ ↓ Baixar da nuvem"}
          </button>
        </div>
      </div>

      <div className="fb" style={{ borderColor: T.gold }}>
        <h4>📋 Como gerar o token no GitHub (uma vez)</h4>
        <ol style={{ paddingLeft: 18, fontSize: 12.5, color: T.muted, lineHeight: 1.7 }}>
          <li>
            Abra{" "}
            <a href="https://github.com/settings/tokens/new?description=AF4%20Cockpit&scopes=gist" target="_blank" rel="noopener noreferrer" style={{ color: T.gold }}>
              github.com/settings/tokens/new
            </a>{" "}
            (já vem com o escopo certo marcado)
          </li>
          <li><strong>Note</strong> (descrição): <em>NUMVI</em> (ou o que quiser)</li>
          <li><strong>Expiration</strong>: escolha "No expiration" pra nunca expirar, ou "1 year" pra renovar anualmente</li>
          <li><strong>Select scopes</strong>: marque apenas <code style={{ background: T.bgSoft, padding: "1px 5px", borderRadius: 3 }}>gist</code> (importante — só esse, mais nada)</li>
          <li>Botão verde "Generate token" no fim</li>
          <li>O token aparece <strong>uma única vez</strong> — começa com <code style={{ background: T.bgSoft, padding: "1px 5px", borderRadius: 3 }}>ghp_</code>. Copie e cole no campo acima.</li>
        </ol>
      </div>

      <div className="ar" style={{ marginTop: 16 }}>
        <div className="ai">🔐</div>
        <div className="at">
          <strong>Segurança</strong>
          <p>
            O token só acessa Gists (não acessa seus repositórios). Quem tiver o token vê seus
            dados financeiros — trate como senha. Pode revogar a qualquer momento em{" "}
            <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" style={{ color: T.gold }}>
              github.com/settings/tokens
            </a>.
          </p>
        </div>
      </div>
    </>
  );
}

/* ============ MIGRAÇÃO PRA NOVAS TABELAS SUPABASE ============ */
function MigracaoSupabase() {
  const [statusTabelas, setStatusTabelas] = useState("checking"); // checking|existem|nao_existem|erro
  const [contagens, setContagens] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [progresso, setProgresso] = useState(null); // {tabela, atual, total, msg}
  const [rodando, setRodando] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const existem = await tabelasNovasExistem();
        if (!ativo) return;
        setStatusTabelas(existem ? "existem" : "nao_existem");
        if (existem) {
          const c = await snapshotContagens();
          if (ativo) setContagens(c);
        }
      } catch (e) {
        if (ativo) setStatusTabelas("erro");
      }
    })();
    return () => { ativo = false; };
  }, []);

  const rodar = async (dryRun) => {
    if (!dryRun) {
      const ok = await confirm({
        title: "Migrar dados pra novas tabelas?",
        message: "Vai escrever direto no Supabase. Idempotente (rodar 2x não duplica), mas confirme que o SQL 001_initial_schema já foi aplicado.",
        confirmLabel: "Migrar agora",
      });
      if (!ok) return;
    }
    setRodando(true);
    setResultado(null);
    setProgresso(null);
    try {
      const dados = await loadAll();
      if (!dados) throw new Error("Sem dados em localStorage.");
      const r = await migrarTudo(dados, {
        dryRun,
        onProgress: (p) => setProgresso(p),
      });
      setResultado(r);
      if (!dryRun && r.ok) {
        // Atualiza contagens depois de migração real
        const c = await snapshotContagens();
        setContagens(c);
        toast.success("Migração concluída!");
      } else if (dryRun) {
        toast.info("Dry-run OK — nenhuma escrita feita.");
      } else {
        toast.error(`Migração com ${r.erros.length} erro(s). Veja detalhes.`);
      }
    } catch (e) {
      toast.error(e.message || "Erro na migração");
    } finally {
      setRodando(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="eb">Migração de dados pras tabelas relacionais</div>
      <p className="hs" style={{ marginBottom: 14 }}>
        Move seus dados do snapshot JSON (<code style={{ background: T.bgSoft, padding: "1px 5px", borderRadius: 3 }}>aurum_state</code>) pras tabelas normalizadas novas
        (definidas em <code style={{ background: T.bgSoft, padding: "1px 5px", borderRadius: 3 }}>supabase/migrations/</code>).
        Estratégia: espelhamento gradual — app continua salvando em localStorage até cutover final.
      </p>

      {/* Status das tabelas */}
      <div style={{
        padding: 12, marginBottom: 12, borderRadius: 8,
        background: statusTabelas === "existem" ? `${T.green}11`
                  : statusTabelas === "nao_existem" ? `${T.gold}11`
                  : `${T.muted}22`,
        border: `1px solid ${
          statusTabelas === "existem" ? T.green
          : statusTabelas === "nao_existem" ? T.gold
          : T.border
        }55`,
      }}>
        {statusTabelas === "checking" && <span style={{ color: T.muted, fontSize: 12 }}>Checando status das tabelas…</span>}
        {statusTabelas === "existem" && (
          <span style={{ color: T.green, fontSize: 13 }}>
            ✓ Tabelas novas existem no Supabase
          </span>
        )}
        {statusTabelas === "nao_existem" && (
          <div style={{ fontSize: 13, color: T.ink }}>
            ⚠ Tabelas novas <strong>não existem</strong> no Supabase ainda.
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4 }}>
              Aplique <code>docs/sql/001_initial_schema.sql</code> no Supabase SQL Editor primeiro.
            </div>
          </div>
        )}
        {statusTabelas === "erro" && (
          <span style={{ color: T.red, fontSize: 12 }}>Erro ao consultar Supabase.</span>
        )}
      </div>

      {/* Contagens atuais */}
      {contagens && (
        <div style={{ marginBottom: 12, padding: 10, background: T.bgSoft, borderRadius: 6 }}>
          <div className="eb" style={{ fontSize: 10, marginBottom: 6 }}>Linhas hoje nas tabelas</div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 6, fontSize: 11.5,
          }}>
            {Object.entries(contagens).map(([t, n]) => (
              <div key={t} style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: T.muted }}>{t}</span>
                <strong style={{ color: n > 0 ? T.green : T.faint }} className="num">{n}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cobertura V2 */}
      <div style={{
        padding: 10, marginBottom: 12,
        background: T.bgSoft, border: `1px dashed ${T.border}`, borderRadius: 6,
        fontSize: 11.5, color: T.muted,
      }}>
        <strong style={{ color: T.ink }}>V2 cobre 13 entidades:</strong> contas, categorias (self-ref),
        cartoes, ativos, metas, agenda, tarefas, compras, ideias, fixas, parcelamentos,
        compromissos (consolida devedores+dividas), transacoes (com FKs contas+categorias).
        <br />
        <strong style={{ color: T.ink }}>Próximo V3:</strong> fixa_ocorrencias, objetivos_carteira,
        carteiras_modelo, proventos, trade_*, habitos+check_ins, diario, perfis, user_preferences, api_keys.
        Transações ainda não vinculam ativo/cartao/parcelamento/fixa (V3).
      </div>

      {/* Botões */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button className="btn-ghost"
                onClick={() => rodar(true)}
                disabled={rodando || statusTabelas !== "existem"}
                style={{ opacity: (rodando || statusTabelas !== "existem") ? 0.5 : 1 }}>
          {rodando ? "Rodando…" : "Dry-run (simular)"}
        </button>
        <button className="btn-gold"
                onClick={() => rodar(false)}
                disabled={rodando || statusTabelas !== "existem"}
                style={{ opacity: (rodando || statusTabelas !== "existem") ? 0.5 : 1 }}>
          {rodando ? "Rodando…" : "Migrar agora"}
        </button>
      </div>

      {/* Progresso */}
      {progresso && rodando && (
        <div style={{
          padding: 10, marginBottom: 12,
          background: `${T.gold}11`, border: `1px solid ${T.gold}44`,
          borderRadius: 6, fontSize: 12,
        }}>
          <strong style={{ color: T.gold }}>{progresso.tabela}</strong>
          {progresso.total > 0 && (
            <span style={{ color: T.muted, marginLeft: 8 }}>
              {progresso.atual} / {progresso.total}
            </span>
          )}
          {progresso.msg && (
            <div style={{ fontSize: 11, color: T.muted, marginTop: 4, fontStyle: "italic" }}>
              {progresso.msg}
            </div>
          )}
        </div>
      )}

      {/* Resultado */}
      {resultado && (
        <div style={{
          padding: 12, marginBottom: 4,
          background: T.card, border: `1px solid ${resultado.ok ? T.green : T.gold}55`,
          borderLeft: `3px solid ${resultado.ok ? T.green : T.gold}`,
          borderRadius: 8,
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700,
            color: resultado.ok ? T.green : T.gold,
            marginBottom: 8, letterSpacing: ".05em", textTransform: "uppercase",
          }}>
            {resultado.dryRun ? "Dry-run: " : ""}{resultado.ok ? "Sucesso" : `${resultado.erros.length} erro(s)`}
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 6, fontSize: 11.5,
          }}>
            {Object.entries(resultado.resultados).map(([tabela, r]) => (
              <div key={tabela} style={{
                padding: 8, background: T.bgSoft, borderRadius: 4,
                borderLeft: `2px solid ${r.erro > 0 ? T.red : T.green}`,
              }}>
                <div style={{ color: T.ink, fontWeight: 600 }}>{tabela}</div>
                <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
                  ok: <strong style={{ color: T.green }}>{r.ok}</strong> · erro: <strong style={{ color: r.erro > 0 ? T.red : T.muted }}>{r.erro || 0}</strong>
                  {r.pulados > 0 && <> · pulados: {r.pulados}</>}
                </div>
              </div>
            ))}
          </div>
          {resultado.erros.length > 0 && (
            <details style={{ marginTop: 10, fontSize: 11 }}>
              <summary style={{ cursor: "pointer", color: T.red, fontWeight: 600 }}>
                Ver {resultado.erros.length} erro(s)
              </summary>
              <div style={{
                maxHeight: 200, overflowY: "auto", marginTop: 6,
                padding: 8, background: T.bg, borderRadius: 4,
              }}>
                {resultado.erros.map((e, i) => (
                  <div key={i} style={{ marginBottom: 4, color: T.muted }}>
                    <strong style={{ color: T.red }}>{e.tabela}</strong> · {e.item} → {e.erro}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

