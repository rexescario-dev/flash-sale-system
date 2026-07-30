import { Route, Routes } from 'react-router-dom';

import { CatalogPage } from '../pages/CatalogPage';
import { FlashSalePage } from '../pages/FlashSalePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PurchasesPage } from '../pages/PurchasesPage';
import { CustomerLayout } from './CustomerLayout';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route element={<CatalogPage />} path="/" />
        <Route element={<FlashSalePage />} path="/sales/:flashSaleId" />
        <Route element={<PurchasesPage />} path="/purchases" />
      </Route>
      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  );
}
