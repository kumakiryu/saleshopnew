import { BrowserRouter, Routes, Route } from 'react-router';
import { useEffect } from 'react';
import { CustomerAuthProvider } from '@/lib/customerAuth';
import logoImage from '@/imports/image-1.png';

const TITLES = ['SALE SHOP', 'BUY NOW! 🛒', 'SALE SHOP', 'BEST PRICES! 🔥'];

function TabMeta() {
  useEffect(() => {
    // Favicon
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = logoImage;

    // Cycling title
    let i = 0;
    document.title = TITLES[0];
    const id = setInterval(() => {
      i = (i + 1) % TITLES.length;
      document.title = TITLES[i];
    }, 2000);
    return () => clearInterval(id);
  }, []);
  return null;
}
import MaintenanceGate from './components/MaintenanceGate';
import GlobalMusicPlayer from './components/GlobalMusicPlayer';
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
          <TabMeta />
          <GlobalMusicPlayer />
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
