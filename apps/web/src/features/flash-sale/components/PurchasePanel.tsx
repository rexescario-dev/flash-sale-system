type Props = {
  userId: string;
  buyDisabled: boolean;
  buyPending: boolean;
  onBuy: () => void;
  onUserIdChange: (value: string) => void;
  purchased: boolean | undefined;
};

export function PurchasePanel({
  userId,
  buyDisabled,
  buyPending,
  onBuy,
  onUserIdChange,
  purchased,
}: Props) {
  return (
    <section aria-label="Purchase">
      <label htmlFor="user-id">User ID</label>
      <input
        id="user-id"
        onChange={(event) => {
          onUserIdChange(event.target.value);
        }}
        value={userId}
      />
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
