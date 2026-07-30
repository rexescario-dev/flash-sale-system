import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('FlashSaleRef')
export class FlashSaleRefObjectType {
  @Field(() => ID)
  id!: string;
}
