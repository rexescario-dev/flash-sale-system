import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the foundation shell', () => {
    render(<App />);
    expect(screen.getByText('Flash Sale System')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /platform foundation/i })).toBeInTheDocument();
  });
});
