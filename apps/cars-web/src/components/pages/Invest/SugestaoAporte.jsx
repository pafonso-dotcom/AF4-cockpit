/**
 * Sugestão de Aporte · IA + Brapi
 *
 * Pega valor disponível + perfil + objetivo → busca preços atuais
 * de um catálogo curado de ações e FIIs, monta contexto pra IA
 * (Claude) e devolve recomendações estruturadas por classe.
 *
 * O usuário pode "aplicar à projeção" pra simular o resultado
 * de longo prazo de cada opção sugerida.
 */
import React, { useMemo, useState } from "react";
import {
  Sparkles, TrendingUp, Building2, Landmark, AlertCircle, Loader2,
  ChevronRight, Check, X,
} from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, fmtN } from "../../../lib/format.js";
import { parseValorBR } from "../../../lib/importExport.js";
import { perguntarAoClaude } from "../../../lib/aiChat.js";
import { getQuotes } from "../../../lib/brapi.js";
import { toast } from "../../../lib/toast.js";
import Field from "../../ui/Field.jsx";
import Modal from "../../ui/Modal.jsx";

// Catálogo curado — top blue chips que cabem em qualquer carteira
const CATALOGO = {
  acoes: [
    { ticker: "PETR4", nome: "Petrobras PN",         setor: "Petróleo & Gás" },
    { ticker: "ITUB4", nome: "Itaú Unibanco PN",     setor: "Bancos" },
    { ticker: "VALE3", nome: "Vale ON",              setor: "Mineração" },
    { ticker: "BBDC4", nome: "Bradesco PN",          setor: "Bancos" },
    { ticker: "ITSA4", nome: "Itaúsa PN",            setor: "Holding" },
    { ticker: "BBAS3", nome: "Banco do Brasil ON",   setor: "Bancos" },
    { ticker: "WEGE3", nome: "WEG ON",               setor: "Bens Industriais" },
    { ticker: "B3SA3", nome: "B3 ON",                setor: "Financeiro" },
    { ticker: "EGIE3", nome: "Engie Brasil ON",      setor: "Energia" },
    { ticker: "RADL3", nome: "RaiaDrogasil ON",      setor: "Varejo Saúde" },
  ],
  fiis: [
    { ticker: "MXRF11", nome: "Maxi Renda",          segmento: "Recebíveis" },
    { ticker: "HGLG11", nome: "CSHG Logística",      segmento: "Logística" },
    { ticker: "KNRI11", nome: "Kinea Renda Imob.",   segmento: "Híbrido" },
    { ticker: "XPLG11", nome: "XP Log",              segmento: "Logística" },
    { ticker: "BTLG11", nome: "BTG Pactual Logist.", segmento: "Logística" },
    { ticker: "VISC11", nome: "Vinci Shopping",      segmento: "Shoppings" },
    { ticker: "HGRE11", nome: "CSHG Real Estate",    segmento: "Lajes Corp." },
    { ticker: "MCCI11", nome: "Mauá Capital Recec.", segmento: "Recebíveis" },
    { ticker: "IRDM11", nome: "Iridium Recebíveis",  segmento: "Recebíveis" },
    { ticker: "RBRR11", nome: "RBR Rendimento",      segmento: "Recebíveis" },
  ],
};

const PERFIS = [
  { id: "conservador", label: "Conservador", aloc: { cdb: 60, fii: 25, acao: 15 }, cor: "#60a5fa" },
  { id: "moderado",    label: "Moderado",    aloc: { cdb: 30, fii: 40, acao: 30 }, cor: "#fbbf24" },
  { id: "agressivo",   label: "Agressivo",   aloc: { cdb: 10, fii: 35, acao: 55 }, cor: "#f87171" },
];

const OBJETIVOS = [
  { id: "renda",       label: "Renda mensal",  desc: "Prioriza dividend yield e juros mensais" },
  { id: "crescimento", label: "Crescimento",   desc: "Prioriza valorização do principal" },
  { id: "reserva",     label: "Reserva",       desc: "Prioriza liquidez e segurança" },
];

