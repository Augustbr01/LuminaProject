---
name: Chart Components
description: PieChart and BarChart visual spec and data format
type: reference
---

# Gráficos

Biblioteca de produção: `react-native-gifted-charts`.
No protótipo HTML: SVG puro.

---

## PieChart

Gráfico de pizza para distribuição por categoria.

### Props

| Prop   | Tipo     | Default | Descrição                        |
| ------ | -------- | ------- | -------------------------------- |
| `data` | array    | —       | Array de segmentos (ver abaixo)  |
| `size` | number   | `160`   | Diâmetro em px                   |

### Formato de data

```typescript
type PieSegment = {
  label:    string;   // ex: "Alimentação"
  value:    number;   // valor em R$
  color:    string;   // hex da categoria
  category: string;   // chave da categoria
}
```

### Visual

- Gráfico donut: círculo central 50% do raio em `bgSurface` (cria efeito de buraco).
- Sem bordas externas — integra naturalmente ao `Card` container.
- Cores: `CategoryColors` por segmento.
- Exibido ao lado de legenda com máximo de 5 itens + "+N categorias".

### Legenda

Cada item da legenda:
- Dot colorido (8px, circular, cor da categoria)
- Nome da categoria (12px, `textPrimary`)
- Valor formatado (12px, `textMuted`)

---

## BarChart

Gráfico de barras para histórico mensal (últimos 6 meses).

### Props

| Prop     | Tipo   | Default | Descrição                    |
| -------- | ------ | ------- | ---------------------------- |
| `data`   | array  | —       | Array de barras (ver abaixo) |
| `height` | number | `100`   | Altura máxima das barras     |

### Formato de data

```typescript
type BarItem = {
  label:   string;   // ex: "Mai"
  value:   number;   // valor em R$
  current: boolean;  // true = mês atual (opacidade 100%)
}
```

### Visual

- Cor única: `accentPrimary`.
- Barra do mês atual: `opacity: 1`.
- Barras anteriores: `opacity: 0.45`.
- Labels abaixo das barras: 10px, `textMuted`, fonte Inter.
- Barra: largura 28px, gap 10px, border radius 4px.
- Sem eixos, sem grid, sem tooltips — leitura direta.
- SVG com `width: 100%` dentro do `Card`.
