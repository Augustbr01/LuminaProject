# Progress Tracker

Update this file after every session.
This file is the single source of truth for where
the implementation currently stands.

---

## ▶ Current Session

**S14 — Cálculo de progresso e previsão**

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
| S4  | User sync endpoint                       | ✅ Completed   |
| S5  | IaService (isolado)                      | ✅ Completed   |
| S6  | POST /extratos: regra (sem IA)           | ✅ Completed   |
| S7  | POST /extratos: IA + persistência        | ✅ Completed   |
| S8  | GET /extratos                            | ✅ Completed   |
| S9  | GET /transactions                        | ✅ Completed   |
| S10 | PATCH /transactions/:id                  | ✅ Completed   |
| S11 | GET /dashboard/summary                   | ✅ Completed   |
| S12 | GET /dashboard/history                   | ✅ Completed   |
| S13 | POST/GET /goals (sem progresso)          | ✅ Completed   |
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

### S13 — POST/GET /goals (sem progresso)
**Closed:** 2026-05-19
**Decisions:**
- Novo módulo `goals/` (controller, service, module, DTO) —
  fronteira própria conforme `code-standards.md`. `GoalsModule`
  importa apenas `UsersModule` (para `resolveUserId`); o
  `PrismaService` vem do `PrismaModule` global. Registrado em
  `AppModule`. Dependência só de S4, conforme o plano.
- `CreateGoalDto` valida os três campos via `class-validator`:
  `name` (`@IsString` + `@IsNotEmpty`), `targetAmount`
  (`@IsNumber` + `@IsPositive` — rejeita 0 e negativos) e
  `deadline` (`@Type(() => Date)` + `@IsDate` + `@MinDate(() =>
  new Date())`). `@MinDate` com função garante "data futura"
  avaliada no momento da request; `@Type` transforma a string
  ISO em `Date` (o `ValidationPipe` global usa `transform: true`).
  String de data inválida vira `Invalid Date` e cai no `@IsDate`.
- `GoalsService.create(clerkId, dto)` resolve `userId` via
  `usersService.resolveUserId` (invariante 3 — `userId` nunca
  vem do request) e faz um único `prisma.goal.create`. Sem
  regra de unicidade: o usuário pode ter várias metas (o plano
  não define constraint, e `Goal` não tem `@@unique`).
- `GoalsService.list(clerkId)` resolve `userId` e faz
  `prisma.goal.findMany` com `where: { userId }`, `orderBy:
  { createdAt: 'desc' }`. Ownership sempre no `where` — nenhuma
  meta de outro usuário retorna em nenhum caminho.
- Ambos os métodos usam `select` explícito
  `{ id, name, targetAmount, deadline, createdAt }` — sem
  `userId` no payload (mesma decisão de S8: não é sensível,
  mas é redundante e evita acoplar a chave interna ao cliente).
  Sem campo `progresso`/`valorAcumulado`/`percentual` — esses
  entram só em S14.
- Mapper `toDto` converte `targetAmount` (Decimal do Prisma)
  via `Number()` — mesma convenção do Dashboard (S11/S12) para
  Decimais; entrega JSON numérico ao mobile em vez de string.
- Controller: `@Post()` com `@HttpCode(HttpStatus.CREATED)`
  explícito (mesmo padrão do `POST /extratos` de S7) e `@Get()`.
  Ambos devolvem `{ data }` no envelope padrão do
  `code-standards.md`.
- 7 testes unitários do `GoalsService` (`create`: persiste com
  `userId` resolvido / nunca do request, converte Decimal →
  number, propaga `NotFoundException`; `list`: scoped por
  `userId` + ordem desc, sem `userId` no payload + Decimal →
  number, lista vazia, propaga `NotFoundException`).
- 9 testes unitários do `CreateGoalDto` via `plainToInstance` +
  `validate` (payload válido; name vazio/ausente; `targetAmount`
  0/negativo/não-numérico; `deadline` no passado/inválido;
  `deadline` futuro válido). Spec importa `reflect-metadata`
  explicitamente — o `@Type` do `class-transformer` precisa do
  polyfill, que os specs com `@nestjs/testing` recebem
  transitivamente mas um spec puro de DTO não.
- 8 testes E2E novos em `test/goals.e2e-spec.ts`: `POST` —
  401 sem token, 201 com `userId` resolvido do token,
  400 deadline no passado, 400 `targetAmount` 0/negativo,
  400 name vazio; `GET` — 401 sem token, lista só as metas
  do usuário (sem campos de progresso, sem `userId`),
  isolamento entre dois usuários (cada `findMany` carrega o
  `userId` correto resolvido do token).
- Totais: 99 unit (10 suites, +16) + 46 E2E passados (+8,
  1 todo). Cobertura: 100% statements/lines/functions,
  88.72% branches global. `goals.service.ts` em 75% branches
  pelo artefato conhecido do istanbul instrumentando
  parameter-properties do construtor (linha 26 — mesma causa
  documentada em S10/S11/S12). Todo o código novo de S13 está
  100% coberto.
