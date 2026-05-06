---
name: Extratos Screen
description: Statement list screen design spec
type: reference
---

# Extratos

Lista de todos os extratos importados pelo usuário, agrupados por mês.

## Header

- Título: "Extratos"
- Ação direita: botão "Importar" — fundo `accentPrimary`, border radius 10px,
  padding `8px 14px`, ícone `Upload` (16px, `#000`) + texto "Importar" (13px/500, `#000`).
  Abre o `ImportFlowScreen` (tela cheia).

## Layout

`ScrollView` vertical. Grupos por mês com `SectionTitle` separando cada período.

### Card de extrato

Por extrato:
```
[Nome do banco]         [StatusBadge]
[N transações | "Processando..."]
```

- Nome: 15px/500, `textPrimary`
- Subtítulo: 12px, `textMuted`
- `StatusBadge` à direita (OK / PROCESSING / ERROR)

## Agrupamento

- Extratos do mesmo mês ficam sob o mesmo `SectionTitle` (ex: "MAIO 2026").
- Ordem: mais recente primeiro.
- Sem filtro por banco nessa tela — filtro existe no Dashboard.

## Estados do extrato

| Status       | Subtítulo            | Badge         |
| ------------ | -------------------- | ------------- |
| `OK`         | "42 transações"      | Verde "OK"    |
| `PROCESSING` | "Processando..."     | Amarelo       |
| `ERROR`      | "Erro ao processar"  | Vermelho      |

## Empty state

Quando não há extratos:
- Ícone `FileText` 48px, `textMuted`
- "Nenhum extrato importado ainda."
- Botão primary "Importar extrato"