export default function SugestaoAporte({
  open, onClose,
  ativosCarteira = [],
  apiKey,
  onAplicarProjecao,
  valorInicial,       // pré-preenche o campo valor (opcional)
  contextoExtra,      // string extra adicionada ao prompt (opcional)
}) {
  const [valor, setValor] = useState(valorInicial != null ? String(valorInicial) : "5000");
  const [perfilId, setPerfilId] = useState("moderado");
  const [objetivoId, setObjetivoId] = useState("renda");
  const [taxaCdi, setTaxaCdi] = useState("10.5"); // % a.a.
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);

  const perfil = PERFIS.find(p => p.id === perfilId) || PERFIS[1];
  const objetivo = OBJETIVOS.find(o => o.id === objetivoId) || OBJETIVOS[0];
  const valorN = parseValorBR(valor) || 0;
  const cdiN = parseValorBR(taxaCdi) || 10.5;

  /* ===== Busca ===== */
  const buscar = async () => {
    setErro(null);
    setResultado(null);
    if (valorN <= 0) { toast.error("Informe um valor maior que zero."); return; }
    if (!apiKey) {
      setErro("Configure a chave Anthropic em Configurações → APIs para usar a sugestão por IA.");
      return;
    }
    setLoading(true);
    try {
      // 1) Junta carteira + catálogo, mantém únicos
      const tickersCarteira = (ativosCarteira || [])
        .filter(a => Number(a.qtd || 0) > 0)
        .map(a => a.ticker)
        .filter(Boolean);
      const tickersAcoes = [...new Set([
        ...CATALOGO.acoes.map(a => a.ticker),
        ...tickersCarteira.filter(t => !/11$/.test(t)),
      ])];
      const tickersFiis = [...new Set([
        ...CATALOGO.fiis.map(a => a.ticker),
        ...tickersCarteira.filter(t => /11$/.test(t)),
      ])];

      // 2) Busca cotações via Brapi (paralelo)
      const tickersTodos = [...tickersAcoes, ...tickersFiis];
      let quotes = [];
      try {
        quotes = await getQuotes(tickersTodos);
      } catch (e) {
        // Sem token brapi ou erro de rede → segue com nomes apenas
        console.warn("[sugestao] brapi falhou, IA recebe dados parciais:", e?.message);
      }
      const byTicker = new Map((quotes || []).map(q => [q.symbol, q]));

      // 3) Monta linhas pra IA
      const mkLinha = (t, meta) => {
        const q = byTicker.get(t);
        const preco = q?.regularMarketPrice ?? null;
        const dy = q?.dividendYield ?? q?.priceEarnings ?? null;
        return `- ${t} (${meta.nome})${meta.setor ? ` · ${meta.setor}` : meta.segmento ? ` · ${meta.segmento}` : ""}: preço atual ${preco != null ? `R$ ${Number(preco).toFixed(2)}` : "(sem cotação)"}${dy != null ? ` · DY/PL ${Number(dy).toFixed(2)}` : ""}`;
      };

      const linhasAcoes = CATALOGO.acoes.map(a => mkLinha(a.ticker, a)).join("\n");
      const linhasFiis  = CATALOGO.fiis.map(a => mkLinha(a.ticker, a)).join("\n");

      const carteiraResumo = (ativosCarteira || [])
        .filter(a => Number(a.qtd || 0) > 0)
        .slice(0, 12)
        .map(a => `- ${a.ticker} (${a.tipo}): ${a.qtd} cotas, PM R$ ${Number(a.pm || 0).toFixed(2)}`)
        .join("\n") || "(carteira vazia)";

      // 4) Prompt estruturado pedindo JSON
      const pergunta = `
Tenho **R$ ${valorN.toFixed(2)}** disponíveis para aportar AGORA.

Perfil: **${perfil.label}** (alocação alvo: ${perfil.aloc.cdb}% CDB, ${perfil.aloc.fii}% FII, ${perfil.aloc.acao}% Ação).
Objetivo principal: **${objetivo.label}** — ${objetivo.desc}.
CDB pós-fixado disponível: 100% do CDI a ${cdiN.toFixed(2)}% a.a. (≈ ${(cdiN / 12).toFixed(2)}% a.m.).
${contextoExtra ? `\n${contextoExtra}\n` : ""}

═══ MINHA CARTEIRA ATUAL ═══
${carteiraResumo}

═══ AÇÕES CANDIDATAS (cotações de hoje) ═══
${linhasAcoes}

═══ FIIs CANDIDATOS (cotações de hoje) ═══
${linhasFiis}

ANÁLISE PEDIDA:
Sugira a **melhor alocação concreta** para esse aporte agora, respeitando o perfil e objetivo.

Para cada classe (CDB, FII, AÇÃO), responda em JSON exato no formato:

\`\`\`json
{
  "alocacao": {
    "cdb":  { "percent": 30, "valor": 1500.00, "motivo": "..." },
    "fii":  { "percent": 40, "valor": 2000.00, "motivo": "..." },
    "acao": { "percent": 30, "valor": 1500.00, "motivo": "..." }
  },
  "fiis_top3":  [{ "ticker": "MXRF11", "qtd": 10, "valor": 105.00, "razao": "..." }],
  "acoes_top3": [{ "ticker": "PETR4",  "qtd": 30, "valor": 1200.00, "razao": "..." }],
  "resumo": "1 parágrafo curto explicando a estratégia"
}
\`\`\`

REGRAS:
- Use APENAS tickers que aparecem nas listas acima.
- "qtd" é número INTEIRO de cotas que cabem no orçamento daquela classe.
- "valor" = qtd × preço atual.
- Limite cada top3 a no máximo 3 tickers. Pode ser menos se o valor não couber.
- "razao" em até 12 palavras explicando por que esse ticker faz sentido AGORA para o perfil/objetivo.
- "resumo" em até 50 palavras.
- Devolva SOMENTE o JSON entre as marcações \`\`\`json ... \`\`\` (sem texto antes nem depois).
      `.trim();

      // 5) Chama IA
      const contextoMin = `O Paulo Afonso é dono da AF4 Motors em Tatuí-SP. Ele gerencia patrimônio próprio e usa o cockpit AF4 pra simular aportes. Hoje quer uma sugestão concreta de alocação.`;
      const resposta = await perguntarAoClaude({
        apiKey,
        pergunta,
        contextoDados: contextoMin,
        historico: [],
      });

      // 6) Parse do JSON
      const m = resposta.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = m ? m[1] : resposta;
      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        setErro("A IA respondeu mas o formato não é JSON válido. Resposta bruta abaixo.");
        setResultado({ raw: resposta });
        return;
      }
      setResultado(parsed);
    } catch (e) {
      console.error("[sugestao] erro:", e);
      setErro(e?.message || "Erro ao buscar sugestão.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Modal title={<><Sparkles size={18} style={{ display: "inline", marginRight: 8, color: T.gold }} />Sugestão de Aporte · IA</>} onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Inputs principais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Valor a investir (R$)" required>
            <input type="text" inputMode="decimal"
                   value={valor}
                   onChange={e => setValor(e.target.value)}
                   placeholder="5000"
                   autoFocus />
          </Field>
          <Field label="CDI atual (% a.a.)" hint="Default: Selic ~10,5%">
            <input type="text" inputMode="decimal"
                   value={taxaCdi}
                   onChange={e => setTaxaCdi(e.target.value)} />
          </Field>
          <Field label="Objetivo">
            <select value={objetivoId} onChange={e => setObjetivoId(e.target.value)}>
              {OBJETIVOS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </Field>
        </div>

        {/* Perfil */}
        <div>
          <div className="label-eyebrow" style={{ marginBottom: 8 }}>Perfil de risco</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PERFIS.map(p => {
              const ativo = p.id === perfilId;
              return (
                <button key={p.id} onClick={() => setPerfilId(p.id)}
                        style={{
                          padding: "10px 16px",
                          background: ativo ? `${p.cor}22` : T.card,
                          border: `1px solid ${ativo ? p.cor : T.border}`,
                          color: ativo ? p.cor : T.muted,
                          fontSize: 12, fontWeight: 600, borderRadius: 8,
                          cursor: "pointer", letterSpacing: ".03em",
                          display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3,
                          minWidth: 120,
                        }}>
                  <span>{p.label}</span>
                  <span style={{ fontSize: 9.5, color: ativo ? p.cor : T.faint, fontWeight: 500 }}>
                    {p.aloc.cdb}% CDB · {p.aloc.fii}% FII · {p.aloc.acao}% Ação
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Botão */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn-gold" onClick={buscar} disabled={loading}
                  style={{ minWidth: 200 }}>
            {loading ? (
              <><Loader2 size={14} className="inline mr-2 spin" />Analisando…</>
            ) : (
              <><Sparkles size={14} className="inline mr-2" />Buscar melhor opção</>
            )}
          </button>
          {!apiKey && (
            <span style={{ fontSize: 11, color: T.gold }}>
              <AlertCircle size={11} className="inline mr-1" />
              Configure a chave Anthropic em Configurações
            </span>
          )}
        </div>

        {/* Erro */}
        {erro && (
          <div style={{
            padding: 10, background: `${T.red}11`, border: `1px solid ${T.red}55`,
            borderRadius: 8, fontSize: 12, color: T.red,
          }}>
            <AlertCircle size={12} className="inline mr-1" /> {erro}
          </div>
        )}

        {/* Resultado bruto se JSON falhou */}
        {resultado?.raw && (
          <div style={{
            padding: 12, background: T.bgSoft, border: `1px solid ${T.border}`,
            borderRadius: 8, fontSize: 12, color: T.ink, whiteSpace: "pre-wrap",
            maxHeight: 400, overflowY: "auto",
          }}>
            {resultado.raw}
          </div>
        )}

        {/* Resultado parseado */}
        {resultado?.alocacao && (
          <ResultadoSugestao
            resultado={resultado}
            valorTotal={valorN}
            onAplicar={(opcao) => {
              onAplicarProjecao?.(opcao);
              onClose?.();
              toast.success(`${opcao.ticker} carregado na Projeção. Ajuste prazo e taxa se quiser.`);
            }}
          />
        )}
      </div>

      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </Modal>
  );
}

function ResultadoSugestao({ resultado, valorTotal, onAplicar }) {
  const { alocacao = {}, fiis_top3 = [], acoes_top3 = [], resumo = "" } = resultado;

  const blocos = [
    { id: "cdb",  Icon: Landmark,   label: "CDB",  cor: "#60a5fa", info: alocacao.cdb },
    { id: "fii",  Icon: Building2,  label: "FIIs", cor: "#fbbf24", info: alocacao.fii },
    { id: "acao", Icon: TrendingUp, label: "Ações", cor: "#f87171", info: alocacao.acao },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Resumo da estratégia */}
      {resumo && (
        <div style={{
          padding: 12, background: `${T.gold}11`,
          border: `1px solid ${T.gold}44`,
          borderLeft: `3px solid ${T.gold}`,
          borderRadius: 8, fontSize: 13, color: T.ink, lineHeight: 1.5,
        }}>
          <Sparkles size={13} className="inline mr-2" style={{ color: T.gold }} />
          {resumo}
        </div>
      )}

      {/* Alocação 3-up */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {blocos.map(b => (
          <BlocoAlocacao key={b.id} {...b} valorTotal={valorTotal} />
        ))}
      </div>

      {/* Tops específicos */}
      {fiis_top3.length > 0 && (
        <TopList titulo="FIIs sugeridos" icone={Building2} cor="#fbbf24"
                 itens={fiis_top3} onAplicar={onAplicar} classe="fii" />
      )}
      {acoes_top3.length > 0 && (
        <TopList titulo="Ações sugeridas" icone={TrendingUp} cor="#f87171"
                 itens={acoes_top3} onAplicar={onAplicar} classe="acao" />
      )}
    </div>
  );
}

function BlocoAlocacao({ Icon, label, cor, info, valorTotal }) {
  if (!info) return null;
  const pct = Number(info.percent || 0);
  const val = Number(info.valor || (valorTotal * pct / 100));
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${cor}`,
      borderRadius: 10, padding: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Icon size={16} style={{ color: cor }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: T.ink, letterSpacing: ".05em" }}>
          {label}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 16, fontWeight: 700, color: cor }} className="num">
          {pct}%
        </span>
      </div>
      <div className="num" style={{ fontFamily: T.serif, fontSize: 18, color: T.ink, lineHeight: 1.1 }}>
        {fmt(val)}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 6, lineHeight: 1.4 }}>
        {info.motivo}
      </div>
    </div>
  );
}

function TopList({ titulo, icone: Icon, cor, itens, onAplicar, classe }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
      overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 14px", borderBottom: `1px solid ${T.border}`,
        background: T.bgSoft,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <Icon size={14} style={{ color: cor }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: T.ink, letterSpacing: ".05em" }}>
          {titulo}
        </span>
      </div>
      <div>
        {itens.map((item, i) => (
          <div key={i} style={{
            padding: "10px 14px",
            borderTop: i > 0 ? `1px solid ${T.border}` : "none",
            display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 10, alignItems: "center",
          }}>
            <div style={{
              padding: "4px 9px", background: `${cor}22`, color: cor,
              fontSize: 11, fontWeight: 700, borderRadius: 5, letterSpacing: ".05em",
            }}>
              {item.ticker}
            </div>
            <div style={{ fontSize: 12, color: T.muted, minWidth: 0 }}>
              <div>{item.qtd} cota{item.qtd !== 1 ? "s" : ""}</div>
              {item.razao && (
                <div style={{ fontSize: 10.5, color: T.faint, marginTop: 2, fontStyle: "italic" }}>
                  {item.razao}
                </div>
              )}
            </div>
            <div className="num" style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: "nowrap" }}>
              {fmt(Number(item.valor || 0))}
            </div>
            <button onClick={() => onAplicar?.({ ticker: item.ticker, classe, valor: Number(item.valor || 0) })}
                    title="Aplicar à projeção"
                    style={{
                      background: "transparent", border: `1px solid ${T.border}`,
                      color: T.gold, padding: "5px 10px", borderRadius: 6,
                      fontSize: 10.5, fontWeight: 600, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 4,
                    }}>
              Projetar <ChevronRight size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
