# Plano de Desenvolvimento do Back-end — Lumina

## Como ler este documento

Cada sessão é uma fatia vertical do back-end que pode ser
desenvolvida e verificada de forma independente. As sessões
seguem ordem rígida — cada uma depende das anteriores.
Toda sessão a partir de S2 entrega **implementação + testes**
juntos. Não existe "fase de testes" separada no final.

Convenção por sessão:

- **Objetivo** — o que esta sessão entrega
- **Entregáveis** — arquivos, endpoints, modelos
- **Testes** — o que precisa estar coberto antes de fechar
- **Critério de aceite** — como verificar que está pronto
- **Dependências** — sessões anteriores obrigatórias
- **Fora do escopo** — o que fica para sessões futuras

---

## Bloco 1 — Fundação

### S0 — Setup do projeto NestJS

**Objetivo:** Criar o projeto base com TypeScript strict,
lint, formatação e build limpo.

**Entregáveis:**

- `lumina/package.json` com Nest CLI e scripts
  (`build`, `start`, `start:dev`, `lint`, `test`)
- `tsconfig.json` em strict mode (sem `any` permitido)
- ESLint + Prettier configurados
- Estrutura de pastas inicial conforme `code-standards.md`
- `app.module.ts` mínimo (apenas `AppModule`)
- `main.ts` com `app.listen(process.env.PORT ?? 3000)`
- `.env.example` com `DATABASE_URL`, `CLERK_SECRET_KEY`,
  `ANTHROPIC_API_KEY`, `PORT`
- `.gitignore` apropriado

**Testes:** N/A (apenas infraestrutura — testes começam em S2).

**Critério de aceite:**

- `npm run build` termina sem erros
- `npm run start:dev` sobe o servidor na porta configurada
- Lint passa sem warnings

**Dependências:** Nenhuma.

**Fora do escopo:** Banco, autenticação, qualquer endpoint.

---

### S1 — Prisma + PostgreSQL (NeonDB)

**Objetivo:** Conectar o projeto ao banco e gerar a primeira
migration com o modelo de dados completo.

**Entregáveis:**

- `prisma/schema.prisma` com `User`, `Extrato`, `Transaction`,
  `Goal` e enum `ExtratoStatus` (idêntico ao definido em
  `architecture.md`)
- Primeira migration aplicada via `prisma migrate dev`
- `PrismaService` em `src/common/prisma/prisma.service.ts`
- `PrismaModule` global registrado em `AppModule`
- Script `postinstall` executando `prisma generate`
- Comando `prisma migrate deploy` incorporado no script
  de start de produção (não no build)

**Testes:**

- Teste unitário simples do `PrismaService`
  (instancia, conecta, desconecta sem erro)

**Critério de aceite:**

- Migration aplicada com sucesso no Neon de desenvolvimento
- `prisma studio` mostra as 4 tabelas com a constraint
  `@@unique([userId, banco, mesAno])` em Extrato
- `PrismaClient` injeta corretamente em qualquer service

**Dependências:** S0.

**Fora do escopo:** Seeds, dados de teste, índices adicionais.

---

### S2 — Configuração de testes (Jest)

**Objetivo:** Habilitar a stack de testes para que toda sessão
posterior já entregue cobertura junto com o código.

**Entregáveis:**

- `jest.config.ts` com `ts-jest` e paths mapeados
- Coverage threshold inicial razoável (sugestão: 70%)
- `test/jest-e2e.json` para testes E2E
- Scripts `test`, `test:watch`, `test:e2e`, `test:cov`
- `supertest` instalado para E2E
- Padrão de mock do `PrismaService` em
  `test/mocks/prisma.mock.ts` (reutilizado por todos
  os testes unitários daqui pra frente)
- Um teste trivial passando para validar a infra

**Testes:** A própria infra é o entregável.

**Critério de aceite:**

- `npm test` passa
- `npm run test:cov` gera relatório de cobertura
- `npm run test:e2e` roda (mesmo que com 0 testes ainda)

**Dependências:** S0.

**Fora do escopo:** Testes de features (vêm em cada sessão).

---

## Bloco 2 — Autenticação

### S3 — ClerkAuthGuard global + decorators

**Objetivo:** Proteger toda a API por padrão. JWT do Clerk
validado em todo endpoint, com escape via `@Public()`.

**Entregáveis:**

