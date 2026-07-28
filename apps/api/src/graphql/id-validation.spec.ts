import { GraphqlBadUserInputError } from './graphql-bad-user-input.error';
import * as idValidation from './id-validation';
import { requireFlashSaleId, requireId, requireUserId } from './id-validation';

describe('id-validation (external GraphQL input only)', () => {
  describe.each([
    ['requireId', requireId],
    ['requireFlashSaleId', requireFlashSaleId],
    ['requireUserId', requireUserId],
  ] as const)('%s', (_name, validate) => {
    it.each(['', ' ', '\t', '\n', '   '])('rejects %j', (raw) => {
      expect(() => validate(raw)).toThrow(GraphqlBadUserInputError);
    });
  });

  it('preserves internal and surrounding spaces', () => {
    expect(requireId(' a b ')).toBe(' a b ');
    expect(requireFlashSaleId(' a b ')).toBe(' a b ');
    expect(requireUserId(' a b ')).toBe(' a b ');
  });

  it('exposes only external input validators', () => {
    expect(Object.keys(idValidation).sort()).toEqual([
      'requireFlashSaleId',
      'requireId',
      'requireUserId',
    ]);
    expect(idValidation).not.toHaveProperty('createPurchaseId');
  });
});
