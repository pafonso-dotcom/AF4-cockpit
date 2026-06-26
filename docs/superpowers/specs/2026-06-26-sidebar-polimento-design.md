# Sidebar (layout vertical) — polimento "Cloud Dock"

Data: 2026-06-26 · App: **pessoal** (`apps/cars-web`) · Depois: replicar no comercial.

## Contexto

O app já tem um layout vertical com sidebar (`HeaderVertical` em
`src/components/Header.jsx`), ativado pela preferência `localStorage("af4:layout")`
(`useLayout.js`) e escolhível em Configurações → "Layout das abas". Ele já faz a
navegação em árvore (pastas Finanças/Investimentos/Negócio → subtelas → filhos
contas/cartões/agenda) e já volta pro menu de topo em celular retrato.

Pedido do usuário (inspirado num print de dashboard "Cloud Dock"): deixar a
sidebar com a cara do print — **painel lateral flutuante com bordas arredondadas**
e **pastas em árvore com linhas-guia** — além de um **card no rodapé** e **ligar a
sidebar por padrão**. Mobile não muda.

## Escopo (4 itens aprovados)

1. **Painel flutuante + bordas arredondadas**
   - O `<aside>` vira painel "solto": margem ~10px (top/left/bottom), `borderRadius`
     ~20px, sombra suave. Mantém o **footprint de 220px** (painel ~200px recuado por
     dentro), então o `marginLeft: 220` do conteúdo (App.jsx) **não muda**.
   - Itens de pasta (módulo) e subitens: fundo em **pílula arredondada** quando
     ativos/hover.

2. **Pastas em árvore com linhas-guia**
   - Com a pasta aberta, as subtelas ganham uma **linha vertical guia** à esquerda e
     um **tracinho horizontal** por item (cara de árvore de arquivos), realçando o
     recuo atual. Mesma ideia para os filhos (contas/cartões/agenda), com recuo maior.

3. **Card no rodapé** (acima de "Configurações")
   - Cartão arredondado (estilo o "Upgrade" do print), com um **atalho destacado**
     que muda conforme a pasta ativa:
     - Finanças → "+ Nova transação"
     - Investimentos → "+ Novo aporte"
     - Negócio → "+ Recebimento"
   - Implementação: novo prop `onQuickAction(tipo)` passado ao `HeaderVertical`
     (o `HeaderHorizontal` já recebe `onQuickAction`; reusar o mesmo handler do App).
   - Evolução futura (fora deste escopo): trocar por barra "gasto do mês vs orçamento".

4. **Sidebar como padrão no desktop**
   - `useLayout.js` e `Configuracoes.jsx`: default passa de `"horizontal"` → `"vertical"`.
   - Mobile retrato continua forçando horizontal (lógica `forcaHorizontal` já existe).
   - Usuário pode trocar em Configurações a qualquer momento.

## Arquivos afetados

- `apps/cars-web/src/components/Header.jsx` — `HeaderVertical` (painel flutuante,
  linhas-guia, card de rodapé, novo prop `onQuickAction`).
- `apps/cars-web/src/lib/useLayout.js` — default `"vertical"`.
- `apps/cars-web/src/components/pages/Configuracoes.jsx` — default `"vertical"`.
- `apps/cars-web/src/App.jsx` — passar `onQuickAction` ao `Header` (se ainda não
  chega no caminho do vertical).

## Não-objetivos

- Não mexer no `HeaderHorizontal` (menu de topo) além do necessário.
- Não alterar o comportamento mobile.
- Não tocar no app comercial nesta fase.

## Verificação

- Build `pnpm --filter @repo/cars-web build`.
- Runtime headless: seed `af4:layout=vertical`, viewport desktop, abrir pasta e
  conferir: painel flutuante arredondado, linhas-guia nas subtelas, card de rodapé
  com o atalho certo por módulo. Conferir também que, sem `af4:layout` salvo, o
  desktop já abre vertical (default) e que mobile retrato cai no topo.
