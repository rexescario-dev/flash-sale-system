import type { ProductId } from '../ids.js';

import { ProductValidationError } from './product.errors.js';

export type ProductCreateProps = {
  id: ProductId;
  description?: string;
  name: string;
};

export class Product {
  private constructor(
    private readonly id: ProductId,
    private readonly name: string,
    private readonly description: string | undefined,
  ) {}

  static create(props: ProductCreateProps): Product {
    const id = props.id.trim();
    if (id.length === 0) {
      throw new ProductValidationError('EMPTY_ID', 'Product id must be non-empty');
    }

    const name = props.name.trim();
    if (name.length === 0) {
      throw new ProductValidationError('EMPTY_NAME', 'Product name must be non-empty');
    }

    let description: string | undefined;
    if (props.description !== undefined) {
      const trimmedDescription = props.description.trim();
      if (trimmedDescription.length === 0) {
        throw new ProductValidationError(
          'EMPTY_DESCRIPTION',
          'Product description must be non-empty when provided',
        );
      }
      description = trimmedDescription;
    }

    return new Product(id as ProductId, name, description);
  }

  getDescription(): string | undefined {
    return this.description;
  }

  getId(): ProductId {
    return this.id;
  }

  getName(): string {
    return this.name;
  }
}
