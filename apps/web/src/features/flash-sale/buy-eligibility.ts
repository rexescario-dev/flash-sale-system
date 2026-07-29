import type { FlashSaleStatus } from '../../graphql/types';

export type BuyEligibilityInput = {
  flashSaleError: boolean;
  flashSaleLoading: boolean;
  flashSaleStatus: FlashSaleStatus | undefined;
  mutationPending: boolean;
  myPurchaseInitialPending: boolean;
  purchased: boolean | undefined;
  userIdValid: boolean;
};

export function isBuyDisabled(input: BuyEligibilityInput): boolean {
  if (!input.userIdValid) {
    return true;
  }
  if (input.flashSaleLoading || input.flashSaleError) {
    return true;
  }
  if (input.flashSaleStatus !== 'ACTIVE') {
    return true;
  }
  if (input.myPurchaseInitialPending) {
    return true;
  }
  if (input.purchased === true) {
    return true;
  }
  if (input.mutationPending) {
    return true;
  }
  return false;
}
