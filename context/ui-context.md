# UI Context

## Theme

Dark only. Sem modo claro. O design é um workspace
financeiro moderno — fundos escuros em grafite profundo,
superfícies levemente elevadas e acentos em verde-esmeralda
para indicar saúde financeira e ações positivas.

## Colors

Todos os componentes usam estes tokens como constantes
TypeScript em `frontend/constants/colors.ts`.
Nenhum valor hex hardcoded é permitido nos componentes.

```typescript
// frontend/constants/colors.ts
export const Colors = {
  bgBase:        '#0F0F0F',
  bgSurface:     '#1A1A1A',
  bgElevated:    '#242424',
  textPrimary:   '#F5F5F5',
  textMuted:     '#888888',
  accentPrimary: '#00C896',
  accentSoft:    'rgba(0, 200, 150, 0.12)',
  borderDefault: '#2A2A2A',
  stateError:    '#F04E4E',
  stateSuccess:  '#00C896',
  stateWarning:  '#F5A623',
} as const;
```

### Cores por Categoria de Transação

Usadas exclusivamente em gráficos e badges de categoria.
Definidas em `frontend/constants/categories.ts`.

```typescript
export const CategoryColors: Record<string, string> = {
  alimentacao:  '#F5A623',
  transporte:   '#378ADD',
  moradia:      '#7F77DD',
  lazer:        '#D85A30',
  saude:        '#00C896',
  assinaturas:  '#888780',
  compras:      '#E24B4A',
  investimento: '#1D9E75',
  outro:        '#555555',
};

export const CategoryLabels: Record<string, string> = {
  alimentacao:  'Alimentação',
  transporte:   'Transporte',
  moradia:      'Moradia',
  lazer:        'Lazer',
  saude:        'Saúde',
  assinaturas:  'Assinaturas',
  compras:      'Compras',
  investimento: 'Investimento',
  outro:        'Outro',
};
```

## Typography

Fonte: **Inter** (via Expo Google Fonts).
Definida em `frontend/constants/typography.ts`.

```typescript
export const Typography = {
  screenTitle:  { fontSize: 22, fontWeight: '500' },
  sectionLabel: { fontSize: 13, fontWeight: '500',
                  textTransform: 'uppercase', letterSpacing: 0.5 },
  body:         { fontSize: 15, fontWeight: '400' },
  caption:      { fontSize: 12, fontWeight: '400' },
  highlight:    { fontSize: 32, fontWeight: '500' },
} as const;
```

## Border Radius

```typescript
export const Radius = {
  button:  10,
  card:    16,
  badge:   20,
  modal:   20,
} as const;
```

## Spacing

Escala de espaçamento consistente em `frontend/constants/spacing.ts`.

```typescript
export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
} as const;
```

## Navigation

Expo Router com tabs na parte inferior. 4 abas:

| Ícone       | Label      | Rota              |
| ----------- | ---------- | ----------------- |
| BarChart2   | Dashboard  | `/(tabs)/`        |
| FileText    | Extratos   | `/(tabs)/extratos`|
| Target      | Metas      | `/(tabs)/goals`   |
| User        | Perfil     | `/(tabs)/profile` |

Tab bar: fundo `bgSurface`, ícone ativo `accentPrimary`,
ícone inativo `textMuted`. Sem label de texto nas tabs —
só ícone.

## Component Library

Componentes de UI customizados em `frontend/components/ui/`.
NativeWind para utilitários de layout e espaçamento.
Não usar bibliotecas de componentes de terceiros.

Componentes base obrigatórios a criar no início:

- `Card` — superfície elevada com padding padrão e
  border radius de card.
- `Button` — variantes: primary (fundo accentPrimary),
  outline (borda accentPrimary, fundo transparente),
  ghost (sem borda).
- `Badge` — chip de categoria com cor de fundo da
  categoria e texto branco.
- `SectionTitle` — label de seção em uppercase com
  espaçamento padrão.
- `LoadingSpinner` — indicador de carregamento
  com cor accentPrimary.

## Charts

Biblioteca: `react-native-gifted-charts`.

- Gráfico de pizza: usa `CategoryColors` para os segmentos.
- Gráfico de barras: cor única `accentPrimary` para as
  barras, fundo `bgSurface`.
- Sem bordas externas nos gráficos — integram
  naturalmente ao card container.

## Icons

Biblioteca: `lucide-react-native`.
Tamanhos: 20px para ícones inline e de tab bar,
24px para ícones de ação em botões e headers.
Cor padrão: `textMuted`. Cor ativa: `accentPrimary`.

## Layout Patterns

- **Tela principal**: ScrollView com padding horizontal
  de 16px e gap de 16px entre cards.
- **Cards**: fundo `bgSurface`, border radius 16px,
  padding 16px, sem sombra.
- **Bottom sheet**: para ações como importar extrato
  e criar meta. Fundo `bgElevated`, border radius 20px
  no topo.
- **Header de tela**: título à esquerda (22px/500),
  ação opcional à direita (ícone 24px).
- **Empty state**: ícone centralizado (48px, textMuted),
  texto descritivo (body, textMuted), botão de ação
  primary abaixo.
