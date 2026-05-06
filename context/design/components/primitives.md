---
name: Primitive Components
description: Base UI components: Card, Button, Badge, SectionTitle, LoadingSpinner, Divider, ProgressBar
type: reference
---

# Componentes Primitivos

Todos vivem em `frontend/components/ui/`.
Nenhum valor hardcoded — tudo via tokens de `constants/`.

---

## Card

Superfície elevada padrão do app.

| Prop       | Tipo    | Default    | Descrição                          |
| ---------- | ------- | ---------- | ---------------------------------- |
| `children` | ReactNode | —        | Conteúdo interno                   |
| `style`    | object  | `{}`       | Overrides de estilo                |
| `elevated` | boolean | `false`    | Usa `bgElevated` em vez de `bgSurface` |

**Visual:** fundo `bgSurface`, border radius 16px, padding 16px, sem sombra.

---

## Button

| Variante  | Fundo           | Texto / Borda                  | Uso                         |
| --------- | --------------- | ------------------------------ | --------------------------- |
| `primary` | `accentPrimary` | `#000` (preto)                 | Ação principal da tela      |
| `outline` | Transparente    | Borda + texto `accentPrimary`  | Ação secundária             |
| `ghost`   | Transparente    | Texto `accentPrimary`, sem borda | Ação terciária / cancelar  |
| `danger`  | `stateError`    | `#fff`                         | Ações destrutivas           |

| Prop       | Tipo    | Default    |
| ---------- | ------- | ---------- |
| `variant`  | string  | `primary`  |
| `onPress`  | fn      | —          |
| `iconName` | string  | —          |
| `style`    | object  | `{}`       |

**Press state:** `opacity: 0.75` no `mouseDown` / `touchStart`.
**Border radius:** 10px. Font: 15px/500.

---

## Badge

Chip de categoria com fundo colorido.

| Prop       | Tipo   | Descrição                                      |
| ---------- | ------ | ---------------------------------------------- |
| `category` | string | Chave de `CategoryColors` (ex: `"alimentacao"`) |
| `label`    | string | Texto customizado (fallback para `CategoryLabels[category]`) |

**Visual:** padding `3px 10px`, border radius 20px, fundo = cor da categoria, texto branco `#fff`, 11px/500.

---

## StatusBadge

Badge de status para extratos.

| Prop     | Tipo             |
| -------- | ---------------- |
| `status` | `ExtratoStatus`  |

Estados: `OK`, `PROCESSING`, `ERROR` — ver `tokens/colors.md`.

---

## SectionTitle

Rótulo de seção em uppercase.

```
fontSize: 13, fontWeight: 500, color: textMuted,
textTransform: uppercase, letterSpacing: 0.5, marginBottom: 10
```

---

## ProgressBar

Barra de progresso horizontal.

| Prop    | Tipo   | Descrição                     |
| ------- | ------ | ----------------------------- |
| `value` | number | 0–100 (percentual)            |

**Visual:** altura 6px, fundo `bgElevated`, fill `accentPrimary`, border radius 3px.
Transição `width 0.4s`.

---

## LoadingSpinner

Indicador de carregamento circular.

**Visual:** 28×28px, borda `borderDefault`, topo `accentPrimary`, animação spin 0.8s.
Centralizado com padding 32px.

---

## Divider

Linha separadora horizontal.

**Visual:** altura 1px, fundo `borderDefault`, margin `4px 0`.
