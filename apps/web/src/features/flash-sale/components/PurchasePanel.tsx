type Props = {
  buyDisabled: boolean;
  buyPending: boolean;
  onBuy: () => void;
  purchased: boolean | undefined;
  showGuestHint: boolean;
};

export function PurchasePanel({ buyDisabled, buyPending, onBuy, purchased, showGuestHint }: Props) {
  return (
    <section aria-label="Purchase">
      {showGuestHint ? <p data-testid="identify-to-buy">Identify to buy.</p> : null}
      {purchased === true ? (
        <p data-testid="already-purchased" role="status">
          You have already purchased this item.
        </p>
      ) : null}
      <button disabled={buyDisabled} onClick={onBuy} type="button">
        {buyPending ? 'Buying…' : 'Buy Now'}
      </button>
    </section>
  );
}
