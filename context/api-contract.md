# API Contract — Lumina Backend ↔ Frontend

Documento de referência para a comunicação entre o app Expo
e a API NestJS. Derivado diretamente do código fonte — não
editar manualmente; atualizar quando controllers ou DTOs mudarem.

---

## Convenções globais

### Autenticação

Toda rota (exceto `GET /health`) exige o JWT do Clerk no header:

```
Authorization: Bearer <clerk_jwt>
```

O `userId` interno **nunca** é aceito como parâmetro — sempre
derivado do token pelo back-end.

### Envelope de resposta

```typescript
// Sucesso
{ data: T }

// Erro
{ error: string, message: string, statusCode: number }
// Quando o erro carrega código semântico (ex: PDF_ENCRYPTED):
{ error: string, message: string, statusCode: number, code: string }
```

### Tipos base

```typescript
// Categorias de transação (espelhado em frontend/constants/categories.ts)
type Category =
  | 'alimentacao'
  | 'transporte'
  | 'moradia'
  | 'lazer'
  | 'saude'
  | 'assinaturas'
  | 'compras'
  | 'investimento'
  | 'outro'

type TransactionType = 'debit' | 'credit'

// Formato de mês: "YYYY-MM" (ex: "2026-05")
type MesAno = string
```

---

## Rotas

### Infraestrutura

#### `GET /health`

Probe de liveness — não requer autenticação.

**Resposta 200:**
```json
{ "status": "ok" }
```

> Não segue o envelope `{ data }` — é endpoint de infra, não recurso de domínio.

---

### Usuários

#### `POST /users/sync`

Cria ou recupera o usuário interno correspondente ao Clerk ID
do token. Deve ser chamado pelo mobile no primeiro login e a
cada sessão antes de qualquer outra operação.

**Request:** sem corpo.

**Resposta 201** (primeira vez):
```json
{
  "data": {
    "id": "uuid",
    "clerkId": "clerk_xxx",
    "createdAt": "2026-05-19T00:00:00.000Z"
  }
}
```

**Resposta 200** (usuário já existe — idempotente):
```json
{
  "data": {
    "id": "uuid",
    "clerkId": "clerk_xxx",
    "createdAt": "2026-05-19T00:00:00.000Z"
  }
}
```

| Status | Motivo |
|--------|--------|
| 201 | Usuário criado |
| 200 | Usuário já existia |
| 401 | Token ausente ou inválido |

---

### Extratos

#### `POST /extratos`

Importa um extrato PDF. Valida, descriptografa se necessário,
extrai transações via IA e persiste tudo atomicamente.

**Request:** `multipart/form-data`

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `file` | PDF (≤ 10 MB) | Sim | Arquivo do extrato |
| `banco` | string (não vazia) | Sim | Nome do banco (livre — o mobile usa seletor) |
| `mesAno` | string `YYYY-MM` | Sim | Mês de referência |
| `password` | string | Não | Senha de descriptografia, se o PDF for protegido |

**Resposta 201:**
```json
{
  "data": {
    "extrato": {
      "id": "uuid",
      "banco": "Nubank",
      "mesAno": "2026-05",
      "createdAt": "2026-05-19T00:00:00.000Z"
    },
    "transactions": [
      {
        "id": "uuid",
        "extratoId": "uuid",
        "date": "2026-05-03T00:00:00.000Z",
        "description": "Supermercado Extra",
        "amount": "150.00",
        "type": "debit",
        "category": "alimentacao",
        "confidence": "0.95",
        "reviewed": false,
        "createdAt": "2026-05-19T00:00:00.000Z",
        "updatedAt": "2026-05-19T00:00:00.000Z"
      }
    ]
  }
}
```

> `amount` e `confidence` são strings decimais serializadas pelo
> Prisma Decimal — converter com `parseFloat()` no mobile.

| Status | Motivo |
|--------|--------|
| 201 | Extrato importado com sucesso |
| 400 | Arquivo ausente, não-PDF, tamanho > 10 MB ou `mesAno` inválido |
| 401 | Token ausente ou inválido |
| 409 | Extrato já existe para este banco e mês |
| 422 `code: PDF_ENCRYPTED` | PDF protegido, nenhuma senha informada |
| 422 `code: WRONG_PASSWORD` | Senha informada está incorreta |
| 502 | Falha na IA ao processar o PDF |

**Fluxo de criptografia no mobile:**

```
1. Tentar upload sem password
   └─ 422 PDF_ENCRYPTED → pedir senha ao usuário → reenviar com password
   └─ 422 WRONG_PASSWORD → senha errada → pedir novamente
   └─ 201 → sucesso
```

---

#### `GET /extratos`

Lista os extratos do usuário autenticado.

**Query params (todos opcionais):**

| Param | Formato | Descrição |
|-------|---------|-----------|
| `mesAno` | `YYYY-MM` | Filtra por mês |
| `banco` | string | Filtra por banco |

