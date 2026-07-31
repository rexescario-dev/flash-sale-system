export function unusedStockWarnings(stock: number, purchaseCount: number): string[] {
  if (purchaseCount >= stock) return [];
  const unused = stock - purchaseCount;
  return [
    `WARNING: Inventory not fully exhausted. stock=${stock} purchaseCount=${purchaseCount} unusedStock=${unused}`,
  ];
}
