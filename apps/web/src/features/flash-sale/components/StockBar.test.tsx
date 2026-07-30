import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StockBar } from './StockBar';

describe('StockBar', () => {
  it.each([
    { remaining: 0, total: 10, width: '0%' },
    { remaining: 1, total: 10, width: '10%' },
    { remaining: 10, total: 10, width: '100%' },
  ])('renders $remaining/$total with fill width $width', ({ remaining, total, width }) => {
    render(<StockBar remaining={remaining} total={total} />);

    expect(screen.getByTestId('sale-stock')).toHaveTextContent(`${remaining} / ${total}`);
    expect(screen.getByTestId('stock-bar-fill')).toHaveStyle({ width });
  });
});
