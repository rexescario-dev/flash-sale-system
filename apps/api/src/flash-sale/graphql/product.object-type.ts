import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Product')
export class ProductObjectType {
  @Field(() => String, { nullable: true })
  description!: null | string;

  @Field(() => ID)
  id!: string;

  @Field(() => String)
  name!: string;
}
