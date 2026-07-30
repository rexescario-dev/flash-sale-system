import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { IdentityStatus } from './IdentityStatus';

export function isFlashSalesSection(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/sales/');
}

export function isPurchasesSection(pathname: string): boolean {
  return pathname === '/purchases';
}

function sectionLinkClassName(active: boolean): string {
  return [
    'rounded px-2 py-1 text-sm font-semibold',
    active
      ? 'text-emerald-950 underline underline-offset-4'
      : 'text-emerald-800/80 hover:text-emerald-950',
  ].join(' ');
}

export function CustomerNav() {
  const { key, pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const flashSalesCurrent = isFlashSalesSection(pathname);
  const purchasesCurrent = isPurchasesSection(pathname);

  useEffect(() => {
    setMenuOpen(false);
  }, [key]);

  function closeMenu() {
    setMenuOpen(false);
  }

  function toggleMenu() {
    setMenuOpen((open) => !open);
  }

  return (
    <nav className="border-b border-emerald-100 bg-emerald-50/80" data-testid="customer-nav">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <button
          aria-controls="customer-nav-menu"
          aria-expanded={menuOpen}
          className="rounded border border-emerald-200 px-2 py-1 text-sm font-semibold text-emerald-900 md:hidden"
          data-testid="nav-menu-button"
          onClick={toggleMenu}
          type="button"
        >
          Menu
        </button>

        <Link
          className="text-base font-bold text-emerald-950"
          data-testid="nav-brand"
          onClick={closeMenu}
          to="/"
        >
          Flash Sale Store
        </Link>

        <div
          className={[
            'w-full flex-col gap-2 md:flex md:w-auto md:flex-1 md:flex-row md:items-center md:gap-4',
            menuOpen ? 'flex' : 'hidden md:flex',
          ].join(' ')}
          data-testid={menuOpen ? 'nav-menu' : undefined}
          id="customer-nav-menu"
        >
          <Link
            aria-current={flashSalesCurrent ? 'page' : undefined}
            className={sectionLinkClassName(flashSalesCurrent)}
            data-testid="nav-flash-sales"
            onClick={closeMenu}
            to="/"
          >
            Flash Sales
          </Link>
          <Link
            aria-current={purchasesCurrent ? 'page' : undefined}
            className={sectionLinkClassName(purchasesCurrent)}
            data-testid="nav-purchases"
            onClick={closeMenu}
            to="/purchases"
          >
            My Purchases
          </Link>
        </div>

        <div className="ml-auto">
          <IdentityStatus />
        </div>
      </div>
    </nav>
  );
}
