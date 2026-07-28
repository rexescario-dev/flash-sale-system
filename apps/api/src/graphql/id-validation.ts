import type { FlashSaleId, UserId } from '@flash-sale/domain';

import { GraphqlBadUserInputError } from './graphql-bad-user-input.error';

function requireNonEmptyId(raw: string, label: string): string {
  if (raw.length === 0 || /^\s*$/.test(raw)) {
    throw new GraphqlBadUserInputError(`${label} must be a non-empty id`);
  }
  return raw;
}

export function requireId(raw: string): FlashSaleId {
  return requireNonEmptyId(raw, 'id') as FlashSaleId;
}

export function requireFlashSaleId(raw: string): FlashSaleId {
  return requireNonEmptyId(raw, 'flashSaleId') as FlashSaleId;
}

export function requireUserId(raw: string): UserId {
  return requireNonEmptyId(raw, 'userId') as UserId;
}
