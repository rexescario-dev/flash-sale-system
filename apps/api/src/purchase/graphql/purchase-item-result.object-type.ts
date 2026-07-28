import { Field, ID, ObjectType } from '@nestjs/graphql';

import { PurchaseOutcomeGql } from './purchase-outcome.enum';

@ObjectType('PurchaseItemResult')
export class PurchaseItemResultObjectType {
  @Field(() => String)
  message!: string;

  @Field(() => ID, { nullable: true })
  purchaseId!: null | string;

  @Field(() => PurchaseOutcomeGql)
  status!: PurchaseOutcomeGql;
}
