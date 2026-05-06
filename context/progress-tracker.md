# Progress Tracker

Update this file after every session.
This file is the single source of truth for where
the implementation currently stands.

---

## ▶ Current Session

**S4 — User sync endpoint**

> Read the full definition of this session in
> `context/backend-development-plan.md` before starting.

---

## Session Status

| #   | Session                                  | Status         |
| --- | ---------------------------------------- | -------------- |
| S0  | Setup do projeto NestJS                  | ✅ Completed   |
| S1  | Prisma + PostgreSQL (NeonDB)             | ✅ Completed   |
| S2  | Configuração de testes (Jest)            | ✅ Completed   |
| S3  | ClerkAuthGuard + decorators              | ✅ Completed   |
| S4  | User sync endpoint                       | ⬜ Not started |
| S5  | IaService (isolado)                      | ⬜ Not started |
| S6  | POST /extratos: regra (sem IA)           | ⬜ Not started |
| S7  | POST /extratos: IA + persistência        | ⬜ Not started |
| S8  | GET /extratos                            | ⬜ Not started |
| S9  | GET /transactions                        | ⬜ Not started |
| S10 | PATCH /transactions/:id                  | ⬜ Not started |
| S11 | GET /dashboard/summary                   | ⬜ Not started |
| S12 | GET /dashboard/history                   | ⬜ Not started |
| S13 | POST/GET /goals (sem progresso)          | ⬜ Not started |
| S14 | Cálculo de progresso e previsão          | ⬜ Not started |
| S15 | Hardening (validação, filter, logger)    | ⬜ Not started |
| S16 | Deploy ready                             | ⬜ Not started |

Legend: ✅ Completed · 🔄 In progress · ⬜ Not started · ⬛ Blocked

---

## Open Questions

### OQ-2 (Bloco 3 — IA / Bloco 6 — Dashboard) ✅ Resolvida em 2026-05-06

**Convenção de sinal de `Transaction.amount`.**

✅ **Escolhido: B — Unsigned + tipo**

Rationale: Schema explícito (`amount` sempre positivo + `type: 'debit' | 'credit'`) 
elimina ambiguidade nas agregações, reduz bugs em cálculos (Dashboard, Goals),
e suporta futura adição de créditos (salários, transferências) sem mudanças 
na convenção.

**Impacta:** prompt da IA (S5), schema da `Transaction`
(potencial migration), Dashboard (S11), filtros do
TransactionsService (S9), cálculo de progresso de Goals
(S14 — investimento é débito).

### OQ-3 (Bloco 6 — Dashboard) ✅ Resolvida em 2026-05-06

**Filtro por banco em `GET /dashboard/summary`.**

✅ **Escolhido: A — Endpoint aceita `?banco=`**

O endpoint suporta query param opcional `?banco=nomeDoBanco` para filtro 
server-side. Resposta varia conforme query, retornando apenas dados do 
banco selecionado. Permite UX com seletor de banco no mobile sem overhead 
de dados.

**Impacta:** `DashboardService.summary` (S11), DTO da resposta com query param,
telas correspondentes do mobile.

### OQ-1 (Bloco 7 — Metas) ✅ Resolvida em 2026-05-05

1. **Progresso:** considera transações de `investimento`
   **desde a data de criação da meta** (não toda a história).
   Filtro: `transaction.date >= goal.createdAt` AND
   `transaction.category = 'investimento'`.
2. **Previsão:** média mensal calculada sobre **toda a
   história de extratos importados pelo usuário** (todos
   os meses com pelo menos 1 transação contam no denominador).
   `previsaoConclusao = createdAt + (targetAmount - valorAcumulado) / mediaMensal`.
   Se `mediaMensal == 0`, retorna `null`.
3. **Vencimento:** meta vencida **continua acumulando**.
   Não existe status `vencida` no modelo. A UI sinaliza
   visualmente no mobile quando `deadline < hoje && percentual < 100`,
   mas o back-end não muda nada.