- `@clerk/clerk-sdk-node` instalado
- `ClerkAuthGuard` em `src/common/guards/clerk-auth.guard.ts`
  registrado como `APP_GUARD` (global)
- Decorator `@Public()` em
  `src/common/decorators/public.decorator.ts`
- Decorator `@CurrentUser()` em
  `src/common/decorators/current-user.decorator.ts`
  (retorna `{ clerkId: string }`)
- Tipo `RequestWithUser` em `src/common/types/`

**Testes (unitários do guard):**

- Token ausente → 401
- Token inválido (assinatura ou expirado) → 401
- Token válido → request prossegue, `request.user.clerkId`
  populado
- Rota com `@Public()` → bypass do guard
- Mock do `clerkClient.verifyToken`

**Critério de aceite:**

- Endpoint de teste protegido retorna 401 sem token
- Endpoint marcado `@Public()` retorna 200 sem token
- Cobertura do guard ≥ 90%

**Dependências:** S2.

**Fora do escopo:** Resolução de `userId` interno (vem em S4).

---

### S4 — User sync endpoint

**Objetivo:** Garantir que o usuário do Clerk exista no banco
interno antes de qualquer operação subsequente. Chamado pelo
mobile no primeiro login.

**Entregáveis:**

- `UsersModule`, `UsersController`, `UsersService`
- `POST /users/sync` — sem corpo. Lê `clerkId` do JWT e faz
  upsert no banco
- Resposta:
  ```ts
  { data: { id: string, clerkId: string, createdAt: Date } }
  ```
- Helper `resolveUserId(clerkId)` no `UsersService` —
  reutilizado em todos os outros módulos

**Testes (unitários do service, com PrismaService mockado):**

- `sync(clerkId)` cria usuário quando não existe
- `sync(clerkId)` retorna o existente quando já existe
  (idempotente)
- `resolveUserId(clerkId)` lança 404 quando não existe

**Testes (E2E):**

- Sem token → 401
- Token válido (primeira vez) → 201, usuário persistido
- Segunda chamada com o mesmo token → 200, mesmo registro

**Critério de aceite:**

- Idempotência verificada em E2E
- Helper `resolveUserId` documentado e disponível para reuso

**Dependências:** S1, S3.

**Fora do escopo:** Atualização de perfil, soft delete,
desativação de conta.

---

## Bloco 3 — Serviço de IA isolado

### S5 — IaService

**Objetivo:** Encapsular toda a comunicação com a Claude API
**antes** de qualquer feature usá-la. Único módulo autorizado
a instanciar o SDK da Anthropic.

**Entregáveis:**

- `@anthropic-ai/sdk` instalado
- `IaModule`, `IaService`
- Método principal:
  ```ts
  extractTransactions(
    pdfBuffer: Buffer,
    banco: string,
    mesAno: string
  ): Promise<ExtractedTransaction[]>
  ```
- Schema Zod do retorno em
  `src/ia/types/extracted-transaction.schema.ts`
- Prompt de extração em
  `src/ia/prompts/extract-transactions.prompt.ts`
  (constante exportada)
- Modelo `claude-haiku-4-5` configurado, PDF enviado
  como bloco `document` nativo
- Erros tipados: `IaParseError`, `IaApiError`

**Testes (unitários, todos com SDK da Anthropic mockado):**

- Resposta válida → array tipado retornado
- JSON malformado → `IaParseError`
- Schema inválido (campos faltando, tipos errados) →
  `IaParseError`
- Erro 5xx do SDK → `IaApiError`
- `confidence` sempre entre 0.0 e 1.0 (validação no schema)
- `category` sempre dentro do enum permitido
  (alimentacao, transporte, moradia, lazer, saude,
  assinaturas, compras, investimento, outro)

**Critério de aceite:**

- Nenhum teste faz chamada real à Claude API
- 100% dos caminhos de erro cobertos
- Cobertura ≥ 90% no service

**Dependências:** S2.

**Fora do escopo:** Cache de respostas, retry exponencial,
rate limiting, telemetria. Adicionar somente quando houver
demanda real.

---

## Bloco 4 — Extratos

### S6 — POST /extratos: validação e regra de duplicidade

**Objetivo:** Implementar o endpoint de upload com validação
completa de DTO e regra de unicidade. **Nesta sessão a IA
ainda não é chamada** — caminho feliz responde 501. O foco é
isolar a regra de negócio e cobrir todos os caminhos de erro.

**Entregáveis:**

