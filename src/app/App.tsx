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
import MemberDashboardPage from './pages/MemberDashboardPage';
import LeaderboardPage from './pages/LeaderboardPage';
import RewardsPage from './pages/RewardsPage';
import TopupPage from './pages/TopupPage';

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
            <Route path="/vip/dashboard" element={<MemberDashboardPage />} />
            <Route path="/vip/leaderboard" element={<LeaderboardPage />} />
            <Route path="/vip/rewards" element={<RewardsPage />} />
            <Route path="/vip/topup" element={<TopupPage />} />
            <Route path="/reseller" element={<ResellerPage />} />
            <Route path="/reseller/dashboard" element={<MemberDashboardPage />} />
            <Route path="/reseller/leaderboard" element={<LeaderboardPage />} />
            <Route path="/reseller/rewards" element={<RewardsPage />} />
            <Route path="/reseller/topup" element={<TopupPage />} />
            <Route path="*" element={<ShopPage />} />
          </Routes>
        </MaintenanceGate>
      </CustomerAuthProvider>
    </BrowserRouter>
  );
}
