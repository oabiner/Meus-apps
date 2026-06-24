import { normalizeTransaction } from './normalize-finance';

export function calculateCashierSummary(
  rawTransactions: any[],
  openingBalance = 0
) {
  const transactions =
    (Array.isArray(rawTransactions)
      ? rawTransactions
      : []
    )
    .map(normalizeTransaction)
    .filter(t => t.deleted === 0);

  const cashSales = transactions
    .filter(
      (t) =>
        t.type === 'sale' &&
        t.payment_method === 'cash'
    )
    .reduce((s, t) => s + t.amount, 0);

  const pixSales = transactions
    .filter(
      (t) =>
        t.type === 'sale' &&
        t.payment_method === 'pix'
    )
    .reduce((s, t) => s + t.amount, 0);

  const creditSales = transactions
    .filter(
      (t) =>
        t.type === 'sale' &&
        t.payment_method === 'credit_card'
    )
    .reduce((s, t) => s + t.amount, 0);

  const debitSales = transactions
    .filter(
      (t) =>
        t.type === 'sale' &&
        t.payment_method === 'debit_card'
    )
    .reduce((s, t) => s + t.amount, 0);

  const cardSales = creditSales + debitSales;

  const voucherSales = transactions
    .filter(
      (t) =>
        t.type === 'sale' &&
        t.payment_method === 'voucher'
    )
    .reduce((s, t) => s + t.amount, 0);

  const sangria = transactions
    .filter((t) => t.type === 'sangria')
    .reduce((s, t) => s + t.amount, 0);

  const reinforcement = transactions
    .filter((t) => t.type === 'reinforcement')
    .reduce((s, t) => s + t.amount, 0);

  const expenses = transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        t.payment_method === 'cash'
    )
    .reduce((s, t) => s + t.amount, 0);

  const refunds = transactions
    .filter(
      (t) =>
        t.type === 'refund' &&
        t.payment_method === 'cash'
    )
    .reduce((s, t) => s + t.amount, 0);

  const expectedCash =
    openingBalance +
    cashSales +
    reinforcement -
    sangria -
    expenses -
    refunds;

  const totalSales = cashSales + pixSales + cardSales + voucherSales;

  return {
    openingBalance,
    totalSales,
    cashSales,
    pixSales,
    creditSales,
    debitSales,
    cardSales,
    voucherSales,
    sangria,
    reinforcement,
    expenses,
    refunds,
    expectedCash,
    transactions // normalized list
  };
}
