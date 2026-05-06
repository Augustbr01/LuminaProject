---
name: Navigation Components
description: TabBar, ScreenHeader, PhoneShell, StatusBar specs
type: reference
---

# Navegação

---

## TabBar

Tab bar inferior com 4 abas.

### Visual

- Fundo: `bgSurface`
- Borda superior: 1px `borderDefault`
- Padding inferior: 16px (safe area), padding superior: 10px
- Ícone ativo: `accentPrimary` (22px)
- Ícone inativo: `textMuted` (22px)
- **Sem label de texto** — apenas ícone

### Tabs

| Index | Ícone Lucide | Rota                 |
| ----- | ------------ | -------------------- |
| 0     | `BarChart2`  | `/(tabs)/`           |
| 1     | `FileText`   | `/(tabs)/extratos`   |
| 2     | `Target`     | `/(tabs)/goals`      |
| 3     | `User`       | `/(tabs)/profile`    |

---

## ScreenHeader

Header padrão de tela.

### Props

| Prop     | Tipo      | Descrição                                |
| -------- | --------- | ---------------------------------------- |
| `title`  | string    | Título da tela                           |
| `action` | ReactNode | Elemento opcional à direita (botão/ícone)|

### Visual

- Padding: `16px 16px 8px`
- Título: 22px/500, `textPrimary`, alinhado à esquerda
- Ação: alinhada à direita (ícone 24px ou botão small)

### Exemplos de ação

- **Dashboard:** logo Lumina (28×28px, `objectFit: contain`)
- **Extratos:** botão verde "Importar" (Upload icon 16px + label 13px/500)
- **Metas:** ícone `Plus` (24px, `accentPrimary`)
- **Perfil:** sem ação

---

## ImportFlowHeader

Header específico do fluxo de importação (tela cheia, não usa `ScreenHeader`).

- Fundo: `bgBase` com borda inferior `borderDefault`
- Título: "Importar extrato" (16px/500)
- Botão fechar: ícone `X` (20px, `textMuted`) à direita
- Abaixo do header: **step progress bar** — 3 segmentos (banco | mês | arquivo),
  altura 3px, `accentPrimary` para completados, `borderDefault` para pendentes.

---

## PhoneShell (protótipo)

Apenas para o protótipo HTML — não gera código de produção.

- 375×812px (viewport iPhone padrão)
- Border radius 44px
- Borda `2px solid #333`
- Box shadow `0 24px 80px rgba(0,0,0,0.6)`
- ScrollView interno com `overflowY: auto`

---

## StatusBar (protótipo)

Barra de status mockada para o protótipo.

- Fundo: `bgBase`
- Padding: `14px 24px 6px`
- Hora fixa: "9:41"
- Ícones: sinal, wifi, bateria — todos em `textPrimary`
