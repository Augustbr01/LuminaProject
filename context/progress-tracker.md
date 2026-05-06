# Progress Tracker

Update this file after every session.
This file is the single source of truth for where
the implementation currently stands.

---

## ▶ Current Session

**S3 — ClerkAuthGuard + decorators**

> Read the full definition of this session in
> `context/backend-development-plan.md` before starting.

---

## Session Status

| #   | Session                                  | Status         |
| --- | ---------------------------------------- | -------------- |
| S0  | Setup do projeto NestJS                  | ✅ Completed   |
| S1  | Prisma + PostgreSQL (NeonDB)             | ✅ Completed   |
| S2  | Configuração de testes (Jest)            | ✅ Completed   |
| S3  | ClerkAuthGuard + decorators              | ⬜ Not started |
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