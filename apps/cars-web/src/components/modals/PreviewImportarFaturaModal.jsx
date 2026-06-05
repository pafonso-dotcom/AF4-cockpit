import React, { useState, useMemo } from "react";
import { Check, Repeat, Smartphone, ShoppingBag, Link2, AlertCircle } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, uid, todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import {
  matchParcelamento,
  matchFixaExistente,
  detectarDuplicidadeFatura,
  gerarOcorrenciasFixa,
  brDateToISO,
  brDateToMonthISO,
} from "../../lib/importarFatura.js";
import Modal from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";

/**
 * Modal de preview após análise IA da fatura.
 * Mostra cada item classificado (vista / fixa / parcela),
 * detecta match com parcelamentos existentes,
 * pede conta pra lançamento e confirma a importação completa
 * pro módulo Planejamento + transações na conta.
 */
export default function PreviewImportarFaturaModal({
  analise,
  contas = [],
  setContas,
  transacoes = [],
  setTransacoes,
  fixas = [],
  setFixas,
  fixaOcorrencias = [],
  setFixaOcorrencias,
  parcelamentos = [],
  setParcelamentos,
  cartoes = [],
  setCartoes,
  onClose,
}) {
  // Conta de débito é OPCIONAL — default vazio ("Definir depois, no pagamento").
  const contaInicial = "";

  // Cartão sugerido pelo banco da análise (já existe lógica em normalize() no fim do arquivo)
  const cartaoInicial = (() => {
    if (!cartoes || cartoes.length === 0) return "";
    const banco = normalize(analise.banco || "");
    if (!banco) return cartoes[0]?.id || "";
    const match = cartoes.find(c =>
      normalize(c.nome).includes(banco) || banco.includes(normalize(c.nome)) ||
      normalize(c.banco || "") === banco
    );
    return match?.id || cartoes[0]?.id || "";
  })();

  const [contaSelecionada, setContaSelecionada] = useState(contaInicial);
  const [cartaoSelecionado, setCartaoSelecionado] = useState(cartaoInicial);
  const [itens, setItens] = useState(() => (analise.itens || analise.transacoes || []).map((it, idx) => {
    // Importação só lida com "vista" e "parcela". Assinaturas recorrentes são
    // criadas manualmente em Despesas Fixas — nunca pela importação de fatura.
    const tipo = it.tipo === "parcela" ? "parcela" : "vista";
    // Parcela que já existe entra DESMARCADA por default (evita duplicar)
    const jaExiste = (tipo === "parcela" && !!matchParcelamento(it, parcelamentos));
    return {
      ...it,
      _idx: idx,
      _incluir: !jaExiste,
      // Normalização defensiva
      tipo,
      valor: Number(it.valor) || 0,
      descricao: String(it.descricao || "Lançamento").trim(),
      categoria_sugerida: it.categoria_sugerida || it.categoria || "Outros",
    };
  }));

  // Competência (mês/ano) da fatura — editável. A IA às vezes erra o ANO
  // (lê 2024 numa fatura atual); como você está importando agora, se o ano
  // lido for passado assumimos o ano corrente. Você pode ajustar no campo.
  const [competencia, setCompetencia] = useState(() => {
    const m = brDateToMonthISO(analise.vencimento) || todayISO().slice(0, 7);
    const [yy, mm] = m.split("-");
    const curY = new Date().getFullYear();
    return Number(yy) < curY ? `${curY}-${mm}` : m;
  });
  const mesFatura = competencia;
  const dataPagto = (() => {
    const venc = brDateToISO(analise.vencimento);
    const dia = venc ? venc.slice(8, 10) : "10";
    return `${competencia}-${dia}`;
  })();

  // Itens com match detectado (parcelamentos existentes)
  const itensProcessados = useMemo(() => {
    return itens.map(item => {
      if (item.tipo === "parcela") {
        const match = matchParcelamento(item, parcelamentos);
        return { ...item, _match: match };
      }
      if (item.tipo === "fixa") {
        return { ...item, _matchFixa: matchFixaExistente(item, fixas) };
      }
      return item;
    });
  }, [itens, parcelamentos, fixas]);

  // Agrupamento por tipo (pra mostrar contadores)
  const stats = useMemo(() => {
    const incluidos = itensProcessados.filter(i => i._incluir);
    return {
      total: incluidos.length,
      vista: incluidos.filter(i => i.tipo === "vista").length,
      fixa: incluidos.filter(i => i.tipo === "fixa").length,
      parcela: incluidos.filter(i => i.tipo === "parcela").length,
      matches: incluidos.filter(i => i.tipo === "parcela" && i._match).length,
      novasParcelas: incluidos.filter(i => i.tipo === "parcela" && !i._match).length,
      valorTotal: incluidos.reduce((s, i) => s + (i.valor || 0), 0),
    };
  }, [itensProcessados]);

  // Alerta de fatura possivelmente já importada
  const duplicidadeAlerta = useMemo(
    () => detectarDuplicidadeFatura(analise, parcelamentos),
    [analise, parcelamentos]
  );

  const toggleItem = (idx) => {
    setItens(prev => prev.map(it => it._idx === idx ? { ...it, _incluir: !it._incluir } : it));
  };

  const mudarTipo = (idx, novoTipo) => {
    setItens(prev => prev.map(it => it._idx === idx ? { ...it, tipo: novoTipo } : it));
  };

  const confirmar = () => {
    if (cartoes.length > 0 && !cartaoSelecionado) {
      toast.error("Selecione o cartão da fatura antes de importar.");
      return;
    }
    const incluidos = itensProcessados.filter(i => i._incluir);
    if (incluidos.length === 0) {
      toast.error("Nenhum item selecionado.");
      return;
    }
    // Conta de débito é OPCIONAL — pode ficar vazia e ser definida no pagamento da fatura.
    const conta = contaSelecionada ? contas.find(c => c.nome === contaSelecionada) : null;
    const contaNome = conta ? conta.nome : "";

    const novasTransacoes = [];
    const novasFixas = [];
    const novasFixaOcorrencias = [];
    const novosParcelamentos = [];
    let parcelamentosAtualizados = [...parcelamentos];
    let totalDebitado = 0;

    const banco = analise.banco || "Fatura";
    const origemTag = `fatura-${banco}`;

    incluidos.forEach(item => {
      const valor = Number(item.valor) || 0;
      const cat = item.categoria_sugerida || "Outros";

      if (item.tipo === "vista") {
        // Entra como PENDENTE (não debita agora). Vira "paga" e debita o saldo
        // só quando a fatura for paga em Cartões → "Pagar fatura".
        novasTransacoes.push({
          id: uid(),
          tipo: "despesa",
          descricao: `${item.descricao} (fatura ${banco})`,
          valor,
          data: dataPagto,
          categoria: cat,
          conta: contaNome,
          cartaoId: cartaoSelecionado || null,
          compensado: false,
          fixa: false,
          obs: `Importado da fatura ${banco}`,
          origem: origemTag,
        });
        return;
      }

      if (item.tipo === "fixa") {
        // Já existe uma fixa igual (mesmo nome + valor) — não duplica.
        if (matchFixaExistente(item, fixas)) return;
        totalDebitado += valor;
        // Cria template + 12 ocorrências (1ª já paga)
        const fixaId = `fixa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const dia = (() => {
          if (item.data_compra && /^\d{1,2}\//.test(item.data_compra)) {
            return Math.min(parseInt(item.data_compra.split("/")[0], 10) || 1, 28);
          }
          return Math.min(parseInt((dataPagto || "01").slice(8, 10), 10) || 1, 28);
        })();

        novasFixas.push({
          id: fixaId,
          descricao: item.descricao,
          valor,
          diaVencimento: dia,
          categoria: cat,
          contaPadrao: contaNome,
          inicioEm: mesFatura,
          terminoEm: null,
          obs: `Importado da fatura ${banco}`,
          origem: origemTag,
          criadoEm: todayISO(),
        });

        const ocorr = gerarOcorrenciasFixa(item, mesFatura, dataPagto)
          .map(o => ({ ...o, fixaId }));
        novasFixaOcorrencias.push(...ocorr);

        // Lança SÓ a primeira como transação no banco
        const tx = {
          id: uid(),
          tipo: "despesa",
          descricao: `${item.descricao} (fatura ${banco})`,
          valor,
          data: dataPagto,
          categoria: cat,
          conta: contaNome,
          compensado: true,
          fixa: false,
          obs: `1ª parcela de fixa recém-importada`,
          origem: origemTag,
          origemFixaOcorrenciaId: ocorr[0].id,
        };
        novasTransacoes.push(tx);
        // Vincula a ocorrência à transação criada
        ocorr[0].transacaoId = tx.id;
        return;
      }

      if (item.tipo === "parcela") {
        const total = Number(item.parcela_total) || 1;
        const atual = Number(item.parcela_atual) || 1;
        const valorParc = Number(item.valor_parcela) || valor;

        if (item._match) {
          // Parcelamento já existe — NÃO marca a parcela do mês como paga aqui.
          // Ela fica pendente e é baixada quando você "Pagar fatura" (pagamento único).
        } else {
          // Cria parcelamento novo. Marca como pagas só as ANTERIORES (1..atual-1);
          // a parcela atual fica pendente para o pagamento da fatura.
          const cartaoMatch = cartoes.find(c => c.id === cartaoSelecionado)
                            || cartoes.find(c => normalize(c.nome) === normalize(banco));
          novosParcelamentos.push({
            id: uid(),
            descricao: item.descricao,
            cartaoId: cartaoMatch?.id || cartaoSelecionado || null,
            cartaoNome: cartaoMatch?.nome || banco,
            dataCompra: brDateToISO(item.data_compra) || dataPagto,
            dataPrimeira: (() => {
              // Estimativa: parcela 1 = parcela atual - (atual - 1) meses
              const d = new Date(dataPagto);
              d.setMonth(d.getMonth() - (atual - 1));
              return d.toISOString().slice(0, 10);
            })(),
            valorTotal: valorParc * total,
            valorParcela: valorParc,
            totalParcelas: total,
            parcelasPagas: Array.from({ length: Math.max(0, atual - 1) }, (_, i) => i + 1),
            categoria: cat,
            origem: origemTag,
            criadoEm: todayISO(),
          });
        }
        // Parcela NÃO vira transação: ela vive no parcelamento (Planejamento) e é
        // debitada do banco uma única vez no "Pagar fatura". Assim não duplica.
      }
    });

    // === Aplica tudo no estado ===
    if (novasTransacoes.length > 0 && setTransacoes) {
      setTransacoes([...novasTransacoes, ...transacoes]);
    }
    if (novasFixas.length > 0 && setFixas) {
      setFixas([...fixas, ...novasFixas]);
    }
    if (novasFixaOcorrencias.length > 0 && setFixaOcorrencias) {
      setFixaOcorrencias([...fixaOcorrencias, ...novasFixaOcorrencias]);
    }
    if (setParcelamentos) {
      setParcelamentos([...parcelamentosAtualizados, ...novosParcelamentos]);
    }
    // Debita o saldo da conta — SÓ se uma conta foi escolhida.
    // Sem conta, as transações ficam vinculadas só ao cartão (descontam no pagamento da fatura).
    if (conta && setContas && totalDebitado > 0) {
      setContas(contas.map(c => c.nome === contaNome
        ? { ...c, saldo: (Number(c.saldo) || 0) - totalDebitado }
        : c));
    }

    // Registra a fatura REAL (valor a pagar = à vista + fixas + parcelas desta
    // competência) no cartão. É isso que vira "fatura a pagar" — não a soma de
    // todas as parcelas futuras (essa é a dívida total dos parcelamentos).
    const valorFaturaReal = incluidos.reduce((s, i) => s + (Number(i.valor) || 0), 0);
    const cartaoFaturaId = cartaoSelecionado
      || cartoes.find(c => normalize(c.nome) === normalize(banco))?.id;
    if (cartaoFaturaId && setCartoes && valorFaturaReal > 0) {
      setCartoes(cartoes.map(c => c.id === cartaoFaturaId
        ? { ...c, faturaImportada: { valorTotal: valorFaturaReal, competencia: mesFatura, vencimento: dataPagto, paga: false, criadoEm: todayISO() } }
        : c));
    }

    toast.success(
      `Fatura importada · ${incluidos.length} itens${conta ? ` em ${contaNome}` : " (banco a definir no pagamento)"}. ` +
      `${stats.vista} variáveis · ${stats.fixa} fixas · ${stats.parcela} parcelas (${stats.matches} matches).`
    );
    onClose?.();
  };

  // ===== UI =====
  const iconePorTipo = {
    vista:   <ShoppingBag size={16} color={T.muted} />,
    fixa:    <Repeat      size={16} color={T.gold}  />,
    parcela: <Smartphone  size={16} color={T.blue || "#60a5fa"} />,
  };
  const corPorTipo = {
    vista: T.muted,
    fixa: T.gold,
    parcela: T.blue || "#60a5fa",
  };
  const labelPorTipo = {
    vista: "À vista",
    fixa: "Fixa",
    parcela: "Parcela",
  };

  return (
    <Modal
      title={`Importar fatura ${analise.banco || ""} · ${analise.vencimento || ""}`}
      onClose={onClose}
      wide
    >
      {/* Banner de duplicidade */}
      {duplicidadeAlerta?.duplicada && (
        <div style={{
          background: "#FFF6E0",
          border: "1px solid #BA7517",
          borderRadius: 8,
          padding: "12px 14px",
          marginBottom: 14,
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>⚠</span>
          <div style={{ flex: 1, fontSize: 12.5 }}>
            <div style={{ fontWeight: 700, color: "#633806", marginBottom: 3 }}>
              Possível duplicidade detectada
            </div>
            <div style={{ color: "#854F0B" }}>
              <strong>{duplicidadeAlerta.itensJaImportados} de {duplicidadeAlerta.totalItens}</strong> parcelas
              dessa fatura já existem como parcelamento ({duplicidadeAlerta.percentual}%).
              As repetidas já vêm <strong>desmarcadas</strong> — confira antes de importar.
            </div>
          </div>
        </div>
      )}

      {/* Topo: select de conta + resumo */}
      <div style={{
        padding: 14, marginBottom: 14,
        background: `linear-gradient(135deg, ${T.gold}11, transparent)`,
        border: `1px solid ${T.gold}55`, borderRadius: 8,
      }}>
        {cartoes.length > 0 && (
          <Field label="Cartão da fatura" required hint="Qual cartão gerou essa fatura">
            <select value={cartaoSelecionado}
                    onChange={e => setCartaoSelecionado(e.target.value)}>
              <option value="">— Selecione o cartão —</option>
              {cartoes.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome}{c.banco ? ` · ${c.banco}` : ""}{c.final ? ` · ****${c.final}` : ""}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Conta de débito (opcional)"
               hint="Deixe em branco pra definir o banco depois, ao pagar a fatura.">
          <select value={contaSelecionada}
                  onChange={e => setContaSelecionada(e.target.value)}>
            <option value="">— Definir depois (no pagamento) —</option>
            {contas.map(c => (
              <option key={c.id || c.nome} value={c.nome}>
                {c.nome}{c.instituicao ? ` (${c.instituicao})` : ""} · saldo {fmt(c.saldo || 0)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Competência da fatura (mês/ano)"
               hint="Mês a que esta fatura se refere. Ajuste se a leitura automática errou o ano.">
          <input type="month" value={competencia}
                 onChange={e => setCompetencia(e.target.value)} />
        </Field>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
          gap: 6, marginTop: 12, fontSize: 11, color: T.muted,
        }}>
          <div>📦 <strong style={{ color: T.ink, fontSize: 13 }}>{stats.total}</strong> itens</div>
          <div>🛒 <strong style={{ color: T.muted, fontSize: 13 }}>{stats.vista}</strong> à vista</div>
          <div>🔁 <strong style={{ color: T.gold, fontSize: 13 }}>{stats.fixa}</strong> fixas</div>
          <div>📱 <strong style={{ color: T.blue || "#60a5fa", fontSize: 13 }}>{stats.parcela}</strong> parcelas{stats.matches > 0 && ` (${stats.matches} matches)`}</div>
        </div>
        <div className="num" style={{
          marginTop: 8, color: T.red, fontFamily: T.serif,
          fontSize: 18, fontWeight: 600,
        }}>
          Total a debitar: − {fmt(stats.valorTotal)}
        </div>
      </div>

      {/* Lista de itens */}
      <div style={{ maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
        {itensProcessados.map(item => {
          const cor = corPorTipo[item.tipo] || T.muted;
          const opacidade = item._incluir ? 1 : 0.45;
          const matchBanner = (item.tipo === "parcela" && item._match) || (item.tipo === "fixa" && item._matchFixa);
          const novaParcela = item.tipo === "parcela" && !item._match;
          return (
            <div key={item._idx} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "0 10px", marginBottom: 4, minHeight: 44, boxSizing: "border-box",
              background: T.card, border: `1px solid ${matchBanner ? (T.blue || "#60a5fa") + "66" : T.border}`,
              borderLeft: `3px solid ${cor}`,
              borderRadius: 6, opacity: opacidade,
            }}>
              <input type="checkbox" checked={item._incluir}
                     onChange={() => toggleItem(item._idx)}
                     style={{ accentColor: T.gold, flexShrink: 0 }} />

              <div style={{
                width: 22, height: 22, borderRadius: 5,
                background: `${cor}22`, display: "grid", placeItems: "center", flexShrink: 0,
              }}>
                {iconePorTipo[item.tipo]}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: T.ink, fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {item.descricao}
                  {item.tipo === "parcela" && item.parcela_atual && (
                    <span style={{ color: T.muted, fontWeight: 400, marginLeft: 6, fontSize: 11 }}>
                      {item.parcela_atual}/{item.parcela_total}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2, display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap", overflow: "hidden", whiteSpace: "nowrap" }}>
                  <span style={{
                    padding: "1px 6px", background: `${cor}22`, color: cor,
                    borderRadius: 3, fontWeight: 600, letterSpacing: ".05em",
                    textTransform: "uppercase", fontSize: 9,
                  }}>{labelPorTipo[item.tipo]}</span>
                  <span>{item.categoria_sugerida}</span>
                  {item.data_compra && <span>· {item.data_compra}</span>}
                  {matchBanner && (
                    <>
                      <span style={{
                        fontSize: 9, padding: "1px 6px",
                        background: "#E1F5EE", color: "#04342C",
                        borderRadius: 3, fontWeight: 700, letterSpacing: ".05em",
                        textTransform: "uppercase",
                      }}>Já existe</span>
                      <span style={{ color: T.blue || "#60a5fa", display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
                        <Link2 size={10} /> {(item._match || item._matchFixa)?.descricao}
                      </span>
                    </>
                  )}
                  {novaParcela && (
                    <span style={{
                      padding: "1px 5px", background: `${T.green}22`, color: T.green,
                      borderRadius: 3, fontWeight: 600, fontSize: 9, letterSpacing: ".05em", textTransform: "uppercase",
                    }}>NOVO</span>
                  )}
                </div>
              </div>

              <select value={item.tipo} onChange={e => mudarTipo(item._idx, e.target.value)}
                      style={{
                        padding: "3px 6px", fontSize: 10, borderRadius: 4,
                        background: T.bgSoft, color: T.ink, border: `1px solid ${T.border}`,
                        flexShrink: 0,
                      }}
                      title="Mudar tipo">
                <option value="vista">À vista</option>
                <option value="parcela">Parcela</option>
              </select>

              <div className="num" style={{
                color: T.red, fontFamily: T.serif, fontSize: 14, fontWeight: 600,
                minWidth: 90, textAlign: "right", flexShrink: 0,
              }}>
                {fmt(item.valor)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Avisos */}
      <div style={{
        marginTop: 10, padding: 10, fontSize: 11.5, color: T.muted,
        background: T.bgSoft, borderRadius: 6, lineHeight: 1.5,
      }}>
        ℹ️ <strong>Fixas</strong> criam 12 ocorrências (jan→dez), com a 1ª já marcada como paga.
        <br />
        ℹ️ <strong>Parcelas com match</strong> só marcam a parcela {analise.vencimento ? `${analise.vencimento.slice(3, 5)}` : "atual"} como paga (não duplica o parcelamento).
        <br />
        ℹ️ <strong>Parcelas novas</strong> criam o parcelamento já com as 1..N pagas (assumindo que as anteriores vieram em faturas passadas).
      </div>

      <div className="flex gap-3 justify-end mt-5">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button onClick={confirmar}
          style={{
            background: T.gold, color: T.bg, border: "none",
            padding: "10px 16px", borderRadius: 7, fontSize: 12,
            letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600,
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
          }}>
          <Check size={14} /> Importar para Planejamento
        </button>
      </div>
    </Modal>
  );
}

const normalize = (s = "") => s.toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9 ]/g, "")
  .replace(/\s+/g, " ").trim();