- Lint dos arquivos novos limpo. `npm run build` passa sem erros.
**Deviations from plan:** Nenhuma. O plano lista a validação
de DTO como teste "unitário" — entregue como spec dedicado do
`CreateGoalDto` (`plainToInstance` + `validate`), além dos 400
correspondentes no E2E.

### S12 — GET /dashboard/history
**Closed:** 2026-05-19
**Decisions:**
- `GET /dashboard/history` adicionado ao `DashboardController`
  existente — mesmo módulo de S11, fronteira coesa. Sem query
  params: o endpoint sempre retorna os 6 meses mais recentes
  a partir do mês atual (UTC). `?banco=` não foi incluído —
  o plano de S12 não o define (OQ-3 resolveu o filtro apenas
  para `/dashboard/summary`).
- `DashboardService.history(clerkId)` resolve `userId` via
  `usersService.resolveUserId` (invariante 3 — `userId` nunca
  vem do request) e faz **6** chamadas `prisma.transaction.aggregate`
  em paralelo via `Promise.all`, uma por mês. Cada query filtra
  `type: TransactionType.debit` + `extrato: { userId, mesAno }` —
  mesmo padrão do `previousAggregate` de S11. Módulo continua
  só lendo e agregando (invariante de `architecture.md`).
- Optou-se por 6 `aggregate` (em vez de um `findMany` + agregação
  em memória) para manter a soma server-side e a consistência
  com S11. `groupBy` por mês não é viável: `mesAno` vive em
  `Extrato`, não em `Transaction`, e o Prisma não agrupa por
  campo de relação.
- Helper `lastSixMesAnos()` reusa `currentMesAno()` e
  `previousMesAno()` (já existentes de S11). Constrói o array
  com `unshift`, garantindo ordem cronológica ascendente com
  o mês atual sempre na última posição (índice 5) — critério
  de aceite "mês atual é sempre o último".
- Meses sem dados (`_sum.amount == null`) retornam `totalGasto: 0`;
  array tem **sempre exatamente 6 entradas**. Decimal convertido
  via `Number()` e arredondado a 2 casas (`round`), igual a S11.
- Controller devolve `{ data: DashboardHistory }` onde
  `DashboardHistory` é `{ history: HistoryEntry[] }` — envelope
  `{ data }` do `code-standards.md`, mesmo formato de
  `/dashboard/summary`.
- 5 testes unitários novos em `describe('history')`: 6 entradas
  zeradas sem dados; ordem ascendente com mês atual no fim;
  dados parciais (meses sem dados → 0, com dados → total);
  ownership (`userId` + `type=debit` em todas as 6 queries);
  propagação de `NotFoundException` de `resolveUserId`.
- 4 testes E2E novos em `describe('GET /dashboard/history')`:
  401 sem token; 6 entradas zeradas sem dados; dados parciais
  em ordem ascendente; isolamento entre dois usuários (cada
  `aggregate` carrega o `userId` correto resolvido do token).
  `describe` raiz do spec renomeado de "GET /dashboard/summary"
  para "Dashboard (e2e)" — engloba summary e history.
- Totais: 83 unit (8 suites, +5) + 38 E2E (+4, 1 todo).
  Cobertura: 100% statements/lines/functions, 89.6% branches
  global. `dashboard.service.ts` em 88.88% branches pelo
  artefato conhecido do istanbul (linhas 38, 76, 158 — todas
  código pré-existente de S11: spreads condicionais e ternário
  do `buildPieChart`). Todo o código novo de S12 está 100%
  coberto.
- Lint dos arquivos novos limpo. `npm run build` passa sem erros.
**Deviations from plan:** Nenhuma.

### S11 — GET /dashboard/summary
**Closed:** 2026-05-10
**Decisions:**
- Novo módulo `dashboard/` (controller, service, module, DTO) —
  fronteira própria conforme `code-standards.md`. Módulo importa
  apenas `UsersModule` (para `resolveUserId`); `PrismaService`
  vem do `PrismaModule` global. Registrado em `AppModule`.
- DTO `DashboardSummaryQueryDto` aceita `mesAno` opcional
  (mesmo regex `^\d{4}-(0[1-9]|1[0-2])$` dos outros módulos)
  e `banco` opcional (string não vazia) — implementa a
  decisão da **OQ-3** (filtro por banco como query param,
  resolvido server-side).
- `DashboardService.summary(clerkId, query)` faz **duas**
  chamadas ao Prisma e nada mais — invariante 1 do
  `architecture.md` (módulo só lê e agrega) preservada:
  1. `prisma.transaction.groupBy({ by: ['category'], ... })`
     somando `amount` por categoria no `mesAno` requisitado.
  2. `prisma.transaction.aggregate({ _sum: { amount } })`
     calculando o total do `previousMesAno` para `variacaoVsMesAnterior`.
  Ambas filtram `type: TransactionType.debit` (gastos = débitos,
  conforme OQ-2 — unsigned + tipo) e usam `extrato.userId`
  resolvido via `usersService.resolveUserId(clerkId)` — `userId`
  **nunca** vem do request (invariante 3).
