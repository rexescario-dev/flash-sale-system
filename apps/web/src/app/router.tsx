import { Route, Routes } from 'react-router-dom';

import { CatalogPage } from '../pages/CatalogPage';
import { FlashSalePage } from '../pages/FlashSalePage';
import { NotFoundPage } from '../pages/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<CatalogPage />} path="/" />
      <Route element={<FlashSalePage />} path="/sales/:flashSaleId" />
      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  );
}
