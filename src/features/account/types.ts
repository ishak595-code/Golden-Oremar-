
export type AccountView =
  | 'home'
  | 'profile'
  | 'orders'
  | 'reviews'
  | 'addresses'
  | 'favorites'
  | 'followed-producers'
  | 'gifts'
  | 'payments'
  | 'notifications'
  | 'contact'
  | 'support'
  | 'seller'
  | 'producer-products'
  | 'producer-profile-edit'
  | 'settings';

export interface AccountOverview {
  profile: {
    id: string;
    email: string;
    display_name: string;
    phone: string | null;
    avatar_path: string | null;
    locale: string;
    status: string;
    marketing_consent: boolean;
    created_at: string;
  };
  roles: string[];
  addresses: Address[];
  summary: {
    favorite_count: number;
    address_count: number;
    order_count: number;
    active_order_count: number;
    return_count: number;
    gift_count: number;
    followed_producer_count: number;
    unread_notification_count: number;
  };
  recent_orders: any[];
  producer: any | null;
  account_closure: any | null;
}

export interface Address {
  id?: string;
  label: string;
  recipient_name: string;
  phone: string;
  country_code: string;
  province: string;
  district: string;
  neighborhood?: string | null;
  address_line: string;
  postal_code?: string | null;
  delivery_notes?: string | null;
  is_default: boolean;
}

export interface OrdersPage {
  total: number;
  limit: number;
  offset: number;
  items: any[];
}