- `mesAno` default = mês atual (UTC) quando o query param não
  é informado, conforme o plano (`default: mês atual`).
- `previousMesAno()` helper privado lida com a virada de ano:
  janeiro → dezembro do ano anterior (`2026-01` → `2025-12`).
- `buildPieChart()` aplica algoritmo de compensação de
  arredondamento: percentuais individuais arredondados a 2
  casas, e o **diff** (100 − soma) é distribuído na categoria
  com maior `valor`. Garante critério "soma de
  `pieChart[].percentual` ∈ [99.99, 100.01]" mesmo com 7+
  categorias iguais (que sem compensação dariam 100.03).
  Testado com 7 categorias de R$ 100 cada — soma fica
  exatamente em 100.00.
- `categoriaMaior` = `reduce` pelo maior `valor`. Quando não
  há nenhuma categoria com `valor > 0`, retorna `null`
  (não vazia um objeto inválido).
- `variacaoVsMesAnterior` calculado como
  `((atual − anterior) / anterior) × 100`, arredondado a 2
  casas. Retorna `null` quando `previousTotal === 0` —
  evita divisão por zero, conforme critério explícito do plano.
  Suporta positivo (+20%), negativo (−20%) e zero.
- Decimal do Prisma é convertido via `Number()` (funciona tanto
  com `Decimal` real quanto com string nos mocks). Valor
  arredondado a 2 casas no momento da leitura — preserva
  precisão BRL sem propagar artefatos de float.
- Controller devolve `{ data: DashboardSummary }` no envelope
  padrão do `code-standards.md` (mesmo formato dos outros
  endpoints).
- **Mock global do Prisma** ampliado com `aggregate` (método
  real do Prisma Client, vai ser reusado em S14 pelo cálculo
  de Goals). Mudança puramente aditiva — nenhum teste
  existente precisou ser ajustado.
- 13 testes unitários novos no `DashboardService.summary`:
  mês sem dados → zeros/null; ownership (userId nunca do
  request); filtro `type=debit` + `mesAno` no groupBy e
  previousMesAno no aggregate; filtro `banco` em ambas as
  queries; virada de ano (jan → dez do ano anterior); default
  para mês atual; 1 categoria → 100%; muitas categorias →
  soma em [99.99, 100.01]; `categoriaMaior` quando não é a
  primeira no array; variação positiva (+20%), negativa
  (−20%), zero; previous sem dados → variação null
  (sem divisão por zero); propagação de `NotFoundException`
  de `resolveUserId`.
- 6 testes E2E novos no `dashboard.e2e-spec.ts`: 401 sem
  token; mês sem dados → zeros/null; happy path com 3
  categorias (verifica `totalGasto`, `categoriaMaior`,
  `variacaoVsMesAnterior=+25%` e soma de percentuais em
  [99.99, 100.01]); **isolamento entre dois usuários** —
  critério de aceite "Ownership aplicado em todas as queries"
  — userA vê só seus dados, userB só os seus, e cada `groupBy`
  e `aggregate` carrega o `userId` correto resolvido do
  token; filtro `?banco=` repassado a ambas as queries
  (OQ-3); 400 quando `mesAno` mal formado.
- Totais: 78 unit (8 suites, +13) + 34 E2E (+6, 1 todo).
  Cobertura: 100% statements/lines/functions, 89.43%
  branches global. `dashboard.service.ts` em 88.23% branches
  pelo artefato conhecido do istanbul instrumentando
  parameter-properties + spreads condicionais — toda lógica
  real (default mesAno, virada de ano, banco filter, diff
  ≠ 0, totalGasto > 0, previousTotal > 0, categoriaMaior
  null) está coberta.
- Lint dos arquivos novos limpo (zero erros novos).
  `npm run build` passa sem erros.
**Deviations from plan:** Nenhuma.

### S10 — PATCH /transactions/:id (revisão)
**Closed:** 2026-05-10
**Decisions:**
- Endpoint `PATCH /transactions/:id` adicionado ao
  `TransactionsController` existente — mesmo módulo de S9,
  fronteira coesa. DTO `UpdateTransactionDto` em
  `transactions/dto/update-transaction.dto.ts` valida apenas
  `category` via `@IsEnum(Category)` (enum gerado pelo Prisma,
  importado de `@prisma/client` — evita duplicar a lista). DTO
  exige `category` presente; corpo vazio falha no pipe e gera 400.
- `TransactionsService.update(clerkId, id, dto)` resolve
  `userId` via `UsersService.resolveUserId` (mesmo padrão dos
  outros services) e faz um único `prisma.transaction.updateMany`
  com `where: { id, extrato: { userId } }`. Operação atômica:
  ownership + update no mesmo round-trip, sem TOCTOU entre
  check e update. Se `count === 0` → `NotFoundException` (404).
  Em seguida, `findUniqueOrThrow({ where: { id } })` retorna o
  registro atualizado para o cliente (o `updateMany` só devolve
  `count`).
