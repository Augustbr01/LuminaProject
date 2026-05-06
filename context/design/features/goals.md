---
name: Goals Screen
description: Financial goals list and create goal flow design spec
type: reference
---

# Metas

Aba de metas financeiras. Exibe progresso das metas com base nas transações
de categoria `investimento`.

## Header

- Título: "Minhas Metas"
- Ação direita: ícone `Plus` 24px, `accentPrimary`. Abre `CreateGoalSheet`.

## Lista de metas

Cada meta é um `Card` com:

```
[Nome da meta]
[ProgressBar]
[Valor acumulado / Valor alvo]    [Percentual]
[Previsão de conclusão]
```

| Elemento             | Estilo                                                    |
| -------------------- | --------------------------------------------------------- |
| Nome                 | 15px/500, `textPrimary`                                   |
| `ProgressBar`        | `value = (accumulated / targetAmount) * 100`              |
| Valores              | `R$ X.XXX` acumulado (12px, `textMuted`) / alvo (12px)    |
| Percentual           | `XX%` — 13px/500, `accentPrimary`                         |
| Previsão             | "Previsão: [Mês Ano]" ou "Concluído" — 12px, `textMuted`  |

### Meta concluída

Quando `accumulated >= targetAmount`:
- Percentual: "100%"
- Previsão: "Concluído"
- `ProgressBar` preenchida completamente.

### Dados mock de referência

```typescript
goals = [
  { name: 'Reserva de emergência', targetAmount: 10000, accumulated: 3200,  deadline: 'Dez 2026', prediction: 'Nov 2026' },
  { name: 'Viagem para Europa',    targetAmount: 15000, accumulated: 4890,  deadline: 'Jun 2027', prediction: 'Mai 2027' },
  { name: 'Notebook novo',         targetAmount: 4500,  accumulated: 4500,  deadline: 'Mar 2026', prediction: 'Concluído' },
]
```

## Empty state

- Ícone `Target` 48px, `textMuted`
- "Nenhuma meta criada ainda."
- Botão primary "Criar meta"

---

## CreateGoalSheet

Bottom sheet para criar nova meta.

### Layout

1. **Handle** — barra cinza 36×4px centralizada.
2. **Header:** "Nova meta" (18px/500) + botão X para fechar.
3. **Campos:**

   | Campo           | Tipo       | Label                              |
   | --------------- | ---------- | ---------------------------------- |
   | Nome da meta    | text       | "NOME DA META"                     |
   | Valor alvo      | number     | "VALOR ALVO (R$)"                  |
   | Data limite     | date/text  | "DATA LIMITE"                      |

   Label style: 12px/500, `textMuted`, uppercase, letterSpacing 0.5.
   Input style: igual ao da tela de Auth.

4. **Botão** — primary "Criar meta", largura 100%.

### Comportamento

- Campos obrigatórios: nome e valor alvo.
- Data limite: opcional (previsão calculada pelo ritmo atual quando ausente).
- Ao criar: chama `POST /goals` e recarrega a lista.
- O progresso é calculado automaticamente somando transações `category = 'investimento'`
  do usuário — não há campo de "valor acumulado" manual.
