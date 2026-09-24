import React, { useState, useEffect, useRef } from "react";
import { T } from "../../lib/theme.js";
import { fmt, uid } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import Modal from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";
import CategoriaSelect from "../ui/CategoriaSelect.jsx";
import { categoriaAuto } from "../../lib/autoCategorizar.js";
import {
  getPluggyPin, getPluggyUsuario, setPluggyUsuario, conectarMeuPluggy, statusItem, contasPluggy,
  transacoesPluggy, prepararImportPluggy, STATUS_RECONECTAR,
} from "../../lib/pluggy.js";

/**
 * 🏦 SINCRONIZAR BANCO (Pluggy · Open Finance) — MVP contas + extratos.
 * Passos: conectar (1ª vez) → escolher/vincular conta → prévia com dedup →
 * confirmar (grava transações origem=pluggy, ajusta saldoInicial, ultimaSync).
 * Fonte OPCIONAL: tudo continua funcionando sem isso.
 */
// O item do conector Meu Pluggy nasce e cai em WAITING_USER_INPUT até o
// usuário aprovar o acesso do aplicativo dentro do meu.pluggy.ai.
const ehAguardandoAutorizacao = (st) =>
  st && (st.status === "WAITING_USER_INPUT" || st.status === "USER_INPUT_TIMEOUT");