- Critério "404 não vazar existência" satisfeito: usuário B
  tentando editar transação de A recebe 404 idêntico ao caso
  de id inexistente — mesma resposta para ambos. Não há 403.
- Critério "`reviewed = true` mesmo com categoria igual"
  satisfeito por design: o `data` do `updateMany` sempre
  envia `{ category, reviewed: true }` sem condicional —
  Prisma escreve os dois campos. Teste unitário cobre o
  cenário (categoria nova = categoria antiga).
- Mock global do Prisma (`test/mocks/prisma.mock.ts`) ampliado
  com `findUniqueOrThrow` e `updateMany` (ambos métodos reais
  do Prisma Client; vão ser reutilizados em S11+ pelo Dashboard
  e Goals). Mudança puramente aditiva — nenhum teste existente
  precisou ser ajustado.
- Controller retorna `{ data: Transaction }` no envelope padrão
  do `code-standards.md` (mesmo formato de `GET /transactions`).
  Sem `@HttpCode` — Nest devolve 200 por default em PATCH,
  que é o esperado para revisão.
- 5 testes unitários novos no `TransactionsService.update`:
  happy path (updateMany scoped + findUniqueOrThrow + retorno),
  count=0 → 404 (e não chama findUniqueOrThrow), categoria
  igual ainda força `reviewed: true`, `userId` nunca vem do
  request, propagação de `NotFoundException` de `resolveUserId`.
  Os 8 testes de `list` (S9) foram agrupados em `describe('list')`
  para conviver com `describe('update')` — sem alteração de
  comportamento.
- 5 testes E2E novos no `transactions.e2e-spec.ts`: 401 sem
  token; happy 200 com ownership via `extrato.userId` e shape
  da resposta; **404 quando userB edita transação de userA**
  (critério de aceite); 400 para categoria fora do enum;
  400 para body sem `category`. O `describe` raiz renomeado
  de "GET /transactions" para "Transactions (e2e)" — engloba
  agora GET e PATCH.
- Totais: 64 unit (7 suites, +5) + 28 E2E (+5, 1 todo).
  Cobertura: 100% statements/lines/functions, 89.88% branches
  global. `transactions.service.ts` ficou em 87.5% branches
  pelo mesmo artefato do istanbul instrumentando parameter-
  properties — toda lógica real (1 condicional `count === 0`)
  está coberta.
- Lint dos arquivos novos limpo (zero erros novos).
- `npm run build` passa sem erros.
**Deviations from plan:** Nenhuma.

### S9 — GET /transactions
**Closed:** 2026-05-10
**Decisions:**
- Novo módulo `transactions/` criado (controller, service, module, DTO)
  — fronteira própria conforme `code-standards.md`. `TransactionsModule`
  importa apenas `UsersModule` (para `resolveUserId`); o `PrismaService`
  vem via `PrismaModule` global. Registrado em `AppModule`.
- DTO `ListTransactionsQueryDto`: `mesAno` reusa o mesmo regex de
  Extratos (`^\d{4}-(0[1-9]|1[0-2])$`); `banco` string não-vazia;
  `onlyUnreviewed` é boolean opcional. Query string só carrega
  strings — usado `@Transform` (`class-transformer`) para converter
  `'true'`/`'false'` em boolean antes do `@IsBoolean`. Qualquer
  outro valor cai no validator e gera 400 (testado no E2E).
  Sem `enableImplicitConversion` no ValidationPipe pra evitar que
  truthy strings virem `true` por engano.
- `TransactionsService.list` filtra **toda transação pelo `extrato.userId`**
  via relação aninhada do Prisma — não há `Transaction.userId` no
  schema, então a ownership só pode ser garantida pelo Extrato.
  Critério "nenhuma query retorna transação de outro usuário em
  qualquer combinação de filtros" satisfeito porque o `userId` está
  sempre dentro do `where.extrato.{...}` e vem de
  `usersService.resolveUserId(clerkId)` — nunca da request.
- Filtros `mesAno` e `banco` entram **dentro** de `where.extrato`
  (compartilham o mesmo objeto com `userId` — o Prisma transforma
  num único JOIN). Filtro `reviewed: false` fica no topo, sobre a
  própria `Transaction` (campo dela, não do Extrato). `onlyUnreviewed`
  só aplica o filtro quando `=== true` — `false` ou ausente carrega
  todas, conforme intuição da UI.
- Spreads condicionais (`...(query.mesAno ? { mesAno } : {})`) seguem
  o mesmo padrão de `ExtratosService.list` em S8 — evita injetar
  `undefined` no `where`, que o Prisma trataria como literal `null`.
