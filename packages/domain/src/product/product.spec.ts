import type { ProductId } from '../ids.js';

import { ProductValidationError, type ProductValidationErrorCode } from './product.errors.js';
import { Product } from './product.js';

const asProductId = (value: string): ProductId => value as ProductId;

const id = asProductId('product-1');
const name = 'Chicken';

function expectValidationError(action: () => unknown, code: ProductValidationErrorCode): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ProductValidationError);
    expect(error).toMatchObject({ code });
    return;
  }

  throw new Error(`Expected ProductValidationError with code ${code}`);
}

describe('Product.create', () => {
  it('creates a product without description', () => {
    const product = Product.create({ id, name });

    expect(product.getId()).toBe(id);
    expect(product.getName()).toBe(name);
    expect(product.getDescription()).toBeUndefined();
  });

  it('treats description: undefined the same as omitted description', () => {
    const withoutDescription = Product.create({ id, name });
    const withUndefinedDescription = Product.create({
      id,
      description: undefined,
      name,
    });

    expect(withoutDescription.getDescription()).toBeUndefined();
    expect(withUndefinedDescription.getDescription()).toBeUndefined();
    expect(withoutDescription.getId()).toBe(withUndefinedDescription.getId());
    expect(withoutDescription.getName()).toBe(withUndefinedDescription.getName());
  });

  it('stores a trimmed non-blank description', () => {
    const product = Product.create({
      id,
      description: '  Fresh free-range  ',
      name,
    });

    expect(product.getDescription()).toBe('Fresh free-range');
  });

  it('returns trimmed id from padded ProductId input', () => {
    const padded = asProductId('  product-123  ');
    const product = Product.create({ id: padded, name });

    expect(product.getId()).toBe('product-123');
  });

  it('returns trimmed name from padded name input', () => {
    const product = Product.create({ id, name: '  Chicken  ' });

    expect(product.getName()).toBe('Chicken');
  });

  it('rejects empty id', () => {
    expectValidationError(() => Product.create({ id: asProductId(''), name }), 'EMPTY_ID');
  });

  it('rejects whitespace-only id', () => {
    expectValidationError(() => Product.create({ id: asProductId('   '), name }), 'EMPTY_ID');
  });

  it('rejects empty name', () => {
    expectValidationError(() => Product.create({ id, name: '' }), 'EMPTY_NAME');
  });

  it('rejects whitespace-only name', () => {
    expectValidationError(() => Product.create({ id, name: '   ' }), 'EMPTY_NAME');
  });

  it('rejects empty description when provided', () => {
    expectValidationError(() => Product.create({ id, description: '', name }), 'EMPTY_DESCRIPTION');
  });

  it('rejects whitespace-only description when provided', () => {
    expectValidationError(
      () => Product.create({ id, description: '   ', name }),
      'EMPTY_DESCRIPTION',
    );
  });
});
