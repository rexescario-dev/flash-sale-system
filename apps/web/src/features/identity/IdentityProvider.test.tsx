import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { identityStorage } from './identity-storage';
import { IdentityProvider, useUserIdentity } from './IdentityProvider';

function Probe() {
  const { userId, clearIdentity, setIdentity } = useUserIdentity();
  return (
    <div>
      <span data-testid="uid">{userId === null ? 'null' : userId}</span>
      <button
        type="button"
        onClick={() => {
          const ok = setIdentity(' user-123 ');
          document.body.dataset.lastOk = String(ok);
        }}
      >
        set
      </button>
      <button
        type="button"
        onClick={() => {
          const ok = setIdentity('   ');
          document.body.dataset.lastOk = String(ok);
        }}
      >
        set-blank
      </button>
      <button
        type="button"
        onClick={() => {
          const ok = setIdentity(' user-123 ');
          document.body.dataset.lastOk = String(ok);
        }}
      >
        set-same
      </button>
      <button type="button" onClick={() => clearIdentity()}>
        clear
      </button>
    </div>
  );
}

describe('IdentityProvider', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('throws outside IdentityProvider', () => {
    expect(() => render(<Probe />)).toThrow(/IdentityProvider/);
  });

  it('hydrates from storage once on init', () => {
    identityStorage.set('seeded');
    render(
      <IdentityProvider>
        <Probe />
      </IdentityProvider>,
    );
    expect(screen.getByTestId('uid')).toHaveTextContent('seeded');
  });

  it('setIdentity commits exact string and returns true', async () => {
    const user = userEvent.setup();
    render(
      <IdentityProvider>
        <Probe />
      </IdentityProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'set' }));
    expect(screen.getByTestId('uid').textContent).toBe(' user-123 ');
    expect(identityStorage.get()).toBe(' user-123 ');
    expect(document.body.dataset.lastOk).toBe('true');
  });

  it('rejects whitespace and returns false', async () => {
    const user = userEvent.setup();
    render(
      <IdentityProvider>
        <Probe />
      </IdentityProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'set-blank' }));
    expect(screen.getByTestId('uid')).toHaveTextContent('null');
    expect(identityStorage.get()).toBeNull();
    expect(document.body.dataset.lastOk).toBe('false');
  });

  it('same-value setIdentity returns true and leaves userId unchanged', async () => {
    const user = userEvent.setup();
    identityStorage.set(' user-123 ');
    render(
      <IdentityProvider>
        <Probe />
      </IdentityProvider>,
    );
    expect(screen.getByTestId('uid').textContent).toBe(' user-123 ');
    await user.click(screen.getByRole('button', { name: 'set-same' }));
    expect(document.body.dataset.lastOk).toBe('true');
    expect(screen.getByTestId('uid').textContent).toBe(' user-123 ');
  });

  it('ignores external localStorage mutations after hydrate (no listeners)', () => {
    identityStorage.set('seeded');
    render(
      <IdentityProvider>
        <Probe />
      </IdentityProvider>,
    );
    expect(screen.getByTestId('uid')).toHaveTextContent('seeded');
    localStorage.setItem('flash-sale.userId', 'mutated-outside');
    expect(screen.getByTestId('uid')).toHaveTextContent('seeded');
  });

  it('clearIdentity clears memory and storage', async () => {
    const user = userEvent.setup();
    identityStorage.set('x');
    render(
      <IdentityProvider>
        <Probe />
      </IdentityProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'clear' }));
    expect(screen.getByTestId('uid')).toHaveTextContent('null');
    expect(identityStorage.get()).toBeNull();
  });

  it('keeps in-memory identity when persistence throws', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    render(
      <IdentityProvider>
        <Probe />
      </IdentityProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'set' }));
    expect(screen.getByTestId('uid').textContent).toBe(' user-123 ');
  });
});
