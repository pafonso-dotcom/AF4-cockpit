/* ============================================================
   useMercado · domínio "mercado" extraído do App.jsx (1ª fatia do
   fatiamento, 2026-09-21) — comportamento idêntico:
   - refreshMarket: cotações reais (BRAPI/Binance), preço NUNCA é
     inventado (sem cotação → mantém o último);
   - alertas de preço-alvo (1 aviso por ativo/direção/dia);
   - busca automática ~2,5s após o boot;
   - polling opcional (af4:invest:polling-min + af4:polling-changed),
     pausado com a aba escondida.
   O App continua dono de `refreshing` (vai pra vários filhos) e
   entrega o setter pro hook.
   ============================================================ */
import { useEffect, useRef, useState } from "react";
import { atualizarCarteira } from "../cotacoes.js";
import { alertasDisparados, filtrarNovos, marcarNotificados } from "../alertasPreco.js";
import { toast } from "../toast.js";

export function useMercado({ ativos, setAtivos, apiKeys, loading, setRefreshing }) {
  const [marketStatus, setMarketStatus] = useState({ at: null, mode: "sim", okCount: 0, total: 0 });

  const refreshMarket = async () => {
    setRefreshing(true);

    // Renda fixa (CDB/Tesouro) fica FIXA no valor que o usuário colocou — não
    // recebe tick simulado nem cotação de mercado. A rentabilidade contratada
    // (ex.: 104,5% CDI, Selic + 0,07%) é projetada em Proventos, não muda o
    // preço aqui. (CDB de meta capitaliza a CDI por conta própria.)
    const rendaFixaFixa = (a) =>
      a._cdbMeta || ["cdb", "tesouro", "rf"].includes(String(a.tipo || "").toLowerCase());

    // Mercado real desligado: NÃO inventa variação — os preços ficam
    // exatamente como estão. (Antes aplicava um tick aleatório que fazia os
    // valores derivarem do mercado de verdade e não baterem com a corretora.)
    if (!apiKeys.useRealMarket) {
      setMarketStatus({ at: new Date(), mode: "off", okCount: 0, total: ativos.length });
      setRefreshing(false);
      return;
    }

    // Modo real: usa lib/cotacoes.js (BRAPI pra ações/FIIs + Binance pra cripto)
    try {
      // Para Binance, traduz ticker BR de cripto (BTC, ETH) pra pair USDT.
      // CDBs de meta rendem a CDI sozinhos — fora da cotação de mercado.
      // Capital Social é manual — também não busca cotação (nem conta no status).
      const ativosComSymbol = ativos.filter(a => !rendaFixaFixa(a) && a.tipo !== "capitalSocial").map(a => {
        if (a.tipo === "cripto" && !/USDT$/i.test(a.ticker)) {
          return { ...a, _symbolCotacao: `${a.ticker.toUpperCase()}USDT` };
        }
        return { ...a, _symbolCotacao: a.ticker };
      });

      const lista = ativosComSymbol.map(a => ({ symbol: a._symbolCotacao, ticker: a._symbolCotacao }));
      const { cotacoes, erros } = await atualizarCarteira(lista);

      let okCount = 0;
      const aplicarCotacoes = (lista) => lista.map(a => {
        // Renda fixa fica fixa no valor informado — sem cotação nem tick.
        if (rendaFixaFixa(a)) return a;
        const sym = a.tipo === "cripto" && !/USDT$/i.test(a.ticker)
          ? `${a.ticker.toUpperCase()}USDT`
          : a.ticker;
        const cot = cotacoes[sym];
        if (cot && cot.price) {
          okCount++;
          return {
            ...a,
            preco: +parseFloat(cot.price).toFixed(2),
            variacao24h: cot.changePercent ?? a.variacao24h,
            ultimaAtt: new Date().toISOString(),
            realtime: true,
            fonteCotacao: cot.fonte,
          };
        }
        // Sem cotação real pra este ticker: MANTÉM o último preço conhecido.
        // Nunca aplica tick simulado — preço inventado não bate com a
        // corretora e vai derivando a cada atualização.
        return { ...a, realtime: false };
      });
      const novosAtivos = aplicarCotacoes(ativos);
      setAtivos(novosAtivos);

      setMarketStatus({
        at: new Date(),
        mode: okCount > 0 ? "real" : "sim",
        okCount,
        total: ativosComSymbol.length,
        erros,
      });

      // Alertas de preço-alvo: avisa quando a cotação real cruza o alvo
      // definido no ativo (alertaAcima/alertaAbaixo) — 1 aviso por
      // ativo/direção/dia (dedupe em localStorage).
      try {
        const hojeISO = new Date().toISOString().slice(0, 10);
        let notif = {};
        try { notif = JSON.parse(localStorage.getItem("af4:alertas-preco:v1") || "{}"); } catch {}
        const novos = filtrarNovos(alertasDisparados(novosAtivos), notif, hojeISO);
        if (novos.length) {
          novos.slice(0, 4).forEach(al => {
            toast.success(
              al.dir === "acima"
                ? `🔔 ${al.ticker} atingiu o alvo: R$ ${al.preco.toFixed(2)} (≥ R$ ${al.alvo.toFixed(2)})`
                : `🔔 ${al.ticker} caiu ao alvo: R$ ${al.preco.toFixed(2)} (≤ R$ ${al.alvo.toFixed(2)})`,
              { duration: 10000 }
            );
          });
          try { localStorage.setItem("af4:alertas-preco:v1", JSON.stringify(marcarNotificados(novos, notif, hojeISO))); } catch {}
        }
      } catch (e) { console.warn("[alertas-preco]", e); }
    } catch (e) {
      console.error("[refreshMarket]", e);
      setMarketStatus({ at: new Date(), mode: "sim", okCount: 0, total: ativos.length, erros: [e.message] });
    } finally {
      setRefreshing(false);
    }
  };

  // Polling automático de cotações.
  // Intervalo (em minutos) lido do localStorage; 0 = desligado (padrão).
  // O SettingsModal salva o valor e dispara `af4:polling-changed` pra
  // reagendar sem reload. Polling pausa quando a aba não está visível.
  const refreshRef = useRef(refreshMarket);
  refreshRef.current = refreshMarket;

  // Cotações reais logo na abertura: garante que os preços sigam o mercado
  // (como na corretora) sem depender do botão de atualizar. Se o mercado real
  // estiver desligado ou a busca falhar, os preços simplesmente ficam como
  // estão — nunca são inventados.
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => { try { refreshRef.current(); } catch {} }, 2500);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (loading) return;
    let timer;
    const setupTimer = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      const min = Number(localStorage.getItem("af4:invest:polling-min")) || 0;
      if (min <= 0) return;
      const ms = Math.max(30_000, min * 60_000);
      const tick = () => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          try { refreshRef.current(); } catch {}
        }
        timer = setTimeout(tick, ms);
      };
      timer = setTimeout(tick, ms);
    };
    setupTimer();
    const onChange = () => setupTimer();
    window.addEventListener("af4:polling-changed", onChange);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("af4:polling-changed", onChange);
    };
  }, [loading]);

  return { refreshMarket, marketStatus };
}
