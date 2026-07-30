import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

import { ProductObjectType } from '../../flash-sale/graphql/product.object-type';
import { FlashSaleRefObjectType } from './flash-sale-ref.object-type';

@ObjectType('PurchaseHistoryItem')
export class PurchaseHistoryItemObjectType {
  @Field(() => FlashSaleRefObjectType)
  flashSale!: FlashSaleRefObjectType;

  @Field(() => ID)
  id!: string;

  @Field(() => ProductObjectType)
  product!: ProductObjectType;

  @Field(() => GraphQLISODateTime)
  purchasedAt!: Date;
}
