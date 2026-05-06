---
name: Dashboard Screen
description: Monthly summary, pie chart, and bar chart screen design spec
type: reference
---

# Dashboard

Aba principal do app. Exibe resumo financeiro do mês atual.

## Header

- Título: "Dashboard"
- Ação direita: logo Lumina (28×28px, `objectFit: contain`)

## Cards (ordem de cima para baixo)

### 1. Summary Card

Resumo do mês atual.

| Elemento          | Estilo                                                   |
| ----------------- | -------------------------------------------------------- |
| Rótulo de seção   | "GASTO TOTAL · MAI 2026" — `SectionTitle`                |
| Valor total       | `R$ X.XXX,XX` — 36px/500, `accentPrimary`               |
| Variação vs mês anterior | `+N%` (`stateWarning`) ou `-N%` (`accentPrimary`) — 12px |
| Maior gasto       | "Maior gasto: [Categoria] · R$ X.XXX,XX" — 12px, `textMuted` com categoria colorida |

### 2. Gastos por Categoria

Gráfico de pizza + legenda lateral.

- Layout: `flex-row` com gap 16px.
- Esquerda: `PieChart` 140px de diâmetro.
- Direita: lista dos top 5 segmentos + "+N categorias" em 11px, `textMuted`.
- Cada linha da legenda: dot 8px + nome 12px + valor 12px `textMuted`.

### 3. Histórico Mensal

Gráfico de barras dos últimos 6 meses.

- `SectionTitle`: "HISTÓRICO MENSAL"
- `BarChart` com `height: 80`
- Dados: 6 meses (ex: Dez → Mai), mês atual com `current: true`

## Estados

- **Sem dados:** Empty state centralizado — ícone 48px (`textMuted`), texto explicativo, botão "Importar extrato" (`variant="primary"`).
- **Com dados:** Layout normal com os 3 cards.

## Dados mock de referência

```typescript
summary = {
  total: 4820.50,
  prev:  4304.00,
  topCategory: 'alimentacao',
  topAmount:   1240.00
}
```
