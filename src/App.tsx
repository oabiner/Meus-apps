import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  Settings, 
  LogOut, 
  Plus, 
  Trash2, 
  Edit2, 
  UserPlus, 
  CheckCircle2, 
  CheckSquare,
  AlertCircle,
  Users,
  Shield,
  Edit3,
  ChevronUp,
  Globe,
  Activity,
  Cloud,
  AlertTriangle,
  DollarSign,
  X,
  ChevronRight,
  ChevronLeft,
  User as UserIcon,
  Tags,
  Menu as MenuIcon,
  RefreshCw,
  Download,
  Upload,
  Moon,
  Sun,
  Search,
  Minus,
  MessageSquare,
  MessageSquareText,
  StickyNote,
  Bell,
  Volume2,
  ChefHat,
  UserCircle,
  Database,
  History,
  Save,
  ShieldCheck,
  Sparkles,
  Hash,
  Home,
  Trees,
  MoveRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Printer,
  CreditCard,
  Clock,
  Check,
  MapPin,
  Coffee,
  Beer,
  Utensils,
  Waves,
  Umbrella,
  Star,
  Heart,
  Smartphone,
  Layers,
  Battery,
  Info,
  Store,
  ShoppingCart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { v4 as uuidv4 } from 'uuid';
import { 
  User, 
  Table, 
  TableStatus, 
  MenuItem, 
  OrderItem, 
  WSEvent 
} from './types';
// Removed Firebase imports

import { AccountsPayableSection, FinanceSection } from './components/FinanceComponents';
import { MenuTab } from './components/MenuTab';
import { TableManagement } from './components/TableManagement';
import { Button, Input, Modal, ConfirmModal } from './components/ui';
import { formatBRL as formatCurrency, normalizePaymentMethod as normalizeMethod, getPaymentLabel } from './lib/finance-utils';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Helpers ---