- `findMany` retorna todos os campos da `Transaction` (incluindo
  `amount`, `confidence` como string serializada do Decimal, `type`,
  `category`, `reviewed`, `createdAt`, `updatedAt`). Não há campos
  sensíveis no modelo. Order: `date: 'desc'` (mais recente primeiro).
- Controller devolve `{ data: Transaction[] }` no envelope padrão do
  `code-standards.md` (mesmo formato do `/extratos`, `/users/sync`).
- 8 testes unitários: sem filtros (ownership + select + ordem), só
  `mesAno`, só `banco`, `onlyUnreviewed=true`, `onlyUnreviewed=false`
  (não aplica filtro), combinado, `userId` nunca vem do request,
  propagação de `NotFoundException` de `resolveUserId`.
- 7 testes E2E novos: 401 sem token; **isolamento entre dois
  usuários** (criterio de aceite — userA vê só 2, userB vê só 1,
  cada `findMany` carrega o `userId` correto dentro de `extrato`);
  `onlyUnreviewed=true` retorna apenas `reviewed=false`; filtro
  `mesAno` repassa pro Prisma; filtro `banco` repassa pro Prisma;
  400 quando `mesAno` mal formado; 400 quando `onlyUnreviewed=maybe`.
- Totais: 59 unit (7 suites, +8) + 23 E2E (+7, 1 todo) — cobertura
  100% statements/lines/functions, 89.65% branches global. Branches
  do `transactions.service.ts` ficam em 85.71% pelo mesmo artefato
  do istanbul instrumentando parameter-properties que aparece em
  `extratos.service.ts` — toda lógica real (3 spreads + filtro
  `onlyUnreviewed`) está coberta.
- Lint dos arquivos novos limpo (zero erros novos).
**Deviations from plan:** Nenhuma.

### S8 — GET /extratos
**Closed:** 2026-05-10
**Decisions:**
- `GET /extratos` adicionado ao `ExtratosController` reutilizando o
  módulo (não foi necessário criar arquivo novo) — mantém a fronteira
  do módulo Extratos coesa, conforme `code-standards.md`.
- DTO de query em `extratos/dto/list-extratos.query.ts` com `mesAno` e
  `banco` opcionais. `mesAno` reusa o mesmo regex de
  `ImportExtratoDto` (`^\d{4}-(0[1-9]|1[0-2])$`); `banco` é string
  não-vazia (MVP: sem whitelist, igual ao POST). Sem paginação no MVP
  conforme o plano.
- `ExtratosService.list(clerkId, query)` resolve `userId` via
  `UsersService.resolveUserId` (mesmo helper do POST) — o filtro
  `where.userId` nunca vem do request. Spreads condicionais
  `...(query.mesAno ? { mesAno } : {})` evitam injetar `undefined`
  no `where`, o que Prisma trataria como literal `null`. Order:
  `createdAt: 'desc'`.
- `select` explícito retorna apenas `{ id, banco, mesAno, createdAt }`
  — sem `userId` no payload (não é sensível, mas é redundante e
  evita acoplar a chave interna ao cliente). Satisfaz "Sem dados
  sensíveis no payload" do plano.
- Tipo `ExtratoListItem` exportado pelo service, consumido pelo
  controller no shape `{ data: ExtratoListItem[] }` — mesma
  convenção do `code-standards.md` (envelope `{ data }`).
- 5 testes unitários novos no `ExtratosService`: query sem filtros
  (ownership + ordem + select), filtro só `mesAno`, filtro só `banco`,
  combinado, e propagação de `NotFoundException` de `resolveUserId`.
- 4 testes E2E novos: 401 sem token; **isolamento entre dois
  usuários** (criterio de aceite — userA vê só seus 2, userB vê só
  o seu 1, e cada `findMany` carrega o `userId` correto resolvido
  do token, nunca do request); filtro `?mesAno=...` repassa para
  Prisma; 400 quando `mesAno` mal formado.
- Lint dos arquivos novos limpo (zero erros novos introduzidos);
  os 11 erros do baseline (em `clerk-auth.guard.spec.ts`,
  `prisma.service.spec.ts` e no E2E do POST) são pré-existentes
  de S3/S7 e serão tratados em S15 junto com o hardening.
- Totais: 51 unit (6 suites, +5) + 16 E2E (+4) — 1 todo
  (placeholder de `app.e2e-spec.ts`). Cobertura: 100%
  statements/lines/functions, 90.41% branches global.
**Deviations from plan:** Nenhuma.

### S7 — POST /extratos: IA + persistência
**Closed:** 2026-05-10
**Decisions:**
- Migration `20260510223029_add_transaction_type` adiciona o
  enum `TransactionType` (`debit | credit`) e a coluna
  `Transaction.type` (NOT NULL). É a contrapartida no schema
  da decisão da OQ-2 (unsigned + tipo) já refletida no Zod
  da IA em S5. Aplicada no Neon sem warning porque a tabela
  estava vazia (S6 sempre retornava 501). Como efeito
  colateral, Prisma removeu o `DEFAULT CURRENT_TIMESTAMP` de
  `Transaction.updatedAt` que tinha sido criado em pós-S3 só
  para satisfazer o "tabela não vazia" da época — `@updatedAt`
  é gerenciado pelo Prisma Client, não precisa do default no DB.
