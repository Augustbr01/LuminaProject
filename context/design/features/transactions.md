---
name: Transactions Screen
description: Transaction list and category review flow design spec
type: reference
---

# Transações

Tela que abre após a importação bem-sucedida ou pelo tap num extrato OK.
Sobrepõe a tela de Extratos (posição absoluta, inset 0).

## Header

- Botão back (chevron-left, `textMuted`) à esquerda.
- Título: "[Banco] · [Mês]" — ex: "Nubank · Mai 2026" (22px/500).
- Sem ação à direita.

## Banner de revisão

Exibido acima da lista.

**Com pendências** (`confidence < 0.75` e não revisada):
```
[AlertTriangle, stateWarning]  "N transações com revisão sugerida"
fundo: rgba(245,166,35,0.10), borda: rgba(245,166,35,0.25), border radius 10px
```

**Sem pendências** (todas revisadas):
```
[CheckCircle, accentPrimary]  "Todas as categorias revisadas"
fundo: rgba(0,200,150,0.08), borda: rgba(0,200,150,0.20), border radius 10px
```

## Lista de transações

Cada item é uma linha tocável que abre o `CategoryPickerSheet`.

### Layout do item

```
[Descrição]  [AlertTriangle se baixa confiança | CheckCircle se revisada]
[Badge de categoria]    [Data]    [Valor]
```

| Elemento       | Estilo                                              |
| -------------- | --------------------------------------------------- |
| Descrição      | 14px/500, `textPrimary`                             |
| Flag           | `AlertTriangle` 14px `stateWarning` (confidence < 0.75 e não revisado) |
| Revisado       | `CheckCircle` 14px `accentPrimary`                  |
| Badge          | `Badge` component com cor da categoria              |
| Data           | 11px, `textMuted`                                   |
| Valor          | 14px/500, negativo = `stateError`, positivo = `accentPrimary` |

Separador entre itens: `Divider` (1px, `borderDefault`).
Padding vertical por item: `13px 0`.

### Dados mock de referência

```typescript
transactions = [
  { description: 'iFood · Refeição', amount: -54.90,   category: 'alimentacao',  date: '02/05', confidence: 0.97 },
  { description: 'Uber',             amount: -18.50,   category: 'transporte',   date: '02/05', confidence: 0.95 },
  { description: 'Netflix',          amount: -39.90,   category: 'assinaturas',  date: '01/05', confidence: 0.99 },
  { description: 'TXN 4821-X',       amount: -120.00,  category: 'outro',        date: '30/04', confidence: 0.52 }, // ← flag
  { description: 'Tesouro Direto',   amount: -500.00,  category: 'investimento', date: '28/04', confidence: 0.98 },
]
```

---

## CategoryPickerSheet

Bottom sheet para edição de categoria. Abre ao tocar em qualquer transação.

### Layout

1. **Handle** — barra cinza 36×4px centralizada.
2. **Header:**
   - "Editar categoria" (17px/500) + descrição da transação (12px, `textMuted`).
   - Botão X à direita para fechar.
3. **Chip de sugestão da IA:**
   - Fundo `rgba(245,166,35,0.08)`, borda `rgba(245,166,35,0.20)`, border radius 10px.
   - `AlertTriangle` 14px `stateWarning` + texto: "IA sugeriu **[Categoria]** com confiança baixa (XX%)"
4. **Grid de categorias:** 3 colunas × N linhas.

### Card de categoria no grid

| Estado      | Fundo                   | Borda                  |
| ----------- | ----------------------- | ---------------------- |
| Selecionado | `{cor}22` (12% opacity) | 1.5px `{cor}`          |
| Normal      | `bgSurface`             | 1px `borderDefault`    |

Cada card (border radius 12px, padding `12px 8px`):
- **Dot circular 28px:**
  - Selecionado: fundo `{cor}` com checkmark branco (14px, 2.5px stroke)
  - Normal: fundo `bgElevated` com dot interno 10px na cor da categoria
- **Label:** 10px/500, `textPrimary` (selecionado) ou `textMuted` (normal). Centralizado.

Categorias disponíveis: todas as 9 (`alimentacao`, `transporte`, `moradia`, `lazer`,
`saude`, `assinaturas`, `compras`, `investimento`, `outro`).

5. **Botão "Salvar categoria"** — primary, largura 100%, sticky no bottom.

### Comportamento

- Ao salvar: transação atualiza `category`, `reviewed = true`, `confidence = 1`.
- Badge da transação atualiza imediatamente (estado local).
- Flag `AlertTriangle` some. `CheckCircle` aparece.
- Banner de revisão recalcula o count.
- Quando todas revisadas → banner vira verde "Todas as categorias revisadas".
