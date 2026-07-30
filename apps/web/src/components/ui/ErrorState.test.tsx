import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('renders neutral alert with title, message, and retry', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <ErrorState
        data-testid="catalog-error"
        message="boom"
        onRetry={onRetry}
        title="Could not load catalog"
      />,
    );
    const root = screen.getByTestId('catalog-error');
    expect(root).toHaveAttribute('role', 'alert');
    expect(root.className).toMatch(/bg-white\/70/);
    expect(screen.getByText('Could not load catalog')).toBeInTheDocument();
    expect(screen.getByText('boom')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
