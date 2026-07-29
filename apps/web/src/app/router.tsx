import { Route, Routes } from 'react-router-dom';

import { FlashSalePage } from '../pages/FlashSalePage';
import { LandingPage } from '../pages/LandingPage';
import { NotFoundPage } from '../pages/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<LandingPage />} path="/" />
      <Route element={<FlashSalePage />} path="/sales/:flashSaleId" />
      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  );
}
