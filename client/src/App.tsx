import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { CustomersPage } from './pages/customers/CustomersPage';
import { ProductsPage } from './pages/products/ProductsPage';
import { ChallansPage } from './pages/challans/ChallansPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Application Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Customer CRM: Allowed for ADMIN, SALES, ACCOUNTS */}
              <Route
                path="/customers"
                element={
                  <ProtectedRoute allowedRoles={['ADMIN', 'SALES', 'ACCOUNTS']} />
                }
              >
                <Route index element={<CustomersPage />} />
              </Route>

              {/* Products & Inventory: Viewable by all 4 roles */}
              <Route path="/products" element={<ProductsPage />} />

              {/* Sales Challans: Viewable by all 4 roles */}
              <Route path="/challans" element={<ChallansPage />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