---

## Session Log

Use this section to record decisions made during each session.
Add a new entry when closing a session.

### Pós-S3 — Correções de modelagem (revisão de schema)
**Closed:** 2026-05-06
**Decisions:**
- Removidos `Extrato.status` e enum `ExtratoStatus`. Eram estado
  morto: fluxo é síncrono (S7), nunca grava `PROCESSING`/`ERROR`.
  Se assíncrono entrar no escopo no futuro, o enum pode ser
  reintroduzido com os valores apropriados ao novo fluxo.
- Adicionado `Transaction.updatedAt` (`@updatedAt`) — necessário
  para auditoria das revisões manuais (S10) e debug.
- CHECK constraints adicionadas via raw SQL na migration:
  `Transaction.confidence ∈ [0, 1]` e `Goal.targetAmount > 0`.
  Defesa em profundidade contra DTO bypass.
- Documentado em `architecture.md`: convenção do prompt da IA
  para classificar transferências para conta investimento como
  `investimento` (crítico para Goals), seção de constraints SQL,
  e plano de índices para S15.
- `project-overview.md`: substituído "Status de processamento
  exibido na tela: processando → ok | erro" por descrição de
  loading transiente (não persistido).
- `code-standards.md`: removida menção a `ExtratoStatus` na
  regra de enums.
- `backend-development-plan.md`: removidas referências a
  `status = OK` em S7. Adicionado plano de índices em S15
  apontando para `architecture.md`.
- Migration aplicada no NeonDB:
  `20260506160646_post_review_adjustments`.
- Levantadas duas open questions bloqueantes (OQ-2 e OQ-3) que
  precisam ser resolvidas antes de S5 e S11 respectivamente.
**Deviations from plan:** N/A — correções pós-revisão; o plano
foi ajustado para refletir a nova realidade do schema.

### S3 — ClerkAuthGuard + decorators
**Closed:** 2026-05-06
**Decisions:**
- `@clerk/clerk-sdk-node` instalado (v4.x, re-exports `@clerk/backend`).
- `verifyToken` requer `issuer` obrigatório na assinatura desta versão; passado `null` para pular validação de issuer (secretKey é suficiente para verificação).
- Guard registrado como `APP_GUARD` global em `AppModule` — toda rota é protegida por padrão.
- `@Public()` usa `SetMetadata(IS_PUBLIC_KEY, true)`; guard lê com `reflector.getAllAndOverride` verificando handler e class.
- `@CurrentUser()` retorna `{ clerkId: string }` lido de `request.user` (populado pelo guard).
- `RequestWithUser` em `src/common/types/request-with-user.type.ts`.
- 6 testes unitários cobrindo: @Public() bypass, token ausente, scheme errado, token inválido/expirado, token válido (user populado), verificação do IS_PUBLIC_KEY.
- Guard: 100% statements/lines, 91.66% branches (≥90% exigido). Global: ≥70% em todas as métricas.
**Deviations from plan:** `issuer: null` necessário pela assinatura da versão instalada do SDK.

### S2 — Configuração de testes (Jest)
**Closed:** 2026-05-05
**Decisions:**
- `jest.config.ts` criado com ts-jest; tsconfig override `module: CommonJS`, `moduleResolution: node`, `resolvePackageJsonExports: false` necessário porque o tsconfig base usa `nodenext` (incompatível com ts-jest sem override).
- Bloco `jest` removido de `package.json`; substituído por `"ts-node"` override (CommonJS) para que o Jest leia `jest.config.ts` via ts-node sem erro de módulo.
- `collectCoverageFrom` exclui `*.module.ts`, `*.spec.ts` e `main.ts` — apenas services e guards contam para o threshold de 70%.
- `test/jest-e2e.json` atualizado com o mesmo override de tsconfig e `"passWithNoTests": true`.
- `test/mocks/prisma.mock.ts` criado com `createPrismaMock()` cobrindo todos os modelos (`user`, `extrato`, `transaction`, `goal`) e `$transaction`.
- `test/app.e2e-spec.ts` substituído por placeholder (`it.todo`) — o endpoint `GET /` foi removido em S0.
- Fix colateral: `prisma/schema.prisma` estava sem `url = env("DATABASE_URL")` no datasource (bug de S1 — `prisma generate` falhava). Adicionado e client regenerado.
**Deviations from plan:** Nenhuma além do fix do schema.prisma.

