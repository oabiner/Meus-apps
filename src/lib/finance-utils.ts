
import { FinancialTransaction, CashierSummary, FinancialTransactionType, PaymentMethod } from '../types/finance';

export function calculateCashierSummary(
  openingBalance: number,
  transactions: FinancialTransaction[]
): CashierSummary {
  const summary: CashierSummary = {
    opening_balance: openingBalance,
    total_sales: 0,
    total_refunds: 0,
    total_expenses: 0,
    total_sangrias: 0,
    total_reinforcements: 0,
    expected_balance: openingBalance,
    by_method: {
      cash: 0,
      pix: 0,
      credit_card: 0,
      debit_card: 0,
      voucher: 0,
      internal: 0,
      other: 0,
    },
  };

  transactions.forEach((t) => {
    if (t.deleted) return;

    const amount = Number(t.amount);

    switch (t.type) {
      case 'sale':
        summary.total_sales += amount;
        summary.expected_balance += amount;
        summary.by_method[t.payment_method] = (summary.by_method[t.payment_method] || 0) + amount;
        break;
      case 'refund':
        summary.total_refunds += amount;
        summary.expected_balance -= amount;
        summary.by_method[t.payment_method] = (summary.by_method[t.payment_method] || 0) - amount;
        break;
      case 'expense':
        summary.total_expenses += amount;
        summary.expected_balance -= amount;
        break;
      case 'sangria':
        summary.total_sangrias += amount;
        summary.expected_balance -= amount;
        break;
      case 'reinforcement':
        summary.total_reinforcements += amount;
        summary.expected_balance += amount;
        break;
      case 'opening_balance':
        // Already accounted for in initial_balance parameter
        break;
      case 'closing_adjustment':
        summary.expected_balance += amount;
        break;
    }
  });

  return summary;
}

export function calculateExpectedBalance(
  openingBalance: number,
  totals: {
    sales: number;
    refunds: number;
    expenses: number;
    sangrias: number;
    reinforcements: number;
  }
): number {
  return (
    openingBalance +
    totals.sales +
    totals.reinforcements -
    (totals.sangrias + totals.expenses + totals.refunds)
  );
}

export function calculateDifference(expected: number, counted: number): number {
  return counted - expected;
}

export function normalizePaymentMethod(method: string): PaymentMethod {
  if (!method) return 'other';
  const m = method.toLowerCase();
  if (m.includes('dinheiro') || m.includes('cash')) return 'cash';
  if (m.includes('pix')) return 'pix';
  if (m.includes('credito') || m.includes('crédito') || m.includes('credit')) return 'credit_card';
  if (m.includes('debito') || m.includes('débito') || m.includes('debit')) return 'debit_card';
  if (m.includes('voucher') || m.includes('vale')) return 'voucher';
  if (m.includes('internal') || m.includes('interno')) return 'internal';
  return 'other';
}

export function getPaymentLabel(method: string): string {
  const m = normalizePaymentMethod(method);
  switch (m) {
    case 'cash': return 'Dinheiro';
    case 'pix': return 'PIX';
    case 'credit_card': return 'Crédito';
    case 'debit_card': return 'Débito';
    case 'voucher': return 'Voucher';
    case 'internal': return 'Interno';
    default: return 'Outro';
  }
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Math.round((value || 0) * 100) / 100);
}
