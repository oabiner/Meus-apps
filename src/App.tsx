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
  Bell,
  Volume2,
  ChefHat,
  UserCircle,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { db } from './firebase';
import { handleSendWS, logHistory } from './firebase-logic';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs, query, where, writeBatch, orderBy, limit } from 'firebase/firestore';
import { 
  User, 
  Table, 
  TableStatus, 
  MenuItem, 
  OrderItem, 
  WSEvent 
} from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

const Modal = ({ isOpen, onClose, title, children, zIndex = 50 }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; zIndex?: number }) => (
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
          className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900 dark:border dark:border-zinc-800"
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
    open: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-100',
    bill_requested: 'bg-amber-50 border-amber-200 text-amber-900 animate-pulse dark:bg-amber-900/30 dark:border-amber-800 dark:text-amber-100',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border-2 p-4 transition-all shadow-sm',
        statusColors[table.status]
      )}
    >
      <span className="text-2xl font-bold dark:text-zinc-100">{table.number}</span>
      <span className="mt-1 text-[10px] font-medium uppercase tracking-wider opacity-60 dark:text-zinc-400">
        {table.status === 'free' ? 'Livre' : table.status === 'open' ? 'Aberta' : 'Conta'}
      </span>
      {table.customer_name && (
        <span className="mt-2 w-full truncate text-center text-sm font-bold text-zinc-900 dark:text-zinc-100">{table.customer_name}</span>
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
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('isLoggedIn') === 'true';
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

  const [activeTab, setActiveTab] = useState<'mesas' | 'cardapio' | 'historico' | 'config'>('mesas');
  
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

  const fetchUsers = () => { getDocs(collection(db, 'users')).then(s => setUsers(s.docs.map(d => d.data() as User))); };
  const fetchOrders = () => { getDocs(collection(db, 'orders')).then(s => setAllOrders(s.docs.map(d => d.data() as any))); };

  useEffect(() => {
    if (isLoggedIn) {
      fetchUsers();
      fetchOrders();

      const unsubTables = onSnapshot(collection(db, 'tables'), (snapshot) => {
        setTables(snapshot.docs.map(d => d.data() as any));
      });
      const unsubMenu = onSnapshot(collection(db, 'menu_items'), (snapshot) => {
        setMenu(snapshot.docs.map(d => d.data() as any));
      });
      const unsubCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
        setCategories(snapshot.docs.map(d => d.data() as any));
      });
      const unsubDetails = onSnapshot(collection(db, 'item_groups'), (snapshot) => {
        setDetails(snapshot.docs.map(d => d.data() as any));
      });
      const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
        setAllOrders(snapshot.docs.map(d => d.data() as any));
      });
      const qHistory = query(collection(db, 'history'), orderBy('timestamp', 'desc'), limit(100));
      const unsubHistory = onSnapshot(qHistory, (snapshot) => {
        setHistoryEvents(snapshot.docs.map(d => d.data() as any));
      });
      const unsubSettings = onSnapshot(collection(db, 'settings'), (snapshot) => {
        const s = snapshot.docs.reduce((acc, d) => ({ ...acc, [d.id]: d.data().value }), {});
        setSettings((prev: any) => ({ ...prev, ...s }));
      });

      return () => {
        unsubTables();
        unsubMenu();
        unsubCategories();
        unsubDetails();
        unsubOrders();
        unsubHistory();
        unsubSettings();
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
      const usersSnap = await getDocs(collection(db, 'users'));
      const userDoc = usersSnap.docs.find(d => d.data().username === username && d.data().password === password);
      
      if (userDoc) {
        const userData = userDoc.data() as User;
        if (userData.role !== 'host') {
          const settingsSnap = await getDocs(collection(db, 'settings'));
          const tokenDoc = settingsSnap.docs.find(d => d.id === 'access_token');
          if (token !== tokenDoc?.data().value) {
            toast.error('Token de acesso inválido');
            return;
          }
        }
        setUser(userData);
        setIsLoggedIn(true);
        toast.success('Bem-vindo ao Deck Serrinha!');
      } else {
        toast.error('Usuário ou senha incorretos');
      }
    } catch (err) {
      toast.error('Erro ao conectar ao servidor');
    }
  };

  const sendWS = (type: string, payload: any) => {
    handleSendWS(type, payload);
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
        <div className="flex h-14 items-center justify-between border-bottom border-zinc-100 px-4 dark:border-zinc-800">
          <div className="flex items-center">
            <UtensilsCrossed className="mr-2 h-5 w-5 text-emerald-600" />
            <span className="text-lg font-bold tracking-tight dark:text-zinc-100">Deck Serrinha</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <nav className="flex-1 space-y-1 p-3">
          <SidebarItem 
            icon={<LayoutDashboard />} 
            label="Mesas" 
            active={activeTab === 'mesas'} 
            onClick={() => { setActiveTab('mesas'); setIsSidebarOpen(false); }} 
          />
          <SidebarItem 
            icon={<MenuIcon />} 
            label="Cardápio" 
            active={activeTab === 'cardapio'} 
            onClick={() => { setActiveTab('cardapio'); setIsSidebarOpen(false); }} 
          />
          <SidebarItem 
            icon={<LayoutDashboard />} 
            label="Histórico" 
            active={activeTab === 'historico'} 
            onClick={() => { setActiveTab('historico'); setIsSidebarOpen(false); }} 
          />
          {(user?.role === 'host' || user?.role === 'admin') && (
            <SidebarItem 
              icon={<Database />} 
              label="ERP" 
              active={activeTab === 'erp'} 
              onClick={() => { setActiveTab('erp'); setIsSidebarOpen(false); }} 
            />
          )}
          <SidebarItem 
            icon={<Settings />} 
            label="Configurações" 
            active={activeTab === 'config'} 
            onClick={() => { setActiveTab('config'); setIsSidebarOpen(false); }} 
          />
        </nav>

        <div className="border-t border-zinc-100 p-4 dark:border-zinc-800">
          <div className="mb-4 flex items-center px-2">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center shadow-sm border",
              user?.role === 'host' ? "bg-purple-100 text-purple-600 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800/50" :
              user?.role === 'waiter' ? "bg-blue-100 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50" :
              user?.role === 'kitchen' ? "bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50" :
              "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
            )}>
              {user?.role === 'host' ? <UserCircle className="h-6 w-6" /> :
               user?.role === 'waiter' ? <Users className="h-5 w-5" /> :
               user?.role === 'kitchen' ? <ChefHat className="h-5 w-5" /> :
               <UserCircle className="h-5 w-5" />}
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold dark:text-zinc-200">{user?.username}</p>
              <p className="text-xs font-medium text-zinc-500 capitalize dark:text-zinc-400">
                {user?.role === 'waiter' ? 'Garçom' : user?.role === 'kitchen' ? 'Cozinha' : user?.role}
              </p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-900/20" onClick={() => { setIsLoggedIn(false); setUser(null); }}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-hidden overscroll-none">
        <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 md:px-6 dark:bg-zinc-900 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
              <MenuIcon className="h-5 w-5" />
            </button>
            <h2 className="text-base font-semibold capitalize dark:text-zinc-100">{activeTab}</h2>
          </div>
          <div className="flex items-center gap-4">
            {activeTab === 'mesas' && (
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700" /> <span className="dark:text-zinc-400">Livre</span></span>
                <span className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> <span className="dark:text-zinc-400">Aberta</span></span>
                <span className="flex items-center gap-1"><div className="h-1.5 w-1.5 rounded-full bg-amber-500" /> <span className="dark:text-zinc-400">Conta</span></span>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6" style={{ WebkitOverflowScrolling: 'touch' }}>
          {activeTab === 'mesas' && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {tables.map((table) => (
                <TableCard 
                  key={table.id} 
                  table={table} 
                  onClick={() => {
                    setSelectedTable(table);
                    setIsTableModalOpen(true);
                  }} 
                />
              ))}
            </div>
          )}

          {activeTab === 'cardapio' && (
            <MenuTab 
              menu={menu} 
              categories={categories}
              details={details}
              canEdit={false} 
              onAdd={() => setIsAddMenuModalOpen(true)} 
              onEdit={(item: any) => {
                setEditingMenuItem(item);
                setIsEditMenuModalOpen(true);
              }}
              onWS={sendWS}
            />
          )}

          {activeTab === 'erp' && (user?.role === 'host' || user?.role === 'admin') && (
            <ERPTab 
              menu={menu} 
              categories={categories}
              details={details}
              sendWS={sendWS}
              onAddMenu={() => setIsAddMenuModalOpen(true)}
              onEditMenu={(item: any) => {
                setEditingMenuItem(item);
                setIsEditMenuModalOpen(true);
              }}
              onResetHistory={() => {}}
              currentUser={user}
            />
          )}

          {activeTab === 'historico' && (
            <HistoryTab 
              events={historyEvents} 
              isHost={user?.role === 'host'}
              onMarkRead={(historyId: string) => {
                sendWS('HISTORY_MARK_READ', { historyId, userId: user?.id, username: user?.username });
              }}
            />
          )}

          {activeTab === 'config' && (
            <ConfigTab 
              users={users}
              settings={settings}
              darkMode={darkMode}
              setDarkMode={setDarkMode}
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
                  const historySnap = await getDocs(collection(db, 'history'));
                  const batch = writeBatch(db);
                  historySnap.forEach(d => batch.delete(d.ref));
                  await batch.commit();
                  toast.success('Histórico limpo!');
                } catch (error) {
                  toast.error('Erro de conexão');
                }
              }}
            />
          )}
        </div>
      </main>

      <AddMenuModal 
        isOpen={isAddMenuModalOpen} 
        onClose={() => setIsAddMenuModalOpen(false)} 
        onSave={(item: any) => sendWS('MENU_ADD', item)}
        categories={categories}
        details={details}
      />
      <EditMenuModal 
        isOpen={isEditMenuModalOpen} 
        onClose={() => setIsEditMenuModalOpen(false)} 
        item={editingMenuItem} 
        onSave={(item: any) => sendWS('MENU_EDIT', item)}
        categories={categories}
        details={details}
      />
      <AddUserModal 
        isOpen={isAddUserModalOpen} 
        onClose={() => setIsAddUserModalOpen(false)} 
        onSuccess={fetchUsers}
        currentUser={user}
      />
      <EditUserModal 
        isOpen={isEditUserModalOpen} 
        onClose={() => setIsEditUserModalOpen(false)} 
        user={editingUser} 
        onSuccess={fetchUsers}
        currentUser={user}
      />
      <TableModal 
        isOpen={isTableModalOpen} 
        onClose={() => setIsTableModalOpen(false)} 
        table={selectedTable} 
        menu={menu} 
        categories={categories}
        details={details}
        sendWS={sendWS} 
        userId={user?.id}
        username={user?.username}
      />

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

