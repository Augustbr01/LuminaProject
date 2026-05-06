---
name: Design System Overview
description: Index of all design documentation extracted from the Claude Design handoff
type: reference
---

# Lumina Design System

Design exportado do Claude Design (claude.ai/design).

## Estrutura

```
context/design/
├── README.md                   ← Este arquivo
├── tokens/
│   ├── colors.md               ← Paleta e tokens de cor
│   ├── typography.md           ← Escala tipográfica
│   ├── spacing-radius.md       ← Espaçamento e border radius
│   └── icons.md               ← Sistema de ícones (Lucide)
├── components/
│   ├── primitives.md           ← Card, Button, Badge, SectionTitle, etc.
│   ├── charts.md               ← PieChart e BarChart
│   └── navigation.md          ← TabBar, ScreenHeader, PhoneShell
└── features/
    ├── auth.md                 ← Autenticação (Sign in / Sign up)
    ├── dashboard.md            ← Dashboard
    ├── extratos.md             ← Lista de extratos
    ├── import-flow.md          ← Fluxo de importação de PDF
    ├── transactions.md         ← Lista de transações + revisão de categoria
    ├── goals.md               ← Metas financeiras
    └── profile.md             ← Perfil do usuário
```

## Princípios visuais

- **Dark only** — sem modo claro. Nenhum valor hex hardcoded nos componentes.
- **Acento único** — `#00C896` (verde-esmeralda) para ações, sucesso e estado ativo.
- **Sem sombras** — superfícies se diferenciam por cor de fundo, não por elevação.
- **Sem emoji** — apenas ícones Lucide (stroke fino, 1.8px).
- **Fonte única** — Inter em todo o app.
- **Cópia em pt-BR**, código em inglês.

