import React, { useMemo, useState, useEffect } from "react";
import { BookOpen, Heart, Sparkles, ChevronDown, Save } from "lucide-react";
import { T } from "../../lib/theme.js";
import { todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import PageHeader from "../ui/PageHeader.jsx";
import Field from "../ui/Field.jsx";

const HUMORES = [
  { v: 5, emoji: "😄", label: "Ótimo", cor: "#70ad47" },
  { v: 4, emoji: "🙂", label: "Bem", cor: "#a5d77c" },
  { v: 3, emoji: "😐", label: "Neutro", cor: "#c9a96b" },
  { v: 2, emoji: "😕", label: "Mal", cor: "#e7a3a3" },
  { v: 1, emoji: "😢", label: "Difícil", cor: "#d97757" },
];

function formatarDataLonga(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
}

function formatarDataCurta(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch { return iso; }
}

export default function Diario({ diario = [], setDiario }) {
  const hoje = todayISO();
  const entradaHoje = useMemo(() => diario.find(d => d.data === hoje), [diario, hoje]);

  const [humor, setHumor] = useState(entradaHoje?.humor || null);
  const [gratidao, setGratidao] = useState(entradaHoje?.gratidao || "");
  const [reflexao, setReflexao] = useState(entradaHoje?.reflexao || "");
  const [dirty, setDirty] = useState(false);
  const [verPassadas, setVerPassadas] = useState(false);

  // Quando muda a entrada de hoje (carregamento, etc), sincroniza
  useEffect(() => {
    setHumor(entradaHoje?.humor || null);
    setGratidao(entradaHoje?.gratidao || "");
    setReflexao(entradaHoje?.reflexao || "");
    setDirty(false);
  }, [entradaHoje?.data]);

  const salvar = () => {
    const agora = new Date().toISOString();
    const novaEntrada = {
      data: hoje,
      humor: humor || null,
      gratidao: gratidao.trim(),
      reflexao: reflexao.trim(),
      createdAt: entradaHoje?.createdAt || agora,
      updatedAt: agora,
    };
    if (entradaHoje) {
      setDiario(diario.map(d => d.data === hoje ? novaEntrada : d));
    } else {
      setDiario([novaEntrada, ...diario]);
    }
    setDirty(false);
    toast.success("Diário de hoje salvo.");
  };

  const passadas = useMemo(() => {
    return diario.filter(d => d.data !== hoje).sort((a, b) => b.data.localeCompare(a.data));
  }, [diario, hoje]);

  const humorMeta = HUMORES.find(h => h.v === humor);

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Diário"
        title="Registro do dia"
        sub="Como você está e do que é grato — 1 minuto por dia."
      />

      {/* Entrada de hoje */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
        padding: 18, marginBottom: 18,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div className="label-eyebrow">Hoje</div>
            <div style={{ fontFamily: T.serif, fontSize: 20, color: T.ink, fontWeight: 600, marginTop: 2, textTransform: "capitalize" }}>
              {formatarDataLonga(hoje)}
            </div>
          </div>
          {humorMeta && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 12px", borderRadius: 100,
              background: `${humorMeta.cor}22`, color: humorMeta.cor,
              fontSize: 12, fontWeight: 600,
            }}>
              <span style={{ fontSize: 18 }}>{humorMeta.emoji}</span>
              {humorMeta.label}
            </div>
          )}
        </div>

        {/* Humor */}
        <div style={{ marginBottom: 14 }}>
          <div className="label-eyebrow" style={{ marginBottom: 8 }}>Como você está hoje?</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {HUMORES.map(h => (
              <button key={h.v}
                onClick={() => { setHumor(h.v); setDirty(true); }}
                style={{
                  padding: "8px 14px",
                  background: humor === h.v ? `${h.cor}22` : T.bgSoft,
                  border: `1px solid ${humor === h.v ? h.cor : T.border}`,
                  borderRadius: 8,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 12, color: humor === h.v ? h.cor : T.muted,
                  fontWeight: 600,
                  minHeight: 40,
                }}>
                <span style={{ fontSize: 18 }}>{h.emoji}</span>
                <span>{h.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Gratidão */}
        <Field label={<><Heart size={11} className="inline mr-1" style={{ color: T.red }} /> Pelo que você é grato hoje?</>}>
          <textarea value={gratidao}
                    onChange={e => { setGratidao(e.target.value); setDirty(true); }}
                    placeholder="3 coisas pequenas ou grandes..."
                    rows={3}
                    style={{ resize: "vertical", fontFamily: "inherit" }} />
        </Field>

        {/* Reflexão */}
        <Field label={<><Sparkles size={11} className="inline mr-1" style={{ color: T.gold }} /> Pensamento, aprendizado ou desafio</>}>
          <textarea value={reflexao}
                    onChange={e => { setReflexao(e.target.value); setDirty(true); }}
                    placeholder="O que aconteceu? O que você aprendeu?"
                    rows={4}
                    style={{ resize: "vertical", fontFamily: "inherit" }} />
        </Field>

        <button onClick={salvar} className="btn-gold"
          disabled={!dirty}
          style={{
            opacity: dirty ? 1 : 0.5,
            cursor: dirty ? "pointer" : "default",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
          <Save size={13} />
          {entradaHoje ? "Salvar mudanças" : "Salvar entrada"}
        </button>
        {!dirty && entradaHoje && (
          <span style={{ marginLeft: 12, fontSize: 11, color: T.muted, fontStyle: "italic" }}>
            ✓ Salvo
          </span>
        )}
      </div>

      {/* Entradas passadas */}
      {passadas.length > 0 && (
        <>
          <button onClick={() => setVerPassadas(!verPassadas)}
            style={{
              background: "transparent", border: "none", color: T.muted,
              fontSize: 12, fontWeight: 600, letterSpacing: ".05em",
              textTransform: "uppercase", cursor: "pointer",
              padding: "8px 0",
              display: "flex", alignItems: "center", gap: 6,
              marginBottom: 8,
            }}>
            <ChevronDown size={14} style={{
              transform: verPassadas ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform .2s",
            }} />
            Entradas anteriores ({passadas.length})
          </button>

          {verPassadas && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {passadas.map(d => {
                const hm = HUMORES.find(h => h.v === d.humor);
                return (
                  <div key={d.data} style={{
                    background: T.card, border: `1px solid ${T.border}`,
                    borderLeft: `3px solid ${hm?.cor || T.muted}`,
                    borderRadius: 8, padding: 14,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: T.muted, fontWeight: 600, letterSpacing: ".05em" }}>
                        {formatarDataCurta(d.data)}
                      </span>
                      {hm && (
                        <span style={{ fontSize: 16 }}>{hm.emoji}</span>
                      )}
                    </div>
                    {d.gratidao && (
                      <div style={{ fontSize: 12.5, color: T.ink, marginBottom: 6, lineHeight: 1.5 }}>
                        <strong style={{ color: T.red, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", marginRight: 6 }}>♥ Gratidão</strong>
                        <span style={{ whiteSpace: "pre-wrap" }}>{d.gratidao}</span>
                      </div>
                    )}
                    {d.reflexao && (
                      <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5 }}>
                        <strong style={{ color: T.gold, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", marginRight: 6 }}>✦ Reflexão</strong>
                        <span style={{ whiteSpace: "pre-wrap" }}>{d.reflexao}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