### S1 — Prisma + PostgreSQL (NeonDB)
**Closed:** 2026-05-05
**Decisions:**
- Prisma 7.x (instalado por padrão pelo npm) tem breaking change: `url` no `datasource` não é mais suportado no `schema.prisma`. Feito downgrade para Prisma 6 (`^6.19.3`) para manter compatibilidade com o plano.
- `prisma/schema.prisma` criado com User, Extrato, Transaction, Goal e enums ExtratoStatus + Category, idêntico ao definido em `architecture.md`.
- Migration `20260505204657_init` aplicada com sucesso no NeonDB (sa-east-1).
- `PrismaService` estende `PrismaClient` e implementa `OnModuleInit`/`OnModuleDestroy`.
- `PrismaModule` decorado com `@Global()` e registrado em `AppModule`.
- `postinstall`: `prisma generate`. `start:prod`: `prisma migrate deploy && node dist/main`.
**Deviations from plan:** Downgrade para Prisma 6 (plano assumia Prisma 5/6; Prisma 7 tem API incompatível).

### S0 — Setup do projeto NestJS
**Closed:** 2026-05-05
**Decisions:**
- Projeto NestJS já existia via CLI — ajustado ao invés de recriado.
- `tsconfig.json` corrigido: adicionado `"strict": true`, removidos `noImplicitAny: false` e `strictBindCallApply: false`, `baseUrl` corrigido para `"."`.
- `eslint.config.mjs`: `no-explicit-any` e `no-floating-promises` elevados para `'error'`.
- `app.module.ts` simplificado para módulo vazio (sem AppController/AppService).
- `app.controller.ts`, `app.service.ts`, `app.controller.spec.ts` removidos (boilerplate do CLI).
- `main.ts`: `bootstrap()` alterado para `bootstrap().catch(console.error)` para satisfazer a regra `no-floating-promises`.
- `.env.example` criado com `DATABASE_URL`, `CLERK_SECRET_KEY`, `ANTHROPIC_API_KEY`, `PORT`.
- Estrutura de pastas criada: `extratos/dto`, `transactions/dto`, `dashboard`, `goals/dto`, `ia/types`, `ia/prompts`, `common/guards`, `common/decorators`, `common/prisma`, `common/types`.
- `.env` existente contém variáveis do mobile e um typo (`ANTROPIC_API`) — usuário deve reconfigurar o `.env` do backend com as variáveis corretas antes de S1.
**Deviations from plan:** none

<!--
Template — copy when closing a session:

### S0 — Setup do projeto NestJS
**Closed:** YYYY-MM-DD
**Decisions:**
- ...
**Deviations from plan:** none | (describe any)
-->

---

## Architecture Decisions (baseline)

- Back-end: NestJS + TypeScript + Prisma + PostgreSQL.
- Mobile: Expo (React Native) + TypeScript + Expo Router.
- Auth: Clerk (Expo SDK no mobile, clerk-sdk-node no back-end).
- IA: Claude API com modelo `claude-haiku-4-5`.
  PDF enviado como bloco `document` nativo — sem conversão.
- Hospedagem: Render (Web Service). Banco: NeonDB (serverless).
- ORM: Prisma. Migrations via `prisma migrate`.
- PDF não é salvo — processado em memória e descartado.
- Planos de usuário: fora do escopo do MVP.
- Idioma: código em inglês, UI em português brasileiro.
- Plataformas mobile: iOS e Android.
- Banco inicializado via `npx neonctl@latest init`.