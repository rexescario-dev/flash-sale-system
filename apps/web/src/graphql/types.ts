export type FlashSaleStatus = 'ACTIVE' | 'ENDED' | 'SOLD_OUT' | 'UPCOMING';

export type PurchaseOutcome =
  'ALREADY_PURCHASED' | 'SALE_ENDED' | 'SALE_NOT_STARTED' | 'SOLD_OUT' | 'SUCCESS';

export type FlashSale = {
  id: string;
  endsAt: string;
  remainingStock: number;
  startsAt: string;
  status: FlashSaleStatus;
  totalStock: number;
};

export type MyPurchaseResult = {
  purchaseId: null | string;
  purchased: boolean;
  purchasedAt: null | string;
};

export type PurchaseItemResult = {
  purchaseId: null | string;
  message: string;
  status: PurchaseOutcome;
};
