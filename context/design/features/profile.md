---
name: Profile Screen
description: User profile screen design spec
type: reference
---

# Perfil

Aba de perfil do usuário. Exibe informações da conta e opções de configuração.

## Header

- Título: "Perfil"
- Sem ação à direita.

## Seções

### 1. Identidade do usuário

Card com avatar + informações:

```
[Avatar circular]  [Nome do usuário]
                   [E-mail]
```

- Avatar: círculo 56px, fundo `accentSoft`, inicial do nome em 22px/500 `accentPrimary`.
- Nome: 17px/500, `textPrimary`.
- E-mail: 13px, `textMuted`.

### 2. Estatísticas

Card com 3 métricas em row:

| Métrica          | Valor   | Label           |
| ---------------- | ------- | --------------- |
| Extratos         | N       | "extratos"      |
| Transações       | N       | "transações"    |
| Meses ativos     | N       | "meses ativos"  |

Layout: `flex-row`, cada item centralizado, separado por `Divider` vertical.
Valor: 22px/500, `textPrimary`. Label: 12px, `textMuted`.

### 3. Lista de configurações

Itens de menu estilo lista:

```
[Ícone]  [Label]           [ChevronRight]
```

| Ícone        | Label                    |
| ------------ | ------------------------ |
| `User`       | Editar perfil            |
| `Bell`       | Notificações             |
| `Shield`     | Privacidade e segurança  |
| `HelpCircle` | Ajuda e suporte          |

Cada item:
- Padding: `16px 0`
- Ícone: 20px, `textMuted`
- Label: 15px, `textPrimary`
- ChevronRight: 18px, `textMuted`
- Separados por `Divider`

### 4. Botão de sign out

`Button variant="danger"` com ícone `LogOut`.
Label: "Sair da conta".
Largura 100%. Margem superior `lg` (24px).

## Comportamento

- Sign out: chama `signOut()` do Clerk → redireciona para tela de Auth.
- Dados de estatísticas: lidos do backend (contagem de extratos e transações do usuário).
- "Editar perfil": fora do escopo do MVP (tela não implementada).
