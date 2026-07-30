import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { IdentityProvider } from '../IdentityProvider';
import { IdentityStrip } from './IdentityStrip';

function renderStrip() {
  return render(
    <IdentityProvider>
      <IdentityStrip />
    </IdentityProvider>,
  );
}

describe('IdentityStrip', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('shows Guest then commits via Identify/Save', async () => {
    const user = userEvent.setup();
    renderStrip();
    expect(screen.getByTestId('identity-status')).toHaveTextContent(/guest/i);
    await user.click(screen.getByTestId('identity-identify'));
    await user.type(screen.getByTestId('identity-email-input'), 'rex@example.com');
    await user.click(screen.getByTestId('identity-save'));
    expect(screen.getByTestId('identity-status')).toHaveTextContent('Shopping as rex@example.com');
    expect(screen.queryByTestId('identity-email-input')).not.toBeInTheDocument();
  });

  it('Change prefills and Cancel restores prior display', async () => {
    const user = userEvent.setup();
    renderStrip();
    await user.click(screen.getByTestId('identity-identify'));
    await user.type(screen.getByTestId('identity-email-input'), 'a@b.c');
    await user.click(screen.getByTestId('identity-save'));
    await user.click(screen.getByTestId('identity-change'));
    expect(screen.getByTestId('identity-email-input')).toHaveValue('a@b.c');
    await user.clear(screen.getByTestId('identity-email-input'));
    await user.type(screen.getByTestId('identity-email-input'), 'other');
    await user.click(screen.getByTestId('identity-cancel'));
    expect(screen.getByTestId('identity-status')).toHaveTextContent('Shopping as a@b.c');
  });

  it('disables Save for whitespace-only draft', async () => {
    const user = userEvent.setup();
    renderStrip();
    await user.click(screen.getByTestId('identity-identify'));
    await user.type(screen.getByTestId('identity-email-input'), '   ');
    expect(screen.getByTestId('identity-save')).toBeDisabled();
  });

  it('Change then Save same value stays identified without leaving editing broken', async () => {
    const user = userEvent.setup();
    renderStrip();
    await user.click(screen.getByTestId('identity-identify'));
    await user.type(screen.getByTestId('identity-email-input'), 'same@id');
    await user.click(screen.getByTestId('identity-save'));
    await user.click(screen.getByTestId('identity-change'));
    await user.click(screen.getByTestId('identity-save'));
    expect(screen.getByTestId('identity-status')).toHaveTextContent('Shopping as same@id');
    expect(screen.queryByTestId('identity-email-input')).not.toBeInTheDocument();
  });

  it('restores focus to Change after Cancel', async () => {
    const user = userEvent.setup();
    renderStrip();
    await user.click(screen.getByTestId('identity-identify'));
    await user.type(screen.getByTestId('identity-email-input'), 'focus-me');
    await user.click(screen.getByTestId('identity-save'));
    await user.click(screen.getByTestId('identity-change'));
    await user.click(screen.getByTestId('identity-cancel'));
    expect(screen.getByTestId('identity-change')).toHaveFocus();
  });
});
