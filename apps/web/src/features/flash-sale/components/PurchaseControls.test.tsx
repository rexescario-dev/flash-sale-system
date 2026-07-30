import type { ReactElement } from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IdentityProvider } from '../../identity/IdentityProvider';
import { PurchaseControls } from './PurchaseControls';

function wrap(ui: ReactElement) {
  // Mirrors IdentityStrip.test.tsx — IdentityProvider only (no router/query).
  return render(<IdentityProvider>{ui}</IdentityProvider>);
}

afterEach(() => {
  localStorage.clear();
});

describe('PurchaseControls', () => {
  it('keeps Buy Now label and shows helper when disabled', () => {
    wrap(
      <PurchaseControls
        buyDisabled
        buyPending={false}
        helper="Enter your email to continue."
        onBuy={() => undefined}
        showSummaries={false}
      />,
    );
    expect(screen.getByRole('button', { name: /^buy now$/i })).toBeDisabled();
    expect(screen.getByTestId('buy-helper')).toHaveTextContent(/enter your email/i);
  });

  it('shows Buying… and hides helper + banners while pending', () => {
    wrap(
      <PurchaseControls
        buyDisabled
        buyPending
        helper="should hide"
        onBuy={() => undefined}
        purchaseError={{ message: 'err', onRetry: () => undefined }}
        purchaseOutcome={{
          purchaseId: 'p1',
          message: 'ok',
          status: 'SUCCESS',
        }}
        showSummaries={false}
      />,
    );
    expect(screen.getByRole('button', { name: /buying/i })).toBeDisabled();
    expect(screen.getByTestId('buy-helper')).toBeEmptyDOMElement();
    expect(screen.queryByTestId('request-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('purchase-outcome')).not.toBeInTheDocument();
  });

  it('already purchased positive status', () => {
    wrap(
      <PurchaseControls
        alreadyPurchased
        buyDisabled
        buyPending={false}
        onBuy={() => undefined}
        showSummaries={false}
      />,
    );
    expect(screen.getByTestId('already-purchased')).toHaveTextContent(/purchased/i);
  });

  it('retry calls onRetry', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    wrap(
      <PurchaseControls
        buyDisabled={false}
        buyPending={false}
        onBuy={() => undefined}
        purchaseError={{ message: 'fail', onRetry }}
        showSummaries={false}
      />,
    );
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
