import { useParams } from 'react-router-dom';

export function FlashSalePage() {
  // useParams may type flashSaleId as string | undefined; default '' preserves the gate.
  // Pass the value to GraphQL later exactly as returned — no trim/lowercase/manual decode.
  const { flashSaleId = '' } = useParams();

  return (
    <main className="shell" data-testid="flash-sale-page">
      <p className="eyebrow">Flash Sale</p>
      <h1>Sale {flashSaleId}</h1>
      <p className="lede">Sale details load in a later step.</p>
    </main>
  );
}
