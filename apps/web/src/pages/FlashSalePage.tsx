import { useState } from 'react';
import { useParams } from 'react-router-dom';

import { isBuyDisabled } from '../features/flash-sale/buy-eligibility';
import { PurchaseOutcomeBanner } from '../features/flash-sale/components/PurchaseOutcomeBanner';
import { PurchasePanel } from '../features/flash-sale/components/PurchasePanel';
import { RequestErrorBanner } from '../features/flash-sale/components/RequestErrorBanner';
import { SaleStatusCard } from '../features/flash-sale/components/SaleStatusCard';
import { RequestError } from '../graphql/errors';
import { isNonWhitespaceId } from '../graphql/id';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useFlashSale } from '../hooks/useFlashSale';
import { useMyPurchase } from '../hooks/useMyPurchase';
import { usePurchaseItem } from '../hooks/usePurchaseItem';

export function FlashSalePage() {
  const { flashSaleId = '' } = useParams();
  const [userId, setUserId] = useState('');
  const debouncedUserId = useDebouncedValue(userId, 300);

  const saleQuery = useFlashSale(flashSaleId);
  const myPurchaseQuery = useMyPurchase(flashSaleId, debouncedUserId);
  const purchaseMutation = usePurchaseItem();

  const myPurchaseInitialPending = myPurchaseQuery.isPending && !myPurchaseQuery.isError;
  const userIdValid = isNonWhitespaceId(userId);
  const buyDisabled = isBuyDisabled({
    flashSaleError: saleQuery.isError,
    flashSaleLoading: saleQuery.isPending,
    flashSaleStatus: saleQuery.data?.status,
    mutationPending: purchaseMutation.isPending,
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
    purchaseMutation.error instanceof RequestError
      ? purchaseMutation.error
      : purchaseMutation.error
        ? new RequestError(purchaseMutation.error.message, 'UNKNOWN')
        : undefined;

  function onBuy() {
    purchaseMutation.mutate({ flashSaleId, userId });
  }

  function onRetryPurchase() {
    purchaseMutation.reset();
    purchaseMutation.mutate({ flashSaleId, userId });
  }

  return (
    <main className="shell" data-testid="flash-sale-page">
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

      {myPurchaseQuery.isPending && isNonWhitespaceId(debouncedUserId) ? (
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
        buyPending={purchaseMutation.isPending}
        onBuy={onBuy}
        onUserIdChange={setUserId}
        purchased={myPurchaseQuery.data?.purchased}
        userId={userId}
      />

      {purchaseMutation.isPending ? (
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

      {!purchaseMutation.isPending && purchaseMutation.data ? (
        <PurchaseOutcomeBanner result={purchaseMutation.data} />
      ) : null}
    </main>
  );
}
