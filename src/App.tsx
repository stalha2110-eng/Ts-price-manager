/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp,
  ArrowRight,
  Bell,
  BellRing,
  RefreshCw,
  Sparkles,
  Search, 
  Settings as SettingsIcon, 
  Plus, 
  Home, 
  User, 
  Lock, 
  Unlock, 
  ArrowLeft,
  Trash2,
  Edit2,
  ChevronRight,
  Sun,
  Moon,
  Globe,
  Briefcase,
  Smartphone,
  ShieldCheck,
  Shield,
  Lightbulb,
  FileText,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Package,
  Weight,
  Hash,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Truck,
  Users,
  PlusCircle,
  X,
  Minimize2,
  Type,
  Maximize2,
  Mic,
  Calendar,
  Pin,
  CheckCircle,
  MessageSquare,
  RotateCcw,
  LogOut,
  LogIn,
  MoreVertical,
  Download,
  Upload,
  Database,
  CloudOff,
  FileSpreadsheet,
  FileText as FilePdf,
  XCircle,
  HelpCircle,
  BookOpen,
  Tag,
  Paperclip,
  Zap,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from './components/ui/Button';
import { PINScreen } from './components/ui/PINScreen';
import { UnitSelectorModal } from './components/ui/UnitSelectorModal';
import { 
  db, 
  auth, 
  loginWithGoogle, 
  onAuthStateChanged,
  User as FirebaseUser
} from './firebase';
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  AppState, 
  Item, 
  Category, 
  AppSettings, 
  LanguageType, 
  ThemeType,
  Translations,
  Note
} from './types';
import { 
  DEFAULT_CATEGORIES, 
  THEMES, 
  LANGUAGES, 
  UI_TEXT, 
  UNITS 
} from './constants';
import { 
  cn, 
  formatCurrency, 
  formatNumber 
} from './lib/utils';
import { translateItemName, generatePriceAdvisory, getSmartNoteCategorization } from './services/geminiService';

// Global device ID generation
const getDeviceId = () => {
  let id = localStorage.getItem('ts_device_id');
  if (!id) {
    id = Math.random().toString(36).substring(2, 11);
    localStorage.setItem('ts_device_id', id);
  }
  return id;
};

const getDeviceName = () => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "Android Device";
  if (/iPad|iPhone|iPod/.test(ua)) return "iOS Device";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Macintosh/i.test(ua)) return "MacBook";
  return "Web Browser";
};

// --- Default State ---
const INITIAL_SETTINGS: AppSettings = {
  theme: 'midnight_blue',
  language: 'en',
  isLocked: true,
  pin: null,
  currency: 'INR',
  autoLockDelay: 30,
  hideBuyingPriceByDefault: true,
  accentColor: 'indigo',
  fontSize: 'standard',
  pricePrecision: 0,
  showStockAlerts: true,
  autoCloudSync: true,
  hasSeenOnboarding: false,
  dismissedNotifications: [],
  deviceId: getDeviceId(),
  deviceName: getDeviceName(),
};

const INITIAL_STATE: AppState = {
  items: [],
  notes: [],
  categories: DEFAULT_CATEGORIES,
  settings: INITIAL_SETTINGS,
  user: null,
};

interface Alert {
  id: string;
  type: 'note' | 'item' | 'batch';
  title: string;
  subtitle: string;
  priority: 'Urgent' | 'Important' | 'Info' | 'Completed';
  icon: React.ReactNode;
  category?: string;
  timestamp: string;
}

