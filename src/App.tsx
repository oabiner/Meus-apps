import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  AlertCircle,
  Users,
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
  ShieldCheck,
  Sparkles,
  Hash,
  Home,
  Trees,
  MoveRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { 
  User, 
  Table, 
  TableStatus, 
  MenuItem, 
  OrderItem, 
  WSEvent 
} from './types';
import { db } from '../firebase';
import { doc, getDocFromServer } from 'firebase/firestore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatTableNumber(num: number | string) {
  const n = typeof num === 'string' ? parseInt(num) : num;
  if (isNaN(n)) return num;
  return n < 10 ? `0${n}` : `${n}`;
}

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' }>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm dark:bg-emerald-700 dark:hover:bg-emerald-800',
      secondary: 'bg-zinc-800 text-white hover:bg-zinc-900 shadow-sm dark:bg-zinc-700 dark:hover:bg-zinc-600',
      danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm dark:bg-rose-700 dark:hover:bg-rose-800',
      outline: 'border border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800',
      ghost: 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500',
        className
      )}
      {...props}
    />
  )
);

const Modal = ({ isOpen, onClose, title, children, zIndex = 50, maxWidth = 'max-w-lg' }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; zIndex?: number; maxWidth?: string }) => (
  <AnimatePresence>
    {isOpen && (
      <div className={`fixed inset-0 flex items-center justify-center p-4`} style={{ zIndex }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={cn("relative w-full rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 dark:border dark:border-zinc-800", maxWidth)}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
            <button onClick={onClose} className="rounded-full p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300">
              <X className="h-5 w-5" />
            </button>
          </div>
          {children}
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

const TableCard = ({ table, onClick }: any) => {
  const statusColors = {
    free: 'bg-white border-zinc-200 hover:border-emerald-200 hover:bg-emerald-50/30 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:border-emerald-700 dark:hover:bg-emerald-900/20',
    open: table.type === 'gramado' 
      ? 'bg-emerald-100 border-emerald-300 text-emerald-900 dark:bg-emerald-900/50 dark:border-emerald-700 dark:text-emerald-50'
      : 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-100',
    bill_requested: 'bg-amber-100 border-amber-200 text-amber-900 dark:bg-amber-900/40 dark:border-amber-800 dark:text-amber-200 shadow-sm font-bold',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border-2 p-4 transition-all shadow-sm relative overflow-hidden',
        statusColors[table.status as keyof typeof statusColors]
      )}
    >
          {table.status === 'open' && (
        <div className={cn(
          "absolute top-0 right-0 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-tighter rounded-bl-lg",
          table.type === 'gramado' ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"
        )}>
          {table.type === 'gramado' ? 'Gramado' : 'Salão'}
        </div>
      )}
      {table.status === 'bill_requested' && (
        <div className="absolute top-0 right-0 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-tighter rounded-bl-lg bg-amber-600 text-white">
          Conta
        </div>
      )}
      <span className={cn(
        "text-2xl font-bold",
        table.status === 'bill_requested' ? "text-amber-950 dark:text-amber-100" : "dark:text-zinc-100"
      )}>{formatTableNumber(table.number)}</span>
      <span className={cn(
        "mt-1 text-[10px] font-medium uppercase tracking-wider opacity-60",
        table.status === 'bill_requested' ? "text-amber-900/70 dark:text-amber-200/70" : "dark:text-zinc-400"
      )}>
        {table.status === 'free' ? 'Livre' : table.status === 'open' ? 'Aberta' : 'Conta'}
      </span>
      {table.customer_name && (
        <span className={cn(
          "mt-2 w-full truncate text-center text-sm font-bold",
          table.status === 'bill_requested' ? "text-amber-950 dark:text-amber-100" : "text-zinc-900 dark:text-zinc-100"
        )}>{table.customer_name}</span>
      )}
    </motion.button>
  );
};

// --- Main App ---

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
  const [activeTab, setActiveTab] = useState<'mesas' | 'cardapio' | 'historico' | 'config' | 'gestao'>('mesas');
  
  // State from server
  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [details, setDetails] = useState<any[]>([]);
  const [historyEvents, setHistoryEvents] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<any>({ service_fee: '10' });
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });
  const [displayScale, setDisplayScale] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('displayScale') || '100';
    }
    return '100';
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

  const vibrate = (pattern: number | number[] = 50) => {
    if (vibrationEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        console.warn('Vibration failed:', e);
      }
    }
  };

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

  const hasPermission = (permission: string) => {
    if (user?.role === 'host') return true;
    if (!user?.role) return false;
    const perms = settings[`permissions_${user.role}`];
    if (!perms) return false;
    try {
      const parsed = typeof perms === 'string' ? JSON.parse(perms) : perms;
      return !!parsed[permission];
    } catch (e) {
      return false;
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.style.fontSize = `${fontSize}px`;
      document.body.style.zoom = (parseInt(displayScale) / 100).toString();
      localStorage.setItem('displayScale', displayScale);
      localStorage.setItem('fontSize', fontSize);
      localStorage.setItem('vibrationEnabled', String(vibrationEnabled));
    }
  }, [displayScale, fontSize, vibrationEnabled]);

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

  const notificationsEnabledRef = useRef(notificationsEnabled);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
    localStorage.setItem('notificationsEnabled', JSON.stringify(notificationsEnabled));
  }, [notificationsEnabled]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    localStorage.setItem('soundEnabled', JSON.stringify(soundEnabled));
  }, [soundEnabled]);
  
  // UI State
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const selectedTableRef = useRef(selectedTable);
  useEffect(() => {
    selectedTableRef.current = selectedTable;
  }, [selectedTable]);

  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isAddMenuModalOpen, setIsAddMenuModalOpen] = useState(false);
  const [isEditMenuModalOpen, setIsEditMenuModalOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<any>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isCloseTableModalOpen, setIsCloseTableModalOpen] = useState(false);
  const [isConfirmBillModalOpen, setIsConfirmBillModalOpen] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');

  useEffect(() => {
    async function testConnection() {
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          // Wait a bit before testing to allow initialization
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempts + 1)));
          
          // Test connection to Firestore
          await getDocFromServer(doc(db, 'test', 'connection'));
          setFirebaseStatus('connected');
          return;
        } catch (error: any) {
          attempts++;
          console.warn(`Firebase connection test attempt ${attempts} failed:`, error);
          
          if (attempts === maxAttempts) {
            console.error("Firebase connection test failed after max attempts:", error);
            if (error.message && error.message.includes('offline')) {
              setFirebaseStatus('error');
            } else {
              // If it's a permission error or something else, it might still be "connected" but restricted
              setFirebaseStatus('connected');
            }
          }
        }
      }
    }
    testConnection();
  }, []);

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

  const fetchUsers = () => fetch('/api/users').then(res => res.json()).then(setUsers);
  const fetchOrders = () => fetch('/api/orders').then(res => res.json()).then(setAllOrders);

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
      console.log('WebSocket connected');
      reconnectAttempts.current = 0;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Request full sync on connect
      ws.send(JSON.stringify({ type: 'FULL_SYNC' }));
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
        case 'ORDER_DELETED':
          setAllOrders(prev => prev.filter(o => o.id !== data.payload.orderId));
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
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      ws.close();
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed. Reconnecting...');
      socketRef.current = null;
      // Exponential backoff for reconnection
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
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
          console.log('Tab visible, checking connection...');
          if (socketRef.current?.readyState !== WebSocket.OPEN) {
            connectWebSocket();
          } else {
            socketRef.current.send(JSON.stringify({ type: 'FULL_SYNC' }));
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      const syncInterval = setInterval(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: 'FULL_SYNC' }));
        }
      }, 30000);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearInterval(syncInterval);
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

  const sendWS = (type: string, payload: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, payload }));
    }
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
              label="Cardápio" 
              active={activeTab === 'cardapio'} 
              onClick={() => { 
                vibrate(20);
                setActiveTab('cardapio'); 
                setIsSidebarOpen(false); 
              }} 
            />
          )}
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
              user?.role === 'waiter' ? "bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50" :
              user?.role === 'kitchen' ? "bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50" :
              user?.role === 'caixa' ? "bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50" :
              "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
            )}>
              {user?.avatar ? user.avatar : (
                user?.role === 'host' ? <UserCircle className="h-6 w-6" /> :
                user?.role === 'waiter' ? <Users className="h-5 w-5" /> :
                user?.role === 'kitchen' ? <ChefHat className="h-5 w-5" /> :
                user?.role === 'caixa' ? <DollarSign className="h-5 w-5" /> :
                <UserCircle className="h-5 w-5" />
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold dark:text-zinc-200">{user?.username}</p>
              <p className="text-xs font-medium text-zinc-500 capitalize dark:text-zinc-400">
                {user?.role === 'waiter' ? 'Garçom' : user?.role === 'kitchen' ? 'Cozinha' : user?.role === 'caixa' ? 'Caixa' : user?.role}
              </p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-900/20" onClick={() => { setIsLoggedIn(false); setUser(null); }}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>

          <div className="mt-4 px-2 text-[10px] text-zinc-400 dark:text-zinc-500 space-y-1 border-t border-zinc-100 pt-4 dark:border-zinc-800/50">
            <p className="font-medium text-zinc-400">Versão 1.1.4 beta</p>
            <div className="opacity-70">
              <p>Created by: Abiner</p>
              <p>Email for contact: abinerfelipe@gmail.com</p>
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
        <header className="flex h-[calc(4rem+env(safe-area-inset-top))] items-end justify-between border-b border-zinc-200 bg-white px-4 pb-4 md:px-6 dark:bg-zinc-900 dark:border-zinc-800">
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
               activeTab === 'cardapio' ? 'Cardápio' : 
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
                      socketRef.current.send(JSON.stringify({ type: 'FULL_SYNC' }));
                      setTimeout(resolve, 1000);
                    } else {
                      connectWebSocket();
                      setTimeout(resolve, 2000);
                    }
                  }),
                  {
                    loading: 'Sincronizando...',
                    success: 'Sincronização concluída!',
                    error: 'Erro ao sincronizar',
                  }
                );
              }}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              <span className="text-[10px] font-bold uppercase">Sincronizar</span>
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

        <div className="flex-1 overflow-y-auto overscroll-none p-4 md:p-6 pb-24 md:pb-12" style={{ WebkitOverflowScrolling: 'touch' }}>
          {activeTab === 'mesas' && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {tables.map((table) => (
                <TableCard 
                  key={table.id} 
                  table={table} 
                  onClick={() => {
                    vibrate(30);
                    setSelectedTable(table);
                    setIsTableModalOpen(true);
                  }} 
                />
              ))}
            </div>
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
            />
          )}

          {activeTab === 'gestao' && hasPermission('gestao') && (
            <GestaoTab 
              menu={sortedMenu} 
              categories={sortedCategories}
              details={sortedGroups}
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
            />
          )}

          {activeTab === 'historico' && (
            <HistoryTab 
              events={historyEvents} 
              canMarkRead={hasPermission('mark_history_read')}
              onMarkRead={(historyId: string) => {
                sendWS('HISTORY_MARK_READ', { historyId, userId: user?.id, username: user?.username });
              }}
              transferRequests={transferRequests}
              onApproveTransfer={(requestId: string) => sendWS('TABLE_TRANSFER_APPROVE', { requestId, userId: user?.id, username: user?.username })}
              onRejectTransfer={(requestId: string) => sendWS('TABLE_TRANSFER_REJECT', { requestId, userId: user?.id, username: user?.username })}
              hasTransferPermission={hasPermission('transfer_table')}
            />
          )}

          {activeTab === 'config' && (
            <ConfigTab 
              users={users}
              settings={settings}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
              displayScale={displayScale}
              setDisplayScale={setDisplayScale}
              fontSize={fontSize}
              setFontSize={setFontSize}
              vibrationEnabled={vibrationEnabled}
              setVibrationEnabled={setVibrationEnabled}
              notificationsEnabled={notificationsEnabled}
              setNotificationsEnabled={setNotificationsEnabled}
              soundEnabled={soundEnabled}
              setSoundEnabled={setSoundEnabled}
              onRefreshUsers={fetchUsers}
              onAddUser={() => setIsAddUserModalOpen(true)} 
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
            />
          )}
        </div>
      </main>

      {/* Modals */}
      <TableActionsModal 
        isOpen={isTableModalOpen} 
        onClose={() => setIsTableModalOpen(false)} 
        table={selectedTable}
        orders={currentOrders}
        details={details}
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
        onCloseTable={() => setIsCloseTableModalOpen(true)}
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

      <Modal isOpen={isCloseTableModalOpen} onClose={() => setIsCloseTableModalOpen(false)} title="Fechar Mesa">
        <form onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          const methods = formData.getAll('payment') as string[];
          if (methods.length === 0) return toast.error('Selecione ao menos uma forma de pagamento');
          sendWS('TABLE_CLOSE', { tableId: selectedTable?.id, userId: user?.id, username: user?.username, paymentMethods: methods });
          setIsCloseTableModalOpen(false);
          setIsTableModalOpen(false);
        }} className="space-y-4">
          <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800">
            {(() => {
              const subtotal = currentOrders.reduce((acc, o) => acc + (o.item_price || 0) * o.quantity, 0);
              const serviceFee = parseFloat(settings.service_fee || '10');
              const service = subtotal * (serviceFee / 100);
              const total = subtotal + service;
              const perPerson = selectedTable?.people_count ? total / selectedTable.people_count : total;
              
              return (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                    <span>Subtotal:</span>
                    <span className="font-bold">R$ {subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                    <span>Serviço ({serviceFee}%):</span>
                    <span className="font-bold">R$ {service.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-emerald-200 pt-2 flex justify-between text-lg font-bold text-emerald-900 dark:border-emerald-800 dark:text-emerald-100">
                    <span>Total:</span>
                    <span>R$ {total.toFixed(2)}</span>
                  </div>
                  {selectedTable?.people_count && selectedTable.people_count > 1 && (
                    <div className="border-t border-emerald-200 border-dashed pt-2 flex justify-between text-xs italic text-emerald-600 dark:border-emerald-800 dark:text-emerald-400">
                      <span>Divisão ({selectedTable.people_count} pessoas):</span>
                      <span>R$ {perPerson.toFixed(2)} por pessoa</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          <p className="text-zinc-600 text-sm dark:text-zinc-400">Selecione as formas de pagamento:</p>
          <div className="grid grid-cols-2 gap-3">
            {['Dinheiro', 'Pix', 'Crédito', 'Débito'].map(method => (
              <label key={method} className="flex items-center gap-2 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 cursor-pointer dark:border-zinc-700 dark:hover:bg-zinc-800">
                <input type="checkbox" name="payment" value={method} className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500" />
                <span className="text-sm font-medium dark:text-zinc-200">{method}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsCloseTableModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="danger">Confirmar Fechamento</Button>
          </div>
        </form>
      </Modal>

      <OrderModal 
        isOpen={isOrderModalOpen} 
        onClose={() => setIsOrderModalOpen(false)} 
        menu={sortedMenu}
        categories={sortedCategories}
        details={sortedGroups}
        vibrate={vibrate}
        onSend={(items) => {
          vibrate([50, 30, 50]);
          sendWS('ORDER_SEND', { tableId: selectedTable?.id, userId: user?.id, username: user?.username, items });
          setIsOrderModalOpen(false);
        }}
      />

      <AddUserModal 
        isOpen={isAddUserModalOpen} 
        onClose={() => setIsAddUserModalOpen(false)} 
        onSuccess={fetchUsers}
        currentUser={user}
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

function TableActionsModal({ isOpen, onClose, table, orders, isHost, onOpenTable, onRequestBill, onAddOrder, onCloseTable, onMarkRead, onUpdateTable, onDeleteOrder, canDeleteOrder, onTransferTable, canTransfer, allTables, details = [] }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [targetTable, setTargetTable] = useState<string>('');
  const [tableType, setTableType] = useState<'salao' | 'gramado'>('salao');

  useEffect(() => {
    if (!isOpen) {
      setIsEditing(false);
      setIsTransferring(false);
      setSelectedOrders([]);
      setTargetTable('');
      setTableType('salao');
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
                <button
                  type="button"
                  onClick={() => setTableType('salao')}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all",
                    tableType === 'salao' 
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" 
                      : "border-zinc-100 bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700"
                  )}
                >
                  <Home className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase">Salão</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTableType('gramado')}
                  className={cn(
                    "flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all",
                    tableType === 'gramado' 
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" 
                      : "border-zinc-100 bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700"
                  )}
                >
                  <Trees className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase">Gramado</span>
                </button>
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
                    <button
                      type="button"
                      onClick={() => setTableType('salao')}
                      className={cn(
                        "flex items-center justify-center gap-2 p-2 rounded-xl border-2 transition-all",
                        tableType === 'salao' 
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" 
                          : "border-zinc-100 bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700"
                      )}
                    >
                      <Home className="h-4 w-4" />
                      <span className="text-[10px] font-bold uppercase">Salão</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableType('gramado')}
                      className={cn(
                        "flex items-center justify-center gap-2 p-2 rounded-xl border-2 transition-all",
                        tableType === 'gramado' 
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" 
                          : "border-zinc-100 bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:border-zinc-700"
                      )}
                    >
                      <Trees className="h-4 w-4" />
                      <span className="text-[10px] font-bold uppercase">Gramado</span>
                    </button>
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
                        peopleCount: parseInt(formData.get('people') as string) || 0
                      });
                      setIsEditing(false);
                    }} className="space-y-3">
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
                  <h4 className="text-xs font-bold uppercase text-zinc-400">Pedidos Atuais</h4>
                  <div className="max-h-[300px] md:max-h-[400px] overflow-y-auto overscroll-contain rounded-lg border border-zinc-100 bg-white dark:bg-zinc-900 dark:border-zinc-800" style={{ WebkitOverflowScrolling: 'touch' }}>
                    {orders.length === 0 ? (
                      <p className="p-4 text-center text-xs text-zinc-400 dark:text-zinc-500">Nenhum pedido realizado</p>
                    ) : (
                      <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
                        {orders.map((order: any) => (
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

function MenuTab({ menu, categories = [], details = [], canEdit, onAdd, onEdit, onWS, vibrate }: any) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('alphabetical');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const filteredMenu = useMemo(() => {
    let items = menu.filter((item: any) => {
      if (search) {
        const normalizedSearch = search.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const normalizedName = item.name.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
        return normalizedName.includes(normalizedSearch);
      }
      
      const matchesCategory = activeCategory ? item.type === activeCategory : true;
      const matchesGroup = (activeGroup && activeGroup !== 'ALL') ? item.category === activeGroup : true;
      
      return matchesCategory && matchesGroup;
    });

    if (!activeCategory) {
      switch (sortBy) {
        case 'alphabetical':
          items = [...items].sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'recent':
          items = [...items].sort((a, b) => b.id.localeCompare(a.id));
          break;
        case 'active':
          items = items.filter((i: any) => i.active !== 0);
          break;
        case 'inactive':
          items = items.filter((i: any) => i.active === 0);
          break;
        case 'category':
          items = [...items].sort((a, b) => (a.type || '').localeCompare(b.type || ''));
          break;
        case 'group':
          items = [...items].sort((a, b) => (a.category || '').localeCompare(b.category || ''));
          break;
      }
    }
    
    return items;
  }, [menu, search, activeCategory, activeGroup, sortBy]);

  const groupedMenu = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    filteredMenu.forEach(item => {
      const groupName = item.category || 'Outros';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(item);
    });
    // Sort group names by sort_order, but keep 'Outros' at the end
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

  const handleDownload = () => {
    window.location.href = '/api/menu/export';
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = JSON.parse(event.target?.result as string);
        const res = await fetch('/api/menu/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(content)
        });
        if (res.ok) {
          toast.success('Cardápio importado com sucesso!');
        } else {
          toast.error('Erro ao importar cardápio');
        }
      } catch (err) {
        toast.error('Arquivo inválido');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const renderItemCard = (item: any) => (
    <div key={item.id} className={cn(
      "group relative flex items-center justify-between border-b border-zinc-100 bg-white py-2 px-3 transition-colors hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50 last:border-0",
      item.active === 0 && "opacity-60 bg-zinc-50 dark:bg-zinc-800/50"
    )}>
      <div className="flex items-center gap-3 flex-1">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{item.name}</h4>
            {item.active === 0 && <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[9px] font-bold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">INATIVO</span>}
            {item.print_enabled !== 0 && <Printer className="h-3 w-3 text-emerald-500" />}
          </div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{item.type} &gt; {item.category} • R$ {item.price.toFixed(2)}</p>
        </div>
      </div>
      {canEdit && (
        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => {
              if (vibrate) vibrate(10);
              onWS('MENU_TOGGLE_PRINT', { id: item.id, enabled: item.print_enabled === 0 });
            }}
            className={cn(
              "p-1.5 rounded transition-colors",
              item.print_enabled !== 0 ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400" : "text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            )}
            title={item.print_enabled !== 0 ? "Impressão Ativada" : "Impressão Desativada"}
          >
            <Printer className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onEdit(item)} className="rounded p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => {
            setConfirmModal({
              isOpen: true,
              title: 'Excluir Item',
              message: `Deseja realmente excluir ${item.name}?`,
              onConfirm: () => {
                onWS('MENU_DELETE', { id: item.id });
                setConfirmModal({ ...confirmModal, isOpen: false });
              }
            });
          }} className="rounded p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <ConfirmModal 
        isOpen={confirmModal.isOpen} 
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })} 
        title={confirmModal.title} 
        message={confirmModal.message} 
        onConfirm={confirmModal.onConfirm} 
      />
      
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md dark:bg-zinc-950/80 py-2 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input 
                placeholder="Buscar no cardápio..." 
                className="pl-10" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <input 
                type="file" 
                id="menu-upload" 
                className="hidden" 
                accept=".json" 
                onChange={handleUpload} 
              />
              <Button variant="outline" onClick={() => document.getElementById('menu-upload')?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Importar
              </Button>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" /> Exportar
              </Button>
              <Button onClick={onAdd}><Plus className="mr-2 h-4 w-4" /> Novo Produto</Button>
            </div>
          )}
        </div>

        {!search && activeCategory && (
          <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <button 
                onClick={() => { setActiveCategory(null); setActiveGroup(null); }} 
                className="hover:underline"
              >
                Cardápio
              </button>
              <ChevronRight className="h-4 w-4" />
              <span className="font-bold">{activeCategory}</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-3 text-xs font-bold bg-white dark:bg-zinc-900 shadow-sm border border-emerald-200 dark:border-emerald-800 text-emerald-600 hover:bg-emerald-50"
              onClick={() => {
                setActiveCategory(null);
                setActiveGroup(null);
              }}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Voltar
            </Button>
          </div>
        )}
      </div>

      {search ? (
        <div className="rounded-xl border border-zinc-200 overflow-hidden dark:border-zinc-800">
          {filteredMenu.map(renderItemCard)}
          {filteredMenu.length === 0 && (
            <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
              Nenhum item encontrado para "{search}".
            </div>
          )}
        </div>
      ) : (
        <>
          {!activeCategory ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {categories.map((c: any) => {
                const count = menu.filter((m: any) => m.type === c.name).length;
                return (
                  <button 
                    key={c.id} 
                    onClick={() => setActiveCategory(c.name)}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm transition-all hover:border-emerald-500 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500"
                  >
                    <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{c.name}</span>
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{count} itens</span>
                  </button>
                );
              })}
              {categories.length === 0 && (
                <div className="col-span-full py-12 text-center text-zinc-500 dark:text-zinc-400">
                  Nenhuma categoria cadastrada.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {groupedMenu.map(({ name: groupName, items }: any) => (
                <div key={groupName} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-500 px-1">
                      {groupName}
                    </h3>
                    <div className="h-px flex-1 bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                  <div className="rounded-xl border border-zinc-200 overflow-hidden dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    {items.map(renderItemCard)}
                  </div>
                </div>
              ))}
              {filteredMenu.length === 0 && (
                <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                  Nenhum item disponível nesta categoria.
                </div>
              )}
            </div>
          )}

          {!activeCategory && (
            <>
              <div className="my-8 border-t border-zinc-200 dark:border-zinc-800" />
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Todos os Itens</h3>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Organizar por:</label>
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="alphabetical">Alfabética</option>
                    <option value="recent">Mais recentes</option>
                    <option value="active">Ativos</option>
                    <option value="inactive">Inativos</option>
                    <option value="category">Categorias</option>
                    <option value="group">Grupos</option>
                  </select>
                </div>
              </div>
              <div className="rounded-xl border border-zinc-200 overflow-hidden dark:border-zinc-800 bg-white dark:bg-zinc-900">
                {filteredMenu.map(renderItemCard)}
                {filteredMenu.length === 0 && (
                  <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                    Nenhum item encontrado.
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}


function ConfirmModal({ isOpen, onClose, onConfirm, title, message }: any) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-zinc-600 dark:text-zinc-300">{message}</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>Confirmar</Button>
        </div>
      </div>
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

function PermissionsManager({ settings, sendWS, currentUser }: any) {
  const roles = ['admin', 'waiter', 'kitchen', 'caixa'];
  const [activeRole, setActiveRole] = useState(roles[0]);

  const permissionGroups = [
    {
      title: 'Módulos (Acesso)',
      permissions: [
        { key: 'mesas', label: 'Mesas' },
        { key: 'historico', label: 'Histórico' },
        { key: 'cardapio', label: 'Cardápio' },
        { key: 'gestao', label: 'Gestão' },
        { key: 'config', label: 'Configurações' },
      ]
    },
    {
      title: 'Ações de Gestão',
      permissions: [
        { key: 'edit_menu', label: 'Gestão: Produtos e Cardápio' },
        { key: 'manage_categories', label: 'Gestão: Categorias e Grupos' },
        { key: 'reorder_categories', label: 'Gestão: Organizar Categorias' },
        { key: 'reorder_groups', label: 'Gestão: Organizar Grupos' },
        { key: 'manage_users', label: 'Gestão: Equipe' },
        { key: 'manage_permissions', label: 'Gestão: Autorizações' },
        { key: 'clear_history', label: 'Gestão: Ações de Limpeza' },
        { key: 'native_view', label: 'Visualização App Nativo' },
      ]
    },
    {
      title: 'Operações de Pedido',
      permissions: [
        { key: 'delete_order', label: 'Excluir Pedidos' },
        { key: 'transfer_table', label: 'Transferir Mesa' },
        { key: 'mark_history_read', label: 'Marcar Visto no Histórico' },
      ]
    }
  ];

  const handleToggle = (role: string, permission: string) => {
    const key = `permissions_${role}`;
    const currentPerms = settings[key] ? (typeof settings[key] === 'string' ? JSON.parse(settings[key]) : settings[key]) : {};
    const newPerms = { ...currentPerms, [permission]: !currentPerms[permission] };
    
    sendWS('SETTINGS_UPDATE', { [key]: JSON.stringify(newPerms) });
  };

  return (
    <div className="space-y-6">
      {/* Role Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {roles.map(role => (
          <button
            key={role}
            onClick={() => setActiveRole(role)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
              activeRole === role 
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" 
                : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
            )}
          >
            {role === 'waiter' ? 'Garçom' : role === 'kitchen' ? 'Cozinha' : role.charAt(0).toUpperCase() + role.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {permissionGroups.map(group => {
          const key = `permissions_${activeRole}`;
          const perms = settings[key] ? (typeof settings[key] === 'string' ? JSON.parse(settings[key]) : settings[key]) : {};

          return (
            <div key={group.title} className="rounded-2xl border border-zinc-200 bg-white p-6 dark:bg-zinc-900 dark:border-zinc-800">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">{group.title}</h3>
              <div className="space-y-3">
                {group.permissions.map(perm => (
                  <div key={perm.key} className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                    <span className="text-sm font-medium dark:text-zinc-300">{perm.label}</span>
                    <button
                      onClick={() => handleToggle(activeRole, perm.key)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                        perms[perm.key] ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
                      )}
                    >
                      <span className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        perms[perm.key] ? 'translate-x-6' : 'translate-x-1'
                      )} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GestaoTab({ 
  menu, 
  categories, 
  details, 
  sendWS, 
  onAddMenu, 
  onEditMenu, 
  onResetHistory, 
  currentUser, 
  settings, 
  hasPermission,
  users = [],
  onRefreshUsers,
  onAddUser,
  onEditUser,
  transferRequests = [],
  allOrders = [],
  vibrate
}: any) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const isHost = currentUser?.role === 'host';

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
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold mb-6 dark:text-zinc-100">Gestão do Sistema</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-2">Cardápio</h3>
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
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Organizar cardápio</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-400" />
            </button>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-2">Administrativo</h3>
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

          {hasPermission('manage_permissions') && (
            <button 
              onClick={() => setActiveSection('permissions')}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
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
        </div>
      </div>

      {hasPermission('clear_history') && (
        <button 
          onClick={() => setActiveSection('danger')}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors dark:bg-rose-900/10 dark:border-rose-900/30 dark:hover:bg-rose-900/20"
        >
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-rose-900 dark:text-rose-200">Ações de Limpeza</h3>
              <p className="text-sm text-rose-700 dark:text-rose-400">Zerar histórico e dados</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-rose-400" />
        </button>
      )}
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
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
                <Button onClick={onAddUser} variant="outline"><UserPlus className="mr-2 h-4 w-4" /> Novo Usuário</Button>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white dark:bg-zinc-900 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                {users.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-4 sm:px-6 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                    <div>
                      <p className="font-medium dark:text-zinc-200">{u.username}</p>
                      <p className="text-xs sm:text-sm text-zinc-500 capitalize dark:text-zinc-400">
                        {u.role === 'waiter' ? 'Garçom' : u.role === 'kitchen' ? 'Cozinha' : u.role}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2">
                      {(u.role !== 'host' || isHost) && (
                        <button 
                          onClick={() => onEditUser(u)} 
                          className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                      )}
                      {(u.username !== 'deckserrinha' && (u.role !== 'host' || isHost)) && (
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
                ))}
              </div>
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
      case 'permissions':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <PermissionsManager settings={settings} sendWS={sendWS} currentUser={currentUser} />
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
              <Button 
                variant="danger" 
                className="w-full py-6"
                onClick={() => {
                  setConfirmModal({
                    isOpen: true,
                    title: 'Limpar Histórico',
                    message: 'Deseja realmente limpar todo o histórico de movimentações? Esta ação não pode ser desfeita.',
                    onConfirm: async () => {
                      try {
                          const res = await fetch('/api/admin/reset-history', { 
                              method: 'POST',
                              headers: { 'x-app-user-id': currentUser.id }
                          });
                          const data = await res.json();
                          if (data.success) {
                              toast.success('Histórico limpo!');
                              onResetHistory(); // Call parent callback if needed, but WS handles update
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
            </section>
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
      case 'users': return 'Equipe e Acessos';
      case 'permissions': return 'Autorizações de Cargos';
      case 'danger': return 'Ações de Limpeza';
      default: return '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {activeSection === null ? (
        renderMenu()
      ) : (
        <div className="space-y-6">
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
}

function ConfigTab({ 
  users, 
  settings, 
  darkMode, 
  setDarkMode, 
  displayScale,
  setDisplayScale,
  fontSize,
  setFontSize,
  vibrationEnabled,
  setVibrationEnabled,
  notificationsEnabled, 
  setNotificationsEnabled, 
  soundEnabled, 
  setSoundEnabled, 
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
  hasPermission
}: any) {
  const [isEditingHost, setIsEditingHost] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const isHost = currentUser.role === 'host';
  const isAdmin = currentUser.role === 'admin';

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
      }
    });
  };

  const renderMenu = () => (
    <div className="max-w-2xl mx-auto space-y-2">
      <h2 className="text-2xl font-bold mb-6 dark:text-zinc-100">Configurações</h2>
      
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

      {isHost && (
        <button 
          onClick={() => setActiveSection('native')}
          className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
        >
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              <Download className="h-6 w-6" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">App Nativo</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Preparação para Android e iOS</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-zinc-400" />
        </button>
      )}

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
            <p className="text-sm text-zinc-500 dark:text-zinc-400">O que mudou na versão 1.1.4</p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-zinc-400" />
      </button>
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'whatsnew':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <h3 className="text-lg font-bold mb-4 dark:text-zinc-100">Novidades da Versão 1.1.4 beta</h3>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center dark:bg-emerald-900/30 dark:text-emerald-400">
                    <MoveRight className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold dark:text-zinc-200">Transferência de Mesas</h4>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Agora você pode transferir itens entre mesas. Usuários autorizados podem realizar a transferência diretamente, enquanto outros podem solicitar a aprovação de um administrador.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center dark:bg-blue-900/30 dark:text-blue-400">
                    <Trees className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold dark:text-zinc-200">Tipos de Mesa (Salão vs Gramado)</h4>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">As mesas agora podem ser identificadas como Salão ou Gramado ao serem abertas, com cores e etiquetas exclusivas para facilitar a organização visual.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center dark:bg-purple-900/30 dark:text-purple-400">
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold dark:text-zinc-200">Aba Gestão Reorganizada</h4>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">A aba de "Gestão" foi movida para o final da navegação para facilitar o acesso. As seções foram agrupadas de forma mais intuitiva: Cardápio (Produtos, Categorias) e Administrativo (Equipe, Autorizações).</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center dark:bg-amber-900/30 dark:text-amber-400">
                    <RefreshCw className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold dark:text-zinc-200">Acesso Rápido à Sincronização</h4>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">O botão de sincronização agora está no cabeçalho para acesso imediato. O status da nuvem foi movido para a barra lateral.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center dark:bg-purple-900/30 dark:text-purple-400">
                    <Hash className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold dark:text-zinc-200">Formatação de Mesas</h4>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">A numeração das mesas agora segue o padrão de dois dígitos (01, 02, 03...), melhorando a ordenação e visualização nos filtros.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center dark:bg-rose-900/30 dark:text-rose-400">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold dark:text-zinc-200">Correções de Login e Estabilidade</h4>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Corrigido o problema de login que impedia o acesso de alguns usuários. A sincronização de senhas entre dispositivos e nuvem foi aprimorada para garantir persistência.</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center dark:bg-indigo-900/30 dark:text-indigo-400">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold dark:text-zinc-200">Histórico Inteligente</h4>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">O histórico agora permite aprovar ou recusar solicitações de transferência diretamente. A coluna de mesas foi removida para uma visualização mais limpa, com as informações integradas aos detalhes.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'native':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <h3 className="text-lg font-bold mb-4 dark:text-zinc-100">Preparação para App Nativo</h3>
              <div className="space-y-4 text-sm text-zinc-600 dark:text-zinc-400">
                <p>O sistema já está configurado com <strong>Capacitor</strong> para ser transformado em aplicativo nativo.</p>
                
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 dark:bg-amber-900/20 dark:border-amber-800">
                  <h4 className="font-bold text-amber-900 dark:text-amber-300 mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Passos Necessários no Firebase
                  </h4>
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Vá ao Console do Firebase e adicione um app <strong>Android</strong> e um <strong>iOS</strong>.</li>
                    <li>Baixe o <code>google-services.json</code> (Android) e <code>GoogleService-Info.plist</code> (iOS).</li>
                    <li>Coloque os arquivos nas pastas correspondentes do projeto nativo gerado.</li>
                  </ol>
                </div>

                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 dark:bg-blue-900/20 dark:border-blue-800">
                  <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Comandos Disponíveis
                  </h4>
                  <p className="mb-2">Você pode usar os seguintes scripts no <code>package.json</code>:</p>
                  <ul className="list-disc list-inside space-y-1 font-mono text-xs">
                    <li><code>npm run cap:sync</code> - Sincroniza o código web com o nativo.</li>
                    <li><code>npm run cap:add-android</code> - Adiciona a plataforma Android.</li>
                    <li><code>npm run cap:add-ios</code> - Adiciona a plataforma iOS.</li>
                    <li><code>npm run cap:open-android</code> - Abre o projeto no Android Studio.</li>
                    <li><code>npm run cap:open-ios</code> - Abre o projeto no Xcode.</li>
                  </ul>
                </div>

                <p className="italic">Nota: Para gerar o aplicativo final, você precisará do Android Studio (Android) e Xcode (iOS/Mac) instalados em sua máquina local.</p>
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
                    onClick={async () => {
                      if (!currentUser || !currentUser.id) {
                        toast.error('ID do usuário não encontrado. Tente sair e entrar novamente.');
                        console.error("Current user missing ID:", currentUser);
                        return;
                      }
                      try {
                        const res = await fetch(`/api/users/${currentUser.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json', 'x-app-user-id': currentUser.id },
                          body: JSON.stringify({ avatar: emoji, role: currentUser.role })
                        });
                        if (res.ok) {
                          onUpdateCurrentUser({ ...currentUser, avatar: emoji });
                          toast.success('Avatar atualizado!');
                        } else {
                          const contentType = res.headers.get("content-type");
                          if (contentType && contentType.indexOf("application/json") !== -1) {
                            const data = await res.json();
                            toast.error(data.message || 'Erro ao atualizar avatar');
                          } else {
                            const text = await res.text();
                            console.error("Avatar update error (non-JSON):", text);
                            toast.error(`Erro no servidor (${res.status}) ao atualizar avatar. Verifique o console.`);
                          }
                        }
                      } catch (e) {
                        console.error("Avatar update error:", e);
                        toast.error('Erro de conexão ao atualizar avatar');
                      }
                    }}
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
                if (!currentUser || !currentUser.id) {
                  toast.error('ID do usuário não encontrado. Tente sair e entrar novamente.');
                  console.error("Current user missing ID:", currentUser);
                  return;
                }
                const formData = new FormData(e.currentTarget);
                const username = formData.get('username') as string;
                const password = formData.get('password') as string;
                
                try {
                  const res = await fetch(`/api/users/${currentUser.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'x-app-user-id': currentUser.id },
                    body: JSON.stringify({ username, password: password || undefined, role: currentUser.role })
                  });
                  
                  const contentType = res.headers.get("content-type");
                  if (contentType && contentType.indexOf("application/json") !== -1) {
                    const data = await res.json();
                    if (data.success) {
                      toast.success('Dados atualizados com sucesso!');
                      onRefreshUsers();
                      onUpdateCurrentUser({ ...currentUser, username });
                    } else {
                      toast.error(data.message || 'Erro ao atualizar dados');
                    }
                  } else {
                    const text = await res.text();
                    console.error("Account update error (non-JSON):", text);
                    toast.error(`Erro no servidor (${res.status}) ao atualizar dados. Verifique o console.`);
                  }
                } catch (error) {
                  console.error("Account update error:", error);
                  toast.error('Erro de conexão');
                }
              }} className="grid gap-4 md:grid-cols-2 items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-400">Usuário</label>
                  <Input name="username" defaultValue={currentUser.username} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium dark:text-zinc-400">Nova Senha (deixe em branco para manter)</label>
                  <Input name="password" type="password" placeholder="••••••••" />
                </div>
                <Button type="submit" className="md:col-span-2">Atualizar Meus Dados</Button>
              </form>
            </div>
          </div>
        );
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

                <div className="border-t border-zinc-100 pt-6 dark:border-zinc-800">
                  <h4 className="text-sm font-bold uppercase text-zinc-400 mb-4">Visualização</h4>
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <label className="font-medium dark:text-zinc-200">Tamanho da Visualização</label>
                        <span className="text-zinc-500">{displayScale}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="100" 
                        max="150" 
                        step="5"
                        value={displayScale} 
                        onChange={(e) => setDisplayScale(parseInt(e.target.value))}
                        className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 dark:bg-zinc-800"
                      />
                    </div>

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
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'users':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <p className="p-4 text-center text-sm text-zinc-500">Gerenciamento de usuários movido para Gestão.</p>
            </div>
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
      default: return '';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
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
        <div className="space-y-6">
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
        </div>
      )}
    </div>
  );
}

function HistoryTab({ events, canMarkRead, onMarkRead, transferRequests = [], onApproveTransfer, onRejectTransfer, hasTransferPermission }: { events: any[]; canMarkRead: boolean; onMarkRead: (id: string) => void; transferRequests?: any[]; onApproveTransfer?: (id: string) => void; onRejectTransfer?: (id: string) => void; hasTransferPermission?: boolean }) {
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('');

  const filteredEvents = events.filter(event => {
    const matchesUser = userFilter === '' || event.username.toLowerCase().includes(userFilter.toLowerCase());
    const matchesAction = actionFilter === '' || event.action.includes(actionFilter);
    const matchesTable = tableFilter === '' || (event.table_id && event.table_id.toString() === tableFilter) || event.details.toLowerCase().includes(`mesa ${formatTableNumber(tableFilter)}`);
    return matchesUser && matchesAction && matchesTable;
  });

  const uniqueUsers = Array.from(new Set(events.map(e => e.username)));
  const uniqueActions = Array.from(new Set(events.map(e => e.action)));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <select 
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">Todas Ações</option>
          {uniqueActions.map((a: any) => <option key={a} value={a}>{a.replace('_', ' ')}</option>)}
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
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={canMarkRead ? 5 : 4} className="px-3 py-4 sm:px-6 sm:py-8 text-center text-zinc-400">Nenhuma movimentação encontrada</td>
              </tr>
            ) : (
              filteredEvents.map(event => {
                const isPendingTransfer = (event.action === 'SOLICITAR_TRANSFERENCIA' || event.action === 'TABLE_TRANSFER_REQUEST') && 
                                        event.request_id && 
                                        transferRequests.find((r: any) => r.id === event.request_id && r.status === 'pending');

                return (
                  <tr key={event.id} className={cn("hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50", event.is_read === 1 && "opacity-50")}>
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
                              MESA {formatTableNumber(event.table_id)} —
                            </span>
                          )}
                          <span className="font-medium">
                            {(() => {
                              // Try to highlight quantity (e.g., "1x ")
                              const match = event.details.match(/^(\d+x) (.*)$/);
                              if (match) {
                                return (
                                  <>
                                    <span className="text-zinc-900 dark:text-zinc-100 font-bold">{match[1]}</span> - {match[2].replace('(', '-(')}
                                  </>
                                );
                              }
                              
                              return event.details;
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
                        {event.action.replace('_', ' ')}
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
      </div>
    </div>
  );
}

function AddUserModal({ isOpen, onClose, onSuccess, currentUser }: any) {
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
          <select name="role" className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
            <option value="waiter">Garçom</option>
            <option value="kitchen">Cozinha</option>
            <option value="caixa">Caixa</option>
            <option value="admin">Admin</option>
            {currentUser?.role === 'host' && <option value="host">Host</option>}
          </select>
        </div>
        <Button type="submit" className="w-full">Criar Usuário</Button>
      </form>
    </Modal>
  );
}

function EditUserModal({ isOpen, onClose, user, onSuccess, currentUser }: any) {
  if (!user) return null;

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
            disabled={user.username === 'deckserrinha'}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="waiter">Garçom</option>
            <option value="kitchen">Cozinha</option>
            <option value="caixa">Caixa</option>
            <option value="admin">Admin</option>
            {(currentUser?.role === 'host' || user.role === 'host') && <option value="host">Host</option>}
          </select>
          {user.username === 'deckserrinha' && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">O cargo do host inicial não pode ser alterado.</p>
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
          active: formData.get('active') === 'on' ? 1 : 0
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
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <input 
            type="checkbox" 
            name="active" 
            defaultChecked={item.active !== 0} 
            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
          />
          <label className="text-sm font-medium dark:text-zinc-300">Item Ativo (Disponível para pedidos)</label>
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
          active: formData.get('active') === 'on' ? 1 : 0
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
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <input 
            type="checkbox" 
            name="active" 
            defaultChecked={true} 
            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
          />
          <label className="text-sm font-medium dark:text-zinc-300">Item Ativo (Disponível para pedidos)</label>
        </div>
        <Button type="submit" className="w-full">Salvar Produto</Button>
      </form>
    </Modal>
  );
}

function OrderModal({ isOpen, onClose, menu, categories = [], details = [], onSend, vibrate }: any) {
  const [cart, setCart] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingObservation, setEditingObservation] = useState<string | null>(null);
  const [observationText, setObservationText] = useState("");

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
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
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
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.type} • {item.category} • R$ {item.price.toFixed(2)}</p>
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
                              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">R$ {item.price.toFixed(2)}</p>
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
          <h4 className="text-xs font-bold uppercase text-zinc-400">Carrinho</h4>
          <div className="space-y-2 max-h-40 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            {cart.map(item => (
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
              vibrate([50, 100, 50]);
              onSend(cart.map(i => ({ menuItemId: i.id, quantity: i.quantity, observation: i.observation })));
              onClose();
            }}
          >
            Enviar Pedido
          </Button>
        </div>
      </div>
    </Modal>
  );
}