export default function SincronizarBancoModal({
  contas = [], setContas, categorias = [], transacoes = [], setTransacoes,
  pluggy = {}, setPluggy, onClose,
}) {
  const [passo, setPasso] = useState(pluggy.itemId ? "contas" : "conectar");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [reconectar, setReconectar] = useState(false);
  // Na 1ª conexão o item fica "UPDATING" por ~1-2 min e /accounts vem vazio.
  const [sincronizando, setSincronizando] = useState(false);
  const [statusInfo, setStatusInfo] = useState(null); // {status, executionStatus} p/ diagnóstico

  // conectar
  const [usuario, setUsuario] = useState(getPluggyUsuario());
  const [senha, setSenha] = useState("");
  const [itemManual, setItemManual] = useState(""); // ID de item criado no widget do dashboard
  // contas
  const [listaBanco, setListaBanco] = useState(null); // contas vindas da Pluggy
  const [vinculos, setVinculos] = useState(pluggy.vinculos || {});
  // prévia
  const [previa, setPrevia] = useState(null); // {contaPluggy, contaNome, novas, jaImportadas}

  const semPin = !getPluggyPin();

  // Cada banco autorizado no widget da Pluggy vira um ITEM próprio (Itaú e
  // XP = dois IDs). Unimos itens novos (pluggy.itens) com o itemId legado.
  const idsConexoes = (p = pluggy) => {
    const ids = [...(p.itens || [])];
    if (p.itemId && !ids.includes(p.itemId)) ids.push(p.itemId);
    return ids;
  };

  // `forcar` pede à Pluggy uma re-sincronização (PATCH) — nunca durante um
  // UPDATING em andamento: o PATCH reiniciaria a sync a cada clique.
  // Carrega e SOMA as contas de todas as conexões.
  const carregarContas = async (ids = idsConexoes(), forcar = false) => {
    if (!ids.length) return;
    setCarregando(true); setErro("");
    let contasTodas = [], pior = null, algumUpdating = false, erros = [];
    for (const id of ids) {
      try {
        let st = await statusItem(id);
        if (forcar && st.status !== "UPDATING") st = await statusItem(id, true);
        // WAITING_USER_INPUT no conector Meu Pluggy = falta AUTORIZAR o app
        // dentro do meu.pluggy.ai (não é consentimento de banco expirado).
        if (!pior || STATUS_RECONECTAR.has(st.status)) pior = st;
        if (st.status === "UPDATING") algumUpdating = true;
        const r = await contasPluggy(id);
        contasTodas = contasTodas.concat(r.contas || []);
      } catch (e) { erros.push(e.message); }
    }
    setStatusInfo(pior);
    setReconectar(Boolean(pior && STATUS_RECONECTAR.has(pior.status) && !ehAguardandoAutorizacao(pior)));
    setSincronizando(algumUpdating);
    if (erros.length === ids.length && erros.length) setErro(erros[0]);
    setListaBanco(contasTodas.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i));
    setPasso("contas");
    setCarregando(false);
  };

  useEffect(() => {
    if (idsConexoes().length && !semPin) carregarContas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-poll: enquanto a Pluggy sincroniza e a lista está vazia, re-consulta
  // sozinho a cada 6s (sem forçar PATCH), até ~2 min — o usuário só espera.
  const pollsRef = useRef(0);
  useEffect(() => {
    if (!(sincronizando && passo === "contas" && (listaBanco || []).length === 0 && idsConexoes().length)) {
      pollsRef.current = 0;
      return;
    }
    if (pollsRef.current >= 20) return;
    const t = setTimeout(() => { pollsRef.current += 1; carregarContas(); }, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sincronizando, passo, listaBanco, carregando]);

  const conectar = async () => {
    if (!usuario.trim() || !senha) { setErro("Informe usuário e senha do Meu Pluggy."); return; }
    setCarregando(true); setErro("");
    try {
      const r = await conectarMeuPluggy(usuario.trim(), senha);
      setPluggyUsuario(usuario);
      setSenha("");
      setPluggy(prev => ({ ...(prev || {}), itemId: r.itemId }));
      toast.success("🏦 Conectado ao Meu Pluggy!");
      await carregarContas(idsConexoes({ ...pluggy, itemId: r.itemId }));
    } catch (e) { setErro(e.message); setCarregando(false); }
  };

  // Caminho oficial do guia do Meu Pluggy: conectar o item pelo widget de
  // demonstração do dashboard.pluggy.ai e colar aqui o ID do item criado lá
  // (o item do widget nasce autorizado; o criado via API fica preso em
  // WAITING_USER_INPUT porque o conector é OAuth).
  const usarItemExistente = async () => {
    const id = itemManual.trim();
    if (!id) { setErro("Cola o ID do item (código da conexão criada no painel da Pluggy)."); return; }
    setCarregando(true); setErro("");
    try {
      await statusItem(id); // valida que o item existe e pertence à aplicação
      const itens = [...new Set([...(pluggy.itens || []), id])];
      setPluggy(prev => ({ ...(prev || {}), itens: [...new Set([...(prev?.itens || []), id])] }));
      setItemManual("");
      toast.success("🏦 Conexão adicionada!");
      await carregarContas(idsConexoes({ ...pluggy, itens }));
    } catch (e) { setErro(e.message); setCarregando(false); }
  };

  const abrirPrevia = async (contaPluggy) => {
    const contaNome = vinculos[contaPluggy.id];
    if (!contaNome) { toast.error("Vincula essa conta do banco a uma conta do app primeiro."); return; }
    setCarregando(true); setErro("");
    try {
      const from = pluggy.ultimaSync?.[contaPluggy.id]
        || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const r = await transacoesPluggy(contaPluggy.id, from);
      const prep = prepararImportPluggy(r.transacoes, transacoes, contaNome);
      // pré-seleção: tudo que não é duplicado
      prep.novas.forEach(t => { t._marcada = !t._duplicada; });
      setPrevia({ contaPluggy, contaNome, ...prep, truncado: r.truncado });
      setPasso("previa");
    } catch (e) { setErro(e.message); }
    finally { setCarregando(false); }
  };

  const confirmar = () => {
    const aceitas = previa.novas.filter(t => t._marcada).map(t => {
      const { _marcada, _duplicada, ...tx } = t;
      if (!tx.categoria || tx.categoria === "Outros") {
        tx.categoria = categoriaAuto({ descricao: tx.descricao, tipo: tx.tipo }, categorias, transacoes) || tx.categoria || "";
      }
      return tx;
    });
    if (aceitas.length) setTransacoes(prev => [...aceitas, ...prev]);

    // Saldo do BANCO vira o saldo real da conta: deriva saldoInicial =
    // saldoBanco − soma das compensadas (regra do save() de Contas — mexer só
    // em `saldo` seria desfeito pelo auto-reconcile de lib/saldoConta.js).
    // Só pra contas em BRL (moeda estrangeira mantém o fluxo atual de câmbio).
    const contaApp = contas.find(c => c.nome === previa.contaNome);
    if (contaApp && setContas && (contaApp.moeda || "BRL") === "BRL") {
      const todas = [...aceitas, ...transacoes];
      const soma = todas
        .filter(t => t.conta === contaApp.nome && t.compensado)
        .reduce((s, t) => s + ((Number(t.valor) || 0) * (t.tipo === "receita" ? 1 : -1)), 0);
      const saldoBanco = Number(previa.contaPluggy.saldo) || 0;
      setContas(prev => prev.map(c =>
        c.id === contaApp.id ? { ...c, saldo: saldoBanco, saldoInicial: saldoBanco - soma } : c
      ));
    }

    setPluggy(prev => ({
      ...(prev || {}),
      vinculos: { ...(prev?.vinculos || {}), ...vinculos },
      ultimaSync: { ...(prev?.ultimaSync || {}), [previa.contaPluggy.id]: new Date().toISOString().slice(0, 10) },
    }));
    toast.success(`🏦 ${aceitas.length} transação(ões) importadas${previa.jaImportadas ? ` · ${previa.jaImportadas} já existiam (puladas)` : ""}.`);
    setPasso("contas");
    setPrevia(null);
  };

  const selSty = { fontSize: 12, padding: "6px 8px", border: `1px solid ${T.border}`, borderRadius: 10, background: T.bg, color: T.ink };

  return (
    <Modal title="🏦 Sincronizar banco (Open Finance)" onClose={onClose} wide>
      {semPin && (
        <div style={{ background: `${T.gold}12`, border: `1px solid ${T.gold}66`, borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: T.ink }}>
          Antes de usar: configura o <strong>PIN da conexão bancária</strong> em Configurações → APIs (e os secrets no servidor — ver docs/pluggy.md).
        </div>
      )}
      {erro && (
        <div style={{ background: `${T.red}12`, border: `1px solid ${T.red}55`, borderRadius: 12, padding: "9px 13px", marginBottom: 12, fontSize: 12.5, color: T.red }}>
          {erro}
        </div>
      )}
      {reconectar && (
        <div style={{ background: `${T.red}10`, border: `1px solid ${T.red}44`, borderRadius: 12, padding: "9px 13px", marginBottom: 12, fontSize: 12.5, color: T.ink }}>
          ⚠️ O consentimento do Open Finance expirou ou precisa de atenção — abre o app <strong>Meu Pluggy</strong> e reconecta o banco; depois volta aqui.
          <button className="btn-ghost" style={{ marginLeft: 10, fontSize: 11, padding: "3px 10px" }}
                  onClick={() => carregarContas()}>↻ Tentar de novo</button>
        </div>
      )}

      {/* PASSO: conectar */}
      {passo === "conectar" && (
        <>
          <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 8 }}>
            <strong style={{ color: T.ink }}>Caminho recomendado</strong> (guia do Meu Pluggy):
            em <strong>dashboard.pluggy.ai</strong> → "Conecte um item demo" → autoriza o banco →
            copia o <strong>ID do item</strong> (código COMPLETO, formato{" "}
            <span className="num">xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</span> — aparece em
            Dados Financeiros → Execuções, clicando na conexão). Cada banco tem o seu; cola um por
            vez — a conexão <strong>fica salva</strong>, não precisa repetir:
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <input value={itemManual} onChange={e => setItemManual(e.target.value)}
                   placeholder="ex.: 3a7b12f0-…" className="num"
                   style={{ flex: 1, minWidth: 200 }} autoComplete="off" />
            <button className="btn-gold" onClick={usarItemExistente} disabled={carregando || semPin}>
              {carregando ? "Validando…" : "Usar esse item"}
            </button>
          </div>

          <div style={{ borderTop: `1px solid ${T.border}`, marginTop: 16, paddingTop: 12 }}>
            <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 10 }}>
              Ou conexão direta com usuário/senha do <strong>Meu Pluggy</strong> (somente leitura;
              a <strong>senha nunca fica salva</strong> — só transita criptografada; o e-mail fica
              lembrado neste aparelho):
            </p>
            <Field label="Usuário/e-mail do Meu Pluggy">
              <input value={usuario} onChange={e => setUsuario(e.target.value)} autoComplete="off" placeholder="voce@email.com" />
            </Field>
            <Field label="Senha do Meu Pluggy">
              <input type="password" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" />
            </Field>
            <div className="flex gap-3 justify-end mt-4">
              <button className="btn-ghost" onClick={onClose}>Cancelar</button>
              <button className="btn-ghost" onClick={conectar} disabled={carregando || semPin}>
                {carregando ? "Conectando…" : "Conectar"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* PASSO: contas do banco */}
      {passo === "contas" && (
        <>
          {carregando && <p style={{ fontSize: 12.5, color: T.muted }}>Buscando contas no banco…</p>}
          {!carregando && ehAguardandoAutorizacao(statusInfo) && (
            <div style={{ background: `${T.gold}12`, border: `1px solid ${T.gold}66`, borderRadius: 12, padding: "10px 14px", marginBottom: 10, fontSize: 12.5, color: T.ink }}>
              🔐 Essa conexão está <strong>aguardando autorização</strong> e não vai concluir por aqui.
              Caminho certo (guia do Meu Pluggy): em <strong>dashboard.pluggy.ai</strong> usa o
              <strong> "Conecte um item demo"</strong> escolhendo o conector <strong>Meu Pluggy</strong>,
              copia o <strong>ID do item</strong> criado, e cola em "Reconectar Meu Pluggy" → campo
              "Conectou pelo painel da Pluggy?".
            </div>
          )}
          {!carregando && listaBanco && listaBanco.length === 0 && (
            <p style={{ fontSize: 12.5, color: T.muted }}>
              {sincronizando
                ? <>⏳ O Meu Pluggy está <strong>sincronizando com os bancos</strong> — a primeira vez pode levar alguns minutos. Pode deixar essa tela aberta: eu <strong>atualizo sozinho</strong> a cada poucos segundos.</>
                : ehAguardandoAutorizacao(statusInfo)
                  ? <>Assim que você autorizar lá, as contas aparecem aqui.</>
                  : <>Nenhuma conta bancária encontrada — confere no app <strong>Meu Pluggy</strong> (meu.pluggy.ai) se os bancos estão conectados (a autorização Open Finance precisa ser concluída dentro do app de cada banco).</>}
            </p>
          )}
          {!carregando && statusInfo && listaBanco && listaBanco.length === 0 && (
            <p className="num" style={{ fontSize: 10.5, color: T.muted, opacity: 0.75 }}>
              diagnóstico: status {statusInfo.status || "?"}{statusInfo.executionStatus ? ` · execução ${statusInfo.executionStatus}` : ""}
            </p>
          )}
          {!carregando && (listaBanco || []).map(cb => (
            <div key={cb.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 14, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{cb.banco || cb.nome}</div>
                <div className="num" style={{ fontSize: 11.5, color: T.muted }}>
                  {cb.nome}{cb.numero ? ` · ${cb.numero}` : ""} · saldo {fmt(cb.saldo)}
                </div>
              </div>
              <select value={vinculos[cb.id] || ""} onChange={e => setVinculos(v => ({ ...v, [cb.id]: e.target.value }))} style={selSty}>
                <option value="">Vincular à conta…</option>
                {contas.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
              <button className="btn-gold" style={{ fontSize: 11.5, padding: "6px 14px" }}
                      disabled={!vinculos[cb.id] || carregando}
                      onClick={() => abrirPrevia(cb)}>
                ⬇ Puxar extrato
              </button>
            </div>
          ))}
          <div className="flex gap-3 justify-end mt-4">
            <button className="btn-gold" disabled={carregando}
                    onClick={() => carregarContas(idsConexoes(), true)}>↻ Atualizar</button>
            <button className="btn-ghost" onClick={() => { setPasso("conectar"); setListaBanco(null); }}>＋ Adicionar conexão</button>
            <button className="btn-ghost" onClick={onClose}>Fechar</button>
          </div>
        </>
      )}

      {/* PASSO: prévia */}
      {passo === "previa" && previa && (
        <>
          <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 10 }}>
            <strong style={{ color: T.ink }}>{previa.novas.length}</strong> transação(ões) novas de{" "}
            <strong style={{ color: T.ink }}>{previa.contaPluggy.banco || previa.contaPluggy.nome}</strong> →{" "}
            conta <strong style={{ color: T.gold }}>{previa.contaNome}</strong>
            {previa.jaImportadas > 0 && <> · {previa.jaImportadas} já importadas antes (puladas automaticamente)</>}
            {previa.truncado && <> · ⚠️ lote grande, o resto vem na próxima sync</>}
            . Possíveis duplicadas de lançamentos manuais vêm <strong>desmarcadas</strong>.
          </p>
          <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
            {previa.novas.map((t, i) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: T.bgSoft, borderRadius: 10, opacity: t._marcada ? 1 : 0.55 }}>
                <input type="checkbox" checked={t._marcada}
                       onChange={e => setPrevia(p => ({ ...p, novas: p.novas.map((x, j) => j === i ? { ...x, _marcada: e.target.checked } : x) }))}
                       style={{ width: 15, height: 15, accentColor: T.gold, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.descricao} {t._duplicada && <span style={{ fontSize: 10, color: T.red }}>· possível duplicada</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.faint }}>{t.data}</div>
                </div>
                <CategoriaSelect compacto categorias={categorias} tipo={t.tipo}
                  value={t.categoria}
                  onChange={(nome) => setPrevia(p => ({ ...p, novas: p.novas.map((x, j) => j === i ? { ...x, categoria: nome } : x) }))}
                  placeholder="auto" />
                <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: t.tipo === "receita" ? T.green : T.red, flexShrink: 0 }}>
                  {t.tipo === "receita" ? "+" : "−"} {fmt(t.valor)}
                </span>
              </div>
            ))}
            {previa.novas.length === 0 && (
              <p style={{ fontSize: 12.5, color: T.muted, textAlign: "center", padding: 16 }}>
                Tudo em dia — nenhuma transação nova desde a última sincronização. ✅
              </p>
            )}
          </div>
          <div className="flex gap-3 justify-end mt-5">
            <button className="btn-ghost" onClick={() => { setPasso("contas"); setPrevia(null); }}>Voltar</button>
            <button className="btn-gold" onClick={confirmar} disabled={carregando}>
              Importar {previa.novas.filter(t => t._marcada).length} marcada(s)
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
