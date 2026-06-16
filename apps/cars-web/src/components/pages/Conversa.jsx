import React, { useState, useRef, useEffect } from "react";
import { Send, MessageCircle, Loader } from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid, todayISO, fmt } from "../../lib/format.js";
import { parsear } from "../../lib/conversaParser.js";
import PageHeader from "../ui/PageHeader.jsx";

const CATEGORIAS_DEFAULT = ["Alimentação", "Transporte", "Saúde", "Lazer", "Outro"];

function detectarCategoria(descricao) {
  const d = descricao.toLowerCase();
  if (/almoço|jantar|café|mercado|ifood|lanche|restaurante/.test(d)) return "Alimentação";
  if (/uber|99|ônibus|táxi|gasolina|combustível/.test(d)) return "Transporte";
  if (/farmácia|médico|consulta|remédio/.test(d)) return "Saúde";
  if (/cinema|netflix|show|bar|balada/.test(d)) return "Lazer";
  return "Outro";
}

function RelatorioCard({ transacoes, tarefas, lembretes, treinos }) {
  const hoje = todayISO();
  const inicioSemana = new Date(); inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
  const isoSemana = inicioSemana.toISOString().slice(0, 10);

  const gastosSemana = (transacoes || [])
    .filter(t => t.tipo === "saida" && t.data >= isoSemana)
    .reduce((s, t) => s + (Number(t.valor) || 0), 0);

  const tarefasPendentes = (tarefas || []).filter(t => !t.concluida).length;
  const proximosLembretes = (lembretes || []).filter(l => !l.concluido && l.data >= hoje).slice(0, 3);
  const ultimoTreino = (treinos || []).sort((a, b) => b.data.localeCompare(a.data))[0];

  return (
    <div style={{ background: `${T.gold}10`, border: `1px solid ${T.gold}40`, borderRadius: 16, padding: 14, maxWidth: 320 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.gold, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>
        Resumo
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, fontSize: 12, color: T.ink }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: T.muted }}>Gastos esta semana</span>
          <span className="num" style={{ fontWeight: 700, color: T.red }}>{fmt(gastosSemana)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: T.muted }}>Tarefas pendentes</span>
          <span style={{ fontWeight: 700 }}>{tarefasPendentes}</span>
        </div>
        {proximosLembretes.length > 0 && (
          <div>
            <div style={{ color: T.muted, marginBottom: 3 }}>Próximos lembretes</div>
            {proximosLembretes.map(l => (
              <div key={l.id} style={{ fontSize: 11, color: T.ink, paddingLeft: 8 }}>
                · {l.titulo} — {l.data === hoje ? "hoje" : l.data} {l.horario}
              </div>
            ))}
          </div>
        )}
        {ultimoTreino && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: T.muted }}>Último treino</span>
            <span style={{ fontWeight: 600 }}>{ultimoTreino.modalidade} · {ultimoTreino.data}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Conversa({
  conversaHistorico = [], setConversaHistorico,
  transacoes = [], setTransacoes,
  categorias = [],
  agenda = [], setAgenda,
  tarefas = [], setTarefas,
  lembretes = [], setLembretes,
  treinos = [],
  apiKeys = {},
  hidden,
}) {
  const [input, setInput] = useState("");
  const [carregando, setCarregando] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversaHistorico]);

  const adicionarMsg = (msgs) => {
    setConversaHistorico(prev => [...prev, ...msgs].slice(-200));
  };

  const executarAcao = (parsed) => {
    const { action, params } = parsed;

    if (action === "gasto") {
      const cat = detectarCategoria(params.descricao);
      const catId = (categorias.find(c => c.nome === cat) || categorias[0])?.id || "outro";
      const nova = {
        id: uid(), tipo: "saida", valor: params.valor,
        descricao: params.descricao, categoriaId: catId,
        data: todayISO(), createdAt: new Date().toISOString(),
      };
      setTransacoes(prev => [...prev, nova]);
      return {
        texto: `✅ Despesa registrada`,
        detalhes: `${fmt(params.valor)} · ${params.descricao} · ${cat}`,
        cor: T.green,
      };
    }

    if (action === "evento") {
      const novo = {
        id: uid(), titulo: params.titulo, data: params.data,
        horario: params.horario, categoria: "compromisso",
        status: "agendado", createdAt: new Date().toISOString(),
      };
      setAgenda(prev => [...prev, novo]);
      return {
        texto: `📅 Evento criado`,
        detalhes: `${params.titulo} · ${params.data} ${params.horario}`,
        cor: "#60a5fa",
      };
    }

    if (action === "tarefa") {
      const nova = {
        id: uid(), titulo: params.titulo, prioridade: "media",
        concluida: false, createdAt: new Date().toISOString(),
      };
      setTarefas(prev => [...prev, nova]);
      return {
        texto: `✓ Tarefa criada`,
        detalhes: params.titulo,
        cor: T.green,
      };
    }

    if (action === "lembrete") {
      const novo = {
        id: uid(), titulo: params.titulo, data: params.data,
        horario: params.horario, recorrencia: null,
        concluido: false, createdAt: new Date().toISOString(),
      };
      setLembretes(prev => [...prev, novo]);
      return {
        texto: `🔔 Lembrete criado`,
        detalhes: `${params.titulo} · ${params.data} ${params.horario}`,
        cor: T.gold,
      };
    }

    if (action === "relatorio") {
      return { texto: null, relatorio: true };
    }

    return {
      texto: `Não entendi "${params?.texto || ""}". Tente: "gasto 50 almoço", "reunião amanhã 14h", "tarefa ligar pro banco"`,
      cor: T.muted,
    };
  };

  const enviar = async () => {
    const texto = input.trim();
    if (!texto) return;
    setInput("");

    const msgUser = { id: uid(), de: "user", texto, ts: new Date().toISOString() };
    adicionarMsg([msgUser]);
    setCarregando(true);

    try {
      const parsed = await parsear(texto, apiKeys);
      const resultado = executarAcao(parsed);
      const msgApp = { id: uid(), de: "app", ts: new Date().toISOString(), ...resultado };
      adicionarMsg([msgApp]);
    } catch (e) {
      adicionarMsg([{ id: uid(), de: "app", texto: "Erro ao processar. Tente novamente.", cor: T.red, ts: new Date().toISOString() }]);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="fade-up py-8" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 160px)", maxHeight: 700 }}>
      <PageHeader eyebrow="Agenda" title="Conversa" sub="Digite em linguagem natural para registrar gastos, eventos, tarefas e lembretes." />

      {/* Histórico */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, padding: "8px 0", marginBottom: 8 }}>
        {conversaHistorico.length === 0 && (
          <div style={{ textAlign: "center", color: T.muted, fontSize: 12, padding: "40px 0" }}>
            <MessageCircle size={32} style={{ color: T.border, margin: "0 auto 10px", display: "block" }} />
            Comece digitando um comando.<br />
            Ex.: <em>"gasto 50 almoço"</em>, <em>"reunião amanhã 14h"</em>
          </div>
        )}
        {conversaHistorico.map(msg => (
          <div key={msg.id} style={{ display: "flex", justifyContent: msg.de === "user" ? "flex-end" : "flex-start" }}>
            {msg.de === "user" ? (
              <div style={{
                background: T.gold, color: T.bg,
                padding: "8px 14px", borderRadius: "16px 16px 4px 16px",
                fontSize: 13, maxWidth: "75%", fontWeight: 500,
              }}>
                {msg.texto}
              </div>
            ) : (
              <div style={{ maxWidth: "80%" }}>
                {msg.relatorio ? (
                  <RelatorioCard transacoes={transacoes} tarefas={tarefas} lembretes={lembretes} treinos={treinos} />
                ) : (
                  <div style={{
                    background: T.card, border: `1px solid ${msg.cor || T.border}`,
                    borderLeft: `3px solid ${msg.cor || T.border}`,
                    padding: "8px 14px", borderRadius: "4px 16px 16px 16px", fontSize: 13,
                  }}>
                    {msg.texto && <div style={{ fontWeight: 600, color: msg.cor || T.ink }}>{msg.texto}</div>}
                    {msg.detalhes && <div style={{ color: T.muted, marginTop: 2, fontSize: 11.5 }}>{msg.detalhes}</div>}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {carregando && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.muted, fontSize: 12 }}>
            <Loader size={13} style={{ animation: "spin 1s linear infinite" }} /> Processando...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        display: "flex", gap: 8, padding: "10px 0",
        borderTop: `1px solid ${T.border}`,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && enviar()}
          placeholder='gasto 50 almoço · reunião amanhã 14h · tarefa ligar pro banco'
          disabled={carregando}
          style={{ flex: 1, fontSize: 13, padding: "8px 12px", borderRadius: 14, border: `1px solid ${T.border}`, background: T.bg }}
        />
        <button onClick={enviar} disabled={carregando || !input.trim()}
          style={{
            background: T.gold, color: T.bg, border: "none",
            borderRadius: 14, padding: "8px 14px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5, fontWeight: 700, fontSize: 13,
            opacity: (!input.trim() || carregando) ? 0.5 : 1,
          }}>
          <Send size={14} /> Enviar
        </button>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