- `ExtratosModule`, `ExtratosController`, `ExtratosService`
- `pdf-lib` instalado (`npm i pdf-lib`)
- `POST /extratos` com `@UseInterceptors(FileInterceptor('file'))`
- DTO `ImportExtratoDto` (`class-validator`):
  - `banco`: string não vazia (`@IsString() @IsNotEmpty()`).
    No MVP é string livre — nenhum whitelist no back-end.
    O mobile fornece um seletor com opções pré-definidas;
    o back-end aceita qualquer string não vazia.
  - `mesAno`: regex `^\d{4}-(0[1-9]|1[0-2])$`
  - `password`: string opcional (sem validação — qualquer
    valor é tentado como senha de descriptografia)
- Validação de arquivo: mimetype `application/pdf`,
  tamanho máximo configurável (sugestão: 10MB)
- Validação de criptografia via `pdf-lib` (obrigatória
  antes da query ao banco):
  - PDF criptografado sem `password` →
    `UnprocessableEntityException` com `{ code: 'PDF_ENCRYPTED' }`
  - PDF criptografado com `password` errado →
    `UnprocessableEntityException` com `{ code: 'WRONG_PASSWORD' }`
  - PDF criptografado com `password` correto → buffer
    descriptografado prossegue normalmente
- Service: query única em `Extrato` por
  `userId + banco + mesAno`. Se existir → `ConflictException`
  (409)
- Caminho feliz (todas as validações OK): lança
  `NotImplementedException` temporária

**Testes (unitários do service):**

- PDF criptografado, sem senha → lança 422 `PDF_ENCRYPTED`
- PDF criptografado, senha errada → lança 422 `WRONG_PASSWORD`
- PDF criptografado, senha correta → prossegue
- Duplicado → lança `ConflictException`
- Não duplicado, PDF válido → caminho feliz (lança
  `NotImplementedException` placeholder)

**Testes (E2E):**

- Sem arquivo → 400
- Arquivo não-PDF → 400
- DTO inválido (`mesAno` mal formado) → 400
- Sem token → 401
- PDF criptografado sem senha → 422 com `code: PDF_ENCRYPTED`
- PDF criptografado com senha errada → 422 com `code: WRONG_PASSWORD`
- Duplicado → 409
- Caminho feliz (PDF válido ou descriptografado) → 501 (placeholder)

**Critério de aceite:**

- Constraint `@@unique([userId, banco, mesAno])` é a fonte
  de verdade — a validação no service é apenas UX
- Nenhuma chamada à `IaService` nesta sessão
- A checagem de criptografia ocorre **antes** da query de
  duplicidade — sem bater no banco com PDF inválido

**Dependências:** S1, S3, S4.

**Fora do escopo:** Integração com IA, persistência de
transações.

---

### S7 — POST /extratos: integração com IA + persistência

**Objetivo:** Completar o fluxo. Após validação (S6), chamar
`IaService` e persistir extrato + transações em uma única
transação de banco.

**Entregáveis:**

- Injeção de `IaService` no `ExtratosService`
- Após validação OK (S6): o buffer do arquivo já está
  descriptografado em memória (se era criptografado, foi
  resolvido em S6). Chamar `iaService.extractTransactions(...)`
  com esse buffer
- Persistência em `prisma.$transaction([...])`:
  cria `Extrato` com `status = OK` + `Transaction[]` em massa
- Mapeamento: cada item retornado pela IA vira uma
  `Transaction`. `reviewed = false`. `confidence` salvo
  como decimal
- Tratamento de erro:
  - IA falha → 502 com mensagem clara, nada persistido
  - Race condition (constraint do banco dispara) → mapeada
    para 409
- Resposta:
  ```ts
  {
    data: {
      extrato: { id, banco, mesAno, status },
      transactions: Transaction[]
    }
  }
  ```

**Testes (unitários, mocks de Prisma e IaService):**

- Caminho feliz → cria extrato + N transações em uma
  única transação atômica
- IA falha → erro propagado, nada persistido
- Constraint race → mapeada para 409

**Testes (E2E, IaService mockado no módulo de teste):**

- Upload válido → 201, extrato + transações no banco
- PDF não persistiu em disco nem no banco
- Status final do extrato é `OK`

**Critério de aceite:**

- Invariante 1 honrada: PDF nunca em disco
- Invariante 2 honrada: IA não chamada se duplicado
- `prisma.$transaction` envolve as duas inserções