**Resposta 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "banco": "Nubank",
      "mesAno": "2026-05",
      "createdAt": "2026-05-19T00:00:00.000Z"
    }
  ]
}
```

Ordenado por `createdAt` desc (mais recente primeiro).

| Status | Motivo |
|--------|--------|
| 200 | OK (pode retornar array vazio) |
| 400 | `mesAno` em formato inválido |
| 401 | Token ausente ou inválido |

---

### Transações

#### `GET /transactions`

Lista as transações do usuário com filtros opcionais.

**Query params (todos opcionais):**

| Param | Formato | Descrição |
|-------|---------|-----------|
| `mesAno` | `YYYY-MM` | Filtra por mês do extrato |
| `banco` | string | Filtra por banco do extrato |
| `onlyUnreviewed` | `"true"` / `"false"` | Retorna apenas não revisadas quando `true` |

**Resposta 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "extratoId": "uuid",
      "date": "2026-05-03T00:00:00.000Z",
      "description": "Supermercado Extra",
      "amount": "150.00",
      "type": "debit",
      "category": "alimentacao",
      "confidence": "0.95",
      "reviewed": false,
      "createdAt": "2026-05-19T00:00:00.000Z",
      "updatedAt": "2026-05-19T00:00:00.000Z"
    }
  ]
}
```

Ordenado por `date` desc (mais recente primeiro).

| Status | Motivo |
|--------|--------|
| 200 | OK (pode retornar array vazio) |
| 400 | `mesAno` inválido ou `onlyUnreviewed` com valor além de `"true"`/`"false"` |
| 401 | Token ausente ou inválido |

---

#### `PATCH /transactions/:id`

Corrige a categoria de uma transação e marca como revisada.

**Request body:**
```json
{ "category": "transporte" }
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `category` | `Category` | Sim | Nova categoria (deve ser um dos 9 valores válidos) |

**Resposta 200:**
```json
{
  "data": {
    "id": "uuid",
    "extratoId": "uuid",
    "date": "2026-05-03T00:00:00.000Z",
    "description": "Uber",
    "amount": "22.50",
    "type": "debit",
    "category": "transporte",
    "confidence": "0.60",
    "reviewed": true,
    "createdAt": "2026-05-19T00:00:00.000Z",
    "updatedAt": "2026-05-19T00:00:00.000Z"
  }
}
```

> `reviewed` sempre vira `true`, mesmo que a categoria não mude.

| Status | Motivo |
|--------|--------|
| 200 | Transação atualizada |
| 400 | `category` ausente ou fora dos valores válidos |
| 401 | Token ausente ou inválido |
| 404 | Transação inexistente **ou** não pertence ao usuário (nunca 403 — evita vazar existência) |

---

### Dashboard

#### `GET /dashboard/summary`

Resumo financeiro do mês para o card principal e gráfico de pizza.

**Query params (todos opcionais):**

| Param | Formato | Default | Descrição |
|-------|---------|---------|-----------|
| `mesAno` | `YYYY-MM` | Mês atual (UTC) | Mês de referência |
| `banco` | string | Todos os bancos | Filtra por banco |

**Resposta 200:**
```json
{
  "data": {
    "mesAno": "2026-05",
    "totalGasto": 1500.00,
    "categoriaMaior": {
      "categoria": "alimentacao",
      "valor": 600.00
    },
    "variacaoVsMesAnterior": 12.5,
    "pieChart": [
      { "categoria": "alimentacao", "valor": 600.00, "percentual": 40.00 },
      { "categoria": "transporte",  "valor": 450.00, "percentual": 30.00 },
      { "categoria": "lazer",       "valor": 450.00, "percentual": 30.00 }
    ]
  }
}
```

**Invariantes do response:**
- `totalGasto` considera apenas transações `type: debit`
- `categoriaMaior` é `null` quando não há gastos no mês
- `variacaoVsMesAnterior` é `null` quando o mês anterior não tem dados (evita divisão por zero)
- `variacaoVsMesAnterior` negativo = gastou menos; positivo = gastou mais
- Soma de `pieChart[].percentual` está sempre em `[99.99, 100.01]`
- `pieChart` é `[]` quando `totalGasto === 0`

| Status | Motivo |
|--------|--------|
| 200 | OK |
| 400 | `mesAno` em formato inválido |
| 401 | Token ausente ou inválido |

---

#### `GET /dashboard/history`

Histórico dos últimos 6 meses para o gráfico de barras.
Sem query params — sempre retorna os 6 meses mais recentes
a partir do mês atual (UTC).

**Resposta 200:**
```json
{
  "data": {
    "history": [
      { "mesAno": "2025-12", "totalGasto": 1200.00 },
      { "mesAno": "2026-01", "totalGasto": 980.50 },
      { "mesAno": "2026-02", "totalGasto": 1350.00 },
      { "mesAno": "2026-03", "totalGasto": 0.00 },
      { "mesAno": "2026-04", "totalGasto": 1100.75 },
      { "mesAno": "2026-05", "totalGasto": 1500.00 }
    ]
  }
}
```

**Invariantes do response:**
- Sempre exatamente 6 entradas
- Ordem cronológica ascendente — mês atual sempre na última posição
- Meses sem dados retornam `totalGasto: 0` (nunca omitidos)
- Considera apenas transações `type: debit`

| Status | Motivo |
|--------|--------|
| 200 | OK |
| 401 | Token ausente ou inválido |

---

### Metas

#### `POST /goals`

Cria uma nova meta financeira.

**Request body:**
```json
{
  "name": "Viagem para Europa",
  "targetAmount": 15000.00,
  "deadline": "2027-06-01T00:00:00.000Z"
}
```

| Campo | Tipo | Regras |
|-------|------|--------|
| `name` | string | Não vazio |
| `targetAmount` | number | Positivo (> 0) |
| `deadline` | ISO 8601 date string | Deve ser data futura |

**Resposta 201:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Viagem para Europa",
    "targetAmount": 15000.00,
    "deadline": "2027-06-01T00:00:00.000Z",
    "createdAt": "2026-05-19T00:00:00.000Z"
  }
}
```

