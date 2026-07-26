# `@flash-sale/types`

Minimal shared TypeScript contracts for the Flash Sale System monorepo.

## Rule

Add a type here only when it is a **genuine cross-application contract** used by both `apps/api` and `apps/web`.

Do **not**:

- Mirror Prisma models
- Pre-create Product / FlashSale / Purchase / inventory types
- Invent `ApiError` / `Result` shapes “for later”

Domain types belong in domain packages/epics when requirements are known.