function ConfigTab({ users, settings, darkMode, setDarkMode, notificationsEnabled, setNotificationsEnabled, soundEnabled, setSoundEnabled, onRefreshUsers, onAddUser, onEditUser, currentUser, onUpdateCurrentUser, onSaveSettings, onResetHistory, categories = [], details = [], sendWS, menu = [] }: any) {
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
          await deleteDoc(doc(db, 'users', id));
          onRefreshUsers();
          toast.success('Usuário removido');
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

      {(isHost || isAdmin) && (
        <>
          <button 
            onClick={() => setActiveSection('users')}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-white border border-zinc-200 hover:bg-zinc-50 transition-colors dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
          >
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                <Users className="h-6 w-6" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Usuários</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Gerenciar equipe e permissões</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-zinc-400" />
          </button>
        </>
      )}
    </div>
  );

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'account':
        return (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const username = formData.get('username') as string;
                const password = formData.get('password') as string;
                
                try {
                  const updateData: any = { username, role: currentUser.role };
                  if (password) updateData.password = password;
                  await updateDoc(doc(db, 'users', currentUser.id), updateData);
                  toast.success('Dados atualizados com sucesso!');
                  onRefreshUsers();
                  onUpdateCurrentUser({ ...currentUser, username });
                } catch (error) {
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
              </div>
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
                    onSaveSettings({
                      service_fee: '10', // Fixed at 10%
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
      default:
        return null;
    }
  };

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'account': return 'Minha Conta';
      case 'general': return 'Geral';
      case 'users': return 'Usuários';
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

function HistoryTab({ events, isHost, onMarkRead }: { events: any[]; isHost: boolean; onMarkRead: (id: string) => void }) {
  const [userFilter, setUserFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('');

  const filteredEvents = events.filter(event => {
    const matchesUser = userFilter === '' || event.username.toLowerCase().includes(userFilter.toLowerCase());
    const matchesAction = actionFilter === '' || event.action.includes(actionFilter);
    const matchesTable = tableFilter === '' || event.details.toLowerCase().includes(`mesa ${tableFilter}`);
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
              {isHost && <th className="px-3 py-3 sm:px-6 sm:py-3 w-10 sm:w-16">Visto</th>}
              <th className="px-3 py-3 sm:px-6 sm:py-3">Detalhes</th>
              <th className="px-3 py-3 sm:px-6 sm:py-3">Ação</th>
              <th className="px-3 py-3 sm:px-6 sm:py-3">Usuário</th>
              <th className="hidden sm:table-cell px-3 py-3 sm:px-6 sm:py-3">Horário</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan={isHost ? 5 : 4} className="px-3 py-4 sm:px-6 sm:py-8 text-center text-zinc-400">Nenhuma movimentação encontrada</td>
              </tr>
            ) : (
              filteredEvents.map(event => (
                <tr key={event.id} className={cn("hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50", event.is_read === 1 && "opacity-50")}>
                  {isHost && (
                    <td className="px-3 py-3 sm:px-6 sm:py-4">
                      <input 
                        type="checkbox" 
                        checked={event.is_read === 1} 
                        onChange={() => onMarkRead(event.id)}
                        className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>
                  )}
                  <td className="px-3 py-3 sm:px-6 sm:py-4 text-zinc-600 dark:text-zinc-400 max-w-[150px] sm:max-w-none truncate sm:whitespace-normal">{event.details}</td>
                  <td className="px-3 py-3 sm:px-6 sm:py-4">
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-bold uppercase whitespace-nowrap",
                      event.action === 'EXCLUIR_PEDIDO' ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" :
                      event.action === 'PEDIR_CONTA' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                      event.action === 'FECHAR_MESA' ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" :
                      event.action === 'ABRIR_MESA' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                      event.action === 'NOVO_PEDIDO' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                      "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
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
              ))
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
        try {
          const newId = crypto.randomUUID();
          const data = Object.fromEntries(formData);
          await setDoc(doc(db, 'users', newId), {
            id: newId,
            username: data.username,
            password: data.password,
            role: data.role
          });
          toast.success('Usuário criado!');
          onSuccess();
          onClose();
        } catch (error) {
          toast.error('Erro de conexão');
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

        try {
          await updateDoc(doc(db, 'users', user.id), data);
          toast.success('Usuário atualizado!');
          onSuccess();
          onClose();
        } catch (error) {
          toast.error('Erro de conexão');
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

  useEffect(() => {
    if (item) {
      setSelectedCategory(item.type || '');
    }
  }, [item]);

  if (!item) return null;

  const filteredDetails = details.filter((d: any) => d.category_name === selectedCategory);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Produto">
      <form onSubmit={(e) => {
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
            <select name="category" defaultValue={item.category} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100">
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

function OrderModal({ isOpen, onClose, menu, categories = [], details = [], onSend }: any) {
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

  const filteredMenu = menu.filter((item: any) => {
    if (item.active === 0) return false;
    if (search) {
      return item.name.toLowerCase().includes(search.toLowerCase());
    }
    const matchesCategory = activeCategory ? item.type === activeCategory : true;
    const matchesGroup = activeGroup ? item.category === activeGroup : true;
    return matchesCategory && matchesGroup;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adicionar Pedido">
      <div className="flex flex-col gap-6 max-h-[70vh]">
        <div className="flex-1 overflow-y-auto overscroll-contain space-y-4 pr-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar itens..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-4 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

          {search ? (
            <div className="space-y-2">
              {filteredMenu.map((item: any) => (
                <button 
                  key={item.id} 
                  onClick={() => addToCart(item)}
                  className="flex w-full items-center justify-between rounded-lg border border-zinc-100 p-3 hover:bg-zinc-50 transition-colors dark:border-zinc-800 dark:hover:bg-zinc-800"
                >
                  <div className="text-left">
                    <p className="text-sm font-semibold dark:text-zinc-200">{item.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">R$ {item.price.toFixed(2)}</p>
                  </div>
                  <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                </button>
              ))}
              {filteredMenu.length === 0 && (
                <div className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  Nenhum item encontrado para "{search}".
                </div>
              )}
            </div>
          ) : (
            <>
              {(activeCategory || activeGroup) && (
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  <button 
                    onClick={() => { setActiveCategory(null); setActiveGroup(null); }} 
                    className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    Categorias
                  </button>
                  {activeCategory && (
                    <>
                      <ChevronRight className="h-4 w-4" />
                      <button 
                        onClick={() => setActiveGroup(null)} 
                        className={cn("hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors", !activeGroup && "text-zinc-900 dark:text-zinc-100")}
                      >
                        {activeCategory}
                      </button>
                    </>
                  )}
                  {activeGroup && (
                    <>
                      <ChevronRight className="h-4 w-4" />
                      <span className="text-zinc-900 dark:text-zinc-100">{activeGroup}</span>
                    </>
                  )}
                </div>
              )}

              {!activeCategory ? (
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((c: any) => {
                    const count = menu.filter((m: any) => m.active !== 0 && m.type === c.name).length;
                    if (count === 0) return null;
                    return (
                      <button 
                        key={c.id} 
                        onClick={() => setActiveCategory(c.name)}
                        className="flex flex-col items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm transition-all hover:border-emerald-500 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500"
                      >
                        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{c.name}</span>
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{count} itens</span>
                      </button>
                    );
                  })}
                  {categories.filter((c: any) => menu.filter((m: any) => m.active !== 0 && m.type === c.name).length > 0).length === 0 && (
                    <div className="col-span-full py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      Nenhuma categoria com itens disponíveis.
                    </div>
                  )}
                </div>
              ) : !activeGroup ? (
                <div className="grid grid-cols-2 gap-2">
                  {details.filter((g: any) => g.category_name === activeCategory).map((g: any) => {
                    const count = menu.filter((m: any) => m.active !== 0 && m.type === activeCategory && m.category === g.name).length;
                    if (count === 0) return null;
                    return (
                      <button 
                        key={g.id} 
                        onClick={() => setActiveGroup(g.name)}
                        className="flex flex-col items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-white p-2 shadow-sm transition-all hover:border-emerald-500 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500"
                      >
                        <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{g.name}</span>
                        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{count} itens</span>
                      </button>
                    );
                  })}
                  {details.filter((g: any) => g.category_name === activeCategory && menu.filter((m: any) => m.active !== 0 && m.type === activeCategory && m.category === g.name).length > 0).length === 0 && (
                    <div className="col-span-full py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      Nenhum detalhe com itens disponíveis.
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredMenu.map((item: any) => (
                    <button 
                      key={item.id} 
                      onClick={() => addToCart(item)}
                      className="flex w-full items-center justify-between rounded-lg border border-zinc-100 p-3 hover:bg-zinc-50 transition-colors dark:border-zinc-800 dark:hover:bg-zinc-800"
                    >
                      <div className="text-left">
                        <p className="text-sm font-semibold dark:text-zinc-200">{item.name}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">R$ {item.price.toFixed(2)}</p>
                      </div>
                      <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                    </button>
                  ))}
                  {filteredMenu.length === 0 && (
                    <div className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      Nenhum item nesta categoria e detalhe.
                    </div>
                  )}
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
                      className="text-zinc-500 hover:bg-zinc-200 p-1 rounded dark:hover:bg-zinc-700 transition-colors"
                      title="Adicionar observação"
                    >
                      <MessageSquare className="h-4 w-4" />
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
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 italic pl-1">
                    Obs: {item.observation}
                  </div>
                ) : null}
              </div>
            ))}
            {cart.length === 0 && <p className="text-center text-sm text-zinc-400 py-4">Carrinho vazio</p>}
          </div>
          <Button 
            disabled={cart.length === 0} 
            className="w-full" 
            onClick={() => onSend(cart.map(i => ({ menuItemId: i.id, quantity: i.quantity, observation: i.observation })))}
          >
            Enviar Pedido
          </Button>
        </div>
      </div>
    </Modal>
  );
}