- `ExtratosService` agora injeta `IaService`. Ordem real do
  fluxo: decrypt → resolveUserId → findUnique (duplicidade) →
  IA → persistência. Invariante 2 mantida: IA não é chamada se
  duplicado.
- Persistência usa `prisma.$transaction` no formato **callback**
  (não array), porque precisamos do `extrato.id` recém-criado
  para popular o `extratoId` das transações. Sequência dentro
  do callback: `tx.extrato.create()` → `tx.transaction.createMany()`
  (bulk) → `tx.transaction.findMany()` (para retornar os
  registros criados, já que `createMany` só devolve `count`).
  Tudo atômico. Critério "envolve as duas inserções" satisfeito.
  Plano sugeria `[...]` (array form); deviation registrada
  abaixo.
- Quando a IA retorna `[]`, pula `createMany` e ainda cria o
  Extrato vazio. Isso vale tanto para PDFs sem transações
  identificáveis quanto para extratos antigos zerados — não há
  motivo para 422 aqui (o PDF foi processado com sucesso).
- Mapeamento de erros:
  - `IaApiError` ou `IaParseError` → `BadGatewayException`
    (502) com mensagem genérica para o front. Nada persistido,
    pois a IA é chamada **antes** do `$transaction`.
  - `Prisma.PrismaClientKnownRequestError` com código `P2002`
    dentro do `$transaction` (race condition no
    `@@unique([userId, banco, mesAno])`) → `ConflictException`
    (409). Outros códigos Prisma são propagados para o filter
    global cuidar.
  - Erros desconhecidos da IA (não-Ia*) propagados como-é —
    sinaliza bug em vez de mascarar como 502.
- Resposta ajustada do que está no plano:
  ```ts
  { data: { extrato: { id, banco, mesAno, createdAt },
            transactions: Transaction[] } }
  ```
  Removido o campo `status` que o plano mencionava — `Extrato.status`
  foi removido em pós-S3 (estado morto do fluxo síncrono).
  Adicionado `createdAt` no retorno (útil pro front ordenar).
  Wrap em `{ data: ... }` segue a convenção do `code-standards.md`
  (mesmo padrão do `/users/sync`).
- Controller passou de `Promise<never>` para `Promise<{ data: ... }>`
  e ganhou `@HttpCode(201)` explícito — Nest devolve 200 por
  default em POST com retorno via Promise.
- `ExtratosModule` importa `IaModule` (que exporta `IaService`).
- 11 testes unitários do `ExtratosService` (3 cenários de
  encryption, 1 duplicado, 4 happy path — chamada à IA,
  shape do `$transaction`, retorno, IA retorno vazio — e 5
  failure paths — IaApiError → 502, IaParseError → 502, erro
  IA não tipado propagado, P2002 → 409, P2003 propagado).
  4 testes E2E novos/atualizados (era 1 happy 501; virou
  502 IA falhou, 201 happy com IA mockada e verificação
  da Invariante 1 via JSON.stringify das chamadas de write).
  Total geral: 46 unit (6 suites) + 12 E2E. Cobertura: 100%
  statements/lines/functions, 89.85% branches global.
- Test setup do `$transaction` no callback form:
  `prisma.$transaction.mockImplementation((cb) => cb(txMock))`
  onde `txMock = createPrismaMock()` — passa o mesmo padrão
  de mock como `tx`. Permite assertar nos métodos do `tx` sem
  duplicar a fixture.
**Deviations from plan:**
1. Resposta sem campo `status` (vestigial de pós-S3) e
   adicionado `createdAt`. Documentado acima.
2. `prisma.$transaction` em formato **callback** em vez de
   array (`[...]`). Razão: `extratoId` só existe após o
   primeiro insert, e callback evita pré-gerar UUIDs no
   service. Atomicidade preservada — é o que o critério de
   aceite exige.

### S6 — POST /extratos: regra (sem IA)
**Closed:** 2026-05-09
**Decisions:**
- **Trocada a lib de descriptografia: `pdf-lib` → `node-qpdf2`**
  (wrapper sobre o binário `qpdf`). `pdf-lib` foi descartado
  porque não suporta descriptografia (apenas detecção). Outras
  alternativas avaliadas: `mupdf` (rejeitada — AGPL-3.0 obriga
  abrir o back-end inteiro de Lumina via cláusula de uso em
  rede), `pdfjs-dist` (rejeitada — só leitura, sem re-export
  do buffer descriptografado), `qpdf-wasm` (não existe como
  pacote npm). `architecture.md` e `backend-development-plan.md`
  atualizados.
