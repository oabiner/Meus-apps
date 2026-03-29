export type UserRole = 'host' | 'admin' | 'waiter' | 'kitchen';

export interface User {
  id: string;
  username: string;
  role: UserRole;
}

export type TableStatus = 'free' | 'open' | 'bill_requested';

export interface Table {
  id: number;
  number: number;
  status: TableStatus;
  customer_name?: string;
  people_count?: number;
  opened_at?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  type: string; // e.g., 'comida', 'bebida'
  category: string; // e.g., 'porção', 'refrigerante'
  active?: number; // 1 for active, 0 for inactive
}

export interface OrderItem {
  id: string;
  tableId: number;
  menuItemId: string;
  quantity: number;
  status: 'pending' | 'delivered';
  is_read: number; // 0 or 1
  observation?: string;
  timestamp: string;
  item_name?: string;
  item_price?: number;
}

export interface HistoryEvent {
  id: string;
  userId: string;
  username: string;
  action: string;
  details: string;
  order_id?: string;
  is_read?: number;
  timestamp: string;
}

export type WSEvent = 
  | { type: 'TABLE_UPDATE'; payload: Table }
  | { type: 'TABLES_SYNC'; payload: Table[] }
  | { type: 'MENU_UPDATE'; payload: MenuItem[] }
  | { type: 'ORDER_NEW'; payload: OrderItem[] }
  | { type: 'ORDER_UPDATE'; payload: OrderItem }
  | { type: 'ORDER_DELETED'; payload: { orderId: string; tableId: number } }
  | { type: 'BILL_REQUEST'; payload: { tableId: number; customerName?: string } }
  | { type: 'BILL_CLOSED'; payload: { tableId: number; paymentMethods: string[] } }
  | { type: 'TABLE_CLOSE'; payload: { tableId: number } }
  | { type: 'HISTORY_UPDATE'; payload: HistoryEvent[] }
  | { type: 'CATEGORIES_UPDATE'; payload: any[] }
  | { type: 'DETAILS_UPDATE'; payload: any[] }
  | { type: 'CATEGORY_ADD'; payload: { name: string } }
  | { type: 'CATEGORY_EDIT'; payload: { id: string; name: string } }
  | { type: 'CATEGORY_DELETE'; payload: { id: string } }
  | { type: 'DETAIL_ADD'; payload: { name: string } }
  | { type: 'DETAIL_EDIT'; payload: { id: string; name: string } }
  | { type: 'DETAIL_DELETE'; payload: { id: string } }
  | { type: 'SETTINGS_UPDATE'; payload: any }
  | { type: 'NOTIFICATION'; payload: { message: string; type: 'info' | 'success' | 'warning' } }
  | { type: 'FORCE_LOGOUT'; payload: { message: string } };
