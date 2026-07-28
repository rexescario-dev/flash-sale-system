import { registerEnumType } from '@nestjs/graphql';

export enum PurchaseOutcomeGql {
  ALREADY_PURCHASED = 'ALREADY_PURCHASED',
  SALE_ENDED = 'SALE_ENDED',
  SALE_NOT_STARTED = 'SALE_NOT_STARTED',
  SOLD_OUT = 'SOLD_OUT',
  SUCCESS = 'SUCCESS',
}

registerEnumType(PurchaseOutcomeGql, { name: 'PurchaseOutcome' });
