import React, { useState } from 'react';
import { CreditCard, Clock, Plus, Trash2, Check, CheckCircle2, DollarSign, Edit, Receipt, PlusCircle, ArrowDownCircle, Info, Calculator, Download, Printer, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { Button, Input, cn } from './ui';
import { normalizeTransaction } from '../lib/normalize-finance';
import { calculateCashierSummary } from '../lib/cashier-calculations';
import { formatBRL as formatCurrency, normalizePaymentMethod } from '../lib/finance-utils';
import { generateCashierPDF } from '../utils/pdf';

export { normalizePaymentMethod as normalizeMethod };

export function AccountsPayableSection({ accountsPayable, sendWS, cashierStatus, currentUser }: any) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const pendingAccounts = accountsPayable.filter((a: any) => a.status === 'pending');
  const paidAccounts = accountsPayable.filter((a: any) => a.status === 'paid');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-rose-600" />
          <h3 className="text-lg font-semibold dark:text-zinc-100">Contas a Pagar</h3>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Nova Conta
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Clock className="h-4 w-4" /> Pendentes ({pendingAccounts.length})
          </h4>
          <div className="space-y-3">
            {pendingAccounts.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-zinc-100 rounded-2xl text-zinc-400 text-sm">
                Nenhuma conta pendente
              </div>
            ) : (
              pendingAccounts.map((account: any) => (
                <div key={account.id} className="p-4 rounded-xl border border-zinc-200 bg-white dark:bg-zinc-900 dark:border-zinc-800 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-zinc-100">{account.description}</p>
                      <p className="text-xs text-zinc-500">{account.category}</p>
                    </div>
                    <p className="font-black text-rose-600">{formatCurrency(account.amount)}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-50 dark:border-zinc-800">
                    <p className="text-xs text-zinc-500">Vencimento: {format(new Date(account.due_date), 'dd/MM/yyyy')}</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          if (confirm('Deseja excluir esta conta?')) {
                            sendWS('ACCOUNTS_PAYABLE_DELETE', { id: account.id });
                          }
                        }}
                        className="p-1.5 text-zinc-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-8 text-xs gap-1"
                        onClick={() => {
                          if (confirm(`Confirmar pagamento de ${formatCurrency(account.amount)}?`)) {
                            sendWS('ACCOUNTS_PAYABLE_PAY', { 
                              id: account.id, 
                              sessionId: cashierStatus.status === 'open' ? cashierStatus.sessionId : null,
                              userId: currentUser.id,
                              username: currentUser.username
                            });
                            if (cashierStatus.status !== 'open') {
                              toast('Conta marcada como paga, mas não registrada no caixa (caixa fechado).', { icon: 'ℹ️' });
                            } else {
                              toast.success('Conta paga e registrada no caixa!');
                            }
                          }
                        }}
                      >
                        <Check className="h-3 w-3" /> Pagar
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Pagas ({paidAccounts.length})
          </h4>
          <div className="space-y-3 opacity-60">
            {paidAccounts.slice(0, 5).map((account: any) => (
              <div key={account.id} className="p-3 rounded-xl border border-zinc-100 bg-zinc-50 dark:bg-zinc-800/30 dark:border-zinc-800 flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{account.description}</p>
                  <p className="text-[10px] text-zinc-500">Pago em: {format(new Date(account.timestamp), 'dd/MM/yyyy')}</p>
                </div>
                <p className="text-sm font-bold text-zinc-500">{formatCurrency(account.amount)}</p>
              </div>
            ))}
            {paidAccounts.length > 5 && (
              <p className="text-center text-[10px] text-zinc-400">Mostrando as últimas 5 contas pagas</p>
            )}
          </div>
        </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="text-xl font-bold dark:text-zinc-100">Nova Conta a Pagar</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              sendWS('ACCOUNTS_PAYABLE_ADD', {
                description: formData.get('description'),
                amount: parseFloat(formData.get('amount') as string),
                dueDate: formData.get('due_date'),
                category: formData.get('category')
              });
              setIsAddModalOpen(false);
              toast.success('Conta adicionada!');
            }} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium dark:text-zinc-400">Descrição</label>
                <Input name="description" placeholder="Ex: Aluguel, Fornecedor de Bebidas" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-400">Valor (R$)</label>
                  <Input name="amount" type="number" step="0.01" placeholder="0,00" required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-400">Vencimento</label>
                  <Input name="due_date" type="date" required />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium dark:text-zinc-400">Categoria</label>
                <select name="category" className="w-full rounded-xl border border-zinc-200 p-2.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
                  <option value="Fixo">Custo Fixo</option>
                  <option value="Variável">Custo Variável</option>
                  <option value="Fornecedor">Fornecedor</option>
                  <option value="Pessoal">Pessoal / Salários</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsAddModalOpen(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1">Salvar Conta</Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export function FinanceSection({ currentUser, cashierStatus, cashierTransactions = [], sendWS, hasPermission, printFinancialSlip }: any) {
  const [initialBalance, setInitialBalance] = useState('');
  const [sangriaAmount, setSangriaAmount] = useState('');
  const [sangriaDesc, setSangriaDesc] = useState('');
  const [reforcoAmount, setReforcoAmount] = useState('');
  const [reforcoDesc, setReforcoDesc] = useState('');
  const [transactionType, setTransactionType] = useState<'income' | 'expense'>('expense');
  const [showDetails, setShowDetails] = useState(false);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [countedBalance, setCountedBalance] = useState('');
  const [differenceReason, setDifferenceReason] = useState('');

  const handleOpenCashier = (e: React.FormEvent) => {
    e.preventDefault();
    sendWS('CASHIER_OPEN', { 
      userId: currentUser.id, 
      username: currentUser.username, 
      initialBalance: parseFloat(initialBalance) || 0 
    });
    toast.success('Caixa aberto!');
  };

  const summary = calculateCashierSummary(cashierTransactions, Number(cashierStatus.initialBalance || cashierStatus.initial_balance || 0));
  const currentBalance = summary.expectedCash;

  const handleCloseCashier = () => {
    const billing = {
      total: summary.totalSales,
      reinforcements: summary.reinforcement,
      byMethod: {
        cash: summary.cashSales,
        pix: summary.pixSales,
        credit_card: summary.creditSales,
        debit_card: summary.debitSales,
        voucher: summary.voucherSales
      },
      expenses: summary.expenses + summary.sangria + summary.refunds
    };

    const sessionForPDF = {
      ...cashierStatus,
      opened_at: cashierStatus.opened_at || cashierStatus.openedAt || new Date().toISOString(),
      opened_by_name: currentUser.username,
      initial_balance: Number(cashierStatus.initialBalance || cashierStatus.initial_balance || 0)
    };

    if (typeof generateCashierPDF === 'function') {
      generateCashierPDF(sessionForPDF, summary.transactions, billing);
    }
    
    sendWS('CASHIER_CLOSE', { 
      userId: currentUser.id, 
      username: currentUser.username, 
      sessionId: cashierStatus.sessionId,
      countedBalance: parseFloat(countedBalance) || 0,
      differenceReason: differenceReason || null
    });
    setIsClosingModalOpen(false);
    setCountedBalance('');
    setDifferenceReason('');
    toast.success('Caixa fechado com sucesso!');
  };

  const handleTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (transactionType === 'expense') {
      sendWS('CASHIER_TRANSACTION', { 
        sessionId: cashierStatus.sessionId, 
        userId: currentUser.id, 
        username: currentUser.username, 
        amount: parseFloat(sangriaAmount), 
        description: sangriaDesc,
        type: 'sangria',
        method: 'cash'
      });
      setSangriaAmount('');
      setSangriaDesc('');
      toast.success('Sangria registrada!');
    } else {
      sendWS('CASHIER_TRANSACTION', { 
        sessionId: cashierStatus.sessionId, 
        userId: currentUser.id, 
        username: currentUser.username, 
        amount: parseFloat(reforcoAmount), 
        description: reforcoDesc,
        type: 'reinforcement',
        method: 'cash'
      });
      setReforcoAmount('');
      setReforcoDesc('');
      toast.success('Reforço realizado!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-emerald-600" />
          <h3 className="text-lg font-semibold dark:text-zinc-100">Financeiro e Caixa</h3>
        </div>
      </div>

      {cashierStatus.status === 'open' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-xl shadow-emerald-900/20 p-8 sm:p-10">
              <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-white/10 blur-3xl mix-blend-overlay" />
              <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-emerald-900/20 blur-2xl mix-blend-overlay" />
              
              <div className="relative z-10 flex flex-col sm:flex-row gap-6 justify-between items-start">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-800/40 border border-white/20 px-3 py-1 mb-6 backdrop-blur-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300"></span>
                    </span>
                    <span className="text-xs font-semibold tracking-wider uppercase text-emerald-100">Caixa Aberto</span>
                  </div>
                  
                  <h4 className="text-sm font-medium opacity-80 mb-1 uppercase tracking-wider">Total Entradas (Vendas)</h4>
                  <p className="text-5xl font-black tracking-tight">{formatCurrency(summary.totalSales)}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowDetails(true)}
                  className="bg-white/10 border-white/20 hover:bg-white/20 text-white text-xs backdrop-blur-md px-4 py-2 rounded-full transition-all hover:scale-105"
                >
                  <Info className="h-3 w-3 mr-2" /> Mais Detalhes
                </Button>
              </div>

              <div className="relative z-10 mt-8 grid grid-cols-4 gap-2 sm:gap-4 pt-6 border-t border-white/10">
                <div>
                  <p className="text-[10px] sm:text-xs font-medium text-emerald-200 uppercase tracking-wider">Início</p>
                  <p className="text-sm sm:text-lg font-bold">{formatCurrency(Number(cashierStatus.initial_balance || cashierStatus.initialBalance || 0))}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-medium text-emerald-200 uppercase tracking-wider">Reforços</p>
                  <p className="text-sm sm:text-lg font-bold">+{formatCurrency(summary.reinforcement)}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-medium text-emerald-200 uppercase tracking-wider">Saldo Atual</p>
                  <p className="text-sm sm:text-lg font-bold text-emerald-50">{formatCurrency(currentBalance)}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-medium text-emerald-200 uppercase tracking-wider">Saídas</p>
                  <p className="text-sm sm:text-lg font-bold text-rose-200">-{formatCurrency(summary.expenses + summary.sangria + summary.refunds)}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 p-5 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-lg dark:bg-amber-900/30 dark:text-amber-400">
                    <ArrowDownCircle className="h-4 w-4" />
                  </div>
                  <h4 className="font-bold dark:text-zinc-100">Sangria</h4>
                </div>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!sangriaAmount) return;
                  if (parseFloat(sangriaAmount) > currentBalance) {
                     alert("Erro: O valor da sangria não pode ser maior que o saldo em caixa (físico/dinheiro)!");
                     return;
                  }
                  sendWS('CASHIER_TRANSACTION', { 
                    sessionId: cashierStatus.sessionId, 
                    userId: currentUser.id, 
                    username: currentUser.username, 
                    amount: parseFloat(sangriaAmount), 
                    description: sangriaDesc || 'Retirada',
                    type: 'sangria',
                    method: 'internal'
                  });
                  setSangriaAmount('');
                  setSangriaDesc('');
                  toast.success('Sangria registrada!');
                }} className="space-y-3">
                  <Input type="number" step="0.01" value={sangriaAmount} onChange={(e) => setSangriaAmount(e.target.value)} placeholder="0.00" required />
                  <Input value={sangriaDesc} onChange={(e) => setSangriaDesc(e.target.value)} placeholder="Motivo" />
                  <Button type="submit" variant="danger" className="w-full">Retirar</Button>
                </form>
              </div>

              <div className="rounded-xl border border-zinc-200 p-5 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg dark:bg-emerald-900/30 dark:text-emerald-400">
                    <PlusCircle className="h-4 w-4" />
                  </div>
                  <h4 className="font-bold dark:text-zinc-100">Reforço</h4>
                </div>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!reforcoAmount) return;
                  sendWS('CASHIER_TRANSACTION', { 
                    sessionId: cashierStatus.sessionId, 
                    userId: currentUser.id, 
                    username: currentUser.username, 
                    amount: parseFloat(reforcoAmount), 
                    description: reforcoDesc || 'Acréscimo',
                    type: 'reinforcement',
                    method: 'internal'
                  });
                  setReforcoAmount('');
                  setReforcoDesc('');
                  toast.success('Reforço realizado!');
                }} className="space-y-3">
                  <Input type="number" step="0.01" value={reforcoAmount} onChange={(e) => setReforcoAmount(e.target.value)} placeholder="0.00" required />
                  <Input value={reforcoDesc} onChange={(e) => setReforcoDesc(e.target.value)} placeholder="Origem" />
                  <Button type="submit" className="w-full bg-emerald-600 dark:bg-emerald-700">Compor Caixa</Button>
                </form>
              </div>
            </div>
            
            <Button variant="danger" className="w-full h-12 text-sm font-bold" onClick={() => setIsClosingModalOpen(true)}>
              Encerrar Turno (Fechar Caixa)
            </Button>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col h-[600px]">
            <h4 className="font-bold mb-4 flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
              <Receipt className="h-4 w-4" /> Transações Recentes
            </h4>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
              {summary.transactions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 text-sm opacity-50">
                  <Receipt className="h-10 w-10 mb-2 opacity-20" />
                  Nenhuma transação ainda
                </div>
              ) : (
                summary.transactions.map((t: any) => (
                  <div key={t.id} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-sm group flex items-start justify-between transition-all hover:border-zinc-200 dark:hover:border-zinc-700">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {t.type === 'expense' ? 'Retirada' : t.type === 'reinforcement' ? 'Aporte' : t.type === 'sangria' ? 'Sangria' : t.type === 'refund' ? 'Estorno' : 'Venda'}
                        </p>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                          {(t.payment_method || t.method) === 'cash' ? 'Dinheiro' : 
                           (t.payment_method || t.method) === 'pix' ? 'PIX' : 
                           (t.payment_method || t.method) === 'credit_card' ? 'Crédito' : 
                           (t.payment_method || t.method) === 'debit_card' ? 'Débito' : 
                           (t.payment_method || t.method) === 'voucher' ? 'Voucher' : 
                           (t.payment_method || t.method) === 'internal' ? 'Interno' : 
                           (t.payment_method || t.method) === 'dinheiro' ? 'Dinheiro' :
                           (t.payment_method || t.method) === 'cartao_debito' ? 'Débito' :
                           (t.payment_method || t.method) === 'cartao_credito' ? 'Crédito' : 'Outro'}
                        </span>
                      </div>
                      {t.description && <p className="text-xs text-zinc-500 mt-0.5">{t.description}</p>}
                      <p className="text-[10px] text-zinc-400 mt-1">{format(new Date(t.created_at), 'HH:mm')} • {t.operator_name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className={cn("font-bold", (t.type === 'expense' || t.type === 'sangria' || t.type === 'refund') ? "text-rose-600" : "text-emerald-600")}>
                        {(t.type === 'expense' || t.type === 'sangria' || t.type === 'refund') ? '-' : '+'}{formatCurrency(t.amount)}
                      </p>
                      {hasPermission('finance_edit') && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setEditingTransaction(t)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-all text-zinc-400 text-xs flex items-center gap-1"
                          >
                            <Edit className="h-3 w-3" /> Editar
                          </button>
                          <button 
                            onClick={() => {
                              if (confirm('Deseja realmente excluir esta transação?')) {
                                sendWS('CASHIER_TRANSACTION_DELETE', { 
                                  transactionId: t.id,
                                  userId: currentUser.id,
                                  username: currentUser.username
                                });
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded transition-all text-rose-500 text-xs flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" /> Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-zinc-50 dark:bg-zinc-800/20 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 flex flex-col items-center justify-center text-center">
          <Calculator className="h-16 w-16 mb-4 text-emerald-500 opacity-50" />
          <h3 className="text-xl font-bold dark:text-zinc-100 mb-2">Caixa Fechado</h3>
          <p className="text-sm text-zinc-500 mb-8 max-w-md">Para iniciar as operações de venda, recebimentos e controle financeiro, você precisa abrir um novo caixa escolar ou de turno.</p>
          
          <form onSubmit={handleOpenCashier} className="w-full max-w-xs space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500 text-left block">Fundo de Caixa Inicial (Opcional)</label>
              <Input 
                autoFocus
                type="number" 
                step="0.01" 
                value={initialBalance} 
                onChange={(e) => setInitialBalance(e.target.value)} 
                placeholder="R$ 0,00" 
                className="text-center h-12 text-lg font-bold"
              />
            </div>
            <Button type="submit" className="w-full h-12 text-sm">Abrir Caixa Agora</Button>
          </form>
        </div>
      )}

      {/* Editing Transaction Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-xl overflow-hidden"
          >
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold">Editar Transação</h3>
              <button onClick={() => setEditingTransaction(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-500">Valor</label>
                <Input 
                  type="number" 
                  step="0.01" 
                  defaultValue={editingTransaction.amount}
                  id="editTransactionAmount"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-500">Forma de Pagamento</label>
                <select 
                  id="editTransactionMethod"
                  defaultValue={editingTransaction.payment_method}
                  className="w-full h-10 px-3 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="cash">Dinheiro</option>
                  <option value="pix">PIX</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="debit_card">Cartão de Débito</option>
                  <option value="voucher">Voucher</option>
                  <option value="internal">Interno</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-500">Descrição</label>
                <Input 
                  defaultValue={editingTransaction.description}
                  id="editTransactionDesc"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-500">Motivo da Alteração (Obrigatório)</label>
                <Input 
                  id="editTransactionReason"
                  placeholder="Por que está alterando?"
                  required
                />
              </div>
              <Button onClick={() => {
                const amountInput = document.getElementById('editTransactionAmount') as HTMLInputElement;
                const descInput = document.getElementById('editTransactionDesc') as HTMLInputElement;
                const methodInput = document.getElementById('editTransactionMethod') as HTMLSelectElement;
                const reasonInput = document.getElementById('editTransactionReason') as HTMLInputElement;
                
                if (!reasonInput.value.trim()) {
                  toast.error('O motivo da alteração é obrigatório.');
                  return;
                }

                sendWS('CASHIER_TRANSACTION_UPDATE', {
                  id: editingTransaction.id,
                  amount: parseFloat(amountInput.value),
                  description: descInput.value,
                  payment_method: methodInput.value,
                  reason: reasonInput.value.trim(),
                  operator_name: currentUser.username,
                  userId: currentUser.id,
                  username: currentUser.username
                });
                setEditingTransaction(null);
                toast.success('Transação atualizada');
              }} className="w-full">Salvar Alterações</Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Details/Close Modals simplified for extraction since they're large inline code */}
      <AnimatePresence>
        {(showDetails || isClosingModalOpen) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-zinc-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col border border-zinc-200 dark:border-zinc-800"
            >
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center dark:bg-emerald-900/30 dark:text-emerald-400">
                    {isClosingModalOpen ? <Calculator className="h-5 w-5" /> : <Info className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold dark:text-zinc-100">{isClosingModalOpen ? "Conferência e Fechamento" : "Detalhamento de Caixa"}</h3>
                    <p className="text-xs text-zinc-500">Operador atual: {currentUser.username}</p>
                  </div>
                </div>
                <button 
                  onClick={() => isClosingModalOpen ? setIsClosingModalOpen(false) : setShowDetails(false)} 
                  className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-zinc-50/30 dark:bg-zinc-900/20">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="bg-white dark:bg-zinc-800/50 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Informações
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-500">Abertura</span>
                        <span className="font-medium dark:text-zinc-300">{(cashierStatus?.opened_at || cashierStatus?.openedAt) ? format(new Date(cashierStatus.opened_at || cashierStatus.openedAt), "dd/MM 'às' HH:mm") : '-'}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-500">Fundo Inicial</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(Number(cashierStatus?.initial_balance || cashierStatus?.initialBalance || 0))}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-500">Total Vendas</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(summary.totalSales)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-500">Reforços de Caixa</span>
                        <span className="font-bold text-emerald-600">+{formatCurrency(summary.reinforcement)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm pb-2 border-b border-dashed border-zinc-200 dark:border-zinc-700">
                        <span className="text-zinc-500">Total Saídas</span>
                        <span className="font-bold text-rose-600">-{formatCurrency(summary.expenses + summary.sangria + summary.refunds)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm pt-1">
                        <span className="text-zinc-500">Saldo Estimado</span>
                        <span className="font-black text-lg text-emerald-600">{formatCurrency(currentBalance)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-800/50 rounded-2xl p-5 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                    <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Entradas por Método
                    </h4>
                    <div className="space-y-2">
                       <div className="flex justify-between items-center p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                         <span className="text-sm font-medium capitalize text-zinc-700 dark:text-zinc-300">Dinheiro</span>
                         <span className="text-sm font-bold text-emerald-600">{formatCurrency(summary.cashSales)}</span>
                       </div>
                       <div className="flex justify-between items-center p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                         <span className="text-sm font-medium capitalize text-zinc-700 dark:text-zinc-300">PIX</span>
                         <span className="text-sm font-bold text-emerald-600">{formatCurrency(summary.pixSales)}</span>
                       </div>
                       <div className="flex justify-between items-center p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                         <span className="text-sm font-medium capitalize text-zinc-700 dark:text-zinc-300">Crédito</span>
                         <span className="text-sm font-bold text-emerald-600">{formatCurrency(summary.creditSales)}</span>
                       </div>
                       <div className="flex justify-between items-center p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                         <span className="text-sm font-medium capitalize text-zinc-700 dark:text-zinc-300">Débito</span>
                         <span className="text-sm font-bold text-emerald-600">{formatCurrency(summary.debitSales)}</span>
                       </div>
                       {summary.voucherSales > 0 && (
                         <div className="flex justify-between items-center p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/50">
                           <span className="text-sm font-medium capitalize text-zinc-700 dark:text-zinc-300">Voucher</span>
                           <span className="text-sm font-bold text-emerald-600">{formatCurrency(summary.voucherSales)}</span>
                         </div>
                       )}
                       
                       <div className="flex justify-between items-center pt-3 mt-3 border-t border-zinc-100 dark:border-zinc-800">
                         <span className="text-sm font-bold text-zinc-500">Total Vendas</span>
                         <span className="text-sm font-black text-emerald-600">{formatCurrency(summary.totalSales)}</span>
                       </div>
                    </div>
                  </div>
                </div>

                {!isClosingModalOpen && (
                  <div className="pt-4 flex justify-end">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        const billing = {
                          total: summary.totalSales,
                          reinforcements: summary.reinforcement,
                          byMethod: {
                            cash: summary.cashSales,
                            pix: summary.pixSales,
                            credit_card: summary.creditSales,
                            debit_card: summary.debitSales,
                            voucher: summary.voucherSales
                          },
                          expenses: summary.expenses + summary.sangria + summary.refunds
                        };
                        const sessionForPDF = {
                          ...cashierStatus,
                          opened_at: cashierStatus.opened_at || cashierStatus.openedAt || new Date().toISOString(),
                          opened_by_name: currentUser.username,
                          initial_balance: Number(cashierStatus.initial_balance || cashierStatus.initialBalance || 0)
                        };
                        if (typeof generateCashierPDF === 'function') {
                          generateCashierPDF(sessionForPDF, summary.transactions, billing);
                        }
                      }}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" /> Relatório Parcial
                    </Button>
                  </div>
                )}

                {isClosingModalOpen && (
                  <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl p-6 border border-emerald-100/50 dark:border-emerald-800/30 space-y-4">
                    <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                      <Calculator className="h-4 w-4" /> Conferência de Valores
                    </h4>
                    
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-tight">Valor Contado em Dinheiro (R$)</label>
                        <Input 
                          autoFocus
                          type="number" 
                          step="0.01" 
                          placeholder="0,00"
                          value={countedBalance}
                          onChange={(e) => setCountedBalance(e.target.value)}
                          className="h-10 text-base font-bold"
                        />
                        <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                          <Info className="h-3 w-3" /> Valor físico presente na gaveta
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-tight">Justificativa de Diferença</label>
                        <Input 
                          placeholder="Opcional se houver diferença"
                          value={differenceReason}
                          onChange={(e) => setDifferenceReason(e.target.value)}
                        />
                      </div>
                    </div>

                    {countedBalance && (
                      <div className={cn(
                        "p-3 rounded-xl flex items-center justify-between text-sm transition-all",
                        (Number(countedBalance || 0) - Number(currentBalance)) === 0 
                          ? "bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" 
                          : "bg-rose-100/50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400"
                      )}>
                        <span className="font-medium">Diferença de Caixa:</span>
                        <span className="font-black text-base">
                          {formatCurrency(Number(countedBalance || 0) - Number(currentBalance))}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-4 pt-4">
                      <Button variant="outline" className="flex-1 py-4 font-bold" onClick={() => setIsClosingModalOpen(false)}>
                        Cancelar
                      </Button>
                      <Button className="flex-[2] py-4 font-black bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20" onClick={handleCloseCashier}>
                        CONFIRMAR FECHAMENTO
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