**Dependências:** S5, S6.

**Fora do escopo:** Status `PROCESSING` assíncrono — o fluxo
síncrono atende ao requisito de < 30s. Async vira tema se a
latência crescer.

---

### S8 — GET /extratos

**Objetivo:** Listar extratos do usuário autenticado com
status, ordenados do mais recente ao mais antigo.

**Entregáveis:**

- `GET /extratos` no controller
- Query params opcionais: `mesAno`, `banco`
- Service ordena por `createdAt` desc
- Ownership: filtro `where: { userId }` resolvido a partir
  do JWT (nunca aceito como parâmetro)
- Sem dados sensíveis no payload

**Testes:**

- Unitário: filtros aplicados corretamente
- E2E: usuário só vê seus próprios extratos
  (criar dois usuários, verificar isolamento — este é o
  teste mais importante)
- E2E: filtro por `mesAno` funciona

**Critério de aceite:**

- Ownership testada explicitamente entre dois usuários
  distintos

**Dependências:** S7.

**Fora do escopo:** Paginação (adicionar quando volume
justificar).

---

## Bloco 5 — Transações

### S9 — GET /transactions

**Objetivo:** Listagem de transações do usuário com filtros
úteis para a UI.

**Entregáveis:**

- `TransactionsModule`, `TransactionsController`,
  `TransactionsService`
- `GET /transactions?mesAno=...&banco=...&onlyUnreviewed=...`
- Join lógico com `Extrato` para validar ownership
  (transações pertencem ao usuário pelo extrato)
- Ordenação por `date` desc

**Testes:**

- Unitário: filtros aplicados corretamente, ordenação,
  ownership validada via `extrato.userId`
- E2E: isolamento entre usuários
- E2E: `onlyUnreviewed=true` retorna apenas com
  `reviewed = false`

**Critério de aceite:**

- Nenhuma query retorna transação de outro usuário em
  qualquer combinação de filtros

**Dependências:** S7.

**Fora do escopo:** Paginação, busca textual em descrição.

---

### S10 — PATCH /transactions/:id (revisão)

**Objetivo:** Permitir que o usuário corrija a categoria de
uma transação. Marca `reviewed = true` automaticamente.

**Entregáveis:**

- `PATCH /transactions/:id` com DTO `UpdateTransactionDto`
  (`category` validada contra o enum)
- Service: valida ownership por join em `Extrato.userId`,
  atualiza `category` e `reviewed = true`
- Retorna a transação atualizada

**Testes:**

- Unitário: ownership negada → 404 (não vazar existência);
  ownership ok → atualiza `category` e `reviewed`
- Unitário: categoria inválida → 400 (validation pipe)
- E2E: usuário B tentando editar transação do usuário A →
  404

**Critério de aceite:**

- `reviewed` vira `true` mesmo quando a categoria escolhida
  é a mesma já existente
- 404 (não 403) quando recurso não pertence ao usuário —
  evita vazar a existência do recurso

**Dependências:** S9.

**Fora do escopo:** Histórico de revisões, undo, edição
de outros campos (descrição, valor, data).

---

## Bloco 6 — Dashboard

### S11 — GET /dashboard/summary

**Objetivo:** Resumo do mês com dados prontos para a UI
(card + gráfico de pizza).

**Entregáveis:**

- `DashboardModule`, `DashboardController`, `DashboardService`
- `GET /dashboard/summary?mesAno=YYYY-MM`
  (default: mês atual)
- Resposta:
  ```ts
  {
    mesAno: string,
    totalGasto: number,
    categoriaMaior: { categoria: string, valor: number } | null,
    variacaoVsMesAnterior: number | null,  // percentual
    pieChart: Array<{
      categoria: string,
      valor: number,
      percentual: number
    }>
  }
  ```
- Agregação via `groupBy` do Prisma; este módulo só lê e
  agrega — nunca escreve

**Testes (unitários):**

- Mês sem dados → totais zero, `categoriaMaior` null,
  `variacao` null
- Mês com 1 categoria → pie com 100%
- Mês com várias categorias → soma dos percentuais ≈ 100%
  (tolerância de arredondamento)
- Variação positiva, negativa e zero
- Mês anterior sem dados → variação null
  (não dividir por zero)

**Critério de aceite:**

- Soma de `pieChart[].percentual` ∈ [99.99, 100.01]
- Ownership aplicado em todas as queries