function NotificationBar({ 
  notes, 
  items,
  dismissed, 
  currentTime,
  onDismiss, 
  onView
}: { 
  notes: Note[]; 
  items: Item[];
  dismissed: string[]; 
  currentTime: Date;
  onDismiss: (id: string) => void; 
  onView: (id: string, type: 'item' | 'note' | 'batch') => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const alerts = useMemo(() => {
    const list: Alert[] = [];
    const now = currentTime;

    // 1. Process High-Priority Notes & Reminders
    notes.forEach(note => {
      const isReminder = note.category === 'Reminder' && note.dueDate;
      const isDue = isReminder && new Date(note.dueDate!) <= now;
      const isSoon = isReminder && !isDue && (new Date(note.dueDate!).getTime() - now.getTime()) < 3600000 * 24;

      if (!dismissed.includes(note.id) && (isDue || isSoon || note.priority === 'Urgent' || note.priority === 'Important')) {
        list.push({
          id: note.id,
          type: 'note',
          title: note.title,
          subtitle: isDue ? "REACHED DUE DATE" : isSoon ? `Due ${new Date(note.dueDate!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : note.description,
          priority: isDue ? 'Urgent' : note.priority,
          icon: isReminder ? <Clock size={16} /> : <FileText size={16} />,
          timestamp: note.createdAt
        });
      }
    });

    // 2. Process Item Price Changes (Batch if > 2)
    const itemPriceChanges = items.filter(item => {
      if (item.priceChangedAt && !dismissed.includes(`price-${item.id}-${item.priceChangedAt}`)) {
        const changedAt = new Date(item.priceChangedAt);
        return (now.getTime() - changedAt.getTime() < 3600000 * 24);
      }
      return false;
    });

    if (itemPriceChanges.length > 2) {
      if (!dismissed.includes('batched-prices')) {
        list.push({
          id: 'batched-prices',
          type: 'batch',
          title: `${itemPriceChanges.length} Price Updates`,
          subtitle: `Multiple inventory items have new rates. Audit required.`,
          priority: 'Info',
          icon: <TrendingUp size={16} />,
          timestamp: itemPriceChanges[0].priceChangedAt || now.toISOString()
        });
      }
    } else {
      itemPriceChanges.forEach(item => {
        list.push({
          id: item.id,
          type: 'item',
          title: `Rate Change: ${item.translations.en}`,
          subtitle: `Updated by ${item.lastChangedBy || 'System'}`,
          priority: 'Info',
          icon: <TrendingUp size={16} />,
          timestamp: item.priceChangedAt!
        });
      });
    }

    // 3. Process Less Critical Info Notes (Batch if > 2)
    const infoNotes = notes.filter(n => 
      !dismissed.includes(n.id) && 
      n.priority === 'Info' && 
      !n.dueDate && 
      (now.getTime() - new Date(n.createdAt).getTime() < 3600000 * 24)
    );

    if (infoNotes.length > 2) {
      if (!dismissed.includes('batched-info-notes')) {
        list.push({
          id: 'batched-info-notes',
          type: 'batch',
          title: `${infoNotes.length} Operation Logs`,
          subtitle: `Routine updates and log entries recorded today.`,
          priority: 'Info',
          icon: <FileText size={16} />,
          timestamp: infoNotes[0].createdAt
        });
      }
    } else if (infoNotes.length > 0) {
      infoNotes.forEach(note => {
        list.push({
          id: note.id,
          type: 'note',
          title: note.title,
          subtitle: note.description,
          priority: 'Info',
          icon: <FileText size={16} />,
          timestamp: note.createdAt
        });
      });
    }

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [notes, items, dismissed, currentTime]);

  if (alerts.length === 0) return null;

  return (
    <div className="sticky top-20 z-40 px-4 py-2 pointer-events-none">
      <div className="max-w-4xl mx-auto flex flex-col gap-2 pointer-events-auto">
        <div 
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between px-4 py-3 bg-[var(--card)]/90 backdrop-blur-xl border border-[var(--border)] rounded-2xl shadow-xl cursor-pointer hover:border-[var(--primary)]/30 transition-all group"
        >
          <div className="flex items-center gap-3">
             <div className="relative">
                <BellRing size={16} className="text-[var(--primary)] animate-bounce" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black h-4 w-4 flex items-center justify-center rounded-full shadow-sm">{alerts.length}</span>
             </div>
             <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest opacity-40 leading-none mb-0.5">Live Intelligence</span>
                <span className="text-xs font-bold truncate max-w-[180px] leading-tight">{alerts[0].title}</span>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <span className="text-[10px] font-black uppercase tracking-tight opacity-30 group-hover:opacity-100 transition-opacity">
                {expanded ? 'Hide Feed' : 'Explore Feed'}
             </span>
             <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
                <ChevronDown size={14} className="opacity-40" />
             </motion.div>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div 
              initial={{ height: 0, opacity: 0, scale: 0.95 }}
              animate={{ height: 'auto', opacity: 1, scale: 1 }}
              exit={{ height: 0, opacity: 0, scale: 0.95 }}
              className="overflow-hidden"
            >
              <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl p-2 space-y-1 max-h-[400px] overflow-y-auto no-scrollbar mt-1">
                 {alerts.map((alert) => (
                   <div 
                     key={alert.id + alert.timestamp}
                     className={cn(
                       "flex items-center gap-4 p-4 rounded-xl hover:bg-[var(--primary)]/5 transition-all cursor-pointer group/item border border-transparent hover:border-[var(--primary)]/10",
                       alert.priority === 'Urgent' ? "bg-red-500/5 shadow-inner" : ""
                     )}
                     onClick={(e) => {
                       e.stopPropagation();
                       onView(alert.id, alert.type);
                     }}
                   >
                     <div className={cn(
                       "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                       alert.priority === 'Urgent' ? "bg-red-500 text-white" : "bg-[var(--primary)]/10 text-[var(--primary)]"
                     )}>
                       {alert.icon}
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-black uppercase tracking-tight truncate leading-none">{alert.title}</p>
                          {alert.priority === 'Urgent' && <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[8px] font-black uppercase">Critical</span>}
                        </div>
                        <p className="text-[11px] font-medium opacity-50 truncate mt-1">{alert.subtitle}</p>
                     </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          let dismissId = alert.id;
                          if (alert.type === 'item') dismissId = `price-${alert.id}-${alert.timestamp}`;
                          onDismiss(dismissId);
                        }}
                        className="opacity-0 group-hover/item:opacity-100 p-2 hover:text-red-500 transition-all rounded-lg hover:bg-red-500/10"
                      >
                        <X size={16} />
                      </button>
                   </div>
                 ))}
                 <div className="py-2 text-center">
                    <p className="text-[8px] font-black uppercase tracking-widest opacity-20 italic">End of operational intelligence</p>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div 
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0c10]"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="flex flex-col items-center"
      >
        <div className="relative mb-8">
          <motion.div 
            className="absolute inset-0 bg-amber-500 blur-[60px] opacity-20"
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <div className="relative h-40 w-40 rounded-[2.5rem] bg-gradient-to-br from-slate-800 to-slate-900 p-1 border border-white/10 shadow-2xl overflow-hidden">
             <img src="/logo.png" alt="TS" className="h-full w-full object-contain" />
          </div>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-center"
        >
          <h1 className="text-4xl font-black tracking-tighter text-white">
            TS <span className="text-amber-500">PRICE</span> MANAGER
          </h1>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.5em] text-white/30">
            Enterprise Pricing Core v2.5
          </p>
        </motion.div>
        
        <div className="mt-12 w-48 h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-amber-500"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

// --- App Component ---
export default function App() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [activeTab, setActiveTab] = useState<'home' | 'notes' | 'settings' | 'profile' | 'notifications'>('home');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Periodically refresh current time to update reminder proximity alerts
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showPINScreen, setShowPINScreen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showChangePIN, setShowChangePIN] = useState(false);
  const [isVerifyingOldPIN, setIsVerifyingOldPIN] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(true);
  const [showAddNote, setShowAddNote] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // PWA Install Logic
  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Automatically show welcome or install banner if it's the first visit
      const hasSeenInstall = localStorage.getItem('ts_install_seen');
      if (!hasSeenInstall) {
        setShowWelcome(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      localStorage.setItem('ts_install_seen', 'true');
      console.log('PWA was installed');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert(t.installApp + ": " + t.error);
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      localStorage.setItem('ts_install_seen', 'true');
    }
  };

  // --- Data Management ---
  const exportToExcel = () => {
    const data = state.items.map(item => ({
      Name: item.name,
      Category: state.categories.find(c => c.id === item.categoryId)?.name || 'Unknown',
      Quantity: `${item.quantity} ${item.unit}`,
      'Buying Price': `₹${item.buyingPrice}/${item.buyingPriceUnit}`,
      'Wholesale Price': `₹${item.wholesalePrice}/${item.wholesalePriceUnit}`,
      'Retail Price': `₹${item.retailPrice}/${item.retailPriceUnit}`,
      'Last Updated': new Date(item.lastUpdated).toLocaleString()
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `TS_PRICE_MANAGER_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('TS PRICE MANAGER - Inventory Report', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    const tableData = state.items.map(item => [
      item.name,
      state.categories.find(c => c.id === item.categoryId)?.name || 'N/A',
      `${item.quantity} ${item.unit}`,
      `₹${item.retailPrice}`,
      `₹${item.wholesalePrice}`
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Item Name', 'Category', 'Stock', 'Retail', 'Wholesale']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: '#1e3a8a', textColor: 255 },
    });

    doc.save(`TS_PRICE_MANAGER_Inventory_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.items && Array.isArray(json.items)) {
          if (confirm('Importing will merge with current data. Proceed?')) {
            setState(prev => ({ ...prev, items: [...prev.items, ...json.items] }));
            alert('Import successful!');
          }
        }
      } catch (err) {
        alert('Invalid file format. Please upload a valid JSON backup.');
      }
    };
    reader.readAsText(file);
  };

  const handleBackup = () => {
    const dataStr = JSON.stringify(state);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `TS_PRICE_MANAGER_Backup_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.settings && json.items) {
          if (confirm('Restoring will overwrite current settings and items. Proceed?')) {
            setState(json);
            alert('System Restored!');
          }
        }
      } catch (err) {
        alert('Invalid backup file.');
      }
    };
    reader.readAsText(file);
  };
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setState(prev => ({ 
          ...prev, 
          user: { uid: user.uid, email: user.email } 
        }));
      } else {
        setState(prev => ({ ...prev, user: null }));
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Real-time Firestore Sync ---
  useEffect(() => {
    if (!state.user || !state.settings.autoCloudSync) {
      // Local storage fallback if not logged in or cloud sync disabled
      const saved = localStorage.getItem('price_manager_state');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setState(prev => ({ 
            ...prev, 
            items: parsed.items || [], 
            notes: parsed.notes || [],
            settings: { ...prev.settings, ...parsed.settings }
          }));
        } catch (e) {
          console.error("Local load failed", e);
        }
      }
      return;
    }

    const userDocRef = doc(db, 'users', state.user.uid);
    
    // Sync Settings
    const unsubSettings = onSnapshot(userDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setState(prev => ({ ...prev, settings: { ...prev.settings, ...data } }));
      }
    }, (error) => {
      console.error("Settings sync error:", error);
    });

    // Sync Items
    const itemsRef = collection(db, 'users', state.user.uid, 'items');
    const unsubItems = onSnapshot(query(itemsRef, orderBy('lastUpdated', 'desc')), (snap) => {
      const itemsList: Item[] = [];
      snap.forEach(doc => itemsList.push({ ...doc.data() as Item, id: doc.id }));
      setState(prev => ({ ...prev, items: itemsList }));
    }, (error) => {
      console.error("Items sync error:", error);
      if (error.code === 'permission-denied') {
        alert("Firestore Permission Denied. Please check your account permissions.");
      }
    });

    // Sync Notes
    const notesRef = collection(db, 'users', state.user.uid, 'notes');
    const unsubNotes = onSnapshot(query(notesRef, orderBy('createdAt', 'desc')), (snap) => {
      const notesList: Note[] = [];
      snap.forEach(doc => notesList.push({ ...doc.data() as Note, id: doc.id }));
      setState(prev => ({ ...prev, notes: notesList }));
    }, (error) => {
      console.error("Notes sync error:", error);
    });

    return () => {
      unsubSettings();
      unsubItems();
      unsubNotes();
    };
  }, [state.user, state.settings.autoCloudSync]);

  // --- Effects ---

  // Separate Effect for Theme & Core Styles (low frequency)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.settings.theme);
    const accents: Record<string, string> = {
      indigo: '99, 102, 241',
      emerald: '16, 185, 129',
      rose: '244, 63, 94',
      amber: '245, 158, 11',
      cyan: '6, 182, 212',
      slate: '100, 116, 139'
    };
    const rgb = accents[state.settings.accentColor || 'indigo'];
    document.documentElement.style.setProperty('--primary-rgb', rgb);
    
    const fontSizes: Record<string, string> = {
      standard: '16px',
      comfortable: '18px',
      compact: '14px'
    };
    document.documentElement.style.setProperty('--base-font-size', fontSizes[state.settings.fontSize || 'standard']);
  }, [state.settings.theme, state.settings.accentColor, state.settings.fontSize]);

  // Separate Effect for Mouse Move (High frequency, throttled)
  useEffect(() => {
    if (state.settings.theme !== 'premium_dynamic') return;

    let ticking = false;
    const handleMouseMove = (e: MouseEvent) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const x = (e.clientX / window.innerWidth) * 100;
          const y = (e.clientY / window.innerHeight) * 100;
          document.body.style.setProperty('--mouse-x', `${x}%`);
          document.body.style.setProperty('--mouse-y', `${y}%`);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [state.settings.theme]);

  // Separate Effect for Persistence
  useEffect(() => {
    if (!state.user || !state.settings.autoCloudSync) {
      localStorage.setItem('price_manager_state', JSON.stringify(state));
    }
  }, [state.items, state.notes, state.settings, state.user, state.settings.autoCloudSync]);

  const t = UI_TEXT[state.settings.language];
  const precision = state.settings.pricePrecision || 0;

  const filteredItems = useMemo(() => {
    return state.items.filter(item => {
      const matchesSearch = 
        item.translations.en.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.translations.hi.includes(searchQuery) ||
        item.translations.mr.includes(searchQuery) ||
        item.translations['hi-en'].toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = !selectedCategory || item.categoryId === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [state.items, searchQuery, selectedCategory]);

  // --- Handlers ---
  const handleUpdateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    try {
      if (state.user && state.settings.autoCloudSync) {
        await setDoc(doc(db, 'users', state.user.uid), updates, { merge: true });
      }
      
      setState(prev => ({
        ...prev,
        settings: { ...prev.settings, ...updates }
      }));
    } catch (e) {
      console.error("Settings update failed", e);
      alert(t.error + ": " + (e instanceof Error ? e.message : 'Unknown error'));
    }
  }, [state.user, state.settings.autoCloudSync, t.error]);

  const handleAddItem = useCallback(async (data: Omit<Item, 'id' | 'lastUpdated'>) => {
    try {
      const newItem = {
        ...data,
        lastUpdated: new Date().toISOString(),
        priceChangedAt: new Date().toISOString()
      };
      
      if (state.user && state.settings.autoCloudSync) {
        await addDoc(collection(db, 'users', state.user.uid, 'items'), newItem);
        setShowAddItem(false);
      } else {
        const id = Date.now().toString();
        setState(prev => ({
          ...prev,
          items: [{ ...newItem, id }, ...prev.items]
        }));
        setShowAddItem(false);
      }
    } catch (e) {
      console.error("Add item failed", e);
      alert(t.error + ": " + (e instanceof Error ? e.message : 'Permission Denied or Sync Error'));
    }
  }, [state.user, state.settings.autoCloudSync, t.error]);

  const handleUpdateItem = useCallback(async (id: string, data: Partial<Item>) => {
    try {
      const existingItem = state.items.find(i => i.id === id);
      const updates: any = { 
        ...data, 
        lastUpdated: new Date().toISOString() 
      };

      const isPriceChanged = existingItem && (
        (data.buyingPrice !== undefined && data.buyingPrice !== existingItem.buyingPrice) ||
        (data.retailPrice !== undefined && data.retailPrice !== existingItem.retailPrice) ||
        (data.wholesalePrice !== undefined && data.wholesalePrice !== existingItem.wholesalePrice)
      );

      if (isPriceChanged) {
        updates.priceChangedAt = new Date().toISOString();
        updates.lastChangedBy = state.settings.deviceName;
      }

      if (state.user && state.settings.autoCloudSync) {
        await updateDoc(doc(db, 'users', state.user.uid, 'items', id), updates);
      } else {
        setState(prev => ({
          ...prev,
          items: prev.items.map(item => item.id === id ? { ...item, ...updates } : item)
        }));
      }
      setEditingItem(null);
    } catch (e) {
      console.error("Update failed", e);
      alert(t.error + ": " + (e instanceof Error ? e.message : 'Permission Denied'));
    }
  }, [state.items, state.user, state.settings.autoCloudSync, state.settings.deviceName, t.error]);

  const handleBulkUpdatePrices = useCallback(async (ids: string[], updates: { retailPrice?: number; wholesalePrice?: number; buyingPrice?: number }) => {
    try {
      if (state.user && state.settings.autoCloudSync) {
        const batch: any[] = [];
        for (const id of ids) {
          const itemRef = doc(db, 'users', state.user.uid, 'items', id);
          batch.push(updateDoc(itemRef, {
            ...updates,
            lastUpdated: new Date().toISOString(),
            priceChangedAt: new Date().toISOString(),
            lastChangedBy: state.settings.deviceName
          }));
        }
        await Promise.all(batch);
      } else {
        setState(prev => ({
          ...prev,
          items: prev.items.map(item => 
            ids.includes(item.id) 
              ? { 
                  ...item, 
                  ...updates, 
                  lastUpdated: new Date().toISOString(),
                  priceChangedAt: new Date().toISOString()
                } 
              : item
          )
        }));
      }
      setSelectedItemIds([]);
      setShowBulkUpdate(false);
      alert(t.success);
    } catch (e) {
      console.error("Bulk update failed", e);
      alert(t.error);
    }
  }, [state.user, state.settings.autoCloudSync, state.settings.deviceName, t.error, t.success]);

  const handleDeleteItem = useCallback(async (id: string) => {
    if (confirm(t.delete + '?')) {
      // Optimistically update local state first for instant feedback
      setState(prev => ({
        ...prev,
        items: prev.items.filter(item => item.id !== id)
      }));

      if (state.user && state.settings.autoCloudSync) {
        try {
          await deleteDoc(doc(db, 'users', state.user.uid, 'items', id));
        } catch (e) {
          console.error("Cloud delete failed", e);
          alert(t.error + ": Permission Denied on Cloud");
        }
      }
    }
  }, [state.user, state.settings.autoCloudSync, t.delete, t.error]);
  
  const handleAddNote = useCallback(async (data: Omit<Note, 'id' | 'createdAt' | 'status'>) => {
    // AI: Smart Priority Detection
    let finalPriority = data.priority;
    try {
      const autoPriority = await getSmartNoteCategorization(data.title, data.description);
      if (autoPriority) {
        finalPriority = autoPriority as any;
      }
    } catch (e) {
      console.error("AI Prioritization failed", e);
    }

    const newNote = {
      ...data,
      priority: finalPriority,
      createdAt: new Date().toISOString(),
      status: 'Active' as const,
    };

    if (state.user && state.settings.autoCloudSync) {
      await addDoc(collection(db, 'users', state.user.uid, 'notes'), newNote);
    } else {
      const id = Date.now().toString();
      setState(prev => ({
        ...prev,
        notes: [{ ...newNote, id }, ...prev.notes]
      }));
    }
    setShowAddNote(false);
  }, [state.user, state.settings.autoCloudSync]);

  const handleUpdateNote = async (id: string, updates: Partial<Note>) => {
    if (state.user && state.settings.autoCloudSync) {
      await updateDoc(doc(db, 'users', state.user.uid, 'notes', id), updates);
    } else {
      setState(prev => ({
        ...prev,
        notes: prev.notes.map(n => n.id === id ? { ...n, ...updates } : n)
      }));
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (state.user && state.settings.autoCloudSync) {
      await deleteDoc(doc(db, 'users', state.user.uid, 'notes', id));
    } else {
      setState(prev => ({
        ...prev,
        notes: prev.notes.filter(n => n.id !== id)
      }));
    }
  };

  const handleToggleLock = () => {
    if (state.settings.isLocked) {
      if (!state.settings.pin) {
        setShowWelcome(true);
      } else {
        setShowPINScreen(true);
      }
    } else {
      handleUpdateSettings({ isLocked: true });
    }
  };

  // --- Filtered Items ---
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    // Show tour for new users who haven't seen it
    if (state.settings.hasSeenOnboarding === false && !isInitializing) {
      const timer = setTimeout(() => setShowTour(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [state.settings.hasSeenOnboarding, isInitializing]);

  const toggleItemSelection = useCallback((id: string) => {
    setSelectedItemIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id) 
        : [...prev, id]
    );
  }, []);

  const handleEditTrigger = useCallback((item: Item) => {
    setEditingItem(item);
  }, []);
  const totalValue = state.items.reduce((sum, item) => sum + (item.buyingPrice * item.quantity), 0);

  return (
    <div 
      data-theme={state.settings.theme}
      className={cn(
        "min-h-screen pb-20 overflow-hidden relative transition-colors duration-700",
        state.settings.theme === 'premium_dynamic' && "animate-gradient-flow bg-[var(--premium-gradient)]"
      )}
    >
      <AnimatePresence>
        {isInitializing && <SplashScreen onComplete={() => setIsInitializing(false)} />}
      </AnimatePresence>

      {/* Dynamic Background Elements for Specific Themes */}
      {state.settings.theme === 'premium_dynamic' && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              x: [0, 50, 0],
              y: [0, 30, 0],
              rotate: [0, 10, 0]
            }} 
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-blue-600/20 blur-[120px] rounded-full" 
          />
          <motion.div 
            animate={{ 
              scale: [1.2, 1, 1.2],
              x: [0, -40, 0],
              y: [0, -60, 0],
              rotate: [0, -15, 0]
            }} 
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[70%] bg-purple-600/20 blur-[150px] rounded-full" 
          />
          <motion.div 
            animate={{ 
              opacity: [0.1, 0.2, 0.1],
              scale: [1, 1.1, 1]
            }} 
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute top-[30%] left-[20%] w-[40%] h-[40%] bg-emerald-600/10 blur-[100px] rounded-full" 
          />
        </div>
      )}

      {/* Immersive Background Glows for standard themes */}
      {!state.settings.theme.includes('premium') && (
        <>
          <div className="glow-bg-indigo" />
          <div className="glow-bg-cyan" />
        </>
      )}

      {/* PIN Screen / Change PIN / Welcome Overlay */}
      <AnimatePresence>
        {showWelcome && (
          <PINScreen 
            mode="create"
            onPINCreated={(pin) => handleUpdateSettings({ pin, isLocked: false })}
            onSuccess={() => setShowWelcome(false)}
            title="Secure Financial Access"
            description="Create a 6-digit PIN to mask buying prices across your dashboard."
          />
        )}
        {showPINScreen && (
          <PINScreen 
            mode="unlock"
            correctPIN={state.settings.pin}
            onSuccess={() => {
              handleUpdateSettings({ isLocked: false });
              setShowPINScreen(false);
            }}
            onCancel={() => setShowPINScreen(false)}
          />
        )}
        {showChangePIN && (
          <PINScreen 
            mode={isVerifyingOldPIN ? 'unlock' : 'create'}
            correctPIN={state.settings.pin}
            onSuccess={() => {
              if (isVerifyingOldPIN) {
                setIsVerifyingOldPIN(false);
              } else {
                setShowChangePIN(false);
              }
            }}
            onPINCreated={(pin) => {
              handleUpdateSettings({ pin, isLocked: false });
            }}
            onCancel={() => {
              setShowChangePIN(false);
              setIsVerifyingOldPIN(false);
            }}
            title={isVerifyingOldPIN ? "Verify Identity" : state.settings.pin ? "Set New Security Key" : "Initialize Security"}
            description={isVerifyingOldPIN ? "Enter current PIN to proceed with change" : "Define your new 6-digit cryptographic sequence"}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header 
        id="tour-header"
        className="sticky top-0 z-40 bg-[var(--primary)]/95 backdrop-blur-xl px-6 py-4 text-[var(--primary-foreground)] shadow-2xl transition-colors border-b border-white/10"
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-amber-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="relative overflow-hidden h-14 w-14 rounded-2xl bg-white flex items-center justify-center p-1.5 border-2 border-[var(--primary)] shadow-2xl transform group-hover:scale-105 transition-transform">
                 <img src="/logo.png" alt="TS" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                 <div className="hidden flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 shadow-inner">
                   <Package size={28} className="text-white" />
                 </div>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-white mb-0 leading-none flex items-baseline">
                TS <span className="text-xs font-bold opacity-60 ml-1.5 tracking-[0.3em] uppercase">Price Manager</span>
              </h1>
              <div className="flex items-center gap-2 mt-1.5">
                 <div className={cn("h-1.5 w-1.5 rounded-full ring-2 ring-white/10", state.user && state.settings.autoCloudSync ? "bg-green-400 animate-pulse" : "bg-slate-400")} />
                 <p className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-black">
                   {state.user && state.settings.autoCloudSync ? 'Authenticated Cloud session' : 'Standalone Local Hub'}
                 </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
               onClick={() => setShowHelp(true)}
               className="flex h-9 w-9 items-center justify-center rounded-xl transition-all border border-white/10 bg-white/5 text-white/80 hover:bg-white/20"
               title={t.help}
            >
               <HelpCircle size={18} />
            </button>
            <div 
               id="tour-notes"
               className="relative cursor-pointer hover:scale-110 transition-transform" 
               onClick={() => setActiveTab('notes')}
            >
               <Bell size={20} className="text-white/80" />
               <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full border-2 border-[var(--primary)] text-[8px] flex items-center justify-center font-bold">
                 {state.notes.filter(n => n.status === 'Active').length}
               </span>
            </div>
            <button 
              id="tour-lock"
              onClick={handleToggleLock}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl transition-all border border-white/10",
                state.settings.isLocked ? "bg-amber-500/20 text-amber-500" : "bg-green-500/20 text-green-400"
              )}
            >
              {state.settings.isLocked ? <Lock size={18} /> : <Unlock size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Top Notification Bar */}
      <NotificationBar 
        notes={state.notes} 
        items={state.items}
        dismissed={state.settings.dismissedNotifications} 
        currentTime={currentTime}
        onDismiss={(id) => handleUpdateSettings({ dismissedNotifications: [...state.settings.dismissedNotifications, id] })}
        onView={(id, type) => {
          if (type === 'item') {
            setActiveTab('home');
            const item = state.items.find(i => i.id === id);
            if (item) {
              setSearchQuery(item.translations.en);
              window.scrollTo({ top: 380, behavior: 'smooth' });
            }
          } else if (type === 'batch') {
            setActiveTab('home');
            setSearchQuery('');
            window.scrollTo({ top: 380, behavior: 'smooth' });
          } else {
            setActiveTab('notes');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }}
      />

      {/* Main Content */}
      <main className="container mx-auto p-4 overflow-hidden">
        <AnimatePresence mode="wait">
        {activeTab === 'home' && (
          <motion.div 
            key="home"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-12"
          >
            {/* Price Volatility Module */}
            <RecentPriceChanges items={state.items} t={t} precision={precision} />

            {/* Quick Metrics Hub */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card p-6 bg-gradient-to-br from-[var(--card)] to-transparent border-white/5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-2">{t.totalItems}</p>
                <div className="flex items-baseline gap-2">
                   <p className="text-3xl font-black tracking-tight">{state.items.length}</p>
                   <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest">Active nodes</span>
                </div>
              </div>
              <div className="card p-6 bg-gradient-to-br from-[var(--card)] to-transparent border-white/5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-2">{t.totalValue}</p>
                <div className="flex items-baseline gap-2">
                   <p className="text-2xl font-black tracking-tight">
                     {formatCurrency(totalValue, state.settings.currency, precision)}
                   </p>
                </div>
              </div>
            </div>

            {/* Global Category Rail */}
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30 px-1">{t.categories}</p>
              <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                <Button 
                  variant={selectedCategory === null ? 'primary' : 'outline'}
                  size="sm"
                  className="whitespace-nowrap px-6 rounded-xl border-white/5"
                  onClick={() => setSelectedCategory(null)}
                >
                  {t.all}
                </Button>
                {state.categories.map(cat => (
                  <Button 
                    key={cat.id}
                    variant={selectedCategory === cat.id ? 'primary' : 'outline'}
                    size="sm"
                    className="whitespace-nowrap px-6 rounded-xl border-white/5"
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    <span className="mr-2 grayscale group-hover:grayscale-0">{cat.icon}</span> {cat.name}
                  </Button>
                ))}
              </div>
            </div>

               {/* Registry Grid */}
               <div className="space-y-6">
                 {/* Search at top of list */}
                 <div id="tour-search" className="relative group">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--primary)] opacity-40 transition-opacity group-focus-within:opacity-100" size={20} />
                   <input 
                     type="text"
                     placeholder={t.search}
                     className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] py-4 pl-12 pr-4 text-sm focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] focus:outline-none shadow-sm transition-all"
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                   />
                 </div>
 
                 <div className="flex items-center justify-between px-1">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-30">{t.inventory} Registry</h2>
                    {state.user && (
                       <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/5 border border-green-500/10">
                          <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-green-500/60">{t.success} (Synced)</span>
                       </div>
                    )}
                 </div>
              <motion.div 
                layout
                className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 pb-20"
              >
                <AnimatePresence mode="popLayout">
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.4, delay: index * 0.05 }}
                      >
                        <ItemCard 
                          item={item} 
                          isLocked={state.settings.isLocked} 
                          language={state.settings.language}
                          precision={precision}
                          onEdit={() => handleEditTrigger(item)}
                          onDelete={() => handleDeleteItem(item.id)}
                          onUpdateItem={handleUpdateItem}
                          isSelected={selectedItemIds.includes(item.id)}
                          onSelect={() => toggleItemSelection(item.id)}
                          t={t}
                        />
                      </motion.div>
                    ))
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="col-span-full flex flex-col items-center justify-center py-24 text-center card border-dashed border-white/10"
                    >
                      <div className="h-24 w-24 rounded-full bg-white/5 flex items-center justify-center mb-6">
                        <Package size={40} className="opacity-20" />
                      </div>
                      <p className="font-black uppercase tracking-widest text-xs opacity-60 max-w-[200px] leading-loose">{t.emptyList}</p>
                      <div className="mt-8">
                        <Button 
                          variant="outline" 
                          onClick={() => setShowHelp(true)}
                          className="rounded-2xl border-white/10 text-[10px] font-black uppercase tracking-widest h-12 px-8 hover:bg-[var(--primary)]/10 hover:border-[var(--primary)]/50 transition-all group"
                        >
                          <BookOpen size={16} className="mr-3 text-[var(--primary)] group-hover:scale-110 transition-transform" />
                          {t.helpQuickStart || "View Guide"}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </motion.div>
        )}

        {activeTab === 'notes' && (
          <motion.div 
            key="notes"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            <NotesDashboard 
              notes={state.notes}
              expanded={true}
              onToggle={() => {}}
              onAdd={() => setShowAddNote(true)}
              onUpdate={handleUpdateNote}
              onDelete={handleDeleteNote}
              t={t}
            />
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div 
            key="settings"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <SettingsScreen 
              state={state} 
              t={t} 
              onUpdate={handleUpdateSettings} 
              onShowHelp={() => setShowHelp(true)}
              onResetPIN={() => {
                if (state.settings.pin) {
                  setIsVerifyingOldPIN(true);
                  setShowChangePIN(true);
                } else {
                  setIsVerifyingOldPIN(false);
                  setShowChangePIN(true);
                }
              }}
              onExportExcel={exportToExcel}
              onExportPDF={exportToPDF}
              onImport={importData}
              onBackup={handleBackup}
              onRestore={handleRestore}
              onClearCache={() => {
                if (confirm('Wipe everything?')) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
            />
          </motion.div>
        )}

        {activeTab === 'profile' && (
          <motion.div 
            key="profile"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <ProfileScreen state={state} t={t} deferredPrompt={deferredPrompt} onInstall={handleInstallClick} />
          </motion.div>
        )}
        </AnimatePresence>
      </main>

      {/* Bottom Nav */}
      <nav id="tour-nav" className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--card)] px-4 py-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <NavButton active={activeTab === 'home'} icon={<Home />} label={t.all || "Home"} onClick={() => setActiveTab('home')} />
          <NavButton active={activeTab === 'notes'} icon={<FileText />} label={t.notes || "Notes"} onClick={() => setActiveTab('notes')} />
          <NavButton active={activeTab === 'settings'} icon={<SettingsIcon />} label={t.settings || "Settings"} onClick={() => setActiveTab('settings')} />
          <NavButton active={activeTab === 'profile'} icon={<User />} label={t.profile || "Profile"} onClick={() => setActiveTab('profile')} />
        </div>
      </nav>

      {/* Comparison Bottom Bar - Enhanced Visibility */}
      <AnimatePresence>
        {selectedItemIds.length > 0 && activeTab === 'home' && (
          <motion.div 
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: -20, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            className="fixed left-4 right-4 z-[60] bottom-20 md:bottom-8"
          >
            <div className="mx-auto max-w-2xl bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] text-white p-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col md:flex-row items-center justify-between border border-white/20 backdrop-blur-3xl gap-4">
               <div className="flex items-center gap-6">
                  <div className="flex -space-x-4">
                    {selectedItemIds.slice(0, 4).map((id, index) => {
                      const it = state.items.find(i => i.id === id);
                      const cat = DEFAULT_CATEGORIES.find(c => c.id === it?.categoryId);
                      return (
                        <motion.div 
                          key={id} 
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: index * 0.1 }}
                          className="h-14 w-14 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center text-2xl backdrop-blur-md shadow-lg"
                        >
                          {cat?.icon || '📦'}
                        </motion.div>
                      );
                    })}
                    {selectedItemIds.length > 4 && (
                      <div className="h-14 w-14 rounded-2xl bg-black/40 border-2 border-white/20 flex items-center justify-center text-xs font-black">
                        +{selectedItemIds.length - 4}
                      </div>
                    )}
                  </div>
                  <div className="border-l border-white/10 pl-6">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 leading-none mb-1">Comparative Intel</p>
                    <p className="text-xl font-black tracking-tight">{selectedItemIds.length} {t.items || "Items"} {t.selected || "Selected"}</p>
                  </div>
               </div>
               <div className="flex items-center gap-3 w-full md:w-auto">
                 <Button 
                   variant="ghost" 
                   onClick={() => setSelectedItemIds([])}
                   className="text-white hover:bg-white/10 rounded-2xl px-6 font-black uppercase text-[10px] tracking-widest h-12 flex-1 md:flex-none"
                 >
                   {t.clear || "Clear"}
                 </Button>
                 
                 <Button 
                   onClick={() => setShowComparison(true)}
                   disabled={selectedItemIds.length < 2}
                   className="bg-white text-[var(--primary)] hover:scale-105 active:scale-95 transition-all rounded-2xl px-10 h-12 text-xs font-black uppercase tracking-[0.1em] shadow-xl flex-1 md:flex-none disabled:opacity-50"
                 >
                   <TrendingUp size={18} className="mr-2" />
                   {t.compare || "Compare"}
                 </Button>

                 <Button 
                   onClick={() => setShowBulkUpdate(true)}
                   variant="outline"
                   className="border-white/20 text-white hover:bg-white/10 rounded-2xl px-6 h-12 text-[10px] font-black uppercase tracking-widest flex-1 md:flex-none"
                 >
                   <Edit2 size={16} className="mr-2" />
                   {t.bulkUpdate || "Bulk Update"}
                 </Button>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Action Buttons */}
      {activeTab === 'home' && (
        <Button 
          className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-2xl accent-glow"
          onClick={() => setShowAddItem(true)}
        >
          <Plus size={32} />
        </Button>
      )}
      {activeTab === 'notes' && (
        <Button 
          className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-2xl accent-glow bg-amber-500 hover:bg-amber-600"
          onClick={() => setShowAddNote(true)}
        >
          <PlusCircle size={32} />
        </Button>
      )}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showAddItem || editingItem) && (
          <ItemFormModal 
            onClose={() => {
              setShowAddItem(false);
              setEditingItem(null);
            }}
            onSave={editingItem ? (data) => handleUpdateItem(editingItem.id, data) : handleAddItem}
            initialData={editingItem || undefined}
            categories={state.categories}
            t={t}
            language={state.settings.language}
          />
        )}
        {showAddNote && (
          <NoteFormModal 
            onClose={() => setShowAddNote(false)}
            onSave={handleAddNote}
            t={t}
          />
        )}
        {showComparison && (
          <ComparisonModal 
            selectedItems={state.items.filter(i => selectedItemIds.includes(i.id))}
            onClose={() => setShowComparison(false)}
            t={t}
            language={state.settings.language}
            precision={precision}
            hideBuyingPrice={state.settings.hideBuyingPriceByDefault}
          />
        )}
        {showBulkUpdate && (
          <BulkPriceUpdateModal 
            selectedItems={state.items.filter(i => selectedItemIds.includes(i.id))}
            onClose={() => setShowBulkUpdate(false)}
            onSave={handleBulkUpdatePrices}
            t={t}
            language={state.settings.language}
          />
        )}
        {showBulkUpdate && (
          <BulkPriceUpdateModal 
            selectedItems={state.items.filter(i => selectedItemIds.includes(i.id))}
            onClose={() => setShowBulkUpdate(false)}
            onSave={handleBulkUpdatePrices}
            t={t}
            language={state.settings.language}
          />
        )}
        {showHelp && (
          <HelpModal 
            onClose={() => setShowHelp(false)}
            t={t}
          />
        )}
        {showTour && (
          <OnboardingTour 
            onClose={() => {
              setShowTour(false);
              handleUpdateSettings({ hasSeenOnboarding: true });
            }}
            t={t}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Sub-Components ---

const ItemCard = React.memo(({ item, isLocked, language, precision, onEdit, onDelete, t, onUpdateItem, isSelected, onSelect }: { 
  item: Item; 
  isLocked: boolean; 
  language: LanguageType;
  precision: number;
  onEdit: () => void;
  onDelete: () => void;
  t: any;
  onUpdateItem: (id: string, updates: Partial<Item>) => void;
  isSelected: boolean;
  onSelect: () => void;
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const category = DEFAULT_CATEGORIES.find(c => c.id === item.categoryId);
  const name = item.translations[language] || item.translations.en;

  const handleAIAdvice = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const advice = await generatePriceAdvisory(item);
      onUpdateItem(item.id, { aiAdvice: advice });
    } catch (e) {
      console.error("AI Advice failed", e);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      className={`card group overflow-hidden transition-all duration-300 shadow-xl border-2 relative ${
        isSelected ? 'border-[var(--primary)] ring-4 ring-[var(--primary)]/20 shadow-2xl' : 'border-white/5 hover:border-[var(--primary)]/30'
      }`}
      onClick={onSelect}
    >
      {/* Selection Badge */}
      {isSelected && (
        <div className="absolute top-3 right-3 z-30 bg-[var(--primary)] text-white p-1 rounded-full shadow-lg border border-white/20">
          <Check size={16} strokeWidth={4} />
        </div>
      )}

      <div className="relative p-5 pb-2 cursor-pointer">
        {/* Glow effect on hover */}
        <div className={`absolute inset-0 bg-gradient-to-br from-[var(--primary)]/10 to-transparent transition-opacity duration-500 ${
          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`} />
        
        <div className="flex items-start justify-between relative z-10">
          <div className="flex gap-4">
            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-3xl shadow-inner group-hover:scale-110 transition-transform duration-500 ${
              isSelected ? 'bg-[var(--primary)] text-white border-white/20 shadow-[0_0_20px_rgba(var(--primary-rgb),0.4)]' : 'bg-[var(--background)] border-[var(--border)]'
            }`}>
              {isSelected ? <TrendingUp size={28} /> : (category?.icon || '📦')}
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-tight text-[var(--foreground)]">{name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--primary)] uppercase tracking-tight">
                  {category?.name}
                </span>
                <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">
                  {item.quantity} {item.unit}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }} 
              className="h-9 w-9 rounded-full hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]"
            >
              <Edit2 size={18} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }} 
              className="h-9 w-9 rounded-full hover:bg-red-500/10 hover:text-red-500"
            >
              <Trash2 size={18} />
            </Button>
          </div>
        </div>
        
        <div className="mt-6 grid grid-cols-3 gap-2">
          {/* Retail */}
          <div className="rounded-xl bg-[var(--primary)]/5 p-3 border border-[var(--primary)]/20 transition-colors group-hover:bg-[var(--primary)]/10 shadow-inner">
            <p className="text-[9px] font-black uppercase tracking-widest text-[var(--primary)] opacity-70 mb-1">{t.retail}</p>
            <p className="text-sm font-bold text-[var(--foreground)] truncate">₹{formatNumber(item.retailPrice, precision)}</p>
            <p className="text-[8px] opacity-40">/ {item.retailPriceUnit}</p>
          </div>

          {/* Wholesale */}
          <div className="rounded-xl bg-[var(--background)]/50 p-3 border border-[var(--border)] transition-colors group-hover:border-[var(--primary)]/20 shadow-inner">
            <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">{t.wholesale}</p>
            <p className="text-sm font-bold text-[var(--foreground)] truncate">₹{formatNumber(item.wholesalePrice, precision)}</p>
            <p className="text-[8px] opacity-40">/ {item.wholesalePriceUnit}</p>
          </div>

          {/* Cost (Buy) */}
          <div className="rounded-xl bg-[var(--background)]/50 p-3 border border-[var(--border)] transition-colors group-hover:border-[var(--primary)]/20 shadow-inner">
            <p className="text-[9px] font-black uppercase tracking-widest opacity-40 mb-1">{t.buy}</p>
            <div className="flex flex-col">
              {isLocked ? (
                <div className="h-5 flex items-center">
                  <Lock size={12} className="opacity-40 animate-pulse" />
                </div>
              ) : (
                <>
                  <p className="text-sm font-bold text-[var(--foreground)] truncate">₹{formatNumber(item.buyingPrice, precision)}</p>
                  <p className="text-[8px] opacity-40">/ {item.buyingPriceUnit}</p>
                </>
              )}
            </div>
          </div>

          {/* Profit Margin (Calculated) */}
          <div className="rounded-xl bg-green-500/5 p-3 border border-green-500/20 transition-colors group-hover:bg-green-500/10 shadow-inner">
            <p className="text-[9px] font-black uppercase tracking-widest text-green-600 opacity-70 mb-1">{t.margin}</p>
            <div className="flex flex-col">
              {isLocked ? (
                <div className="h-5 flex items-center">
                  <Lock size={12} className="opacity-40 animate-pulse" />
                </div>
              ) : (
                <>
                  <p className="text-sm font-bold text-green-600 truncate">₹{formatNumber(item.retailPrice - item.buyingPrice, precision)}</p>
                  <p className="text-[8px] text-green-500 font-bold">
                    {item.buyingPrice > 0 ? `+${formatNumber(((item.retailPrice - item.buyingPrice) / item.buyingPrice) * 100, 1)}%` : '---'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* AI Advisory Section */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/80">{t.aiInsight}</span>
            </div>
            {!item.aiAdvice && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleAIAdvice}
                disabled={isGenerating}
                className="h-6 px-2 text-[9px] font-black uppercase tracking-widest hover:bg-amber-500/10 hover:text-amber-600 rounded-full border border-amber-500/20"
              >
                {isGenerating ? t.analyzing : t.analyze}
              </Button>
            )}
          </div>
          
          {item.aiAdvice ? (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="relative p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10"
            >
              <p className="text-[11px] leading-relaxed italic opacity-80 pr-6">
                “{item.aiAdvice}”
              </p>
              <button 
                onClick={handleAIAdvice}
                className="absolute top-2 right-2 p-1 rounded-full hover:bg-amber-500/20 text-amber-500 transition-colors"
                title={t.analyze}
              >
                <RefreshCw size={10} className={isGenerating ? "animate-spin" : ""} />
              </button>
            </motion.div>
          ) : (
            <p className="text-[10px] opacity-30 italic px-1">{t.getAiAdvice}</p>
          )}
        </div>
      </div>
      
      {/* Bottom info bar */}
      <div className="bg-[var(--background)]/30 border-t border-[var(--border)] px-5 py-2 flex justify-between items-center">
        <span className="text-[8px] font-bold uppercase tracking-widest opacity-30">
          {t.lastCheck}: {new Date(item.lastUpdated).toLocaleDateString()}
        </span>
        <div className="flex items-center gap-2">
           <span className="text-[8px] font-bold opacity-30 uppercase">Languages:</span>
           <div className="flex -space-x-1">
            {LANGUAGES.map(l => (
              <div key={l.id} className="w-4 h-4 rounded-full border-2 border-[var(--card)] bg-[var(--background)] flex items-center justify-center text-[8px] opacity-40">
                {l.emoji}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <motion.button 
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-all",
        active ? "text-[var(--primary)]" : "text-[var(--foreground)] opacity-40 hover:opacity-100"
      )}
    >
      <div className={cn("rounded-full p-1 transition-all", active && "bg-[var(--primary)]/10")}>
        {React.cloneElement(icon as React.ReactElement, { size: 24 })}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
      {active && <motion.div layoutId="nav-dot" className="h-1 w-1 rounded-full bg-[var(--primary)]" />}
    </motion.button>
  );
}

/**
 * HelpModal Sub-component
 */
function HelpModal({ onClose, t }: { onClose: () => void; t: any }) {
  const [activeTab, setActiveTab] = useState<'tips' | 'quickstart' | 'analytics' | 'cloud' | 'security'>('quickstart');

  const tabs = [
    { id: 'quickstart', label: t.helpQuickStart, icon: <Zap size={18} /> },
    { id: 'analytics', label: t.helpAnalytics, icon: <TrendingUp size={18} /> },
    { id: 'cloud', label: t.helpCloud, icon: <Cloud size={18} /> },
    { id: 'security', label: t.helpSecurity, icon: <Shield size={18} /> },
    { id: 'tips', label: t.helpTips, icon: <Lightbulb size={18} /> },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-4xl bg-[var(--background)] rounded-[2.5rem] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[85vh]"
      >
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-white/5 border-r border-[var(--border)] flex flex-col">
          <div className="p-8 border-b border-[var(--border)]">
            <h2 className="text-xl font-black tracking-tight">{t.help}</h2>
            <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mt-1">Enterprise Guide</p>
          </div>
          <div className="flex-1 p-4 flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-x-visible">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap md:whitespace-normal text-left group",
                  activeTab === tab.id 
                    ? "bg-[var(--primary)] text-white shadow-lg" 
                    : "hover:bg-white/5 opacity-60 hover:opacity-100"
                )}
              >
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center transition-colors",
                  activeTab === tab.id ? "bg-white/20" : "bg-white/5 group-hover:bg-white/10"
                )}>
                  {tab.icon}
                </div>
                <span className="text-xs font-bold">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white/[0.02]">
          <div className="p-8 border-b border-[var(--border)] flex items-center justify-between">
            <div>
              <h3 className="font-black uppercase text-xs tracking-widest text-[var(--primary)]">
                {tabs.find(p => p.id === activeTab)?.label}
              </h3>
            </div>
            <Button variant="outline" size="icon" onClick={onClose} className="rounded-full h-8 w-8 border-white/10">
              <X size={16} />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {activeTab === 'quickstart' && (
                  <div className="space-y-6">
                    <div className="grid gap-4">
                      {[t.qs1, t.qs2, t.qs3].map((text, i) => (
                        <div key={i} className="flex gap-4 p-5 rounded-2xl bg-white/5 border border-white/5">
                          <div className="h-10 w-10 shrink-0 bg-[var(--primary)]/10 rounded-full flex items-center justify-center text-[var(--primary)] font-black">
                            {i + 1}
                          </div>
                          <p className="text-sm font-medium leading-relaxed opacity-80">{text}</p>
                        </div>
                      ))}
                    </div>
                    <div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20 flex gap-4 items-start">
                       <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                       <div className="space-y-1">
                         <p className="font-bold text-xs uppercase text-amber-500">Important</p>
                         <p className="text-xs opacity-60 leading-relaxed italic">Always remember your verify PIN. If you forget it, you will have to clear app data which might result in loss if not synced to cloud.</p>
                       </div>
                    </div>
                  </div>
                )}

                {activeTab === 'analytics' && (
                  <div className="space-y-6">
                    <p className="text-sm opacity-60 leading-relaxed">{t.analyticsDesc}</p>
                    <div className="p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 space-y-4">
                       <h4 className="font-black text-[10px] uppercase tracking-widest opacity-40">Pro Insight</h4>
                       <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                             <TrendingUp size={24} />
                          </div>
                          <p className="text-xs font-semibold">Monitor the "Low Stock" badge in your dashbaord to prevent missed sales opportunities.</p>
                       </div>
                    </div>
                  </div>
                )}

                {activeTab === 'cloud' && (
                   <div className="space-y-6">
                     <p className="text-sm opacity-60 leading-relaxed">{t.cloudDesc}</p>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-3xl bg-white/5 border border-white/5 space-y-2">
                           <p className="font-bold text-xs">Offline Support</p>
                           <p className="text-[10px] opacity-40">App caches all data locally. You can bill customers even without internet.</p>
                        </div>
                        <div className="p-5 rounded-3xl bg-white/5 border border-white/5 space-y-2">
                           <p className="font-bold text-xs">Conflicts</p>
                           <p className="text-[10px] opacity-40">Last saved device wins. Make sure to stay online for instant multi-user sync.</p>
                        </div>
                     </div>
                   </div>
                )}

                {activeTab === 'security' && (
                   <div className="space-y-6">
                     <p className="text-sm opacity-60 leading-relaxed">{t.securityDesc}</p>
                     <div className="p-6 rounded-[2rem] bg-amber-500 text-black space-y-2">
                        <div className="flex items-center gap-2">
                           <Lock size={16} />
                           <p className="font-black text-xs uppercase">Stealth Mode</p>
                        </div>
                        <p className="text-xs font-bold leading-tight">Enable "Stealth Mode" in settings to automatically hide cost prices whenever the app opens.</p>
                     </div>
                   </div>
                )}

                {activeTab === 'tips' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-[var(--primary)]/30 transition-all cursor-default">
                       <p className="font-black text-xs text-[var(--primary)] mb-2 uppercase">Search Hacks</p>
                       <p className="text-xs opacity-60">Try searching for <strong>"Chini"</strong> or <strong>"Sugar"</strong> - the engine understands both if added correctly.</p>
                    </div>
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-[var(--primary)]/30 transition-all cursor-default">
                       <p className="font-black text-xs text-[var(--primary)] mb-2 uppercase">Bulk Compare</p>
                       <p className="text-xs opacity-60">Hold an item to select multiple, then tap <strong>"Compare"</strong> for a split view analysis.</p>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          
          <div className="p-8 border-t border-[var(--border)] bg-white/[0.02] flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)]">
                  <ShieldCheck size={20} />
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest">Enterprise Secured</p>
                  <p className="text-[8px] opacity-40 font-bold">End-to-End Encryption Enabled</p>
               </div>
            </div>
            <button onClick={onClose} className="text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">
              Close Guide
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/**
 * OnboardingTour Sub-component
 */
function OnboardingTour({ onClose, t }: { onClose: () => void; t: any }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t.onboardingTitle,
      desc: t.onboardingSub,
      target: null,
      icon: <Sparkles className="text-amber-500" size={32} />
    },
    {
      title: t.step1Title,
      desc: t.step1Desc,
      target: 'tour-search',
      icon: <Search className="text-blue-500" size={32} />
    },
    {
      title: t.step2Title,
      desc: t.step2Desc,
      target: 'tour-lock',
      icon: <Lock className="text-amber-500" size={32} />
    },
    {
      title: t.step3Title,
      desc: t.step3Desc,
      target: 'tour-notes',
      icon: <Bell className="text-emerald-500" size={32} />
    },
    {
      title: "Comparison Engine",
      desc: "Select multiple items and compare prices side-by-side to make better buying choices.",
      target: 'tour-nav',
      icon: <RefreshCw className="text-indigo-500" size={32} />
    }
  ];

  const currentStep = steps[step];

  useEffect(() => {
    if (currentStep.target) {
      const el = document.getElementById(currentStep.target);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-[var(--primary)]', 'ring-offset-4', 'ring-offset-black', 'transition-all');
        return () => {
          el.classList.remove('ring-4', 'ring-[var(--primary)]', 'ring-offset-4', 'ring-offset-black');
        };
      }
    }
  }, [step, currentStep.target]);

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      <AnimatePresence mode="wait">
        <motion.div 
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute inset-0 flex items-center justify-center p-6 bg-black/40 backdrop-blur-[2px] pointer-events-auto"
        >
          <div className="w-full max-w-sm bg-[var(--card)] rounded-[2.5rem] border-2 border-[var(--primary)] shadow-[0_30px_60px_rgba(0,0,0,0.6)] p-8 text-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--primary)] opacity-20" />
            <div className="mb-6 flex justify-center">
              <div className="p-5 rounded-3xl bg-[var(--primary)]/5 relative">
                {currentStep.icon}
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-[var(--primary)]/10 rounded-full blur-xl"
                />
              </div>
            </div>
            
            <h3 className="text-xl font-black tracking-tight mb-2 uppercase">{currentStep.title}</h3>
            <p className="text-xs font-medium opacity-60 leading-relaxed mb-8">{currentStep.desc}</p>
            
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => {
                  if (step < steps.length - 1) setStep(step + 1);
                  else onClose();
                }}
                className="w-full h-12 rounded-2xl shadow-lg shadow-[var(--primary)]/20"
              >
                {step === steps.length - 1 ? t.tourFinish : t.tourNext}
              </Button>
              <Button 
                variant="ghost" 
                onClick={onClose}
                className="w-full h-10 rounded-2xl text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100"
              >
                {t.tourSkip}
              </Button>
            </div>

            <div className="mt-6 flex justify-center gap-1.5">
              {steps.map((_, i) => (
                <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === step ? 'w-6 bg-[var(--primary)]' : 'w-1.5 bg-white/10'}`} />
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function BulkPriceUpdateModal({ selectedItems, onClose, onSave, t, language }: {
  selectedItems: Item[];
  onClose: () => void;
  onSave: (ids: string[], updates: { retailPrice?: number; wholesalePrice?: number; buyingPrice?: number }) => void;
  t: any;
  language: LanguageType;
}) {
  const [updates, setUpdates] = useState({
    retailPrice: '',
    wholesalePrice: '',
    buyingPrice: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalUpdates: any = {};
    if (updates.retailPrice !== '') finalUpdates.retailPrice = Number(updates.retailPrice);
    if (updates.wholesalePrice !== '') finalUpdates.wholesalePrice = Number(updates.wholesalePrice);
    if (updates.buyingPrice !== '') finalUpdates.buyingPrice = Number(updates.buyingPrice);

    if (Object.keys(finalUpdates).length === 0) {
      alert("No changes specified");
      return;
    }

    onSave(selectedItems.map(i => i.id), finalUpdates);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="w-full max-w-lg bg-[var(--card)] rounded-[2.5rem] border border-white/10 shadow-2xl p-8"
      >
        <div className="flex items-center justify-between mb-8">
           <div>
             <h2 className="text-xl font-black tracking-tight">{t.bulkUpdate}</h2>
             <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-1">{t.adjustPrices}</p>
           </div>
           <Button variant="outline" size="icon" onClick={onClose} className="rounded-full h-10 w-10 border-white/5">
             <X size={20} />
           </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
           <div className="grid gap-4">
              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">{t.retailPrice}</label>
                 <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-black">₹</span>
                    <input 
                      type="number" 
                      placeholder="Leave blank for no change"
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 text-sm focus:border-[var(--primary)] outline-none transition-all placeholder:text-white/10"
                      value={updates.retailPrice}
                      onChange={e => setUpdates(prev => ({ ...prev, retailPrice: e.target.value }))}
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">{t.wholesalePrice}</label>
                 <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-black">₹</span>
                    <input 
                      type="number" 
                      placeholder="Leave blank for no change"
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 text-sm focus:border-[var(--primary)] outline-none transition-all placeholder:text-white/10"
                      value={updates.wholesalePrice}
                      onChange={e => setUpdates(prev => ({ ...prev, wholesalePrice: e.target.value }))}
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-1">{t.buyingPrice}</label>
                 <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 font-black">₹</span>
                    <input 
                      type="number" 
                      placeholder="Leave blank for no change"
                      className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 text-sm focus:border-[var(--primary)] outline-none transition-all placeholder:text-white/10"
                      value={updates.buyingPrice}
                      onChange={e => setUpdates(prev => ({ ...prev, buyingPrice: e.target.value }))}
                    />
                 </div>
              </div>
           </div>

           <div className="pt-4 flex flex-col gap-3">
              <Button type="submit" className="h-14 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-[var(--primary)]/20">
                <Check size={18} className="mr-2" />
                {t.updateSelected}
              </Button>
              <div className="p-4 bg-white/5 border border-dashed border-white/10 rounded-2xl">
                 <p className="text-[9px] font-black uppercase tracking-widest opacity-30 text-center">
                    Updating {selectedItems.length} items across various categories
                 </p>
              </div>
           </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function ComparisonModal({ selectedItems, onClose, t, language, precision, hideBuyingPrice }: {
  selectedItems: Item[];
  onClose: () => void;
  t: any;
  language: LanguageType;
  precision: number;
  hideBuyingPrice: boolean;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-5xl bg-[var(--background)] rounded-[3rem] border border-[var(--border)] shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-8">
           <div>
             <h2 className="text-2xl font-black tracking-tight">{t.compare || "Compare"} {selectedItems.length} {t.items || "Items"}</h2>
             <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-1">{t.sideBySide || "Side-by-side analysis"}</p>
           </div>
           <Button variant="outline" size="icon" onClick={onClose} className="rounded-full h-12 w-12 hover:bg-red-500/10 hover:text-red-500 border-white/10">
             <X size={24} />
           </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {selectedItems.map((item) => {
            const cat = DEFAULT_CATEGORIES.find(c => c.id === item.categoryId);
            const name = item.translations[language] || item.translations.en;
            const revenuePotential = item.retailPrice * item.quantity;
            const costBasis = item.buyingPrice * item.quantity;
            const profitPotential = revenuePotential - costBasis;
            const marginPercent = costBasis > 0 ? (profitPotential / costBasis) * 100 : 0;
            
            return (
              <div key={item.id} className="card p-6 bg-gradient-to-br from-[var(--card)] to-transparent border-white/5 space-y-6 flex flex-col">
                <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                  <div className="h-16 w-16 rounded-2xl bg-[var(--background)] border border-[var(--border)] flex items-center justify-center text-3xl shadow-inner">
                    {cat?.icon || '📦'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-lg truncate">{name}</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">{cat?.name}</p>
                  </div>
                </div>

                <div className="space-y-4 flex-1">
                   <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">{t.retail || "Retail"}</span>
                      <div className="text-right">
                        <span className="text-sm font-black text-amber-500">₹{formatNumber(item.retailPrice, precision)}</span>
                        <span className="text-[8px] opacity-40 block">/ {item.retailPriceUnit}</span>
                      </div>
                   </div>

                   <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">{t.wholesale || "Wholesale"}</span>
                      <div className="text-right">
                        <span className="text-sm font-black text-blue-400">₹{formatNumber(item.wholesalePrice, precision)}</span>
                        <span className="text-[8px] opacity-40 block">/ {item.wholesalePriceUnit}</span>
                      </div>
                   </div>

                   {!hideBuyingPrice && (
                     <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">{t.buying || "Buying"}</span>
                        <div className="text-right">
                          <span className="text-sm font-black">₹{formatNumber(item.buyingPrice, precision)}</span>
                          <span className="text-[8px] opacity-40 block">/ {item.buyingPriceUnit}</span>
                        </div>
                     </div>
                   )}

                   <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">{t.inventory || "Stock"}</span>
                      <span className="text-sm font-black">{item.quantity} {item.unit}</span>
                   </div>

                   {!hideBuyingPrice && (
                     <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5">
                        <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                           <p className="text-[8px] font-black uppercase tracking-widest text-emerald-500 opacity-60 mb-1">{t.profitability}</p>
                           <p className="text-lg font-black text-emerald-500">{marginPercent.toFixed(1)}%</p>
                        </div>
                        <div className="bg-blue-500/5 p-3 rounded-xl border border-blue-500/10">
                           <p className="text-[8px] font-black uppercase tracking-widest text-blue-400 opacity-60 mb-1">{t.revenuePotential}</p>
                           <p className="text-lg font-black text-blue-400">₹{formatNumber(revenuePotential, 0)}</p>
                        </div>
                     </div>
                   )}

                   <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">{t.lastChanged || "Last Update"}</span>
                      <span className="text-[10px] font-bold opacity-60">
                        {item.priceChangedAt ? new Date(item.priceChangedAt).toLocaleDateString() : 'Never'}
                      </span>
                   </div>
                </div>

                {item.aiAdvice && (
                  <div className="mt-auto p-4 bg-gradient-to-br from-[var(--primary)]/10 to-transparent rounded-2xl border border-[var(--primary)]/20 shadow-inner">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--primary)] mb-2 flex items-center gap-2">
                       <Sparkles size={14} className="animate-pulse" /> {t.aiInsight || "AI Intelligence"}
                    </p>
                    <p className="text-[11px] leading-relaxed font-medium opacity-90 italic">"{item.aiAdvice}"</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ItemFormModal({ onClose, onSave, categories, initialData, t, language }: { 
  onClose: () => void, 
  onSave: (data: Partial<Item>) => void,
  categories: Category[],
  initialData?: Item,
  t: any,
  language: LanguageType
}) {
  const [formData, setFormData] = useState<Partial<Item>>(
    initialData || {
      name: '',
      categoryId: categories[0]?.id || '',
      quantity: 1,
      unit: 'KG',
      retailPrice: 0,
      retailPriceUnit: 'KG',
      wholesalePrice: 0,
      wholesalePriceUnit: 'KG',
      buyingPrice: 0,
      buyingPriceUnit: 'KG',
      profitMargin: 0,
      translations: { en: '', hi: '', mr: '', 'hi-en': '' },
      notes: '',
    }
  );

  const [activeUnitSelection, setActiveUnitSelection] = useState<'base'|'retail'|'wholesale'|'buy'|null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const section1Ref = React.useRef<HTMLDivElement>(null);
  const section2Ref = React.useRef<HTMLDivElement>(null);
  const section3Ref = React.useRef<HTMLDivElement>(null);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleNameBlur = async () => {
    if (!formData.name || (initialData && formData.name === initialData.name)) return;
    setIsTranslating(true);
    const trans = await translateItemName(formData.name);
    setFormData(prev => ({ ...prev, translations: trans }));
    setIsTranslating(false);
  };

  const handleUnitSelect = (unit: string) => {
    if (activeUnitSelection === 'base') setFormData(prev => ({ ...prev, unit }));
    if (activeUnitSelection === 'buy') setFormData(prev => ({ ...prev, buyingPriceUnit: unit }));
    if (activeUnitSelection === 'wholesale') setFormData(prev => ({ ...prev, wholesalePriceUnit: unit }));
    if (activeUnitSelection === 'retail') setFormData(prev => ({ ...prev, retailPriceUnit: unit }));
    setActiveUnitSelection(null);
  };

  const handleSave = () => {
    if (!formData.name) return alert('Name is required');
    onSave(formData);
    onClose();
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  const quickQtys = [5, 10, 25, 50, 100];
  const quickAmounts = [100, 500, 1000, 5000];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 md:items-center md:p-4 backdrop-blur-sm"
    >
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="h-[95vh] w-full max-w-2xl overflow-hidden rounded-t-[2rem] bg-[var(--card)] flex flex-col md:h-[90vh] md:rounded-[2.5rem] shadow-2xl border border-white/5"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)] shrink-0 bg-[var(--card)]/80 backdrop-blur-md z-20">
          <div className="flex items-center gap-4">
             <div className="h-10 w-10 rounded-xl bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] shadow-inner">
                {initialData ? <Edit2 size={20} /> : <Plus size={20} />}
             </div>
             <div>
                <h2 className="text-lg font-black tracking-tighter uppercase">{initialData ? t.updateRecord : t.newEntry}</h2>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-30">Operational Matrix v2.5</p>
             </div>
          </div>
          <Button variant="ghost" onClick={onClose} size="icon" className="rounded-xl bg-[var(--background)] hover:bg-[var(--primary)]/10 transition-colors"><X size={20} /></Button>
        </div>

        {/* Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 space-y-24 no-scrollbar pb-32 scroll-smooth">
          
          {/* Section 1: Identity */}
          <motion.div 
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            ref={section1Ref} 
            className="space-y-6 pt-4"
          >
             <label className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[var(--primary)] px-2">
               <span className="w-6 h-6 rounded bg-[var(--primary)]/10 flex items-center justify-center text-[10px]">01</span> {t.identityParams}
             </label>
             <div className="space-y-4">
               <div className="group relative">
                <input 
                  className="w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--background)] p-6 font-black text-2xl focus:border-[var(--primary)] focus:outline-none transition-all placeholder:opacity-20 shadow-inner"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  onBlur={handleNameBlur}
                  placeholder="Item nomenclature..."
                />
                {isTranslating && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-bounce [animation-delay:0.4s]" />
                  </div>
                )}
               </div>

               <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                 {LANGUAGES.map(lang => (
                   <div key={lang.id} className="flex items-center gap-2 rounded-xl bg-[var(--card)] border border-[var(--border)] p-3 text-[10px] shadow-sm">
                     <span className="opacity-80">{lang.emoji}</span>
                     <span className="flex-1 font-bold opacity-30 truncate">
                       {formData.translations[lang.id] || '---'}
                     </span>
                   </div>
                 ))}
               </div>

               <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
                 {categories.map(cat => (
                   <button
                     key={cat.id}
                     onClick={() => setFormData(prev => ({ ...prev, categoryId: cat.id }))}
                     className={cn(
                       "flex items-center gap-3 rounded-xl border-2 px-5 py-3 transition-all shrink-0 font-black text-[10px] uppercase",
                       formData.categoryId === cat.id 
                         ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-lg scale-105" 
                         : "border-[var(--border)] bg-[var(--background)] opacity-60 hover:border-[var(--primary)]/40 hover:opacity-100"
                     )}
                   >
                     <span>{cat.icon}</span> <span>{cat.name}</span>
                   </button>
                 ))}
               </div>
             </div>
          </motion.div>

          {/* Section 2: Logistical Metrics */}
          <motion.div 
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            ref={section2Ref} 
            className="space-y-8 border-t border-[var(--border)] pt-12"
          >
             <label className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[var(--primary)] px-2">
                <span className="w-6 h-6 rounded bg-[var(--primary)]/10 flex items-center justify-center text-[10px]">02</span> Inventory logistics
             </label>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-3">
                 <p className="text-[10px] font-black uppercase tracking-widest opacity-30">Current availability</p>
                 <div className="flex gap-2">
                   <input 
                     type="number"
                     className="flex-1 rounded-2xl border-2 border-[var(--border)] bg-[var(--background)] p-4 font-black text-xl focus:border-[var(--primary)] focus:outline-none transition-all shadow-inner"
                     value={formData.quantity}
                     onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                   />
                   <button 
                     onClick={() => setActiveUnitSelection('base')}
                     className="rounded-2xl border-2 border-[var(--border)] bg-[var(--card)] px-6 font-black uppercase text-[10px] hover:border-[var(--primary)] transition-all flex items-center gap-2"
                   >
                     {formData.unit} <ChevronDown size={14} />
                   </button>
                 </div>
                 <div className="flex flex-wrap gap-1.5 pt-2">
                   {quickQtys.map(q => (
                     <button key={q} onClick={() => setFormData(prev => ({ ...prev, quantity: q }))} className="px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[9px] font-black opacity-30 hover:opacity-100 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">{q} {formData.unit}</button>
                   ))}
                 </div>
               </div>

               <div className="space-y-3">
                 <p className="text-[10px] font-black uppercase tracking-widest opacity-30">Field notes / Intelligence</p>
                 <textarea 
                    className="w-full h-[98px] rounded-2xl border-2 border-[var(--border)] bg-[var(--background)] p-4 font-bold text-xs focus:border-[var(--primary)] focus:outline-none transition-all shadow-inner resize-none"
                    placeholder="Batch identity, source node..."
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                 />
               </div>
             </div>
          </motion.div>

          {/* Section 3: Financial Framework */}
          <motion.div 
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            ref={section3Ref} 
            className="space-y-10 border-t border-[var(--border)] pt-12 pb-20"
          >
             <label className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-[var(--primary)] px-2">
                <span className="w-6 h-6 rounded bg-[var(--primary)]/10 flex items-center justify-center text-[10px]">03</span> Price configuration
             </label>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { label: t.retail, key: 'retailPrice', unitKey: 'retailPriceUnit', selection: 'retail', color: 'bg-green-500/10' },
                  { label: t.wholesale, key: 'wholesalePrice', unitKey: 'wholesalePriceUnit', selection: 'wholesale', color: 'bg-blue-500/10' },
                  { label: t.buy, key: 'buyingPrice', unitKey: 'buyingPriceUnit', selection: 'buy', color: 'bg-orange-500/10' }
                ].map((field) => (
                  <div key={field.key} className="space-y-3">
                     <p className="text-[9px] font-black uppercase tracking-widest opacity-30">{field.label}</p>
                     <div className="relative group">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-xl opacity-10 group-focus-within:opacity-40 transition-opacity">
                           {field.key === 'profitMargin' ? '%' : '₹'}
                        </span>
                        <input 
                           type="number"
                           className="w-full rounded-2xl border-2 border-[var(--border)] bg-[var(--background)] py-4 pl-10 pr-4 font-black text-lg focus:border-[var(--primary)] focus:outline-none transition-all shadow-inner"
                           value={(formData as any)[field.key]}
                           onChange={(e) => setFormData(prev => ({ ...prev, [field.key]: parseFloat(e.target.value) || 0 }))}
                        />
                     </div>
                     {field.selection && (
                        <button 
                           onClick={() => setActiveUnitSelection(field.selection as any)}
                           className={cn("w-full py-2.5 rounded-xl border border-transparent font-black uppercase text-[8px] tracking-widest transition-all", field.color)}
                        >
                           Per {(formData as any)[field.unitKey]}
                        </button>
                     )}
                  </div>
                ))}
             </div>
             
             <div className="grid grid-cols-4 gap-2">
                {quickAmounts.map(amt => (
                  <button key={amt} onClick={() => setFormData(prev => ({ ...prev, retailPrice: amt }))} className="p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-[9px] font-black opacity-30 hover:opacity-100 hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all">₹{amt}</button>
                ))}
             </div>
          </motion.div>
        </div>

        {/* Action Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--card)] via-[var(--card)]/95 to-transparent z-10 pointer-events-none">
           <div className="flex gap-4 pointer-events-auto">
             <Button className="w-full py-5 rounded-2xl font-black uppercase text-xs shadow-xl shadow-[var(--primary)]/20" onClick={handleSave}>
                {initialData ? t.commitEvolution : t.initializeParams}
             </Button>
           </div>
        </div>

        <AnimatePresence>
          {activeUnitSelection && (
            <UnitSelectorModal 
              onClose={() => setActiveUnitSelection(null)}
              onSelect={handleUnitSelect}
              currentUnit={
                activeUnitSelection === 'base' ? formData.unit! :
                activeUnitSelection === 'buy' ? formData.buyingPriceUnit! :
                activeUnitSelection === 'wholesale' ? formData.wholesalePriceUnit! :
                formData.retailPriceUnit!
              }
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

function NotificationsView({ 
  notes, 
  items, 
  dismissed,
  currentTime,
  onViewNote,
  onViewItem
}: { 
  notes: Note[], 
  items: Item[], 
  dismissed: string[],
  currentTime: Date,
  onViewNote: (id: string) => void,
  onViewItem: (id: string) => void
}) {
  const allNotifications = useMemo(() => {
    const list: any[] = [];
    const now = currentTime;

    // 1. Reminders & Notes
    notes.forEach(note => {
      const isReminder = note.category === 'Reminder' && note.dueDate;
      const isDue = isReminder && new Date(note.dueDate!) <= now;
      const isSoon = isReminder && !isDue && (new Date(note.dueDate!).getTime() - now.getTime()) < 3600000 * 24;

      list.push({
        id: note.id,
        type: 'note',
        category: note.category,
        title: note.title,
        description: note.description,
        timestamp: note.createdAt,
        priority: isDue ? 'Urgent' : note.priority,
        icon: isReminder ? <Clock size={20} /> : <FileText size={20} />,
        dueInfo: isDue ? "OVERDUE" : isSoon ? "Due Soon" : null,
        dismissed: dismissed.includes(note.id)
      });
    });

    // 2. Price Changes
    items.forEach(item => {
      if (item.priceChangedAt) {
        list.push({
          id: `price-${item.id}-${item.priceChangedAt}`,
          type: 'price',
          title: `Price Evolution: ${item.translations.en}`,
          description: `Price changed on ${new Date(item.priceChangedAt).toLocaleDateString()} by ${item.lastChangedBy || 'Master Node'}.`,
          timestamp: item.priceChangedAt,
          priority: 'Info',
          icon: <TrendingUp size={20} />,
          itemId: item.id,
          dismissed: dismissed.includes(`price-${item.id}-${item.priceChangedAt}`)
        });
      }
    });

    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [notes, items, dismissed, currentTime]);

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-32">
      <header className="space-y-2">
        <h1 className="text-3xl font-black tracking-tighter uppercase">Intelligence <span className="text-[var(--primary)]">Feed</span></h1>
        <p className="text-xs font-bold opacity-40 uppercase tracking-[0.2em]">Audit trail and real-time operational alerts</p>
      </header>

      <div className="grid grid-cols-1 gap-3">
        {allNotifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => notif.type === 'price' ? onViewItem(notif.itemId) : onViewNote(notif.id)}
            className={cn(
              "group p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden flex items-center gap-6",
              notif.dismissed ? "opacity-40 grayscale" : "opacity-100",
              notif.priority === 'Urgent' ? "bg-red-500/5 border-red-500/20" : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--primary)]/30"
            )}
          >
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:scale-110 shrink-0",
              notif.priority === 'Urgent' ? "bg-red-500 text-white" : "bg-[var(--primary)]/10 text-[var(--primary)]"
            )}>
              {notif.icon}
            </div>

            <div className="flex-1 space-y-1 min-w-0">
               <div className="flex items-center gap-3">
                  <h3 className="font-bold text-sm truncate uppercase tracking-tight">{notif.title}</h3>
                  {notif.priority === 'Urgent' && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[8px] font-black uppercase">Critical</span>
                  )}
                  {notif.dueInfo && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[8px] font-black uppercase">{notif.dueInfo}</span>
                  )}
               </div>
               <p className="text-xs opacity-60 line-clamp-1">{notif.description}</p>
            </div>

            <div className="text-right shrink-0">
               <p className="text-[10px] font-black opacity-30 uppercase">{new Date(notif.timestamp).toLocaleDateString()}</p>
               <p className="text-[10px] font-black opacity-30 uppercase">{new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </motion.div>
        ))}

        {allNotifications.length === 0 && (
          <div className="py-32 text-center space-y-4 opacity-30">
             <BellRing size={64} className="mx-auto opacity-20" />
             <p className="font-black uppercase tracking-widest text-sm">System Quiet. No active alerts.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsScreen({ 
  state, t, onUpdate, onShowHelp, onResetPIN,
  onExportExcel, onExportPDF, onImport, onBackup, onRestore, onClearCache 
}: { 
  state: AppState; t: any; onUpdate: (u: any) => void; onShowHelp: () => void; onResetPIN: () => void;
  onExportExcel: () => void;
  onExportPDF: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBackup: () => void;
  onRestore: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearCache: () => void;
}) {
  const accentOptions = [
    { id: 'indigo', color: '#6366f1' },
    { id: 'emerald', color: '#10b981' },
    { id: 'rose', color: '#f43f5e' },
    { id: 'amber', color: '#f59e0b' },
    { id: 'cyan', color: '#06b6d4' },
    { id: 'slate', color: '#64748b' },
  ];

  const fontSizeOptions = [
    { id: 'compact', label: 'Compact', icon: <Minimize2 size={14} /> },
    { id: 'standard', label: 'Standard', icon: <Type size={14} /> },
    { id: 'comfortable', label: 'Spaced', icon: <Maximize2 size={14} /> },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-12 pb-32 max-w-2xl mx-auto">
      <div className="flex flex-col gap-1 items-center md:items-start">
        <div className="h-1 bg-[var(--primary)] w-12 rounded-full mb-4 md:hidden" />
        <h2 className="text-4xl font-black tracking-tighter text-[var(--foreground)] uppercase">{t.settings}</h2>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">Enterprise System v3.1</p>
      </div>

      <div className="space-y-16">
        {/* Localization & Theme */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
             <div className="h-1 w-8 bg-[var(--primary)] opacity-30 rounded-full" />
             <label className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--primary)]">Global Interface</label>
          </div>
          
          <div className="grid gap-8">
            <div className="space-y-4">
              <p className="text-xs font-bold opacity-60 ml-1">Linguistic Interface</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.id}
                    onClick={() => onUpdate({ language: lang.id })}
                    className={cn(
                      "group relative flex flex-col items-center gap-3 rounded-[2rem] border p-6 transition-all",
                      state.settings.language === lang.id 
                        ? "border-[var(--primary)] bg-[var(--primary)]/10 shadow-lg" 
                        : "border-[var(--border)] bg-[var(--background)] hover:border-[var(--primary)]/40"
                    )}
                  >
                    <span className="text-4xl transition-transform group-hover:scale-110">{lang.emoji}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest">{lang.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Deck Section */}
            <div className="space-y-4">
              <p className="text-xs font-bold opacity-60 ml-1">{t.themeDeck}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {THEMES.map(theme => (
                  <button
                    key={theme.id}
                    onClick={() => onUpdate({ theme: theme.id })}
                    className={cn(
                      "relative flex items-center gap-5 rounded-[2.5rem] border p-6 text-left transition-all overflow-hidden group",
                      state.settings.theme === theme.id 
                        ? "border-[var(--primary)] bg-[var(--primary)]/20 shadow-2xl scale-[1.02]" 
                        : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40"
                    )}
                  >
                    <div className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl transition-transform group-hover:rotate-6",
                      state.settings.theme === theme.id ? "bg-[var(--primary)] text-white shadow-lg" : "bg-[var(--background)] shadow-inner"
                    )}>
                      {theme.emoji}
                    </div>
                    <div className="relative z-10">
                      <p className="font-black uppercase tracking-tighter text-xs">{theme.name}</p>
                      <p className={cn(
                        "text-[9px] font-bold leading-tight mt-1 uppercase opacity-40",
                        state.settings.theme === theme.id && "opacity-80"
                      )}>
                        {theme.description}
                      </p>
                    </div>
                    {state.settings.theme === theme.id && <CheckCircle2 size={24} className="absolute top-1/2 -right-4 -translate-y-1/2 scale-[3] opacity-10 text-[var(--primary)]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color Section */}
            <div className="space-y-4">
              <p className="text-xs font-bold opacity-60 ml-1">{t.accentOverlay}</p>
              <div className="flex flex-wrap gap-4 p-6 bg-[var(--card)] rounded-[2.5rem] border border-[var(--border)] shadow-inner">
                {accentOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => onUpdate({ accentColor: opt.id })}
                    className={cn(
                      "h-12 w-12 rounded-full transition-all flex items-center justify-center border-2 border-white/10",
                      state.settings.accentColor === opt.id ? "ring-4 ring-white/20 scale-125 shadow-2xl" : "opacity-30 hover:opacity-100"
                    )}
                    style={{ backgroundColor: opt.color }}
                  >
                    {state.settings.accentColor === opt.id && <CheckCircle2 size={20} className="text-white" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Security & Access */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
             <div className="h-1 w-8 bg-orange-500 opacity-30 rounded-full" />
             <label className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-500">{t.securityCloud}</label>
          </div>
          
          <div className="card p-8 rounded-[3rem] border-white/5 space-y-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-[50px] rounded-full" />
            
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="font-black uppercase tracking-tight text-sm">{t.securityKey}</h4>
                <p className="text-[10px] opacity-40 font-black mt-1 uppercase tracking-widest leading-relaxed">{t.costProtection}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {state.settings.pin ? (
                  <>
                    <Button 
                      variant="outline"
                      onClick={onResetPIN}
                      className="rounded-full px-6 h-12 text-[10px] uppercase font-black border-orange-500/30 hover:bg-orange-500/10 text-orange-500"
                    >
                      Update PIN
                    </Button>
                    <Button 
                      variant="ghost"
                      onClick={() => onUpdate({ pin: null })}
                      className="rounded-full px-6 h-12 text-[10px] uppercase font-black opacity-40 hover:opacity-100"
                    >
                      Disable
                    </Button>
                  </>
                ) : (
                  <Button 
                    variant="primary"
                    onClick={onResetPIN}
                    className="rounded-full px-10 h-12 text-[10px] uppercase font-black shadow-xl"
                  >
                    Initialize PIN
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-8 border-t border-[var(--border)]">
              <div>
                <h4 className="font-black uppercase tracking-tight text-sm">{t.cloudSync}</h4>
                <p className="text-[10px] opacity-40 font-black mt-1 uppercase tracking-widest leading-relaxed">{t.firebaseSync}</p>
              </div>
              <button 
                onClick={() => onUpdate({ autoCloudSync: !state.settings.autoCloudSync })}
                className={cn(
                  "h-8 w-16 rounded-full transition-all relative overflow-hidden ring-1 ring-white/10 shadow-inner",
                  state.settings.autoCloudSync ? "bg-blue-500" : "bg-slate-800"
                )}
              >
                <div className={cn("absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-xl transition-all", state.settings.autoCloudSync ? "translate-x-8" : "")} />
              </button>
            </div>
            
            <div className="flex items-center justify-between pt-8 border-t border-[var(--border)]">
              <div>
                <h4 className="font-black uppercase tracking-tight text-sm">{t.autoStealth}</h4>
                <p className="text-[10px] opacity-40 font-black mt-1 uppercase tracking-widest leading-relaxed">{t.stealthDesc}</p>
              </div>
              <button 
                onClick={() => onUpdate({ hideBuyingPriceByDefault: !state.settings.hideBuyingPriceByDefault })}
                className={cn(
                  "h-8 w-16 rounded-full transition-all relative overflow-hidden ring-1 ring-white/10 shadow-inner",
                  state.settings.hideBuyingPriceByDefault ? "bg-emerald-500" : "bg-slate-800"
                )}
              >
                <div className={cn("absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-xl transition-all", state.settings.hideBuyingPriceByDefault ? "translate-x-8" : "")} />
              </button>
            </div>
          </div>
        </section>

        {/* Data Management Section */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
             <div className="h-1 w-8 bg-purple-500 opacity-30 rounded-full" />
             <label className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-500">{t.dataLifecycle}</label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-6 rounded-[2rem] border-white/5 space-y-6">
               <h4 className="text-xs font-black uppercase tracking-widest opacity-40">{t.exportVectors}</h4>
               <div className="flex flex-col gap-3">
                  <Button onClick={onExportExcel} variant="outline" className="justify-start gap-3 rounded-xl py-6 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10">
                    <FileSpreadsheet size={18} /> <span className="text-[10px] font-black uppercase">Export Data to Excel</span>
                  </Button>
                  <Button onClick={onExportPDF} variant="outline" className="justify-start gap-3 rounded-xl py-6 border-red-500/20 text-red-500 hover:bg-red-500/10">
                    <FilePdf size={18} /> <span className="text-[10px] font-black uppercase">Export Data to PDF</span>
                  </Button>
               </div>
            </div>

            <div className="card p-6 rounded-[2rem] border-white/5 space-y-6">
               <h4 className="text-xs font-black uppercase tracking-widest opacity-40">{t.backupInfra}</h4>
               <div className="flex flex-col gap-3">
                  <Button onClick={onBackup} variant="outline" className="justify-start gap-3 rounded-xl py-6 border-blue-500/20 text-blue-500 hover:bg-blue-500/10">
                    <Database size={18} /> <span className="text-[10px] font-black uppercase">Backup System Now</span>
                  </Button>
                  <label className="flex items-center justify-center gap-3 rounded-xl py-3.5 px-4 border border-dashed border-white/10 text-xs font-black uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors">
                    <Upload size={18} /> Restore Backup
                    <input type="file" className="hidden" accept=".json" onChange={onRestore} />
                  </label>
               </div>
            </div>

            <div className="card p-6 rounded-[2rem] border-white/5 space-y-6 md:col-span-2">
               <h4 className="text-xs font-black uppercase tracking-widest opacity-40">{t.maintenanceCore}</h4>
               <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-3 rounded-xl py-3 px-6 bg-[var(--background)] border border-[var(--border)] text-[10px] font-black uppercase tracking-widest cursor-pointer hover:border-[var(--primary)] transition-all">
                    <Download size={18} /> Import External Data
                    <input type="file" className="hidden" accept=".json" onChange={onImport} />
                  </label>
                  <Button onClick={onClearCache} variant="ghost" className="gap-3 rounded-xl px-6 border border-red-500/10 text-red-500/50 hover:text-red-500">
                    <XCircle size={18} /> <span className="text-[10px] font-black uppercase">Clear Local Cache</span>
                  </Button>
               </div>
            </div>
          </div>
        </section>
        
        {/* Performance & Ledger */}
        <section className="space-y-8 pb-16">
          <div className="flex items-center gap-4">
             <div className="h-1 w-8 bg-blue-500 opacity-30 rounded-full" />
             <label className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500">{t.systemInfra}</label>
          </div>
          
          <div className="grid gap-4">
            <div className="flex items-center justify-between p-8 card rounded-[2.5rem] border-white/5">
              <div>
                <h4 className="font-black uppercase tracking-tight text-xs opacity-60">{t.metricPrecision}</h4>
                <div className="flex gap-2 mt-4">
                  {[0, 1, 2].map(p => (
                    <button
                      key={p}
                      onClick={() => onUpdate({ pricePrecision: p })}
                      className={cn(
                        "h-10 w-10 rounded-xl text-xs font-black transition-all border",
                        state.settings.pricePrecision === p 
                          ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-lg scale-110" 
                          : "bg-[var(--background)] border-[var(--border)] opacity-30"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-12 w-[1px] bg-[var(--border)] rotate-12" />
              <div className="text-right">
                <h4 className="font-black uppercase tracking-tight text-xs opacity-60">{t.typographyDeck}</h4>
                <div className="flex gap-2 mt-4 justify-end">
                  {fontSizeOptions.map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => onUpdate({ fontSize: opt.id })}
                      className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center transition-all border",
                        state.settings.fontSize === opt.id 
                          ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-lg scale-110" 
                          : "bg-[var(--background)] border-[var(--border)] opacity-30"
                      )}
                    >
                      {opt.icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Global Support & Documentation */}
        <section className="space-y-6 pt-12 border-t border-white/5">
           <Button 
             variant="outline" 
             onClick={onShowHelp}
             className="w-full h-20 rounded-[2.5rem] border-white/10 bg-white/5 hover:bg-[var(--primary)]/10 hover:border-[var(--primary)] hover:text-[var(--primary)] flex items-center justify-between px-8 group transition-all"
           >
             <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                  <HelpCircle size={24} />
                </div>
                <div className="text-left">
                  <p className="font-black uppercase tracking-tighter text-sm">{t.help || "Help aur Guide"}</p>
                  <p className="text-[10px] font-bold opacity-40 uppercase">Learn pro tricks and data security</p>
                </div>
             </div>
             <ArrowRight size={20} className="opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
           </Button>
        </section>
      </div>
    </motion.div>

  );
}

function ProfileScreen({ state, t, deferredPrompt, onInstall }: { state: AppState; t: any; deferredPrompt: any; onInstall: () => void }) {
  const handleAuth = async () => {
    if (state.user) {
      await auth.signOut();
    } else {
      await loginWithGoogle();
    }
  };

  return (
    <div className="space-y-8 pb-32 animate-in fade-in slide-in-from-bottom-6 duration-1000 max-w-2xl mx-auto px-4 sm:px-0">
      {/* Dynamic Visual Header */}
      <div className="relative overflow-hidden rounded-[3rem] bg-[var(--primary)] p-10 text-white shadow-2xl shadow-[var(--primary)]/20 min-h-[250px] flex flex-col justify-end group">
         <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 transition-transform group-hover:scale-110 group-hover:rotate-0 duration-700">
            <User size={200} />
         </div>
         <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
         
         <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-5">
               <div className="h-20 w-20 rounded-[2rem] bg-white/10 border border-white/20 backdrop-blur-xl flex items-center justify-center shadow-2xl transition-transform group-hover:scale-105">
                  <User size={40} className="text-white" />
               </div>
               <div>
                  <h2 className="text-4xl font-black uppercase tracking-tight leading-none truncate max-w-[200px] sm:max-w-md">
                    {state.user ? (state.user.email?.split('@')[0] || 'Merchant') : 'SYSTEM ADMIN'}
                  </h2>
                  <div className="mt-2 flex items-center gap-2">
                     <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                     <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-70">
                       {state.user ? t.liveNode : t.localSandbox}
                     </p>
                  </div>
               </div>
            </div>
            
            <div className="flex gap-8 pt-4">
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1">{t.authorization}</p>
                  <button 
                    onClick={handleAuth}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white text-[10px] font-black uppercase tracking-widest py-2 px-4 rounded-full transition-all text-white hover:text-[var(--primary)] shadow-lg active:scale-95"
                  >
                     {state.user ? <LogOut size={14} /> : <LogIn size={14} />}
                     {state.user ? t.terminateSession : t.cloudEntry}
                  </button>
               </div>
               <div className="h-10 w-px bg-white/20" />
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest opacity-50 mb-1">{t.architecture}</p>
                  <p className="text-xs font-black uppercase">v3.5.0 Enterprise</p>
               </div>
            </div>
         </div>
      </div>

      {/* Operational Controls */}
      <div className="space-y-4">
         <div className="flex items-center justify-between px-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">System Core</h4>
            <div className="h-px flex-1 bg-[var(--border)] mx-4 opacity-10" />
         </div>

         {/* PWA Deployment Call-to-Action */}
         {deferredPrompt && (
           <button 
             onClick={onInstall}
             className="w-full flex items-center justify-between p-8 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-[2.5rem] shadow-2xl shadow-amber-500/30 active:scale-[0.98] transition-all group overflow-hidden relative"
           >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
              <div className="flex items-center gap-5 relative z-10">
                 <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
                    <Download size={28} />
                 </div>
                 <div className="text-left">
                    <p className="text-xl font-black uppercase tracking-tight">{t.deployNode}</p>
                    <p className="text-[10px] font-bold opacity-70 uppercase tracking-widest">{t.pwaInstallHint}</p>
                 </div>
              </div>
              <ChevronRight size={24} className="relative z-10 opacity-60 group-hover:translate-x-1 transition-transform" />
           </button>
         )}

         {/* Secondary Hub Actions */}
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => {
                  const message = encodeURIComponent(`Check out TS PRICE MANAGER: ${window.location.host}`);
                  window.open(`https://wa.me/?text=${message}`, '_blank');
              }}
              className="flex items-center justify-between p-6 bg-[var(--card)] border border-[var(--border)] rounded-[2rem] hover:border-green-500/30 hover:bg-green-500/5 transition-all group"
            >
               <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-green-500/10 text-green-500 flex items-center justify-center transition-colors group-hover:bg-green-500 group-hover:text-white">
                     <MessageSquare size={22} />
                  </div>
                  <div className="text-left">
                     <p className="text-sm font-black uppercase group-hover:text-green-500 transition-colors">{t.clientShare}</p>
                     <p className="text-[8px] font-bold opacity-40 uppercase tracking-widest">{t.whatsappBroadcast}</p>
                  </div>
               </div>
               <ChevronRight size={16} className="opacity-20 group-hover:translate-x-1 transition-transform" />
            </button>
 
            <button className="flex items-center justify-between p-6 bg-[var(--card)] border border-[var(--border)] rounded-[2rem] hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group">
               <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center transition-colors group-hover:bg-blue-500 group-hover:text-white">
                     <Database size={22} />
                  </div>
                  <div className="text-left">
                     <p className="text-sm font-black uppercase group-hover:text-blue-500 transition-colors">{t.dataEngine}</p>
                     <p className="text-[8px] font-bold opacity-40 uppercase tracking-widest">{t.cloudBackup}</p>
                  </div>
               </div>
               <ChevronRight size={16} className="opacity-20 group-hover:translate-x-1 transition-transform" />
            </button>
         </div>
      </div>

      <div className="text-center pt-8 opacity-20">
         <p className="text-[10px] font-black uppercase tracking-[0.5em] italic">Precision Engineering By AI Studio</p>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/5",
    amber: "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/5",
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-blue-500/5",
  };

  return (
    <div className={cn("p-6 rounded-[2.5rem] border shadow-sm space-y-4 hover:shadow-xl transition-all duration-500", colors[color])}>
       <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">
          {icon}
       </div>
       <div>
          <p className="text-[8px] font-black uppercase tracking-widest opacity-60 leading-tight mb-1">{label}</p>
          <p className="text-xl font-black uppercase tracking-tight">{value}</p>
       </div>
    </div>
  );
}

function RecentPriceChanges({ items, t, precision }: { items: Item[]; t: any; precision: number }) {
  const recentChanges = useMemo(() => {
    return items
      .filter(item => item.priceChangedAt)
      .sort((a, b) => new Date(b.priceChangedAt!).getTime() - new Date(a.priceChangedAt!).getTime())
      .slice(0, 5);
  }, [items]);

  if (recentChanges.length === 0) return null;

  return (
    <div className="space-y-4">
       <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[var(--primary)]">
         <RotateCcw size={14} /> {t.recentPriceChanges}
       </div>
       <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
         {recentChanges.map(item => (
           <div key={item.id} className="flex-shrink-0 w-64 card p-4 border-white/5 bg-[var(--primary)]/5 rounded-2xl">
              <div className="flex items-center justify-between mb-3">
                 <div className="h-8 w-8 rounded-lg bg-[var(--background)] border border-[var(--border)] flex items-center justify-center text-xs">
                   {DEFAULT_CATEGORIES.find(c => c.id === item.categoryId)?.icon}
                 </div>
                 <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest">
                   {new Date(item.priceChangedAt!).toLocaleDateString()} • {item.lastChangedBy || 'System'}
                 </span>
              </div>
              <h4 className="font-bold text-sm truncate mb-2">{item.name}</h4>
              <div className="flex items-center gap-4">
                 <div>
                    <p className="text-[8px] font-bold uppercase opacity-40">Retail</p>
                    <p className="text-xs font-bold">₹{formatNumber(item.retailPrice, precision)}</p>
                 </div>
                 <div className="h-6 w-px bg-[var(--border)]" />
                 <div>
                    <p className="text-[8px] font-bold uppercase opacity-40">Cost</p>
                    <p className="text-xs font-bold">₹{formatNumber(item.buyingPrice, precision)}</p>
                 </div>
              </div>
           </div>
         ))}
       </div>
    </div>
  );
}

function NotesDashboard({ 
  notes, 
  expanded, 
  onToggle, 
  onAdd, 
  onUpdate, 
  onDelete, 
  t,
  isPreview = false
}: { 
  notes: Note[]; 
  expanded: boolean; 
  onToggle: () => void; 
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  t: any;
  isPreview?: boolean;
}) {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const matchesFilter = filter === 'All' || n.category === filter;
      const matchesSearch = n.title.toLowerCase().includes(search.toLowerCase()) || 
                           n.description.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    }).sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [notes, filter, search]);

  const displayNotes = isPreview ? filteredNotes.slice(0, 3) : filteredNotes;
  const categories = ['All', 'Stock', 'Payment', 'Customer', 'Supplier', 'Reminder', 'General'];

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'Important': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'Completed': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Stock': return <Package size={14} />;
      case 'Payment': return <CreditCard size={14} />;
      case 'Customer': return <Users size={14} />;
      case 'Supplier': return <Truck size={14} />;
      case 'Reminder': return <Clock size={14} />;
      default: return <FileText size={14} />;
    }
  };

  return (
    <div className={cn("animate-in fade-in slide-in-from-bottom-4 duration-700", !isPreview && "space-y-6")}>
      {!isPreview && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button onClick={onToggle} className="flex items-center gap-3 group">
               <div className="h-10 w-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center transition-colors group-hover:bg-[var(--primary)] group-hover:text-white">
                 {expanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
               </div>
               <div>
                 <h3 className="text-xl font-black uppercase tracking-widest opacity-80">{t.notesDashboard}</h3>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Operational Journal</p>
               </div>
            </button>
            <Button onClick={onAdd} className="rounded-xl flex gap-2 h-10 px-4 bg-amber-500 hover:bg-amber-600 shadow-xl shadow-amber-500/20 active:scale-95 transition-all">
               <Plus size={18} /> <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">{t.addNote}</span>
            </Button>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex flex-col sm:flex-row gap-4">
                   <div className="flex-1 relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-20" size={16} />
                     <input 
                       className="w-full rounded-xl bg-[var(--background)] border border-[var(--border)] py-2.5 pl-10 pr-4 text-xs font-bold focus:border-[var(--primary)] outline-none transition-all placeholder:opacity-20"
                       placeholder="Search journal..."
                       value={search}
                       onChange={(e) => setSearch(e.target.value)}
                     />
                   </div>
                   <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setFilter(cat)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shrink-0",
                            filter === cat 
                              ? "bg-[var(--primary)] border-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20" 
                              : "bg-[var(--card)] border-[var(--border)] opacity-60 hover:opacity-100"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className={cn(
        "grid gap-4 transition-all",
        !expanded && !isPreview ? "opacity-30 blur-[1px] grayscale pointer-events-none" : "opacity-100",
        isPreview ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
      )}>
        <AnimatePresence mode="popLayout">
          {displayNotes.length > 0 ? displayNotes.map(note => (
            <NoteCard 
               key={note.id} 
               note={note} 
               onUpdate={onUpdate} 
               onDelete={onDelete} 
               t={t}
               priorityClass={getPriorityClass(note.priority)}
               categoryIcon={getCategoryIcon(note.category)}
               isPreview={isPreview}
            />
          )) : (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} className="col-span-full py-16 text-center card border-dashed border-[var(--border)] border-white/10 opacity-40">
               <FileText className="mx-auto mb-4 opacity-20" size={48} />
               <p className="text-xs font-black uppercase tracking-widest opacity-20">Zero active entries detected</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function NoteCard({ 
  note, onUpdate, onDelete, t, priorityClass, categoryIcon, isPreview 
}: { 
  note: Note; 
  onUpdate: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  t: any;
  priorityClass: string;
  categoryIcon: React.ReactNode;
  isPreview?: boolean;
  key?: any;
}) {
  return (
    <motion.div 
      layout
      key={note.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "group relative transition-all duration-300 rounded-[2.5rem]",
        isPreview ? "p-4 hover:bg-[var(--primary)]/5" : "bg-[var(--card)] p-6 shadow-sm border border-[var(--border)] hover:shadow-2xl hover:border-[var(--primary)]/30 hover:-translate-y-1",
        note.status === 'Completed' && !isPreview && 'opacity-30 grayscale saturate-0'
      )}
    >
      <div className="flex items-start gap-5">
        <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all shadow-inner", priorityClass)}>
           {categoryIcon}
        </div>
        <div className="flex-1 space-y-2 min-w-0">
           <div className="flex items-center gap-2">
              <span className={cn("text-[7px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border", priorityClass)}>
                {note.priority}
              </span>
              <span className="text-[7px] font-black opacity-30 uppercase tracking-[0.2em]">{note.category}</span>
           </div>
           <h5 className={cn("font-black tracking-tight text-base truncate uppercase", note.status === 'Completed' && "line-through opacity-40")}>
             {note.title}
           </h5>
           <p className={cn("text-xs font-medium opacity-60 line-clamp-2 leading-relaxed h-[2.5rem]", note.status === 'Completed' && "opacity-20")}>
             {note.description}
           </p>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-[var(--border)] border-dashed pt-5">
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 opacity-30">
               <Clock size={12} />
               <span className="text-[9px] font-black uppercase tracking-tighter">
                 {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
               </span>
            </div>
            {note.dueDate && (
               <div className="flex items-center gap-1.5 text-amber-500/80">
                  <Calendar size={12} />
                  <span className="text-[9px] font-black uppercase tracking-tighter">{new Date(note.dueDate).toLocaleDateString()}</span>
               </div>
            )}
         </div>
         <div className={cn("flex gap-1.5 transition-opacity duration-500", isPreview ? "opacity-0 group-hover:opacity-100" : "opacity-0 group-hover:opacity-100")}>
            <button onClick={() => onUpdate(note.id, { status: note.status === 'Completed' ? 'Active' : 'Completed' })} className="p-2.5 bg-green-500/5 hover:bg-green-500 hover:text-white rounded-xl transition-all active:scale-90">
               <CheckCircle2 size={16} />
            </button>
            <button onClick={() => onUpdate(note.id, { isPinned: !note.isPinned })} className={cn("p-2.5 rounded-xl transition-all active:scale-90", note.isPinned ? "bg-amber-500 text-white" : "bg-amber-500/5 hover:bg-amber-500 hover:text-white")}>
               <Pin size={16} />
            </button>
            <button onClick={() => onDelete(note.id)} className="p-2.5 bg-red-500/5 hover:bg-red-500 hover:text-white rounded-xl transition-all active:scale-90">
               <Trash2 size={16} />
            </button>
         </div>
      </div>
    </motion.div>
  );
}

function NoteFormModal({ onClose, onSave, t }: { onClose: () => void; onSave: (data: any) => void; t: any }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'General' as const,
    priority: 'Info' as const,
    dueDate: '',
    isPinned: false
  });
  const [isListening, setIsListening] = useState(false);

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Voice-to-text not supported in this browser.');
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setFormData(prev => ({ ...prev, description: prev.description + ' ' + transcript }));
    };
    recognition.start();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        className="w-full max-w-lg card p-8 space-y-6 shadow-[0_30px_60px_rgba(0,0,0,0.5)] border-white/5"
      >
        <div className="flex items-center justify-between">
           <h3 className="text-xl font-black uppercase tracking-widest">{t.addNote}</h3>
           <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center">
             <X size={20} />
           </button>
        </div>

        <div className="space-y-4">
           <div>
              <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1 block">Title</label>
              <input 
                 value={formData.title} 
                 onChange={e => setFormData({ ...formData, title: e.target.value })}
                 className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] outline-none"
                 placeholder="Short descriptive title"
              />
           </div>

           <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1 block">Category</label>
                 <select 
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none"
                 >
                    {['Stock', 'Payment', 'Customer', 'Supplier', 'Reminder', 'General'].map(c => <option key={c} value={c}>{c}</option>)}
                 </select>
              </div>
              <div>
                 <label className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1 block">Priority</label>
                 <select 
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 outline-none"
                 >
                    {['Urgent', 'Important', 'Completed', 'Info'].map(p => <option key={p} value={p}>{p}</option>)}
                 </select>
              </div>
           </div>

           <div>
              <div className="flex items-center justify-between mb-1">
                 <label className="text-[10px] font-black uppercase tracking-widest opacity-40 block">Details</label>
                 <button 
                   onClick={handleVoiceInput}
                   className={cn(
                     "h-7 w-7 rounded-full flex items-center justify-center transition-all",
                     isListening ? "bg-red-500 scale-110 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-[var(--primary)]/20 text-[var(--primary)]"
                   )}
                 >
                    <Mic size={14} className={isListening ? 'animate-pulse text-white' : ''} />
                 </button>
              </div>
              <textarea 
                 value={formData.description} 
                 onChange={e => setFormData({ ...formData, description: e.target.value })}
                 className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-3 min-h-[100px] outline-none transition-all"
                 placeholder="Note details (Use microphone icon for voice-to-text)"
              />
           </div>

           <div className="flex items-center gap-6">
              <label className="flex items-center gap-3 cursor-pointer">
                 <input type="checkbox" checked={formData.isPinned} onChange={e => setFormData({ ...formData, isPinned: e.target.checked })} className="h-5 w-5 rounded border-[var(--border)] bg-[var(--background)]" />
                 <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Pin to top</span>
              </label>
              <div className="flex-1">
                 <input 
                   type="date" 
                   value={formData.dueDate} 
                   onChange={e => setFormData({ ...formData, dueDate: e.target.value })}
                   className="w-full bg-[var(--background)] border border-[var(--border)] rounded-xl px-4 py-2 text-xs outline-none"
                 />
              </div>
           </div>
        </div>

        <div className="flex gap-4 pt-4">
           <Button variant="ghost" className="flex-1 rounded-2xl" onClick={onClose}>Cancel</Button>
           <Button className="flex-1 rounded-2xl py-4" onClick={() => onSave(formData)}>Create Note</Button>
        </div>
      </motion.div>
    </div>
  );
}
