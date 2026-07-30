import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Outlet, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { identityStorage } from '../identity/identity-storage';
import { IdentityProvider } from '../identity/IdentityProvider';
import { CustomerNav } from './CustomerNav';

function renderNav(path: string) {
  return render(
    <IdentityProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            element={
              <>
                <CustomerNav />
                <div data-testid="outlet-stub">outlet</div>
              </>
            }
            path="*"
          />
        </Routes>
      </MemoryRouter>
    </IdentityProvider>,
  );
}

afterEach(() => {
  cleanup();
  identityStorage.clear();
});

describe('CustomerNav', () => {
  it('exposes brand and section links with correct hrefs and labels', () => {
    renderNav('/');
    expect(screen.getByTestId('customer-nav')).toBeInTheDocument();
    expect(screen.getByTestId('nav-brand')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('nav-flash-sales')).toHaveAttribute('href', '/');
    expect(screen.getByTestId('nav-purchases')).toHaveAttribute('href', '/purchases');
    expect(screen.getByTestId('nav-brand')).toHaveTextContent('Flash Sale Store');
    expect(screen.getByTestId('nav-flash-sales')).toHaveTextContent('Flash Sales');
    expect(screen.getByTestId('nav-purchases')).toHaveTextContent('My Purchases');
  });

  it('does not render duplicate canonical section-link testids at once', () => {
    renderNav('/');
    expect(screen.getAllByTestId('nav-flash-sales')).toHaveLength(1);
    expect(screen.getAllByTestId('nav-purchases')).toHaveLength(1);
  });

  it('marks Flash Sales current on /', () => {
    renderNav('/');
    expect(screen.getByTestId('nav-flash-sales')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-purchases')).not.toHaveAttribute('aria-current');
  });

  it('marks Flash Sales current on /sales/:id', () => {
    renderNav('/sales/sale-1');
    expect(screen.getByTestId('nav-flash-sales')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-purchases')).not.toHaveAttribute('aria-current');
  });

  it('marks My Purchases current on /purchases', () => {
    renderNav('/purchases');
    expect(screen.getByTestId('nav-purchases')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-flash-sales')).not.toHaveAttribute('aria-current');
  });

  it('shows Guest identity copy with no edit controls', () => {
    renderNav('/');
    expect(screen.getByTestId('nav-identity-status')).toHaveTextContent('Shopping as Guest');
    expect(screen.queryByTestId('identity-identify')).not.toBeInTheDocument();
    expect(screen.queryByTestId('identity-change')).not.toBeInTheDocument();
    expect(screen.queryByTestId('identity-save')).not.toBeInTheDocument();
  });

  it('shows committed identity copy seeded via identityStorage.set', () => {
    identityStorage.set('buyer-nav');
    renderNav('/');
    expect(screen.getByTestId('nav-identity-status')).toHaveTextContent('Shopping as buyer-nav');
    expect(screen.queryByTestId('identity-identify')).not.toBeInTheDocument();
    expect(screen.queryByTestId('identity-change')).not.toBeInTheDocument();
    expect(screen.queryByTestId('identity-save')).not.toBeInTheDocument();
  });

  it('opens and closes the mobile disclosure via the menu button', async () => {
    const user = userEvent.setup();
    renderNav('/');

    const button = screen.getByTestId('nav-menu-button');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('nav-menu')).not.toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('nav-menu')).toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('nav-menu')).not.toBeInTheDocument();
  });

  it('closes the disclosure after following a nav link', async () => {
    const user = userEvent.setup();
    render(
      <IdentityProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route
              element={
                <>
                  <CustomerNav />
                  <div data-testid="page">home</div>
                </>
              }
              path="/"
            />
            <Route
              element={
                <>
                  <CustomerNav />
                  <div data-testid="page">purchases</div>
                </>
              }
              path="/purchases"
            />
          </Routes>
        </MemoryRouter>
      </IdentityProvider>,
    );

    await user.click(screen.getByTestId('nav-menu-button'));
    expect(screen.getByTestId('nav-menu')).toBeInTheDocument();

    await user.click(screen.getByTestId('nav-purchases'));
    expect(screen.getByTestId('page')).toHaveTextContent('purchases');
    expect(screen.getByTestId('nav-menu-button')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('nav-menu')).not.toBeInTheDocument();
  });

  it('closes the disclosure after navigating via a non-nav in-page link, even when the layout persists', async () => {
    const user = userEvent.setup();
    function StubLayout() {
      return (
        <>
          <CustomerNav />
          <Outlet />
        </>
      );
    }
    render(
      <IdentityProvider>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route element={<StubLayout />}>
              <Route
                element={
                  <Link data-testid="stub-page-link" to="/purchases">
                    Go to purchases
                  </Link>
                }
                path="/"
              />
              <Route element={<div data-testid="page">purchases</div>} path="/purchases" />
            </Route>
          </Routes>
        </MemoryRouter>
      </IdentityProvider>,
    );

    await user.click(screen.getByTestId('nav-menu-button'));
    expect(screen.getByTestId('nav-menu')).toBeInTheDocument();

    await user.click(screen.getByTestId('stub-page-link'));
    expect(screen.getByTestId('page')).toHaveTextContent('purchases');
    expect(screen.getByTestId('nav-menu-button')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('nav-menu')).not.toBeInTheDocument();
  });
});
