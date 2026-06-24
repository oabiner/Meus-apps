
export type FinancialTransactionType =
  | 'sale'
  | 'refund'
  | 'expense'
  | 'sangria'
  | 'reinforcement'
  | 'opening_balance'
  | 'closing_adjustment';

export type PaymentMethod =
  | 'cash'
  | 'pix'
  | 'credit_card'
  | 'debit_card'
  | 'voucher'
  | 'internal'
  | 'other';

export interface FinancialTransaction {
  id: string;
  session_id: string;
  type: FinancialTransactionType;
  amount: number;
  operator_id: string;
  operator_name: string;
  description: string;
  payment_method: PaymentMethod;
  created_at: string;
  synced: boolean;
  deleted: boolean;
}

export interface CashierSession {
  id: string;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string;
  opened_by_id: string;
  opened_by_name: string;
  closed_by_id?: string;
  closed_by_name?: string;
  initial_balance: number;
  expected_balance?: number;
  counted_balance?: number;
  difference?: number;
  difference_reason?: string;
}

export interface CashierSummary {
  opening_balance: number;
  total_sales: number;
  total_refunds: number;
  total_expenses: number;
  total_sangrias: number;
  total_reinforcements: number;
  expected_balance: number;
  by_method: Record<PaymentMethod, number>;
}
