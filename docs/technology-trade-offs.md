# Technology Trade-offs

This document captures the major architectural decisions behind the current implementation and the trade-offs that motivated them. It explains _why_ these choices were made, not how the system behaves operationally.

**Scope:** This document explains the architectural decisions behind the current implementation. Operational behavior, scalability, fault tolerance, concurrency, and testing are documented separately and linked where relevant.

For how the system scales and how it behaves under failure, see [Scalability strategy](scalability-strategy.md) and [Fault tolerance strategy](fault-tolerance-strategy.md).

## Decision summary

| Decision       | Chosen                        | Alternative considered     |
| -------------- | ----------------------------- | -------------------------- |
| Architecture   | Modular monolith              | Microservices              |
| Persistence    | PostgreSQL as source of truth | Redis as primary store     |
| API            | GraphQL                       | REST                       |
| Authentication | Simplified demo identity      | Production-grade IdP/OAuth |

## Core trade-offs

### Modular monolith vs microservices

The system is a **modular monolith**: a single NestJS API deployable that hosts GraphQL, application modules, and infrastructure adapters, with framework-independent domain logic in `packages/domain`.

**Why chosen:** Flash-sale correctness depends on a transactional purchase path against PostgreSQL. A single deployable keeps that path in-process, avoids distributed sagas, and matches the local Compose demo topology.

**Benefits:** Faster iteration, simpler deployment and local development, and a clear consistency story for inventory reservation and unique purchases.

**Trade-offs:** The API scales as identical horizontal instances sharing PostgreSQL and Redis, not as independently deployed domain services. Deployment and failure domains are coarser than a microservice split.

Horizontal scale-out of the monolith is documented in [Scalability strategy](scalability-strategy.md). Decomposition into services remains a possible later implication if operational complexity justifies it — not a committed roadmap item (see [Future evolution](#future-evolution)).

### PostgreSQL as source of truth vs Redis as primary store

**PostgreSQL** is the authoritative source of truth (system of record) for inventory and purchases. **Redis** is a non-authoritative performance and abuse-protection layer.

**Why chosen:** Purchase admission, stock reservation, and unique-purchase constraints require transactional guarantees. Keeping those decisions in PostgreSQL avoids dual-write correctness hazards.

**Benefits:** Clear ownership of business state; Redis can fail or be slow without inventing a second inventory truth.

**Trade-offs:** PostgreSQL availability bounds write success; Redis cannot be used as a primary store or admission authority. Cached presentation data (including stock displays) may be briefly stale.

Mechanics live in [Concurrency model](concurrency-model.md) and [Purchase sequence](purchase-sequence.md). Redis responsibilities and fail-open behavior live in [Redis caching & rate-limit strategy](redis-caching-strategy.md). Failure implications are summarized in [Fault tolerance strategy](fault-tolerance-strategy.md).

### GraphQL vs REST

**GraphQL** is the API boundary between the React client and the NestJS API.

**Why chosen:** The customer UI needs a typed contract over a small set of catalog and purchase operations. A single API surface aligned with the modular monolith keeps client and server contracts co-evolving without a large REST resource map.

**Benefits:** Strong typing for the web client, flexible field selection for catalog views, and one integration style for the demo product.

**Trade-offs:** GraphQL adds tooling and caching complexity versus simple REST resources, and some external integrators expect REST by default.

**Why acceptable here:** The public operation surface is small (`flashSales`, `flashSale`, `purchaseItem`, `myPurchase`, `myPurchases`), and the React web client is the primary consumer.

### Simplified authentication

Demo identity is intentionally simplified.

**Current approach:**

- The browser persists a local user ID (demo client identity).
- The API accepts that caller-supplied identity for demonstration purposes.
- There are no sessions, JWTs, or external identity providers.

**Trade-off:** This keeps the implementation focused on flash-sale concurrency and consistency challenges. It is **not** suitable for production authentication.

**Related operational implication:** Until real authentication exists, rate limiting for `purchaseItem` is enforced by client IP rather than authenticated user identity. See [Redis caching & rate-limit strategy](redis-caching-strategy.md) for details.

A production deployment would replace this simplified identity model with a proper authentication and authorization system.

## Technology choices

**NestJS** — Selected as the structured, modular host for the GraphQL API and infrastructure adapters (Prisma, Redis) while keeping domain logic separable in `packages/domain`.

**Prisma** — Selected for typed PostgreSQL access aligned with PostgreSQL's role as the system of record.

**React + Vite** — Selected as the sole frontend stack for a fast local developer experience and a focused customer demo UI.

**PostgreSQL** — Selected as the transactional source of truth for inventory and purchases.

**Redis** — Selected as a non-authoritative cache and coordination layer where applicable, not as a business decision store.

## Future evolution

The following are implications of the current decisions, not a committed product or infrastructure roadmap.

- The modular monolith could be decomposed into services if operational complexity justifies it (aligned with horizontal scale of the API in [Scalability strategy](scalability-strategy.md)).
- PostgreSQL remains the source of truth; Redis deployment characteristics may evolve as availability needs change (see [Fault tolerance strategy](fault-tolerance-strategy.md) for current failure behavior).
- Simplified demo identity would be replaced by a proper authentication and authorization system when moving beyond the current demo scope.
- The API layer can evolve if future integration requirements change, without committing to a specific integration style.

## Non-goals

This document does not cover:

- High-availability design (replicas, failover, multi-AZ, or managed HA services)
- Operational runbooks (Issues #69 / #70)
- Re-documenting Redis strategy, concurrency model, purchase sequence, scalability strategy, fault tolerance strategy, or testing documentation
- README expansion or documentation hub work (#73)
- An ADR pack under `docs/adr/`
- Authentication/authorization system design (OAuth, OIDC, sessions, JWT issuance)
- Application, schema, Compose, CI, or test-suite changes

## Related documentation

- [System architecture](architecture.md)
- [Scalability strategy](scalability-strategy.md)
- [Fault tolerance strategy](fault-tolerance-strategy.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)
- [Concurrency model](concurrency-model.md)
- [Purchase sequence](purchase-sequence.md)
- [Local development](local-development.md)
- [Testing strategy](testing-strategy.md)
