---
name: Typography Tokens
description: Type scale and copy conventions used in Lumina
type: reference
---

# Typography

Fonte: **Inter** (via Expo Google Fonts). Sem fonte secundária.
Pesos usados: 400 (regular) e 500 (medium). Nenhum bold 700 exceto
no estilo `highlight`.

## Escala

| Token          | Tamanho | Peso | Transform            | Uso                             |
| -------------- | ------- | ---- | -------------------- | ------------------------------- |
| `screenTitle`  | 22px    | 500  | —                    | Título de tela (header)         |
| `sectionLabel` | 13px    | 500  | UPPERCASE, spacing 0.5 | Rótulo de seção (`SectionTitle`) |
| `body`         | 15px    | 400  | —                    | Texto geral, itens de lista     |
| `caption`      | 12px    | 400  | —                    | Texto auxiliar, datas, contagem |
| `highlight`    | 32–36px | 500  | —                    | Valor monetário principal       |

## Convenções de casing

| Contexto            | Regra                                              |
| ------------------- | -------------------------------------------------- |
| Rótulos de seção    | ALL CAPS com letter-spacing ("GASTOS DO MÊS")      |
| Títulos de tela     | Title Case ("Dashboard", "Minhas Metas")           |
| Labels de botão     | Sentence case ("Importar extrato", "Criar meta")   |
| Nomes de categoria  | Sentence case com acentos ("Alimentação")          |

## Formato de valores

| Tipo        | Exemplo              |
| ----------- | -------------------- |
| Moeda       | `R$ 1.234,56`        |
| Porcentagem | `12% a mais que...`  |
| Data        | `DD/MM` ou "Mai 2026"|

## Exemplos de cópia

- **Empty state:** "Nenhum extrato importado ainda. Toque em 'Importar extrato' para começar."
- **Flag de baixa confiança:** "Revisão sugerida — a categoria pode não estar correta."
- **Bloqueio de duplicata:** "Você já importou o extrato deste banco para este mês."
- **Progresso de meta:** "68% concluído · Previsão: Jun 2026"
- **Status de processamento:** "A IA está extraindo e categorizando suas transações"
- **Sucesso:** "42 transações categorizadas com sucesso."
