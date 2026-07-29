import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';

import { FlashSaleStatusGql } from './flash-sale-status.enum';
import { ProductObjectType } from './product.object-type';

@ObjectType('FlashSale')
export class FlashSaleObjectType {
  @Field(() => GraphQLISODateTime)
  endsAt!: Date;

  @Field(() => ID)
  id!: string;

  @Field(() => ProductObjectType)
  product!: ProductObjectType;

  @Field(() => Int)
  remainingStock!: number;

  @Field(() => GraphQLISODateTime)
  startsAt!: Date;

  @Field(() => FlashSaleStatusGql)
  status!: FlashSaleStatusGql;

  @Field(() => Int)
  totalStock!: number;
}
