export type ProductType = 'physical' | 'digital_download' | 'digital_code' | 'account_product';
export type CustomerTier = 'normal' | 'vip' | 'reseller';

export interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  download_url: string | null;
  price: number;
  vip_price: number | null;
  reseller_price: number | null;
  stock: number;
  category: string | null;
  product_type: ProductType;
  created_at: string;
  updated_at: string;
}

export interface UserMembership {
  id: string;
  user_id: string;
  tier: CustomerTier;
  assigned_by: string | null;
  assigned_at: string;
}

export interface CustomerUser {
  id: string;
  email: string;
  tier: CustomerTier;
}

export interface EmailLog {
  id: string;
  order_id: string | null;
  recipient: string;
  subject: string | null;
  status: 'sent' | 'failed' | 'delivered';
  resend_id: string | null;
  sent_at: string;
  error: string | null;
}

export interface ProductCode {
  id: string;
  product_id: string;
  code: string;
  status: 'available' | 'reserved' | 'delivered';
  assigned_to: string | null;
  assigned_at: string | null;
}

export interface ProductAccount {
  id: string;
  product_id: string;
  username: string;
  password: string;
  status: 'available' | 'reserved' | 'delivered';
  assigned_order_id: string | null;
  assigned_email: string | null;
  assigned_at: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: string;
  image_url: string | null;
  pinned: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'delivering'
  | 'delivered'
  | 'waiting_for_inventory'
  | 'failed'
  | 'cancelled';

export interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_discord: string | null;
  notes: string | null;
  total: number;
  status: OrderStatus;
  payment_method: 'paymongo' | 'coinbase' | 'coinsph' | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  price: number;
  download_url: string | null;
  assigned_code: string | null;
  assigned_username: string | null;
  assigned_password: string | null;
}

export interface TokenBalance {
  vipTokens: number;
  resellerTokens: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
}

export interface TokenTransaction {
  id: string;
  user_id: string;
  transaction_type: 'earn' | 'spend' | 'adjust' | 'topup';
  amount: number;
  reason: string;
  created_at: string;
}

export interface RewardProduct {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  token_cost: number;
  membership_type: 'vip' | 'reseller' | 'both';
  stock: number;
  active: boolean;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  email: string;
  tokens: number;
  token_type: 'vip' | 'reseller';
}
