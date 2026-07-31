export function unusedStockWarnings(
  stock: number,
  purchaseCount: number,
  expectsStockExhaustion: boolean,
): string[] {
  if (!expectsStockExhaustion) return [];
  if (purchaseCount >= stock) return [];
  const unused = stock - purchaseCount;
  return [
    `WARNING: Inventory not fully exhausted. stock=${stock} purchaseCount=${purchaseCount} unusedStock=${unused}`,
  ];
}
