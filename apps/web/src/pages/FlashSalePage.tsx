import { useParams } from 'react-router-dom';

import { isBuyDisabled } from '../features/flash-sale/buy-eligibility';
import { PurchaseOutcomeBanner } from '../features/flash-sale/components/PurchaseOutcomeBanner';
import { PurchasePanel } from '../features/flash-sale/components/PurchasePanel';
import { RequestErrorBanner } from '../features/flash-sale/components/RequestErrorBanner';
import { SaleStatusCard } from '../features/flash-sale/components/SaleStatusCard';
import { IdentityStrip } from '../features/identity/components/IdentityStrip';
import { useUserIdentity } from '../features/identity/IdentityProvider';
import { RequestError } from '../graphql/errors';
import { isNonWhitespaceId } from '../graphql/id';
import { useFlashSale } from '../hooks/useFlashSale';
import { useMyPurchase } from '../hooks/useMyPurchase';
import { usePurchaseItem } from '../hooks/usePurchaseItem';

export function FlashSalePage() {
  const { flashSaleId = '' } = useParams();
  const { userId } = useUserIdentity();

  const saleQuery = useFlashSale(flashSaleId);
  const myPurchaseQuery = useMyPurchase(flashSaleId, userId ?? '');
  const purchaseMutation = usePurchaseItem();

  const mutationForCurrentUser = purchaseMutation.variables?.userId === userId;
  const myPurchaseInitialPending = myPurchaseQuery.isPending && !myPurchaseQuery.isError;
  const userIdValid = isNonWhitespaceId(userId ?? '');
  const buyDisabled = isBuyDisabled({
    flashSaleError: saleQuery.isError,
    flashSaleLoading: saleQuery.isPending,
    flashSaleStatus: saleQuery.data?.status,
    mutationPending: purchaseMutation.isPending && mutationForCurrentUser,
    myPurchaseInitialPending,
    purchased: myPurchaseQuery.data?.purchased,
    userIdValid,
  });

  const saleError =
    saleQuery.error instanceof RequestError
      ? saleQuery.error
      : saleQuery.error
        ? new RequestError(saleQuery.error.message, 'UNKNOWN')
        : undefined;

  const myPurchaseError =
    myPurchaseQuery.error instanceof RequestError
      ? myPurchaseQuery.error
      : myPurchaseQuery.error
        ? new RequestError(myPurchaseQuery.error.message, 'UNKNOWN')
        : undefined;

  const purchaseError =
    mutationForCurrentUser && purchaseMutation.error instanceof RequestError
      ? purchaseMutation.error
      : mutationForCurrentUser && purchaseMutation.error
        ? new RequestError(purchaseMutation.error.message, 'UNKNOWN')
        : undefined;

  function onBuy() {
    if (userId === null || !isNonWhitespaceId(userId)) {
      return;
    }
    purchaseMutation.mutate({ flashSaleId, userId });
  }

  function onRetryPurchase() {
    if (userId === null || !isNonWhitespaceId(userId)) {
      return;
    }
    purchaseMutation.reset();
    purchaseMutation.mutate({ flashSaleId, userId });
  }

  return (
    <main className="shell" data-testid="flash-sale-page">
      <IdentityStrip />
      <p className="eyebrow">Flash Sale</p>
      <h1>Sale {flashSaleId}</h1>

      {saleQuery.isPending ? <p data-testid="sale-loading">Loading sale…</p> : null}

      {saleError ? (
        <RequestErrorBanner
          message={saleError.message}
          onRetry={() => {
            void saleQuery.refetch();
          }}
          title="Could not load sale"
        />
      ) : null}

      {saleQuery.data ? <SaleStatusCard sale={saleQuery.data} /> : null}

      {myPurchaseQuery.isPending && userIdValid ? (
        <p data-testid="my-purchase-loading">Checking purchase status…</p>
      ) : null}

      {myPurchaseError ? (
        <RequestErrorBanner
          message={myPurchaseError.message}
          onRetry={() => {
            void myPurchaseQuery.refetch();
          }}
          title="Could not check purchase status"
        />
      ) : null}

      <PurchasePanel
        buyDisabled={buyDisabled}
        buyPending={purchaseMutation.isPending && mutationForCurrentUser}
        onBuy={onBuy}
        purchased={myPurchaseQuery.data?.purchased}
        showGuestHint={userId === null}
      />

      {purchaseMutation.isPending && mutationForCurrentUser ? (
        <p data-testid="purchase-pending">Submitting purchase…</p>
      ) : null}

      {purchaseError ? (
        <RequestErrorBanner
          message={
            purchaseError.kind === 'NETWORK'
              ? "We couldn't reach the server. Please check your connection and try again."
              : "We couldn't complete your purchase. Please try again."
          }
          onRetry={onRetryPurchase}
          title="Purchase request failed"
        />
      ) : null}

      {!purchaseMutation.isPending && purchaseMutation.data && mutationForCurrentUser ? (
        <PurchaseOutcomeBanner result={purchaseMutation.data} />
      ) : null}
    </main>
  );
}
