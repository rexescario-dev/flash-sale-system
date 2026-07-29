# EPIC-04 — Scalability & Redis (Design Spec)

**Status:** Draft (umbrella contract — revised after review; pending re-approval)
**Date:** 2026-07-29
**Epic:** [EPIC-04 #84](https://github.com/rexescario-dev/flash-sale-system/issues/84)
**Child issues:** #27–#32
**Repository:** `rexescario-dev/flash-sale-system`
**Depends on:** EPIC-01 Compose Redis + `REDIS_URL` (#2/#4), EPIC-02 purchase/reservation correctness (#11–#20), EPIC-03 GraphQL API (#21–#26), EPIC-05 web client optional for manual verification only

## Goal

Add Redis as a **non-authoritative** performance and abuse-protection layer: read caching for `flashSale` / `myPurchase`, and IP-based rate limiting for `purchaseItem` — without changing inventory correctness. PostgreSQL remains the sole source of truth for stock, reservation, purchase creation, uniqueness, and transactional consistency.

## Architectural principle

> **Redis is strictly non-authoritative. It may accelerate reads and provide best-effort abuse protection, but Redis state must never determine inventory availability, reservation success, or purchase creation. Postgres remains the sole source of truth for those concerns.**

**Operational corollary:**

> **Redis optimizes traffic; Postgres decides whether a purchase can actually happen.**

Keep `@flash-sale/domain` free of Redis/Nest cache types. Keep `PurchaseFlow` and Prisma adapters cache-unaware. Query caching is an **API read concern** owned by dedicated query-cache services used only by `flashSale` / `myPurchase` resolvers. Rate limiting runs **before** `PURCHASE_FLOW.execute` and before entering the purchase transaction.

## Locked decisions

| Area                                 | Decision                                                                                                                                                                                                         |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Redis role                           | Read cache + rate limiting only; **no** Redis stock counters or admission control                                                                                                                                |
| Postgres SoT                         | `remaining_stock`, atomic reservation, purchase create, unique `(flash_sale_id, user_id)`, txn consistency                                                                                                       |
| Architecture approach                | **Approach 1:** query-layer cache services + `purchaseItem` rate-limit check; not dual repository tokens; not `bypassCache` flags                                                                                |
| `flashSale` cache                    | Full GraphQL-facing snapshot (incl. `remainingStock`) for **`flashSale` query only**; never consulted by `purchaseItem` / `PurchaseFlow`                                                                         |
| Cached `remainingStock`              | Presentation data only; may be stale; never used for admission or reservation                                                                                                                                    |
| `myPurchase` sale existence          | **Hard invariant:** resolver always performs authoritative uncached `FLASH_SALE_REPOSITORY.findById` **before** consulting `MyPurchaseQueryCache`; missing sale → `NOT_FOUND` (never a cached negative purchase) |
| `myPurchase` cache                   | Hit **and** short-lived negative for **purchase lookup only**; never consulted by `purchaseItem` / `PurchaseFlow`; does **not** own or cache flash-sale existence                                                |
| Negative sentinel                    | Explicit envelope (e.g. `{ found: false }` vs `{ found: true, purchase: … }`); not ambiguous raw `"null"` string                                                                                                 |
| Invalidation ownership               | **`purchaseItem` resolver** orchestrates post-success invalidation after `PURCHASE_FLOW.execute` returns; only when result is committed `SUCCESS`                                                                |
| Invalidation timing                  | `PurchaseFlow.execute` returns only after the purchase transaction has completed; invalidation runs **after** that return, never mid-transaction                                                                 |
| Invalidation failure                 | Must **not** fail the mutation; emit `redis_cache_invalidation_failed`; rely on TTL for eventual convergence                                                                                                     |
| Rate-limit scope                     | `purchaseItem` only (not all GraphQL operations)                                                                                                                                                                 |
| Rate-limit identity                  | **Client IP** until AuthN epic; **not** caller-supplied `userId`                                                                                                                                                 |
| Rate-limit algorithm                 | **Fixed window** (soft abuse protection; not a sophisticated anti-abuse system)                                                                                                                                  |
| Rate-limit atomicity                 | Must use an **atomic** Redis primitive; **forbid** race-prone `GET → INCR → SET` **and** non-atomic `INCR` then separate `EXPIRE` (a crash between them must not leave a key without TTL indefinitely)           |
| Rate-limit ordering                  | Before `PURCHASE_FLOW.execute` → no Prisma transaction → no DB write                                                                                                                                             |
| Redis failure (cache get/set)        | Fail open → bypass cache, use Postgres; emit `redis_cache_degraded`                                                                                                                                              |
| Redis failure (rate limit)           | Fail open → allow request into Postgres purchase path; emit `redis_rate_limit_degraded`                                                                                                                          |
| Redis failure (invalidation)         | Skip invalidate; mutation remains SUCCESS; emit `redis_cache_invalidation_failed`                                                                                                                                |
| Redis failure (startup / connection) | Connection failure during `onModuleInit` must **not** prevent API startup; log `redis_connection_degraded`; background reconnect allowed; operations keep failing open while Redis is unavailable                |
| Public GraphQL codes                 | EPIC-03 `{ NOT_FOUND, BAD_USER_INPUT, INTERNAL_SERVER_ERROR }` **plus** **`RATE_LIMITED`** for exceeded purchase rate limits                                                                                     |
| `RATE_LIMITED` transport             | `extensions.code = RATE_LIMITED`; HTTP status follows the existing EPIC-03 GraphQL error mapping convention (plan verifies exact status; do not invent a parallel mapping)                                       |
| Redis client port                    | Minimum ops: `get`, `set` (with TTL), `delete`, plus an atomic fixed-window incr where **expiry is bound to the first increment**; rate-limit policy stays in `PurchaseItemRateLimiter`                          |
| Client / module                      | `RedisModule` + thin `RedisClientPort` + one Redis library adapter; config from `REDIS_URL`; do not leak raw client broadly                                                                                      |
| Observability minimum                | Structured log/event for degraded cache, degraded rate limiter, invalidation failure, and Redis connection errors; metrics counters optional/opportunistic only if already trivial                               |
| Domain purity                        | Domain package remains Redis-free; no Nest Redis types in `@flash-sale/domain`                                                                                                                                   |
| Out of epic                          | Redis stock admission; AuthN/AuthZ; sale listing; global GraphQL throttling; rate limiting by caller-supplied `userId`; changing purchase outcome semantics                                                      |

## Dependency direction

```text
flashSale
  Resolver
    → FlashSaleQueryCache
         ├── Redis HIT  → GraphQL-facing snapshot
         └── Redis MISS / degraded
              → FLASH_SALE_REPOSITORY (Postgres)
              → map domain entity → snapshot
              → Redis SET (best-effort) + TTL

myPurchase
  Resolver
    → FLASH_SALE_REPOSITORY.findById (Postgres; does **not** use FlashSaleQueryCache)
         ├── null → NOT_FOUND
         └── found
              → MyPurchaseQueryCache
                   ├── Redis HIT (found / negative) → GraphQL result
                   └── Redis MISS / degraded
                        → PURCHASE_REPOSITORY (Postgres)
                        → SET found or negative sentinel + TTL

purchaseItem
  Resolver
    → PurchaseItemRateLimiter (IP; atomic fixed-window)
         ├── exceeded → GraphQL RATE_LIMITED
         │                 → no PURCHASE_FLOW invocation
         │                 → no Prisma transaction
         │                 → no DB write
         └── Redis/limiter degraded → continue
    → PURCHASE_FLOW.execute  (Postgres only; no Redis / no query caches)
         └── returns only after transaction completion
    → if result === SUCCESS
         → resolver post-success invalidation (best-effort):
              delete flash-sale:v1:{id}
              delete my-purchase:v1:{id}:{userId}
              (invalidation failure must not fail the mutation)
```

**Invariants:**

- `PurchaseFlow`, `FlashSaleReservation`, and Prisma repositories have **no** dependency on Redis or query-cache services.
- Resolvers must not inject query caches into the purchase orchestration path.
- `MyPurchaseQueryCache` does **not** own or cache flash-sale existence; the resolver must run uncached `FLASH_SALE_REPOSITORY.findById` first.
- Rate-limit rejection ⇒ no `PURCHASE_FLOW` ⇒ no Prisma transaction ⇒ no DB write.
- Post-success invalidation is owned by the **`purchaseItem` resolver**, after a committed `SUCCESS` return from `PURCHASE_FLOW.execute`.

Suggested layout (illustrative):

```text
apps/api/src/
  redis/
    redis.module.ts
    redis-client.port.ts         # RedisClientPort (get/set/delete + atomic incr-with-expiry)
    redis-client.adapter.ts      # one Redis library adapter
    redis.tokens.ts
  flash-sale/
    flash-sale-query.cache.ts    # FlashSaleQueryCache
    flash-sale.resolver.ts       # uses cache for flashSale query only
  purchase/
    my-purchase-query.cache.ts   # MyPurchaseQueryCache
    purchase-item.rate-limiter.ts
    purchase.resolver.ts         # rate-limit → PURCHASE_FLOW → post-SUCCESS invalidate
  graphql/
    map-graphql-error.ts         # add RATE_LIMITED mapping
```

---

## Section 1 — Architecture & boundaries

### In scope

- Nest `RedisModule` with lifecycle-managed client from `REDIS_URL`
- `RedisClientPort` (`get` / `set`+TTL / `delete` / atomic incr-with-expiry) + one library adapter
- `FlashSaleQueryCache` for `flashSale` query only
- `MyPurchaseQueryCache` for `myPurchase` purchase lookup only (including negative caching), after uncached sale existence
- `purchaseItem` resolver post-SUCCESS invalidation of both cache keys
- Fixed-window IP rate limiting for `purchaseItem` with atomic Redis primitive + `RATE_LIMITED` GraphQL error
- Fail-open degraded mode + structured log/events for cache, rate limit, and invalidation failures
- CI Redis service + `REDIS_URL` for integration tests
- Documentation of Redis owns / does not own (#32)

### Out of scope

- Redis-backed stock counters / admission control
- Using query caches inside `PurchaseFlow`, reservation, or Prisma adapters
- Rate limiting all GraphQL operations
- Rate limiting keyed by caller-supplied `userId` (AuthN epic may switch primary key later)
- Sliding-window / complex anti-abuse systems
- AuthN/AuthZ; sale listing/discovery
- Changing EPIC-02/EPIC-03 purchase outcome semantics
- Full metrics/APM platform; metrics counters are not acceptance criteria
- Domain package importing Redis

### Ticket ownership

| Issue                   | Owns                                                                                                             |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| #27                     | Redis connection module, `RedisClientPort` + adapter, lifecycle, config wiring, CI Redis baseline                |
| #28                     | `FlashSaleQueryCache`, TTL, versioned keys, resolver wiring for `flashSale`                                      |
| #29                     | `MyPurchaseQueryCache`, negative sentinel; preserve sale-existence-before-cache ordering                         |
| #28+#29 (with resolver) | Post-SUCCESS invalidation ownership in `purchaseItem` resolver for both keys                                     |
| #30                     | Fixed-window `PurchaseItemRateLimiter` (IP, atomic), `RATE_LIMITED` error mapping, trusted-proxy / IP resolution |
| #31                     | Fail-open semantics + structured degraded/invalidation/connection log events (pieces land with #28/#29/#30)      |
| #32                     | Docs: what Redis owns / does not own; fallback; keys; AuthN migration note for rate-limit identity               |

---

## Section 2 — Cache contracts

### Shared rules

- Cache services map **domain entities → GraphQL-facing snapshots** (or purchase lookup envelopes). Domain stays free of GraphQL/Redis serialization types.
- Versioned key prefixes for safer schema evolution:
  - `flash-sale:v1:{flashSaleId}`
  - `my-purchase:v1:{flashSaleId}:{userId}`
- TTLs are configurable via env; defaults are short (exact values in implementation plan).
- Redis read/write failures → bypass cache and use Postgres; emit `redis_cache_degraded`.
- Redis invalidation failures → do **not** affect an already-successful purchase; emit `redis_cache_invalidation_failed`; rely on TTL for eventual convergence.

### Post-success invalidation (ownership & timing)

Owned by the **`purchaseItem` resolver**:

```text
purchaseItem resolver
  → rate-limit check
  → PURCHASE_FLOW.execute(...)   // returns only after txn completion
  → if result === SUCCESS
      → invalidate flash-sale:v1:{flashSaleId}
      → invalidate my-purchase:v1:{flashSaleId}:{userId}
  → return PurchaseItemResult to client
```

- Invalidation runs **only** when `PURCHASE_FLOW.execute` returns committed `SUCCESS`.
- If invalidation fails: mutation remains successful; emit `redis_cache_invalidation_failed`; TTL recovers consistency.
- Query-cache services expose `invalidate*` helpers; the resolver owns **when** they are called.

### `FlashSaleQueryCache` (#28)

| Concern    | Contract                                                                       |
| ---------- | ------------------------------------------------------------------------------ |
| Consumers  | `flashSale` resolver only                                                      |
| Key        | `flash-sale:v1:{flashSaleId}`                                                  |
| Value      | Full GraphQL-facing flash-sale snapshot, including `remainingStock`            |
| Miss       | `FLASH_SALE_REPOSITORY.findById` → map → SET + TTL (best-effort)               |
| Staleness  | Cached `remainingStock` (and other fields) **may be stale**; presentation only |
| Invalidate | Via resolver post-SUCCESS hook for that `flashSaleId`                          |

### `MyPurchaseQueryCache` (#29)

| Concern    | Contract                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------- |
| Consumers  | `myPurchase` resolver only, **after** sale existence succeeds                             |
| Key        | `my-purchase:v1:{flashSaleId}:{userId}`                                                   |
| Value      | Explicit envelope, e.g. `{ found: true, purchase: … }` or `{ found: false }`              |
| Miss       | Postgres purchase lookup → cache found **or** short-lived negative                        |
| Isolation  | Keys are isolated by `(flashSaleId, userId)`; one user’s entry must never satisfy another |
| Invalidate | Via resolver post-SUCCESS hook for that `(flashSaleId, userId)`                           |

**Hard invariant — sale existence before purchase cache:**

> `MyPurchaseQueryCache` does **not** own or cache flash-sale existence. The `myPurchase` resolver **must** perform the existing authoritative `FLASH_SALE_REPOSITORY.findById` check **before** consulting the purchase cache. A missing sale always yields `NOT_FOUND`, never a cached negative purchase result.

Required ordering:

```text
myPurchase
  → FLASH_SALE_REPOSITORY.findById(flashSaleId)  // authoritative sale existence
      → null → NOT_FOUND
      → found
          → MyPurchaseQueryCache
              → hit/miss purchase lookup
```

### What caches must never do

- Influence reservation / admission / purchase creation
- Be injected into `PurchaseFlow` or Prisma adapters
- Own flash-sale existence checks for `myPurchase`
- Turn invalidation failure into mutation failure

---

## Section 3 — Rate limiting & GraphQL errors (#30)

### Scope

- Protect **`purchaseItem` only**.
- Rate limiting is **abuse protection**, not inventory correctness or concurrency control for stock.

### Identity (until AuthN)

- Primary key: **client IP**
- Redis key shape: `rate-limit:v1:purchaseItem:ip:{clientIp}`
- Do **not** use caller-supplied `userId` as the rate-limit identity (it is unauthenticated and rotatable)
- Future AuthN epic: switch primary key to authenticated identity; IP may become optional secondary

### IP resolution

- Must **not** blindly trust `X-Forwarded-For`
- If trusted proxy is configured: use the configured trusted-proxy policy (exact hop rules in implementation plan)
- Otherwise: use the socket remote address
- Implementation plan must define the trusted-proxy configuration explicitly

### Ordering invariant

> **Rate-limit rejection ⇒ no `PURCHASE_FLOW` invocation ⇒ no Prisma transaction ⇒ no DB write.**

The rate limiter executes before `PURCHASE_FLOW.execute` and before opening/entering the purchase transaction.

Exceeded limit → GraphQL error with `extensions.code = RATE_LIMITED` → **do not** invoke `PURCHASE_FLOW`.

### Algorithm & limits

- **Fixed window** (locked for this epic)
- Configurable via env (exact defaults in implementation plan), e.g.:
  - `RATE_LIMIT_PURCHASE_ITEM_MAX`
  - `RATE_LIMIT_PURCHASE_ITEM_WINDOW_SECONDS`
- Soft protection only; Postgres reservation remains the final safety boundary

### Atomicity requirement

> `PurchaseItemRateLimiter` **must not** implement a non-atomic `GET → INCR → SET` sequence that can race under concurrency.

> Expiry **must** be applied atomically with the first increment (or via an equivalent Lua/scripted / single-round-trip primitive). A failure between `INCR` and a separate `EXPIRE` **must not** be possible — that failure mode can leave a rate-limit key **without expiry indefinitely**.

Acceptable patterns include (examples, not prescriptions): Redis `INCR` + `EXPIRE` in one Lua script; `SET key 1 EX window NX` then `INCR` with careful first-hit semantics; or another single atomic fixed-window primitive. The implementation plan must name the chosen pattern and require a test that keys always carry a TTL after the first successful increment.

Rate-limit _policy_ (window size, max, IP keying) lives in `PurchaseItemRateLimiter`; the port exposes only the primitive.

### Error contract

- Stable application code: `extensions.code = RATE_LIMITED`
- Deterministic mapping via existing GraphQL error edge (`mapGraphqlError` / filter)
- HTTP transport status follows the **existing EPIC-03 GraphQL error mapping convention**; the implementation plan verifies the exact status rather than inventing a parallel mapping
- Covered by integration tests
- `RATE_LIMITED` is a **GraphQL error**, not a `PurchaseItemResult` / `PurchaseOutcome` value

### Fail-open

- Redis/limiter unavailable → allow request into Postgres purchase path
- Emit `redis_rate_limit_degraded`

---

## Section 4 — Fail-open & observability (#31)

| Failure mode                          | Behavior                                                 | Telemetry                                                      |
| ------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| Cache get/set unavailable             | Bypass Redis; serve from Postgres                        | `redis_cache_degraded`                                         |
| Rate limiter unavailable              | Allow `purchaseItem` to proceed                          | `redis_rate_limit_degraded`                                    |
| Post-SUCCESS invalidation unavailable | Mutation remains SUCCESS; TTL converges                  | `redis_cache_invalidation_failed`                              |
| Startup / ongoing connection failure  | API still starts; background reconnect OK; ops fail open | `redis_connection_degraded` + connection/error structured logs |
| Connection / client errors            | Log with operation + reason                              | structured connection/error logs                               |

**Minimum observability (acceptance):** structured log/event for each row above. Metrics counters are opportunistic only and are **not** acceptance criteria unless a metrics abstraction already exists and wiring is trivial.

Cross-cutting: pieces of #31 land with #28/#29/#30 rather than requiring a telemetry-only PR.

---

## Section 5 — Testing strategy

### Architectural isolation (required)

- `PurchaseFlow` / reservation path has **no** Redis or query-cache dependency (enforce via DI structure and/or dependency assertions)
- Rate-limit rejection ⇒ **does not invoke** `PURCHASE_FLOW.execute` ⇒ no Prisma transaction ⇒ no DB write
- `myPurchase` always checks sale existence via uncached `FLASH_SALE_REPOSITORY` before purchase cache (missing sale → `NOT_FOUND`, never negative purchase cache)
- `myPurchase` cache keys are isolated by `(flashSaleId, userId)` — `userIdA` entry must not satisfy `userIdB`
- Rate limiter uses an atomic Redis primitive with expiry bound to the first increment (no race-prone `GET → INCR → SET`; no separate `INCR` then `EXPIRE`)

### Unit / focused tests

- Query caches: hit; miss→set; negative `myPurchase` sentinel; Redis get/set failure → Postgres
- Rate limiter: under/over limit within fixed window; Redis failure → allow; concurrent increments do not under-count past the limit due to races; after first increment the key always has a TTL
- Invalidation failure after SUCCESS → mutation still SUCCESS + `redis_cache_invalidation_failed`

### Integration (Nest + Redis + Postgres)

- Second `flashSale` / `myPurchase` read is served from cache (**Postgres repository not invoked** on cache hit)
- Missing flash sale via `myPurchase` still returns `NOT_FOUND` (sale-existence-before-cache)
- Committed `purchaseItem` SUCCESS: resolver invalidates both keys; subsequent reads refresh from Postgres
- Distinguish commit success vs invalidation success (including invalidation-failure path)
- Rate limit exceeded → `extensions.code = RATE_LIMITED` and no `PURCHASE_FLOW` / no DB write
- Redis-down coverage for all three modes: query path, rate-limit path, invalidation path
- CI: Redis service + `REDIS_URL` alongside existing Postgres integration job

### Docs (#32)

- What Redis does and does not own
- Fail-open / fallback behavior
- Cache keys, TTL role, invalidation rules
- Rate-limit identity now (IP) vs after AuthN

---

## Section 6 — Stacked PR workflow

Suggested merge order (EPIC-05 style):

1. **Docs** — this design spec + implementation plan
2. **#27** — Redis module + thin client port + CI Redis
3. **#28 / #29** — query caches + post-SUCCESS invalidation (+ related #31 fail-open for cache/invalidation)
4. **#30** — IP rate limiter + `RATE_LIMITED` (+ related #31 fail-open for limiter)
5. **#32** — strategy doc polish/finalization (may land earlier as draft and finalize last)

#31 is a **cross-cutting** child: implement fail-open + telemetry alongside the components they affect; avoid an artificial telemetry-only PR unless something remains after #28–#30.

---

## Section 7 — Success criteria mapping

Epic #84 success criteria (verbatim where applicable) mapped to delivery:

| Epic criterion (verbatim / intent)              | Implementation mapping                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Sale and purchase status can be cached          | **Flash-sale and purchase-read data can be cached** → #28 (`flashSale` snapshot) / #29 (`myPurchase` lookup) |
| Rate limiting protects the API                  | #30 — fixed-window IP rate limit on `purchaseItem`                                                           |
| Redis failure falls back safely to PostgreSQL   | #31 — fail-open for cache and rate limit                                                                     |
| PostgreSQL remains the source of truth          | Architecture invariants + unchanged `PurchaseFlow`                                                           |
| Successful purchase invalidates relevant caches | `purchaseItem` resolver post-SUCCESS invalidation (#28/#29/#31)                                              |
| Redis remains non-authoritative                 | Architecture invariants                                                                                      |

---

## Section 8 — Risks & mitigations

| Risk                                                          | Mitigation                                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Stale `remainingStock` shown in UI                            | Document as presentation-only; short TTL + post-SUCCESS invalidation; purchase path never trusts cache |
| Negative `myPurchase` hides a just-completed purchase         | Invalidate on SUCCESS; short negative TTL; fail-open telemetry if invalidate fails                     |
| Negative purchase cache masks missing sale as “not purchased” | Hard ordering: uncached sale existence → then purchase cache; isolation tests                          |
| Accidental cache use in purchase path                         | Query-cache services only; no dual-token / bypass flags; isolation tests                               |
| Blind trust of `X-Forwarded-For`                              | Trusted-proxy config required; otherwise socket address                                                |
| Redis outage blocks purchases                                 | Fail-open rate limit + cache                                                                           |
| Invalidation failure treated as purchase failure              | Resolver post-SUCCESS semantics: mutation SUCCESS wins                                                 |
| Racey rate-limit undercount                                   | Atomic Redis incr; forbid `GET → INCR → SET`                                                           |
| Rate-limit key without TTL forever                            | Expiry bound atomically to first increment; forbid separate `INCR` then `EXPIRE`                       |
| Caller-supplied `userId` used as rate-limit key               | Forbidden until AuthN; IP-only now                                                                     |

---

## Section 9 — Non-goals reminder

Do **not** in this epic:

- Make Redis decide stock availability
- Cache-decorate `PurchaseFlow` / Prisma repositories
- Rate-limit by unauthenticated `userId`
- Globally throttle all GraphQL traffic
- Redefine EPIC-03 `PurchaseOutcome` values (SUCCESS / SOLD_OUT / etc.)
- Treat `RATE_LIMITED` as a purchase outcome enum value — it is a **GraphQL error**, not a `PurchaseItemResult` outcome

---

## Section 10 — Redis client port contract (#27)

`RedisClientPort` exposes only the operations needed by this epic:

| Operation                                                                                                               | Used by                   |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `get(key)`                                                                                                              | Query caches              |
| `set(key, value, ttlSeconds)`                                                                                           | Query caches              |
| `delete(key)`                                                                                                           | Post-SUCCESS invalidation |
| Atomic fixed-window incr where **expiry is bound to the first increment** (Lua/scripted or equivalent single primitive) | `PurchaseItemRateLimiter` |

**Forbidden:** separate `INCR` then `EXPIRE` as two non-atomic steps (crash/window can leave a key with no TTL forever).

Do **not** put rate-limit policy (window size, max, IP formatting) on the port. Do **not** expose the raw Redis library client beyond the adapter.

---

## Approval

Updated after review: sale-existence-before-cache hard invariant; resolver-owned post-SUCCESS invalidation; fixed-window + atomic rate-limit primitive (expiry bound to first increment); clarified `RATE_LIMITED` transport; port contract; observability minimum without mandatory counters; **startup Redis failure must not block API boot** (`redis_connection_degraded`).

Implementation plan: [docs/superpowers/plans/2026-07-29-epic-04-scalability-redis.md](../plans/2026-07-29-epic-04-scalability-redis.md) (revised after plan review; uncommitted until authorized).
