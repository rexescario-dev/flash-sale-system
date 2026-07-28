import { registerEnumType } from '@nestjs/graphql';

export enum FlashSaleStatusGql {
  ACTIVE = 'ACTIVE',
  ENDED = 'ENDED',
  SOLD_OUT = 'SOLD_OUT',
  UPCOMING = 'UPCOMING',
}

registerEnumType(FlashSaleStatusGql, { name: 'FlashSaleStatus' });
