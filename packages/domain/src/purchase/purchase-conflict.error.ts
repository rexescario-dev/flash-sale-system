export class PurchaseConflictError extends Error {
  readonly code = 'PURCHASE_CONFLICT' as const;

  constructor(message = 'Purchase conflicts with an existing purchase') {
    super(message);
    this.name = 'PurchaseConflictError';
  }
}
