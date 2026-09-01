import { BrowserRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ShopPage from './pages/ShopPage';
import AdminPage from './pages/AdminPage';
import AnnouncementsPage from './pages/AnnouncementsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderStatusPage from './pages/OrderStatusPage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
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
      </BrowserRouter>
    </QueryClientProvider>
  );
}
