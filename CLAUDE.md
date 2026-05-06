## Application Building Context

Read the following files in order before implementing
or making any architectural decision:

1. `context/project-overview.md` — product definition,
   goals, features, and scope
2. `context/architecture.md` — system structure,
   boundaries, storage model, and invariants
3. `context/backend-development-plan.md` — session-by-session
   back-end implementation plan (S0–S16). Authoritative
   source for what to build next and in what order.
4. `context/ui-context.md` — theme, colors, typography,
   and component conventions
5. `context/code-standards.md` — implementation rules
   and conventions
6. `context/ai-workflow-rules.md` — development workflow,
   scoping rules, and delivery approach
7. `context/progress-tracker.md` — current session,
   completed sessions, open questions, and next step

## Before Every Implementation Step

1. Read `context/progress-tracker.md` to find the
   **Current Session** field.
2. Open the corresponding session (e.g. S3) in
   `context/backend-development-plan.md` and read its
   Objective, Entregáveis, Testes, and Critério de aceite.
3. Implement only what that session defines.
4. After finishing, update `context/progress-tracker.md`
   marking that session as ✅ Completed and setting the
   next session as Current Session.

If implementation changes the architecture, scope, or
standards documented in the context files, update the
relevant file before continuing.
