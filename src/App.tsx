import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  Timestamp,
  FirebaseUser,
  OperationType,
  handleFirestoreError
} from './firebase';
import { Transaction, CATEGORIES } from './types';
import { classifyTransaction, checkServerHealth } from './services/geminiService';
import { cn } from './utils';
import { 
  Plus, 
  LogOut, 
  PieChart, 
  List, 
  TrendingUp, 
  TrendingDown, 
  Trash2, 
  BrainCircuit,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Wallet,
  Calendar,
  X,
  Loader2,
  Mic,
  Lock,
  Clipboard
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart as RePieChart,
  Pie
} from 'recharts';
import { format, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

// --- Components ---

const getCategoryEmoji = (category: string) => {
  const mapping: { [key: string]: string } = {
    "餐饮美食": "🍱",
    "交通出行": "🚗",
    "购物消费": "🛍️",
    "休闲娱乐": "🎮",
    "医疗保健": "🏥",
    "生活日用": "🏠",
    "住房缴费": "🏢",
    "工资收入": "💰",
    "理财收益": "📈",
    "其他": "📦"
  };
  return mapping[category] || "📦";
};

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.startsWith('{')) {
        setHasError(true);
        setErrorInfo(event.error.message);
      }
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    const info = JSON.parse(errorInfo || '{}');
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-red-100">
          <h2 className="text-2xl font-bold text-red-600 mb-4">应用出错了</h2>
          <p className="text-gray-600 mb-6">我们遇到了一些权限或数据问题。请尝试刷新页面或重新登录。</p>
          <div className="bg-gray-50 p-4 rounded-lg text-xs font-mono overflow-auto mb-6 max-h-40">
            {JSON.stringify(info, null, 2)}
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
          >
            刷新页面
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'list'>('dashboard');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      return;
    }

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      setTransactions(txs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Proactive Return Detection (Automatic "Jump")
  // Removed automatic clipboard reading to prevent annoying "Paste" prompts on mobile.
  // Users can now use the manual paste button in the entry modal.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        // We could check for other pending states here if needed
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white p-8 rounded-3xl shadow-2xl border border-slate-100 text-center"
        >
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
            <Wallet className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">SmartLedger</h1>
          <p className="text-slate-500 mb-8">智能记账，理清每一分钱的去向</p>
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-3"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            使用 Google 账号登录
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 pb-24 font-['PingFang_SC','Hiragino_Sans_GB','Microsoft_YaHei','ui-sans-serif',system-ui]">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-100">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 hidden sm:block">SmartLedger</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-slate-900">{user.displayName}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' ? (
              <Dashboard key="dashboard" transactions={transactions} />
            ) : (
              <TransactionListView key="list" transactions={transactions} />
            )}
          </AnimatePresence>
        </main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 px-6 py-3 z-20">
          <div className="max-w-4xl mx-auto flex items-center justify-around relative">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "flex flex-col items-center gap-1 transition-all",
                activeTab === 'dashboard' ? "text-indigo-600" : "text-slate-400"
              )}
            >
              <PieChart className="w-6 h-6" />
              <span className="text-[10px] font-medium">概览</span>
            </button>

            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-indigo-200 -mt-10 border-4 border-white active:scale-95 transition-transform"
            >
              <Plus className="w-8 h-8" />
            </button>

            <button 
              onClick={() => setActiveTab('list')}
              className={cn(
                "flex flex-col items-center gap-1 transition-all",
                activeTab === 'list' ? "text-indigo-600" : "text-slate-400"
              )}
            >
              <List className="w-6 h-6" />
              <span className="text-[10px] font-medium">明细</span>
            </button>
          </div>
        </nav>

        {/* Add Modal */}
        <AnimatePresence>
          {isAddModalOpen && (
            <AddTransactionModal 
              userId={user.uid} 
              onClose={() => setIsAddModalOpen(false)} 
            />
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}

// --- Dashboard View ---

const Dashboard: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const currentMonth = new Date();
  
  const stats = useMemo(() => {
    const monthTxs = transactions.filter(t => isSameMonth(t.date.toDate(), currentMonth));
    const income = monthTxs.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = monthTxs.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    
    const categoryData = monthTxs
      .filter(t => t.type === 'expense')
      .reduce((acc: any, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {});
    
    const pieData = Object.entries(categoryData).map(([name, value]) => ({ name, value }));
    
    // Calculate 6-month history
    const historyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = format(d, 'yyyy-MM');
      const monthLabel = format(d, 'M月');
      
      const mExpense = transactions
        .filter(t => t.type === 'expense' && format(t.date.toDate(), 'yyyy-MM') === monthStr)
        .reduce((sum, t) => sum + t.amount, 0);
      
      historyData.push({ name: monthLabel, value: mExpense });
    }
    
    return { income, expense, balance: income - expense, pieData, historyData };
  }, [transactions]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  // Custom label for Pie Chart with lines
  const renderCustomizedLabel = (props: any) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, value, name } = props;
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 30;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="#64748b" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-[10px] font-bold"
      >
        {`${name} (¥${value})`}
      </text>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="space-y-6"
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Wallet className="w-4 h-4" />
            <span className="text-sm font-medium">本月结余</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">¥{stats.balance.toLocaleString()}</p>
        </div>
        <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">本月收入</span>
          </div>
          <p className="text-2xl font-bold text-emerald-700">¥{stats.income.toLocaleString()}</p>
        </div>
        <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100">
          <div className="flex items-center gap-2 text-rose-600 mb-2">
            <TrendingDown className="w-4 h-4" />
            <span className="text-sm font-medium">本月支出</span>
          </div>
          <p className="text-2xl font-bold text-rose-700">¥{stats.expense.toLocaleString()}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">支出分类</h3>
          <div className="h-80">
            {stats.pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                    label={renderCustomizedLabel}
                    labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                  >
                    {stats.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                暂无支出数据
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 mb-6">支出分布</h3>
          <div className="h-64">
            {stats.pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={[...stats.pieData].sort((a, b) => (b.value as number) - (a.value as number))}
                  layout="vertical"
                  margin={{ left: 20, right: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    axisLine={false} 
                    tickLine={false} 
                    width={80}
                    tick={{ fontSize: 12, fill: '#64748b' }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={20}>
                    {[...stats.pieData].sort((a, b) => (b.value as number) - (a.value as number)).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">
                暂无支出数据
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly History Summary */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900">每月支出小结</h3>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <TrendingDown className="w-3 h-3" />
            <span>近6个月趋势</span>
          </div>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.historyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#94a3b8' }}
              />
              <YAxis hide />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-slate-900">最近记录</h3>
          <ChevronRight className="w-5 h-5 text-slate-400" />
        </div>
        <div className="space-y-4">
          {transactions.slice(0, 5).map(tx => (
            <TransactionItem key={tx.id} transaction={tx} />
          ))}
          {transactions.length === 0 && (
            <p className="text-center text-slate-400 py-8">还没有记录，点击下方 + 开始记账吧</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// --- Transaction List View ---

const TransactionListView: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const [viewMode, setViewMode] = useState<'date' | 'category'>('date');
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => isSameMonth(t.date.toDate(), selectedMonth));
  }, [transactions, selectedMonth]);

  const groupedByCategory = useMemo(() => {
    const groups: { [key: string]: { txs: Transaction[], total: number, merchants: { [key: string]: number } } } = {};
    filteredTransactions.forEach(tx => {
      const category = tx.category || '其他';
      const merchant = tx.description || '未知商户';
      if (!groups[category]) {
        groups[category] = { txs: [], total: 0, merchants: {} };
      }
      groups[category].txs.push(tx);
      
      const signedAmount = tx.type === 'expense' ? -tx.amount : tx.amount;
      groups[category].total += signedAmount;
      groups[category].merchants[merchant] = (groups[category].merchants[merchant] || 0) + signedAmount;
    });
    return Object.entries(groups).sort((a, b) => b[1].txs.length - a[1].txs.length);
  }, [filteredTransactions]);

  const groupedByDate = useMemo(() => {
    const groups: { [key: string]: { txs: Transaction[], income: number, expense: number } } = {};
    filteredTransactions.forEach(tx => {
      const dateKey = format(tx.date.toDate(), 'yyyy-MM-dd');
      if (!groups[dateKey]) {
        groups[dateKey] = { txs: [], income: 0, expense: 0 };
      }
      groups[dateKey].txs.push(tx);
      if (tx.type === 'income') groups[dateKey].income += tx.amount;
      else groups[dateKey].expense += tx.amount;
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTransactions]);

  const changeMonth = (offset: number) => {
    const next = new Date(selectedMonth);
    next.setMonth(next.getMonth() + offset);
    setSelectedMonth(next);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    );
  };

  const monthlyTotals = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    return { income, expense, balance: income - expense };
  }, [filteredTransactions]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Month & View Toggle Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm w-fit">
          <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-50 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          </button>
          <span className="text-sm font-bold text-slate-700 min-w-[80px] text-center">
            {format(selectedMonth, 'yyyy年MM月')}
          </span>
          <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-50 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
          <button 
            onClick={() => setViewMode('date')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all",
              viewMode === 'date' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
            )}
          >
            按日期
          </button>
          <button 
            onClick={() => setViewMode('category')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all",
              viewMode === 'category' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
            )}
          >
            按分类
          </button>
        </div>
      </div>

      {/* Monthly Summary Card */}
      <div className="bg-indigo-600 rounded-[32px] p-6 text-white shadow-lg shadow-indigo-100">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-indigo-100 text-xs font-medium mb-1 uppercase tracking-wider">该月总支出</p>
            <h2 className="text-3xl font-black">¥{monthlyTotals.expense.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</h2>
          </div>
          <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
            <Wallet className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
          <div>
            <p className="text-indigo-100 text-[10px] uppercase tracking-wider mb-1">总收入</p>
            <p className="font-bold text-sm">¥{monthlyTotals.income.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="text-right">
            <p className="text-indigo-100 text-[10px] uppercase tracking-wider mb-1">结余</p>
            <p className="font-bold text-sm">¥{monthlyTotals.balance.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
          {viewMode === 'date' ? '每日消耗' : '分类统计'}
        </h3>
        <span className="text-xs text-slate-400">{filteredTransactions.length} 笔记录</span>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'category' ? (
          <motion.div 
            key="category-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {groupedByCategory.map(([category, data]) => {
              const isExpanded = expandedCategories.includes(category);
              return (
                <div key={category} className="bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden transition-all">
                  <button 
                    onClick={() => toggleCategory(category)}
                    className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                        <span className="text-lg">{getCategoryEmoji(category)}</span>
                      </div>
                      <div className="text-left">
                        <h4 className="font-bold text-slate-900">{category}</h4>
                        <p className="text-xs text-slate-400">{data.txs.length} 笔记录</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "text-sm font-bold",
                        data.total >= 0 ? "text-emerald-500" : "text-rose-500"
                      )}>
                        {data.total >= 0 ? '+' : ''}{data.total.toLocaleString()}
                      </div>
                      {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-300" /> : <ChevronRight className="w-5 h-5 text-slate-300" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-50 overflow-hidden"
                      >
                        {/* Merchant Breakdown */}
                        <div className="bg-slate-50/50 p-5 space-y-3 border-b border-slate-50">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">商户/明细分布</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">累计金额</p>
                          </div>
                          <div className="space-y-2">
                            {Object.entries(data.merchants)
                              .sort((a, b) => Math.abs(b[1] as number) - Math.abs(a[1] as number))
                              .map(([name, amount]) => {
                                const val = amount as number;
                                return (
                                  <div key={name} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-600 font-medium">{name}</span>
                                    <span className={cn(
                                      "font-mono font-bold",
                                      val >= 0 ? "text-emerald-500" : "text-slate-900"
                                    )}>
                                      {val >= 0 ? '+' : ''}{val.toLocaleString()}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                        </div>

                        {/* Transaction List */}
                        <div className="divide-y divide-slate-50">
                          {data.txs.sort((a, b) => b.date.toMillis() - a.date.toMillis()).map(tx => (
                            <TransactionItem key={tx.id} transaction={tx} showDelete />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div 
            key="date-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {groupedByDate.map(([date, data]) => (
              <div key={date} className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                      {format(new Date(date), 'MM月dd日')}
                    </h4>
                  </div>
                  <div className="flex gap-3 text-[10px] font-bold">
                    {data.income > 0 && <span className="text-emerald-500">收 +{data.income}</span>}
                    {data.expense > 0 && <span className="text-rose-500">支 -{data.expense}</span>}
                  </div>
                </div>
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                  {data.txs.map((tx, idx) => (
                    <div key={tx.id} className={cn(idx !== data.txs.length - 1 && "border-b border-slate-50")}>
                      <TransactionItem transaction={tx} showDelete />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {transactions.length === 0 && (
        <div className="text-center py-20">
          <List className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400">暂无交易记录</p>
        </div>
      )}
    </motion.div>
  );
}

const TransactionItem: React.FC<{ transaction: Transaction, showDelete?: boolean }> = ({ transaction, showDelete = false }) => {
  const handleDelete = async () => {
    // Simplified delete without confirm to avoid iframe issues
    try {
      await deleteDoc(doc(db, 'transactions', transaction.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${transaction.id}`);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center text-lg",
          transaction.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        )}>
          {getCategoryEmoji(transaction.category)}
        </div>
        <div>
          <p className="font-bold text-slate-900">{transaction.description}</p>
          <p className="text-xs text-slate-500">{transaction.category}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className={cn(
            "font-bold",
            transaction.type === 'income' ? "text-emerald-600" : "text-slate-900"
          )}>
            {transaction.type === 'income' ? '+' : '-'}¥{transaction.amount.toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400">{format(transaction.date.toDate(), 'HH:mm')}</p>
        </div>
        {showDelete && (
          <button 
            onClick={handleDelete}
            className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// --- Add Transaction Modal ---

function AddTransactionModal({ userId, onClose }: { userId: string, onClose: () => void }) {
  const [input, setInput] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [aiSecret, setAiSecret] = useState(localStorage.getItem('ai_secret') || '');
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [tempSecret, setTempSecret] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success' | 'info', text: string } | null>(null);
  const [formData, setFormData] = useState({
    amount: '',
    type: 'expense' as 'income' | 'expense',
    category: '其他',
    description: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const handleSmartInput = async (textOverride?: string, secretOverride?: string) => {
    const textToProcess = textOverride || input;
    console.log("Smart Input Triggered:", { textToProcess, isClassifying });
    if (!textToProcess || (typeof textToProcess === 'string' && !textToProcess.trim())) {
      console.log("Empty input, skipping");
      return;
    }
    
    setIsClassifying(true);
    setFeedback(null);
    console.log("Setting isClassifying to true");
    try {
      let currentSecret = secretOverride || aiSecret;
      console.log("Using secret:", !!currentSecret);
      if (!currentSecret) {
        console.log("No secret found, showing custom modal...");
        setShowSecretModal(true);
        setIsClassifying(false);
        return;
      }

      console.log("Initiating classification request to backend...");
      const result = await classifyTransaction(textToProcess, currentSecret);
      console.log("Classification result received:", result);
      
      if (result) {
        console.log("Updating form data with result...");
        setFormData(prev => {
          const newData = {
            ...prev,
            amount: result.amount.toString(),
            type: result.type,
            category: CATEGORIES.includes(result.category) ? result.category : '其他',
            description: result.description
          };
          console.log("New form data will be:", newData);
          return newData;
        });
        if (!textOverride) setInput('');
        if (result._isFallback) {
          if (result._isSmartFallback) {
            setFeedback({ type: 'success', text: '识别成功！（已启用本地智能加速）' });
          } else {
            setFeedback({ type: 'info', text: 'AI 额度已满，已为您切换至“本地基础识别”。' });
          }
        } else {
          setFeedback({ type: 'success', text: '识别成功！已为您填入表单。' });
        }
        setTimeout(() => setFeedback(null), 3000);
      } else {
        console.warn("Result was null or undefined");
        setFeedback({ type: 'error', text: '未能识别有效信息，请尝试手动输入。' });
      }
    } catch (error: any) {
      console.error("Classification error:", error);
      if (error.message === 'INVALID_SECRET') {
        setFeedback({ type: 'error', text: '暗号错误！请重新输入。' });
        localStorage.removeItem('ai_secret');
        setAiSecret('');
      } else if (error.message === 'API_KEY_MISSING') {
        setFeedback({ type: 'error', text: '识别失败：服务器未配置 API Key。' });
      } else if (error.message === 'TIMEOUT') {
        setFeedback({ type: 'error', text: '识别超时：服务器响应太慢，请稍后再试。' });
      } else if (error.message.includes('quota') || error.message.includes('429')) {
        setFeedback({ type: 'error', text: 'AI 正在休息（额度达到上限），请等一分钟后再试。' });
      } else if (error.message.includes('API key not valid')) {
        setFeedback({ type: 'error', text: '识别失败：API Key 无效。请检查 Secrets 面板中的 GEMINI_API_KEY 是否正确。' });
      } else if (error.message.startsWith('HTTP_')) {
        setFeedback({ type: 'error', text: `识别失败：服务器返回错误 ${error.message}。` });
      } else {
        // Check health as a fallback
        const health = await checkServerHealth();
        if (health.status === 'offline') {
          setFeedback({ type: 'error', text: '识别失败：后端服务似乎已离线。' });
        } else if (!health.hasApiKey) {
          setFeedback({ type: 'error', text: '识别失败：服务器未检测到 API Key。' });
        } else {
          setFeedback({ type: 'error', text: `识别失败：${error.message || '未知网络错误'}` });
        }
      }
    } finally {
      setIsClassifying(false);
    }
  };

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setFeedback({ type: 'error', text: '您的浏览器不支持语音识别功能。' });
      return;
    }

    if (isListening) {
      // In most implementations, calling start() again or just letting it end is enough.
      // But we'll just show a message if they click while it's already listening.
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const speechResult = event.results[0][0].transcript;
      setInput(speechResult);
      handleSmartInput(speechResult);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setIsListening(false);
    }
  };

  // Clipboard Auto-Detection (Pending bill only)
  useEffect(() => {
    const checkPendingBill = () => {
      // Check if there's a pending bill from visibility change (if we still used that)
      const pendingBill = localStorage.getItem('pending_bill');
      if (pendingBill) {
        localStorage.removeItem('pending_bill');
        localStorage.setItem('last_processed_bill', pendingBill);
        handleSmartInput(pendingBill);
      }
    };

    checkPendingBill();
  }, []);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput(text);
        setFeedback({ type: 'success', text: '已从剪贴板粘贴。' });
        // Optionally auto-trigger recognition
        if (text.includes('¥') || text.includes('元') || text.length > 5) {
          handleSmartInput(text);
        }
      }
    } catch (err) {
      setFeedback({ type: 'error', text: '无法读取剪贴板，请手动粘贴。' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.description) return;

    try {
      // Parse the date string correctly to avoid UTC offset issues
      const [year, month, day] = formData.date.split('-').map(Number);
      const selectedDate = new Date(year, month - 1, day);
      
      // If the selected date is today, use the current time
      const now = new Date();
      if (format(selectedDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')) {
        selectedDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      }

      await addDoc(collection(db, 'transactions'), {
        userId,
        amount: parseFloat(formData.amount),
        type: formData.type,
        category: formData.category,
        description: formData.description,
        date: Timestamp.fromDate(selectedDate),
        createdAt: Timestamp.now()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="relative w-full max-w-lg bg-white rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden"
      >
        {/* Feedback Message */}
        <AnimatePresence>
          {feedback && (
            <motion.div 
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              className={cn(
                "absolute top-0 left-0 right-0 p-4 z-50 text-center text-sm font-bold shadow-lg",
                feedback.type === 'error' ? "bg-rose-500 text-white" : 
                feedback.type === 'success' ? "bg-emerald-500 text-white" : "bg-indigo-500 text-white"
              )}
            >
              {feedback.text}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">记一笔</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* AI Input Section */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-indigo-500" />
              智能识别 (粘贴账单短信或描述)
            </label>
            <div className="relative">
              <textarea 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="例如：中午在麦当劳花了35元"
                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 min-h-[100px] resize-none pr-24"
              />
              <div className="absolute bottom-3 right-3 flex gap-2">
                <button
                  type="button"
                  onClick={handlePaste}
                  className="p-2 bg-white text-slate-400 hover:text-indigo-500 rounded-xl shadow-sm border border-slate-100 transition-all"
                  title="从剪贴板粘贴"
                >
                  <Clipboard className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={toggleListening}
                  className={cn(
                    "p-2 rounded-xl transition-all",
                    isListening 
                      ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-200" 
                      : "bg-white text-slate-400 hover:text-indigo-500 shadow-sm border border-slate-100"
                  )}
                >
                  <Mic className="w-4 h-4" />
                </button>
                <button 
                  type="button"
                  onClick={() => handleSmartInput()}
                  disabled={isClassifying || !input.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center gap-2"
                >
                  {isClassifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
                  识别
                </button>
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Manual Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button 
                type="button"
                onClick={() => setFormData({ ...formData, type: 'expense' })}
                className={cn(
                  "flex-1 py-2 rounded-xl text-sm font-bold transition-all",
                  formData.type === 'expense' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500"
                )}
              >
                支出
              </button>
              <button 
                type="button"
                onClick={() => setFormData({ ...formData, type: 'income' })}
                className={cn(
                  "flex-1 py-2 rounded-xl text-sm font-bold transition-all",
                  formData.type === 'income' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500"
                )}
              >
                收入
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">金额</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl text-lg font-bold focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">分类</label>
                <select 
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 appearance-none"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">描述</label>
              <input 
                type="text" 
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500"
                placeholder="备注一下..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase">日期</label>
              <input 
                type="date" 
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button 
              type="submit"
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all mt-4"
            >
              保存记录
            </button>
          </form>
        </div>
      </motion.div>

      {/* Secret Input Modal */}
      <AnimatePresence>
        {showSecretModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSecretModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-[32px] p-8 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Lock className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">输入 AI 暗号</h3>
              <p className="text-sm text-slate-500 mb-6">为了保护您的 API 额度，请输入暗号以继续</p>
              
              <input 
                type="password"
                value={tempSecret}
                onChange={(e) => setTempSecret(e.target.value)}
                placeholder="在此输入暗号..."
                className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center text-lg font-mono focus:border-indigo-500 focus:ring-0 transition-all mb-6"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tempSecret) {
                    setAiSecret(tempSecret);
                    localStorage.setItem('ai_secret', tempSecret);
                    setShowSecretModal(false);
                    // Pass the secret directly to avoid state race
                    setTimeout(() => handleSmartInput(undefined, tempSecret), 100);
                  }
                }}
              />
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowSecretModal(false)}
                  className="flex-1 py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    if (tempSecret) {
                      setAiSecret(tempSecret);
                      localStorage.setItem('ai_secret', tempSecret);
                      setShowSecretModal(false);
                      setTimeout(() => handleSmartInput(undefined, tempSecret), 100);
                    }
                  }}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100"
                >
                  确认
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
