---
name: Color Tokens
description: All color tokens used across the Lumina design system
type: reference
---

# Colors

Definidos em `frontend/constants/colors.ts` como constantes TypeScript.
Nenhum hex hardcoded é permitido nos componentes — sempre via token.

## Paleta base

| Token           | Hex                        | Uso                                        |
| --------------- | -------------------------- | ------------------------------------------ |
| `bgBase`        | `#0F0F0F`                  | Fundo do app                               |
| `bgSurface`     | `#1A1A1A`                  | Cards, tab bar                             |
| `bgElevated`    | `#242424`                  | Bottom sheets, modais, superfícies elevadas |
| `textPrimary`   | `#F5F5F5`                  | Texto principal                            |
| `textMuted`     | `#888888`                  | Texto secundário, ícones inativos          |
| `accentPrimary` | `#00C896`                  | Botão CTA, estado ativo, indicadores +     |
| `accentSoft`    | `rgba(0, 200, 150, 0.12)`  | Fundo de badge, tints sutis                |
| `borderDefault` | `#2A2A2A`                  | Divisórias, bordas de card                 |
| `stateError`    | `#F04E4E`                  | Erros, ações destrutivas                   |
| `stateSuccess`  | `#00C896`                  | Confirmações de sucesso (= accentPrimary)  |
| `stateWarning`  | `#F5A623`                  | Flags, avisos, baixa confiança da IA       |

## Cores de categoria

Usadas exclusivamente em gráficos e badges de categoria.
Definidas em `frontend/constants/categories.ts`.

| Categoria      | Hex       |
| -------------- | --------- |
| `alimentacao`  | `#F5A623` |
| `transporte`   | `#378ADD` |
| `moradia`      | `#7F77DD` |
| `lazer`        | `#D85A30` |
| `saude`        | `#00C896` |
| `assinaturas`  | `#888780` |
| `compras`      | `#E24B4A` |
| `investimento` | `#1D9E75` |
| `outro`        | `#555555` |

## StatusBadge

Mapeamento de `ExtratoStatus` para cor:

| Status       | Background                   | Cor do texto    | Label         |
| ------------ | ---------------------------- | --------------- | ------------- |
| `OK`         | `rgba(0, 200, 150, 0.15)`    | `accentPrimary` | "OK"          |
| `PROCESSING` | `rgba(245, 166, 35, 0.15)`   | `stateWarning`  | "Processando" |
| `ERROR`      | `rgba(240, 78, 78, 0.15)`    | `stateError`    | "Erro"        |
