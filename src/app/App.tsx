import { BrowserRouter, Routes, Route } from 'react-router';
import MaintenanceGate from './components/MaintenanceGate';
import ShopPage from './pages/ShopPage';
import AdminPage from './pages/AdminPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderStatusPage from './pages/OrderStatusPage';

export default function App() {
  return (
    <BrowserRouter>
      <MaintenanceGate>
      <Routes>
        <Route path="/" element={<ShopPage />} />
        <Route path="/stock" element={<ShopPage />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-status/:id" element={<OrderStatusPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<ShopPage />} />
      </Routes>
      </MaintenanceGate>
    </BrowserRouter>
  );
}
