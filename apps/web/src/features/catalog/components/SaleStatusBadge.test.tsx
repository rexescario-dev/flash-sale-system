import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { FlashSaleStatus } from '../../../graphql/types';

import { SaleStatusBadge } from './SaleStatusBadge';

const cases: Array<{ label: string; status: FlashSaleStatus; toneHint: RegExp }> = [
  { label: 'Upcoming', status: 'UPCOMING', toneHint: /amber|yellow/i },
  { label: 'Active', status: 'ACTIVE', toneHint: /green|emerald/i },
  { label: 'Sold Out', status: 'SOLD_OUT', toneHint: /red|rose/i },
  { label: 'Ended', status: 'ENDED', toneHint: /neutral|gray|slate|zinc/i },
];

describe('SaleStatusBadge', () => {
  it.each(cases)(
    'maps $status → $label with intended color tone',
    ({ label, status, toneHint }) => {
      render(<SaleStatusBadge status={status} />);
      const badge = screen.getByTestId('sale-status-badge');
      expect(badge).toHaveTextContent(label);
      expect(badge).toHaveAttribute('data-status', status);
      expect(badge.className).toMatch(toneHint);
    },
  );
});