- `qpdf` é dependência de runtime: precisa estar no PATH em
  dev (Windows: `winget install qpdf.qpdf` + adicionar
  `C:\Program Files\qpdf <ver>\bin` ao PATH) e em produção
  (Render: prefixar build command com `apt-get install -y qpdf`).
- `node-qpdf2` aceita apenas file path como input — buffer
  é gravado em diretório transiente via `mkdtemp(os.tmpdir())`
  e removido em `finally`. Invariante 1 do `architecture.md`
  reescrita: "PDF nunca é persistido em storage durável" —
  arquivo transiente em tmpfs é permitido durante decrypt.
- `PdfDecryptionService.ensureDecrypted(buffer, password?)`:
  uma única chamada a `qpdf --decrypt` (qpdf é content-preserving
  e funciona como passthrough para PDFs não criptografados).
  Distinção PDF_ENCRYPTED vs WRONG_PASSWORD baseada na presença
  do parâmetro `password`, não no parser do stderr do qpdf
  (frágil entre versões). Erros tipados: `PdfEncryptedError`,
  `PdfWrongPasswordError`, ambos preservam o stderr original
  em `cause`.
- `node-qpdf2` é ESM-only (`"type": "module"`). Carregado via
  dynamic `await import('node-qpdf2')` para compatibilidade
  com o build CJS do projeto (e com ts-jest). Mockado em testes
  com `jest.mock('node-qpdf2', () => ({ __esModule: true, ... }))`.
- `ExtratosService.import()`: ordem de validação é
  decrypt → resolveUserId → findUnique. Decrypt antes do banco
  para satisfazer o critério "sem bater no banco com PDF
  inválido". Composite key Prisma: `userId_banco_mesAno`.
  Caminho feliz lança `NotImplementedException` (501) —
  IA + persistência ficam para S7.
- `UnprocessableEntityException` recebe payload `{ code, message }`
  diretamente; o filter padrão do Nest preserva o `code` no
  body. Códigos centralizados em `extratos/types/extrato-errors.ts`
  (`EXTRATO_ERROR_CODES`) para o front consumir.
- Controller: `FileInterceptor('file')` + `ParseFilePipe` com
  `MaxFileSizeValidator` (10MB) e `FileTypeValidator` com
  `fallbackToMimetype: true` — necessário porque a versão
  11.x do `FileTypeValidator` carrega `file-type` via ESM
  dinâmico que falha em Jest (CJS). Fallback usa o mimetype
  do multipart, que é o que o spec exige ("mimetype application/pdf").
- `Express.Multer.File` não existe (`@types/multer` não está
  instalado e multer 2.x não exporta types próprios). Tipado
  localmente como `interface UploadedPdf { buffer, mimetype,
  size, originalname }` no controller — só os campos que
  consumimos.
- `ValidationPipe({ transform: true })` adicionado globalmente
  em `main.ts` e replicado no setup do E2E (`createNestApplication`
  não roda `main.ts`). S15 vai endurecer com `whitelist` e
  `forbidNonWhitelisted`.
- `ExtratosModule` importa `UsersModule` para reusar
  `resolveUserId`. `UsersModule` já exporta `UsersService`.
- 14 testes adicionados: 6 unit do `PdfDecryptionService`
  (sucesso, PDF_ENCRYPTED, WRONG_PASSWORD, cause preservado,
  rethrow de erros não-password, cleanup do tmp dir),
  6 unit do `ExtratosService` (3 cenários de encryption,
  duplicado, happy path 501, rethrow de erro inesperado),
  8 E2E (401, 400 sem arquivo, 400 não-PDF, 400 mesAno
  inválido, 422 PDF_ENCRYPTED, 422 WRONG_PASSWORD, 409,
  501 happy). Total geral: 39 unit (6 suites) + 11 E2E.
  Cobertura: 100% statements/lines/functions, 89% branches
  global. Em `extratos.service.ts` branches caem para 83% por
  artefato do istanbul instrumentando parameter-properties +
  decorators — toda lógica real (3 `instanceof`, 1 `if (existing)`)
  está coberta.
**Deviations from plan:** Trocada a lib de descriptografia
(pdf-lib → node-qpdf2) por incapacidade técnica do pdf-lib —
arquitetura, plano e invariante 1 atualizados para refletir.

### S5 — IaService (isolado)
**Closed:** 2026-05-07
**Decisions:**
- `@anthropic-ai/sdk@0.95.1` e `zod@4.4.3` instalados.
- `IaModule` provê o cliente `Anthropic` via `useFactory`,
  exposto pelo token DI `ANTHROPIC_CLIENT` (string em
  `ia.tokens.ts` — evita ciclo entre `ia.module.ts` e
  `ia.service.ts`). `IaService` injeta o token via
  `@Inject(ANTHROPIC_CLIENT)` — única forma de instanciar
  o SDK em todo o back-end (invariante 4 do `architecture.md`).
- `extractTransactions(pdfBuffer, banco, mesAno)`: PDF
  enviado como bloco `document` nativo (`source.type =
  'base64'`, `media_type = 'application/pdf'`); modelo
  `claude-haiku-4-5` (alias da família — não pinado em
  versão dated por enquanto, conforme `architecture.md`);
  `max_tokens: 4096`.
