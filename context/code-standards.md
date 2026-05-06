# Code Standards

## General

- Keep modules small and single-purpose. One module
  owns one domain boundary.
- Fix root causes — do not layer workarounds or
  suppress errors.
- Do not mix unrelated concerns in one service,
  controller, or component.
- All code is in English. All UI strings visible
  to the user are in Brazilian Portuguese.
- No commented-out code in commits.

## TypeScript

- Strict mode is required throughout — both backend
  and mobile.
- No `any`. Use explicit interfaces or narrowly scoped
  types. Unknown external input must be cast through
  a validated DTO or Zod schema before use.
- Prefer `type` for shapes, `interface` for contracts
  that may be extended.
- All async functions return explicit typed Promises.
- Enums for fixed sets of values (`ExtratoStatus`,
  `Category`). Both are Prisma enums — generated client
  types are imported from `@prisma/client`. Never use raw
  strings where an enum exists. The mobile app mirrors
  these as TypeScript const enums in
  `frontend/constants/categories.ts` to avoid coupling to
  Prisma client on the device.

## NestJS (Back-end)

- Every module has: Controller, Service, Module file.
  DTOs live in a `dto/` subfolder. Entities/types in
  `types/` or directly in the service file if small.
- Controllers handle HTTP only — no business logic.
  Business logic lives in Services.
- Use class-validator decorators on all DTOs.
  ValidationPipe is global.
- Guards run before controllers. Auth guard is global.
  No endpoint is public unless explicitly decorated
  with `@Public()`.
- Services never import other Services directly across
  module boundaries — use Module imports and inject
  the provider.
- IaService is the only module allowed to instantiate
  the Anthropic SDK client.

## Prisma

- All database access goes through Prisma Client.
  No raw SQL unless explicitly necessary and documented.
- Migrations are generated via `prisma migrate dev`
  in development. Never edit migration files manually.
- `prisma migrate deploy` runs on Render before start.
- The PrismaService is a global injectable — import
  PrismaModule in AppModule.

## Expo / React Native (Mobile)

- File-based routing via Expo Router. Route files live
  in `app/`. No manual navigation setup.
- All screens are functional components with typed props.
- No business logic in screen files. Data fetching
  and state live in custom hooks in `hooks/`.
- API calls are encapsulated in service files in
  `services/`. Screens and hooks never call `fetch`
  directly — always via a service function.
- All colors, spacing, typography and border radius
  come from constants files. No hardcoded values
  in component styles.
- **Styling boundary** — NativeWind is used **only** for
  layout utilities (flex, gap, padding, margin, width,
  height alignment). All visual styling (colors,
  typography, borders, radius, shadows, opacity) lives
  in `StyleSheet.create()` consuming the design tokens.
  Never mix the two on the same property: a component
  either uses NativeWind for layout and StyleSheet for
  appearance, or it uses StyleSheet for both. No inline
  style objects outside `StyleSheet.create()`.

## API Communication

- The mobile app sends the Clerk JWT in every request:
  `Authorization: Bearer <token>`.
- All API responses follow the shape:
  ```typescript
  // success
  { data: T }
  // error
  { error: string, message: string, statusCode: number }
  ```
- Errors are handled in the service layer on mobile —
  screens receive either the data or a typed error state.

## File Organization

### Back-end

```
lumina/src/
├── extratos/
│   ├── extratos.controller.ts
│   ├── extratos.service.ts
│   ├── extratos.module.ts
│   └── dto/
│       └── import-extrato.dto.ts
├── transactions/
├── dashboard/
├── goals/
├── ia/
│   ├── ia.service.ts
│   └── ia.module.ts
├── common/
│   ├── guards/
│   │   └── clerk-auth.guard.ts
│   ├── decorators/
│   │   └── current-user.decorator.ts
│   └── prisma/
│       ├── prisma.service.ts
│       └── prisma.module.ts
└── app.module.ts
```

### Mobile

```
frontend/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx         # Dashboard
│   │   ├── extratos.tsx      # Extratos
│   │   ├── goals.tsx         # Metas
│   │   └── profile.tsx       # Perfil
│   └── _layout.tsx
├── components/
│   └── ui/
│       ├── Card.tsx
│       ├── Button.tsx
│       ├── Badge.tsx
│       ├── SectionTitle.tsx
│       └── LoadingSpinner.tsx
├── hooks/
│   ├── useExtratos.ts
│   ├── useDashboard.ts
│   └── useGoals.ts
├── services/
│   ├── api.ts                # Instância base com JWT
│   ├── extratos.service.ts
│   ├── dashboard.service.ts
│   └── goals.service.ts
└── constants/
    ├── colors.ts
    ├── typography.ts
    ├── spacing.ts
    ├── radius.ts
    └── categories.ts
```

## Environment Variables

### Back-end (.env)

```
DATABASE_URL=
CLERK_SECRET_KEY=
ANTHROPIC_API_KEY=
PORT=3000
```

### Mobile (.env)

```
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
```

Variáveis de ambiente do mobile devem ter o prefixo
`EXPO_PUBLIC_` para serem acessíveis no bundle.
Nunca colocar secrets no mobile — apenas a publishable
key do Clerk (que é pública por design).
