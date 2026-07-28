import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('MyPurchaseResult')
export class MyPurchaseResultObjectType {
  @Field(() => Boolean)
  purchased!: boolean;

  @Field(() => GraphQLISODateTime, { nullable: true })
  purchasedAt!: Date | null;

  @Field(() => ID, { nullable: true })
  purchaseId!: null | string;
}
