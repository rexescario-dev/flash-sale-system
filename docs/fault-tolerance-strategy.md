# Fault Tolerance Strategy

Describes the current fault-tolerance and degradation behavior of the system within the topology documented by [Scalability strategy](scalability-strategy.md). This document reflects implemented behavior only; it is not a high-availability, operational runbook, or future platform design.

## Failure modes

### Redis

Redis is a non-authoritative performance optimization. When Redis is unavailable or Redis operations fail, the application follows the canonical fail-open caching strategy so requests continue against PostgreSQL where possible. See [Redis caching & rate-limit strategy](redis-caching-strategy.md) for the complete behavior matrix and operational details.

### API process failure

- **Current repository deployment (Compose):** A single API process. If the process exits or becomes unavailable, requests fail until the process is restarted.
- **Horizontal deployment** (see [Scalability strategy](scalability-strategy.md)): When multiple stateless API instances run behind a load balancer, failure of a single instance reduces capacity but does not make the service unavailable as long as healthy instances remain.

### PostgreSQL failure

PostgreSQL is the authoritative system of record and a shared dependency.

If PostgreSQL is unavailable or returns unexpected errors, affected requests fail. Unexpected database failures surface as GraphQL `INTERNAL_SERVER_ERROR`.

No application-level retry, circuit breaker, or database timeout policy is implemented.

In the topology documented by [Scalability strategy](scalability-strategy.md), the shared PostgreSQL instance is an availability single point of failure.

Transactional correctness and the purchase request lifecycle are documented in [Concurrency model](concurrency-model.md) and [Purchase sequence](purchase-sequence.md).

### Timeout behavior

- **API:** No application request timeout; requests continue until completed or terminated by the client or surrounding infrastructure.
- **Redis:** Redis client operations fail quickly under the current client configuration (including `maxRetriesPerRequest: 1` and `enableOfflineQueue: false`), after which the application follows the fail-open caching strategy. See [Redis caching & rate-limit strategy](redis-caching-strategy.md).
- **PostgreSQL:** No application-enforced query timeout; blocked or long-running operations remain pending until the database, infrastructure, or client terminates them. Unexpected database failures surface as GraphQL `INTERNAL_SERVER_ERROR`.

## Health endpoint

`GET /health` returns `{ "status": "ok" }` and reports process liveness only; it is not a readiness or dependency-health endpoint. It does not probe PostgreSQL or Redis.

## Non-goals

This document does not cover:

- High-availability design (replicas, failover, multi-AZ, or managed HA services)
- Operational runbooks (Issues #69 / #70)
- Architectural rationale, alternatives, or trade-off essays ([Technology trade-offs](technology-trade-offs.md))
- Re-documenting Redis strategy, concurrency model, purchase sequence, scalability strategy, or testing documentation
- README expansion or documentation hub work (#73)
- Application timeout, retry, or circuit-breaker policies that are not implemented today
- A specific production platform (Kubernetes, ECS, Docker Swarm, etc.)

## Related documentation

- [System architecture](architecture.md)
- [Scalability strategy](scalability-strategy.md)
- [Technology trade-offs](technology-trade-offs.md)
- [Redis caching & rate-limit strategy](redis-caching-strategy.md)
- [Concurrency model](concurrency-model.md)
- [Purchase sequence](purchase-sequence.md)
- [Local development](local-development.md)