> O response do POST não inclui campos de progresso (`valorAcumulado`,
> `percentual`, `previsaoConclusao`) — use `GET /goals` para obter
> a meta com progresso calculado.

| Status | Motivo |
|--------|--------|
| 201 | Meta criada |
| 400 | `name` vazio, `targetAmount` ≤ 0, `deadline` no passado ou data inválida |
| 401 | Token ausente ou inválido |

---

#### `GET /goals`

Lista as metas do usuário com progresso e previsão calculados.

**Request:** sem parâmetros.

**Resposta 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Viagem para Europa",
      "targetAmount": 15000.00,
      "deadline": "2027-06-01T00:00:00.000Z",
      "createdAt": "2026-05-19T00:00:00.000Z",
      "valorAcumulado": 3750.00,
      "percentual": 25.00,
      "previsaoConclusao": "2027-03-19T00:00:00.000Z"
    }
  ]
}
```

**Invariantes do response:**
- `percentual` está sempre em `[0, 100]` — capado em 100 mesmo se `valorAcumulado > targetAmount`
- `previsaoConclusao` é a data da última transação contribuinte quando a meta já foi atingida
- `previsaoConclusao` é `null` quando o ritmo de investimento mensal é zero (sem histórico)
- Progresso conta apenas transações `category: "investimento"` com `date >= goal.createdAt`
- Ordenado por `createdAt` desc

| Status | Motivo |
|--------|--------|
| 200 | OK (pode retornar array vazio) |
| 401 | Token ausente ou inválido |

---

## Mapa de rotas resumido

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| `GET` | `/health` | ❌ | Liveness probe |
| `POST` | `/users/sync` | ✅ | Sincronizar usuário Clerk → banco |
| `POST` | `/extratos` | ✅ | Importar extrato PDF |
| `GET` | `/extratos` | ✅ | Listar extratos |
| `GET` | `/transactions` | ✅ | Listar transações com filtros |
| `PATCH` | `/transactions/:id` | ✅ | Corrigir categoria de uma transação |
| `GET` | `/dashboard/summary` | ✅ | Resumo do mês (card + pizza) |
| `GET` | `/dashboard/history` | ✅ | Histórico dos últimos 6 meses |
| `POST` | `/goals` | ✅ | Criar meta financeira |
| `GET` | `/goals` | ✅ | Listar metas com progresso |

---

## Notas para o mobile

### Instância base (`services/api.ts`)

```typescript
// Toda request precisa do JWT do Clerk no header
const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
})
api.interceptors.request.use(async (config) => {
  const token = await getToken() // Clerk Expo SDK
  config.headers.Authorization = `Bearer ${token}`
  return config
})
```

### Serialização de decimais

`amount` e `confidence` chegam como **strings** (serialização
do `Prisma.Decimal`). Sempre converter com `parseFloat()` antes
de usar em cálculos ou exibir ao usuário.

### Erros com `code` semântico

Para erros 422 no upload de extrato, verificar o campo `code`
antes de exibir a mensagem ao usuário:

```typescript
if (error.response?.data?.code === 'PDF_ENCRYPTED') {
  // pedir senha ao usuário
}
if (error.response?.data?.code === 'WRONG_PASSWORD') {
  // senha errada — pedir novamente
}
```

### Inicialização de sessão

Chamar `POST /users/sync` após o login do Clerk, antes de
qualquer outra chamada à API. Sem isso, o back-end não consegue
resolver o `userId` interno e retorna 404 em todas as rotas
de domínio.
