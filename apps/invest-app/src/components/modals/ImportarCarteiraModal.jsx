import React, { useRef, useState } from "react";
import { Upload, X, FileSpreadsheet } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, uid } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { importarCarteiraPlanilha } from "../../lib/importarCarteira.js";

/**
 * Modal de importação de carteira por planilha (B3/CEI/própria).
 * Lê o arquivo, mostra prévia dos ativos detectados e, ao confirmar,
 * adiciona/atualiza na carteira (soma quantidades de tickers repetidos).
 */
export default function ImportarCarteiraModal({ ativos = [], setAtivos, onClose }) {
  const inputRef = useRef(null);
  const [itens, setItens] = useState(null);
  const [erros, setErros] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [nomeArq, setNomeArq] = useState("");

  const escolher = () => inputRef.current?.click();

  const aoArquivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNomeArq(file.name);
    setCarregando(true);
    setItens(null); setErros([]);
    try {
      const r = await importarCarteiraPlanilha(file);
      setItens(r.itens);
      setErros(r.erros || []);
    } catch (err) {
      toast.error(err.message || "Falha ao ler a planilha.");
    } finally {
      setCarregando(false);
      e.target.value = ""; // permite reescolher o mesmo arquivo
    }
  };

  const confirmar = () => {
    if (!itens?.length) return;
    const validos = itens.filter(it => it.qtd > 0);
    if (validos.length === 0) {
      toast.error("Defina a quantidade de pelo menos um ativo antes de importar.");
      return;
    }
    const mapa = new Map(ativos.map(a => [String(a.ticker || "").toUpperCase(), a]));
    let novos = 0, atualizados = 0;
    validos.forEach(it => {
      const ex = mapa.get(it.ticker);
      if (ex) {
        // soma quantidade; recalcula PM ponderado quando ambos têm PM
        const qtdTotal = Number(ex.qtd || 0) + it.qtd;
        const pmPond = (it.pm > 0 && ex.pm > 0)
          ? ((Number(ex.qtd || 0) * Number(ex.pm)) + (it.qtd * it.pm)) / qtdTotal
          : (ex.pm || it.pm || 0);
        mapa.set(it.ticker, { ...ex, qtd: qtdTotal, pm: +Number(pmPond).toFixed(4) });
        atualizados++;
      } else {
        mapa.set(it.ticker, {
          id: uid(), ticker: it.ticker, nome: it.nome, tipo: it.tipo,
          segmento: "", qtd: it.qtd, pm: it.pm, preco: it.pm || 0, base: 0,
        });
        novos++;
      }
    });
    setAtivos(Array.from(mapa.values()));
    toast.success(`Importado: ${novos} novo(s), ${atualizados} atualizado(s).`);
    onClose?.();
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 60, display: "grid", placeItems: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "85vh", overflow: "auto", background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <FileSpreadsheet size={18} style={{ color: T.gold }} />
          <h3 style={{ fontFamily: T.serif, fontSize: 18, color: T.ink, fontWeight: 600 }}>Importar carteira por planilha</h3>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "transparent", border: "none", color: T.muted, cursor: "pointer" }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 12, color: T.muted, marginBottom: 14, lineHeight: 1.5 }}>
          Envie um arquivo <strong>.xlsx</strong> ou <strong>.csv</strong> com colunas de
          <strong> Ticker/Código</strong>, <strong>Quantidade</strong> e (opcional) <strong>Preço médio</strong>.
          Funciona com extratos da B3/CEI e planilhas próprias.
        </p>

        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={aoArquivo} style={{ display: "none" }} />

        {!itens && (
          <button onClick={escolher} disabled={carregando}
            style={{
              width: "100%", padding: "22px", borderRadius: 10, cursor: "pointer",
              border: `1.5px dashed ${T.border}`, background: T.bgSoft, color: T.muted,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            }}>
            <Upload size={22} style={{ color: T.gold }} />
            {carregando ? "Lendo planilha…" : (nomeArq ? `Escolher outro (${nomeArq})` : "Escolher arquivo")}
          </button>
        )}

        {itens && (
          <>
            <div style={{ fontSize: 12, color: T.muted, marginBottom: 8 }}>
              <strong style={{ color: T.ink }}>{itens.length}</strong> ativo(s) detectado(s){erros.length > 0 ? ` · ${erros.length} ignorado(s)` : ""}:
            </div>
            {semQtd && (
              <div style={{ fontSize: 11.5, color: T.gold, background: `${T.gold}14`, border: `1px solid ${T.gold}44`, borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
                Esta planilha não tem coluna de quantidade (parece uma lista de análise). Informe a quantidade de cada ativo abaixo — quem ficar em 0 não é importado.
              </div>
            )}
            <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: T.bgSoft }}>
                    <th style={th("left")}>Ticker</th>
                    <th style={th("left")}>Tipo</th>
                    <th style={th("right")}>Qtd</th>
                    <th style={th("right")}>Preço médio</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((it, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${T.border}` }}>
                      <td style={{ ...td(), color: T.ink, fontWeight: 600 }}>{it.ticker}</td>
                      <td style={td()}>{it.tipo}</td>
                      <td style={{ ...td(), textAlign: "right" }}>
                        <input type="number" min={0} value={it.qtd || ""} onChange={e => setQtdItem(i, e.target.value)}
                               placeholder="0"
                               style={{ width: 80, padding: "4px 7px", textAlign: "right", borderRadius: 6, border: `1px solid ${it.qtd > 0 ? T.border : T.gold}`, background: T.bgSoft, color: T.ink, fontSize: 12 }} />
                      </td>
                      <td style={{ ...td(), textAlign: "right" }} className="num">{it.pm > 0 ? fmt(it.pm) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { setItens(null); setNomeArq(""); }} style={btnGhost()}>Trocar arquivo</button>
              <button onClick={confirmar} style={btnGold()}>Importar {itens.length} ativo(s)</button>
            </div>
            <div style={{ fontSize: 10.5, color: T.faint, fontStyle: "italic", marginTop: 8 }}>
              Tickers já existentes têm a quantidade somada e o preço médio recalculado.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const th = (a) => ({ padding: "8px 10px", textAlign: a, fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: T.muted, fontWeight: 600 });
const td = () => ({ padding: "8px 10px", verticalAlign: "middle" });
const btnGold = () => ({ background: T.gold, color: "#1a1407", border: "none", padding: "9px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" });
const btnGhost = () => ({ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, padding: "9px 16px", borderRadius: 8, fontSize: 13, cursor: "pointer" });
