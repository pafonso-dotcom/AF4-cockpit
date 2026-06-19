import React, { useState, useMemo, useRef } from "react";
import { Plus, Trash2, Edit3, Check, X, MessageCircle, MoreHorizontal } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, uid, todayISO } from "../../lib/format.js";
import MoneyInput from "../ui/MoneyInput.jsx";
import { confirm } from "../../lib/confirm.js";
import { toast } from "../../lib/toast.js";
import { whatsapp } from "../../lib/whatsapp.js";
import { getDespesasDoMes } from "../../lib/agregador.js";
import PageHeader from "../ui/PageHeader.jsx";
import Modal from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";

/**
 * Aba dedicada: A Receber (devedores) + Dívidas (a pagar).
 * Na hora de dar baixa, escolhe a conta de destino/origem e:
 *   - cria transação (receita/despesa) compensada;
 *   - ajusta saldo da conta;
 *   - marca o item como recebido/pago.
 */
export default function AReceberEDividas({
  devedores = [], setDevedores,
  dividas = [], setDividas,
  fixas = [], setFixas,
  fixaOcorrencias = [], setFixaOcorrencias,
  parcelamentos = [], setParcelamentos,
  cartoes = [],
  contas = [], setContas,
  transacoes = [], setTransacoes,
  categorias = [], setCategorias,
  metas = [], setMetas,
  hidden,
  somenteReceber = false, // quando true, esconde o lado "A Pagar" (usado na tela unificada)
  vistaInicial = "receber", // "receber" | "pagar" — qual lado abre por padrão
  embed = false, // quando true, some o cabeçalho de página (usado no hub de Planejamento)
}) {
  const [form, setForm] = useState(null);        // {tipo, ...} novo/editar
  const [baixaForm, setBaixaForm] = useState(null); // baixa de um item

  const hoje = todayISO();
  // "YYYY-MM" seguro de qualquer vencimento (string ISO, Date ou número).
  // Evita crash "x.slice is not a function" quando o dado vem fora de string.
  const ymOf = (v) => {
    if (!v) return "";
    if (typeof v === "string") return v.slice(0, 7);
    try { return new Date(v).toISOString().slice(0, 7); } catch { return ""; }
  };
  const em3d = new Date();
  em3d.setDate(em3d.getDate() + 3);
  const em3dIso = em3d.toISOString().slice(0, 10);
  const em7d = new Date();
  em7d.setDate(em7d.getDate() + 7);
  const em7dIso = em7d.toISOString().slice(0, 10);
  // Último dia do mês corrente — para o bucket "Verde · No prazo"
  const fimMes = new Date();
  fimMes.setMonth(fimMes.getMonth() + 1, 0);
  const fimMesIso = fimMes.toISOString().slice(0, 10);

  /* ===== Helpers ===== */
  const diasParaVencer = (data) => {
    if (!data) return null;
    const d = new Date(data);
    const h = new Date(hoje);
    return Math.round((d - h) / 86400000);
  };

  const dueLabel = (dataRaw) => {
    if (!dataRaw) return { txt: "Sem data", cor: T.muted, status: "none" };
    // Aceita string ISO, Date ou número — normaliza pra "YYYY-MM-DD".
    const data = typeof dataRaw === "string"
      ? dataRaw
      : (() => { try { return new Date(dataRaw).toISOString().slice(0, 10); } catch { return ""; } })();
    if (!data) return { txt: "Sem data", cor: T.muted, status: "none" };
    const dias = diasParaVencer(data);
    if (dias < 0)  return { txt: `${data.slice(8,10)}/${data.slice(5,7)} · ${dias}d`, cor: T.red,   status: "over" };
    if (dias <= 3) return { txt: `${data.slice(8,10)}/${data.slice(5,7)} · ${dias === 0 ? "hoje" : `${dias}d`}`, cor: T.gold,  status: "warn" };
    if (dias <= 7) return { txt: `${data.slice(8,10)}/${data.slice(5,7)} · ${dias}d`, cor: T.green, status: "ok-near" };
    return { txt: `${data.slice(8,10)}/${data.slice(5,7)} · ${dias}d`, cor: T.muted, status: "ok" };
  };

  /* ===== Salvar novo/editar ===== */
  const save = () => {
    if (!form.nome?.trim()) { toast.error("Nome obrigatório."); return; }
    const valor = Number(form.valor) || 0;
    if (valor <= 0) { toast.error("Valor inválido."); return; }

    // Determina N de parcelas: prioriza UI nova (form.parcelar + form.numParcelas),
    // mas mantém compat com string "1/N" no campo "parcela".
    const numFromToggle = form.parcelar ? Math.max(1, parseInt(form.numParcelas, 10) || 1) : 1;
    const matchParc = (form.parcela || "").trim().match(/^(\d+)\s*\/\s*(\d+)$/);
    const totalParc = numFromToggle > 1 ? numFromToggle : (matchParc ? parseInt(matchParc[2], 10) : 1);
    const inicioParc = matchParc ? parseInt(matchParc[1], 10) : 1;
    // Valor que vai pra cada entrada: dividir total OU usar como por-parcela
    const valorPorParcela = (form.parcelar && form.modoValor === "total" && totalParc > 1)
      ? +(valor / totalParc).toFixed(2)
      : valor;

    const data = {
      ...form,
      valor: valorPorParcela,
    };
    delete data.parcelar;
    delete data.numParcelas;
    delete data.modoValor;
    // Campos auxiliares do modal (criação inline de categoria/filha) — não persistem.
    delete data._criarCat;
    delete data._catNome;
    delete data._criarSub;
    delete data._subNome;
    delete data._aplicarEm;

    // Edição → comportamento simples: atualiza só esta entrada (não regenera parcelas)
    if (form.id) {
      const single = { ...data, valor };

      // Ocorrência de Despesa Fixa: edita só ESTA ocorrência (valor/vencimento).
      // O template da fixa e as demais ocorrências ficam intactos.
      if (form._origem === "fixa" && form._fixaOccId) {
        // Valor/vencimento: só esta ocorrência (o mês editado).
        setFixaOcorrencias?.((fixaOcorrencias || []).map(o =>
          o.id === form._fixaOccId
            ? { ...o, valor, ...(form.vencimento ? { dataVencimento: form.vencimento } : {}) }
            : o
        ));
        // Categoria/subcategoria: muda a FIXA inteira (vale para todos os meses).
        const occ = (fixaOcorrencias || []).find(o => o.id === form._fixaOccId);
        const fixaId = occ?.fixaId;
        if (fixaId && setFixas) {
          setFixas((fixas || []).map(f =>
            f.id === fixaId ? { ...f, categoria: form.categoria, subcategoria: form.subcategoria || "" } : f));
        }
        toast.success("Atualizado — categoria/subcategoria valem para todos os meses da fixa.");
        setForm(null);
        return;
      }

      // Despesa avulsa: edita a transação de origem.
      if (form._origem === "transacao" && form._transacaoId) {
        setTransacoes?.((transacoes || []).map(t =>
          t.id === form._transacaoId
            ? { ...t, descricao: form.nome, valor, categoria: form.categoria, subcategoria: form.subcategoria || "",
                ...(form.vencimento ? { vencimento: form.vencimento } : {}), obs: form.obs }
            : t
        ));
        toast.success("Despesa atualizada.");
        setForm(null);
        return;
      }

      // Parcelado: aplica os campos comuns ao grupo conforme "Aplicar mudança em".
      const escopo = form._aplicarEm || "esta";
      const grupo = single.grupoParcelamento;
      const aplicaGrupo = grupo && escopo !== "esta";
      // Campos compartilhados entre parcelas (NÃO mexe no vencimento de cada uma nem na label "X/Y").
      const comuns = {
        nome: single.nome, valor, categoria: single.categoria, subcategoria: single.subcategoria,
        credor: single.credor, telefone: single.telefone, combinado: single.combinado,
        escopo: single.escopo, obs: single.obs,
      };
      const noEscopo = (d) => {
        if (escopo === "todas") return true;
        // "futuras": só as parcelas com vencimento depois desta
        return d.vencimento && single.vencimento && d.vencimento > single.vencimento;
      };

      if (form.tipo === "receber") {
        setDevedores(devedores.map(d => {
          if (d.id === form.id) return single;
          if (!aplicaGrupo || d.grupoParcelamento !== grupo || d.recebido) return d;
          return noEscopo(d) ? { ...d, ...comuns } : d;
        }));
      } else {
        setDividas(dividas.map(d => {
          if (d.id === form.id) return single;
          if (!aplicaGrupo || d.grupoParcelamento !== grupo || d.pago) return d;
          return noEscopo(d) ? { ...d, ...comuns } : d;
        }));
      }
      toast.success(aplicaGrupo
        ? (escopo === "todas" ? "Aplicado a todas as parcelas pendentes." : "Aplicado a esta e às próximas parcelas.")
        : "Atualizado.");
      setForm(null);
      return;
    }

    if (totalParc > 1 && form.vencimento) {
      // Gera entradas restantes a partir da parcela "inicioParc"
      const novos = [];
      // Parse "YYYY-MM-DD" como data local (evita o shift de fuso do new Date string)
      const [baseY, baseM, baseD] = form.vencimento.split("-").map(Number);
      const grupoId = uid(); // pra agrupar todas as parcelas como um conjunto
      for (let i = inicioParc; i <= totalParc; i++) {
        const offset = i - inicioParc; // 1ª gerada usa o vencimento do form
        // Avança meses mantendo o dia, sem deixar 29-31 transbordar pro mês seguinte
        const alvoMes = baseM - 1 + offset;
        const venc = new Date(baseY, alvoMes, 1);
        const ultimoDia = new Date(baseY, alvoMes + 1, 0).getDate();
        venc.setDate(Math.min(baseD, ultimoDia));
        const vencISO = `${venc.getFullYear()}-${String(venc.getMonth() + 1).padStart(2, "0")}-${String(venc.getDate()).padStart(2, "0")}`;
        novos.push({
          ...data,
          id: uid(),
          parcela: `${i}/${totalParc}`,
          vencimento: vencISO,
          grupoParcelamento: grupoId,
          ...(form.tipo === "receber" ? { recebido: false } : { pago: false }),
        });
      }
      if (form.tipo === "receber") setDevedores([...devedores, ...novos]);
      else setDividas([...dividas, ...novos]);
      const valorLbl = fmt(valorPorParcela);
      toast.success(`${novos.length} parcela${novos.length > 1 ? "s" : ""} de ${valorLbl} criada${novos.length > 1 ? "s" : ""} (${inicioParc}/${totalParc} → ${totalParc}/${totalParc}).`);
      setForm(null);
      return;
    }

    // Sem parcelamento: cria uma entrada única
    if (form.tipo === "receber") {
      setDevedores([...devedores, { ...data, id: uid(), recebido: false }]);
    } else {
      setDividas([...dividas, { ...data, id: uid(), pago: false }]);
    }
    toast.success("Cadastrado.");
    setForm(null);
  };

  /* ===== Categoria / subcategoria (filha) — usar e criar no próprio modal ===== */
  // Tipo de categoria conforme o lado (receber → receita; pagar → despesa).
  const tipoCatForm = form ? (form.tipo === "receber" ? "receita" : "despesa") : "despesa";
  // Categoria selecionada no form e suas filhas.
  const catObjForm = form ? (categorias || []).find(c => c.nome === form.categoria && c.tipo === tipoCatForm) : null;
  const subsForm = catObjForm?.subcategorias || [];

  const criarCategoria = (nomeRaw) => {
    const nm = (nomeRaw || "").trim();
    if (!nm) return;
    const existe = (categorias || []).find(c => (c.nome || "").toLowerCase() === nm.toLowerCase() && c.tipo === tipoCatForm);
    if (existe) {
      toast.info(`Categoria "${nm}" já existe — selecionada.`);
      setForm(f => ({ ...f, categoria: existe.nome, subcategoria: "", _criarCat: false, _catNome: "" }));
      return;
    }
    if (!setCategorias) { toast.error("Não foi possível criar categoria aqui."); return; }
    const nova = { id: uid(), nome: nm, tipo: tipoCatForm, escopo: form.escopo || "pessoal", cor: T.gold, limite: null, subcategorias: [] };
    setCategorias([...(categorias || []), nova]);
    setForm(f => ({ ...f, categoria: nm, subcategoria: "", _criarCat: false, _catNome: "" }));
    toast.success(`Categoria "${nm}" criada.`);
  };

  const criarSubcategoria = (nomeRaw) => {
    const nm = (nomeRaw || "").trim();
    if (!nm) return;
    if (!catObjForm) { toast.error("Escolha (ou crie) a categoria primeiro."); return; }
    if ((catObjForm.subcategorias || []).some(s => (s.nome || "").toLowerCase() === nm.toLowerCase())) {
      toast.info(`Subcategoria "${nm}" já existe — selecionada.`);
      setForm(f => ({ ...f, subcategoria: nm, _criarSub: false, _subNome: "" }));
      return;
    }
    if (!setCategorias) { toast.error("Não foi possível criar subcategoria aqui."); return; }
    setCategorias((categorias || []).map(c =>
      c.id === catObjForm.id ? { ...c, subcategorias: [...(c.subcategorias || []), { id: uid(), nome: nm }] } : c));
    setForm(f => ({ ...f, subcategoria: nm, _criarSub: false, _subNome: "" }));
    toast.success(`Subcategoria "${nm}" criada em ${catObjForm.nome}.`);
  };

  const excluir = async (item, tipo) => {
    // Parcela de cartão: não dá pra "apagar 1 parcela" sem recalcular
    // fatura/limite — direciona pro Cartões (onde se exclui o parcelamento todo).
    if (item._origem === "parcela") {
      toast.info("Remova o parcelamento em Cartões.");
      return;
    }

    // Ocorrência de Despesa Fixa: remove SÓ aquela do mês (as outras 11 ficam).
    if (item._origem === "fixa" && item._fixaOccId) {
      const ok = await confirm({
        title: `Excluir "${item.nome}" (${item.obs || "este mês"})?`,
        body: "Remove só esta ocorrência do mês. As demais cobranças da fixa continuam. Pode desfazer logo após.",
        danger: true, confirmLabel: "Excluir só este mês",
      });
      if (!ok) return;
      const backupOcc = fixaOcorrencias;
      setFixaOcorrencias?.((fixaOcorrencias || []).filter(o => o.id !== item._fixaOccId));
      toast.success(`"${item.nome}" (${item.obs || "este mês"}) excluído.`, {
        action: { label: "Desfazer", onClick: () => setFixaOcorrencias?.(backupOcc) },
      });
      return;
    }

    // Despesa avulsa: o item virtual É uma transação — remove a transação.
    if (item._origem === "transacao" && item._transacaoId) {
      const ok = await confirm({
        title: `Excluir "${item.nome}"?`,
        body: "Remove a despesa de Transações. Pode desfazer logo após.",
        danger: true, confirmLabel: "Excluir",
      });
      if (!ok) return;
      const backupTx = transacoes;
      setTransacoes?.((transacoes || []).filter(t => t.id !== item._transacaoId));
      toast.success(`"${item.nome}" excluído.`, {
        action: { label: "Desfazer", onClick: () => setTransacoes?.(backupTx) },
      });
      return;
    }

    // Dívida/recebimento tradicional.
    const ok = await confirm({
      title: `Excluir "${item.nome}"?`,
      body: "A entrada será removida — você pode desfazer logo após.",
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    const backupDev = devedores;
    const backupDiv = dividas;
    if (tipo === "receber") setDevedores(devedores.filter(d => d.id !== item.id));
    else setDividas(dividas.filter(d => d.id !== item.id));
    toast.success(`"${item.nome}" excluído.`, {
      action: {
        label: "Desfazer",
        onClick: () => { setDevedores(backupDev); setDividas(backupDiv); },
      },
    });
  };

  /* ===== Baixa: cria transação + atualiza conta + marca como recebido/pago ===== */
  const confirmarBaixa = () => {
    if (!baixaForm.contaDestino) { toast.error("Selecione a conta."); return; }
    const conta = contas.find(c => c.nome === baixaForm.contaDestino);
    if (!conta) { toast.error("Conta não encontrada."); return; }

    const isReceber = baixaForm.tipoOriginal === "receber";

    // ===== Recebimento parcial (só A Receber) =====
    // Saldo em aberto = total original − já recebido (backward-compat: undefined → 0)
    const saldoAberto = isReceber
      ? Math.max(0, (parseFloat(baixaForm.valorTotalOriginal) || parseFloat(baixaForm.valor) || 0) - (parseFloat(baixaForm.jaRecebido) || 0))
      : 0;
    const ehParcial = isReceber && baixaForm.parcial;

    // Valor da baixa: no parcial usa valorParcial; senão o saldo em aberto/valor do form
    let valor = ehParcial
      ? (Number(baixaForm.valorParcial) || 0)
      : (parseFloat(baixaForm.valor) || 0);

    if (ehParcial) {
      if (!(valor > 0)) { toast.error("Informe um valor parcial válido."); return; }
      if (valor > saldoAberto + 0.005) { toast.error(`Valor maior que o saldo em aberto (${fmt(saldoAberto)}).`); return; }
      valor = +valor.toFixed(2);
    }

    // Quita o restante? (parcial que cobre tudo é tratado como baixa total)
    const quitaTudo = !isReceber || !ehParcial || valor >= saldoAberto - 0.005;

    // Caso ESPECIAL: APORTE DE META (poupança, não despesa).
    // O dinheiro NÃO é gasto — é transferido da conta de origem pra uma
    // conta-cofrinho da meta. Patrimônio fica intacto; só realoca.
    // Vira despesa real só quando a meta for usada (resgate — fase futura).
    if (!isReceber && baixaForm._origem === "fixa" && baixaForm._metaId) {
      // Não deixa a conta de origem ficar negativa.
      if ((parseFloat(conta.saldo) || 0) < valor - 0.005) {
        toast.error(`Saldo insuficiente em ${conta.nome} (${fmt(conta.saldo)}) pra guardar ${fmt(valor)}.`);
        return;
      }
      const meta = (metas || []).find(m => m.id === baixaForm._metaId);
      const cofreNome = `🐷 ${baixaForm._metaNome || meta?.nome || "Meta"}`;
      // Acha o cofrinho pelo vínculo estável (id da meta); cai no nome só
      // por compat. Evita criar cofrinho duplicado se a meta foi renomeada.
      let cofre = contas.find(c => c._cofreMetaId === baixaForm._metaId)
        || contas.find(c => c.nome === cofreNome);

      // Cria o cofrinho na primeira vez (conta tipo poupança, saldo 0).
      const transferId = uid();
      let novasContas;
      if (!cofre) {
        const novoCofre = {
          id: uid(), nome: cofreNome, instituicao: "Cofrinho",
          tipo: "poupanca", escopo: conta.escopo || "pessoal",
          saldo: 0, cor: T.gold, _cofreMetaId: baixaForm._metaId,
        };
        novasContas = [...contas, novoCofre];
        cofre = novoCofre;
      } else {
        novasContas = contas;
      }
      // Transfere: debita origem, credita cofrinho.
      setContas(novasContas.map(c => {
        if (c.id === conta.id)  return { ...c, saldo: (parseFloat(c.saldo) || 0) - valor };
        if (c.id === cofre.id)  return { ...c, saldo: (parseFloat(c.saldo) || 0) + valor };
        return c;
      }));

      // Par de transações marcado como transferência (não conta como gasto).
      const catTransf = (categorias || []).find(c => /transfer/i.test(c.nome || ""))?.nome || "";
      const txSaida = {
        id: uid(), tipo: "despesa", valor, descricao: `Aporte meta: ${baixaForm._metaNome || meta?.nome || ""}`.trim(),
        categoria: catTransf, conta: baixaForm.contaDestino, data: baixaForm.dataBaixa,
        compensado: true, fixa: false, vencimento: null,
        transferenciaId: transferId, obs: baixaForm.obs || `Poupança da meta (${baixaForm.obs || ""})`.trim(),
      };
      const txEntrada = {
        id: uid(), tipo: "receita", valor, descricao: `Aporte em ${cofreNome}`,
        categoria: catTransf, conta: cofreNome, data: baixaForm.dataBaixa,
        compensado: true, fixa: false, vencimento: null,
        transferenciaId: transferId, obs: baixaForm.obs || "Poupança de meta",
      };
      setTransacoes([txSaida, txEntrada, ...transacoes]);

      // Acumula na meta (atual += valor).
      setMetas?.((metas || []).map(m => m.id === baixaForm._metaId
        ? { ...m, atual: +(((parseFloat(m.atual) || 0) + valor)).toFixed(2) }
        : m));

      // Marca a ocorrência da fixa como paga (pra sair de "A Pagar").
      setFixaOcorrencias?.((fixaOcorrencias || []).map(o =>
        o.id === baixaForm._fixaOccId
          ? { ...o, status: "paga", dataPagamento: baixaForm.dataBaixa, valorPago: valor, transacaoId: txSaida.id }
          : o
      ));

      toast.success(`Guardado ${fmt(valor)} em "${cofreNome}". Patrimônio mantido — é poupança, não gasto.`);
      setBaixaForm(null);
      return;
    }

    // Caso ESPECIAL: despesa avulsa já É uma transação — não cria outra.
    // Apenas marca a transação existente como compensada e debita a conta.
    if (!isReceber && baixaForm._origem === "transacao" && baixaForm._transacaoId) {
      setTransacoes(transacoes.map(t => t.id === baixaForm._transacaoId
        ? { ...t, compensado: true, conta: baixaForm.contaDestino, data: baixaForm.dataBaixa, obs: baixaForm.obs || t.obs }
        : t));
      setContas(contas.map(c => c.id === conta.id ? { ...c, saldo: (parseFloat(c.saldo) || 0) - valor } : c));
      toast.success(`Pago ${fmt(valor)} de ${baixaForm.contaDestino}. Saldo atualizado.`);
      setBaixaForm(null);
      return;
    }

    // Vínculo de origem: pagamento de fixa/parcela/dívida carrega a referência
    // da fonte, para o agregador NÃO contar a despesa duas vezes (a fonte já é
    // contada). Sem isto, "Pagamento para LUZ" entrava em Variáveis além da Fixa.
    const origemLink = isReceber ? {}
      : baixaForm._origem === "fixa"    && baixaForm._fixaOccId      ? { origemFixaOcorrenciaId: baixaForm._fixaOccId }
      : baixaForm._origem === "parcela" && baixaForm._parcelamentoId ? { origemParcelamentoId: baixaForm._parcelamentoId }
      : baixaForm._origem === "divida"                              ? { origemDividaId: baixaForm.itemId }
      : {};

    // 1) Cria transação
    const novaTransacao = {
      id: uid(),
      tipo: isReceber ? "receita" : "despesa",
      descricao: isReceber
        ? `Recebimento de ${baixaForm.nome}`
        : `Pagamento para ${baixaForm.nome}`,
      categoria: baixaForm.categoria || (isReceber ? "Outros" : "Outros"),
      conta: baixaForm.contaDestino,
      data: baixaForm.dataBaixa,
      valor,
      compensado: true,
      fixa: false,
      ...origemLink,
      obs: baixaForm.obs || `Baixa automática${baixaForm.parcela ? ` (${baixaForm.parcela})` : ""}${(isReceber && ehParcial && !quitaTudo) ? " · parcial" : ""}`,
    };
    setTransacoes([novaTransacao, ...transacoes]);

    // 2) Ajusta saldo da conta
    const delta = isReceber ? +valor : -valor;
    setContas(contas.map(c => c.id === conta.id ? { ...c, saldo: (parseFloat(c.saldo) || 0) + delta } : c));

    // 3) Marca como recebido/pago — dispatch baseado em origem
    if (isReceber && ehParcial && !quitaTudo) {
      // Recebimento parcial: acumula valorRecebido, registra no histórico, mantém aberto
      setDevedores(devedores.map(d => {
        if (d.id !== baixaForm.itemId) return d;
        const acumulado = +(((parseFloat(d.valorRecebido) || 0) + valor)).toFixed(2);
        const recebimentos = [
          ...(Array.isArray(d.recebimentos) ? d.recebimentos : []),
          { id: uid(), valor, data: baixaForm.dataBaixa, conta: baixaForm.contaDestino, ts: Date.now() },
        ];
        return { ...d, valorRecebido: acumulado, recebimentos };
      }));
    } else if (isReceber) {
      // Baixa total (inclui parcial que quita o resto): fecha o item e zera o saldo em aberto
      setDevedores(devedores.map(d => {
        if (d.id !== baixaForm.itemId) return d;
        const recebimentos = ehParcial
          ? [
              ...(Array.isArray(d.recebimentos) ? d.recebimentos : []),
              { id: uid(), valor, data: baixaForm.dataBaixa, conta: baixaForm.contaDestino, ts: Date.now() },
            ]
          : d.recebimentos;
        const valorRecebido = ehParcial
          ? +(((parseFloat(d.valorRecebido) || 0) + valor)).toFixed(2)
          : d.valorRecebido;
        return {
          ...d, recebido: true,
          dataRecebimento: baixaForm.dataBaixa,
          contaRecebimento: baixaForm.contaDestino,
          ...(recebimentos ? { recebimentos } : {}),
          ...(valorRecebido != null ? { valorRecebido } : {}),
        };
      }));
    } else if (baixaForm._origem === "fixa" && baixaForm._fixaOccId) {
      // Marca a ocorrência da fixa como paga (formato compatível com DespesasFixas.jsx)
      setFixaOcorrencias?.((fixaOcorrencias || []).map(o =>
        o.id === baixaForm._fixaOccId
          ? { ...o, status: "paga", dataPagamento: baixaForm.dataBaixa, valorPago: valor, transacaoId: novaTransacao.id }
          : o
      ));
    } else if (baixaForm._origem === "parcela" && baixaForm._parcelamentoId && baixaForm._parcelaN) {
      // Adiciona N à parcelasPagas do parcelamento
      setParcelamentos?.((parcelamentos || []).map(p => {
        if (p.id !== baixaForm._parcelamentoId) return p;
        const set = new Set(p.parcelasPagas || []);
        set.add(baixaForm._parcelaN);
        return { ...p, parcelasPagas: Array.from(set).sort((a, b) => a - b) };
      }));
    } else {
      // Dívida tradicional
      setDividas(dividas.map(d => d.id === baixaForm.itemId ? { ...d, pago: true, dataPagamento: baixaForm.dataBaixa, contaPagamento: baixaForm.contaDestino } : d));
    }

    if (isReceber && ehParcial && !quitaTudo) {
      const falta = +(saldoAberto - valor).toFixed(2);
      toast.success(`Recebido ${fmt(valor)} · falta ${fmt(falta)} de ${baixaForm.nome}.`);
    } else {
      toast.success(
        isReceber
          ? `Recebido ${fmt(valor)} em ${baixaForm.contaDestino}. Saldo atualizado.`
          : `Pago ${fmt(valor)} de ${baixaForm.contaDestino}. Saldo atualizado.`
      );
    }
    setBaixaForm(null);
  };

  /* ===== Render ===== */
  const devAbertos = devedores.filter(d => !d.recebido);

  // Dívidas tradicionais (pago=false)
  const dividasReais = dividas.filter(d => !d.pago);

  // Despesas Fixas pendentes — gera items virtuais "a pagar"
  // pra cada fixaOcorrencia com status pendente. Inclui o nome da fixa.
  const fixasComoDivida = useMemo(() => {
    return (fixaOcorrencias || [])
      .filter(o => o.status === "pendente")
      .map(o => {
        const fixa = (fixas || []).find(f => f.id === o.fixaId);
        // Fixa atrelada a uma meta = poupança automática. A baixa vira APORTE
        // (transferência pro cofrinho da meta), não uma despesa.
        const metaId = fixa?.metaId || null;
        const meta = metaId ? (metas || []).find(m => m.id === metaId) : null;
        return {
          id: `fixa:${o.id}`,
          nome: fixa ? fixa.descricao : "Despesa fixa",
          valor: Number(o.valor || 0),
          vencimento: o.dataVencimento,
          categoria: fixa?.categoria || "Despesas fixas",
          subcategoria: fixa?.subcategoria || "",
          obs: `Ref. ${o.mes}`,
          pago: false,
          credor: fixa?.credor || "",
          _origem: "fixa",
          _fixaOccId: o.id,
          // Sinaliza aporte de meta (só quando a meta ainda existe)
          _metaId: meta ? metaId : null,
          _metaNome: meta ? meta.nome : null,
        };
      });
  }, [fixaOcorrencias, fixas, metas]);

  // Parcelas de cartão pendentes — gera items virtuais pra cada
  // parcela ainda não marcada como paga.
  const parcelasComoDivida = useMemo(() => {
    const lista = [];
    (parcelamentos || []).forEach(p => {
      const total = p.totalParcelas || 0;
      if (total <= 0) return;
      const valorPorParcela = (p.valorTotal || 0) / total;
      const pagas = new Set(p.parcelasPagas || []);
      const base = p.dataPrimeira || p.dataCompra;
      if (!base) return;
      const [bY, bM, bD] = base.split("-").map(Number);
      const startMonth = p.dataPrimeira ? bM : bM + 1;
      const cartao = (cartoes || []).find(c => c.id === p.cartaoId);

      for (let n = 1; n <= total; n++) {
        if (pagas.has(n)) continue;
        const offset = n - 1;
        const dt = new Date(bY, startMonth - 1 + offset, 1);
        const ultDia = new Date(bY, startMonth + offset, 0).getDate();
        dt.setDate(Math.min(bD, ultDia));
        const vencISO = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        lista.push({
          id: `parc:${p.id}:${n}`,
          nome: p.descricao || "Parcela",
          valor: valorPorParcela,
          vencimento: vencISO,
          categoria: p.categoria || "Cartão",
          obs: `${n}/${total}${cartao ? ` · ${cartao.nome}` : ""}`,
          parcela: `${n}/${total}`,
          pago: false,
          credor: cartao?.nome || "",
          _origem: "parcela",
          _parcelamentoId: p.id,
          _parcelaN: n,
        });
      }
    });
    return lista;
  }, [parcelamentos, cartoes]);

  // Despesas avulsas (transações de despesa ainda NÃO compensadas) — itens
  // virtuais "a pagar". Ao baixar, a própria transação é marcada como paga
  // (não cria outra). Ignora transações de origem fixa/parcela (já cobertas
  // acima) pra não duplicar.
  const despesasAvulsas = useMemo(() => {
    return (transacoes || [])
      .filter(t => t.tipo === "despesa" && !t.compensado
        && !t.origemFixaOcorrenciaId && !t.origemParcelamentoId)
      .map(t => ({
        id: `tx:${t.id}`,
        nome: t.descricao || "Despesa",
        valor: Number(t.valor || 0),
        vencimento: t.vencimento || t.data,
        categoria: t.categoria || "Outros",
        subcategoria: t.subcategoria || "",
        obs: t.obs || "",
        pago: false,
        credor: "",
        _origem: "transacao",
        _transacaoId: t.id,
      }));
  }, [transacoes]);

  // Lista unificada (mantém nome legado divAbertas pro resto do componente).
  const divAbertas = useMemo(
    () => [...dividasReais, ...fixasComoDivida, ...parcelasComoDivida, ...despesasAvulsas],
    [dividas, fixasComoDivida, parcelasComoDivida, despesasAvulsas]
  );

  // Mês corrente como tab default; tabs derivam de todos os vencimentos abertos
  const todosVencimentos = [...devAbertos, ...divAbertas]
    .map(d => d.vencimento)
    .filter(Boolean);
  const mesesDisponiveis = useMemo(() => {
    const set = new Set(todosVencimentos.map(ymOf).filter(Boolean));
    set.add(hoje.slice(0, 7));
    return [...set].sort();
  }, [todosVencimentos.join(","), hoje]);
  const [mesAtivo, setMesAtivo] = useState(""); // "" = Geral (todos os meses)
  const [vista, setVista] = useState(vistaInicial === "pagar" ? "pagar" : "receber"); // "receber" | "pagar"

  const filtroMes = (item) => {
    if (!mesAtivo) return true;
    if (!item.vencimento) return mesAtivo === hoje.slice(0, 7); // sem data → cai no mês corrente
    return ymOf(item.vencimento) === mesAtivo;
  };

  // Ordena por data de vencimento (mais próxima primeiro); sem data vai pro fim.
  const ordenarPorData = (a, b) => (a.vencimento || "9999-12-31").localeCompare(b.vencimento || "9999-12-31");
  const receberMes = devAbertos.filter(filtroMes).sort(ordenarPorData);
  const pagarMes   = divAbertas.filter(filtroMes).sort(ordenarPorData);

  // Alertas globais (todos os meses)
  const totaisAlerta = {
    over: {
      receber: devAbertos.filter(d => d.vencimento && d.vencimento < hoje),
      pagar:   divAbertas.filter(d => d.vencimento && d.vencimento < hoje),
    },
    warn: {
      receber: devAbertos.filter(d => d.vencimento && d.vencimento >= hoje && d.vencimento <= em3dIso),
      pagar:   divAbertas.filter(d => d.vencimento && d.vencimento >= hoje && d.vencimento <= em3dIso),
    },
    ok: {
      receber: devAbertos.filter(d => d.vencimento && d.vencimento > em3dIso && d.vencimento <= fimMesIso),
      pagar:   divAbertas.filter(d => d.vencimento && d.vencimento > em3dIso && d.vencimento <= fimMesIso),
    },
  };

  const somaArr = (arr) => arr.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
  // Quanto ainda FALTA receber de um item (total − já recebido parcial).
  const aReceberDe = (d) => Math.max(0, (parseFloat(d.valor) || 0) - (parseFloat(d.valorRecebido) || 0));
  const somaAReceber = (arr) => arr.reduce((s, d) => s + aReceberDe(d), 0);

  // ===== Visão Geral · todos os meses =====
  // "A receber" usa o saldo em aberto (desconta o que já foi recebido parcialmente).
  const totalReceberAberto = somaAReceber(devAbertos);
  const totalPagarAberto   = somaArr(divAbertas);
  const saldoPrevisto      = totalReceberAberto - totalPagarAberto;

  // Resumo de despesas do mês selecionado: Total a pagar / Pagas / Falta pagar.
  const resumoPagarMes = useMemo(() => {
    if (!mesAtivo) return null;
    const st = { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes };
    let desp = [];
    try { desp = getDespesasDoMes(mesAtivo, st); } catch {}
    const total = desp.reduce((s, d) => s + (Number(d.valor) || 0), 0);
    const pagas = desp.filter(d => d.status === "paga").reduce((s, d) => s + (Number(d.valor) || 0), 0);
    return { total, pagas, falta: +(total - pagas).toFixed(2) };
  }, [mesAtivo, transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes]);

  // Itens JÁ PAGOS do mês (para a vista "Pagas").
  const pagasMes = useMemo(() => {
    const st = { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes };
    const mes = mesAtivo || hoje.slice(0, 7);
    let desp = [];
    try { desp = getDespesasDoMes(mes, st); } catch {}
    return desp.filter(d => d.status === "paga").sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [mesAtivo, transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, hoje]);
  const totalPagasMes = useMemo(() => pagasMes.reduce((s, d) => s + (Number(d.valor) || 0), 0), [pagasMes]);

  // Desfazer o pagamento de um item já pago (volta para "A Pagar" e devolve o
  // valor à conta quando houver transação ligada). Permite retificar.
  const desfazerPagamento = async (item) => {
    const ok = await confirm({
      title: `Desfazer pagamento de "${item.descricao}"?`,
      body: "O item volta para 'A Pagar' (pendente) e, se tiver baixa em conta, o valor é devolvido. Aí podes corrigir e pagar de novo.",
      confirmLabel: "Desfazer", danger: true,
    });
    if (!ok) return;

    // Devolve saldo + remove a transação de baixa ligada (quando existir).
    const devolverSaldoEremover = (txId) => {
      if (!txId) return;
      const tx = (transacoes || []).find(t => t.id === txId);
      if (tx && tx.compensado && tx.conta) {
        setContas((contas || []).map(c => c.nome === tx.conta ? { ...c, saldo: (Number(c.saldo) || 0) + (Number(tx.valor) || 0) } : c));
      }
      setTransacoes((transacoes || []).filter(t => t.id !== txId));
    };

    if (item.fonte === "fixa") {
      const occ = (fixaOcorrencias || []).find(o => o.id === item.id);
      devolverSaldoEremover(occ?.transacaoId);
      setFixaOcorrencias?.((fixaOcorrencias || []).map(o =>
        o.id === item.id ? { ...o, status: "pendente", dataPagamento: null, valorPago: null, transacaoId: null } : o));
    } else if (item.fonte === "parcela") {
      const [parcId, numStr] = String(item.id).split("::");
      const numero = parseInt(numStr, 10);
      setParcelamentos?.((parcelamentos || []).map(p =>
        p.id === parcId ? { ...p, parcelasPagas: (p.parcelasPagas || []).filter(n => n !== numero) } : p));
    } else if (item.fonte === "divida") {
      setDividas((dividas || []).map(d => d.id === item.id ? { ...d, pago: false, dataPagamento: null, contaPagamento: null } : d));
    } else if (item.fonte === "transacao") {
      const tx = (transacoes || []).find(t => t.id === item.id);
      if (tx && tx.conta) {
        setContas((contas || []).map(c => c.nome === tx.conta ? { ...c, saldo: (Number(c.saldo) || 0) + (Number(tx.valor) || 0) } : c));
      }
      setTransacoes((transacoes || []).map(t => t.id === item.id ? { ...t, compensado: false } : t));
    }
    toast.success(`"${item.descricao}" voltou para A Pagar.`);
  };

  // Recebido / pago no mês corrente (cruza com transações geradas via confirmarBaixa)
  const mesCorrenteISO = hoje.slice(0, 7);
  const baixadosNoMes = (transacoes || []).filter(t =>
    t.compensado && (t.data || "").startsWith(mesCorrenteISO) &&
    (t.descricao?.startsWith("Recebimento de") || t.descricao?.startsWith("Pagamento para"))
  );
  const recebidoNoMes = baixadosNoMes
    .filter(t => t.tipo === "receita")
    .reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
  const pagoNoMes = baixadosNoMes
    .filter(t => t.tipo === "despesa")
    .reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);

  const totalOver = somaArr(totaisAlerta.over.receber) + somaArr(totaisAlerta.over.pagar);
  const totalWarn = somaArr(totaisAlerta.warn.receber) + somaArr(totaisAlerta.warn.pagar);
  const countOver = totaisAlerta.over.receber.length + totaisAlerta.over.pagar.length;
  const countWarn = totaisAlerta.warn.receber.length + totaisAlerta.warn.pagar.length;
  const countOk   = totaisAlerta.ok.receber.length   + totaisAlerta.ok.pagar.length;

  const mesLabel = (ym) => {
    if (!ym) return "—";
    const [y, m] = ym.split("-");
    const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    return `${nomes[parseInt(m,10)-1]}/${y.slice(2)}`;
  };

  return (
    <div className={(embed || somenteReceber) ? "" : "fade-up py-8 px-6"}>
      {embed ? (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <button className="btn-ghost" onClick={() => setForm({
            id: null, tipo: "receber", nome: "", valor: "", vencimento: "",
            categoria: "Outros", obs: "", parcela: "",
            parcelar: false, numParcelas: 3, modoValor: "total",
          })}>
            <Plus size={13} className="inline mr-1.5" /> Recebimento
          </button>
          <button className="btn-gold" onClick={() => setForm({
            id: null, tipo: "dividas", nome: "", valor: "", vencimento: "",
            categoria: "Outros", escopo: "pessoal", obs: "", parcela: "",
            parcelar: false, numParcelas: 3, modoValor: "total",
          })}>
            <Plus size={13} className="inline mr-1.5" /> Compromisso
          </button>
        </div>
      ) : somenteReceber ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button className="btn-ghost" onClick={() => setForm({
            id: null, tipo: "receber", nome: "", valor: "", vencimento: "",
            categoria: "Outros", obs: "", parcela: "",
            parcelar: false, numParcelas: 3, modoValor: "total",
          })}>
            <Plus size={13} className="inline mr-1.5" /> Recebimento
          </button>
        </div>
      ) : (
      <PageHeader
        eyebrow="Finanças · Compromissos"
        title={<>A Receber & <em>Dívidas.</em></>}
        sub="Recebimentos futuros e dívidas a pagar. Na baixa, o dinheiro vai/sai da conta escolhida e vira transação automaticamente."
        action={
          <div className="flex gap-2 flex-wrap">
            <button className="btn-ghost" onClick={() => setForm({
              id: null, tipo: "receber", nome: "", valor: "", vencimento: "",
              categoria: "Outros", obs: "", parcela: "",
              parcelar: false, numParcelas: 3, modoValor: "total",
            })}>
              <Plus size={13} className="inline mr-1.5" /> Recebimento
            </button>
            <button className="btn-gold" onClick={() => setForm({
              id: null, tipo: "dividas", nome: "", valor: "", vencimento: "",
              categoria: "Outros", escopo: "pessoal", obs: "", parcela: "",
              parcelar: false, numParcelas: 3, modoValor: "total",
            })}>
              <Plus size={13} className="inline mr-1.5" /> Compromisso
            </button>
          </div>
        }
      />
      )}

      {/* ===== Visão geral · todos os meses (oculta quando embutido) ===== */}
      {!embed && (() => {
        const totalReceber = devAbertos.reduce((s, d) => s + aReceberDe(d), 0);
        const totalPagar   = divAbertas.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
        const saldoPrevisto = totalReceber - totalPagar;
        // Recebido/pago no mês corrente — soma das baixas (transações origemLoja: cheque-compensado / itens marcados)
        const ymAtual = hoje.slice(0, 7);
        const recebidoMes = devedores
          .filter(d => d.recebido && (d.dataRecebimento || "").startsWith(ymAtual))
          .reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
        const pagoMes = dividas
          .filter(d => d.pago && (d.dataPagamento || "").startsWith(ymAtual))
          .reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
        const baixasMes = recebidoMes + pagoMes;

        return (
          <div style={{
            border: `1px solid ${T.gold}66`,
            borderRadius: 16,
            padding: 10,
            marginBottom: 12,
            background: `linear-gradient(135deg, ${T.gold}08, transparent)`,
          }}>
            <div style={{
              fontSize: 9.5, letterSpacing: ".2em", textTransform: "uppercase",
              color: T.gold, fontWeight: 600, marginBottom: 12,
            }}>
              📊 Visão geral · todos os meses
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <VisaoCard label="Total a receber" valor={hidden ? null : totalReceber}
                         sub={`${devAbertos.length} aberto${devAbertos.length === 1 ? "" : "s"}`} cor={T.green} />
              <VisaoCard label="Total a pagar" valor={hidden ? null : totalPagar}
                         sub={`${divAbertas.length} aberto${divAbertas.length === 1 ? "" : "s"}`} cor={T.red} />
              <VisaoCard label="Saldo previsto" valor={hidden ? null : saldoPrevisto}
                         sub="receber − pagar" cor={saldoPrevisto >= 0 ? T.gold : T.red} />
              <VisaoCard label={`Baixas (${ymAtual})`} valor={hidden ? null : baixasMes}
                         sub={`recebido ${fmt(recebidoMes)} · pago ${fmt(pagoMes)}`} cor={T.muted} small />
            </div>
          </div>
        );
      })()}

      {/* Painel de alertas — Vermelho · Amarelo · Verde (oculto quando embutido) */}
      {!embed && (
      <div className="grid grid-cols-3 gap-2 mb-3">
        <AlertCard
          cor={T.red}
          titulo="Vencidos"
          count={countOver}
          valor={hidden ? null : totalOver}
          sub={`${totaisAlerta.over.receber.length} a receber · ${totaisAlerta.over.pagar.length} a pagar`}
          icone="🔴"
          actions={countOver > 0 ? [
            {
              label: "📱 Cobrar / Lembrar",
              icon: "📱",
              title: "Disparar mensagens no WhatsApp para todos os itens vencidos",
              onClick: () => {
                const todos = [...totaisAlerta.over.receber, ...totaisAlerta.over.pagar];
                if (todos.length === 0) return;
                todos.forEach((item, i) => {
                  setTimeout(() => {
                    const isReceber = devAbertos.includes(item);
                    if (isReceber) whatsapp.cobrarDevedor(item);
                    else whatsapp.cobrarDivida(item);
                  }, i * 250);
                });
                toast.success(`Abrindo ${todos.length} conversa${todos.length > 1 ? "s" : ""} no WhatsApp.`);
              },
            },
            {
              label: "✓ Marcar pago / receber",
              icon: "✓",
              title: "Abre o modal de baixa para o item vencido mais antigo",
              onClick: () => {
                const proximo = [...totaisAlerta.over.receber, ...totaisAlerta.over.pagar]
                  .sort((a, b) => String(a.vencimento || "").localeCompare(String(b.vencimento || "")))[0];
                if (!proximo) return;
                const isReceber = devAbertos.includes(proximo);
                setBaixaForm({
                  itemId: proximo.id,
                  tipoOriginal: isReceber ? "receber" : "dividas",
                  nome: proximo.nome,
                  valor: proximo.valor,
                  categoria: proximo.categoria || "Outros",
                  obs: proximo.obs || "",
                  parcela: proximo.parcela || "",
                  contaDestino: contas[0]?.nome || "",
                  dataBaixa: hoje,
                  _origem: proximo._origem || "divida",
                  _fixaOccId: proximo._fixaOccId || null,
                  _parcelamentoId: proximo._parcelamentoId || null,
                  _parcelaN: proximo._parcelaN || null,
                  _transacaoId: proximo._transacaoId || null,
                });
              },
            },
          ] : null}
        />
        <AlertCard
          cor={T.gold}
          titulo="Vence em até 3 dias"
          count={countWarn}
          valor={hidden ? null : totalWarn}
          sub={`${totaisAlerta.warn.receber.length} a receber · ${totaisAlerta.warn.pagar.length} a pagar`}
          icone="🟡"
        />
        <AlertCard
          cor={T.green}
          titulo="No prazo (este mês)"
          count={countOk}
          valor={null}
          sub={`${totaisAlerta.ok.receber.length} a receber · ${totaisAlerta.ok.pagar.length} a pagar`}
          icone="🟢"
        />
      </div>
      )}

      {/* Tabs por mês */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10, overflowX: "auto", paddingBottom: 3 }}>
        {(() => {
          const ativo = mesAtivo === "";
          const totalGeral = devAbertos.length + divAbertas.length;
          return (
            <button key="__geral" onClick={() => setMesAtivo("")}
              style={{
                padding: "5px 10px", fontSize: 10.5, letterSpacing: ".05em",
                background: ativo ? T.gold : T.bgSoft, color: ativo ? T.bg : T.muted,
                border: `1px solid ${ativo ? T.gold : T.border}`,
                borderRadius: 11, cursor: "pointer", fontWeight: ativo ? 700 : 500,
                whiteSpace: "nowrap", textTransform: "uppercase",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>
              📊 Geral
              {totalGeral > 0 && (
                <span style={{
                  fontSize: 9.5, padding: "1px 6px", borderRadius: 100,
                  background: ativo ? T.bg : T.border, color: ativo ? T.gold : T.muted, fontWeight: 600,
                }}>{totalGeral}</span>
              )}
            </button>
          );
        })()}
        {mesesDisponiveis.map(ym => {
          const ativo = ym === mesAtivo;
          const countNoMes =
            devAbertos.filter(d => ymOf(d.vencimento) === ym).length +
            divAbertas.filter(d => ymOf(d.vencimento) === ym).length;
          return (
            <button key={ym} onClick={() => setMesAtivo(ym)}
              style={{
                padding: "5px 10px", fontSize: 10.5, letterSpacing: ".05em",
                background: ativo ? T.gold : T.bgSoft, color: ativo ? T.bg : T.muted,
                border: `1px solid ${ativo ? T.gold : T.border}`,
                borderRadius: 11, cursor: "pointer", fontWeight: ativo ? 700 : 500,
                whiteSpace: "nowrap", textTransform: "uppercase",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>
              {mesLabel(ym)}
              {countNoMes > 0 && (
                <span style={{
                  fontSize: 9.5, padding: "1px 6px", borderRadius: 100,
                  background: ativo ? T.bg : T.border, color: ativo ? T.gold : T.muted, fontWeight: 600,
                }}>{countNoMes}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Toggle: A Receber | A Pagar (escondido quando embutido na tela unificada) */}
      {!somenteReceber && (
      <div role="tablist" style={{ display: "flex", gap: 2, marginBottom: 12, borderBottom: `1px solid ${T.border}`, overflowX: "auto" }}>
        {[
          { id: "receber", label: `💰 A Receber (${receberMes.length})`, cor: T.green },
          { id: "pagar",   label: `⚠️ A Pagar (${pagarMes.length})`,    cor: T.red   },
          { id: "pagas",   label: `✅ Pagas (${pagasMes.length})`,       cor: T.green },
        ].map(t => {
          const ativo = vista === t.id;
          return (
            <button key={t.id} role="tab" aria-selected={ativo} onClick={() => setVista(t.id)}
              style={{
                padding: "9px 16px", fontSize: 12.5, fontWeight: ativo ? 700 : 500,
                background: "transparent",
                color: ativo ? t.cor : T.muted,
                border: "none", borderBottom: ativo ? `2px solid ${t.cor}` : "2px solid transparent",
                marginBottom: -1, cursor: "pointer", letterSpacing: ".02em",
                whiteSpace: "nowrap",
              }}>
              {t.label}
            </button>
          );
        })}
      </div>
      )}

      {/* A Receber em CARDS, A Pagar em tabela */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* === A RECEBER · cards === */}
        {vista === "receber" && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{
            padding: "16px 18px", borderBottom: `1px solid ${T.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
          }}>
            <div style={{ fontSize: 14, color: T.ink, fontWeight: 600 }}>
              💰 A Receber
              <span style={{ color: T.muted, fontWeight: 400, fontSize: 12, marginLeft: 6 }}>
                · {mesAtivo ? mesLabel(mesAtivo) : "Todos os meses"}
              </span>
              <span style={{ color: T.muted, fontWeight: 400, marginLeft: 8, fontSize: 11.5 }}>
                ({receberMes.length} {receberMes.length === 1 ? "item" : "itens"})
              </span>
            </div>
            <div className="num" style={{
              color: T.green, fontSize: 16, fontWeight: 600,
              fontFamily: T.serif, letterSpacing: "-.01em",
            }}>
              {hidden ? "•••" : fmt(receberMes.reduce((s, d) => s + aReceberDe(d), 0))}
            </div>
          </div>

          {receberMes.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 12.5 }}>
              Nada por aqui neste mês.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12 }}>
              {receberMes.map((d, i) => {
                const ym = ymOf(d.vencimento) || "—";
                const prevYm = i > 0 ? (ymOf(receberMes[i - 1].vencimento) || "—") : null;
                const showHeader = !mesAtivo && ym !== prevYm;
                return (
                  <React.Fragment key={d.id}>
                    {showHeader && (
                      <div style={{
                        fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
                        color: T.muted, fontWeight: 700,
                        marginTop: i === 0 ? 0 : 10,
                        paddingTop: i === 0 ? 0 : 10,
                        borderTop: i === 0 ? "none" : `1px solid ${T.border}`,
                      }}>
                        {ym === "—" ? "Sem data" : mesLabel(ym)}
                      </div>
                    )}
                    <DevedorCard d={d} hidden={hidden} dueLabel={dueLabel}
                  onBaixa={() => {
                    const jaRecebido = parseFloat(d.valorRecebido) || 0;
                    const saldoAberto = Math.max(0, (parseFloat(d.valor) || 0) - jaRecebido);
                    setBaixaForm({
                      itemId: d.id, tipoOriginal: "receber",
                      nome: d.nome, valor: saldoAberto,
                      categoria: d.categoria || "Outros", obs: d.obs || "",
                      parcela: d.parcela || "",
                      contaDestino: contas[0]?.nome || "", dataBaixa: hoje,
                      // recebimento parcial — só p/ A Receber
                      saldoAberto,
                      jaRecebido,
                      valorTotalOriginal: parseFloat(d.valor) || 0,
                      parcial: false,
                      valorParcial: saldoAberto,
                    });
                  }}
                  onEditar={() => setForm({ ...d, tipo: "receber" })}
                  onExcluir={() => excluir(d, "receber")}
                  onWhats={() => whatsapp.cobrarDevedor(d)}
                />
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
        )}
        {vista === "pagar" && resumoPagarMes && (
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {[
              { l: "Total a pagar", v: resumoPagarMes.total, c: T.ink },
              { l: "Pagas",         v: resumoPagarMes.pagas, c: T.green },
              { l: "Falta pagar",   v: resumoPagarMes.falta, c: T.red },
            ].map(x => (
              <div key={x.l} style={{ flex: 1, minWidth: 110, background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "10px 12px" }}>
                <div style={{ fontSize: 11, color: T.muted }}>{x.l}</div>
                <div className="num" style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: x.c }}>
                  {hidden ? "•••" : fmt(x.v)}
                </div>
              </div>
            ))}
          </div>
        )}
        {vista === "pagar" && (
        <CompromissoTabela
          titulo="A Pagar"
          icone="⚠️"
          tipo="dividas"
          itens={pagarMes}
          corAccent={T.red}
          onBaixa={(item) => setBaixaForm({
            itemId: item.id, tipoOriginal: "dividas",
            nome: item.nome, valor: item.valor,
            categoria: item.categoria || "Outros", obs: item.obs || "",
            parcela: item.parcela || "",
            contaDestino: contas[0]?.nome || "", dataBaixa: hoje,
            // Refs do item virtual (fixa/parcela) — usadas em confirmarBaixa
            // pra atualizar a fonte original em vez de dividas[].
            _origem: item._origem || "divida",
            _fixaOccId: item._fixaOccId || null,
            _parcelamentoId: item._parcelamentoId || null,
            _parcelaN: item._parcelaN || null,
            _transacaoId: item._transacaoId || null,
            _metaId: item._metaId || null,
            _metaNome: item._metaNome || null,
          })}
          onEditar={(item) => {
            if (item._origem === "parcela") {
              // Parcelas de cartão não têm modelo de "editar 1 parcela" sem
              // recalcular fatura/limite — direciona pro lugar certo.
              toast.info("Edite o parcelamento em Cartões.");
              return;
            }
            // Fixa, transação avulsa e dívida tradicional: edita aqui mesmo.
            // O dispatch de qual fonte atualizar acontece em save().
            setForm({ ...item, tipo: "dividas" });
          }}
          onExcluir={(item) => excluir(item, "dividas")}
          onWhats={(item) => whatsapp.cobrarDivida(item)}
          dueLabel={dueLabel}
          hidden={hidden}
          mesLabelTitulo={mesAtivo ? mesLabel(mesAtivo) : "Todos os meses"}
          showCredor
        />
        )}

        {/* === PAGAS · o que já foi pago === */}
        {vista === "pagas" && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
          <div style={{
            padding: "16px 18px", borderBottom: `1px solid ${T.border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
          }}>
            <div style={{ fontSize: 14, color: T.ink, fontWeight: 600 }}>
              ✅ Pagas
              <span style={{ fontSize: 11.5, color: T.muted, fontWeight: 400, marginLeft: 6 }}>
                · {mesAtivo ? mesLabel(mesAtivo) : mesLabel(hoje.slice(0, 7))} · {pagasMes.length} {pagasMes.length === 1 ? "item" : "itens"}
              </span>
            </div>
            <div className="num" style={{ fontSize: 16, fontWeight: 700, color: T.green }}>
              {hidden ? "•••" : fmt(totalPagasMes)}
            </div>
          </div>
          {pagasMes.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center", color: T.muted, fontSize: 13, fontStyle: "italic" }}>
              Nada pago neste mês ainda.
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Pago em</th><th>Nome</th><th>Tipo</th><th>Categoria</th>
                  <th style={{ textAlign: "right" }}>Valor</th><th style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pagasMes.map(item => (
                  <tr key={item.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{(item.data || "").slice(8, 10)}/{(item.data || "").slice(5, 7)}</td>
                    <td>{item.descricao}</td>
                    <td><span style={{ fontSize: 10, color: T.muted, textTransform: "capitalize" }}>{item.fonte}</span></td>
                    <td><span style={{ fontSize: 11, color: T.muted }}>{item.categoria}</span></td>
                    <td className="num" style={{ textAlign: "right", color: T.ink }}>{hidden ? "•••" : fmt(item.valor)}</td>
                    <td style={{ textAlign: "right" }}>
                      <button onClick={() => desfazerPagamento(item)}
                        title="Desfazer pagamento (volta para A Pagar para corrigir)"
                        style={{
                          background: "transparent", border: `1px solid ${T.border}`, color: T.muted,
                          borderRadius: 5, padding: "3px 8px", fontSize: 10.5, cursor: "pointer",
                        }}>
                        ↩ Desfazer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        )}
      </div>

      {/* Modal Novo/Editar */}
      {form && (
        <Modal title={form.id ? "Editar" : `Novo ${form.tipo === "receber" ? "Recebimento" : "Compromisso"}`} onClose={() => setForm(null)}>
          <Field label={form.tipo === "receber" ? "Nome do devedor" : "Nome da dívida"} required>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
                   placeholder={form.tipo === "receber" ? "Ex.: João Silva" : "Ex.: Aluguel · Apt 302"} />
          </Field>
          {form.tipo === "dividas" && (
            <Field label="Para quem está devendo (credor)" hint="Ex.: Imobiliária ABC, Banco Itaú, Mercado X">
              <input value={form.credor || ""} onChange={e => setForm({ ...form, credor: e.target.value })}
                     placeholder="Nome do credor" />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)" required hint="Só números · centavos automáticos">
              <MoneyInput value={form.valor} onChange={v => setForm({ ...form, valor: v })} />
            </Field>
            <Field label="Vencimento">
              <input type="date" value={form.vencimento}
                     onChange={e => setForm({ ...form, vencimento: e.target.value })} />
            </Field>
          </div>
          <Field label="Categoria" hint="Escolha uma ou crie na hora com “+ nova”.">
            {form._criarCat ? (
              <div style={{ display: "flex", gap: 6 }}>
                <input autoFocus value={form._catNome || ""} placeholder="Nome da nova categoria"
                       onChange={e => setForm({ ...form, _catNome: e.target.value })}
                       onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); criarCategoria(form._catNome); } }}
                       style={{ flex: 1 }} />
                <button type="button" className="btn-gold" style={{ padding: "0 12px", fontSize: 12 }}
                        onClick={() => criarCategoria(form._catNome)}>Criar</button>
                <button type="button" className="btn-ghost" style={{ padding: "0 10px", fontSize: 12 }}
                        onClick={() => setForm({ ...form, _criarCat: false, _catNome: "" })}>✕</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <select value={form.categoria} style={{ flex: 1 }}
                        onChange={e => setForm({ ...form, categoria: e.target.value, subcategoria: "" })}>
                  {categorias.filter(c => c.tipo === (form.tipo === "receber" ? "receita" : "despesa")).map(c => (
                    <option key={c.id} value={c.nome}>{c.nome}</option>
                  ))}
                  <option value="Outros">Outros</option>
                </select>
                <button type="button" className="btn-ghost" style={{ padding: "0 10px", fontSize: 12, whiteSpace: "nowrap" }}
                        onClick={() => setForm({ ...form, _criarCat: true, _catNome: "" })}>+ nova</button>
              </div>
            )}
          </Field>

          <Field label="Subcategoria (filha)" hint="Opcional. Aparece no relatório no lugar da categoria.">
            {form._criarSub ? (
              <div style={{ display: "flex", gap: 6 }}>
                <input autoFocus value={form._subNome || ""} placeholder={`Nova filha de ${form.categoria || "categoria"}`}
                       onChange={e => setForm({ ...form, _subNome: e.target.value })}
                       onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); criarSubcategoria(form._subNome); } }}
                       style={{ flex: 1 }} />
                <button type="button" className="btn-gold" style={{ padding: "0 12px", fontSize: 12 }}
                        onClick={() => criarSubcategoria(form._subNome)}>Criar</button>
                <button type="button" className="btn-ghost" style={{ padding: "0 10px", fontSize: 12 }}
                        onClick={() => setForm({ ...form, _criarSub: false, _subNome: "" })}>✕</button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <select value={form.subcategoria || ""} style={{ flex: 1 }}
                        onChange={e => setForm({ ...form, subcategoria: e.target.value })}>
                  <option value="">— Nenhuma —</option>
                  {subsForm.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                </select>
                <button type="button" className="btn-ghost" style={{ padding: "0 10px", fontSize: 12, whiteSpace: "nowrap" }}
                        title={catObjForm ? "" : "Selecione/crie a categoria primeiro"}
                        onClick={() => { if (!catObjForm) { toast.error("Escolha ou crie a categoria primeiro."); return; } setForm({ ...form, _criarSub: true, _subNome: "" }); }}>
                  + nova filha
                </button>
              </div>
            )}
          </Field>

          <Field label="Escopo" hint="Pessoal ou Negócio — separa nas estatísticas">
            <select value={form.escopo || "pessoal"} onChange={e => setForm({ ...form, escopo: e.target.value })}>
              <option value="pessoal">👤 Pessoal</option>
              <option value="negocio">🏢 Negócio</option>
            </select>
          </Field>

          {!form.id && (
            <ParcelarBlock form={form} setForm={setForm} />
          )}
          <Field label="Observações">
            <textarea value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })}
                      rows={2} placeholder="Detalhes, combinado…" />
          </Field>

          {/* Parcelado: aplicar a mudança a várias parcelas de uma vez */}
          {form.id && form.grupoParcelamento && (
            <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 14, padding: 12, marginTop: 4 }}>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13, color: T.ink }}>Aplicar mudança em:</div>
              {[
                { v: "esta",    l: "Só esta parcela" },
                { v: "futuras", l: "Esta e as próximas parcelas (pendentes)" },
                { v: "todas",   l: "Todas as parcelas pendentes do grupo" },
              ].map(opt => (
                <label key={opt.v} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer" }}>
                  <input type="radio" name="aplicar-em-receber"
                         checked={(form._aplicarEm || "esta") === opt.v}
                         onChange={() => setForm({ ...form, _aplicarEm: opt.v })}
                         style={{ accentColor: T.gold }} />
                  <span style={{ fontSize: 12.5, color: T.ink }}>{opt.l}</span>
                </label>
              ))}
              <div style={{ fontSize: 11, color: T.muted, marginTop: 6, fontStyle: "italic" }}>
                Aplica valor, categoria e descrição. O vencimento de cada parcela e as já recebidas/pagas são preservados.
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end mt-4">
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn-gold" onClick={save}>Salvar</button>
          </div>
        </Modal>
      )}

      {/* Modal Baixa */}
      {baixaForm && (() => {
        const conta = contas.find(c => c.nome === baixaForm.contaDestino);
        const isReceber = baixaForm.tipoOriginal === "receber";
        const saldoAberto = parseFloat(baixaForm.saldoAberto) || (parseFloat(baixaForm.valor) || 0);
        const jaRecebido = parseFloat(baixaForm.jaRecebido) || 0;
        const ehParcial = isReceber && baixaForm.parcial;
        const valorParcialNum = Number(baixaForm.valorParcial) || 0;
        // Valor efetivo da baixa exibido no resumo
        const valor = ehParcial ? valorParcialNum : (parseFloat(baixaForm.valor) || 0);
        const parcialInvalido = ehParcial && (!(valorParcialNum > 0) || valorParcialNum > saldoAberto + 0.005);
        const faltaApos = +(saldoAberto - valorParcialNum).toFixed(2);
        const saldoAtual = parseFloat(conta?.saldo) || 0;
        const saldoFinal = saldoAtual + (isReceber ? valor : -valor);
        // Aporte de meta = poupança (transferência pro cofrinho), não gasto.
        const ehAporteMeta = !isReceber && baixaForm._origem === "fixa" && !!baixaForm._metaId;
        const cofreNome = ehAporteMeta ? `🐷 ${baixaForm._metaNome || "Meta"}` : null;
        return (
          <Modal
            title={ehAporteMeta
              ? `Guardar para ${baixaForm._metaNome || "meta"}`
              : (isReceber ? `Receber de ${baixaForm.nome}` : `Pagar para ${baixaForm.nome}`)}
            onClose={() => setBaixaForm(null)}
          >
            <div style={{ padding: 12, background: T.bgSoft, borderRadius: 12, fontSize: 12.5, marginBottom: ehParcial || (isReceber && jaRecebido > 0) ? 12 : 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: T.muted }}>
                <span>{ehParcial ? "Valor desta baixa:" : "Valor:"}</span>
                <span className="num" style={{ color: isReceber ? T.green : T.red, fontWeight: 600, fontSize: 16 }}>
                  {isReceber ? "+ " : "− "}{fmt(valor)}
                </span>
              </div>
              {isReceber && jaRecebido > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: T.muted }}>
                  <span>Já recebido:</span>
                  <span className="num">{fmt(jaRecebido)} de {fmt(parseFloat(baixaForm.valorTotalOriginal) || saldoAberto)}</span>
                </div>
              )}
              {isReceber && jaRecebido > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: 11, color: T.muted }}>
                  <span>Saldo em aberto:</span>
                  <span className="num" style={{ fontWeight: 600 }}>{fmt(saldoAberto)}</span>
                </div>
              )}
              {baixaForm.parcela && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 11, color: T.faint }}>
                  <span>Parcela:</span><span>{baixaForm.parcela}</span>
                </div>
              )}
            </div>

            {/* Recebimento parcial — só A Receber */}
            {isReceber && (
              <div style={{
                background: T.bgSoft,
                border: `1px solid ${ehParcial ? T.green : T.border}`,
                borderLeft: `3px solid ${ehParcial ? T.green : T.border}`,
                borderRadius: 14, padding: 12, marginBottom: 14,
              }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                  <input type="checkbox" checked={!!baixaForm.parcial}
                         onChange={e => setBaixaForm({
                           ...baixaForm,
                           parcial: e.target.checked,
                           valorParcial: e.target.checked ? saldoAberto : baixaForm.valorParcial,
                         })}
                         style={{ width: 18, height: 18, accentColor: T.green, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, lineHeight: 1.3 }}>
                      Recebimento parcial
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
                      Recebe parte agora e abate do saldo; o restante continua em aberto.
                    </div>
                  </div>
                </label>

                {ehParcial && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${T.border}` }}>
                    <Field label="Valor a receber agora (R$)" required hint={`Máx. ${fmt(saldoAberto)} (saldo em aberto)`}>
                      <MoneyInput value={baixaForm.valorParcial}
                                  onChange={v => setBaixaForm({ ...baixaForm, valorParcial: v })} />
                    </Field>
                    {parcialInvalido ? (
                      <div style={{ fontSize: 11, color: T.red, marginTop: 4 }}>
                        ⚠ Informe um valor entre {fmt(0.01)} e {fmt(saldoAberto)}.
                      </div>
                    ) : (
                      <div style={{
                        padding: 8, marginTop: 8, borderRadius: 11, fontSize: 11.5,
                        background: `${T.green}11`, border: `1px solid ${T.green}33`, color: T.muted,
                        display: "flex", justifyContent: "space-between",
                      }}>
                        <span>Após esta baixa:</span>
                        <span className="num" style={{ fontWeight: 600, color: faltaApos <= 0.005 ? T.green : T.ink }}>
                          {faltaApos <= 0.005 ? "Quitado ✓" : `falta ${fmt(faltaApos)}`}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <Field label={isReceber ? "Receber em qual conta?" : "Pagar de qual conta?"} required>
              <select value={baixaForm.contaDestino}
                      onChange={e => setBaixaForm({ ...baixaForm, contaDestino: e.target.value })}>
                <option value="">Selecione…</option>
                {contas.map(c => (
                  <option key={c.id} value={c.nome}>
                    {c.nome} · saldo {fmt(c.saldo)}
                  </option>
                ))}
              </select>
            </Field>

            {conta && (
              <div style={{
                padding: 10, marginBottom: 12,
                background: `${isReceber ? T.green : T.red}11`,
                border: `1px solid ${isReceber ? T.green : T.red}33`,
                borderRadius: 11, fontSize: 11.5, color: T.muted,
              }}>
                Saldo {hidden ? "•••" : fmt(saldoAtual)} → <strong style={{ color: isReceber ? T.green : T.red }}>{hidden ? "•••" : fmt(saldoFinal)}</strong>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Data da baixa">
                <input type="date" value={baixaForm.dataBaixa}
                       onChange={e => setBaixaForm({ ...baixaForm, dataBaixa: e.target.value })} />
              </Field>
              <Field label="Categoria">
                <select value={baixaForm.categoria}
                        onChange={e => setBaixaForm({ ...baixaForm, categoria: e.target.value })}>
                  {categorias.filter(c => c.tipo === (isReceber ? "receita" : "despesa")).map(c => (
                    <option key={c.id} value={c.nome}>{c.nome}</option>
                  ))}
                  <option value="Outros">Outros</option>
                </select>
              </Field>
            </div>

            <div style={{
              padding: 10, marginTop: 12,
              background: `${T.green}11`, border: `1px solid ${T.green}33`,
              borderRadius: 11, fontSize: 11, color: T.green, lineHeight: 1.6,
            }}>
              {ehAporteMeta ? (
                <>
                  💰 Transfere {hidden ? "•••" : fmt(valor)} de {baixaForm.contaDestino || "—"} para o cofrinho <strong>{cofreNome}</strong><br />
                  ✓ É <strong>poupança, não gasto</strong> — seu patrimônio não muda<br />
                  ✓ Soma na meta e marca este mês como guardado
                </>
              ) : (
                <>
                  ✓ Cria transação "{isReceber ? "Recebimento" : "Pagamento"} de {baixaForm.nome}" em {baixaForm.contaDestino || "—"}<br />
                  ✓ {isReceber ? "Aumenta" : "Diminui"} saldo em {hidden ? "•••" : fmt(valor)}<br />
                  ✓ {ehParcial && faltaApos > 0.005
                    ? `Abate do saldo — falta ${fmt(faltaApos)} em aberto`
                    : `Marca como ${isReceber ? "recebido" : "pago"}`}
                </>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-5">
              <button className="btn-ghost" onClick={() => setBaixaForm(null)}>Cancelar</button>
              <button
                disabled={parcialInvalido}
                style={{
                  background: (ehAporteMeta || isReceber) ? T.green : T.red, color: (ehAporteMeta || isReceber) ? T.bg : "#fff",
                  border: "none", padding: "10px 18px",
                  fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase",
                  fontWeight: 600, cursor: parcialInvalido ? "not-allowed" : "pointer", borderRadius: 12,
                  opacity: parcialInvalido ? 0.5 : 1,
                }}
                onClick={confirmarBaixa}
              >
                {ehAporteMeta ? "🐷 Guardar na meta"
                  : ehParcial && faltaApos > 0.005 ? "✓ Confirmar recebimento parcial"
                  : (isReceber ? "✓ Confirmar recebimento" : "✓ Confirmar pagamento")}
              </button>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

/**
 * ParcelarBlock — UI explícita pra parcelar Recebimento/Compromisso por mês.
 *
 * Quando ativada, gera N entradas com vencimento mensal a partir do
 * "Vencimento" informado. Cada entrada vira uma linha separada na lista
 * com sua própria data — assim aparece no mês certo do filtro de tabs.
 *
 * Modo "total" (recomendado): valor digitado é dividido em N partes iguais.
 * Modo "porParcela": valor digitado se repete em cada parcela.
 */
function ParcelarBlock({ form, setForm }) {
  const isReceber = form.tipo === "receber";
  const ativo = !!form.parcelar;
  const n = Math.max(1, Math.min(96, parseInt(form.numParcelas, 10) || 1));
  const valorTotal = Number(form.valor) || 0;
  const valorPorPar = form.modoValor === "total" && n > 0 ? valorTotal / n : valorTotal;
  const totalGerado = form.modoValor === "total" ? valorTotal : valorTotal * n;

  // Preview: lista os N vencimentos com base no Vencimento + 1 mês
  const preview = (() => {
    if (!ativo || !form.vencimento || n <= 1) return [];
    const [y, m, d] = form.vencimento.split("-").map(Number);
    if (!y || !m || !d) return [];
    const out = [];
    for (let i = 0; i < n; i++) {
      const alvoMes = m - 1 + i;
      const venc = new Date(y, alvoMes, 1);
      const ultimoDia = new Date(y, alvoMes + 1, 0).getDate();
      venc.setDate(Math.min(d, ultimoDia));
      out.push({
        parcela: `${i + 1}/${n}`,
        iso: `${venc.getFullYear()}-${String(venc.getMonth() + 1).padStart(2, "0")}-${String(venc.getDate()).padStart(2, "0")}`,
      });
    }
    return out;
  })();

  const dataLbl = (iso) => {
    if (!iso) return "—";
    try {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return iso; }
  };

  return (
    <div style={{
      background: T.bgSoft,
      border: `1px solid ${ativo ? T.gold : T.border}`,
      borderLeft: `3px solid ${ativo ? T.gold : T.border}`,
      borderRadius: 14,
      padding: 12,
      marginBottom: 14,
    }}>
      {/* Toggle */}
      <label style={{
        display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
        userSelect: "none",
      }}>
        <input type="checkbox" checked={ativo}
               onChange={e => setForm({ ...form, parcelar: e.target.checked })}
               style={{ width: 18, height: 18, accentColor: T.gold, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, lineHeight: 1.3 }}>
            Parcelar {isReceber ? "recebimento" : "pagamento"} por mês
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
            Cria uma entrada separada para cada mês a partir do vencimento.
          </div>
        </div>
      </label>

      {ativo && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${T.border}` }}>
          {/* Linha 1: nº parcelas + modo */}
          <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 10 }}>
            <Field label="Em quantas parcelas?">
              <input type="number" min="2" max="96" value={form.numParcelas}
                     onChange={e => setForm({ ...form, numParcelas: e.target.value })}
                     placeholder="3" />
            </Field>
            <Field label="O valor digitado é…">
              <select value={form.modoValor || "total"}
                      onChange={e => setForm({ ...form, modoValor: e.target.value })}>
                <option value="total">Total — dividir entre as parcelas</option>
                <option value="porParcela">Por parcela — multiplicar pelo nº</option>
              </select>
            </Field>
          </div>

          {/* Resumo */}
          {valorTotal > 0 && n > 1 && (
            <div style={{
              padding: 10, marginBottom: 10,
              background: `${T.gold}11`,
              border: `1px solid ${T.gold}44`,
              borderRadius: 11, fontSize: 12, color: T.ink,
              display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6,
            }}>
              <span>
                <strong className="num">{n}×</strong> de{" "}
                <strong className="num" style={{ color: T.gold }}>{fmt(valorPorPar)}</strong>
              </span>
              <span style={{ color: T.muted }}>
                Total: <strong className="num" style={{ color: T.ink }}>{fmt(totalGerado)}</strong>
              </span>
            </div>
          )}

          {/* Preview de vencimentos */}
          {preview.length > 0 && (
            <div>
              <div style={{
                fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase",
                color: T.muted, fontWeight: 600, marginBottom: 6,
              }}>
                Vencimentos previstos
              </div>
              <div style={{
                maxHeight: 180, overflowY: "auto",
                background: T.card, border: `1px solid ${T.border}`, borderRadius: 11,
              }}>
                {preview.map((p, i) => (
                  <div key={p.parcela} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "7px 10px",
                    borderBottom: i < preview.length - 1 ? `1px solid ${T.border}` : "none",
                    fontSize: 12,
                  }}>
                    <span style={{ color: T.muted, fontWeight: 600, minWidth: 42 }}>{p.parcela}</span>
                    <span style={{ color: T.ink, flex: 1, marginLeft: 8 }}>{dataLbl(p.iso)}</span>
                    <span className="num" style={{ color: isReceber ? T.green : T.red, fontWeight: 500 }}>
                      {fmt(valorPorPar)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!form.vencimento && (
            <div style={{
              fontSize: 11, color: T.gold, marginTop: 8, fontStyle: "italic",
            }}>
              ⚠ Preencha o <strong>Vencimento</strong> acima pra calcular as datas das parcelas.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VisaoCard({ label, valor, sub, cor, small }) {
  return (
    <div style={{
      padding: "9px 11px", background: T.card,
      border: `1px solid ${T.border}`, borderRadius: 12,
      borderLeft: `3px solid ${cor || T.border}`,
    }}>
      <div style={{
        fontSize: 8.5, letterSpacing: ".15em", textTransform: "uppercase",
        color: T.muted, marginBottom: 4, fontWeight: 600,
      }}>
        {label}
      </div>
      <div className="num" style={{
        fontFamily: T.serif, fontSize: small ? 13 : 15,
        color: cor || T.ink, fontWeight: 600, lineHeight: 1.1,
      }}>
        {valor == null ? "•••" : (typeof valor === "number" ? fmt(valor) : valor)}
      </div>
      <div style={{ fontSize: 9.5, color: T.faint, marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function AlertCard({ cor, titulo, count, valor, sub, icone, actions }) {
  return (
    <div title={sub} style={{
      background: T.card,
      border: `1px solid ${cor}55`,
      borderLeft: `3px solid ${cor}`,
      borderRadius: 14,
      padding: "6px 8px",
      display: "flex", alignItems: "center", gap: 7, minWidth: 0,
    }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icone}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="label-eyebrow" style={{ color: cor, fontSize: 8, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</div>
        <div className="num" style={{ fontSize: 13, fontWeight: 600, color: cor, lineHeight: 1.2, whiteSpace: "nowrap" }}>
          {count}{valor != null ? ` · ${fmt(valor)}` : ""}
        </div>
      </div>
      {actions && actions.length > 0 && (
        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
          {actions.map(a => (
            <button key={a.label} onClick={a.onClick} title={a.title}
              style={{
                background: `${cor}22`, color: cor,
                border: `1px solid ${cor}55`, borderRadius: 11,
                padding: "4px 6px", fontSize: 12, cursor: "pointer", lineHeight: 1,
              }}>
              {a.icon || a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CompromissoTabela({
  titulo, icone, tipo, itens, corAccent,
  onBaixa, onEditar, onExcluir, onWhats,
  dueLabel, hidden, mesLabelTitulo, showCredor,
}) {
  const isReceber = tipo === "receber";
  const total = itens.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
  const labelAcao = isReceber ? "Receber" : "Pagar";

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{
        padding: "10px 14px", borderBottom: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontSize: 14, color: T.ink, fontWeight: 600, letterSpacing: ".02em" }}>
            {icone} {titulo}
            {mesLabelTitulo && (
              <span style={{ color: T.muted, fontWeight: 400, fontSize: 12, marginLeft: 6 }}>
                · {mesLabelTitulo}
              </span>
            )}
            <span style={{ color: T.muted, fontWeight: 400, marginLeft: 8, fontSize: 11.5 }}>
              ({itens.length} {itens.length === 1 ? "item" : "itens"})
            </span>
          </div>
        </div>
        <div className="num" style={{
          color: corAccent, fontSize: 16, fontWeight: 600,
          fontFamily: T.serif, letterSpacing: "-.01em",
        }}>
          {hidden ? "•••" : fmt(total)}
        </div>
      </div>

      {itens.length === 0 ? (
        <div style={{ padding: 30, textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 12.5 }}>
          Nada por aqui neste mês.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="tbl" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr>
                <ThSmall>Vence</ThSmall>
                <ThSmall>Nome</ThSmall>
                {showCredor && <ThSmall>Credor</ThSmall>}
                <ThSmall>Obs</ThSmall>
                <ThSmall align="right">Valor</ThSmall>
                <ThSmall align="right">Ações</ThSmall>
              </tr>
            </thead>
            <tbody>
              {itens.map(item => {
                const due = dueLabel(item.vencimento);
                const isOver = due.status === "over";
                const isWarn = due.status === "warn";
                const rowBg = isOver ? `${T.red}1a`
                            : isWarn ? `${T.gold}1a`
                            : "transparent";
                return (
                  <tr key={item.id} style={{
                    background: rowBg,
                    borderTop: `1px solid ${T.border}`,
                  }}>
                    <td style={{ ...tdMini, whiteSpace: "nowrap" }}>
                      {item.vencimento ? (
                        <div>
                          <div style={{ color: due.cor, fontWeight: (isOver || isWarn) ? 600 : 400, fontSize: 12.5 }}>
                            {(() => {
                              const s = typeof item.vencimento === "string"
                                ? item.vencimento
                                : (() => { try { return new Date(item.vencimento).toISOString().slice(0,10); } catch { return ""; } })();
                              return `${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(2,4)}`;
                            })()}
                          </div>
                          <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
                            {(() => {
                              const d = new Date(item.vencimento);
                              const h = new Date(new Date().toISOString().slice(0,10));
                              const dias = Math.round((d - h) / 86400000);
                              if (dias < 0) return `há ${-dias}d`;
                              if (dias === 0) return "hoje";
                              return `em ${dias}d`;
                            })()}
                          </div>
                        </div>
                      ) : "—"}
                    </td>
                    <td style={{ ...tdMini, color: T.ink }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span>{item.nome}</span>
                        {item.parcela && (
                          <span style={{ fontSize: 10, color: T.faint, fontStyle: "italic" }}>· {item.parcela}</span>
                        )}
                      </div>
                    </td>
                    {showCredor && (
                      <td style={{ ...tdMini, color: T.muted, fontSize: 12 }}>
                        {item.credor || <span style={{ color: T.faint }}>—</span>}
                      </td>
                    )}
                    <td style={{ ...tdMini, color: T.muted, fontSize: 11, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={item.obs || ""}>
                      {item.obs || "—"}
                    </td>
                    <td className="num" style={{ ...tdMini, textAlign: "right", color: corAccent, fontWeight: 500, whiteSpace: "nowrap" }}>
                      {hidden ? "•••" : fmt(item.valor)}
                    </td>
                    <td style={{ ...tdMini, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button onClick={() => onBaixa(item)}
                              title={`✓ ${labelAcao}`}
                              style={{
                                background: corAccent, color: isReceber ? T.bg : "#fff",
                                border: "none", padding: "6px 12px",
                                fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase",
                                fontWeight: 600, cursor: "pointer", borderRadius: 5,
                                marginRight: 4, display: "inline-flex", alignItems: "center", gap: 4,
                              }}>
                        <Check size={11} /> {labelAcao}
                      </button>
                      <button onClick={() => onWhats(item)}
                              title="WhatsApp"
                              style={{ ...miniIconBtn, color: "#25D366" }}>
                        <MessageCircle size={12} />
                      </button>
                      <button onClick={() => onEditar(item)}
                              title="Editar"
                              style={{ ...miniIconBtn, color: T.muted }}>
                        <Edit3 size={12} />
                      </button>
                      <button onClick={() => onExcluir(item)}
                              title="Excluir"
                              style={{ ...miniIconBtn, color: T.red }}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ThSmall({ children, align }) {
  return (
    <th style={{
      padding: "8px 10px",
      textAlign: align || "left",
      fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase",
      color: T.muted, fontWeight: 500,
      background: T.bgSoft,
      borderBottom: `1px solid ${T.border}`,
    }}>{children}</th>
  );
}

const tdMini = {
  padding: "8px 10px",
  verticalAlign: "middle",
};

const miniIconBtn = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 4,
  borderRadius: 5,
  marginLeft: 2,
};

// Hash determinístico do nome → gradient consistente (mesma pessoa = mesma cor)
function corDoNome(nome = "") {
  let h = 0;
  for (let i = 0; i < nome.length; i++) h = (h * 31 + nome.charCodeAt(i)) >>> 0;
  const hue1 = h % 360;
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 55%, 45%), hsl(${hue2}, 50%, 35%))`;
}

export function DevedorCard({ d, onBaixa, onWhats, onEditar, onExcluir, hidden, dueLabel }) {
  const due = dueLabel ? dueLabel(d.vencimento) : null;
  const isOver = due?.status === "over";
  const isWarn = due?.status === "warn";
  const inicial = (d.nome || "?").trim().charAt(0).toUpperCase();
  const cor = corDoNome(d.nome || "?");
  const borderL = isOver ? `3px solid ${T.red}` : isWarn ? `3px solid ${T.gold}` : `3px solid ${cor}`;
  // Recebimento parcial (backward-compat: valorRecebido undefined → 0)
  const valorTotal = parseFloat(d.valor) || 0;
  const jaRecebido = parseFloat(d.valorRecebido) || 0;
  const temParcial = jaRecebido > 0 && jaRecebido < valorTotal;
  const faltaReceber = Math.max(0, valorTotal - jaRecebido);
  const pctRecebido = valorTotal > 0 ? Math.min(100, (jaRecebido / valorTotal) * 100) : 0;
  const meta = [due && d.vencimento ? due.txt : "", d.combinado || d.obs || ""].filter(Boolean).join(" · ");
  const itemMenu = { background: "transparent", border: "none", cursor: "pointer", padding: "9px 12px", display: "flex", alignItems: "center", gap: 9, width: "100%", fontSize: 12.5, textAlign: "left", color: T.ink };
  // Cor de status: vencido=vermelho, 3 dias=ouro, no prazo=sem cor (neutro, sem verde).
  const sc = isOver ? T.red : isWarn ? T.gold : null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "4px 10px", background: sc ? `${sc}11` : T.card,
      border: `1px solid ${sc ? `${sc}55` : T.border}`, borderLeft: `4px solid ${sc || T.border}`, borderRadius: 16,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: T.ink, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nome}</span>
          {d.vencimento && (
            <span style={{ fontSize: 10.5, color: (due && due.cor) || T.muted, fontWeight: 500, flexShrink: 0 }}>
              {d.vencimento.slice(8, 10)}/{d.vencimento.slice(5, 7)}/{d.vencimento.slice(2, 4)}
            </span>
          )}
          {isOver && <span style={{ fontSize: 8.5, padding: "1px 5px", borderRadius: 100, background: `${T.red}22`, color: T.red, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 700, flexShrink: 0 }}>vencido</span>}
          {isWarn && <span style={{ fontSize: 8.5, padding: "1px 5px", borderRadius: 100, background: `${T.gold}22`, color: T.gold, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 700, flexShrink: 0 }}>3 dias</span>}
        </div>
        {meta && (
          <div style={{ fontSize: 10.5, color: (due && d.vencimento) ? due.cor : T.muted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {meta}
          </div>
        )}
        {temParcial && (
          <div style={{ height: 4, borderRadius: 100, background: `${T.green}22`, overflow: "hidden", marginTop: 5 }}>
            <div style={{ width: `${pctRecebido}%`, height: "100%", background: T.green, transition: "width .25s ease" }} />
          </div>
        )}
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div className="num" style={{ color: T.green, fontFamily: T.serif, fontSize: 15, fontWeight: 600, lineHeight: 1.1 }}>
          {hidden ? "•••" : fmt(temParcial ? faltaReceber : d.valor)}
        </div>
        {temParcial && <div style={{ fontSize: 9, color: T.muted }}>falta · de {hidden ? "•••" : fmt(valorTotal)}</div>}
      </div>

      <button onClick={() => onBaixa(d)} title="Receber"
        style={{ background: T.green, color: "#fff", border: "none", borderRadius: 12, padding: "7px 11px",
                 cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
        <Check size={13} /> Receber
      </button>

      <button onClick={() => onEditar(d)} title="Editar"
        style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 10, padding: "6px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
        <Edit3 size={14} />
      </button>
      <button onClick={() => onExcluir(d)} title="Excluir"
        style={{ background: "transparent", color: T.red, border: `1px solid ${T.red}55`, borderRadius: 10, padding: "6px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}
