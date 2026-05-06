---
name: Icon System
description: Lucide icon usage, sizes, colors, and tab bar mapping
type: reference
---

# Ícones

Biblioteca: `lucide-react-native`.
Estilo: stroke fino, `strokeWidth: 1.8`. Sem fill. Sem emoji como ícone.

## Tamanhos

| Tamanho | Uso                                    |
| ------- | -------------------------------------- |
| 16px    | Ícones em banners de aviso e chips     |
| 18px    | Ícones dentro de botões                |
| 20px    | Ícones inline e tab bar (inativo)      |
| 22px    | Tab bar (ativo)                        |
| 24px    | Ícones de ação em headers e botões     |
| 28–32px | Ícones em estados de sucesso/erro      |
| 48px    | Empty state (centralizado)             |

## Cores

| Estado   | Cor                        |
| -------- | -------------------------- |
| Padrão   | `textMuted` (`#888888`)    |
| Ativo    | `accentPrimary` (`#00C896`)|

## Tab bar

| Ícone Lucide  | Label     | Rota                 |
| ------------- | --------- | -------------------- |
| `BarChart2`   | Dashboard | `/(tabs)/`           |
| `FileText`    | Extratos  | `/(tabs)/extratos`   |
| `Target`      | Metas     | `/(tabs)/goals`      |
| `User`        | Perfil    | `/(tabs)/profile`    |

Tab bar: fundo `bgSurface`, sem label de texto — apenas ícone.
Ícone ativo: `accentPrimary`. Ícone inativo: `textMuted`.

## Mapeamento de ícones por contexto

| Ícone Lucide      | Uso                                         |
| ----------------- | ------------------------------------------- |
| `Upload`          | Botão "Importar" e área de drop de PDF      |
| `FileText`        | Arquivo PDF selecionado                     |
| `CheckCircle`     | Sucesso, transação revisada, item selecionado|
| `AlertTriangle`   | Baixa confiança da IA, aviso de duplicata   |
| `X`               | Fechar sheet, erro genérico                 |
| `ChevronRight`    | Item de lista com ação                      |
| `Edit2`           | Editar categoria                            |
| `Trash2`          | Excluir item                                |
| `LogOut`          | Sair da conta                               |
| `Plus`            | Criar nova meta                             |