- Schema Zod em `types/extracted-transaction.schema.ts`
  reflete a decisão da OQ-2 (unsigned + tipo): `amount:
  z.number().positive()` + `type: z.enum(['debit',
  'credit'])`. `category` usa `z.enum(Category)` com o
  enum gerado pelo Prisma (`@prisma/client`) — evita
  duplicar a lista de categorias entre Zod e schema do
  banco. `confidence: z.number().min(0).max(1)`.
  `date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` (ISO).
- O `Transaction.type` ainda **não** existe no
  Prisma schema — entrará via migration em S7 quando a
  persistência for ligada. S5 só define o tipo retornado
  pela IA; o mapeamento para a entidade fica em S7.
- Prompt em arquivo separado (`prompts/extract-transactions.prompt.ts`)
  como função `buildExtractTransactionsPrompt(banco, mesAno)`
  para suportar interpolação. Inclui regra crítica do
  `architecture.md`: transferências para conta de
  investimento/poupança classificadas como `investimento`
  mesmo com descrição genérica (TED, PIX, TRANSFERENCIA).
- Erros tipados em `types/ia-errors.ts`: `IaApiError`
  (envolve falhas do SDK — 5xx, network) e `IaParseError`
  (envolve JSON malformado, schema inválido, ausência de
  text block). Ambos preservam o erro original em `cause`.
- Parsing usa `safeParse` (não `parse`) para evitar
  branch defensivo inalcançável após `catch (err) { if
  (err instanceof ZodError) ... }` — o branch de "erro
  inesperado dentro do parse" não é acionável e foi
  removido conforme regra "no error handling for
  scenarios that can't happen" do CLAUDE.md.
- 14 testes unitários cobrindo: caminho feliz (com e sem
  transações), shape correto da request enviada ao SDK
  (modelo, document block base64, prompt com banco/mesAno),
  IaParseError em 9 cenários (sem text block, JSON
  inválido, campo faltando, confidence fora de [0,1],
  category fora do enum, type fora de debit/credit,
  amount negativo, date fora do formato), IaApiError
  em 2 cenários (SDK rejeita + cause preservado).
- `IaModule` registrado em `AppModule.imports`. Cobertura
  global: 100% statements/lines/functions, 90% branches
  — bem acima do threshold de 70% e atinge ≥90% exigido
  para services com regra de negócio.
**Deviations from plan:** Nenhuma. O plano dizia "constante
exportada" para o prompt; entreguei como função exportada
porque o prompt depende de `banco` e `mesAno` — uma
constante string sem interpolação seria menos útil.

### S4 — User sync endpoint
**Closed:** 2026-05-07
**Decisions:**
- `UsersModule` criado com `UsersController` (apenas wiring HTTP) e
  `UsersService` (regra de negócio). Módulo exporta `UsersService`
  para reuso em features futuras (`Extratos`, `Goals`).
- `POST /users/sync` lê `clerkId` do JWT via `@CurrentUser()` — nunca
  do corpo. Service retorna `{ user, created }`; controller usa
  `@Res({ passthrough: true })` para diferenciar 201 (criado) de
  200 (já existia). É a única forma limpa de preservar idempotência
  com semântica HTTP correta sem expor o flag no payload.
- `sync()` faz `findUnique` + `create` em vez de `upsert`: precisamos
  do indicador `created` para o status code, e `select` explícito
  evita campos extras no payload.
- Helper `resolveUserId(clerkId)` lança `NotFoundException` (404)
  quando o usuário não existe — será reutilizado em todos os módulos
  que precisem resolver `userId` interno a partir do JWT (Extratos,
  Transactions, Goals).
- DTO `UserDto` é `interface` (shape simples, não validado por
  class-validator — endpoint não tem corpo). Vive em `users/dto/`
  por convenção do `code-standards.md`.
- 5 testes unitários do service (criação, idempotência, resolveUserId
  ok/404) + 3 E2E (401 sem token, 201 primeira chamada, 200 idempotente).
  Mock global de `@clerk/clerk-sdk-node.verifyToken` no E2E e
  `PrismaService` sobrescrito via `overrideProvider`.
- `jest.config.ts`: `collectCoverageFrom` ampliado para excluir
  `*.controller.ts`, `dto/`, `types/`, `decorators/` — wiring puro
  por convenção do `code-standards.md` ("Não testar controllers em
  isolamento"). Cobertura permanece 100% statements/lines, 90% branches,
  bem acima do threshold de 70%.
- E2E: `import request from 'supertest'` (default export, não
  namespace) + cast `app.getHttpServer() as App` para satisfazer
  `@typescript-eslint/no-unsafe-argument`.
**Deviations from plan:** Nenhuma. `jest.config.ts` ajustado para
refletir a convenção já documentada em `code-standards.md`.

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