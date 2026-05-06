# AI Workflow Rules

## Approach

Build Lumina incrementally using a spec-driven workflow.
The context files define what to build, how to build it,
and the current state of progress. Always implement
against these specs — do not infer or invent behavior
that is not documented here.

When in doubt about behavior, add an open question to
`progress-tracker.md` and wait for clarification
before implementing.

## Scoping Rules

- Work on one session at a time as defined in
  `backend-development-plan.md`.
- A session is the smallest vertical slice that can be
  verified end to end (e.g. S6 — POST /extratos validates
  duplicate and returns 409).
- Prefer small, verifiable increments over large
  speculative changes.
- Do not combine sessions or merge their scope into
  a single implementation step.
- Do not implement Phase 2 features (notifications,
  chat, score, plans) — they are explicitly out of scope.

## Implementation Order

The authoritative sequence is defined in
`context/backend-development-plan.md`, sessions S0–S16.

Do not follow any other ordering. Do not skip ahead.
Each session lists its own dependencies — honor them.

Summary of blocks for orientation only:

- **Bloco 1 (S0–S2)** — Fundação: NestJS setup, Prisma,
  Jest config.
- **Bloco 2 (S3–S4)** — Autenticação: ClerkAuthGuard,
  user sync.
- **Bloco 3 (S5)** — IaService isolado.
- **Bloco 4 (S6–S8)** — Extratos: validação, IA,
  persistência, listagem.
- **Bloco 5 (S9–S10)** — Transações: listagem e revisão.
- **Bloco 6 (S11–S12)** — Dashboard: summary e history.
- **Bloco 7 (S13–S14)** — Metas: CRUD e progresso.
- **Bloco 8 (S15–S16)** — Hardening e deploy.

For details of each session (entregáveis, testes,
critério de aceite, dependências), always read
`context/backend-development-plan.md` directly.

## When to Split Work

Split an implementation step if it combines:

- Back-end and mobile changes simultaneously.
- More than one session boundary as defined in the plan.
- Any behavior not clearly defined in the context files.
- A data model change and business logic in the same step.

If a change cannot be verified end to end quickly,
the scope is too broad — split it.

## Handling Missing Requirements

- Do not invent product behavior not defined in the
  context files.
- If a requirement is ambiguous, add it as an open
  question in `progress-tracker.md` and stop.
- Do not proceed with an ambiguous requirement —
  resolve it first.
- The Goals block (S13–S14) has documented open questions
  in `progress-tracker.md` that must be resolved before
  implementation starts.

## Protected Files

Do not modify the following unless explicitly instructed:

- `context/*.md` — context files are only updated when
  implementation decisions change the system design,
  not for cosmetic reasons.
- `context/backend-development-plan.md` — this is the
  plan, not a log. Only update if a product decision
  changes what a session delivers.
- `prisma/migrations/*` — never edit migration files
  manually.
- `frontend/components/ui/*` — do not modify base UI
  components when working on feature screens. If a
  component needs to change, do it as a separate step.

## Keeping Docs in Sync

Update `progress-tracker.md` after every session.
Update the relevant context file if implementation
changes any of the following:

- System architecture or module boundaries.
- Prisma schema or storage model.
- Code conventions or file organization.
- Feature scope (in scope or out of scope).

## Before Closing a Session

1. All entregáveis listed in the session are present.
2. All testes listed in the session pass.
3. The critério de aceite is met.
4. No invariant defined in `architecture.md` was violated.
5. `progress-tracker.md` marks the session as ✅ Completed
   and sets the next session as Current Session.
6. `npm run build` passes without errors.
7. No `any` types introduced without justification.