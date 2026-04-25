export type UserRole = 'host' | 'admin' | 'waiter' | 'kitchen' | 'caixa';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  avatar?: string;
}

export type TableStatus = 'free' | 'open' | 'bill_requested';

export interface Table {
  id: number;
  number: number;
  status: TableStatus;
  customer_name?: string;
  people_count?: number;
  opened_at?: string;
  type?: 'salao' | 'gramado';
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  type: string; // e.g., 'comida', 'bebida'
  category: string; // e.g., 'porção', 'refrigerante'
  active?: number; // 1 for active, 0 for inactive
  created_at?: string;
  is_stockable?: number; // 0 or 1
  is_solid?: number; // 0 or 1
  current_stock?: number;
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
  category?: string;
  group?: string;
}

export interface StockPurchase {
  id: string;
  menu_item_id: string;
  quantity: number;
  cost_price: number;
  timestamp: string;
  user_id: string;
  username: string;
}

export interface HistoryEvent {
  id: string;
  user_id: string;
  username: string;
  action: string;
  details: string;
  item_group?: string;
  table_id?: number;
  order_id?: string;
  request_id?: string;
  is_read: number;
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
  | { type: 'TABLE_CLOSE'; payload: { tableId: number; paymentMethods: string[] } }
  | { type: 'TABLE_TRANSFER'; payload: { fromTableId: number; toTableId: number; orderIds: string[]; userId: string; username: string } }
  | { type: 'TABLE_TRANSFER_REQUEST'; payload: { fromTableId: number; toTableId: number; orderIds: string[]; userId: string; username: string; requestId: string } }
  | { type: 'TABLE_TRANSFER_APPROVE'; payload: { requestId: string; userId: string; username: string } }
  | { type: 'TABLE_TRANSFER_REJECT'; payload: { requestId: string; userId: string; username: string } }
  | { type: 'HISTORY_UPDATE'; payload: HistoryEvent[] }
  | { type: 'TRANSFER_REQUESTS_SYNC'; payload: any[] }
  | { type: 'CATEGORIES_UPDATE'; payload: any[] }
  | { type: 'DETAILS_UPDATE'; payload: any[] }
  | { type: 'CATEGORY_ADD'; payload: { name: string } }
  | { type: 'CATEGORY_EDIT'; payload: { id: string; name: string } }
  | { type: 'CATEGORY_DELETE'; payload: { id: string } }
  | { type: 'DETAIL_ADD'; payload: { name: string } }
  | { type: 'DETAIL_EDIT'; payload: { id: string; name: string } }
  | { type: 'DETAIL_DELETE'; payload: { id: string } }
  | { type: 'SETTINGS_UPDATE'; payload: any }
  | { type: 'ORDERS_SYNC'; payload: OrderItem[] }
  | { type: 'NOTIFICATION'; payload: { message: string; type: 'info' | 'success' | 'warning' } }
  | { type: 'FORCE_LOGOUT'; payload: { message: string } }
  | { type: 'ONLINE_USERS'; payload: { userId: string; username: string; role: string }[] }
  | { type: 'CASHIER_STATUS'; payload: { status: 'open' | 'closed'; sessionId?: string; initialBalance?: number } }
  | { type: 'CASHIER_TRANSACTIONS'; payload: any[] }
  | { type: 'ACCOUNTS_PAYABLE_SYNC'; payload: any[] }
  | { type: 'TASKS_SYNC'; payload: any[] }
  | { type: 'BALCAO_CHECKOUT_TRIGGER'; payload: any }
  | { type: 'BALCAO_DIRECT_SALE_SUCCESS'; payload: { userId: string } }
  | { type: 'HISTORY_ALL_DATA'; payload: HistoryEvent[] }
  | { type: 'PRINT_COMMAND'; payload: any }
  | { type: 'STOCK_SYNC'; payload: StockPurchase[] }
  | { type: 'PURCHASE_ADD'; payload: StockPurchase };