**Dependências:** S7.

**Fora do escopo:** Cache de agregações (adicionar somente
se latência virar problema observável).

---

### S12 — GET /dashboard/history

**Objetivo:** Histórico dos últimos 6 meses para o gráfico
de barras.

**Entregáveis:**

- `GET /dashboard/history` retorna **sempre 6 entradas**,
  do mês atual ao -5, mesmo que zeradas
- Resposta:
  ```ts
  {
    history: Array<{ mesAno: string, totalGasto: number }>
  }
  ```

**Testes:**

- Sem dados em qualquer mês → 6 entradas zeradas
- Dados parciais → meses sem dados retornam 0
- Ordem cronológica ascendente (mês mais antigo primeiro)

**Critério de aceite:**

- Sempre exatamente 6 entradas no array
- Mês atual é sempre o último

**Dependências:** S11.

**Fora do escopo:** Janela configurável (3/12 meses),
breakdown por categoria no histórico.

---

## Bloco 7 — Metas

> ⚠️ **Bloqueador antes de S13/S14:** o cálculo de progresso
> e previsão tem ambiguidades não resolvidas. Adicionar como
> open questions em `progress-tracker.md` e resolver antes de
> implementar:
>
> 1. O progresso considera transações de `investimento`
>    desde **a criação da meta** ou **toda a história**?
> 2. A previsão usa média mensal calculada desde quando?
>    (criação da meta vs últimos N meses)
> 3. O que acontece quando a meta vence sem ser atingida?
>    Status `vencida`? Continua acumulando?

### S13 — POST /goals + GET /goals (sem progresso ainda)

**Objetivo:** CRUD básico de metas, isolando da lógica de
cálculo (que vem em S14).

**Entregáveis:**

- `GoalsModule`, `GoalsController`, `GoalsService`
- `POST /goals` com `CreateGoalDto`:
  - `name`: string min 1
  - `targetAmount`: decimal positivo
  - `deadline`: data futura
- `GET /goals` retorna a lista do usuário **sem** campo
  `progresso` ainda
- Ownership obrigatória em todas as operações

**Testes:**

- Unitário: validação de DTO (deadline no passado → 400,
  `targetAmount ≤ 0` → 400, name vazio → 400)
- E2E: criar e listar; isolamento entre usuários

**Critério de aceite:**

- DTOs cobrem todos os casos inválidos
- Endpoints só veem metas próprias

**Dependências:** S4.

**Fora do escopo:** Cálculo de progresso (S14), edição,
exclusão.

---

### S14 — Cálculo de progresso e previsão

**Objetivo:** Adicionar `valorAcumulado`, `percentual` e
`previsaoConclusao` ao retorno de `GET /goals`.

**Entregáveis:**

- Resposta de `GET /goals` enriquecida:
  ```ts
  {
    id, name, targetAmount, deadline, createdAt,
    valorAcumulado: number,
    percentual: number,            // 0..100
    previsaoConclusao: Date | null
  }
  ```
- Lógica conforme decisão tomada nas open questions
  resolvidas em `progress-tracker.md`

**Testes:**

- Unitário: meta com 0 transações → percentual 0,
  previsão null
- Unitário: meta com transações → percentual calculado,
  previsão coerente
- Unitário: meta já alcançada → percentual capado em 100,
  previsão = data da última transação contribuinte
- Unitário: ritmo zero (sem investimentos no período) →
  previsão null (não dividir por zero)

**Critério de aceite:**

- Percentual nunca > 100 nem < 0
- Previsão null somente quando ritmo é zero

**Dependências:** S13, S7. Open questions resolvidas em
`progress-tracker.md`.

**Fora do escopo:** Notificações de proximidade da meta,
histórico de progresso ao longo do tempo.

---

## Bloco 8 — Hardening e Deploy

### S15 — Hardening: validação global, exception filter, logger

**Objetivo:** Padronizar resposta de erro e logging em toda
a API.

**Entregáveis:**

- `ValidationPipe` global com:
  ```ts
  { whitelist: true, forbidNonWhitelisted: true, transform: true }
  ```
- `HttpExceptionFilter` global formatando erros conforme
  `code-standards.md`:
  ```ts
  { error: string, message: string, statusCode: number }
  ```
- Logger Nest configurado (sem dados sensíveis em logs —
  nada de tokens, payloads de extrato, conteúdo de PDF)
- `GET /health` (`@Public()`) para o Render

