# Redis caching & rate-limit strategy

Redis is a **non-authoritative** performance and abuse-protection layer. It accelerates GraphQL reads and soft-limits `purchaseItem` traffic. It never decides inventory availability, reservation success, or purchase creation.

> **Redis optimizes traffic; Postgres decides whether a purchase can actually happen.**

Design contract: [EPIC-04 scalability & Redis design](superpowers/specs/2026-07-29-epic-04-scalability-redis-design.md).

## What Redis owns / does not own

| Redis owns (best-effort)                                                                      | Postgres owns (source of truth)                    |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Read cache for `flashSale` (GraphQL snapshot, incl. presentation `remainingStock` / `status`) | `remaining_stock`, atomic reservation              |
| Read cache for `myPurchase` purchase lookup (including short-lived negatives)                 | Purchase create, unique `(flash_sale_id, user_id)` |
| Fixed-window IP rate limiting for `purchaseItem` only                                         | Transactional purchase consistency                 |
| Best-effort post-SUCCESS cache invalidation                                                   | Whether a purchase actually succeeds               |

**Not owned by Redis:** stock counters, admission control, sale existence for `myPurchase`, anything inside `PurchaseFlow` / Prisma adapters / `@flash-sale/domain`.

**`myPurchases` (#125):** served directly from Postgres (uncached). History list caching and post-SUCCESS invalidation for that list are deferred to #129.

Query caches are API read concerns used only by their resolvers. Rate limiting runs **before** `PURCHASE_FLOW.execute` and before any purchase transaction.

## Cache keys, TTLs, and staleness

Versioned key prefixes (env defaults locked for EPIC-04):

| Key                                        | Purpose                                 | Default TTL                                                                                          |
| ------------------------------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `flash-sale:v1:{flashSaleId}`              | Full GraphQL-facing flash-sale snapshot | `FLASH_SALE_CACHE_TTL_SECONDS=5`                                                                     |
| `my-purchase:v1:{flashSaleId}:{userId}`    | Purchase lookup envelope                | `MY_PURCHASE_CACHE_TTL_SECONDS=5` (positive) / `MY_PURCHASE_NEGATIVE_CACHE_TTL_SECONDS=2` (negative) |
| `rate-limit:v1:purchaseItem:ip:{clientIp}` | Fixed-window counter                    | window = `RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS=60`                                                |

**Negative caching (`myPurchase` only):** values use an explicit envelope (`{ found: true, purchase: … }` or `{ found: false }`), never an ambiguous raw `"null"` string. Negatives use the shorter TTL so a just-completed purchase converges quickly if invalidation is delayed.

**Presentation staleness:** cached `remainingStock` and `status` may be stale for up to the TTL. Cache hits return the stored snapshot as-is (do not recompute status from cached timestamps). The purchase path never consults these caches.

**Sale existence before purchase cache:** `myPurchase` always runs uncached `FLASH_SALE_REPOSITORY.findById` first. A missing sale returns `NOT_FOUND` — never a cached negative purchase result. `MyPurchaseQueryCache` does not own or cache flash-sale existence.

### Validated IDs only

Cache and rate-limit identity segments are built only from **validated** branded IDs (`FlashSaleId` / `UserId` after `requireFlashSaleId` / `requireUserId` / `requireId`) or from the resolved client IP string. Never interpolate raw GraphQL argument strings into Redis keys.

## Invalidation

Owned by the `purchaseItem` resolver, **after** `PURCHASE_FLOW.execute` returns a committed `SUCCESS`:

1. Rate-limit check
2. `PURCHASE_FLOW.execute` (Postgres only; returns after the transaction completes)
3. On `SUCCESS` only: `Promise.all` best-effort deletes of `flash-sale:v1:{flashSaleId}` and `my-purchase:v1:{flashSaleId}:{userId}` (current user only)
4. Return the mutation result to the client

Invalidation helpers **must not throw**. Invalidation failure must **not** fail the mutation: the purchase remains `SUCCESS`, emit `redis_cache_invalidation_failed`, and rely on TTL for eventual convergence.

## Fail-open behavior

Redis outages must not block the API or invent purchase failures:

| Failure                               | Behavior                                                        | Log event                         |
| ------------------------------------- | --------------------------------------------------------------- | --------------------------------- |
| Cache get/set                         | Bypass Redis; serve from Postgres                               | `redis_cache_degraded`            |
| Rate limiter unavailable              | Allow request into Postgres purchase path                       | `redis_rate_limit_degraded`       |
| Post-SUCCESS invalidation             | Mutation stays SUCCESS; TTL recovers                            | `redis_cache_invalidation_failed` |
| Startup / connection (`onModuleInit`) | API still boots; background reconnect OK; ops keep failing open | `redis_connection_degraded`       |

## Rate limiting

- **Scope:** `purchaseItem` only (not all GraphQL operations). Soft abuse protection — not inventory correctness.
- **Identity now:** client IP. Redis key `rate-limit:v1:purchaseItem:ip:{clientIp}`. Do **not** use caller-supplied `userId` (unauthenticated and rotatable).
- **Identity later (AuthN epic):** switch primary key to authenticated identity; IP may become an optional secondary.
- **Algorithm:** fixed window; defaults `RATE_LIMIT_PURCHASE_ITEM_MAX=30` per `RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS=60`. Exceeded → GraphQL error `extensions.code = RATE_LIMITED` (not a `PurchaseOutcome`); no `PURCHASE_FLOW`, no Prisma transaction, no DB write.
- **Atomicity:** expiry is bound to the first increment in one Redis primitive. No racey `GET → INCR → SET`, and no separate `INCR` then `EXPIRE`.
- **IPv6 / mapped addresses:** rate-limit keys use whatever string IP resolution returns. IPv4 and IPv6 (including addresses with `:`) are distinct key strings. This epic does **not** merge `::ffff:x.x.x.x` with `x.x.x.x`.

### Client IP and `TRUSTED_PROXY`

- Default (`TRUSTED_PROXY=false`): use the socket remote address only. Do **not** read `X-Forwarded-For`.
- When `TRUSTED_PROXY=true`: Express `trust proxy` hop count is `1`, then use Express `req.ip`.
- Parse `TRUSTED_PROXY` only via env validation / `ConfigService`. `main.ts` must not re-parse `process.env.TRUSTED_PROXY` with different rules — single source of truth.

## Observability event names

Structured logs use these event names:

- `redis_cache_degraded`
- `redis_rate_limit_degraded`
- `redis_cache_invalidation_failed`
- `redis_connection_degraded`
