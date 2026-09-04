import { BrowserRouter, Routes, Route } from 'react-router';
import { CustomerAuthProvider } from '@/lib/customerAuth';
import MaintenanceGate from './components/MaintenanceGate';
import ShopPage from './pages/ShopPage';
import AdminPage from './pages/AdminPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderStatusPage from './pages/OrderStatusPage';
import VipPage from './pages/VipPage';
import ResellerPage from './pages/ResellerPage';

export default function App() {
  return (
    <BrowserRouter>
      <CustomerAuthProvider>
        <MaintenanceGate>
          <Routes>
            <Route path="/" element={<ShopPage />} />
            <Route path="/stock" element={<ShopPage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/order-status/:id" element={<OrderStatusPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/vip" element={<VipPage />} />
            <Route path="/reseller" element={<ResellerPage />} />
            <Route path="*" element={<ShopPage />} />
          </Routes>
        </MaintenanceGate>
      </CustomerAuthProvider>
    </BrowserRouter>
  );
}
