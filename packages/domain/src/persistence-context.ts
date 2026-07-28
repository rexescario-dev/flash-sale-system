/**
 * Runtime brand key for PersistenceContext.
 * Exported so infrastructure can construct carriers; domain never inspects payload beyond the brand.
 * This is opaque-by-convention (public brand), not a sealed capability token.
 */
export const PERSISTENCE_CONTEXT_BRAND = Symbol('PersistenceContext');

/** Structurally opaque unit-of-work handle. Domain must not inspect contents. */
export interface PersistenceContext {
  readonly [PERSISTENCE_CONTEXT_BRAND]: true;
}
