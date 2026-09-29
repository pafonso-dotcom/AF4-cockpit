import React, { useState, useMemo, useRef, useEffect } from "react";
import { T } from "../../lib/theme.js";
import { arvoreCategorias } from "../../lib/categoriaSort.js";

/**
 * Seletor de categoria HIERÁRQUICO — substituto do <select> plano que abria
 * uma lista enorme (pedido 2026-09-23): mostra SÓ OS PAIS; pai com filhas
 * expande ao tocar ("✓ Usar {pai}" + filhas indentadas); busca no topo
 * quando a lista é grande. O valor continua sendo o NOME da categoria
 * (pai ou filha), igual aos selects antigos — zero migração de dados.
 *
 * Props:
 *  - categorias, tipo ("despesa"|"receita"|null = todas)
 *  - value (nome atual), onChange(nome)
 *  - rotuloVazio: cria a opção que devolve "" (ex.: "Sem categoria (Outros)")
 *  - placeholder: texto do gatilho quando value vazio (default "— selecione —")
 *  - compacto: gatilho pequeno estilo chip (selects inline de linha/célula)
 *  - style: sobrepõe o estilo do gatilho
 */
export default function CategoriaSelect({
  categorias = [], tipo = null, value = "", onChange,
  rotuloVazio = null, placeholder = "— selecione —",
  compacto = false, style = {},
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [expandido, setExpandido] = useState(null); // id do pai aberto
  const [pos, setPos] = useState(null); // {left, top, width, paraCima}
  const gatilhoRef = useRef(null);

  const arvore = useMemo(() => arvoreCategorias(categorias, tipo), [categorias, tipo]);
  const nomes = useMemo(() => new Set((categorias || []).map(c => c.nome)), [categorias]);
  const foraDoCadastro = !!value && !nomes.has(value);

  const norm = (s = "") => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filtrada = useMemo(() => {
    const q = norm(busca.trim());
    if (!q) return arvore;
    return arvore
      .map(({ pai, filhas, subs }) => {
        const paiCasa = norm(pai.nome).includes(q);
        const filhasCasam = filhas.filter(f => norm(f.nome).includes(q));
        const subsCasam = (subs || []).filter(s => norm(s.nome).includes(q));
        if (!paiCasa && !filhasCasam.length && !subsCasam.length) return null;
        return { pai, filhas: paiCasa ? filhas : filhasCasam, subs: paiCasa ? subs : subsCasam };
      })
      .filter(Boolean);
  }, [arvore, busca]);

  const abrir = () => {
    const r = gatilhoRef.current?.getBoundingClientRect();
    if (r) {
      const alturaPainel = 360;
      const paraCima = window.innerHeight - r.bottom < alturaPainel && r.top > alturaPainel;
      setPos({
        left: Math.max(8, Math.min(r.left, window.innerWidth - 288)),
        top: paraCima ? undefined : r.bottom + 4,
        bottom: paraCima ? window.innerHeight - r.top + 4 : undefined,
        width: Math.max(r.width, 260),
      });
    } else {
      setPos({ left: 20, top: 100, width: 280 });
    }
    setBusca("");
    setExpandido(null);
    setAberto(true);
  };

  const escolher = (nome, sub = "") => {
    // 2º argumento: SUBCATEGORIA embutida escolhida junto (formulários que
    // têm o campo subcategoria aproveitam; os demais ignoram sem quebrar).
    onChange?.(nome, sub);
    setAberto(false);
  };

  // "+ Criar categoria" sem sair do formulário (pedido 2026-09-29): o App
  // escuta este evento e cadastra (tipo do contexto, cor padrão); aqui só
  // dispara e já seleciona o nome. Nome igual a um existente vira seleção.
  const criarECategorizar = (nome) => {
    const nm = String(nome || "").trim();
    if (!nm) return;
    window.dispatchEvent(new CustomEvent("af4:categoria-criar", { detail: { nome: nm, tipo } }));
    escolher(nm);
  };
  const buscaLimpa = busca.trim();
  const jaExiste = !!buscaLimpa && [...nomes].some(n => norm(n) === norm(buscaLimpa));

  useEffect(() => {
    if (!aberto) return;
    const esc = (e) => { if (e.key === "Escape") setAberto(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [aberto]);

  const gatilhoSty = compacto
    ? {
        fontSize: 11.5, padding: "3px 8px", borderRadius: 10, maxWidth: 160,
        background: "transparent", border: `1px dashed ${T.border}`, color: T.muted,
        cursor: "pointer", textAlign: "left", overflow: "hidden",
        textOverflow: "ellipsis", whiteSpace: "nowrap", ...style,
      }
    : {
        width: "100%", boxSizing: "border-box", fontSize: 13, padding: "9px 11px",
        borderRadius: 12, background: T.bg, border: `1px solid ${T.border}`,
        color: value ? T.ink : T.muted, cursor: "pointer", textAlign: "left",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8, ...style,
      };

  const linhaSty = (indent = false) => ({
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
    width: "100%", textAlign: "left", cursor: "pointer",
    padding: indent ? "8px 12px 8px 28px" : "9px 12px",
    background: "transparent", border: "none", borderBottom: `1px solid ${T.border}55`,
    fontSize: 13, color: T.ink,
  });

  return (
    <>
      <button type="button" ref={gatilhoRef} onClick={abrir} title={value || placeholder} style={gatilhoSty}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {foraDoCadastro ? `⚠ ${value}` : (value || placeholder)}
        </span>
        {!compacto && <span style={{ color: T.muted, fontSize: 10, flexShrink: 0 }}>▼</span>}
      </button>

      {aberto && (
        <>
          <div onClick={() => setAberto(false)}
               style={{ position: "fixed", inset: 0, zIndex: 998, background: "rgba(0,0,0,.18)" }} />
          <div style={{
            position: "fixed", zIndex: 999, left: pos.left, top: pos.top, bottom: pos.bottom,
            width: pos.width, maxWidth: "calc(100vw - 16px)",
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
            boxShadow: "0 12px 34px rgba(0,0,0,.28)", overflow: "hidden",
            display: "flex", flexDirection: "column", maxHeight: 360,
          }}>
            {/* Sempre visível: serve pra buscar E pra digitar o nome de uma
                categoria nova (a linha "+ Criar" aparece embaixo). */}
            <input autoFocus={window.innerWidth > 768} value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar ou criar categoria…"
              style={{ margin: 8, padding: "7px 10px", fontSize: 12.5, borderRadius: 10,
                       border: `1px solid ${T.border}`, background: T.bg, color: T.ink, outline: "none" }} />
            <div style={{ overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
              {foraDoCadastro && (
                <button type="button" onClick={() => escolher(value)} style={{ ...linhaSty(), color: T.gold }}>
                  ⚠ {value} <span style={{ fontSize: 10, color: T.faint }}>fora do cadastro</span>
                </button>
              )}
              {rotuloVazio && !busca && (
                <button type="button" onClick={() => escolher("")} style={{ ...linhaSty(), color: T.muted }}>
                  {rotuloVazio}
                </button>
              )}
              {filtrada.map(({ pai, filhas, subs = [] }) => {
                const temFilhas = filhas.length > 0 || subs.length > 0;
                const abertoAqui = expandido === pai.id || (!!busca.trim() && temFilhas);
                return (
                  <React.Fragment key={pai.id}>
                    <button type="button" style={linhaSty()}
                      onClick={() => temFilhas
                        ? setExpandido(x => (x === pai.id ? null : pai.id))
                        : escolher(pai.nome)}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        {pai.cor && <span style={{ width: 8, height: 8, borderRadius: "50%", background: pai.cor, flexShrink: 0 }} />}
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                       fontWeight: value === pai.nome ? 700 : 500,
                                       color: value === pai.nome ? T.gold : T.ink }}>
                          {pai.nome}
                        </span>
                      </span>
                      {temFilhas && (
                        <span style={{ fontSize: 11, color: T.muted, flexShrink: 0 }}>
                          {abertoAqui ? "▾" : "▸"} {filhas.length + subs.length}
                        </span>
                      )}
                    </button>
                    {temFilhas && abertoAqui && (
                      <>
                        <button type="button" onClick={() => escolher(pai.nome)}
                          style={{ ...linhaSty(true), color: T.gold, fontWeight: 600, background: `${T.gold}0d` }}>
                          ✓ Usar {pai.nome}
                        </button>
                        {filhas.map(f => (
                          <button type="button" key={f.id} onClick={() => escolher(f.nome)}
                            style={{ ...linhaSty(true),
                                     fontWeight: value === f.nome ? 700 : 400,
                                     color: value === f.nome ? T.gold : T.ink,
                                     background: `${T.bgSoft || T.bg}` }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              {f.cor && <span style={{ width: 7, height: 7, borderRadius: "50%", background: f.cor, flexShrink: 0 }} />}
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nome}</span>
                            </span>
                          </button>
                        ))}
                        {/* Subcategorias EMBUTIDAS do pai: escolher = categoria
                            do pai + subcategoria preenchida (2º arg do onChange). */}
                        {subs.map(s => (
                          <button type="button" key={s.id || s.nome} onClick={() => escolher(pai.nome, s.nome)}
                            style={{ ...linhaSty(true), fontWeight: 400, color: T.ink,
                                     background: `${T.bgSoft || T.bg}` }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", border: `1.5px solid ${pai.cor || T.muted}`, flexShrink: 0 }} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {s.nome} <span style={{ fontSize: 10, color: T.faint }}>· sub</span>
                              </span>
                            </span>
                          </button>
                        ))}
                      </>
                    )}
                  </React.Fragment>
                );
              })}
              {filtrada.length === 0 && !buscaLimpa && (
                <div style={{ padding: 16, textAlign: "center", fontSize: 12.5, color: T.muted }}>
                  Nada encontrado.
                </div>
              )}
              {buscaLimpa && !jaExiste && (
                <button type="button" onClick={() => criarECategorizar(buscaLimpa)}
                  style={{ ...linhaSty(), color: T.gold, fontWeight: 600 }}>
                  ＋ Criar categoria “{buscaLimpa}”
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
