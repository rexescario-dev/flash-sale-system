import { Link, useParams } from 'react-router-dom';

import { SaleStatusBadge } from '../features/catalog/components/SaleStatusBadge';
import { isBuyDisabled } from '../features/flash-sale/buy-eligibility';
import { getBuyHelper } from '../features/flash-sale/buy-helper';
import { PurchaseRail } from '../features/flash-sale/components/PurchaseRail';
import { RequestErrorBanner } from '../features/flash-sale/components/RequestErrorBanner';
import { SaleCountdown } from '../features/flash-sale/components/SaleCountdown';
import { StickyBuyBar } from '../features/flash-sale/components/StickyBuyBar';
import { StockBar } from '../features/flash-sale/components/StockBar';
import { formatSaleWindow } from '../features/flash-sale/format-sale-window';
import { useUserIdentity } from '../features/identity/IdentityProvider';
import { RequestError } from '../graphql/errors';
import { isNonWhitespaceId } from '../graphql/id';
import { useFlashSale } from '../hooks/useFlashSale';
import { useMyPurchase } from '../hooks/useMyPurchase';
import { usePurchaseItem } from '../hooks/usePurchaseItem';
import { useSaleCountdown } from '../hooks/useSaleCountdown';

export function FlashSalePage() {
  const { flashSaleId = '' } = useParams();
  const { userId } = useUserIdentity();

  const saleQuery = useFlashSale(flashSaleId);
  // Ignore stale cache entries that predate nested product on the detail query.
  const sale = saleQuery.data?.product ? saleQuery.data : undefined;
  const myPurchaseQuery = useMyPurchase(flashSaleId, userId ?? '');
  const purchaseMutation = usePurchaseItem();

  const mutationForCurrentUser = purchaseMutation.variables?.userId === userId;
  const myPurchaseInitialPending = myPurchaseQuery.isPending && !myPurchaseQuery.isError;
  const userIdValid = isNonWhitespaceId(userId ?? '');
  const buyPending = purchaseMutation.isPending && mutationForCurrentUser;

  const buyDisabled = isBuyDisabled({
    flashSaleError: saleQuery.isError,
    flashSaleLoading: saleQuery.isPending,
    flashSaleStatus: sale?.status,
    mutationPending: buyPending,
    myPurchaseInitialPending,
    purchased: myPurchaseQuery.data?.purchased,
    userIdValid,
  });

  const countdown = useSaleCountdown(sale?.startsAt ?? '', sale?.endsAt ?? '');

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

  const purchaseRequestError =
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

  const purchaseError = purchaseRequestError
    ? {
        message:
          purchaseRequestError.kind === 'NETWORK'
            ? "We couldn't reach the server. Please check your connection and try again."
            : "We couldn't complete your purchase. Please try again.",
        onRetry: onRetryPurchase,
      }
    : null;

  const purchaseOutcome =
    !buyPending && purchaseMutation.data && mutationForCurrentUser ? purchaseMutation.data : null;

  const helper = getBuyHelper({
    userId,
    alreadyPurchased: myPurchaseQuery.data?.purchased ?? false,
    buyPending,
    countdown,
    flashSaleLoading: saleQuery.isPending,
    flashSaleStatus: sale?.status,
    myPurchaseInitialPending,
  });

  const windowFmt = sale ? formatSaleWindow(sale.startsAt, sale.endsAt) : null;
  const description = sale?.product.description?.trim() ? sale.product.description.trim() : null;

  const countdownSummary =
    countdown.mode === 'none' ? null : { label: countdown.label, text: countdown.text };

  const purchaseSurfaceProps = {
    alreadyPurchased: myPurchaseQuery.data?.purchased,
    buyDisabled,
    buyPending,
    countdownSummary,
    helper,
    onBuy,
    purchaseError,
    purchaseOutcome,
    remainingSummary: sale ? { remaining: sale.remainingStock, total: sale.totalStock } : undefined,
  };

  return (
    <main
      className="mx-auto max-w-7xl px-4 py-10 pb-40 sm:px-6 lg:pb-10"
      data-testid="flash-sale-page"
    >
      <Link
        className="text-sm font-semibold text-emerald-800 hover:underline"
        data-testid="back-to-products"
        to="/"
      >
        ← Back to products
      </Link>

      {saleQuery.isPending ? (
        <div className="mt-6 animate-pulse" data-testid="sale-loading">
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-8 w-64 rounded bg-emerald-900/10" />
            <div className="h-5 w-16 rounded bg-emerald-900/10" />
          </div>
          <div className="mt-6 h-2 w-full rounded bg-emerald-900/10" />
          <div className="mt-2 h-4 w-32 rounded bg-emerald-900/10" />
          <div className="mt-6 h-12 w-40 rounded bg-emerald-900/10" />
          <div className="mt-6 h-4 w-full max-w-md rounded bg-emerald-900/10" />
          <div className="mt-4 h-4 w-48 rounded bg-emerald-900/10" />
          <div className="mt-8 hidden h-64 rounded-xl bg-emerald-900/10 lg:block lg:w-[360px]" />
        </div>
      ) : null}

      {saleError ? (
        <div className="mt-6">
          <RequestErrorBanner
            message={saleError.message}
            onRetry={() => {
              void saleQuery.refetch();
            }}
            title="Could not load sale"
          />
        </div>
      ) : null}

      {myPurchaseError ? (
        <div className="mt-6">
          <RequestErrorBanner
            message={myPurchaseError.message}
            onRetry={() => {
              void myPurchaseQuery.refetch();
            }}
            title="Could not check purchase status"
          />
        </div>
      ) : null}

      {!saleQuery.isPending ? (
        <div className="mt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
          <div>
            {sale ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-emerald-950 sm:text-3xl">
                    {sale.product.name}
                  </h1>
                  <SaleStatusBadge status={sale.status} />
                  <span className="sr-only" data-testid="sale-status">
                    {sale.status}
                  </span>
                </div>

                <div className="mt-6">
                  <StockBar remaining={sale.remainingStock} total={sale.totalStock} />
                </div>

                <div className="mt-6">
                  <SaleCountdown countdown={countdown} />
                </div>

                {description ? (
                  <p className="mt-6 text-sm text-emerald-900/80" data-testid="sale-description">
                    {description}
                  </p>
                ) : null}

                {windowFmt ? (
                  <p className="mt-4 text-sm text-emerald-900/70" data-testid="sale-window">
                    {windowFmt.heading
                      ? `${windowFmt.heading} · ${windowFmt.range}`
                      : windowFmt.range}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>

          {/* Always mount on non-loading states so desktop still shows Buy/identity on sale error. */}
          <PurchaseRail {...purchaseSurfaceProps} />
        </div>
      ) : null}

      <StickyBuyBar {...purchaseSurfaceProps} />
    </main>
  );
}