**Testes:**

- E2E: erro 400 retorna formato padronizado
- E2E: 401, 403, 404, 409, 500 todos no formato padrão
- E2E: `GET /health` responde 200 sem token

**Critério de aceite:**

- Nenhum endpoint vaza stacktrace em produção
- Body com campos extras → 400 com mensagem clara

**Dependências:** Todas as anteriores.

**Fora do escopo:** Logger estruturado em JSON, integração
com APM/observabilidade.

---

### S16 — Deploy ready: build, env validation, Render

**Objetivo:** Servidor pronto para deploy no Render com
migrations automáticas e validação de configuração.

**Entregáveis:**

- Validação de env no boot via Zod em
  `src/config/env.schema.ts` — falha rápido se faltar
  variável obrigatória
- Script `build`: `prisma generate && nest build`
- Script `start:prod`:
  `prisma migrate deploy && node dist/main`
- `render.yaml` ou instruções manuais documentadas
- README do back-end com passos de deploy
- Smoke test: `GET /health` em produção responde 200

**Testes:**

- Unitário: schema Zod do env aceita config válida e
  rejeita inválida com mensagem clara

**Critério de aceite:**

- Servidor sobe no Render via `start:prod`
- Migrations aplicadas automaticamente
- `GET /health` 200 em produção
- Env faltando → boot falha com mensagem explícita

**Dependências:** S15.

**Fora do escopo:** CI (GitHub Actions), staging environment,
deploy preview.

---

## Resumo da sequência

| #   | Sessão                                 | Depende de    |
| --- | -------------------------------------- | ------------- |
| S0  | Setup do projeto NestJS                | —             |
| S1  | Prisma + PostgreSQL (NeonDB)           | S0            |
| S2  | Configuração de testes (Jest)          | S0            |
| S3  | ClerkAuthGuard + decorators            | S2            |
| S4  | User sync endpoint                     | S1, S3        |
| S5  | IaService (isolado)                    | S2            |
| S6  | POST /extratos: regra (sem IA)         | S1, S3, S4    |
| S7  | POST /extratos: IA + persistência      | S5, S6        |
| S8  | GET /extratos                          | S7            |
| S9  | GET /transactions                      | S7            |
| S10 | PATCH /transactions/:id                | S9            |
| S11 | GET /dashboard/summary                 | S7            |
| S12 | GET /dashboard/history                 | S11           |
| S13 | POST/GET /goals (sem progresso)        | S4            |
| S14 | Cálculo de progresso e previsão        | S13, S7       |
| S15 | Hardening (validação, filter, logger)  | todas         |
| S16 | Deploy ready                           | S15           |

---

## Princípios aplicados na divisão

- Cada sessão atravessa **uma única fronteira de módulo**
  sempre que possível.
- Mudança de modelo de dados (S1) está separada de qualquer
  lógica de negócio.
- Validação de regra de negócio (S6) está separada da
  integração com IA (S7) — permite cobrir todos os caminhos
  de rejeição sem depender da Claude API.
- `IaService` (S5) é desenvolvido isoladamente **antes** de
  qualquer feature usá-lo, com SDK mockado em 100% dos testes.
- Toda sessão a partir de S2 entrega testes — não existe
  "fase de testes no fim".
- Ambiguidades de produto (Metas) **param o desenvolvimento**
  até serem resolvidas em `progress-tracker.md`, conforme
  regra em `ai-workflow-rules.md`.
- Constraint `@@unique` no banco é tratada como fonte de
  verdade da regra de unicidade — validações no service
  são camadas de UX, não substitutas.

---

## Cobertura de testes esperada por sessão

| Tipo                            | Onde aplicar                                                 |
| ------------------------------- | ------------------------------------------------------------ |
| Unitário com PrismaService mock | Todos os Services com lógica de negócio                      |
| Unitário com SDK mockado        | `IaService` — 100% dos caminhos de erro                      |
| Unitário do guard               | `ClerkAuthGuard` — token válido/inválido/ausente/`@Public()` |
| E2E (supertest)                 | Cada endpoint: status codes, ownership, formato de resposta  |
| Não testar                      | Controllers em isolamento (são apenas wiring HTTP)           |

Cobertura mínima sugerida no projeto: **70%** global,
**90%** em services com regra de negócio
(`ExtratosService`, `IaService`, `DashboardService`,
`GoalsService`, `ClerkAuthGuard`).
