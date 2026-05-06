---
name: Auth Screen
description: Sign in / Sign up screen design spec
type: reference
---

# Autenticação

Tela de entrada do app. Via Clerk (`@clerk/clerk-expo`).

## Layout

Tela cheia em `bgBase`. Sem tab bar.

### Estrutura (top → bottom)

1. **Logo** — `assets/logo-transparent.png`, 56×56px, centralizado.
2. **Título do app** — "Lumina" (22px/500, `textPrimary`, centralizado).
3. **Tagline** — "Controle financeiro inteligente" (14px, `textMuted`, centralizado).
4. **Toggle sign in / sign up** — duas abas side-by-side:
   - Ativa: fundo `bgElevated`, texto `textPrimary`
   - Inativa: transparente, texto `textMuted`
   - Border radius 8px; container fundo `bgSurface`, border radius 10px
5. **Campos de formulário:**
   - E-mail (type `email`)
   - Senha (type `password`)
   - Em modo `signin`: link "Esqueci a senha" à direita (13px, `accentPrimary`)
6. **Botão principal** — `Button variant="primary"`, largura 100%.
   - Sign in: "Entrar"
   - Sign up: "Criar conta"
7. **Divider** — linha `borderDefault` + texto "ou" centralizado (`textMuted`).
8. **Botão Google** — borda `borderDefault`, fundo transparente, Google G icon inline + "Continuar com Google" (14px/500, `textPrimary`).
9. **Rodapé legal** — "Ao continuar, você concorda com nossos Termos de Uso e Política de Privacidade" (11px, `textMuted`). Links em `accentPrimary`.

## Input style

```
background: bgSurface
border: 1px solid borderDefault
border-radius: 10px
padding: 14px 16px
fontSize: 15px
color: textPrimary (preenchido) | textMuted (placeholder)
fontFamily: Inter
outline: none
```

## Comportamento

- Toggle entre `signin` e `signup` não limpa os campos.
- Após autenticação bem-sucedida → navega para `/(tabs)/` (Dashboard).
- Clerk gerencia sessão — não há estado de auth no app além do token.
