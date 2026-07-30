import { Outlet } from 'react-router-dom';

import { CustomerNav } from '../features/nav/CustomerNav';

export function CustomerLayout() {
  return (
    <>
      <CustomerNav />
      <Outlet />
    </>
  );
}
