import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
  it('renders primary variant and forwards click', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button data-testid="btn" onClick={onClick} type="button">
        Save
      </Button>,
    );
    const btn = screen.getByTestId('btn');
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.className).toMatch(/bg-emerald-700/);
    await user.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders secondary variant', () => {
    render(
      <Button type="button" variant="secondary">
        Cancel
      </Button>,
    );
    expect(screen.getByRole('button', { name: /cancel/i }).className).toMatch(/text-emerald-800/);
    expect(screen.getByRole('button', { name: /cancel/i }).className).not.toMatch(/bg-emerald-700/);
  });

  it('forwards ref to the native button element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} type="button">
        Action
      </Button>,
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.tagName).toBe('BUTTON');
  });

  it('honors disabled and merges className', () => {
    render(
      <Button className="w-full" disabled type="button">
        Buy Now
      </Button>,
    );
    const btn = screen.getByRole('button', { name: /buy now/i });
    expect(btn).toBeDisabled();
    expect(btn.className).toMatch(/w-full/);
  });
});
