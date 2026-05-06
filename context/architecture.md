# Architecture Context

## Stack

| Layer      | Technology                       | Role                                          |
| ---------- | -------------------------------- | --------------------------------------------- |
| Mobile     | Expo (React Native) + TypeScript | Interface do usuário, iOS e Android           |
| Back-end   | NestJS + TypeScript              | API REST, regras de negócio, orquestração     |
| ORM        | Prisma                           | Acesso ao banco de dados, migrations          |
| Database   | PostgreSQL (NeonDB)              | Persistência de todos os dados                |
| Auth       | Clerk                            | Autenticação, sessão e JWT                    |
| IA         | Claude API (claude-haiku-4-5)    | Extração e categorização de transações em PDF |
| Hospedagem | Render                           | Back-end (Web Service) + PostgreSQL           |

## Repository Structure

```
LuminaProject/
├── CLAUDE.md
├── context/
│   ├── project-overview.md
│   ├── architecture.md
│   ├── ui-context.md
│   ├── code-standards.md
│   ├── ai-workflow-rules.md
│   └── progress-tracker.md
├── lumina/                # NestJS API
│   ├── src/
│   │   ├── extratos/      # Upload, validação, chamada à IA
│   │   ├── transactions/  # CRUD de transações, revisão
│   │   ├── dashboard/     # Agregações para gráficos
│   │   ├── goals/         # Metas financeiras
│   │   ├── ia/            # Serviço isolado de Claude API
│   │   └── common/        # Guards, decorators, pipes
│   ├── prisma/
│   │   └── schema.prisma
│   └── .env
└── frontend/              # Expo app
    ├── app/               # Expo Router (file-based routing)
    ├── components/
    │   └── ui/            # Componentes de design system
    ├── hooks/
    ├── services/          # Chamadas à API do back-end
    └── constants/
```

## System Boundaries

- `frontend/` — App Expo. Responsável por UI, navegação e
  autenticação via Clerk Expo SDK. Chama apenas o back-end
  próprio. Nunca acessa a Claude API ou o banco de dados
  diretamente.

- `lumina/src/extratos/` — Recebe o PDF via multipart.
  Executa validações na seguinte ordem:
  1. MIME type e tamanho do arquivo (400 se inválido).
  2. Detecção de criptografia via `pdf-lib` — se o PDF
     estiver criptografado e nenhuma senha for fornecida,
     retorna 422 com código `PDF_ENCRYPTED`. Se a senha
     estiver errada, retorna 422 com código `WRONG_PASSWORD`.
     A descriptografia ocorre em memória.
  3. Regra de negócio: 1 extrato por banco por mês (409
     se duplicado). Só então chama IaService.
  Persiste o resultado via Prisma.

- `lumina/src/transactions/` — CRUD de transações,
  atualização de categoria pelo usuário, listagem
  com filtros de mês e banco.

- `lumina/src/dashboard/` — Queries de agregação para
  o resumo do mês, gráfico de pizza e histórico mensal.
  Não persiste dados — apenas lê e agrega.

- `lumina/src/goals/` — Criação, listagem e cálculo
  de progresso de metas. Progresso calculado com base
  nas transações de categoria "investimento".

- `lumina/src/ia/` — Serviço isolado que encapsula toda
  comunicação com a Claude API. Nenhum outro módulo acessa
  a Claude API diretamente — sempre via IaService.

- `lumina/src/common/` — Guards de autenticação Clerk,
  decorator @CurrentUser(), pipes de validação global.

## Storage Model

- **PostgreSQL**: fonte de verdade de todos os dados —
  usuários (clerk_id), extratos, transactions, goals.

- **Sem armazenamento de PDF**: o arquivo é recebido como
  buffer em memória, enviado à IA e descartado imediatamente.
  Apenas o resultado (transações em JSON) é persistido.

## Prisma Schema (modelo de dados)

```prisma
model User {
  id          String    @id @default(uuid())
  clerkId     String    @unique
  createdAt   DateTime  @default(now())
  extratos    Extrato[]
  goals       Goal[]
}

model Extrato {
  id          String        @id @default(uuid())
  userId      String
  user        User          @relation(fields: [userId], references: [id])
  banco       String
  mesAno      String        // formato: "2026-05"
  status      ExtratoStatus @default(PROCESSING)
  createdAt   DateTime      @default(now())
  transactions Transaction[]

  @@unique([userId, banco, mesAno])  // regra de negócio no DB
}

model Transaction {
  id          String   @id @default(uuid())
  extratoId   String
  extrato     Extrato  @relation(fields: [extratoId], references: [id], onDelete: Cascade)
  date        DateTime
  description String
  amount      Decimal  @db.Decimal(12, 2)
  category    Category
  confidence  Decimal  @db.Decimal(3, 2)
  reviewed    Boolean  @default(false)
  createdAt   DateTime @default(now())
}

model Goal {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  name        String
  targetAmount Decimal @db.Decimal(12, 2)
  deadline    DateTime
  createdAt   DateTime @default(now())
}

enum ExtratoStatus {
  PROCESSING
  OK
  ERROR
}

enum Category {
  alimentacao
  transporte
  moradia
  lazer
  saude
  assinaturas
  compras
  investimento
  outro
}
```

## Auth and Access Model

- Autenticação via Clerk. O mobile usa `@clerk/clerk-expo`.
- O JWT do Clerk é enviado no header
  `Authorization: Bearer <token>` em todas as requests.
- O back-end valida o JWT via `@clerk/clerk-sdk-node`
  como guard global em todos os endpoints.
- O `clerkId` do token é usado para resolver o `userId`
  interno em todas as queries.
- Nenhum endpoint aceita `userId` como parâmetro de corpo
  ou query — sempre extraído do token.
- Ownership é validado antes de qualquer operação de
  leitura ou escrita sobre extratos, transações e metas.

## Deployment

- **Back-end**: Render Web Service (Node.js).
  Build command: `npm run build`
  Start command: `node dist/main`
- **Banco**: NeonDB (PostgreSQL serverless).
  A DATABASE_URL é injetada como variável de ambiente.
  Inicializar o projeto Neon com: `npx neonctl@latest init`
- **Migrations**: `prisma migrate deploy` roda no
  start-up do serviço via script de build.
- **Variáveis de ambiente necessárias no Render**:
  - `DATABASE_URL`
  - `CLERK_SECRET_KEY`
  - `ANTHROPIC_API_KEY`

## Invariants

1. O PDF nunca é salvo em disco ou banco de dados.
   É processado em memória e descartado após a extração.

2. A Claude API só é chamada após todas as validações
   de arquivo e regra de negócio passarem. A ordem é
   obrigatória: MIME/tamanho → criptografia → duplicidade
   → IA. Se o PDF estiver criptografado sem senha válida,
   ou se o extrato já existir, a IA não é chamada.

3. O `userId` nunca vem do corpo da requisição.
   Sempre é resolvido a partir do clerkId no JWT validado.

4. Nenhum módulo acessa a Claude API diretamente.
   Toda comunicação com IA passa exclusivamente por
   `IaService`.

5. Toda operação de leitura e escrita valida ownership —
   o recurso deve pertencer ao usuário autenticado.

6. A constraint `@@unique([userId, banco, mesAno])` no
   schema Prisma é a fonte de verdade da regra de 1
   extrato por banco por mês. A validação no service
   é camada adicional de UX, não substituto.

7. A senha de PDF nunca é persistida. É recebida como
   campo opcional no multipart, usada exclusivamente para
   descriptografar o buffer em memória via `pdf-lib`, e
   descartada junto com o buffer após a extração.
