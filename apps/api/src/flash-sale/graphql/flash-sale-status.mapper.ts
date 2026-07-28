import type { FlashSaleStatus } from '@flash-sale/domain';

import { FlashSaleStatusGql } from './flash-sale-status.enum';

const STATUS_MAP: Record<FlashSaleStatus, FlashSaleStatusGql> = {
  ACTIVE: FlashSaleStatusGql.ACTIVE,
  ENDED: FlashSaleStatusGql.ENDED,
  SOLD_OUT: FlashSaleStatusGql.SOLD_OUT,
  UPCOMING: FlashSaleStatusGql.UPCOMING,
};

export function toFlashSaleStatusGql(status: FlashSaleStatus): FlashSaleStatusGql {
  return STATUS_MAP[status];
}
