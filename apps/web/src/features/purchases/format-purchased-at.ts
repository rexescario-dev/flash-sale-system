/** Absolute local datetime; locale formatting is implementation-defined. */
export function formatPurchasedAt(iso: string): string {
  return new Date(iso).toLocaleString();
}