const generateHistoryPDF = (events: any[]) => {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text('Relatório de Histórico - Deck Serrinha', 14, 22);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, 14, 30);

  const tableData = events.map(e => [
    format(new Date(e.timestamp), 'dd/MM/yyyy HH:mm'),
    e.table_id ? `Mesa ${e.table_id}` : '-',
    e.username,
    e.action,
    e.details
  ]);

  autoTable(doc, {
    startY: 35,
    head: [['Data', 'Mesa', 'Usuário', 'Ação', 'Detalhes']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [16, 185, 129] },
  });

  doc.save(`historico_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
  toast.success('PDF do histórico gerado com sucesso!');
};

// export { normalizeMethod }; // already using imported one


const printQueue: string[] = [];
let isPrinting = false;

const processPrintQueue = () => {
  if (isPrinting || printQueue.length === 0) return;
  
  isPrinting = true;
  const htmlContent = printQueue.shift();
  if (!htmlContent) {
    isPrinting = false;
    return;
  }

  const root = document.getElementById('root');
  let container = document.getElementById('print-container');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'print-container';
    document.body.appendChild(container);
  }
  
  // Inject receipt content
  container.innerHTML = htmlContent;
  
  // Directly hide the main application to prevent "printing the code/UI" on mobile Chrome
  if (root) {
    root.style.display = 'none';
  }
  
  // Ensure the container is visible
  container.style.display = 'block';
  
  // Force browser layout update
  container.offsetHeight;

  const restoreApp = () => {
    if (root) {
      // Clear the inline 'none' style so it reverts to its original CSS block/flex
      root.style.display = ''; 
    }
    if (container) {
      container.style.display = 'none';
      container.innerHTML = '';
    }
  };

  setTimeout(() => {
    // Attempt standard print
    window.print();
    
    // Listen for afterprint to restore UI, with a fallback timeout
    let restored = false;
    let fallbackTimer: NodeJS.Timeout;

    const afterPrintHandler = () => {
      if (!restored) {
        restored = true;
        restoreApp();
        window.removeEventListener('afterprint', afterPrintHandler);
        document.removeEventListener('visibilitychange', visibilityHandler);
        clearTimeout(fallbackTimer);
        
        isPrinting = false;
        // Process next item in queue with a small delay
        setTimeout(processPrintQueue, 500);
      }
    };
    
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible' && !restored) {
        afterPrintHandler();
      }
    };

    window.addEventListener('afterprint', afterPrintHandler);
    document.addEventListener('visibilitychange', visibilityHandler);
    
    // Ultimate fallback if neither fires (e.g. user cancels very quickly or browser is weird)
    // Wait a generous amount of time before forcing restore so they have time to see the print dialog.
    fallbackTimer = setTimeout(afterPrintHandler, 5000);
  }, 400); // Wait enough time for the DOM layout to flush
};

const executePrint = (htmlContent: string) => {
  printQueue.push(htmlContent);
  processPrintQueue();
};

const renderPrinterHeader = (settings: any) => {
  if (!settings?.printer_header) return '';
  return `<div style="text-align: center; margin-bottom: 10px; font-weight: bold; white-space: pre-wrap; font-size: 14px; border-bottom: 1px solid black; padding-bottom: 5px;">${settings.printer_header}</div>`;
};

export const printKitchenReceipt = (tableNumber: string, operator: string, itemsToPrint: Array<{ name: string, quantity: number, observation?: string, group?: string, customerName?: string }>, settings?: any, title: string = 'COMANDA - COZINHA') => {
  if (!itemsToPrint || itemsToPrint.length === 0) return;

  const aggregatedItems = itemsToPrint.reduce((acc: any[], item) => {
    const existing = acc.find(i => i.name === item.name && i.observation === item.observation && i.group === item.group);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      acc.push({ ...item });
    }
    return acc;
  }, []);

  const now = new Date();
  const timeStr = now.toLocaleTimeString();
  const dateStr = now.toLocaleDateString();

  const customerName = aggregatedItems[0]?.customerName;

  const html = `
    <div style="font-family: monospace; width: 80mm; margin: 0 auto; padding: 4mm; color: black; font-size: 14px; background: white;">
      <h2 style="text-align: center; margin: 0 0 10px 0; font-size: 16px; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid black; padding-bottom: 5px;">${title}</h2>
      <div style="text-align: center; margin-bottom: 10px; font-size: 12px; border-bottom: 1px dashed black; padding-bottom: 5px;">
        Mesa: <span style="font-size: 18px; text-decoration: underline;">${tableNumber}</span><br/>
        ${customerName ? `Cliente: <span style="font-weight: bold;">${customerName}</span><br/>` : ''}
        Data: ${dateStr} ${timeStr}<br/>
        Vendedor: ${operator}
      </div>
      ${aggregatedItems.map(item => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold;">
          <span>${item.quantity}x ${item.name} ${item.group ? `<span style="font-size: 11px; font-weight: normal;">-(${item.group})</span>` : ''}</span>
        </div>
        ${item.observation ? `<div style="padding-left: 10px; font-size: 14px; font-weight: bold; font-style: italic; background: #f9f9f9; padding: 2px 5px; margin: 2px 0; border-left: 3px solid #666;">Obs: ${item.observation}</div>` : ''}
      `).join('')}
      <div style="margin-top: 10px; border-top: 1px dashed black; padding-top: 5px; text-align: center; font-size: 10px;">
        -- Fim da Comanda --
      </div>
    </div>
  `;

  executePrint(html);
};

export const printTableBill = (table: any, orders: any[], operator: string, settings?: any, title: string = 'CUPOM NÃO FISCAL', serviceFeePercentage: number = 10, paymentMethods?: string[], customServiceFee?: number, discount?: number) => {
  if (!table) return;

  const aggregatedOrders = orders.reduce((acc: any[], order) => {
    const existing = acc.find(o => o.item_name === order.item_name && o.item_price === order.item_price && (o.observation || '') === (order.observation || ''));
    if (existing) {
      existing.quantity += order.quantity;
    } else {
      acc.push({ ...order });
    }
    return acc;
  }, []);

  const subtotal = orders.reduce((acc, o) => acc + (o.item_price * o.quantity), 0);
  const serviceFee = customServiceFee !== undefined ? customServiceFee : (subtotal * (serviceFeePercentage / 100));
  const finalDiscount = discount || 0;
  const total = subtotal + serviceFee - finalDiscount;
  const now = new Date();
  
  const isBalcao = table.number === -1 || table.type === 'balcao';
  const tableDisplayLine = isBalcao 
    ? `Balcão ${table.customer_name ? `(${table.customer_name})` : ''}<br/>`
    : `Mesa: ${table.number} ${table.customer_name ? `(${table.customer_name})` : ''}<br/>`;

  const html = `
    <div style="font-family: monospace; width: 80mm; margin: 0 auto; padding: 4mm; color: black; background: white;">
      ${renderPrinterHeader(settings)}
      <div style="text-align: center;">
        <h2 style="margin: 0 0 5px 0; font-size: 16px; text-transform: uppercase; border-bottom: 2px solid black; padding-bottom: 5px; margin-bottom: 10px;">${title}</h2>
        <div style="border-bottom: 1px dashed black; margin-bottom: 10px; padding-bottom: 5px; font-size: 11px;">
          ${tableDisplayLine}
          Data: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}<br/>
          Vendedor: ${operator}
        </div>
      </div>
      ${aggregatedOrders.map(o => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 12px;">
          <span>${o.quantity}x ${o.item_name}</span>
          <span>${formatCurrency(o.item_price * o.quantity)}</span>
        </div>
      `).join('')}
      <div style="border-top: 1px dashed black; margin-top: 10px; padding-top: 5px; font-weight: bold; font-size: 12px; display: flex; justify-content: space-between; margin-bottom: 2px;">
        <span>SUBTOTAL</span>
        <span>${formatCurrency(subtotal)}</span>
      </div>
      ${serviceFee > 0 ? `
      <div style="font-weight: bold; font-size: 12px; display: flex; justify-content: space-between; margin-bottom: 4px;">
        <span>TAXA DE SERVIÇO</span>
        <span>${formatCurrency(serviceFee)}</span>
      </div>
      ` : ''}
      ${finalDiscount > 0 ? `
      <div style="font-weight: bold; font-size: 12px; display: flex; justify-content: space-between; margin-bottom: 4px; color: #444;">
        <span>DESCONTO</span>
        <span>- ${formatCurrency(finalDiscount)}</span>
      </div>
      ` : ''}
      <div style="border-top: 2px solid black; margin-top: 5px; padding-top: 5px; font-weight: bold; font-size: 15px; display: flex; justify-content: space-between; margin-bottom: 3px;">
        <span>TOTAL GERAL</span>
        <span>${formatCurrency(total)}</span>
      </div>
      ${paymentMethods && paymentMethods.length > 0 ? `
      <div style="border-top: 1px dashed black; margin-top: 5px; padding-top: 5px; text-align: center; font-size: 12px;">
        <strong>PAGO EM:</strong><br/>
        ${paymentMethods.map(m => getPaymentLabel(m).toUpperCase()).join(' | ')}
      </div>
      ` : ''}
      <div style="margin-top: 15px; text-align: center; font-size: 10px; border-top: 1px solid #eee; padding-top: 5px; white-space: pre-wrap;">
        ${settings?.printer_footer || 'Obrigado pela preferência!\nVolte Sempre!'}
      </div>
    </div>
  `;

  executePrint(html);
};

export const printFinancialSlip = (title: string, data: any, operator: string, settings?: any) => {
  const now = new Date();

  const html = `
    <div style="font-family: monospace; width: 80mm; margin: 0 auto; padding: 4mm; color: black; background: white;">
      <h2 style="text-align: center; border-bottom: 2px solid black; padding-bottom: 5px; font-size: 18px; margin-bottom: 10px; text-transform: uppercase;">${title}</h2>
      <div style="display: flex; justify-content: space-between; margin: 5px 0; font-size: 13px;"><span>Data/Hora:</span> <span>${now.toLocaleDateString()} ${now.toLocaleTimeString()}</span></div>
      <div style="display: flex; justify-content: space-between; margin: 5px 0; font-size: 13px;"><span>Operador:</span> <span>${operator}</span></div>
      <hr style="margin: 10px 0; border: 1px dashed black;"/>
      ${Object.entries(data).map(([key, val]: [string, any]) => {
        if (typeof val === 'object' && val !== null) {
           return `
             <div style="margin-top: 10px; margin-bottom: 5px; font-size: 15px; font-weight: bold; border-bottom: 1px solid #ccc;">${key.toUpperCase()}</div>
             ${Object.entries(val).map(([m, low]) => `
               <div style="display: flex; justify-content: space-between; margin: 5px 0; font-size: 14px; padding-left: 5px;"><span>${getPaymentLabel(m).toUpperCase()}</span> <span>${formatCurrency(Number(low))}</span></div>
             `).join('')}
           `;
        }
        const valNum = isNaN(Number(val)) ? val : Number(val);
        const valStr = typeof valNum === 'number' ? formatCurrency(valNum) : valNum;
        return `<div style="display: flex; justify-content: space-between; margin: 5px 0; font-size: 14px; font-weight: bold;"><span>${key.toUpperCase()}:</span> <span>${valStr}</span></div>`;
      }).join('')}
      <hr style="margin: 15px 0 10px 0; border: 1px dashed black;"/>
      <div style="text-align: center; font-size: 12px; font-weight: bold;">${settings?.printer_footer || 'Fim do Relatório'}</div>
    </div>
  `;

  executePrint(html);
};

function formatTableNumber(num: number | string) {
  const n = typeof num === 'string' ? parseInt(num) : num;
  if (isNaN(n)) return num;
  return n < 10 ? `0${n}` : `${n}`;
}

// --- Components ---

const icons = [
  { name: 'MapPin', icon: <MapPin className="h-4 w-4" /> },
  { name: 'Home', icon: <Home className="h-4 w-4" /> },
  { name: 'Coffee', icon: <Coffee className="h-4 w-4" /> },
  { name: 'Beer', icon: <Beer className="h-4 w-4" /> },
  { name: 'Utensils', icon: <Utensils className="h-4 w-4" /> },
  { name: 'Trees', icon: <Trees className="h-4 w-4" /> },
  { name: 'Waves', icon: <Waves className="h-4 w-4" /> },
  { name: 'Sun', icon: <Sun className="h-4 w-4" /> },
  { name: 'Umbrella', icon: <Umbrella className="h-4 w-4" /> },
  { name: 'Star', icon: <Star className="h-4 w-4" /> },
  { name: 'Heart', icon: <Heart className="h-4 w-4" /> },
];

const getIcon = (iconName: string) => {
  const found = icons.find(i => i.name === iconName);
  return found ? found.icon : <MapPin className="h-4 w-4" />;
};

const TableCard = ({ table, onClick, settings }: any) => {
  const tableTypes = JSON.parse(settings.table_types || '[{"id":"salao","name":"Salão","color":"#10b981"},{"id":"gramado","name":"Gramado","color":"#3b82f6"}]');
  const billRequestedColor = settings.color_bill_requested || '#f59e0b';
  
  const currentType = tableTypes.find((t: any) => t.id === table.type) || tableTypes[0];
  
  const statusColors = {
    free: 'bg-white border-zinc-200 hover:border-emerald-200 hover:bg-emerald-50/30 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/20',
    open: '', // Handled by style prop below
    bill_requested: '', // Handled by style prop below
  };

  const getStatusStyle = () => {
    if (table.status === 'free') return {};
    if (table.status === 'bill_requested') {
      return { 
        backgroundColor: `${billRequestedColor}20`, 
        borderColor: billRequestedColor,
        color: billRequestedColor 
      };
    }
    return { 
      backgroundColor: `${currentType.color}20`, 
      borderColor: currentType.color,
      color: currentType.color 
    };
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={getStatusStyle()}
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border-2 p-4 transition-all shadow-sm relative overflow-hidden',
        table.status === 'free' ? statusColors.free : ''
      )}
    >
      {table.status === 'open' && (
        <div 
          className="absolute top-0 right-0 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-tighter rounded-bl-lg text-white"
          style={{ backgroundColor: currentType.color }}
        >
          {currentType.name}
        </div>
      )}
      {table.status === 'bill_requested' && (
        <div 
          className="absolute top-0 right-0 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-tighter rounded-bl-lg text-white"
          style={{ backgroundColor: billRequestedColor }}
        >
          Conta
        </div>
      )}
      <span className={cn(
        "text-2xl font-bold",
        table.status === 'free' ? "dark:text-zinc-100" : ""
      )}>{formatTableNumber(table.number)}</span>
      <span className={cn(
        "mt-1 text-[10px] font-medium uppercase tracking-wider opacity-60",
        table.status === 'free' ? "dark:text-zinc-400" : ""
      )}>
        {table.status === 'free' ? 'Livre' : table.status === 'open' ? 'Aberta' : 'Conta'}
      </span>
      {table.customer_name && (
        <span className={cn(
          "mt-2 w-full truncate text-center text-sm font-bold",
          table.status === 'free' ? "text-zinc-900 dark:text-zinc-100" : ""
        )}>{table.customer_name}</span>
      )}
    </motion.button>
  );
};

// --- Main App ---

const CloseTableModalContent = ({ selectedTable, currentOrders, settings, user, sendWS, hasPermission, onClose }: any) => {
  const isBalcao = selectedTable?.id === -1;
  const subtotal = currentOrders.reduce((acc: number, o: any) => acc + ((o.item_price as number) || 0) * o.quantity, 0);
  
  // Initial service fee calculation
  const defaultPercentage = parseFloat(settings.service_fee || '10');
  const initialService = isBalcao ? 0 : (subtotal * (defaultPercentage / 100));
  
  const [serviceAmount, setServiceAmount] = useState(initialService);
  const [discount, setDiscount] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState<Record<string, number>>({});
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [cashGiven, setCashGiven] = useState<number | ''>('');

  const total = (subtotal as number) + (serviceAmount as number) - (discount as number);

  const handleMethodToggle = (method: string) => {
    setPaymentMethods(prev => {
      const next = { ...prev };
      if (next[method] !== undefined) {
        delete next[method];
      } else {
        const currentPaid = Object.values(next).reduce((a, b) => (a as number) + (b as number), 0) as number;
        const remaining = Math.max(0, total - currentPaid);
        next[method] = remaining;
      }
      return next;
    });
  };

  const handleAmountChange = (method: string, amount: number) => {
    setPaymentMethods(prev => ({ ...prev, [method]: amount }));
  };

  const totalPaid = Object.values(paymentMethods).reduce((a, b) => (a as number) + (b as number), 0) as number;
  const isTotalValid = Math.abs((totalPaid) - (total as number)) < 0.01;

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      if (!isTotalValid) return toast.error(`O valor total pago (${formatCurrency(totalPaid)}) deve ser igual ao total da conta (${formatCurrency(total as number)})`);
      if (selectedTable?.id === -1) {
        sendWS('BALCAO_DIRECT_SALE', { 
          items: currentOrders,
          userId: user?.id, 
          username: user?.username, 
          paymentMethods: Object.keys(paymentMethods),
          paymentDetails: paymentMethods,
          subtotal,
          serviceFee: serviceAmount,
          discount,
          total
        });
      } else {
        sendWS('TABLE_CLOSE', { 
          tableId: selectedTable?.id, 
          userId: user?.id, 
          username: user?.username, 
          paymentMethods: Object.keys(paymentMethods),
          paymentDetails: paymentMethods,
          subtotal,
          serviceFee: serviceAmount,
          discount,
          total
        });
      }
      onClose();
    }} className="space-y-4">
      <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 space-y-3">
        <div className="flex justify-between text-sm text-emerald-700 dark:text-emerald-300">
          <span>Subtotal:</span>
          <span className="font-bold">{formatCurrency(subtotal)}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm text-emerald-700 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <span>Serviço (R$):</span>
            <input 
              type="number" 
              step="0.01"
              value={serviceAmount === 0 ? '' : serviceAmount} 
              placeholder="0.00"
              disabled={!hasPermission('remove_service_fee') && serviceAmount > 0}
              onChange={(e) => {
                const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                if (val < serviceAmount && !hasPermission('remove_service_fee')) {
                  toast.error('Sem permissão para remover ou diminuir taxa de serviço');
                  return;
                }
                setServiceAmount(val);
              }}
              className="w-20 rounded border border-emerald-200 bg-white px-1 py-0.5 text-xs focus:ring-emerald-500 dark:bg-zinc-800 dark:border-emerald-800 disabled:opacity-50"
            />
          </div>
          <span className="font-bold">{formatCurrency(serviceAmount)}</span>
        </div>

        <div className="flex items-center justify-between text-sm text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <span>Desconto:</span>
            {showDiscountInput ? (
              <input 
                type="number" 
                autoFocus
                value={discount === 0 ? '' : discount} 
                placeholder="0"
                onChange={(e) => setDiscount(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                className="w-20 rounded border border-rose-200 bg-white px-1 py-0.5 text-xs focus:ring-rose-500 dark:bg-zinc-800 dark:border-rose-800"
              />
            ) : (
              <button 
                type="button"
                onClick={() => {
                  if (hasPermission('apply_discount')) {
                    setShowDiscountInput(true);
                  } else {
                    toast.error('Sem permissão para dar desconto');
                  }
                }}
                className="text-rose-600 hover:underline"
              >
                Aplicar desconto
              </button>
            )}
          </div>
          <span className="font-bold">{formatCurrency(discount)}</span>
        </div>

        <div className="pt-3 border-t border-emerald-200 dark:border-emerald-800 flex justify-between text-lg font-bold text-emerald-900 dark:text-emerald-50">
          <span>Total:</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Formas de Pagamento</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'cash', name: 'Dinheiro' },
            { id: 'pix', name: 'PIX' },
            { id: 'debit_card', name: 'Débito' },
            { id: 'credit_card', name: 'Crédito' },
            { id: 'voucher', name: 'Voucher' },
            { id: 'internal', name: 'Interno' }
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleMethodToggle(m.id)}
              className={cn(
                "px-3 py-2 rounded-lg border text-sm font-medium transition-all",
                paymentMethods[m.id] !== undefined
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "bg-white border-zinc-200 text-zinc-600 hover:border-emerald-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
              )}
            >
              {m.name.toUpperCase()}
            </button>
          ))}
        </div>

        {Object.keys(paymentMethods).length > 0 && (
          <div className="mt-4 space-y-3">
            {Object.keys(paymentMethods).map((method) => (
              <div key={method} className="flex items-center gap-3">
                <span className="text-xs font-bold text-zinc-500 w-24 uppercase">{method.replace('_', ' ')}:</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentMethods[method] === 0 ? '' : paymentMethods[method]}
                    placeholder="0.00"
                    onChange={(e) => handleAmountChange(method, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-200 text-sm focus:ring-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                  />
                </div>
              </div>
            ))}
            
            {paymentMethods['cash'] !== undefined && (
              <div className="mt-4 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-900/10 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 w-24">DINHEIRO RECEBIDO:</span>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400 text-sm">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min={paymentMethods['cash']}
                      value={cashGiven}
                      placeholder={(Math.round(paymentMethods['cash'] * 100) / 100).toFixed(2)}
                      onChange={(e) => setCashGiven(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full pl-9 pr-3 py-2 rounded-lg border border-emerald-200 text-sm focus:ring-emerald-500 bg-white dark:bg-zinc-900 dark:border-emerald-800 dark:text-emerald-100 placeholder:text-emerald-300 dark:placeholder:text-emerald-700"
                    />
                  </div>
                </div>
                {cashGiven !== '' && cashGiven > paymentMethods['cash'] && (
                  <div className="flex justify-between items-center text-emerald-800 dark:text-emerald-300 font-bold px-1">
                    <span>Troco:</span>
                    <span className="bg-emerald-100 dark:bg-emerald-900/50 px-2 py-1 rounded text-lg">
                      {formatCurrency(cashGiven - paymentMethods['cash'])}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="pt-4 flex flex-col gap-3">
        <div className={cn(
          "text-center text-sm font-bold p-2 rounded-lg",
          isTotalValid ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "text-rose-600 bg-rose-50 dark:bg-rose-900/20"
        )}>
          Pago: {formatCurrency(totalPaid)} / {formatCurrency(total as number)}
        </div>
        <Button type="submit" className="w-full py-6 text-lg">
          Finalizar Pagamento
        </Button>
        <Button variant="outline" type="button" onClick={onClose} className="w-full">
          Voltar
        </Button>
      </div>
    </form>
  );
};

const TasksTab = React.memo(function TasksTab({ tasks, users, currentUser, sendWS, hasPermission }: any) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const canManage = hasPermission('manage_tasks');

  const filteredTasks = tasks.filter((t: any) => {
    if (canManage) return true;
    const assignedIds = JSON.parse(t.assigned_to || '[]');
    return assignedIds.includes(currentUser.id);
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Tarefas</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Gerencie suas atividades diárias</p>
        </div>
        {canManage && (
          <Button onClick={() => setIsAddModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Tarefa
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTasks.length === 0 ? (
          <div className="col-span-full py-12 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <CheckSquare className="h-6 w-6 text-zinc-400" />
            </div>
            <p className="text-zinc-500 dark:text-zinc-400">Nenhuma tarefa encontrada</p>
          </div>
        ) : (
          filteredTasks.map((task: any) => (
            <motion.div
              layout
              key={task.id}
              className={cn(
                "group relative p-5 rounded-2xl border transition-all duration-300",
                task.status === 'completed'
                  ? "bg-zinc-50 border-zinc-200 dark:bg-zinc-800/30 dark:border-zinc-800"
                  : "bg-white border-zinc-200 shadow-sm hover:shadow-md dark:bg-zinc-900 dark:border-zinc-800"
              )}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className={cn(
                  "font-bold transition-all",
                  task.status === 'completed' ? "text-zinc-400 line-through" : "text-zinc-900 dark:text-zinc-100"
                )}>
                  {task.title}
                </h3>
                {canManage && (
                  <button 
                    onClick={() => sendWS('TASK_DELETE', { id: task.id })}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-rose-500 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className={cn(
                "text-sm mb-4 line-clamp-2",
                task.status === 'completed' ? "text-zinc-400" : "text-zinc-600 dark:text-zinc-400"
              )}>
                {task.description}
              </p>
              
              <div className="flex items-center justify-between pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex -space-x-2">
                  {JSON.parse(task.assigned_to || '[]').map((uid: string) => {
                    const u = users.find((user: any) => user.id === uid);
                    return (
                      <div 
                        key={uid}
                        className="h-7 w-7 rounded-full border-2 border-white bg-zinc-100 flex items-center justify-center text-[10px] font-bold dark:border-zinc-900 dark:bg-zinc-800"
                        title={u?.username}
                      >
                        {u?.avatar || u?.username?.charAt(0).toUpperCase()}
                      </div>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => sendWS('TASK_UPDATE', { id: task.id, status: task.status === 'completed' ? 'pending' : 'completed' })}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all",
                    task.status === 'completed'
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-zinc-100 text-zinc-600 hover:bg-emerald-500 hover:text-white dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-emerald-600"
                  )}
                >
                  {task.status === 'completed' ? (
                    <><CheckCircle2 className="h-3.5 w-3.5" /> Concluída</>
                  ) : (
                    'Marcar como feita'
                  )}
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Nova Tarefa">
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const assignedTo = Array.from(formData.getAll('assignedTo'));
          sendWS('TASK_ADD', {
            title: formData.get('title'),
            description: formData.get('description'),
            assignedTo,
            userId: currentUser.id,
            username: currentUser.username
          });
          setIsAddModalOpen(false);
        }} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Título</label>
            <Input name="title" placeholder="O que precisa ser feito?" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Descrição</label>
            <textarea 
              name="description" 
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 min-h-[100px]"
              placeholder="Detalhes da tarefa..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Atribuir para</label>
            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto p-1">
              {users.map((u: any) => (
                <label key={u.id} className="flex items-center gap-2 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer">
                  <input type="checkbox" name="assignedTo" value={u.id} className="rounded border-zinc-300 text-emerald-600" />
                  <span className="text-sm dark:text-zinc-300">{u.username}</span>
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" className="w-full">Criar Tarefa</Button>
        </form>
      </Modal>
    </div>
  );
});

const BalcaoTab = React.memo(function BalcaoTab({ menu, categories, details, vibrate, user, onCheckout }: any) {
  const [cart, setCart] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingObservation, setEditingObservation] = useState<string | null>(null);
  const [observationText, setObservationText] = useState("");
  const [isConfirmingSend, setIsConfirmingSend] = useState(false);

  const addToCart = (item: any) => {
    vibrate(30);
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        const filtered = prev.filter(i => i.id !== item.id);
        return [...filtered, { ...existing, quantity: existing.quantity + 1 }];
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    setSearch('');
  };

  const removeFromCart = (id: string) => { setCart(prev => prev.filter(i => i.id !== id)); };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) return { ...item, quantity: Math.max(1, item.quantity + delta) };
      return item;
    }));
  };

  const updateObservation = (id: string, obs: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) return { ...item, observation: obs };
      return item;
    }));
  };

  const filteredMenu = useMemo(() => {
    const filtered = menu.filter((item: any) => {
      if (item.active === 0) return false;
      if (search) {
        const normalizedSearch = search.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const normalizedName = item.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return normalizedName.includes(normalizedSearch);
      }
      const matchesCategory = activeCategory ? item.type === activeCategory : true;
      const matchesGroup = activeGroup ? item.category === activeGroup : true;
      return matchesCategory && matchesGroup;
    });
    return filtered;
  }, [menu, search, activeCategory, activeGroup]);

  const groupedMenu = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    filteredMenu.forEach((item: any) => {
      const groupName = item.category || 'Outros';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(item);
    });
    return Object.keys(groups).sort((a, b) => {
      if (a === 'Outros') return 1;
      if (b === 'Outros') return -1;
      const groupA = details.find((g: any) => g.name === a);
      const groupB = details.find((g: any) => g.name === b);
      const orderA = groupA?.sort_order ?? 999;
      const orderB = groupB?.sort_order ?? 999;
      return orderA - orderB;
    }).map(key => ({
      name: key,
      items: groups[key].sort((a: any, b: any) => a.name.localeCompare(b.name))
    }));
  }, [filteredMenu, details]);

  return (
    <div className="flex flex-col gap-4 h-full" style={{ minHeight: 'calc(100vh - 8rem)' }}>
      <div className="flex items-center justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="text-zinc-600 font-bold dark:text-zinc-300">Venda Rápida de Balcão</h3>
        {cart.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-zinc-500 font-bold uppercase text-[10px] tracking-wider">Total</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-black text-xl">
              {formatCurrency(cart.reduce((acc, i) => acc + (i.price * i.quantity), 0))}
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
        {/* Left Col: Menu */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto overscroll-contain pr-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-950 pb-2 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Buscar itens..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 transition-all shadow-sm"
              />
            </div>
            {!search && activeCategory && (
              <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-xl border border-emerald-100 dark:border-emerald-800/50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  <button onClick={() => { vibrate(20); setActiveCategory(null); setActiveGroup(null); }} className="hover:underline">Categorias</button>
                  <ChevronRight className="h-4 w-4" />
                  <span className="font-bold text-emerald-900 dark:text-emerald-100">{activeCategory}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-8 px-3 text-xs font-bold bg-white dark:bg-zinc-900 shadow-sm border border-emerald-200 dark:border-emerald-800 text-emerald-600 hover:bg-emerald-50" onClick={() => { vibrate(20); setActiveCategory(null); setActiveGroup(null); }}>
                  <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Voltar
                </Button>
              </div>
            )}
          </div>

          <div className="flex-1">
            {search ? (
              <div className="space-y-2">
                {filteredMenu.map((item: any) => (
                  <button key={item.id} onClick={() => { vibrate(30); addToCart(item); }} className="flex w-full items-center justify-between rounded-xl border border-zinc-100 bg-white p-4 hover:bg-zinc-50 transition-all hover:border-emerald-200 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50 dark:hover:border-emerald-900/50 shadow-sm">
                    <div className="text-left">
                      <p className="text-sm font-bold dark:text-zinc-100">{item.name}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.type} • {item.category} • {formatCurrency(item.price)}</p>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <Plus className="h-4 w-4" />
                    </div>
                  </button>
                ))}
                {filteredMenu.length === 0 && (
                  <div className="py-12 text-center space-y-2 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                    <Search className="h-12 w-12 text-zinc-200 dark:text-zinc-800 mx-auto" />
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Nenhum item encontrado para "{search}".</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {!activeCategory ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
                    {categories.map((c: any) => {
                      const count = menu.filter((m: any) => m.active !== 0 && m.type === c.name).length;
                      if (count === 0) return null;
                      return (
                        <button key={c.id} onClick={() => { vibrate(30); setActiveCategory(c.name); }} className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-emerald-500 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500 group">
                          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 text-center leading-tight line-clamp-2">{c.name}</span>
                          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                            <Tags className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{count} itens</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-8 pb-4">
                    {groupedMenu.map(({ name: groupName, items }: any) => (
                      <div key={groupName} className="space-y-3">
                        <div className="flex items-center gap-3">
                          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-500">{groupName}</h4>
                          <div className="h-[2px] flex-1 bg-gradient-to-r from-emerald-100 to-transparent dark:from-emerald-900/30" />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {items.map((item: any) => (
                            <button key={item.id} onClick={() => { vibrate(30); addToCart(item); }} className="flex w-full items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 hover:bg-zinc-50 transition-all hover:border-emerald-500 hover:shadow-sm dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50 dark:hover:border-emerald-500 group">
                              <div className="text-left">
                                <p className="text-sm font-bold group-hover:text-emerald-700 dark:text-zinc-100 dark:group-hover:text-emerald-400 transition-colors">{item.name}</p>
                                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">{formatCurrency(item.price)}</p>
                              </div>
                              <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-100 group-hover:scale-110 transition-all">
                                <Plus className="h-5 w-5" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Col: Cart */}
        <div className="w-full md:w-96 flex flex-col bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm shrink-0">
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
            <h4 className="font-bold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <ShoppingCart className="h-5 w-5 text-emerald-600" />
              Pedido
            </h4>
            {cart.length > 0 && (
              <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm">
                {cart.reduce((acc, item) => acc + item.quantity, 0)} itens
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ WebkitOverflowScrolling: 'touch' }}>
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-3">
                <div className="w-16 h-16 rounded-full bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-center">
                  <ShoppingCart className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                </div>
                <p className="font-medium text-sm">Adicione produtos</p>
              </div>
            ) : (
              [...cart].reverse().map(item => (
                <div key={item.id} className="flex flex-col gap-2 rounded-2xl bg-zinc-50 p-3 pt-4 text-sm dark:bg-zinc-800 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1 w-full">
                      <span className="dark:text-zinc-200 font-bold leading-tight">{item.name}</span>
                      <span className="text-zinc-500 font-medium text-xs">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                    
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center rounded-xl bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-700">
                        <button onClick={() => updateQuantity(item.id, -1)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-l-xl disabled:opacity-50 text-zinc-600 dark:text-zinc-400" disabled={item.quantity <= 1}>
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-emerald-600 dark:text-emerald-400">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-r-xl text-zinc-600 dark:text-zinc-400">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => { if (editingObservation === item.id) setEditingObservation(null); else { setEditingObservation(item.id); setObservationText(item.observation || ''); } }} className={cn("p-1.5 rounded-lg transition-colors", item.observation ? "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30" : "text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700")}>
                          <MessageSquareText className="h-4 w-4" />
                        </button>
                        <button onClick={() => removeFromCart(item.id)} className="text-rose-500 hover:bg-rose-100 p-1.5 rounded-lg dark:hover:bg-rose-900/20 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {editingObservation === item.id ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Input autoFocus value={observationText} onChange={(e) => setObservationText(e.target.value)} placeholder="Ex: Sem cebola..." className="h-9 text-xs flex-1 rounded-xl" onKeyDown={(e) => { if (e.key === 'Enter') { updateObservation(item.id, observationText); setEditingObservation(null); } else if (e.key === 'Escape') setEditingObservation(null); }} />
                      <Button size="sm" className="h-9 px-3 rounded-xl" onClick={() => { updateObservation(item.id, observationText); setEditingObservation(null); }}>Salvar</Button>
                    </div>
                  ) : item.observation ? (
                    <div className="text-xs text-amber-600 dark:text-amber-400 italic bg-amber-50/50 dark:bg-amber-900/10 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30 flex items-center gap-1.5 mt-1">
                      <StickyNote className="h-3.5 w-3.5 shrink-0" />
                      <span className="line-clamp-2">{item.observation}</span>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 space-y-4">
            <div className="flex justify-between items-center px-1">
              <span className="text-zinc-500 font-medium font-bold">Resumo Financeiro</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(cart.reduce((acc, i) => acc + (i.price * i.quantity), 0))}
              </span>
            </div>
            <Button disabled={cart.length === 0} className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg shadow-emerald-600/20" onClick={() => setIsConfirmingSend(true)}>
              Avançar
            </Button>
          </div>
        </div>
      </div>

      <Modal isOpen={isConfirmingSend} onClose={() => setIsConfirmingSend(false)} title="Confirmar Balcão" maxWidth="max-w-md">
        <div className="space-y-6">
          <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-100 dark:border-emerald-800/50 flex flex-col items-center text-center gap-2">
            <Store className="h-8 w-8 text-emerald-600 dark:text-emerald-500" />
            <h4 className="font-bold text-emerald-900 dark:text-emerald-100">Balcão Expresso</h4>
            <p className="text-sm text-emerald-700 dark:text-emerald-400">Ao confirmar, o pedido é enviado à cozinha e a tela de pagamento abrirá automaticamente.</p>
          </div>
          
          <div className="space-y-4">
            <div className="max-h-40 overflow-y-auto border rounded-xl divide-y bg-zinc-50 dark:bg-zinc-900/50 dark:border-zinc-800">
              {[...cart].reverse().map(item => (
                <div key={item.id} className="p-3 text-sm flex justify-between">
                  <span>{item.quantity}x {item.name}</span>
                  <span className="text-zinc-500 font-medium">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center text-xl font-black border-t pt-4 px-2">
              <span>TOTAL</span>
              <span className="text-emerald-600">{formatCurrency(cart.reduce((acc, i) => acc + (i.price * i.quantity), 0))}</span>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" className="flex-1 py-4 font-bold rounded-2xl" onClick={() => setIsConfirmingSend(false)}>Cancelar</Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 flex-[2] py-4 font-black rounded-2xl text-lg shadow-lg" 
              onClick={() => {
                vibrate([50, 100, 50]);
                onCheckout(cart);
                setCart([]);
                setIsConfirmingSend(false);
              }}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
});

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('user');
        return saved ? JSON.parse(saved) : null;
      } catch {
        return null;
      }
    }
    return null;
  });
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (typeof window !== 'undefined') {
      const loggedIn = localStorage.getItem('isLoggedIn') === 'true';
      const userSaved = localStorage.getItem('user');
      return loggedIn && !!userSaved;
    }
    return false;
  });

  useEffect(() => {
    if (isLoggedIn && user) {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('user');
    }
  }, [isLoggedIn, user]);

  const [transferRequests, setTransferRequests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'mesas' | 'balcao' | 'cardapio' | 'historico' | 'config' | 'gestao' | 'tarefas'>('mesas');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setShowScrollTop(container.scrollTop > 300);
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeTab]);

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [directBalcaoOrders, setDirectBalcaoOrders] = useState<any[]>([]);
  
  // State from server
  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [stockPurchases, setStockPurchases] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [details, setDetails] = useState<any[]>([]);
  const [historyEvents, setHistoryEvents] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<{ userId: string; username: string; role: string }[]>([]);
  const [cloudUsage, setCloudUsage] = useState({ supabase_queries: 0, request_count: 0 });
  const [syncStatus, setSyncStatus] = useState({ supabase: 'unknown', limits: { request: 66000 } });
  const [cashierStatus, setCashierStatus] = useState<{ status: 'open' | 'closed'; sessionId?: string; initialBalance?: number }>({ status: 'closed' });
  const [cashierTransactions, setCashierTransactions] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ service_fee: '10' });
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('fontSize') || '16';
    }
    return '16';
  });
  const [vibrationEnabled, setVibrationEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('vibrationEnabled') !== 'false';
    }
    return true;
  });

  const vibrate = useCallback((pattern: number | number[] = 50) => {
    if (vibrationEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        console.warn('Vibration failed:', e);
      }
    }
  }, [vibrationEnabled]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a: any, b: any) => {
      const orderA = a.sort_order ?? 999;
      const orderB = b.sort_order ?? 999;
      return orderA - orderB;
    });
  }, [categories]);

  const sortedGroups = useMemo(() => {
    return [...details].sort((a: any, b: any) => {
      const catA = categories.find(c => c.name === a.category_name);
      const catB = categories.find(c => c.name === b.category_name);
      
      const catOrderA = catA?.sort_order ?? 999;
      const catOrderB = catB?.sort_order ?? 999;
      
      if (catOrderA !== catOrderB) return catOrderA - catOrderB;
      
      const groupOrderA = a.sort_order ?? 999;
      const groupOrderB = b.sort_order ?? 999;
      return groupOrderA - groupOrderB;
    });
  }, [details, categories]);

  const sortedMenu = useMemo(() => {
    return [...menu];
  }, [menu]);

  const hasPermission = useCallback((permission: string) => {
    if (user?.role === 'host' || user?.username === 'Dev') return true;
    if (!user?.role) return false;
    const perms = settings[`permissions_${user.role}`];
    if (!perms) return false;
    try {
      const parsed = typeof perms === 'string' ? JSON.parse(perms) : perms;
      return !!parsed[permission];
    } catch (e) {
      return false;
    }
  }, [user, settings]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.style.fontSize = `${fontSize}px`;
      localStorage.setItem('fontSize', fontSize);
      localStorage.setItem('vibrationEnabled', String(vibrationEnabled));
    }
  }, [fontSize, vibrationEnabled]);

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('notificationsEnabled');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });

  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('soundEnabled');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });

  const [managePrinterHub, setManagePrinterHub] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('managePrinterHub');
      return saved !== null ? JSON.parse(saved) : false;
    }
    return false;
  });

  const [printerHubUserRestriction, setPrinterHubUserRestriction] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('printerHubUserRestriction') || 'all';
    }
    return 'all';
  });

  const notificationsEnabledRef = useRef(notificationsEnabled);
  const soundEnabledRef = useRef(soundEnabled);
  const managePrinterHubRef = useRef(managePrinterHub);
  const printerHubUserRestrictionRef = useRef(printerHubUserRestriction);

  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
    localStorage.setItem('notificationsEnabled', JSON.stringify(notificationsEnabled));
  }, [notificationsEnabled]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    localStorage.setItem('soundEnabled', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    managePrinterHubRef.current = managePrinterHub;
    localStorage.setItem('managePrinterHub', JSON.stringify(managePrinterHub));
  }, [managePrinterHub]);

  useEffect(() => {
    printerHubUserRestrictionRef.current = printerHubUserRestriction;
    localStorage.setItem('printerHubUserRestriction', printerHubUserRestriction);
  }, [printerHubUserRestriction]);
  
  // UI State
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [accountsPayable, setAccountsPayable] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const selectedTableRef = useRef(selectedTable);
  useEffect(() => {
    selectedTableRef.current = selectedTable;
  }, [selectedTable]);

  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [addUserRole, setAddUserRole] = useState<string | null>(null);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isAddMenuModalOpen, setIsAddMenuModalOpen] = useState(false);
  const [isEditMenuModalOpen, setIsEditMenuModalOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<any>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isCloseTableModalOpen, setIsCloseTableModalOpen] = useState(false);
  const [isConfirmBillModalOpen, setIsConfirmBillModalOpen] = useState(false);

  const [deleteOrderModal, setDeleteOrderModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [isWsConnected, setIsWsConnected] = useState(true);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const currentOrders = useMemo(() => {
    if (!selectedTable) return [];
    return allOrders.filter(o => o.table_id === selectedTable.id);
  }, [allOrders, selectedTable]);

  const fetchUsers = () => {
    fetch('/api/users', { headers: { 'x-app-user-id': user?.id || '' } })
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setUsers(data); else console.error("fetchUsers returned:", data); })
      .catch(console.error);
  };
  const fetchOrders = () => {
    fetch('/api/orders', { headers: { 'x-app-user-id': user?.id || '' } })
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setAllOrders(data); else console.error("fetchOrders returned:", data); })
      .catch(console.error);
  };

  const connectWebSocket = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN || socketRef.current?.readyState === WebSocket.CONNECTING) return;

    // Close existing if any (shouldn't happen with the check above but for safety)
    if (socketRef.current) {
      socketRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsWsConnected(true);
      console.log('WebSocket connected');
      reconnectAttempts.current = 0;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Request full sync on connect
      ws.send(JSON.stringify({ type: 'FULL_SYNC' }));
      ws.send(JSON.stringify({ type: 'USAGE_GET' }));
      ws.send(JSON.stringify({ type: 'SYNC_CHECK' }));
      
      if (userRef.current) {
        ws.send(JSON.stringify({ 
          type: 'USER_IDENTIFY', 
          payload: { 
            userId: userRef.current.id, 
            username: userRef.current.username, 
            role: userRef.current.role 
          } 
        }));
      }
    };

    ws.onmessage = (event) => {
      const data: WSEvent = JSON.parse(event.data);
      switch (data.type) {
        case 'TABLES_SYNC':
          setTables(data.payload.sort((a: any, b: any) => a.number - b.number));
          break;
        case 'ORDERS_SYNC':
          setAllOrders(data.payload);
          break;
        case 'TABLE_UPDATE':
          if (!data.payload) break;
          setTables(prev => prev.map(t => t.id === data.payload.id ? data.payload : t));
          if (selectedTableRef.current?.id === data.payload.id) {
            setSelectedTable(data.payload);
          }
          break;
        case 'TABLE_CLOSE':
          if (!data.payload) break;
          setAllOrders(prev => prev.filter(o => o.table_id !== data.payload.tableId));
          break;
        case 'MENU_UPDATE':
          setMenu(data.payload);
          break;
        case 'CATEGORIES_UPDATE':
          setCategories(data.payload);
          break;
        case 'DETAILS_UPDATE':
          setDetails(data.payload);
          break;
        case 'STOCK_SYNC':
          setStockPurchases(data.payload);
          break;
        case 'HISTORY_UPDATE':
          setHistoryEvents(data.payload);
          break;
        case 'TRANSFER_REQUESTS_SYNC':
          setTransferRequests(data.payload);
          break;
        case 'SETTINGS_UPDATE':
          setSettings((prev: any) => ({ ...prev, ...data.payload }));
          break;
        case 'ORDER_UPDATE':
          if (!data.payload) break;
          setAllOrders(prev => prev.map(o => o.id === data.payload.id ? data.payload : o));
          break;
        case 'ORDER_NEW':
          if (!data.payload) break;
          setAllOrders(prev => {
            const newOrders = data.payload.filter((newOrder: any) => !prev.some(o => o.id === newOrder.id));
            return [...prev, ...newOrders];
          });
          break;
        case 'BALCAO_CHECKOUT_TRIGGER':
          // Legacy flow, direct checkout used instead
          break;
        case 'BALCAO_DIRECT_SALE_SUCCESS':
          if (data.payload.userId === user?.id) {
            setDirectBalcaoOrders([]);
          }
          break;
        case 'ORDER_DELETED':
          setAllOrders(prev => prev.filter(o => o.id !== data.payload.orderId));
          break;
        case 'PRINT_COMMAND':
          if (managePrinterHubRef.current) {
            // Check user restriction
            const restriction = printerHubUserRestrictionRef.current;
            if (restriction !== 'all' && userRef.current?.username !== restriction) {
              console.log('Printing ignored: this device is restricted to user', restriction);
              break;
            }

            console.log('Received print command:', data.payload);
            const { type, payload } = data;
            
            // Define which types need manual confirmation
            const needsManualConfirmation = ['cashier_open', 'cashier_close', 'table_close'].includes(data.payload.type);

            if (needsManualConfirmation) {
                // Show a manual confirmation toast or modal
                toast((t) => (
                  <div className="flex flex-col gap-2">
                    <p className="font-bold flex items-center gap-2">
                      <Printer className="h-4 w-4" /> Imprimir {data.payload.title || 'Documento'}?
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => {
                        if (['table_bill', 'table_close'].includes(data.payload.type)) {
                          const fee = data.payload.serviceFeePercentage !== undefined 
                            ? data.payload.serviceFeePercentage 
                            : parseFloat(settingsRef.current?.service_fee || '10');
                          printTableBill(data.payload.table, data.payload.orders, data.payload.operator, settingsRef.current, data.payload.title || 'CONTA', fee, data.payload.paymentMethods, data.payload.customServiceFee, data.payload.discount);
                        } else if (['cashier_slip', 'cashier_open', 'cashier_close'].includes(data.payload.type)) {
                          printFinancialSlip(data.payload.title, data.payload.data, data.payload.operator);
                        }
                        socketRef.current?.send(JSON.stringify({ type: 'PRINT_ACK', payload: { operator: data.payload.operator, title: data.payload.title || 'Documento' } }));
                        toast.dismiss(t.id);
                      }}>Imprimir</Button>
                      <Button size="sm" variant="ghost" onClick={() => toast.dismiss(t.id)}>Ignorar</Button>
                    </div>
                  </div>
                ), { duration: 15000, position: 'bottom-right' });
            } else {
                // "Direct" printing (no interaction needed in the app, browser dialog still appears as intended)
                if (data.payload.type === 'order_kitchen') {
                  printKitchenReceipt(data.payload.tableNumber, data.payload.operator, data.payload.items, settingsRef.current, data.payload.title || 'COMANDA - COZINHA');
                } else if (['table_bill', 'table_close'].includes(data.payload.type)) {
                  const fee = data.payload.serviceFeePercentage !== undefined 
                    ? data.payload.serviceFeePercentage 
                    : parseFloat(settingsRef.current?.service_fee || '10');
                  printTableBill(data.payload.table, data.payload.orders, data.payload.operator, settingsRef.current, data.payload.title || 'CONTA', fee, data.payload.paymentMethods, data.payload.customServiceFee, data.payload.discount);
                } else if (['cashier_slip', 'cashier_open', 'cashier_close'].includes(data.payload.type)) {
                  printFinancialSlip(data.payload.title, data.payload.data, data.payload.operator, settingsRef.current);
                }
                socketRef.current?.send(JSON.stringify({ type: 'PRINT_ACK', payload: { operator: data.payload.operator, title: data.payload.title || 'Documento' } }));
            }
          }
          break;
        case 'NOTIFICATION':
          if (notificationsEnabledRef.current) {
            const toastId = `notif-${data.payload.message}`;
            toast(data.payload.message, {
              id: toastId,
              icon: data.payload.type === 'success' ? '✅' : data.payload.type === 'warning' ? '⚠️' : 'ℹ️',
            });
          }
          if (soundEnabledRef.current) {
            try {
              const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
              if (AudioContext) {
                const ctx = new AudioContext();
                const playBeep = (time: number) => {
                  const osc = ctx.createOscillator();
                  const gainNode = ctx.createGain();
                  osc.type = 'sine';
                  osc.frequency.setValueAtTime(880, time);
                  osc.frequency.exponentialRampToValueAtTime(440, time + 0.1);
                  gainNode.gain.setValueAtTime(0.1, time);
                  gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
                  osc.connect(gainNode);
                  gainNode.connect(ctx.destination);
                  osc.start(time);
                  osc.stop(time + 0.1);
                };

                playBeep(ctx.currentTime);
                playBeep(ctx.currentTime + 0.15);
              }
            } catch (e) {
              console.log('Audio play failed:', e);
            }
          }
          break;
        case 'FORCE_LOGOUT':
          if (userRef.current?.role !== 'host') {
            toast.error(data.payload.message);
            setIsLoggedIn(false);
            setUser(null);
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('user');
          }
          break;
        case 'ONLINE_USERS':
          setOnlineUsers(data.payload);
          break;
        case 'USAGE_UPDATE':
          setCloudUsage(data.payload);
          break;
        case 'SYNC_STATUS':
          setSyncStatus(data.payload);
          break;
        case 'CASHIER_STATUS':
          setCashierStatus(data.payload);
          break;
        case 'CASHIER_TRANSACTIONS':
          setCashierTransactions(data.payload);
          break;
        case 'ACCOUNTS_PAYABLE_SYNC':
          setAccountsPayable(data.payload);
          break;
        case 'TASKS_SYNC':
          setTasks(data.payload);
          break;
        case 'HISTORY_ALL_DATA':
          generateHistoryPDF(data.payload);
          break;
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      ws.close();
    };

    ws.onclose = () => {
      setIsWsConnected(false);
      console.log('WebSocket connection closed. Reconnecting...');
      socketRef.current = null;
      // Faster initial reconnection, then exponential backoff
      const delay = reconnectAttempts.current === 0 ? 500 : Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 10000);
      reconnectAttempts.current += 1;
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, delay);
    };
  };

  const reconnectAttempts = useRef(0);

  useEffect(() => {
    if (isLoggedIn) {
      fetchUsers();
      fetchOrders();
      connectWebSocket();

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          // Only check connection, don't trigger automatic full sync to reduce processing/logs
          if (socketRef.current?.readyState !== WebSocket.OPEN) {
            connectWebSocket();
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (socketRef.current) socketRef.current.close();
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      };
    }
  }, [isLoggedIn]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const token = formData.get('token') as string;

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, token }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.user);
        setIsLoggedIn(true);
        toast.success('Bem-vindo ao Deck Serrinha!');
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error('Erro ao conectar ao servidor');
    }
  };

  const sendWS = useCallback((type: string, payload: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const handleBalcaoCheckout = useCallback((items: any[]) => {
    setSelectedTable({ id: -1, number: -1, type: 'balcao', status: 'open', customer_name: 'Balcão' } as any);
    setDirectBalcaoOrders(items.map(i => ({
      menu_item_id: i.id,
      quantity: i.quantity,
      observation: i.observation,
      item_name: i.name,
      item_price: i.price,
      print_enabled: i.print_enabled,
      group: i.category,
      category: i.type
    })));
    setIsCloseTableModalOpen(true);
  }, []);

  const handleManualSync = () => {
    if (isSyncing) return;
    vibrate(50);
    setIsSyncing(true);
    toast.promise(
      new Promise((resolve) => {
        sendWS('SAVE_TO_CLOUD', {});
        setTimeout(resolve, 3000);
      }),
      {
        loading: 'Enviando dados para a nuvem...',
        success: 'Dados enviados com sucesso!',
        error: 'Erro ao enviar dados.',
      }
    );
    setTimeout(() => setIsSyncing(false), 5000);
  };

  // --- Auth View ---
  if (!isLoggedIn) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <Toaster position="top-right" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 p-8 shadow-xl dark:shadow-zinc-900/50"
        >
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <UtensilsCrossed className="h-8 w-8" />
            </div>
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">Deck Serrinha</h1>
            <p className="text-zinc-500 dark:text-zinc-400">Sistema de Gestão de Restaurante</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Login</label>
              <Input name="username" placeholder="Seu usuário" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Senha</label>
              <Input name="password" type="password" placeholder="Sua senha" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Token de Acesso (Se não for Host)</label>
              <Input name="token" type="password" placeholder="Token do sistema" />
            </div>
            <Button type="submit" className="w-full py-6 text-lg">
              Entrar
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  // --- Main View ---
  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Toaster position="top-right" />
      
      {!isWsConnected && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-rose-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-semibold animate-in slide-in-from-top-4">
          <AlertCircle className="h-4 w-4 animate-pulse" />
          Sem conexão (Tentando reconectar...)
        </div>
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 flex-col border-r border-zinc-200 bg-white transition-transform duration-300 md:relative md:translate-x-0 dark:bg-zinc-900 dark:border-zinc-800",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-[calc(3.5rem+env(safe-area-inset-top))] items-end justify-between border-bottom border-zinc-100 px-4 pb-3 dark:border-zinc-800">
          <div className="flex items-center">
            <UtensilsCrossed className="mr-2 h-5 w-5 text-emerald-600" />
            <span className="text-lg font-bold tracking-tight dark:text-zinc-100">Deck Serrinha</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {hasPermission('mesas') && (
            <SidebarItem 
              icon={<LayoutDashboard />} 
              label="Mesas" 
              active={activeTab === 'mesas'} 
              onClick={() => { 
                vibrate(20);
                setActiveTab('mesas'); 
                setIsSidebarOpen(false); 
              }} 
            />
          )}
          {hasPermission('mesas') && (
            <SidebarItem 
              icon={<Store />} 
              label="Balcão" 
              active={activeTab === 'balcao'} 
              onClick={() => { 
                vibrate(20);
                setActiveTab('balcao'); 
                setIsSidebarOpen(false); 
              }} 
            />
          )}
          {hasPermission('historico') && (
            <SidebarItem 
              icon={<History />} 
              label="Histórico" 
              active={activeTab === 'historico'} 
              onClick={() => { 
                vibrate(20);
                setActiveTab('historico'); 
                setIsSidebarOpen(false); 
              }} 
            />
          )}
          {hasPermission('cardapio') && (
            <SidebarItem 
              icon={<MenuIcon />} 
              label="Restaurante" 
              active={activeTab === 'cardapio'} 
              onClick={() => { 
                vibrate(20);
                setActiveTab('cardapio'); 
                setIsSidebarOpen(false); 
              }} 
            />
          )}
          <SidebarItem 
            icon={<CheckSquare />} 
            label="Tarefas" 
            active={activeTab === 'tarefas'} 
            onClick={() => { 
              vibrate(20);
              setActiveTab('tarefas'); 
              setIsSidebarOpen(false); 
            }} 
          />
          {hasPermission('config') && (
            <SidebarItem 
              icon={<Settings />} 
              label="Configurações" 
              active={activeTab === 'config'} 
              onClick={() => { 
                vibrate(20);
                setActiveTab('config'); 
                setIsSidebarOpen(false); 
              }} 
            />
          )}

          {hasPermission('gestao') && (
            <SidebarItem 
              icon={<Database />} 
              label="Gestão" 
              active={activeTab === 'gestao'} 
              onClick={() => { 
                vibrate(20);
                setActiveTab('gestao'); 
                setIsSidebarOpen(false); 
              }} 
            />
          )}
        </nav>

        <div className="mt-auto border-t border-zinc-100 p-4 dark:border-zinc-800">
          <div className="mb-4 flex items-center px-2">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center shadow-sm border text-xl",
              user?.role === 'host' ? "bg-purple-100 text-purple-600 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800/50" :
              "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
            )}>
              {user?.avatar ? user.avatar : (
                user?.role === 'host' ? <UserCircle className="h-6 w-6" /> :
                <UserCircle className="h-5 w-5" />
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold dark:text-zinc-200">{user?.username}</p>
              <p className="text-xs font-medium text-zinc-500 capitalize dark:text-zinc-400">
                {user?.role}
              </p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-900/20" onClick={() => { setIsLoggedIn(false); setUser(null); }}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>

          <div className="mt-4 px-2 text-[10px] text-zinc-400 dark:text-zinc-500 space-y-1 border-t border-zinc-100 pt-4 dark:border-zinc-800/50">
            <p className="font-medium">Versão 1.1.8 beta</p>
            <div className="opacity-70">
              <p>Criado por: Abiner</p>
              <p>E-mail para contato: abinerfelipe@gmail.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden backdrop-blur-sm transition-all"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden overscroll-none touch-pan-y min-h-0">
        <header className="flex h-[calc(4rem+env(safe-area-inset-top))] items-end justify-between border-b border-zinc-200 bg-white px-4 pb-4 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                vibrate(40);
                setIsSidebarOpen(true);
              }} 
              className="md:hidden p-2 -ml-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 active:bg-zinc-100 dark:active:bg-zinc-800 rounded-lg transition-colors"
            >
              <MenuIcon className="h-7 w-7" />
            </button>
            <h2 className="text-base font-semibold capitalize dark:text-zinc-100">
              {activeTab === 'gestao' ? 'Gestão' : 
               activeTab === 'historico' ? 'Histórico' : 
               activeTab === 'cardapio' ? 'Restaurante' : 
               activeTab === 'config' ? 'Configurações' : 
               activeTab}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              className="h-8 px-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/20" 
              onClick={() => {
                vibrate([30, 50, 30]);
                toast.promise(
                  new Promise((resolve, reject) => {
                    if (socketRef.current?.readyState === WebSocket.OPEN) {
                      socketRef.current.send(JSON.stringify({ type: 'SYNC_FIRESTORE' }));
                      setTimeout(resolve, 2000);
                    } else {
                      connectWebSocket();
                      setTimeout(resolve, 3000);
                    }
                  }),
                  {
                    loading: 'Baixando dados da nuvem...',
                    success: 'Dados baixados com sucesso!',
                    error: 'Erro ao baixar dados',
                  }
                );
              }}
            >
              <RefreshCw className="h-4 w-4 mr-1 md:mr-1" />
              <span className="inline text-[10px] font-bold uppercase">Sincronizar</span>
            </Button>
            {activeTab === 'mesas' && (
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700" /> <span className="dark:text-zinc-400">Livre</span></span>
                <span className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> <span className="dark:text-zinc-400">Aberta</span></span>
                <span className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-amber-500" /> <span className="dark:text-zinc-400">Conta</span></span>
              </div>
            )}
          </div>
        </header>

        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto overscroll-none p-4 pb-24 md:pb-8" 
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {activeTab === 'mesas' && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="text-zinc-600 font-bold dark:text-zinc-300">Mesas</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {tables.map((table) => (
                  <TableCard 
                    key={table.id} 
                    table={table} 
                    settings={settings}
                    onClick={() => {
                      vibrate(30);
                      setSelectedTable(table);
                      setIsTableModalOpen(true);
                    }} 
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'balcao' && (
            <BalcaoTab
              menu={sortedMenu}
              categories={sortedCategories}
              details={sortedGroups}
              vibrate={vibrate}
              user={user}
              onCheckout={handleBalcaoCheckout}
            />
          )}

          {activeTab === 'tarefas' && (
            <TasksTab 
              tasks={tasks} 
              users={users} 
              currentUser={user} 
              sendWS={sendWS} 
              hasPermission={hasPermission} 
            />
          )}

          {activeTab === 'cardapio' && (
            <MenuTab 
              menu={sortedMenu} 
              categories={sortedCategories}
              details={sortedGroups}
              canEdit={false} 
              onAdd={() => setIsAddMenuModalOpen(true)} 
              onEdit={(item: any) => {
                setEditingMenuItem(item);
                setIsEditMenuModalOpen(true);
              }}
              onWS={sendWS}
              currentUser={user}
            />
          )}

          {activeTab === 'gestao' && hasPermission('gestao') && (
            <GestaoTab 
              menu={sortedMenu} 
              categories={sortedCategories}
              details={sortedGroups}
              tables={tables}
              sendWS={sendWS}
              onAddMenu={() => setIsAddMenuModalOpen(true)}
              onEditMenu={(item: any) => {
                setEditingMenuItem(item);
                setIsEditMenuModalOpen(true);
              }}
              onResetHistory={() => {
                sendWS('HISTORY_CLEAR', { userId: user?.id, username: user?.username });
              }}
              currentUser={user}
              stockPurchases={stockPurchases}
              settings={settings}
              hasPermission={hasPermission}
              users={users}
              onRefreshUsers={fetchUsers}
              onAddUser={() => setIsAddUserModalOpen(true)}
              onEditUser={(u: any) => {
                setEditingUser(u);
                setIsEditUserModalOpen(true);
              }}
              transferRequests={transferRequests}
              allOrders={allOrders}
              vibrate={vibrate}
              onlineUsers={onlineUsers}
              cashierStatus={cashierStatus}
              cashierTransactions={cashierTransactions}
              accountsPayable={accountsPayable}
              managePrinterHub={managePrinterHub}
              setManagePrinterHub={setManagePrinterHub}
              printerHubUserRestriction={printerHubUserRestriction}
              setPrinterHubUserRestriction={setPrinterHubUserRestriction}
              cloudUsage={cloudUsage}
              syncStatus={syncStatus}
              isSyncing={isSyncing}
              handleManualSync={handleManualSync}
            />
          )}

          {activeTab === 'historico' && (
            <HistoryTab 
              events={historyEvents} 
              menu={sortedMenu}
              tables={tables}
              currentUser={user}
              users={users}
              canMarkRead={hasPermission('mark_history_read')}
              onMarkRead={(historyId: string) => {
                sendWS('HISTORY_MARK_READ', { historyId, userId: user?.id, username: user?.username });
              }}
              transferRequests={transferRequests}
              onApproveTransfer={(requestId: string) => sendWS('TABLE_TRANSFER_APPROVE', { requestId, userId: user?.id, username: user?.username })}
              onRejectTransfer={(requestId: string) => sendWS('TABLE_TRANSFER_REJECT', { requestId, userId: user?.id, username: user?.username })}
              hasTransferPermission={hasPermission('transfer_table')}
              hasReprintPermission={hasPermission('reprint_history')}
              onReprintHistory={(event: any) => {
                // Determine format
                const isKitchenOrder = event.action === 'NOVO_PEDIDO' || event.action === 'EXCLUIR_PEDIDO';
                
                if (isKitchenOrder && event.details) {
                  // Reconstruct kitchen order for print
                  const match = event.details.match(/^(\d+)x (.*?)(?: -\(.*?\))?$/);
                  const name = match ? match[2].trim() : event.details.split(' - ')[1]?.replace(/-\(.*?\)|\(.*?\)/g, '').trim() || event.details;
                  
                  const mockItem = {
                    name: name,
                    quantity: parseInt(event.details.match(/^(\d+)x/)?.[1] || '1'),
                    group: event.details.match(/\((.*?)\)/)?.[1] || '',
                    observation: ''
                  };
                  printKitchenReceipt(String(event.table_id || 'Avulso'), String(event.username), [mockItem] as any, "[SEGUNDA VIA]");
                  toast.success('Segunda via enviada para impressão!');
                } else {
                  toast('Impressão de via disponível apenas para itens de pedido de cozinha nesta atualização.', { icon: 'ℹ️' });
                }
              }}
              hasDeletePermission={hasPermission('delete_history')}
              onDeleteHistory={(historyId: string) => {
                sendWS('HISTORY_DELETE', { historyId });
              }}
            />
          )}

          {activeTab === 'config' && (
            <ConfigTab 
              users={users}
              settings={settings}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              fontSize={fontSize}
              setFontSize={setFontSize}
              vibrationEnabled={vibrationEnabled}
              setVibrationEnabled={setVibrationEnabled}
              notificationsEnabled={notificationsEnabled}
              setNotificationsEnabled={setNotificationsEnabled}
              soundEnabled={soundEnabled}
              setSoundEnabled={setSoundEnabled}
              onRefreshUsers={fetchUsers}
              onAddUser={(role?: string) => {
                setAddUserRole(role || null);
                setIsAddUserModalOpen(true);
              }}
              onEditUser={(u: User) => {
                setEditingUser(u);
                setIsEditUserModalOpen(true);
              }}
              currentUser={user} 
              onUpdateCurrentUser={setUser}
              onSaveSettings={(newSettings: any) => sendWS('SETTINGS_UPDATE', newSettings)}
              categories={categories}
              details={details}
              sendWS={sendWS}
              menu={menu}
              onResetHistory={async () => {
                try {
                  const res = await fetch('/api/admin/reset-history', { 
                    method: 'POST',
                    headers: { 'x-app-user-id': user?.id || '' }
                  });
                  const data = await res.json();
                  if (data.success) {
                    toast.success('Histórico limpo!');
                  } else {
                    toast.error(data.message || 'Erro ao limpar histórico');
                  }
                } catch (error) {
                  toast.error('Erro de conexão ao limpar histórico');
                }
              }}
              hasPermission={hasPermission}
              tables={tables}
              onAddMenu={() => setIsAddMenuModalOpen(true)}
              onEditMenu={(item: any) => {
                setEditingMenuItem(item);
                setIsEditMenuModalOpen(true);
              }}
              stockPurchases={stockPurchases}
              vibrate={vibrate}
              onlineUsers={onlineUsers}
              cashierStatus={cashierStatus}
              cashierTransactions={cashierTransactions}
              accountsPayable={accountsPayable}
              managePrinterHub={managePrinterHub}
              setManagePrinterHub={setManagePrinterHub}
              printerHubUserRestriction={printerHubUserRestriction}
              setPrinterHubUserRestriction={setPrinterHubUserRestriction}
              allOrders={allOrders}
              cloudUsage={cloudUsage}
              syncStatus={syncStatus}
              isSyncing={isSyncing}
              handleManualSync={handleManualSync}
            />
          )}
        </div>
      </main>

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            onClick={scrollToTop}
            className="fixed bottom-24 right-6 p-3 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 transition-colors z-50 md:bottom-28"
          >
            <ArrowUp className="h-6 w-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Modals */}
      <TableActionsModal 
        isOpen={isTableModalOpen} 
        onClose={() => setIsTableModalOpen(false)} 
        table={selectedTable}
        orders={currentOrders}
        details={details}
        settings={settings}
        isHost={user?.role === 'host'}
        onOpenTable={(data) => {
          sendWS('TABLE_OPEN', { tableId: selectedTable?.id, userId: user?.id, username: user?.username, ...data });
          setIsTableModalOpen(false);
        }}
        onUpdateTable={(data) => {
          sendWS('TABLE_UPDATE_DATA', { tableId: selectedTable?.id, userId: user?.id, username: user?.username, ...data });
        }}
        onRequestBill={() => setIsConfirmBillModalOpen(true)}
        onAddOrder={() => setIsOrderModalOpen(true)}
        onCloseTable={() => {
          setIsCloseTableModalOpen(true);
          setIsTableModalOpen(false); // Fix: this prevents TableActionsModal from showing up underneath or updating to 'Aberta' form
        }}
        onMarkRead={(orderId: string) => {
          sendWS('ORDER_MARK_READ', { orderId, userId: user?.id, username: user?.username });
        }}
        onDeleteOrder={(orderId: string) => {
          setDeleteOrderModal({
            isOpen: true,
            title: 'Excluir Pedido',
            message: 'Tem certeza que deseja excluir este pedido?',
            onConfirm: () => {
              sendWS('ORDER_DELETE', { orderId, tableId: selectedTable?.id, userId: user?.id, username: user?.username });
              setDeleteOrderModal(prev => ({ ...prev, isOpen: false }));
            }
          });
        }}
        canDeleteOrder={hasPermission('delete_order')}
        onTransferTable={(fromTableId: number, toTableId: number, orderIds: string[], targetType: string) => {
          if (hasPermission('transfer_table')) {
            sendWS('TABLE_TRANSFER', { fromTableId, toTableId, orderIds, userId: user?.id, username: user?.username, targetType });
          } else {
            sendWS('TABLE_TRANSFER_REQUEST', { fromTableId, toTableId, orderIds, userId: user?.id, username: user?.username, targetType });
          }
          setIsTableModalOpen(false);
        }}
        canTransfer={hasPermission('transfer_table')}
        allTables={tables}
      />

      <Modal isOpen={isConfirmBillModalOpen} onClose={() => setIsConfirmBillModalOpen(false)} title="Pedir Conta">
        <div className="space-y-4">
          <p className="text-zinc-600">Deseja realmente pedir a conta da Mesa {formatTableNumber(selectedTable?.number)}?</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsConfirmBillModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              vibrate(50);
              sendWS('TABLE_REQUEST_BILL', { tableId: selectedTable?.id, userId: user?.id, username: user?.username });
              setIsConfirmBillModalOpen(false);
              setIsTableModalOpen(false);
            }}>Confirmar</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isCloseTableModalOpen} onClose={() => setIsCloseTableModalOpen(false)} title={selectedTable?.id === -1 ? "Finalizar Venda Balcão" : "Fechar Mesa"}>
        <CloseTableModalContent 
          selectedTable={selectedTable}
          currentOrders={selectedTable?.id === -1 ? directBalcaoOrders : currentOrders}
          settings={settings}
          user={user}
          sendWS={sendWS}
          hasPermission={hasPermission}
          onClose={() => {
            setIsCloseTableModalOpen(false);
            setIsTableModalOpen(false);
          }}
        />
      </Modal>

      <OrderModal 
        isOpen={isOrderModalOpen} 
        onClose={() => setIsOrderModalOpen(false)} 
        menu={sortedMenu}
        categories={sortedCategories}
        details={sortedGroups}
        vibrate={vibrate}
        isDirectCheckout={selectedTable?.type === 'balcao'}
        onSend={(items: any[]) => {
          vibrate([50, 30, 50]);
          
          if (selectedTable?.type === 'balcao') {
            // Initiate fast track flow for 'balcão'
            sendWS('TABLE_OPEN', { tableId: selectedTable.id, customerName: 'Avulso', peopleCount: 1, tableType: 'balcao' });
            sendWS('ORDER_SEND', { tableId: selectedTable.id, userId: user?.id, username: user?.username, items, isBalcao: true });
            
            setIsOrderModalOpen(false);
            
            // Allow state to catch up for orders to be injected to closed modal
            setTimeout(() => {
               setIsCloseTableModalOpen(true);
            }, 500);
            return;
          }
          
          sendWS('ORDER_SEND', { tableId: selectedTable?.id, userId: user?.id, username: user?.username, items });
          
          setIsOrderModalOpen(false);
        }}
      />

      <AddUserModal 
        isOpen={isAddUserModalOpen} 
        onClose={() => setIsAddUserModalOpen(false)} 
        onSuccess={fetchUsers}
        currentUser={user}
        settings={settings}
        initialRole={addUserRole}
      />
      
      <EditUserModal 
        isOpen={isEditUserModalOpen} 
        onClose={() => {
          setIsEditUserModalOpen(false);
          setEditingUser(null);
        }} 
        user={editingUser}
        onSuccess={fetchUsers}
        currentUser={user}
        settings={settings}
      />
      
      <AddMenuModal 
        isOpen={isAddMenuModalOpen} 
        onClose={() => setIsAddMenuModalOpen(false)} 
        onSave={(data) => sendWS('MENU_ADD', data)}
        categories={sortedCategories}
        details={sortedGroups}
      />

      <EditMenuModal 
        isOpen={isEditMenuModalOpen} 
        onClose={() => {
          setIsEditMenuModalOpen(false);
          setEditingMenuItem(null);
        }} 
        onSave={(data: any) => sendWS('MENU_EDIT', data)}
        item={editingMenuItem}
        categories={sortedCategories}
        details={sortedGroups}
      />

      <Modal
        isOpen={deleteOrderModal.isOpen}
        onClose={() => setDeleteOrderModal(prev => ({ ...prev, isOpen: false }))}
        title={deleteOrderModal.title}
        zIndex={60}
      >
        <div className="space-y-6">
          <p className="text-zinc-600 dark:text-zinc-300">{deleteOrderModal.message}</p>
          <div className="flex justify-end gap-3">
            <Button 
              variant="ghost" 
              onClick={() => setDeleteOrderModal(prev => ({ ...prev, isOpen: false }))}
            >
              Cancelar
            </Button>
            <Button 
              variant="danger" 
              onClick={deleteOrderModal.onConfirm}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// --- Sub-components ---

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-all',
        active 
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
          : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
      )}
    >
      <span className={cn('mr-3 h-5 w-5', active ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400')}>
        {React.cloneElement(icon as React.ReactElement, { className: 'h-5 w-5' })}
      </span>
      {label}
    </button>
  );
}

function TableActionsModal({ isOpen, onClose, table, orders, isHost, onOpenTable, onRequestBill, onAddOrder, onCloseTable, onMarkRead, onUpdateTable, onDeleteOrder, canDeleteOrder, onTransferTable, canTransfer, allTables, details = [], settings }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [targetTable, setTargetTable] = useState<string>('');
  
  const tableTypes = JSON.parse(settings?.table_types || '[{"id":"salao","name":"Salão","color":"#10b981"},{"id":"gramado","name":"Gramado","color":"#3b82f6"}]');
  const [tableType, setTableType] = useState<string>(tableTypes[0]?.id || 'salao');

  const aggregatedOrders = useMemo(() => {
    const groups: { [key: string]: any } = {};
    orders.forEach((o: any) => {
      const key = `${o.item_name}-${o.observation || ''}-${o.group || ''}`;
      if (!groups[key]) {
        groups[key] = { ...o, quantity: 0 };
      }
      groups[key].quantity += o.quantity;
    });
    return Object.values(groups).sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp));
  }, [orders]);

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setIsTransferring(false);
      setSelectedOrders([]);
      setTargetTable('');
      setTableType(tableTypes[0]?.id || 'salao');
    }
  }, [isOpen]);

  if (!table) return null;

  const handleTransfer = () => {
    if (!targetTable || selectedOrders.length === 0) {
      toast.error('Selecione a mesa de destino e pelo menos um item');
      return;
    }
    onTransferTable(table.id, parseInt(targetTable), selectedOrders, tableType);
    setIsTransferring(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Mesa ${formatTableNumber(table.number)}`}>
      <div className="space-y-6">
        {table.status === 'free' ? (
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            onOpenTable({
              customerName: formData.get('name'),
              peopleCount: parseInt(formData.get('people') as string) || 0,
              tableType
            });
          }} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-zinc-300">Tipo de Mesa</label>
              <div className="grid grid-cols-2 gap-2">
                {tableTypes.map((t: any) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTableType(t.id)}
                    className={cn(
                      "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all",
                      tableType === t.id 
                        ? "bg-zinc-50 dark:bg-zinc-800" 
                        : "border-zinc-100 bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700"
                    )}
                    style={tableType === t.id ? { borderColor: t.color, color: t.color, backgroundColor: `${t.color}10` } : {}}
                  >
                    {getIcon(t.icon || 'MapPin')}
                    <span className="text-xs font-bold uppercase">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-zinc-300">Nome do Cliente (Opcional)</label>
              <Input name="name" placeholder="Ex: João Silva" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-zinc-300">Quantidade de Pessoas</label>
              <Input name="people" type="number" placeholder="1" />
            </div>
            <Button type="submit" className="w-full">Abrir Mesa</Button>
          </form>
        ) : (
          <div className="space-y-4">
            {isTransferring ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold uppercase text-zinc-500">Transferir Itens</h4>
                  <Button variant="ghost" size="sm" onClick={() => setIsTransferring(false)}>Cancelar</Button>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium dark:text-zinc-400">Tipo da Mesa de Destino</label>
                  <div className="grid grid-cols-2 gap-2">
                    {tableTypes.map((t: any) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTableType(t.id)}
                        className={cn(
                          "flex items-center justify-center gap-2 p-2 rounded-xl border-2 transition-all",
                          tableType === t.id 
                            ? "bg-zinc-50 dark:bg-zinc-800" 
                            : "border-zinc-100 bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700"
                        )}
                        style={tableType === t.id ? { borderColor: t.color, color: t.color, backgroundColor: `${t.color}10` } : {}}
                      >
                        <Home className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium dark:text-zinc-400">Mesa de Destino</label>
                  <select 
                    value={targetTable}
                    onChange={(e) => setTargetTable(e.target.value)}
                    className="w-full h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-200"
                  >
                    <option value="">Selecione uma mesa...</option>
                    {allTables
                      .filter((t: any) => t.id !== table.id)
                      .map((t: any) => (
                        <option key={t.id} value={t.id}>
                          Mesa {formatTableNumber(t.number)} {t.status === 'open' ? `(${t.customer_name})` : '(Livre)'}
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium dark:text-zinc-400">Selecione os Itens</label>
                    <button 
                      onClick={() => setSelectedOrders(selectedOrders.length === orders.length ? [] : orders.map((o: any) => o.id))}
                      className="text-[10px] font-bold uppercase text-emerald-600"
                    >
                      {selectedOrders.length === orders.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-50 dark:divide-zinc-800">
                    {orders.map((order: any) => (
                      <label key={order.id} className="flex items-center gap-3 p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedOrders.includes(order.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedOrders([...selectedOrders, order.id]);
                            else setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                          }}
                          className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium dark:text-zinc-200">{order.quantity}x {order.item_name}</p>
                          {order.group && <p className="text-[10px] text-zinc-500">({order.group})</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <Button onClick={handleTransfer} className="w-full bg-emerald-600 hover:bg-emerald-700">
                  {canTransfer ? 'Confirmar Transferência' : 'Solicitar Transferência'}
                </Button>
              </div>
            ) : (
              <>
                <div className="rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800">
                  {!isEditing ? (
                    <>
                      <div className="flex justify-between text-sm items-center">
                        <span className="text-zinc-500 dark:text-zinc-400">Cliente:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold dark:text-zinc-200">{table.customer_name || 'Não informado'}</span>
                          <button onClick={() => setIsEditing(true)} className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
                            <Edit2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-zinc-500 dark:text-zinc-400">Tipo:</span>
                        <span className={cn(
                          "font-bold px-2 py-0.5 rounded-full text-[10px] uppercase",
                          table.type === 'gramado' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        )}>
                          {table.type === 'gramado' ? 'Gramado' : 'Salão'}
                        </span>
                      </div>
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-zinc-500 dark:text-zinc-400">Pessoas:</span>
                        <span className="font-semibold dark:text-zinc-200">{table.people_count || 0}</span>
                      </div>
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-zinc-500 dark:text-zinc-400">Aberta em:</span>
                        <span className="font-semibold dark:text-zinc-200">{table.opened_at ? format(new Date(table.opened_at), 'HH:mm') : '-'}</span>
                      </div>
                    </>
                  ) : (
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      onUpdateTable({
                        customerName: formData.get('name'),
                        peopleCount: parseInt(formData.get('people') as string) || 0,
                        tableType: formData.get('tableType')
                      });
                      setIsEditing(false);
                    }} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium dark:text-zinc-300">Tipo da Mesa</label>
                        <select 
                          name="tableType" 
                          defaultValue={table.type || 'salao'}
                          className="w-full h-8 rounded-md border border-zinc-200 bg-white px-3 text-xs dark:bg-zinc-950 dark:border-zinc-800 dark:text-zinc-200"
                        >
                          {tableTypes.map((t: any) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium dark:text-zinc-300">Nome</label>
                        <Input name="name" defaultValue={table.customer_name} className="h-8 text-sm" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium dark:text-zinc-300">Pessoas</label>
                        <Input name="people" type="number" defaultValue={table.people_count} className="h-8 text-sm" />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button type="submit" className="h-8 text-xs flex-1">Salvar</Button>
                        <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} className="h-8 text-xs">Cancelar</Button>
                      </div>
                    </form>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase text-zinc-400">Pedidos Atuais</h4>
                    <div className="text-[10px] font-black text-emerald-600 flex items-center gap-1">
                      <span className="text-zinc-500 uppercase font-bold">Total:</span>
                      {formatCurrency(orders.reduce((acc: number, o: any) => acc + (o.item_price * o.quantity), 0))}
                    </div>
                  </div>
                  <div className="max-h-[300px] md:max-h-[400px] overflow-y-auto overscroll-contain rounded-lg border border-zinc-100 bg-white dark:bg-zinc-900 dark:border-zinc-800" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {orders.length === 0 ? (
                      <p className="p-4 text-center text-xs text-zinc-400 dark:text-zinc-500">Nenhum pedido realizado</p>
                    ) : (
                      <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
                        {aggregatedOrders.map((order: any) => (
                          <div key={order.id} className="flex flex-col p-3 text-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className="dark:text-zinc-200">
                                  <span className="text-zinc-900 dark:text-zinc-100 font-bold">{order.quantity}x</span> - {order.item_name}
                                  {(() => {
                                    const group = details.find((d: any) => d.name === order.group);
                                    if (order.group && (!group || group.show_in_history !== 0)) {
                                      return (
                                        <span className="text-xs text-zinc-500 dark:text-zinc-400 ml-2">
                                          -({order.group})
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-zinc-400 dark:text-zinc-500">{format(new Date(order.timestamp), 'HH:mm')}</span>
                                {canDeleteOrder && (
                                  <button 
                                    onClick={() => onDeleteOrder(order.id)} 
                                    className="text-rose-500 hover:bg-rose-50 p-1 rounded dark:hover:bg-rose-900/20 transition-colors"
                                    title="Excluir pedido"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                            {order.observation && (
                              <div className="text-xs text-amber-600 dark:text-amber-400 italic mt-1 flex items-center gap-1 bg-amber-50 dark:bg-amber-900/20 p-1 rounded">
                                <StickyNote className="h-3 w-3" />
                                <span>Obs: {order.observation}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={onAddOrder} className="bg-green-600 hover:bg-green-700 col-span-2">
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Pedido
                  </Button>
                  <Button onClick={() => setIsTransferring(true)} variant="ghost" className="border-zinc-200 dark:border-zinc-700">
                    <MoveRight className="mr-2 h-4 w-4" /> Transferir
                  </Button>
                  <Button onClick={onRequestBill} className="bg-amber-700 hover:bg-amber-800 dark:bg-amber-700 dark:hover:bg-amber-800 text-white shadow-sm">
                    <DollarSign className="mr-2 h-4 w-4" /> Pedir Conta
                  </Button>
                  <Button onClick={onCloseTable} variant="danger" className="col-span-2">
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Fechar Mesa
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

const StockTab = React.memo(function StockTab({ menu, stockPurchases, onWS, user }: any) {
  const [purchaseModal, setPurchaseModal] = useState({ isOpen: false, item: null as any });
  const [filter, setFilter] = useState('');
  
  const stockItems = menu.filter((item: any) => item.is_stockable === 1);
  const filteredStockItems = stockItems.filter((item: any) => 
    item.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Controle de Estoque</h3>
          <p className="text-sm text-zinc-500">Gerencie entradas e consulte saldo de produtos</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input 
            placeholder="Filtrar por nome..." 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {filteredStockItems.map((item: any) => (
          <div key={item.id} className="p-4 rounded-xl border border-zinc-200 bg-zinc-50/50 dark:bg-zinc-800/30 dark:border-zinc-800 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100">{item.name}</h4>
                {item.is_solid === 1 && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase font-bold dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">Sólido</span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1">{item.type} • {item.category}</p>
              
              <div className="mt-4 flex items-end gap-2">
                <span className={cn(
                  "text-3xl font-black",
                  (item.current_stock || 0) <= 5 ? "text-rose-600" : "text-emerald-600"
                )}>
                  {item.current_stock || 0}
                </span>
                <span className="text-xs font-bold text-zinc-400 mb-1.5 uppercase">Unidades em estoque</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="mt-4 w-full"
              onClick={() => setPurchaseModal({ isOpen: true, item })}
            >
              <ShoppingCart className="mr-2 h-4 w-4" /> Registrar Compra
            </Button>
          </div>
        ))}
      </div>

      {filteredStockItems.length === 0 && (
        <div className="py-12 text-center border-2 border-dashed border-zinc-200 rounded-2xl dark:border-zinc-800">
          <Database className="mx-auto h-12 w-12 text-zinc-300 mb-4" />
          <p className="text-zinc-500">Nenhum produto com controle de estoque habilitado.</p>
          <p className="text-xs text-zinc-400 mt-1">Habilite o controle de estoque nas configurações do produto.</p>
        </div>
      )}

      {stockPurchases.length > 0 && (
        <div className="mt-8 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Histórico Recente de Compras</h3>
          <div className="rounded-xl border border-zinc-200 overflow-hidden dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
            {stockPurchases.slice(0, 10).map((purchase: any) => {
              const item = menu.find((i: any) => i.id === purchase.menu_item_id);
              return (
                <div key={purchase.id} className="bg-white p-3 flex justify-between items-center dark:bg-zinc-900">
                  <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{item?.name || 'Produto Removido'}</p>
                    <p className="text-xs text-zinc-500">
                      {format(new Date(purchase.timestamp), 'dd/MM/yyyy HH:mm')} • {purchase.username}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-600">+{purchase.quantity} un</p>
                    <p className="text-[10px] text-zinc-400">Custo: {formatCurrency(purchase.cost_price)}/un</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <PurchaseModal 
        isOpen={purchaseModal.isOpen}
        onClose={() => setPurchaseModal({ isOpen: false, item: null })}
        item={purchaseModal.item}
        onWS={onWS}
        user={user}
      />
    </div>
  );
});

function PurchaseModal({ isOpen, onClose, item, onWS, user }: any) {
  const [quantity, setQuantity] = useState('');
  const [costPrice, setCostPrice] = useState('');

  useEffect(() => {
    if (isOpen) {
      setQuantity('');
      setCostPrice('');
    }
  }, [isOpen]);

  if (!item) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Registrar Compra: ${item.name}`}>
      <form onSubmit={(e) => {
        e.preventDefault();
        onWS('PURCHASE_ADD', {
          menu_item_id: item.id,
          quantity: parseFloat(quantity),
          cost_price: parseFloat(costPrice),
          userId: user.id,
          username: user.username
        });
        onClose();
      }} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium dark:text-zinc-300">Quantidade Comprada</label>
          <Input 
            type="number" 
            placeholder="0" 
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required 
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium dark:text-zinc-300">Valor de Compra (Unitário)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">R$</span>
            <Input 
              type="number" 
              step="0.01" 
              placeholder="0.00" 
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              className="pl-10"
              required 
            />
          </div>
          <p className="text-[10px] text-zinc-500 italic">Este valor será usado para cálculos futuros de lucro.</p>
        </div>
        <div className="pt-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} type="button">Cancelar</Button>
          <Button className="flex-1" type="submit">Confirmar Entrada</Button>
        </div>
      </form>
    </Modal>
  );
}

function ConfigModal({ isOpen, onClose, categories, details, sendWS, vibrate }: any) {
  const [localCats, setLocalCats] = useState<any[]>([]);
  const [localGroups, setLocalGroups] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      setLocalCats(categories);
      setLocalGroups(details);
    }
    // Only re-sync when the modal opens to avoid overwriting local changes during sync
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const moveItem = (list: any[], index: number, direction: 'up' | 'down') => {
    const newList = [...list];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex >= 0 && targetIndex < newList.length) {
      [newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]];
      return newList;
    }
    return list;
  };

  const handleSave = () => {
    const catData = localCats.map((c, i) => ({ 
      id: c.id, 
      sort_order: i + 1,
      print_enabled: c.print_enabled 
    }));
    const groupData = localGroups.map((g, i) => ({ 
      id: g.id, 
      sort_order: i + 1,
      print_enabled: g.print_enabled,
      show_in_history: g.show_in_history
    }));
    
    sendWS('CATEGORY_SAVE_CONFIG', { categories: catData });
    sendWS('DETAIL_SAVE_CONFIG', { groups: groupData });
    onClose();
  };

  const toggleCategoryPrint = (catId: string) => {
    const cat = localCats.find(c => c.id === catId);
    if (!cat) return;
    const newEnabled = cat.print_enabled === 0 ? 1 : 0;
    
    // Update category
    setLocalCats(prev => prev.map(c => c.id === catId ? { ...c, print_enabled: newEnabled } : c));
    
    // Cascade to groups in local state
    setLocalGroups(prev => prev.map(g => g.category_name === cat.name ? { ...g, print_enabled: newEnabled } : g));
    
    if (vibrate) vibrate(10);
  };

  const toggleGroupPrint = (groupId: string) => {
    setLocalGroups(prev => prev.map(g => g.id === groupId ? { ...g, print_enabled: g.print_enabled === 0 ? 1 : 0 } : g));
    if (vibrate) vibrate(10);
  };

  const toggleGroupHistory = (groupId: string) => {
    setLocalGroups(prev => prev.map(g => g.id === groupId ? { ...g, show_in_history: g.show_in_history === 0 ? 1 : 0 } : g));
    if (vibrate) vibrate(10);
  };

  const groupedGroups = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    localGroups.forEach((d: any) => {
      const cat = d.category_name || 'Sem Categoria';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(d);
    });
    return groups;
  }, [localGroups]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurações de Ordem e Impressão">
      <div className="space-y-8 max-h-[70vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Categorias</h3>
            <span className="text-[10px] text-zinc-400 italic">Tocar na impressora para ativar/desativar</span>
          </div>
          <div className="space-y-2">
            {localCats.map((c, index) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => setLocalCats(moveItem(localCats, index, 'up'))} className="p-0.5 text-zinc-400 hover:text-emerald-500"><ArrowUp className="h-3 w-3" /></button>
                    <button onClick={() => setLocalCats(moveItem(localCats, index, 'down'))} className="p-0.5 text-zinc-400 hover:text-emerald-500"><ArrowDown className="h-3 w-3" /></button>
                  </div>
                  <span className="font-medium dark:text-zinc-200">{c.name}</span>
                </div>
                <button
                  onClick={() => toggleCategoryPrint(c.id)}
                  className={cn(
                    "p-2 rounded-lg transition-colors flex items-center gap-2",
                    c.print_enabled !== 0 ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                  )}
                >
                  <Printer className="h-4 w-4" />
                  <span className="text-[10px] font-bold">{c.print_enabled !== 0 ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 px-1">Grupos</h3>
          {Object.entries(groupedGroups).map(([catName, items]: [string, any]) => (
            <div key={catName} className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase text-zinc-500 px-1">{catName}</h4>
              <div className="space-y-2">
                {(items as any[]).map((g: any) => {
                  const actualIndex = localGroups.findIndex(lg => lg.id === g.id);
                  return (
                    <div key={g.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-0.5">
                          <button 
                            onClick={() => {
                              const newList = [...localGroups];
                              let prevIdx = -1;
                              for (let i = actualIndex - 1; i >= 0; i--) {
                                if (newList[i].category_name === g.category_name) { prevIdx = i; break; }
                              }
                              if (prevIdx !== -1) {
                                [newList[actualIndex], newList[prevIdx]] = [newList[prevIdx], newList[actualIndex]];
                                setLocalGroups(newList);
                              }
                            }}
                            className="p-0.5 text-zinc-400 hover:text-emerald-500"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button 
                            onClick={() => {
                              const newList = [...localGroups];
                              let nextIdx = -1;
                              for (let i = actualIndex + 1; i < newList.length; i++) {
                                if (newList[i].category_name === g.category_name) { nextIdx = i; break; }
                              }
                              if (nextIdx !== -1) {
                                [newList[actualIndex], newList[nextIdx]] = [newList[nextIdx], newList[actualIndex]];
                                setLocalGroups(newList);
                              }
                            }}
                            className="p-0.5 text-zinc-400 hover:text-emerald-500"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="font-medium dark:text-zinc-200">{g.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleGroupHistory(g.id)}
                          className={cn(
                            "p-2 rounded-lg transition-colors flex items-center gap-2",
                            g.show_in_history !== 0 ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                          )}
                          title={g.show_in_history !== 0 ? "Visível no Histórico" : "Oculto no Histórico"}
                        >
                          <History className="h-4 w-4" />
                          <span className="text-[10px] font-bold">{g.show_in_history !== 0 ? 'ON' : 'OFF'}</span>
                        </button>
                        <button
                          onClick={() => toggleGroupPrint(g.id)}
                          className={cn(
                            "p-2 rounded-lg transition-colors flex items-center gap-2",
                            g.print_enabled !== 0 ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                          )}
                          title={g.print_enabled !== 0 ? "Impressão Ativa" : "Impressão Inativa"}
                        >
                          <Printer className="h-4 w-4" />
                          <span className="text-[10px] font-bold">{g.print_enabled !== 0 ? 'ON' : 'OFF'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <div className="flex gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800 sticky bottom-0 bg-white dark:bg-zinc-900 pb-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Fechar</Button>
          <Button className="flex-1" onClick={handleSave}>Salvar Configurações</Button>
        </div>
      </div>
    </Modal>
  );
}

function CategoryDetailManager({ categories = [], details = [], menu = [], sendWS, hasPermission, vibrate }: any) {
  const [newCat, setNewCat] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [newDetailCategory, setNewDetailCategory] = useState('');
  const [editingCat, setEditingCat] = useState<any>(null);
  const [editingDetail, setEditingDetail] = useState<any>(null);
  const [editingDetailCategory, setEditingDetailCategory] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const groupedDetails = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    details.forEach((d: any) => {
      const cat = d.category_name || 'Sem Categoria';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(d);
    });
    // Since details is already sorted by category sort_order then group sort_order,
    // the keys in groups will be in the correct order.
    return Object.keys(groups).map(key => ({
      categoryName: key,
      groupItems: groups[key]
    }));
  }, [details]);

  return (
    <div className="space-y-6">
      <ConfirmModal 
        isOpen={confirmModal.isOpen} 
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })} 
        title={confirmModal.title} 
        message={confirmModal.message} 
        onConfirm={confirmModal.onConfirm} 
      />
      <ConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        categories={categories}
        details={details}
        sendWS={sendWS}
        vibrate={vibrate}
      />
      <div className="flex justify-end mb-2">
        {hasPermission('manage_categories') && (
          <Button onClick={() => setIsConfigModalOpen(true)} className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700">
            <Settings className="mr-2 h-4 w-4" /> Configurar Ordem e Impressão
          </Button>
        )}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Categories */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-semibold dark:text-zinc-100">Categorias</h4>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            if (newCat.trim()) {
              sendWS('CATEGORY_ADD', { name: newCat.trim() });
              setNewCat('');
            }
          }} className="flex gap-2 mb-4">
            <Input value={newCat} onChange={(e: any) => setNewCat(e.target.value)} placeholder="Nova categoria..." />
            <Button type="submit">Adicionar</Button>
          </form>

          <ul className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {categories.map((c: any, index: number) => {
              return (
              <li key={c.id} className="flex flex-col gap-2 p-3 rounded-xl border border-zinc-100 bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  {editingCat?.id === c.id ? (
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      if (editingCat.name.trim()) {
                        sendWS('CATEGORY_EDIT', { id: c.id, name: editingCat.name.trim() });
                        setEditingCat(null);
                      }
                    }} className="flex gap-2 w-full">
                      <Input autoFocus value={editingCat.name} onChange={(e: any) => setEditingCat({ ...editingCat, name: e.target.value })} />
                      <Button type="submit" className="px-2 py-1 h-auto text-xs">Salvar</Button>
                      <Button type="button" variant="outline" className="px-2 py-1 h-auto text-xs" onClick={() => setEditingCat(null)}>Cancelar</Button>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-lg">
                          {index + 1}°
                        </span>
                        <span className="font-medium dark:text-zinc-200">{c.name}</span>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => setEditingCat(c)} className="p-1 text-emerald-500 hover:text-emerald-700">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => setConfirmModal({
                          isOpen: true,
                          title: 'Excluir Categoria',
                          message: `Deseja excluir a categoria "${c.name}"?`,
                          onConfirm: () => sendWS('CATEGORY_DELETE', { id: c.id })
                        })} className="p-1 text-rose-500 hover:text-rose-700">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </li>
            )})}
          </ul>
        </div>

        {/* Grupos */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-md font-semibold dark:text-zinc-100">Grupos</h4>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            if (newDetail.trim() && newDetailCategory) {
              sendWS('DETAIL_ADD', { name: newDetail.trim(), category_name: newDetailCategory });
              setNewDetail('');
              setNewDetailCategory('');
            } else {
              toast.error("Preencha o nome e selecione uma categoria");
            }
          }} className="flex flex-col gap-2 mb-4">
            <div className="flex gap-2">
              <Input value={newDetail} onChange={(e: any) => setNewDetail(e.target.value)} placeholder="Novo grupo..." />
              <select
                value={newDetailCategory}
                onChange={(e) => setNewDetailCategory(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300"
              >
                <option value="">Selecione uma categoria...</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <Button type="submit" className="w-full">Adicionar</Button>
          </form>

          <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
            {groupedDetails.map(({ categoryName, groupItems }: any) => (
              <div key={categoryName} className="space-y-2">
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">{categoryName}</h5>
                <ul className="space-y-2">
                  {groupItems.map((g: any, index: number) => {
                    return (
                    <li key={g.id} className="flex flex-col gap-2 p-3 rounded-xl border border-zinc-100 bg-zinc-50 dark:bg-zinc-800/50 dark:border-zinc-800">
                      <div className="flex items-center justify-between">
                        {editingDetail?.id === g.id ? (
                          <form onSubmit={(e) => {
                            e.preventDefault();
                            if (editingDetail.name.trim() && editingDetailCategory) {
                              sendWS('DETAIL_EDIT', { id: g.id, name: editingDetail.name.trim(), category_name: editingDetailCategory });
                              setEditingDetail(null);
                              setEditingDetailCategory('');
                            } else {
                              toast.error("Preencha o nome e selecione uma categoria");
                            }
                          }} className="flex flex-col gap-2 w-full">
                            <div className="flex gap-2">
                              <Input autoFocus value={editingDetail.name} onChange={(e: any) => setEditingDetail({ ...editingDetail, name: e.target.value })} />
                              <select
                                value={editingDetailCategory}
                                onChange={(e) => setEditingDetailCategory(e.target.value)}
                                className="flex h-10 w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300"
                              >
                                <option value="">Selecione uma categoria...</option>
                                {categories.map((c: any) => (
                                  <option key={c.id} value={c.name}>{c.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button type="submit" className="px-2 py-1 h-auto text-xs">Salvar</Button>
                              <Button type="button" variant="outline" className="px-2 py-1 h-auto text-xs" onClick={() => { setEditingDetail(null); setEditingDetailCategory(''); }}>Cancelar</Button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded">
                                {index + 1}°
                              </span>
                              <span className="font-medium dark:text-zinc-200">{g.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setEditingDetail(g); setEditingDetailCategory(g.category_name || ''); }} className="p-1 text-emerald-500 hover:text-emerald-700">
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button onClick={() => setConfirmModal({
                                isOpen: true,
                                title: 'Excluir Grupo',
                                message: `Deseja excluir o grupo "${g.name}"?`,
                                onConfirm: () => sendWS('DETAIL_DELETE', { id: g.id })
                              })} className="p-1 text-rose-500 hover:text-rose-700">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </li>
                  )})}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const GestaoTab = React.memo(function GestaoTab(props: any) {
  const { 
    menu, 
    categories, 
    details, 
    tables = [],
    sendWS, 
    onAddMenu, 
    onEditMenu, 
    onResetHistory, 
    currentUser, 
    stockPurchases = [],
    settings, 
    hasPermission,
    users = [],
    onRefreshUsers,
    onAddUser,
    onEditUser,
    transferRequests = [],
    allOrders = [],
    vibrate,
    onlineUsers = [],
    cashierStatus = { status: 'closed' },
    cashierTransactions = [],
    accountsPayable = [],
    managePrinterHub,
    setManagePrinterHub,
    printerHubUserRestriction,
    setPrinterHubUserRestriction,
    cloudUsage,
    syncStatus,
    isSyncing,
    handleManualSync // Pass the manual sync handler
  } = props;
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const isHost = currentUser?.role === 'host' || currentUser?.username === 'Dev';
  const isAdmin = currentUser?.role === 'admin';

  const deleteUser = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Usuário',
      message: 'Tem certeza que deseja excluir este usuário?',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/users/${id}`, { 
            method: 'DELETE',
            headers: { 'x-app-user-id': currentUser.id }
          });
          const data = await res.json();
          if (data.success) {
            onRefreshUsers();
            toast.success('Usuário removido');
          } else {
            toast.error(data.message || 'Erro ao remover usuário');
          }
        } catch (error) {
          toast.error('Erro de conexão ao remover usuário');
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      }
    });
  };

  const renderMenu = () => (
    <div className="max-w-full px-2 md:px-0 space-y-6">
      <h2 className="text-2xl font-bold mb-6 dark:text-zinc-100">Gestão do Sistema</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-2">Financeiro</h3>
          {hasPermission('erp') && (
            <button 
              onClick={() => setActiveSection('finance')}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Financeiro</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Caixa e Vendas</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400" />
            </button>
          )}
          {hasPermission('erp') && (
            <button 
              onClick={() => setActiveSection('accounts_payable')}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                  <CreditCard className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Contas a Pagar</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Lembretes e Pagamentos</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400" />
            </button>
          )}

          {hasPermission('erp') && (
            <button 
              onClick={() => setActiveSection('stock')}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                  <Database className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Estoque</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Controle de entradas e saídas</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400" />
            </button>
          )}

          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-2 pt-4">Administrativo</h3>
          {hasPermission('manage_permissions') && (
            <button 
              onClick={() => setActiveSection('permissions')}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Autorizações</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Permissões de cargos</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400" />
            </button>
          )}

          {hasPermission('manage_users') && (
            <button 
              onClick={() => setActiveSection('users')}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                  <Users className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Equipe</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Usuários e acessos</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400" />
            </button>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-2">Restaurante</h3>
          {hasPermission('edit_menu') && (
            <button 
              onClick={() => setActiveSection('products')}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                  <UtensilsCrossed className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Produtos</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Gerenciar itens</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400" />
            </button>
          )}

          {hasPermission('manage_categories') && (
            <button 
              onClick={() => setActiveSection('categories')}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                  <Tags className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Categorias e Grupos</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Organizar restaurante</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400" />
            </button>
          )}

          {hasPermission('manage_tables') && (
            <button 
              onClick={() => setActiveSection('tables_mgmt')}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <LayoutDashboard className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Mesas</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Gerenciar mesas e cores</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400" />
            </button>
          )}

          {hasPermission('manage_printer') && (
            <button 
              onClick={() => setActiveSection('printer')}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                  <Printer className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Impressora</h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Configurar cupons</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 pt-2">
        <h1 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-2">Sistema e Manutenção</h1>
        {(isHost || isAdmin) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => setActiveSection('cloud_status')}
              className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-zinc-200 hover:bg-sky-50 hover:border-sky-200 transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-sky-900/10 dark:hover:border-sky-900/30 group"
            >
              <div className="p-3 rounded-xl bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400 group-hover:scale-110 transition-transform">
                <Activity className="h-6 w-6" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Status Quotas (Deck)</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Monitorar Cloud e Limites</p>
              </div>
              <ChevronRight className="h-5 w-5 ml-auto text-zinc-300 group-hover:translate-x-1 transition-transform" />
            </button>

            <button 
              onClick={handleManualSync}
              className={cn(
                "flex items-center gap-4 p-4 rounded-2xl border transition-all group",
                isSyncing 
                  ? "bg-zinc-50 border-zinc-200 opacity-70 cursor-not-allowed dark:bg-zinc-800 dark:border-zinc-700"
                  : "bg-white border-zinc-200 hover:bg-emerald-50 hover:border-emerald-200 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-emerald-900/10 dark:hover:border-emerald-900/30"
              )}
              disabled={isSyncing}
            >
              <div className={cn(
                "p-3 rounded-xl transition-all",
                isSyncing ? "bg-zinc-200 text-zinc-500 animate-pulse" : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 group-hover:rotate-12"
              )}>
                {isSyncing ? <RefreshCw className="h-6 w-6 animate-spin" /> : <Cloud className="h-6 w-6" />}
              </div>
              <div className="text-left">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100">Sync Nuvem</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {isSyncing ? 'Sincronizando...' : 'Sincronizar Manualmente'}
                </p>
              </div>
              {!isSyncing && <ChevronRight className="h-5 w-5 ml-auto text-zinc-300 group-hover:translate-x-1 transition-transform" />}
            </button>
          </div>
        )}

        <button 
          onClick={() => setActiveSection('danger')}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 transition-all dark:bg-rose-900/10 dark:border-rose-900/30 dark:hover:bg-rose-900/20 group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400 group-hover:animate-pulse">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-rose-900 dark:text-rose-200">Ações de Limpeza</h3>
              <p className="text-xs text-rose-700 dark:text-rose-400">Zerar histórico e dados locais</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-rose-400 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'accounts_payable':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <AccountsPayableSection 
                accountsPayable={accountsPayable} 
                sendWS={sendWS} 
                cashierStatus={cashierStatus}
                currentUser={currentUser}
              />
            </div>
          </div>
        );
      case 'stock':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <StockTab 
                menu={menu}
                stockPurchases={stockPurchases}
                onWS={sendWS}
                user={currentUser}
              />
            </div>
          </div>
        );
      case 'products':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <MenuTab 
                menu={menu} 
                categories={categories} 
                details={details}
                canEdit={true} 
                onAdd={onAddMenu} 
                onEdit={onEditMenu} 
                onWS={sendWS} 
                vibrate={vibrate}
                currentUser={currentUser}
              />
            </div>
          </div>
        );
      case 'users':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              {isHost && (
                <div className="mb-8 border-b border-zinc-100 pb-8 dark:border-zinc-800">
                  <h4 className="text-sm font-medium mb-4 dark:text-zinc-300">Acesso Geral</h4>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    sendWS('SETTINGS_UPDATE', {
                      access_token: formData.get('access_token')
                    });
                    toast.success('Configurações salvas!');
                  }} className="grid gap-4 md:grid-cols-2 items-end">
                    <div className="space-y-2">
                      <label className="text-sm font-medium dark:text-zinc-400">Token de Acesso (Outros Usuários)</label>
                      <div className="relative">
                        <Input name="access_token" defaultValue={settings.access_token || '123456'} />
                        <Edit2 className="absolute right-3 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
                      </div>
                    </div>
                    <Button type="submit">Salvar Token</Button>
                  </form>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium dark:text-zinc-300">Equipe</h4>
                <div className="flex gap-2">
                  <Button onClick={() => onAddUser()} variant="outline"><UserPlus className="mr-2 h-4 w-4" /> Novo Usuário</Button>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white dark:bg-zinc-900 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                {users.map((u: any) => {
                  const isOnline = onlineUsers.some(ou => ou.userId === u.id);
                  return (
                    <div key={u.id} className="flex items-center justify-between p-4 sm:px-6 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          isOnline ? "bg-emerald-500 animate-pulse" : "bg-zinc-300 dark:bg-zinc-700"
                        )} />
                        <div>
                          <p className="font-medium dark:text-zinc-200">{u.username}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs sm:text-sm text-zinc-500 capitalize dark:text-zinc-400">
                              {u.role}
                            </p>
                            {u.role?.toLowerCase() === 'evento' && <span className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase">Evento</span>}
                            {isOnline && <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase">Online</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2">
                        {isOnline && u.role !== 'host' && (isHost || isAdmin) && (
                          <Button 
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Deseja realmente desconectar ${u.username}?`)) {
                                sendWS('USER_DISCONNECT', { userId: u.id });
                              }
                            }}
                            className="text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/30 gap-1"
                            title="Desconectar Usuário"
                          >
                            <LogOut className="h-4 w-4" />
                            <span className="hidden sm:inline">Desconectar</span>
                          </Button>
                        )}
                        {(u.role !== 'host' || isHost) && (u.username !== 'Dev' || currentUser.username === 'Dev') && (
                          <button 
                            onClick={() => onEditUser(u)} 
                            className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                        )}
                        {(u.username !== 'deckserrinha' && u.username !== 'Dev' && (u.role !== 'host' || isHost)) && (
                          <button 
                            onClick={() => deleteUser(u.id)} 
                            className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      case 'permissions':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <PermissionsSection settings={settings} sendWS={sendWS} />
            </div>
          </div>
        );
      case 'categories':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <CategoryDetailManager categories={categories} details={details} sendWS={sendWS} menu={menu} hasPermission={hasPermission} vibrate={vibrate} />
            </div>
          </div>
        );
      case 'tables_mgmt':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <TableManagement tables={tables} sendWS={sendWS} settings={settings} />
            </div>
          </div>
        );
      case 'printer':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <PrinterSettings 
                settings={settings} 
                sendWS={sendWS}
                managePrinterHub={managePrinterHub}
                setManagePrinterHub={setManagePrinterHub}
                printerHubUserRestriction={printerHubUserRestriction}
                setPrinterHubUserRestriction={setPrinterHubUserRestriction}
                users={users}
              />
            </div>
          </div>
        );
      case 'finance':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <FinanceSection 
                currentUser={currentUser} 
                cashierStatus={cashierStatus} 
                cashierTransactions={cashierTransactions}
                sendWS={sendWS} 
                allOrders={allOrders}
                hasPermission={hasPermission}
                printFinancialSlip={printFinancialSlip}
              />
            </div>
          </div>
        );
      case 'danger':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <section className="rounded-2xl border border-rose-100 bg-rose-50/30 p-6 shadow-sm dark:bg-rose-900/10 dark:border-rose-900/20">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-5 w-5 text-rose-600" />
                <h3 className="text-lg font-semibold text-rose-900 dark:text-rose-200">Ações de Limpeza</h3>
              </div>
              <p className="mb-6 text-sm text-rose-700 dark:text-rose-300">Estas ações são permanentes e não podem ser desfeitas. Use com cautela.</p>
              <div className="flex flex-col gap-3">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => sendWS('HISTORY_GET_ALL', {})}
                >
                  <Download className="mr-2 h-4 w-4" /> Baixar Histórico (PDF)
                </Button>
                <Button 
                  variant="danger" 
                  className="w-full"
                  onClick={() => {
                    setConfirmModal({
                      isOpen: true,
                      title: 'Limpar Histórico',
                      message: 'Deseja realmente limpar todo o histórico? Recomendamos baixar o backup antes.',
                      onConfirm: async () => {
                        try {
                            const res = await fetch('/api/admin/reset-history', { 
                                method: 'POST',
                                headers: { 'x-app-user-id': currentUser.id }
                            });
                            const data = await res.json();
                            if (data.success) {
                                toast.success('Histórico limpo!');
                                onResetHistory();
                            } else {
                                toast.error(data.message || 'Erro ao limpar histórico');
                            }
                        } catch (error) {
                            toast.error('Erro de conexão');
                        }
                        setConfirmModal({ ...confirmModal, isOpen: false });
                      }
                    });
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Limpar Histórico
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full text-rose-600 border-rose-200 hover:bg-rose-50"
                  onClick={() => setConfirmModal({
                    isOpen: true,
                    title: 'Resetar Todas as Mesas',
                    message: 'Esta ação irá liberar todas as mesas e excluir todos os pedidos ativos. Deseja continuar?',
                    onConfirm: () => {
                      sendWS('TABLES_RESET_ALL', { userId: currentUser?.id, username: currentUser?.username });
                      setConfirmModal({ ...confirmModal, isOpen: false });
                    }
                  })}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Resetar Todas as Mesas
                </Button>
              </div>
            </section>
          </div>
        );
      case 'cloud_status':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <CloudStatusDashboard usage={cloudUsage} supabaseStatus={syncStatus.supabase} />
            </div>
            <Button 
              className={cn("w-full transition-all", isSyncing ? "bg-zinc-400" : "bg-emerald-600 hover:bg-emerald-700")}
              onClick={handleManualSync}
              disabled={isSyncing}
            >
              {isSyncing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'products': return 'Produtos';
      case 'categories': return 'Categorias e Grupos';
      case 'users': return 'Equipe';
      case 'permissions': return 'Autorizações';
      case 'printer': return 'Impressora';
      case 'danger': return 'Ações de Limpeza';
      case 'cloud_status': return 'Monitoramento Cloud';
      default: return '';
    }
  };

  return (
    <div className="max-w-full">
      {activeSection === null ? (
        renderMenu()
      ) : (
        <div className="flex flex-col h-full">
          <div className="pt-2 pb-4 flex items-center gap-4 border-b border-zinc-200 dark:border-zinc-800">
            <button 
              onClick={() => setActiveSection(null)}
              className="p-2 -ml-2 rounded-full hover:bg-zinc-200 transition-colors dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <h2 className="text-xl md:text-2xl font-bold dark:text-zinc-100">{getSectionTitle()}</h2>
          </div>
          <div className="pt-6 space-y-6">
            {renderSectionContent()}
          </div>
        </div>
      )}


      <Modal 
        isOpen={confirmModal.isOpen} 
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title={confirmModal.title}
      >
        <div className="space-y-6">
          <p className="text-zinc-600 dark:text-zinc-400">{confirmModal.message}</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmModal.onConfirm}>
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
});

function ConfigTab({ 
  users, 
  settings, 
  darkMode, 
  setDarkMode, 
  fontSize,
  setFontSize,
  vibrationEnabled,
  setVibrationEnabled,
  notificationsEnabled, 
  setNotificationsEnabled, 
  soundEnabled, 
  setSoundEnabled, 
  managePrinterHub,
  setManagePrinterHub,
  printerHubUserRestriction,
  setPrinterHubUserRestriction,
  onRefreshUsers, 
  onAddUser, 
  onEditUser, 
  currentUser, 
  onUpdateCurrentUser, 
  onSaveSettings, 
  onResetHistory, 
  categories = [], 
  details = [], 
  sendWS, 
  menu = [],
  allOrders = [],
  vibrate,
  onlineUsers = [],
  cashierStatus = { status: 'closed' },
  cashierTransactions = [],
  accountsPayable = [],
  stockPurchases = [],
  tables = [],
  onAddMenu,
  onEditMenu,
  hasPermission,
  cloudUsage,
  syncStatus,
  isSyncing,
  handleManualSync
}: any) {
  const [isEditingHost, setIsEditingHost] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 150);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isHost = currentUser?.role === 'host' || currentUser?.username === 'Dev';
  const isAdmin = currentUser?.role === 'admin';

  const deleteUser = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Usuário',
      message: 'Tem certeza que deseja excluir este usuário?',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/users/${id}`, { 
            method: 'DELETE',
            headers: { 'x-app-user-id': currentUser.id }
          });
          const data = await res.json();
          if (data.success) {
            onRefreshUsers();
            toast.success('Usuário removido');
          } else {
            toast.error(data.message || 'Erro ao remover usuário');
          }
        } catch (error) {
          toast.error('Erro de conexão ao remover usuário');
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      }
    });
  };

  const renderMenu = () => (
    <div className="max-w-full px-2 md:px-0 space-y-2">
      <h2 className="text-2xl font-bold mb-6 dark:text-zinc-100">Configurações</h2>
      
      <button 
        onClick={() => setActiveSection('general')}
        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
      >
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Settings className="h-6 w-6" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Geral</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Tema e acesso</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-zinc-400" />
      </button>

      <button 
        onClick={() => setActiveSection('account')}
        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
      >
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <UserIcon className="h-6 w-6" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Minha Conta</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Alterar usuário e senha</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-zinc-400" />
      </button>

      <button 
        onClick={() => setActiveSection('whatsnew')}
        className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
      >
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Novidades</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">O que mudou na versão 1.1.8</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-zinc-400" />
      </button>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'general':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", darkMode ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-600")}>
                      {darkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="font-medium dark:text-zinc-200">Modo Noturno</p>
                      <p className="text-xs text-zinc-500">Alternar entre tema claro e escuro</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setDarkMode(!darkMode)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
                      darkMode ? 'bg-emerald-600' : 'bg-zinc-200'
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      darkMode ? 'translate-x-6' : 'translate-x-1'
                    )} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", notificationsEnabled ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400")}>
                      <Bell className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium dark:text-zinc-200">Notificações na Tela</p>
                      <p className="text-xs text-zinc-500">Exibir alertas pop-up no sistema</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
                      notificationsEnabled ? 'bg-emerald-600' : 'bg-zinc-200'
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      notificationsEnabled ? 'translate-x-6' : 'translate-x-1'
                    )} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", soundEnabled ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400")}>
                      <Volume2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium dark:text-zinc-200">Som de Notificação</p>
                      <p className="text-xs text-zinc-500">Tocar som ao receber alertas</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
                      soundEnabled ? 'bg-emerald-600' : 'bg-zinc-200'
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      soundEnabled ? 'translate-x-6' : 'translate-x-1'
                    )} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", vibrationEnabled ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400")}>
                      <RefreshCw className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium dark:text-zinc-200">Vibração ao Toque</p>
                      <p className="text-xs text-zinc-500">Vibrar o dispositivo em interações</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setVibrationEnabled(!vibrationEnabled)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
                      vibrationEnabled ? 'bg-emerald-600' : 'bg-zinc-200'
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      vibrationEnabled ? 'translate-x-6' : 'translate-x-1'
                    )} />
                  </button>
                </div>

                <div className="border-t border-zinc-100 pt-6 dark:border-zinc-800">
                  <h4 className="text-sm font-bold uppercase text-zinc-400 mb-4">Acessibilidade</h4>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <label className="font-medium dark:text-zinc-200">Tamanho da Fonte</label>
                        <span className="text-zinc-500">{fontSize}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="12" 
                        max="24" 
                        value={fontSize} 
                        onChange={(e) => setFontSize(e.target.value)}
                        className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 dark:bg-zinc-800"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'account':
        if (!currentUser) return null;
        const avatars = ['👤', '👨‍🍳', '👩‍🍳', '🍕', '🍔', '🍣', '🍝', '🥩', '🥗', '🍰', '☕', '🍺', '🍹', '🍷'];
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <h3 className="text-sm font-medium mb-4 dark:text-zinc-300">Foto de Perfil</h3>
              <div className="flex flex-wrap gap-3 mb-6">
                {avatars.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => onUpdateCurrentUser({ ...currentUser, avatar: emoji })}
                    className={cn(
                      "h-12 w-12 flex items-center justify-center text-2xl rounded-xl border-2 transition-all",
                      currentUser.avatar === emoji 
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" 
                        : "border-zinc-100 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const username = formData.get('username') as string;
                onUpdateCurrentUser({ ...currentUser, username });
                toast.success('Perfil atualizado (Preview)');
              }} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-400">Usuário</label>
                  <Input name="username" defaultValue={currentUser.username} required />
                </div>
                <Button type="submit" className="w-full">Salvar Alterações</Button>
              </form>
            </div>
          </div>
        );
      case 'users':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium dark:text-zinc-300">Equipe e Usuários</h3>
                {(isHost || isAdmin) && (
                  <Button onClick={onAddUser} size="sm" className="h-8">
                    <UserPlus className="h-4 w-4 mr-2" /> Novo
                  </Button>
                )}
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {users.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 flex items-center justify-center text-xl bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                        {u.avatar || '👤'}
                      </div>
                      <div>
                        <p className="font-medium dark:text-zinc-200">{u.username}</p>
                        <p className="text-xs text-zinc-500 capitalize">{u.role}</p>
                      </div>
                    </div>
                    {(isHost || isAdmin) && u.username !== 'Dev' && (
                      <div className="flex gap-1">
                        <button 
                          onClick={() => onEditUser(u)}
                          className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors dark:hover:bg-blue-900/20"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => deleteUser(u.id)}
                          className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors dark:hover:bg-rose-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'whatsnew':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <h3 className="text-lg font-bold mb-4 dark:text-zinc-100">Novidades da Versão 1.1.8 beta</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Confira as principais melhorias implementadas na versão 1.1.8 beta:</p>
              
              <div className="space-y-6">
                <section>
                  <h4 className="text-xs font-bold uppercase text-emerald-600 mb-3 dark:text-emerald-400">1. Segurança Reforçada</h4>
                  <ul className="space-y-3">
                    <li className="flex gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                      <div className="h-5 w-5 shrink-0 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">1</div>
                      <p><strong>Privacidade de Banco de Dados:</strong> O acesso às informações de diagnóstico (schema) e estrutura de usuários via API foi blindado, liberado somente para administradores. Isso fecha falhas de segurança e exposição sensível de dados.</p>
                    </li>
                    <li className="flex gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                      <div className="h-5 w-5 shrink-0 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">2</div>
                      <p><strong>Versionamento do Banco:</strong> O sistema interno de banco de dados agora possui versionamento de migrações (Schema Migrations). Isso previne a duplicação de dados, erros fatais e aumenta o controle completo da integridade das atualizações.</p>
                    </li>
                  </ul>
                </section>
                
                <section>
                  <h4 className="text-xs font-bold uppercase text-emerald-600 mb-3 dark:text-emerald-400">2. Performance e Organização</h4>
                  <ul className="space-y-3">
                    <li className="flex gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                      <div className="h-5 w-5 shrink-0 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">1</div>
                      <p><strong>Componentização Inteligente:</strong> Todas as rotinas que carregavam a aplicação no mesmo lugar foram estruturadas e separadas por contexto. A aba de Finanças, Contas a Pagar e Cardápio agora funcionam de forma modular, acelerando a interface.</p>
                    </li>
                  </ul>
                </section>

                <section>
                  <h4 className="text-xs font-bold uppercase text-emerald-600 mb-3 dark:text-emerald-400">3. Novas Funcionalidades e Correções</h4>
                  <ul className="space-y-3">
                    <li className="flex gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                      <div className="h-5 w-5 shrink-0 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">1</div>
                      <p><strong>Paginação Otimizada:</strong> A aba de Histórico, que sobrecarregava com os muitos lançamentos, recebeu divisão automática em páginas, não comprometendo mais a memória em longas operações.</p>
                    </li>
                    <li className="flex gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                      <div className="h-5 w-5 shrink-0 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">2</div>
                      <p><strong>Confirmação de Impressões:</strong> Agora o fluxo de interações com a maquininha está mais otimizado fechando ou mostrando o balão de recibo imediatamente sem gargalo na rede local.</p>
                    </li>
                  </ul>
                </section>

              </div>
            </div>
          </div>
        );
      case 'cloud_status':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <CloudStatusDashboard usage={cloudUsage} supabaseStatus={syncStatus.supabase} />
            </div>
            <Button 
              className={cn("w-full transition-all", isSyncing ? "bg-zinc-400" : "bg-emerald-600 hover:bg-emerald-700")}
              onClick={handleManualSync}
              disabled={isSyncing}
            >
              {isSyncing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'account': return 'Minha Conta';
      case 'general': return 'Geral';
      case 'users': return 'Equipe';
      case 'whatsnew': return 'Novidades';
      default: return '';
    }
  };

  return (
    <div className="max-w-full px-2 md:px-0">
      <ConfirmModal 
        isOpen={confirmModal.isOpen} 
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })} 
        title={confirmModal.title} 
        message={confirmModal.message} 
        onConfirm={confirmModal.onConfirm} 
      />

      {activeSection === null ? (
        renderMenu()
      ) : (
        <div className="space-y-6 relative">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setActiveSection(null)}
              className="p-2 -ml-2 rounded-full hover:bg-zinc-100 transition-colors dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <h2 className="text-2xl font-bold dark:text-zinc-100">{getSectionTitle()}</h2>
          </div>
          {renderSectionContent()}
          
          {showScrollTop && (
            <button 
              type="button"
              className="fixed bottom-6 right-6 z-[60] p-3 rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 hover:shadow-xl transition-all hover:-translate-y-1"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <ChevronUp className="h-6 w-6" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const HistoryTab = React.memo(function HistoryTab({ events, menu = [], tables = [], canMarkRead, onMarkRead, transferRequests = [], onApproveTransfer, onRejectTransfer, hasTransferPermission, hasReprintPermission, onReprintHistory, hasDeletePermission, onDeleteHistory, currentUser, users = [] }: { events: any[]; menu?: any[]; tables?: any[]; canMarkRead: boolean; onMarkRead: (id: string) => void; transferRequests?: any[]; onApproveTransfer?: (id: string) => void; onRejectTransfer?: (id: string) => void; hasTransferPermission?: boolean; hasReprintPermission?: boolean; onReprintHistory?: (event: any) => void; hasDeletePermission?: boolean; onDeleteHistory?: (id: string) => void; currentUser?: any; users?: any[] }) {
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  
  const findTableNumber = (idStr: string | number) => {
    if (idStr === -1 || idStr === "-1") return "Balcão";
    const t = tables.find(t => String(t.id) === String(idStr));
    return t ? formatTableNumber(t.number) : formatTableNumber(idStr);
  };

  const roleFilteredEvents = events.filter(event => {
    if (currentUser?.role?.toLowerCase() !== 'evento') return true;
    
    // Check if event is made by this user or another 'evento' user
    const eventMakerRole = users.find(u => u.id === event.user_id)?.role;
    const isEventUser = eventMakerRole?.toLowerCase() === 'evento' || event.user_id === currentUser.id;
    if (isEventUser) return true;
    
    // Check if it's an order for an event item
    const isEventItem = menu.some(m => m.is_event_item === 1 && event.details?.includes(m.name));
    return isEventItem;
  });

  const filteredEvents = roleFilteredEvents.filter(event => {
    const matchesUser = userFilter === '' || (event.username && event.username.toLowerCase().includes(userFilter.toLowerCase()));
    const matchesAction = actionFilter === '' || (event.action && event.action.includes(actionFilter));
    const matchesTable = tableFilter === '' || (event.table_id && event.table_id.toString() === tableFilter) || (event.details?.toLowerCase().includes(`mesa ${findTableNumber(tableFilter)}`));
    const matchesProduct = productFilter === '' || (event.details && event.details.toLowerCase().includes(productFilter.toLowerCase()));
    return matchesUser && matchesAction && matchesTable && matchesProduct;
  });

  const uniqueUsers = Array.from(new Set(roleFilteredEvents.map(e => e.username)));
  const uniqueActions = Array.from(new Set(roleFilteredEvents.map(e => e.action)));

  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const paginatedEvents = filteredEvents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <select 
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">Todas Ações</option>
          {uniqueActions.map((a: any) => a ? <option key={a} value={a}>{String(a).replace('_', ' ')}</option> : null)}
        </select>
        <select 
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
        >
          <option value="">Todos Usuários</option>
          {uniqueUsers.map((u: any) => <option key={u} value={u}>{u}</option>)}
        </select>
        <Input 
          placeholder="Mesa" 
          className="w-24" 
          value={tableFilter}
          onChange={(e) => setTableFilter(e.target.value)}
        />
        <Input 
          placeholder="Produto / Detalhes" 
          className="flex-1 min-w-[200px]" 
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
        />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-x-auto dark:bg-zinc-900 dark:border-zinc-800">
        <table className="w-full text-left text-sm min-w-full sm:min-w-[600px]">
          <thead className="bg-zinc-50 text-zinc-500 uppercase text-[10px] sm:text-xs font-bold tracking-wider dark:bg-zinc-800 dark:text-zinc-400">
            <tr>
              {canMarkRead && <th className="px-3 py-3 sm:px-6 sm:py-3 w-10 sm:w-16">Visto</th>}
              <th className="px-3 py-3 sm:px-6 sm:py-3">Detalhes</th>
              <th className="px-3 py-3 sm:px-6 sm:py-3">Ação</th>
              <th className="px-3 py-3 sm:px-6 sm:py-3">Usuário</th>
              <th className="hidden sm:table-cell px-3 py-3 sm:px-6 sm:py-3">Horário</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {paginatedEvents.length === 0 ? (
              <tr>
                <td colSpan={canMarkRead ? 5 : 4} className="px-3 py-4 sm:px-6 sm:py-8 text-center text-zinc-400">Nenhuma movimentação encontrada</td>
              </tr>
            ) : (
              paginatedEvents.map(event => {
                const isPendingTransfer = (event.action === 'SOLICITAR_TRANSFERENCIA' || event.action === 'TABLE_TRANSFER_REQUEST') && 
                                        event.request_id && 
                                        transferRequests.find((r: any) => r.id === event.request_id && r.status === 'pending');

                let isItemPrintable = false;
                if (event.action === 'NOVO_PEDIDO' || event.action === 'EXCLUIR_PEDIDO') {
                  if (event.details) {
                    const menuItem = menu.find(m => event.details?.includes(`${m.name}`));
                    if (menuItem && menuItem.print_enabled !== 0 && menuItem.print_enabled !== false) {
                      isItemPrintable = true;
                    }
                  }
                }
                
                const isMadeByEventUser = users.find(u => u.id === event.user_id)?.role?.toLowerCase() === 'evento';

                return (
                  <tr key={event.id} className={cn(
                    "hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors", 
                    event.is_read === 1 && "opacity-50",
                    isMadeByEventUser && "bg-orange-100/80 dark:bg-orange-900/40 border-l-4 border-l-orange-500"
                  )}>
                    {canMarkRead && (
                      <td className="px-3 py-3 sm:px-6 sm:py-4">
                        <input 
                          type="checkbox" 
                          checked={event.is_read === 1} 
                          onChange={() => onMarkRead(event.id)}
                          className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>
                    )}
                    <td className="px-3 py-3 sm:px-6 sm:py-4 text-zinc-900 dark:text-zinc-100 sm:whitespace-normal">
                      <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {event.table_id && (
                            <span className="text-zinc-900 dark:text-zinc-100 text-[10px] font-black tracking-wider">
                              MESA {findTableNumber(event.table_id)} —
                            </span>
                          )}
                          <span className="font-medium">
                            {(() => {
                              // Try to highlight quantity (e.g., "1x ")
                              const match = event.details?.match(/^(\d+x) (.*)$/);
                              if (match) {
                                return (
                                  <>
                                    <span className="text-zinc-900 dark:text-zinc-100 font-bold">{match[1]}</span> - {match[2].replace('(', '-(')}
                                  </>
                                );
                              }
                              
                              return event.details || '';
                            })()}
                          </span>
                        </div>
                        {isPendingTransfer && hasTransferPermission && (
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => onApproveTransfer?.(event.request_id!)}
                              className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                              Aprovar
                            </button>
                            <button
                              onClick={() => onRejectTransfer?.(event.request_id!)}
                              className="px-3 py-1 bg-zinc-200 text-zinc-600 text-[10px] font-bold rounded-lg hover:bg-zinc-300 transition-colors dark:bg-zinc-700 dark:text-zinc-300"
                            >
                              Recusar
                            </button>
                            {hasReprintPermission && isItemPrintable && event.action && event.details && event.details !== '' && (
                              <button
                                onClick={() => onReprintHistory?.(event)}
                                className="p-1.5 bg-zinc-100 text-zinc-500 rounded-lg hover:bg-zinc-200 hover:text-zinc-700 transition-colors dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-400"
                                title="Reimprimir / Segunda Via"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                        {(!isPendingTransfer || !hasTransferPermission) && hasReprintPermission && isItemPrintable && event.action && event.details && event.details !== '' && (
                          <div className="flex gap-2 mt-2">
                            {hasReprintPermission && isItemPrintable && event.action && event.details && event.details !== '' && (
                              <button
                                onClick={() => onReprintHistory?.(event)}
                                className="p-1.5 bg-zinc-100 text-zinc-500 rounded-lg hover:bg-zinc-200 hover:text-zinc-700 transition-colors dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-400"
                                title="Reimprimir / Segunda Via"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                            )}
                            {hasDeletePermission && (
                              <button
                                onClick={() => {
                                  if(confirm('Tem certeza que deseja excluir esta linha do histórico?')) {
                                    onDeleteHistory?.(event.id);
                                  }
                                }}
                                className="p-1.5 bg-zinc-100 text-zinc-500 rounded-lg hover:bg-rose-100 hover:text-rose-600 transition-colors dark:bg-zinc-800 dark:hover:bg-rose-900/40 dark:text-zinc-400 dark:hover:text-rose-400"
                                title="Excluir Ocorrência"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4">
                      <span className={cn(
                        "rounded-full px-2.5 py-1 text-[10px] sm:text-[11px] font-black uppercase whitespace-nowrap shadow-sm border",
                        event.action === 'EXCLUIR_PEDIDO' ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800" :
                        event.action === 'PEDIR_CONTA' ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" :
                        event.action === 'FECHAR_MESA' ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800" :
                        event.action === 'ABRIR_MESA' ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800" :
                        event.action === 'NOVO_PEDIDO' ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800" :
                        "bg-zinc-50 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700"
                      )}>
                        {event.action ? String(event.action).replace('_', ' ') : 'Desconhecida'}
                      </span>
                    </td>
                    <td className="px-3 py-3 sm:px-6 sm:py-4">
                      <div className="font-medium dark:text-zinc-200 truncate max-w-[100px] sm:max-w-none">{event.username}</div>
                      <div className="text-xs sm:hidden text-zinc-400 dark:text-zinc-500 mt-0.5">{format(new Date(event.timestamp), 'HH:mm:ss')}</div>
                    </td>
                    <td className="hidden sm:table-cell px-3 py-3 sm:px-6 sm:py-4 text-zinc-400 dark:text-zinc-500">{format(new Date(event.timestamp), 'HH:mm:ss')}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Página <span className="font-bold text-zinc-900 dark:text-zinc-100">{currentPage}</span> de <span className="font-bold text-zinc-900 dark:text-zinc-100">{totalPages}</span>
            </span>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              >
                Anterior
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              >
                Próximo
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

function AddUserModal({ isOpen, onClose, onSuccess, currentUser, settings, initialRole }: any) {
  const customRoles = settings?.custom_roles ? (typeof settings.custom_roles === 'string' ? JSON.parse(settings.custom_roles) : settings.custom_roles) : [];
  const allRolesList = [...new Set(['host', ...customRoles])];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Usuário">
      <form onSubmit={async (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-app-user-id': currentUser?.id
          },
          body: JSON.stringify(Object.fromEntries(formData))
        });
        if (res.ok) {
          toast.success('Usuário criado!');
          onSuccess();
          onClose();
        } else {
          const data = await res.json();
          toast.error(data.message || 'Erro ao criar usuário');
        }
      }} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Login</label>
          <Input name="username" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Senha</label>
          <Input name="password" type="password" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium dark:text-zinc-300">Cargo</label>
          <select name="role" defaultValue={initialRole || undefined} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
            {allRolesList.filter(r => r !== 'host' || currentUser?.role === 'host').map(role => (
              <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
            ))}
          </select>
        </div>
        <Button type="submit" className="w-full">Criar Usuário</Button>
      </form>
    </Modal>
  );
}

function EditUserModal({ isOpen, onClose, user, onSuccess, currentUser, settings }: any) {
  if (!user) return null;

  const customRoles = settings?.custom_roles ? (typeof settings.custom_roles === 'string' ? JSON.parse(settings.custom_roles) : settings.custom_roles) : [];
  const allRolesList = [...new Set(['host', ...customRoles])];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Editar Usuário: ${user.username}`}>
      <form onSubmit={async (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);
        if (!data.password) delete data.password;

        const res = await fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'x-app-user-id': currentUser?.id
          },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          toast.success('Usuário atualizado!');
          onSuccess();
          onClose();
        } else {
          const resData = await res.json();
          toast.error(resData.message || 'Erro ao atualizar usuário');
        }
      }} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Login</label>
          <Input name="username" defaultValue={user.username} required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Nova Senha (vazio para manter)</label>
          <Input name="password" type="password" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium dark:text-zinc-300">Cargo</label>
          <select 
            name="role" 
            defaultValue={user.role} 
            disabled={user.username === 'Dev'}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {allRolesList.filter(r => r !== 'host' || currentUser?.role === 'host' || user.role === 'host').map(role => (
              <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>
            ))}
          </select>
          {user.role === 'host' && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">O cargo Host é protegido.</p>
          )}
        </div>
        <Button type="submit" className="w-full">Salvar Alterações</Button>
      </form>
    </Modal>
  );
}

function EditMenuModal({ isOpen, onClose, onSave, item, categories = [], details = [] }: any) {
  const [selectedCategory, setSelectedCategory] = useState(item?.type || '');
  const [selectedGroup, setSelectedGroup] = useState(item?.category || '');

  useEffect(() => {
    if (item) {
      setSelectedCategory(item.type || '');
      setSelectedGroup(item.category || '');
    }
  }, [item]);

  if (!item) return null;

  const filteredDetails = details.filter((d: any) => d.category_name === selectedCategory);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Produto">
      <form key={item.id} onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        onSave({
          id: item.id,
          name: formData.get('name'),
          price: parseFloat(formData.get('price') as string),
          type: formData.get('type'),
          category: formData.get('category'),
          active: formData.get('active') === 'on' ? 1 : 0,
          is_stockable: formData.get('is_stockable') === 'on' ? 1 : 0,
          is_solid: formData.get('is_solid') === 'on' ? 1 : 0,
          is_event_item: formData.get('is_event_item') === 'on' ? 1 : 0
        });
        onClose();
      }} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium dark:text-zinc-300">Nome</label>
          <Input name="name" defaultValue={item.name} required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium dark:text-zinc-300">Preço (R$)</label>
          <Input name="price" type="number" step="0.01" defaultValue={item.price} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium dark:text-zinc-300">Categoria</label>
            <select 
              name="type" 
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedGroup('');
              }}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
            >
              <option value="">Selecione...</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium dark:text-zinc-300">Grupo</label>
            <select 
              name="category" 
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
            >
              <option value="">Selecione...</option>
              {filteredDetails.map((g: any) => (
                <option key={g.id} value={g.name}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              name="active" 
              id="edit-active"
              defaultChecked={item.active !== 0} 
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
            />
            <label htmlFor="edit-active" className="text-sm font-medium dark:text-zinc-300">Item Ativo (Visível no cardápio)</label>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              name="is_stockable" 
              id="edit-stockable"
              defaultChecked={item.is_stockable === 1} 
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
            />
            <label htmlFor="edit-stockable" className="text-sm font-medium dark:text-zinc-300">Controlar estoque deste produto?</label>
          </div>

          <div className="flex items-center gap-2 pl-6">
            <input 
              type="checkbox" 
              name="is_solid" 
              id="edit-solid"
              defaultChecked={item.is_solid === 1} 
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
            />
            <label htmlFor="edit-solid" className="text-sm font-medium dark:text-zinc-300">Unidade sólida (contagem individual)</label>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              name="is_event_item" 
              id="edit-event-item"
              defaultChecked={item.is_event_item === 1} 
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
            />
            <label htmlFor="edit-event-item" className="text-sm font-medium dark:text-zinc-300">Marcar como Item de Evento</label>
          </div>
        </div>

        <Button type="submit" className="w-full">Salvar Alterações</Button>
      </form>
    </Modal>
  );
}

function AddMenuModal({ isOpen, onClose, onSave, categories = [], details = [] }: any) {
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedCategory('');
    }
  }, [isOpen]);

  const filteredDetails = details.filter((d: any) => d.category_name === selectedCategory);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Novo Produto">
      <form onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        onSave({
          name: formData.get('name'),
          price: parseFloat(formData.get('price') as string),
          type: formData.get('type'),
          category: formData.get('category'),
          active: formData.get('active') === 'on' ? 1 : 0,
          is_stockable: formData.get('is_stockable') === 'on' ? 1 : 0,
          is_solid: formData.get('is_solid') === 'on' ? 1 : 0,
          is_event_item: formData.get('is_event_item') === 'on' ? 1 : 0
        });
        onClose();
      }} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium dark:text-zinc-300">Nome</label>
          <Input name="name" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium dark:text-zinc-300">Preço (R$)</label>
          <Input name="price" type="number" step="0.01" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium dark:text-zinc-300">Categoria</label>
            <select 
              name="type" 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
            >
              <option value="">Selecione...</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium dark:text-zinc-300">Grupo</label>
            <select name="category" className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
              <option value="">Selecione...</option>
              {filteredDetails.map((g: any) => (
                <option key={g.id} value={g.name}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              name="active" 
              id="add-active"
              defaultChecked={true} 
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
            />
            <label htmlFor="add-active" className="text-sm font-medium dark:text-zinc-300">Item Ativo (Visível no cardápio)</label>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              name="is_stockable" 
              id="add-stockable"
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
            />
            <label htmlFor="add-stockable" className="text-sm font-medium dark:text-zinc-300">Controlar estoque deste produto?</label>
          </div>

          <div className="flex items-center gap-2 pl-6">
            <input 
              type="checkbox" 
              name="is_solid" 
              id="add-solid"
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
            />
            <label htmlFor="add-solid" className="text-sm font-medium dark:text-zinc-300">Unidade sólida (contagem individual)</label>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              name="is_event_item" 
              id="add-event-item"
              className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
            />
            <label htmlFor="add-event-item" className="text-sm font-medium dark:text-zinc-300">Marcar como Item de Evento</label>
          </div>
        </div>
        <Button type="submit" className="w-full">Salvar Produto</Button>
      </form>
    </Modal>
  );
}

function OrderModal({ isOpen, onClose, menu, categories = [], details = [], onSend, vibrate, isDirectCheckout = false }: any) {
  const [cart, setCart] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingObservation, setEditingObservation] = useState<string | null>(null);
  const [observationText, setObservationText] = useState("");
  const [isConfirmingSend, setIsConfirmingSend] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCart([]);
      setActiveCategory(null);
      setActiveGroup(null);
      setSearch("");
      setEditingObservation(null);
      setObservationText("");
    }
  }, [isOpen]);

  const addToCart = (item: any) => {
    vibrate(30);
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        // Move to the end so it appears at top when reversed
        const filtered = prev.filter(i => i.id !== item.id);
        return [...filtered, { ...existing, quantity: existing.quantity + 1 }];
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    setSearch('');
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const updateObservation = (id: string, obs: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, observation: obs };
      }
      return item;
    }));
  };

  const filteredMenu = useMemo(() => {
    const filtered = menu.filter((item: any) => {
      if (item.active === 0) return false;
      
      if (search) {
        const normalizedSearch = search.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const normalizedName = item.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return normalizedName.includes(normalizedSearch);
      }
      
      const matchesCategory = activeCategory ? item.type === activeCategory : true;
      const matchesGroup = activeGroup ? item.category === activeGroup : true;
      
      return matchesCategory && matchesGroup;
    });

    return filtered;
  }, [menu, search, activeCategory, activeGroup]);

  const groupedMenu = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    filteredMenu.forEach(item => {
      const groupName = item.category || 'Outros';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(item);
    });
    return Object.keys(groups).sort((a, b) => {
      if (a === 'Outros') return 1;
      if (b === 'Outros') return -1;
      const groupA = details.find((g: any) => g.name === a);
      const groupB = details.find((g: any) => g.name === b);
      const orderA = groupA?.sort_order ?? 999;
      const orderB = groupB?.sort_order ?? 999;
      return orderA - orderB;
    }).map(key => ({
      name: key,
      items: groups[key].sort((a, b) => a.name.localeCompare(b.name))
    }));
  }, [filteredMenu, details]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adicionar Pedido" maxWidth="max-w-2xl">
      <div className="flex flex-col gap-4 max-h-[85vh] md:max-h-[80vh]">
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 pb-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar itens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 transition-all"
            />
          </div>

          {!search && activeCategory && (
            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-xl border border-emerald-100 dark:border-emerald-800/50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <button 
                  onClick={() => { 
                    vibrate(20);
                    setActiveCategory(null); 
                    setActiveGroup(null); 
                  }} 
                  className="hover:underline"
                >
                  Categorias
                </button>
                <ChevronRight className="h-4 w-4" />
                <span className="font-bold text-emerald-900 dark:text-emerald-100">{activeCategory}</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 px-3 text-xs font-bold bg-white dark:bg-zinc-900 shadow-sm border border-emerald-200 dark:border-emerald-800 text-emerald-600 hover:bg-emerald-50"
                onClick={() => {
                  vibrate(20);
                  setActiveCategory(null);
                  setActiveGroup(null);
                }}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Voltar
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain space-y-4 pr-2 -mr-2" style={{ WebkitOverflowScrolling: 'touch' }}>

          {search ? (
            <div className="space-y-2">
              {filteredMenu.map((item: any) => (
                <button 
                  key={item.id} 
                  onClick={() => {
                    vibrate(30);
                    addToCart(item);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-zinc-100 p-4 hover:bg-zinc-50 transition-all hover:border-emerald-200 dark:border-zinc-800 dark:hover:bg-zinc-800/50 dark:hover:border-emerald-900/50"
                >
                  <div className="text-left">
                    <p className="text-sm font-bold dark:text-zinc-100">{item.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.type} • {item.category} • {formatCurrency(item.price)}</p>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Plus className="h-4 w-4" />
                  </div>
                </button>
              ))}
              {filteredMenu.length === 0 && (
                <div className="py-12 text-center space-y-2">
                  <Search className="h-12 w-12 text-zinc-200 dark:text-zinc-800 mx-auto" />
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Nenhum item encontrado para "{search}".
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              {!activeCategory ? (
                <div className="grid grid-cols-3 gap-2 pb-4">
                  {categories.map((c: any) => {
                    const count = menu.filter((m: any) => m.active !== 0 && m.type === c.name).length;
                    if (count === 0) return null;
                    return (
                      <button 
                        key={c.id} 
                        onClick={() => {
                          vibrate(30);
                          setActiveCategory(c.name);
                        }}
                        className="flex flex-col items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm transition-all hover:border-emerald-500 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500 group"
                      >
                        <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 text-center leading-tight line-clamp-2">{c.name}</span>
                        <div className="flex items-center gap-1">
                          <Tags className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                          <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">{count} itens</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-8 pb-4">
                  {groupedMenu.map(({ name: groupName, items }: any) => (
                    <div key={groupName} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-500">
                          {groupName}
                        </h4>
                        <div className="h-[2px] flex-1 bg-gradient-to-r from-emerald-100 to-transparent dark:from-emerald-900/30" />
                      </div>
                      <div className="grid gap-2">
                        {items.map((item: any) => (
                          <button 
                            key={item.id} 
                            onClick={() => {
                              vibrate(30);
                              addToCart(item);
                            }}
                            className="flex w-full items-center justify-between rounded-xl border border-zinc-100 p-4 hover:bg-zinc-50 transition-all hover:border-emerald-200 dark:border-zinc-800 dark:hover:bg-zinc-800/50 dark:hover:border-emerald-900/50"
                          >
                            <div className="text-left">
                              <p className="text-sm font-bold dark:text-zinc-100">{item.name}</p>
                              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">{formatCurrency(item.price)}</p>
                            </div>
                            <div className="h-8 w-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                              <Plus className="h-4 w-4" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-zinc-100 pt-4 space-y-4">
          <h4 className="text-xs font-bold uppercase text-zinc-400 flex items-center justify-between">
            <span>Carrinho</span>
            {cart.length > 0 && (
              <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full text-[10px]">
                {cart.reduce((acc, item) => acc + item.quantity, 0)} {cart.reduce((acc, item) => acc + item.quantity, 0) === 1 ? 'item' : 'itens'}
              </span>
            )}
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            {[...cart].reverse().map(item => (
              <div key={item.id} className="flex flex-col gap-2 rounded-lg bg-zinc-50 p-2 text-sm dark:bg-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center rounded-md border border-zinc-200 bg-white dark:bg-zinc-700 dark:border-zinc-600">
                      <button 
                        onClick={() => updateQuantity(item.id, -1)}
                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-600 rounded-l-md disabled:opacity-50"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-xs font-medium dark:text-zinc-200">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, 1)}
                        className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-600 rounded-r-md"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="dark:text-zinc-200 font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => {
                        if (editingObservation === item.id) {
                          setEditingObservation(null);
                        } else {
                          setEditingObservation(item.id);
                          setObservationText(item.observation || '');
                        }
                      }} 
                      className={cn(
                        "p-1.5 rounded transition-colors",
                        item.observation 
                          ? "text-amber-600 bg-amber-50 hover:bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30 dark:hover:bg-amber-900/50" 
                          : "text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      )}
                      title="Adicionar observação"
                    >
                      <MessageSquareText className="h-4 w-4" />
                    </button>
                    <button onClick={() => removeFromCart(item.id)} className="text-rose-500 hover:bg-rose-100 p-1 rounded dark:hover:bg-rose-900/20 transition-colors" title="Remover">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {editingObservation === item.id ? (
                  <div className="flex items-center gap-2 mt-2">
                    <Input 
                      autoFocus
                      value={observationText}
                      onChange={(e) => setObservationText(e.target.value)}
                      placeholder="Ex: Sem cebola..."
                      className="h-8 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          updateObservation(item.id, observationText);
                          setEditingObservation(null);
                        } else if (e.key === 'Escape') {
                          setEditingObservation(null);
                        }
                      }}
                    />
                    <Button 
                      size="sm" 
                      className="h-8 px-2"
                      onClick={() => {
                        updateObservation(item.id, observationText);
                        setEditingObservation(null);
                      }}
                    >
                      Salvar
                    </Button>
                  </div>
                ) : item.observation ? (
                  <div className="text-xs text-amber-600 dark:text-amber-400 italic pl-1 flex items-center gap-1 mt-1">
                    <StickyNote className="h-3 w-3" />
                    <span>Obs: {item.observation}</span>
                  </div>
                ) : null}
              </div>
            ))}
            {cart.length === 0 && <p className="text-center text-sm text-zinc-400 py-4">Carrinho vazio</p>}
          </div>
          <Button 
            disabled={cart.length === 0} 
            className="w-full" 
            onClick={() => {
              setIsConfirmingSend(true);
            }}
          >
            Enviar Pedido
          </Button>
        </div>
      </div>

      <Modal
        isOpen={isConfirmingSend}
        onClose={() => setIsConfirmingSend(false)}
        title="Confirmar Pedido"
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="text-zinc-600 dark:text-zinc-400">Tem certeza que deseja enviar estes {cart.reduce((acc, i) => acc + i.quantity, 0)} itens?</p>
            <div className="max-h-40 overflow-y-auto border rounded-xl divide-y bg-zinc-50 dark:bg-zinc-900/50 dark:border-zinc-800">
              {[...cart].reverse().map(item => (
                <div key={item.id} className="p-3 text-sm flex justify-between">
                  <span>{item.quantity}x {item.name}</span>
                  <span className="text-zinc-500 font-medium">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center text-lg font-bold border-t pt-4 px-2">
              <span>TOTAL</span>
              <span className="text-emerald-600">{formatCurrency(cart.reduce((acc, i) => acc + (i.price * i.quantity), 0))}</span>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsConfirmingSend(false)}>Cancelar</Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700" 
              onClick={() => {
                vibrate([50, 100, 50]);
                onSend(cart.map(i => ({ 
                  menuItemId: i.id, 
                  quantity: i.quantity, 
                  observation: i.observation,
                  name: i.name,
                  print_enabled: i.print_enabled
                })));
                setIsConfirmingSend(false);
                onClose();
              }}
            >
              Confirmar e Enviar
            </Button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}

function CloudStatusDashboard({ usage, supabaseStatus }: any) {
  const formatValue = (val: number) => val?.toLocaleString('pt-BR') || '0';
  
  const metrics = [
    { label: 'Armazenamento Supabase', value: usage?.supabase_storage || 0, limit: 500 * 1024 * 1024, icon: <Globe className="h-4 w-4 text-emerald-500" />, color: 'emerald', isBytes: true },
    { label: 'Requisições Cloud Run', value: usage?.request_count, limit: 66000, icon: <Activity className="h-4 w-4" />, color: 'purple', isBytes: false },
  ];

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold flex items-center gap-2 dark:text-zinc-100 text-lg">
          <Globe className="h-5 w-5 text-sky-500" /> Status da Nuvem
        </h3>
        <div className="flex items-center gap-2">
           <span className={cn(
             "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm border",
             supabaseStatus === 'connected' 
               ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' 
               : 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800'
           )}>
             Supabase: {supabaseStatus === 'connected' ? 'Online' : 'Offline'}
           </span>
        </div>
      </div>

      <div className="grid gap-4">
        {metrics.map(m => {
          const ratio = (m.value / m.limit) * 100;
          return (
            <div key={m.label} className="p-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 dark:bg-zinc-800/30 dark:border-zinc-800">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-zinc-600 dark:text-zinc-300">
                  {m.icon} {m.label}
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest bg-white dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-100 dark:border-zinc-700">Limite: {m.isBytes ? formatBytes(m.limit) : formatValue(m.limit)}</span>
              </div>
              <div className="flex items-end justify-between gap-4">
                 <div className="flex-1 pb-1">
                    <div className="h-2 w-full bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden shadow-inner">
                       <motion.div 
                         initial={{ width: 0 }}
                         animate={{ width: `${Math.min(100, ratio)}%` }}
                         className={cn(
                           "h-full rounded-full transition-all duration-1000",
                           ratio > 90 ? 'bg-rose-500' : ratio > 75 ? 'bg-amber-500' : 
                           m.color === 'blue' ? 'bg-blue-500' : 
                           m.color === 'amber' ? 'bg-amber-500' : 
                           m.color === 'emerald' ? 'bg-emerald-500' : 'bg-purple-500'
                         )}
                       />
                    </div>
                 </div>
                 <div className="flex flex-col items-end">
                    <span className="text-xl font-black text-zinc-900 dark:text-zinc-100">{m.isBytes ? formatBytes(m.value) : formatValue(m.value)}</span>
                    <span className="text-[10px] font-bold text-zinc-400 tabular-nums">{ratio.toFixed(1)}%</span>
                 </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 dark:bg-sky-900/20 dark:border-sky-900/40">
        <div className="flex gap-3">
          <Globe className="h-5 w-5 text-sky-600 shrink-0" />
          <p className="text-xs text-sky-800 dark:text-sky-300 leading-relaxed font-medium">
            <b>ARMAZENAMENTO:</b> Todos os dados do sistema estão centralizados no Supabase. Use o botão "Sincronizar Cloud" para garantir que os dados locais estejam atualizados.
          </p>
        </div>
      </div>
    </div>
  );
}

function PermissionsSection({ settings, sendWS }: any) {
  const [roles, setRoles] = useState<string[]>(() => {
    try {
      const custom = settings.custom_roles ? (typeof settings.custom_roles === 'string' ? JSON.parse(settings.custom_roles) : settings.custom_roles) : [];
      return [...new Set(['host', ...custom])];
    } catch (e) {
      return ['host'];
    }
  });

  const [activeRole, setActiveRole] = useState(roles[0]);
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editRoleName, setEditRoleName] = useState('');

  const permissions = [
    { id: 'mesas', label: 'Ver Mesas/Balcão', category: 'Navegação' },
    { id: 'historico', label: 'Ver Histórico', category: 'Navegação' },
    { id: 'cardapio', label: 'Ver Cardápio', category: 'Navegação' },
    { id: 'gestao', label: 'Acesso à Gestão', category: 'Navegação' },
    { id: 'config', label: 'Acesso à Configuração', category: 'Navegação' },
    
    { id: 'erp', label: 'Financeiro (Resumo)', category: 'Administração' },
    { id: 'manage_permissions', label: 'Acesso a Autorizações', category: 'Administração' },
    { id: 'edit_menu', label: 'Editar Menu (Produtos/Preços)', category: 'Administração' },
    { id: 'manage_users', label: 'Gerenciar Equipe', category: 'Administração' },
    { id: 'manage_categories', label: 'Gerenciar Categorias', category: 'Administração' },
    { id: 'manage_tables', label: 'Gerenciar Layout de Mesas', category: 'Administração' },
    { id: 'manage_printer', label: 'Configurar Impressora', category: 'Administração' },
    
    { id: 'delete_order', label: 'Excluir Pedidos/Itens', category: 'Operação' },
    { id: 'apply_discount', label: 'Aplicar Descontos', category: 'Operação' },
    { id: 'remove_service_fee', label: 'Remover Taxa de Serviço', category: 'Operação' },
    { id: 'edit_payment', label: 'Editar Pagamentos no Caixa', category: 'Operação' },
    { id: 'transfer_table', label: 'Transferir Mesas', category: 'Operação' },
    
    { id: 'clear_history', label: 'Apagar Histórico Total', category: 'Segurança' },
    { id: 'delete_history', label: 'Excluir Ocorrências Unitárias', category: 'Segurança' },
    { id: 'mark_history_read', label: 'Marcar Ocorrências como Lidas', category: 'Segurança' },
    { id: 'reprint_history', label: 'Reimprimir do Histórico', category: 'Segurança' },
  ];

  const categories = Array.from(new Set(permissions.map(p => p.category)));

  const [localPermissions, setLocalPermissions] = useState<any>(() => {
    const initial: any = {};
    roles.forEach(role => {
      const perms = settings[`permissions_${role}`];
      initial[role] = perms ? (typeof perms === 'string' ? JSON.parse(perms) : perms) : {};
    });
    return initial;
  });

  const [saving, setSaving] = useState(false);

  const togglePermission = (role: string, permissionId: string) => {
    setLocalPermissions((prev: any) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permissionId]: !prev[role][permissionId]
      }
    }));
  };

  const handleSave = () => {
    setSaving(true);
    const updates: any = {};
    roles.forEach(role => {
      updates[`permissions_${role}`] = JSON.stringify(localPermissions[role] || {});
    });
    
    // Save custom roles list
    const customRolesOnly = roles.filter(r => r !== 'host');
    updates['custom_roles'] = JSON.stringify(customRolesOnly);

    sendWS('SETTINGS_UPDATE', updates);
    
    setTimeout(() => {
      setSaving(false);
      toast.success('Autorizações e Cargos atualizados com sucesso!');
    }, 500);
  };

  const handleAddRole = () => {
    if (!newRoleName.trim()) return;
    const cleanName = newRoleName.trim().toLowerCase().replace(/\s+/g, '_');
    if (roles.includes(cleanName)) {
      toast.error('Este cargo já existe.');
      return;
    }
    setRoles(prev => [...prev, cleanName]);
    setLocalPermissions(prev => ({ ...prev, [cleanName]: {} }));
    setNewRoleName('');
    setIsAddingRole(false);
    setActiveRole(cleanName);
    toast.success(`Cargo "${cleanName}" adicionado.`);
  };

  const handleDeleteRole = (roleToDelete: string) => {
    if (['host'].includes(roleToDelete.toLowerCase())) {
      toast.error('O cargo Master (Host) não pode ser excluído.');
      return;
    }
    if (confirm(`Tem certeza que deseja excluir o cargo "${roleToDelete}"?`)) {
      sendWS('ROLE_DELETE', { roleName: roleToDelete });
      setRoles(prev => prev.filter(r => r !== roleToDelete));
      if (activeRole === roleToDelete) setActiveRole(roles[0]);
      toast.success(`Cargo "${roleToDelete}" removido.`);
    }
  };

  const handleRenameRole = () => {
    if (!editingRole || !editRoleName.trim()) return;
    const oldName = editingRole;
    const newName = editRoleName.trim().toLowerCase().replace(/\s+/g, '_');
    
    if (oldName === newName) {
      setEditingRole(null);
      return;
    }
    
    if (roles.includes(newName)) {
      toast.error('Este cargo já existe.');
      return;
    }

    sendWS('ROLE_RENAME', { oldName: oldName, newName: newName });
    
    setRoles(prev => prev.map(r => r === oldName ? newName : r));
    setLocalPermissions(prev => {
      const next = { ...prev };
      next[newName] = next[oldName];
      delete next[oldName];
      return next;
    });
    
    setActiveRole(newName);
    setEditingRole(null);
    toast.success(`Cargo renomeado para "${newName}".`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold dark:text-white">Controle de Autorizações</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Gerencie cargos e permissões do sistema.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsAddingRole(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Novo Cargo
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Tudo
          </Button>
        </div>
      </div>

      {isAddingRole && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10 flex flex-col md:flex-row gap-3 items-end md:items-center"
        >
          <div className="flex-1 w-full space-y-1">
            <label className="text-[10px] font-bold uppercase text-emerald-600">Nome do Novo Cargo</label>
            <Input 
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
              placeholder="Ex: Gerente, Supervisor..."
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleAddRole()}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Button variant="ghost" className="flex-1 md:flex-none" onClick={() => setIsAddingRole(false)}>Cancelar</Button>
            <Button className="flex-1 md:flex-none bg-emerald-600" onClick={handleAddRole}>Criar Cargo</Button>
          </div>
        </motion.div>
      )}

      {/* Roles Navigation/Selector - Better for Mobile */}
      <div className="flex flex-wrap gap-2 pb-2">
        {roles.map(role => (
          <div key={role} className="relative group">
            <div
              onClick={() => setActiveRole(role)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setActiveRole(role)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border-2 cursor-pointer",
                activeRole === role 
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-600/20" 
                  : "bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300"
              )}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
              {role.toLowerCase() !== 'host' && activeRole === role && (
                <div className="flex items-center gap-1 ml-1 border-l pl-2 border-white/20">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingRole(role);
                      setEditRoleName(role);
                    }}
                    className="p-1 hover:bg-white/20 rounded"
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteRole(role);
                    }}
                    className="p-1 hover:bg-white/20 rounded"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {editingRole && (
        <Modal isOpen={!!editingRole} onClose={() => setEditingRole(null)} title="Renomear Cargo">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Novo nome para o cargo</label>
              <Input 
                value={editRoleName}
                onChange={e => setEditRoleName(e.target.value)}
                placeholder="Nome do cargo"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setEditingRole(null)}>Cancelar</Button>
              <Button onClick={handleRenameRole}>Confirmar Renomeação</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Permission List for Active Role - Responsive View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map(category => (
          <div key={category} className="space-y-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800">
            <h4 className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest flex items-center gap-2">
              <Shield className="h-3 w-3" />
              {category}
            </h4>
            <div className="space-y-2">
              {permissions.filter(p => p.category === category).map(p => (
                <div 
                  key={p.id} 
                  className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 hover:border-emerald-200 transition-colors cursor-pointer group"
                  onClick={() => togglePermission(activeRole, p.id)}
                >
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{p.label}</span>
                  <button 
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-all",
                      localPermissions[activeRole]?.[p.id] 
                        ? "bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/20" 
                        : "bg-zinc-50 border-zinc-200 text-transparent group-hover:border-emerald-300 dark:bg-zinc-800 dark:border-zinc-700"
                    )}
                  >
                    <Check className={cn("h-4 w-4", localPermissions[activeRole]?.[p.id] ? "scale-100" : "scale-0 translate-y-1")} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 dark:bg-amber-900/10 dark:border-amber-800/30">
        <div className="flex gap-3">
          <ShieldCheck className="h-5 w-5 text-amber-600 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-400 space-y-1">
            <p className="font-bold">Privilégios de Host</p>
            <p>O cargo "Host" (dono) possui acesso total irreversível. Cargos personalizados podem ser criados e configurados acima.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrinterSettings({ 
  settings, 
  sendWS, 
  managePrinterHub, 
  setManagePrinterHub, 
  printerHubUserRestriction, 
  setPrinterHubUserRestriction, 
  users 
}: any) {
  const [isSearching, setIsSearching] = useState(false);
  const [foundPrinters, setFoundPrinters] = useState<any[]>([]);

  const handleSearch = () => {
    setIsSearching(true);
    setFoundPrinters([]);
    
    // Simulate printer discovery
    setTimeout(() => {
      const mockPrinters = [
        { id: '1', name: 'Impressora Térmica 80mm (Cozinha)', address: '192.168.1.101', type: 'network' },
        { id: '2', name: 'Impressora Térmica 58mm (Balcão)', address: '192.168.1.102', type: 'network' },
        { id: '3', name: 'Impressora USB (Local)', address: 'USB001', type: 'usb' }
      ];
      setFoundPrinters(mockPrinters);
      setIsSearching(false);
      toast.success('Busca concluída! Selecione uma impressora da lista.');
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4 border-b border-zinc-200 dark:border-zinc-800 pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", managePrinterHub ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400")}>
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium dark:text-zinc-200">Central de Impressão (Neste Aparelho)</p>
              <p className="text-xs text-zinc-500 max-w-sm">Torne este dispositivo o responsável por imprimir automaticamente os pedidos de todos os usuários.</p>
            </div>
          </div>
          <button 
            onClick={() => setManagePrinterHub(!managePrinterHub)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
              managePrinterHub ? 'bg-emerald-600' : 'bg-zinc-200'
            )}
          >
            <span className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
              managePrinterHub ? 'translate-x-6' : 'translate-x-1'
            )} />
          </button>
        </div>

        {managePrinterHub && (
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="space-y-2">
              <label className="text-xs uppercase font-bold text-zinc-500 tracking-wider">Restringir Hub para Usuário</label>
              <select 
                value={printerHubUserRestriction}
                onChange={(e) => setPrinterHubUserRestriction(e.target.value)}
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg h-10 px-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-zinc-200"
              >
                <option value="all">Qualquer usuário logado</option>
                {users?.map((u: any) => (
                  <option key={u.id} value={u.username}>{u.username} ({u.role})</option>
                ))}
              </select>
            </div>
            
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 dark:bg-amber-900/20 dark:border-amber-800 text-[10px] text-amber-800 dark:text-amber-300 leading-tight">
              <p className="font-bold mb-1 flex items-center gap-1">
                <Info className="h-3 w-3" /> ATENÇÃO
              </p>
              A impressão automática só ocorrerá se o usuário selecionado acima estiver utilizando este aparelho. Útil caso precise alternar entre funções no mesmo tablet.
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-emerald-600" />
          <h3 className="text-lg font-semibold dark:text-zinc-100">Busca de Impressoras (Rede)</h3>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleSearch}
          disabled={isSearching}
          className="gap-2"
        >
          {isSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar Impressoras
        </Button>
      </div>
      
      {foundPrinters.length > 0 && (
        <div className="p-4 rounded-xl border-2 border-emerald-100 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800/30 space-y-3">
          <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Impressoras Encontradas</h4>
          <div className="grid gap-2">
            {foundPrinters.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  const form = document.getElementById('printer-form') as HTMLFormElement;
                  if (form) {
                    (form.elements.namedItem('printer_type') as HTMLSelectElement).value = p.type;
                    (form.elements.namedItem('printer_address') as HTMLInputElement).value = p.address;
                  }
                  toast.success(`${p.name} selecionada!`);
                }}
                className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-800/50 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{p.name}</p>
                  <p className="text-xs text-zinc-500">{p.address} ({p.type.toUpperCase()})</p>
                </div>
                <ChevronRight className="h-4 w-4 text-emerald-500" />
              </button>
            ))}
          </div>
        </div>
      )}
      
      <form id="printer-form" onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data: any = {};
        formData.forEach((value, key) => data[key] = value);
        sendWS('SETTINGS_UPDATE', data);
        toast.success('Configurações de impressão salvas!');
      }} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium dark:text-zinc-400">Tipo de Impressora</label>
            <select name="printer_type" defaultValue={settings.printer_type || 'network'} className="w-full rounded-lg border border-zinc-200 p-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
              <option value="network">Rede (IP)</option>
              <option value="usb">USB (Nativo)</option>
              <option value="bluetooth">Bluetooth</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium dark:text-zinc-400">Endereço IP / Porta</label>
            <Input name="printer_address" defaultValue={settings.printer_address || '192.168.1.100'} placeholder="Ex: 192.168.1.100" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium dark:text-zinc-400">Largura do Papel (mm)</label>
            <select name="printer_width" defaultValue={settings.printer_width || '80'} className="w-full rounded-lg border border-zinc-200 p-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
              <option value="80">80mm</option>
              <option value="58">58mm</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium dark:text-zinc-400">Tamanho da Fonte</label>
            <select name="printer_font_size" defaultValue={settings.printer_font_size || 'medium'} className="w-full rounded-lg border border-zinc-200 p-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200">
              <option value="small">Pequena</option>
              <option value="medium">Média</option>
              <option value="large">Grande</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium dark:text-zinc-400">Cabeçalho do Cupom</label>
          <textarea name="printer_header" defaultValue={settings.printer_header || 'DECK SERRINHA\nObrigado pela preferência!'} className="w-full rounded-lg border border-zinc-200 p-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 h-20" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium dark:text-zinc-400">Rodapé do Cupom</label>
          <textarea name="printer_footer" defaultValue={settings.printer_footer || 'Volte sempre!'} className="w-full rounded-lg border border-zinc-200 p-2 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200 h-20" />
        </div>

        <Button type="submit" className="w-full">Salvar Configurações</Button>
      </form>
    </div>
  );
}

