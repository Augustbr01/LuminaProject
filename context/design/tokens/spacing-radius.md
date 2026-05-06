---
name: Spacing and Radius Tokens
description: Spacing scale and border radius tokens used in Lumina
type: reference
---

# Spacing e Border Radius

## Espaçamento

Definido em `frontend/constants/spacing.ts`.

| Token | Valor | Uso típico                          |
| ----- | ----- | ----------------------------------- |
| `xs`  | 4px   | Gap entre ícone e label             |
| `sm`  | 8px   | Espaçamento interno de badge, gap   |
| `md`  | 16px  | Padding horizontal de tela, gap de card |
| `lg`  | 24px  | Espaçamento entre seções            |
| `xl`  | 32px  | Espaçamento maior, padding de sheet |

## Border Radius

Definido em `frontend/constants/radius.ts`.

| Token    | Valor | Componente                          |
| -------- | ----- | ----------------------------------- |
| `button` | 10px  | Botões, inputs, chips de step       |
| `card`   | 16px  | Cards (`Card` component)            |
| `badge`  | 20px  | Badges de categoria e status        |
| `modal`  | 20px  | Bottom sheets (cantos superiores)   |

## Padrões de layout

- **Tela principal:** `ScrollView` com padding horizontal `md` (16px) e gap `md` (16px) entre cards.
- **Cards:** fundo `bgSurface`, border radius 16px, padding 16px, sem sombra.
- **Bottom sheet:** fundo `bgElevated`, border radius 20px nos cantos superiores.
- **Header de tela:** título à esquerda (22px/500), ação opcional à direita (ícone 24px).
- **Empty state:** ícone centralizado 48px (`textMuted`), body text (`textMuted`), botão primary abaixo.
