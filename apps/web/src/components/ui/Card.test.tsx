import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Card } from './Card';

describe('Card', () => {
  it('renders a div surface and merges className', () => {
    render(
      <Card className="shadow-sm" data-testid="card">
        Hello
      </Card>,
    );
    const el = screen.getByTestId('card');
    expect(el.tagName).toBe('DIV');
    expect(el).toHaveTextContent('Hello');
    expect(el.className).toMatch(/rounded-lg/);
    expect(el.className).toMatch(/border-emerald-900\/15/);
    expect(el.className).toMatch(/shadow-sm/);
  });
});
