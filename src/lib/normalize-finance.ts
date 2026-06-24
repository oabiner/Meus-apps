import { normalizePaymentMethod } from './finance-utils';

export function normalizeTransaction(t: any) {
  return {
    id: t.id,
    session_id: t.session_id || t.sessionId || '',
    type:
      t.type === 'income'
        ? 'reinforcement'
        : t.type,

    amount: Number(t.amount || 0),

    description: t.description || '',

    payment_method: normalizePaymentMethod(
      t.payment_method ||
      t.method ||
      'cash'
    ),

    operator_name:
      t.operator_name ||
      t.operator ||
      'Sistema',

    created_at:
      t.created_at ||
      t.createdAt ||
      t.timestamp ||
      new Date().toISOString(),

    deleted:
      typeof t.deleted === 'number'
        ? t.deleted
        : (t.deleted === true ? 1 : 0),
  };
}
