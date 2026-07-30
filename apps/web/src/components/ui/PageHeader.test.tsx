import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders eyebrow, title, and description', () => {
    render(
      <PageHeader
        description="Browse open and upcoming sales."
        eyebrow="Flash Sale System"
        title="Flash sales"
      />,
    );
    expect(screen.getByText('Flash Sale System')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Flash sales' })).toBeInTheDocument();
    expect(screen.getByText(/browse open/i)).toBeInTheDocument();
  });
});
