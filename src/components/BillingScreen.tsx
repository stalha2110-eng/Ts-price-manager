import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Plus, Minus, Trash2, Search, User, Phone, Check, 
  ReceiptText, ShoppingCart, Percent, Edit2, Save, X, 
  PackagePlus, Trash, Sparkles, Printer, Share2, Mic, MicOff,
  Clock, Download, Calendar, RefreshCw, FileText, Coins,
  Cloud, CloudOff, Layers, Pin, Copy, PauseCircle, Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppState, Item, Bill, TransactionItem, Note, DraftBill } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn, formatNumber } from '../lib/utils';
import { printerService, DEFAULT_PRINT_SETTINGS } from '../services/printerService';
import { playFeedbackEvent } from '../services/soundFeedbackService';
import { cleanAndValidateText } from '../services/languageEngine';
import { GoogleContactPickerModal } from './GoogleContactPickerModal';

interface BillingScreenProps {
  state: AppState;
  onUpdateState: (updates: Partial<AppState>, actionLabel?: string) => void;
  t: any;
  onOpenHistoryDrawer?: () => void;
  isSyncing?: boolean;
  onSyncBills?: (incomingBills: Bill[]) => Promise<void>;
  onPeek?: (preview: { type: 'item' | 'customer' | 'bill' | 'notification' | 'analytics'; payload: any } | null) => void;
}

const CartQuantityInput: React.FC<{
  quantity: number;
  onChange: (newQty: number) => void;
  onDecrement: () => void;
  onIncrement: () => void;
}> = ({ quantity, onChange, onDecrement, onIncrement }) => {
  const [localVal, setLocalVal] = React.useState<string>(quantity.toString());

  React.useEffect(() => {
    setLocalVal(quantity.toString());
  }, [quantity]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setLocalVal(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(localVal);
    if (isNaN(parsed) || parsed <= 0) {
      setLocalVal(quantity.toString());
    } else {
      onChange(parsed);
    }
  };

  return (
    <div className="flex items-center bg-[var(--foreground)]/5 rounded-lg border border-[var(--border)] p-0.5 h-6 select-none">
      <button
        type="button"
        onClick={onDecrement}
        className="h-4 w-4 rounded hover:bg-[var(--foreground)]/10 text-[var(--foreground)] flex items-center justify-center cursor-pointer transition-colors"
      >
        <Minus size={8} />
      </button>
      <input
        type="number"
        step="any"
        className="w-10 text-center text-[10px] font-mono font-bold text-[var(--foreground)] bg-transparent border-none outline-none focus:ring-0"
        value={localVal}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      <button
        type="button"
        onClick={onIncrement}
        className="h-4 w-4 rounded hover:bg-[var(--foreground)]/10 text-[var(--foreground)] flex items-center justify-center cursor-pointer transition-colors"
      >
        <Plus size={8} />
      </button>
    </div>
  );
};

const EditCartQuantityInput: React.FC<{
  quantity: number;
  onChange: (newQty: number) => void;
  onDecrement: () => void;
  onIncrement: () => void;
}> = ({ quantity, onChange, onDecrement, onIncrement }) => {
  const [localVal, setLocalVal] = React.useState<string>(quantity.toString());

  React.useEffect(() => {
    setLocalVal(quantity.toString());
  }, [quantity]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setLocalVal(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(localVal);
    if (isNaN(parsed) || parsed <= 0) {
      setLocalVal(quantity.toString());
    } else {
      onChange(parsed);
    }
  };

  return (
    <div className="flex items-center bg-[var(--foreground)]/5 rounded-lg border border-[var(--border)] p-0.5 h-6">
      <button
        type="button"
        onClick={onDecrement}
        className="h-4 w-4 bg-transparent text-[var(--foreground)] flex items-center justify-center cursor-pointer font-bold"
      >
        -
      </button>
      <input 
        type="number"
        value={localVal}
        onChange={handleChange}
        onBlur={handleBlur}
        className="w-10 text-center text-[10px] bg-transparent border-none outline-none font-mono font-bold"
      />
      <button
        type="button"
        onClick={onIncrement}
        className="h-4 w-4 bg-transparent text-[var(--foreground)] flex items-center justify-center cursor-pointer font-bold"
      >
        +
      </button>
    </div>
  );
};


interface CartItem {
  id: string; // unique cart id 
  item: Partial<Item> & { isManual?: boolean };
  name: string;
  quantity: number;
  price: number;
  cost: number;
  unit: string;
}

const labels: Record<string, Record<string, string>> = {
  posHeading: {
    en: "Billing Desk",
    hi: "बिलिंग डेस्क",
    'hi-en': "Billing Desk",
    mr: "बिलिंग डेस्क"
  },
  posSubheading: {
    en: "Point of Sale & Real-time Billing",
    hi: "त्वरित बिल बनाएं",
    'hi-en': "Point of Sale (POS)",
    mr: "त्वरित बिल बनवा"
  },
  searchPlaceholder: {
    en: "Search product...",
    hi: "सामान खोजें...",
    'hi-en': "Product search...",
    mr: "सामान शोधा..."
  },
  emptyCartText: {
    en: "Ticket is empty. Tap items to compile a bill.",
    hi: "बिल खाली है। ऊपर सूची से सामान जोड़ें।",
    'hi-en': "Bill khali hai. Samaan select karein.",
    mr: "बिलाची यादी रिकामी आहे."
  },
  checkoutBtn: {
    en: "SAVE BILL & PRINT ✔",
    hi: "बिल सुरक्षित और प्रिंट करें ✔",
    'hi-en': "FINISH BILL & PRINT ✔",
    mr: "बिल सुरक्षित करा ✔"
  },
  paymentModeTitle: {
    en: "Payment Mode",
    hi: "भुगतान का प्रकार",
    'hi-en': "Payment Mode",
    mr: "पेमेंट मोड निवडा"
  },
  grandTotal: {
    en: "GRAND TOTAL",
    hi: "कुल योग",
    'hi-en': "GRAND TOTAL",
    mr: "एकूण रक्कम"
  },
  subtotal: {
    en: "Subtotal",
    hi: "उपकुल",
    'hi-en': "Subtotal",
    mr: "पोटएकूण"
  },
  discountLabel: {
    en: "Discount (%)",
    hi: "छूट (%)",
    'hi-en': "Discount (%)",
    mr: "सूट (%)"
  },
  taxLabel: {
    en: "Tax GST (%)",
    hi: "जीएसटी टैक्स (%)",
    'hi-en': "GST Tax (%)",
    mr: "कर (%)"
  }
};

// Help helper for Levenshtein typo-tolerant sorting
const getEditDistance = (a: string, b: string): number => {
  const tmp = [];
  for (let i = 0; i <= a.length; i++) { tmp[i] = [i]; }
  for (let j = 0; j <= b.length; j++) { tmp[0][j] = j; }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
};

const typoTolerantMatch = (name: string, query: string): boolean => {
  const normName = name.toLowerCase().replace(/[\s\-_]/g, '');
  const normQuery = query.toLowerCase().replace(/[\s\-_]/g, '');
  
  if (normName.includes(normQuery)) return true;
  
  const nameWords = name.toLowerCase().split(/\s+/);
  const queryWords = query.toLowerCase().split(/\s+/);
  
  return queryWords.every(qw => {
    if (qw.length < 3) {
      return nameWords.some(nw => nw.startsWith(qw) || nw.includes(qw));
    }
    return nameWords.some(nw => {
      if (nw.includes(qw) || qw.includes(nw)) return true;
      return getEditDistance(nw, qw) <= 2; // tolerates up to 2 character differences
    });
  });
};

const REST_TABLES = [
  { id: 'table_1', name: 'Table 1', seats: '2 Seater 🪑' },
  { id: 'table_2', name: 'Table 2', seats: '2 Seater 🪑' },
  { id: 'table_3', name: 'Table 3', seats: '4 Seater 🛋️' },
  { id: 'table_4', name: 'Table 4', seats: '4 Seater 🛋️' },
  { id: 'table_5', name: 'Table 5', seats: '4 Seater 🛋️' },
  { id: 'table_6', name: 'Table 6', seats: '6 Seater 🍕' },
  { id: 'table_7', name: 'Table 7', seats: '6 Seater 🍕' },
  { id: 'table_8', name: 'Table 8', seats: '8 Seater 👑' },
  { id: 'table_9', name: 'Table 9', seats: '8 Seater 👑' },
  { id: 'table_10', name: 'Table 10', seats: 'Private Cabin 🚪' },
  { id: 'table_11', name: 'Table 11', seats: 'Private Cabin 🚪' },
  { id: 'table_12', name: 'Table 12', seats: 'Outdoor Lawn 🍀' },
  { id: 'takeaway_1', name: 'Takeaway A', seats: 'Express 🛍️' },
  { id: 'takeaway_2', name: 'Takeaway B', seats: 'Express 🛍️' }
];

export default function BillingScreen({ 
  state, 
  onUpdateState, 
  t, 
  onOpenHistoryDrawer,
  isSyncing,
  onSyncBills,
  onPeek
}: BillingScreenProps) {
  const currentLang = state.settings.language || 'en';
  const getTranslation = (key: string) => {
    return labels[key]?.[currentLang] || labels[key]?.[ 'en' ] || key;
  };

  const precision = state.settings.pricePrecision || 0;

  const [searchQuery, setSearchQuery] = useState('');
  const [additionAnims, setAdditionAnims] = useState<{ id: string; name: string; price: number; x: number; y: number }[]>([]);
  const [activePredictionIndex, setActivePredictionIndex] = useState(-1);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isDrawerSearchFocused, setIsDrawerSearchFocused] = useState(false);
  
  const [convertingItemId, setConvertingItemId] = useState<string | null>(null);
  const [editingRateItem, setEditingRateItem] = useState<{
    id: string;
    name: string;
    currentPrice: number;
    newPrice: number;
    isManual: boolean;
  } | null>(null);
  
  // Custom Multi-Window POS Draft Bills Storage with Local Storage hydration
  const [drafts, setDrafts] = useState<DraftBill[]>(() => {
    const saved = localStorage.getItem('pos_billing_draft_tabs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [{
      id: 'initial-draft-id',
      name: 'Bill #101',
      cart: [],
      customerName: '',
      customerPhone: '',
      discountPercent: 0,
      taxPercent: 0,
      paymentMethod: 'Cash',
      billingMode: 'auto',
      udharDueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      isPinned: false
    }];
  });

  const [activeDraftId, setActiveDraftId] = useState<string>(() => {
    const savedActive = localStorage.getItem('pos_billing_active_draft_id');
    const saved = localStorage.getItem('pos_billing_draft_tabs');
    if (savedActive && saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.some((d: any) => d.id === savedActive)) return savedActive;
      } catch (e) {}
    }
    return 'initial-draft-id';
  });

  const [holdDrafts, setHoldDrafts] = useState<DraftBill[]>(() => {
    const saved = localStorage.getItem('pos_billing_hold_drafts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  // --- FUTURISTIC COMPENSE FOR MULTIPLE SESSIONS ---
  const [holdSearchQuery, setHoldSearchQuery] = useState('');
  const [showHoldSessionsDrawer, setShowHoldSessionsDrawer] = useState(false);

  // Custom dialogs & notification states to support embedded environments/iframes perfectly
  const [customConfirm, setCustomConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    isDestructive?: boolean;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);

  const [customPrompt, setCustomPrompt] = useState<{
    title: string;
    message: string;
    initialValue: string;
    onConfirm: (val: string) => void;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);

  const [promptInput, setPromptInput] = useState('');

  const [toasts, setToasts] = useState<{
    id: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'error';
  }[]>([]);

  const addToast = (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const showCustomConfirm = (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    isDestructive: boolean = false, 
    confirmText: string = "Confirm", 
    cancelText: string = "Cancel"
  ) => {
    setCustomConfirm({
      title,
      message,
      onConfirm,
      isDestructive,
      confirmText,
      cancelText
    });
  };

  const showCustomPrompt = (
    title: string, 
    message: string, 
    initialValue: string, 
    onConfirm: (val: string) => void,
    placeholder: string = "Enter value...",
    confirmText: string = "Save Changes",
    cancelText: string = "Cancel"
  ) => {
    setPromptInput(initialValue);
    setCustomPrompt({
      title,
      message,
      initialValue,
      onConfirm,
      placeholder,
      confirmText,
      cancelText
    });
  };

  const getRelativeTime = (time?: number) => {
    if (!time) return "Active POS";
    const diff = Date.now() - time;
    if (diff < 30000) return "Just now";
    if (diff < 60000) return "30s ago";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(time).toLocaleDateString();
  };

  const getDraftTotal = (draft: DraftBill) => {
    const subtotal = draft.cart?.reduce((acc, c) => acc + (c.price * c.quantity), 0) || 0;
    const tax = subtotal * ((draft.taxPercent || 0) / 100);
    const discount = subtotal * ((draft.discountPercent || 0) / 100);
    return subtotal + tax - discount;
  };

  // Auto-expire unpinned hold customer sessions older than 24 hours
  useEffect(() => {
    const expireSessions = () => {
      const now = Date.now();
      const expiryAge = 24 * 60 * 60 * 1000; // 24 hours
      
      setHoldDrafts(prev => {
        const kept = prev.filter(hd => {
          const activeTime = hd.lastActiveAt || now;
          const isExpired = (now - activeTime > expiryAge) && !hd.isPinned;
          return !isExpired;
        });
        return kept;
      });
    };

    expireSessions();
    const interval = setInterval(expireSessions, 300000); // Check every 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Local state replicas hydrated from the active draft session
  const activeDraftSession = useMemo(() => {
    return drafts.find(d => d.id === activeDraftId) || drafts[0];
  }, [drafts, activeDraftId]);

  const [cart, setCart] = useState<CartItem[]>(() => activeDraftSession.cart || []);
  const [customerName, setCustomerName] = useState(() => activeDraftSession.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(() => activeDraftSession.customerPhone || '');
  const [discountPercent, setDiscountPercent] = useState<number>(() => activeDraftSession.discountPercent || 0);
  const [taxPercent, setTaxPercent] = useState<number>(() => activeDraftSession.taxPercent || 0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Credit'>(() => activeDraftSession.paymentMethod || 'Cash');
  const [billingMode, setBillingMode] = useState<'retail' | 'wholesale' | 'auto'>(() => {
    if (activeDraftSession.billingMode) return activeDraftSession.billingMode;
    return state.settings.businessMode === 'wholesale' ? 'wholesale' : 'auto';
  });

  const [isGoogleContactModalOpen, setIsGoogleContactModalOpen] = useState(false);

  const isHydratingRef = useRef(false);

  // Trigger loading when switching drafts
  const switchToDraft = (draftId: string, saveCurrentActive: boolean = true, customDraftsList?: DraftBill[]) => {
    // 1. Immediately flush current states back into active drafts snapshot
    if (saveCurrentActive) {
      setDrafts(prev => prev.map(d => {
        if (d.id === activeDraftId) {
          return {
            ...d,
            cart,
            customerName,
            customerPhone,
            discountPercent,
            taxPercent,
            paymentMethod,
            billingMode,
            udharDueDate,
            lastActiveAt: Date.now()
          };
        }
        return d;
      }));
    }

    // 2. Hydrate states with target draft values
    const listToSearch = customDraftsList || drafts;
    const target = listToSearch.find(d => d.id === draftId);
    if (target) {
      isHydratingRef.current = true;
      setActiveDraftId(draftId);
      setCart(target.cart || []);
      setCustomerName(target.customerName || '');
      setCustomerPhone(target.customerPhone || '');
      setDiscountPercent(target.discountPercent || 0);
      setTaxPercent(target.taxPercent || 0);
      setPaymentMethod(target.paymentMethod || 'Cash');
      setBillingMode(target.billingMode || 'auto');
      setUdharDueDate(target.udharDueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
      
      setTimeout(() => {
        isHydratingRef.current = false;
      }, 0);
    }
  };

  // Overriding initial mode default alignment if the business settings switch mode dynamically
  useEffect(() => {
    if (state.settings.businessMode === 'wholesale') {
      setBillingMode('wholesale');
    } else {
      setBillingMode('auto');
    }
  }, [state.settings.businessMode]);

  // Synchronize drafts state elements to localStorage
  useEffect(() => {
    localStorage.setItem('pos_billing_draft_tabs', JSON.stringify(drafts));
  }, [drafts]);

  useEffect(() => {
    localStorage.setItem('pos_billing_active_draft_id', activeDraftId);
  }, [activeDraftId]);

  useEffect(() => {
    localStorage.setItem('pos_billing_hold_drafts', JSON.stringify(holdDrafts));
  }, [holdDrafts]);

  // Synchronize changes in local input states back into drafts list automatically
  useEffect(() => {
    if (isHydratingRef.current) return;

    setDrafts(prev => prev.map(d => {
      if (d.id === activeDraftId) {
        return {
          ...d,
          cart,
          customerName,
          customerPhone,
          discountPercent,
          taxPercent,
          paymentMethod,
          billingMode,
          udharDueDate,
          lastActiveAt: d.lastActiveAt || Date.now()
        };
      }
      return d;
    }));
  }, [cart, customerName, customerPhone, discountPercent, taxPercent, paymentMethod, billingMode, activeDraftId]);

  
  const [udharDueDate, setUdharDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [activeBillDetail, setActiveBillDetail] = useState<Bill | null>(null);
  const [completedBill, setCompletedBill] = useState<Bill | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Advanced filtering states
  const [filterType, setFilterType] = useState<'none' | 'invoice' | 'time'>('none');
  const [startInvoice, setStartInvoice] = useState('');
  const [endInvoice, setEndInvoice] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // 24hr Cleanup dialog states
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [hasDismissedCleanup, setHasDismissedCleanup] = useState(false);

  // Helper utility to format dates as DD-MM-YYYY
  const formatDateForBackup = (dateStr: string) => {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  // Manual Not In List popup trigger states
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');
  const [manualCost, setManualCost] = useState('');
  const [manualUnit, setManualUnit] = useState('Pcs');

  // Mic voice state
  const [isListening, setIsListening] = useState(false);

  // Smart Cash handling assistant states
  const [isCashAssistantOpen, setIsCashAssistantOpen] = useState(false);
  const [cashReceivedStr, setCashReceivedStr] = useState('');

  // Recent Searches state
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('billing_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Edit Bill Local state variables
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editDiscountPercent, setEditDiscountPercent] = useState<number>(0);
  const [editTaxPercent, setEditTaxPercent] = useState<number>(0);
  const [editPaymentMethod, setEditPaymentMethod] = useState<'Cash' | 'UPI' | 'Credit'>('Cash');
  const [editCart, setEditCart] = useState<CartItem[]>([]);
  const [editManualName, setEditManualName] = useState('');
  const [editManualPrice, setEditManualPrice] = useState('');
  const [editManualCost, setEditManualCost] = useState('');
  const [editManualQuantity, setEditManualQuantity] = useState('1');
  const [editManualUnit, setEditManualUnit] = useState('Pcs');

  // Multi-item / Udhar Customer block auto expansion trigger
  const [forceCustomerOpen, setForceCustomerOpen] = useState(false);
  const [manualCustomerOpen, setManualCustomerOpen] = useState(false);

  // Printer connection, preview, and watermark configurations
  const [printSettings, setPrintSettings] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('price_manager_printer_config');
      return saved ? { ...DEFAULT_PRINT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_PRINT_SETTINGS;
    } catch {
      return DEFAULT_PRINT_SETTINGS;
    }
  });
  const [printerStatus, setPrinterStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [previewBillData, setPreviewBillData] = useState<any>(null);

  // --- Live Invoice Preview & Floating Calculator States ---
  const [showLivePreview, setShowLivePreview] = useState(true);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [livePreviewTheme, setLivePreviewTheme] = useState<'laser' | 'thermal'>('thermal');

  // --- Restaurant & Cafe Seating / KOT Dispatcher States ---
  const [kotTicketNo, setKotTicketNo] = useState(() => {
    const saved = localStorage.getItem('rest_kot_ticket_no');
    return saved ? parseInt(saved, 10) : 100;
  });
  const [showKotDetails, setShowKotDetails] = useState(false);
  const [kotData, setKotData] = useState<{
    items: any[];
    table: string;
    ticketNo: string;
    timestamp: string;
  } | null>(null);

  // --- Enhanced Seating floor-plan visualizer and HUD states ---
  const [restViewMode, setRestViewMode] = useState<'grid' | 'map'>('map');
  const [selectedHudTable, setSelectedHudTable] = useState<string | null>(null);
  const [swapTargetTableId, setSwapTargetTableId] = useState<string>('');
  const [elapsedTicker, setElapsedTicker] = useState<number>(0);

  // Ticker to force-update elapsed time indicators in real-time
  useEffect(() => {
    if (state.settings.businessMode !== 'restaurant') return;
    const interval = setInterval(() => {
      setElapsedTicker(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [state.settings.businessMode]);


  // Listen to calculations applied from the smart app-wide calculator
  useEffect(() => {
    const handleApplyDiscount = (e: Event) => {
      const val = (e as CustomEvent).detail;
      if (typeof val === 'number') {
        setDiscountPercent(parseFloat(val.toFixed(2)));
      }
    };

    const handleApplyTax = (e: Event) => {
      const val = (e as CustomEvent).detail;
      if (typeof val === 'number') {
        setTaxPercent(parseFloat(val.toFixed(2)));
      }
    };

    const handleApplyCashReceived = (e: Event) => {
      const val = (e as CustomEvent).detail;
      if (val !== undefined && val !== null) {
        setCashReceivedStr(String(val));
      }
    };

    window.addEventListener('tsm-apply-discount', handleApplyDiscount);
    window.addEventListener('tsm-apply-tax', handleApplyTax);
    window.addEventListener('tsm-apply-cash-received', handleApplyCashReceived);

    return () => {
      window.removeEventListener('tsm-apply-discount', handleApplyDiscount);
      window.removeEventListener('tsm-apply-tax', handleApplyTax);
      window.removeEventListener('tsm-apply-cash-received', handleApplyCashReceived);
    };
  }, []);


  // Thermal roll-scrolling custom pos animation parameters
  const [isAnimatingPrint, setIsAnimatingPrint] = useState(false);
  const [animationStep, setAnimationStep] = useState<'idle' | 'sliding' | 'success'>('idle');

  // Activate connections observer
  useEffect(() => {
    const unsub = printerService.subscribeStatus((status) => {
      setPrinterStatus(status);
    });
    return () => unsub();
  }, []);

  // Update configurations cache on refocus or change
  useEffect(() => {
    const syncSettings = () => {
      try {
        const saved = localStorage.getItem('price_manager_printer_config');
        if (saved) {
          setPrintSettings({ ...DEFAULT_PRINT_SETTINGS, ...JSON.parse(saved) });
        }
      } catch {}
    };
    window.addEventListener('focus', syncSettings);
    syncSettings();
    return () => window.removeEventListener('focus', syncSettings);
  }, []);

  // Filter 24-hour logs
  const olderThan24HoursBills = useMemo(() => {
    const limits = 24 * 60 * 60 * 1000;
    const nowTime = Date.now();
    return (state.bills || []).filter(b => {
      const diff = nowTime - new Date(b.timestamp).getTime();
      return diff > limits;
    });
  }, [state.bills]);

  // Advanced Filtered Bills
  const filteredBills = useMemo(() => {
    let bills = state.bills || [];

    if (filterType === 'invoice') {
      if (startInvoice.trim()) {
        const startNum = parseInt(startInvoice.replace(/\D/g, '')) || 0;
        bills = bills.filter(b => {
          const num = parseInt(b.billNumber.replace(/\D/g, '')) || 0;
          return num >= startNum;
        });
      }
      if (endInvoice.trim()) {
        const endNum = parseInt(endInvoice.replace(/\D/g, '')) || 99999999;
        bills = bills.filter(b => {
          const num = parseInt(b.billNumber.replace(/\D/g, '')) || 0;
          return num <= endNum;
        });
      }
    } else if (filterType === 'time') {
      if (startTime) {
        const [sh, sm] = startTime.split(':').map(Number);
        bills = bills.filter(b => {
          const date = new Date(b.timestamp);
          const minutes = date.getHours() * 60 + date.getMinutes();
          return minutes >= (sh * 60 + sm);
        });
      }
      if (endTime) {
        const [eh, em] = endTime.split(':').map(Number);
        bills = bills.filter(b => {
          const date = new Date(b.timestamp);
          const minutes = date.getHours() * 60 + date.getMinutes();
          return minutes <= (eh * 60 + em);
        });
      }
    }

    return bills;
  }, [state.bills, filterType, startInvoice, endInvoice, startTime, endTime]);

  const handleCancelCleanup = () => {
    setShowCleanupDialog(false);
    setHasDismissedCleanup(true);
  };

  useEffect(() => {
    if (cart.length >= 10 || paymentMethod === 'Credit') {
      setForceCustomerOpen(true);
    } else {
      setForceCustomerOpen(false);
    }
  }, [cart.length, paymentMethod]);

  // Auto-Cleanup Trigger for 24-Hour Invoice Logs disabled - Handled accurately by store profile opening/closing hours schedules in App.tsx
  useEffect(() => {
    // Disabled to solve the intrusive modal issue accurately as requested by the user.
    // The store profile opening/closing time checklists in App.tsx handle scheduling correctly.
  }, []);

  const addRecentSearch = (query: string) => {
    if (!query.trim()) return;
    const cl = query.trim();
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s !== cl);
      const updated = [cl, ...filtered].slice(0, 5);
      localStorage.setItem('billing_recent_searches', JSON.stringify(updated));
      return updated;
    });
  };

  // Typo-tolerant matching query filter
  const filteredItems = useMemo(() => {
    return state.items.filter(item => {
      const catMatch = !selectedCategory || item.categoryId === selectedCategory;
      if (!searchQuery.trim()) return catMatch;
      
      const trs = item.translations || { en: item.name || '', hi: '', mr: '', 'hi-en': '' };
      const translationsList = [
        trs.en || '',
        trs.hi || '',
        trs.mr || '',
        trs['hi-en'] || ''
      ];
      
      const textMatch = translationsList.some(text => typoTolerantMatch(text, searchQuery));
      return catMatch && textMatch;
    });
  }, [state.items, searchQuery, selectedCategory]);

  const predictiveBillingItems = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return state.items.filter(item => {
      const trs = item.translations || { en: item.name || '', hi: '', mr: '', 'hi-en': '' };
      return (trs.en || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
             (trs.hi || '').includes(searchQuery) ||
             (trs.mr || '').includes(searchQuery) ||
             (trs['hi-en'] || '').toLowerCase().includes(searchQuery.toLowerCase());
    }).slice(0, 6);
  }, [state.items, searchQuery]);

  // Voice Search Handler
  const handleVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Microphone recognition is not fully supported in your browser iframe framework.");
      return;
    }
    
    try {
      const rec = new SpeechRecognition();
      rec.lang = currentLang === 'hi' ? 'hi-IN' : 'en-US';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      
      let isWorking = false;
      const originalStart = rec.start;
      rec.start = function() {
        if (isWorking) {
          console.warn("SpeechRecognition already working.");
          return;
        }
        try {
          isWorking = true;
          originalStart.call(rec);
        } catch (err) {
          console.warn("SpeechRecognition start error:", err);
        }
      };

      setIsListening(true);
      
      rec.onstart = () => {
        isWorking = true;
        setIsListening(true);
      };
      rec.onresult = (event: any) => {
        const textStr = event.results[0][0].transcript;
        setSearchQuery(textStr);
        addRecentSearch(textStr);
        setIsListening(false);
      };
      
      rec.onerror = () => {
        isWorking = false;
        setIsListening(false);
      };
      rec.onend = () => {
        isWorking = false;
        setIsListening(false);
      };

      try {
        rec.start();
      } catch (e) {
        console.warn("Speech start failed:", e);
        setIsListening(false);
      }
    } catch {
      setIsListening(false);
    }
  };

  // Helper pricing selector
  const getItemPriceAndUnit = (item: Partial<Item> & { isManual?: boolean }, quantity: number) => {
    if (item.isManual) {
      return { price: item.retailPrice || 0, unit: item.unit || 'Pcs' };
    }
    const mode = billingMode === 'auto' 
      ? (quantity >= 5 ? 'wholesale' : 'retail') 
      : billingMode;
      
    if (mode === 'wholesale') {
      return { price: item.wholesalePrice ?? 0, unit: item.wholesalePriceUnit || item.unit || 'Pcs' };
    } else {
      return { price: item.retailPrice ?? 0, unit: item.retailPriceUnit || item.unit || 'Pcs' };
    }
  };

  const addToCart = (product: Item, e?: React.MouseEvent | any) => {
    const existingIndex = cart.findIndex(c => c.id === product.id);
    let newQty = 1;
    if (existingIndex > -1) {
      newQty = cart[existingIndex].quantity + 1;
      const { price, unit } = getItemPriceAndUnit(product, newQty);
      
      const updated = [...cart];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQty,
        price,
        unit
      };
      setCart(updated);
    } else {
      const { price, unit } = getItemPriceAndUnit(product, 1);
      
      const trs = product.translations || { en: product.name || '', hi: '', mr: '', 'hi-en': '' };
      const newCartItem: CartItem = {
        id: product.id,
        item: product,
        name: trs[currentLang] || trs.en || product.name,
        quantity: 1,
        price,
        cost: product.buyingPrice || 0,
        unit
      };
      setCart([...cart, newCartItem]);
    }

    // Capture coordinates for tactile animation bubble feedback
    let clientX = window.innerWidth * 0.5;
    let clientY = window.innerHeight * 0.45;
    if (e) {
      if (e.clientX && e.clientY) {
        clientX = e.clientX;
        clientY = e.clientY;
      } else if (e.touches && e.touches[0]) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    }
    
    const trs = product.translations || { en: product.name || '', hi: '', mr: '', 'hi-en': '' };
    const pName = trs[currentLang] || trs.en || product.name;
    const itemPrice = billingMode === 'wholesale' ? (product.wholesalePrice || product.retailPrice) : product.retailPrice;

    setAdditionAnims(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        name: pName,
        price: itemPrice || 0,
        x: clientX,
        y: clientY
      }
    ]);

    playFeedbackEvent('product_added', state.settings);
    const trsForRecent = product.translations || { en: product.name || '', hi: '', mr: '', 'hi-en': '' };
    addRecentSearch(trsForRecent[currentLang] || trsForRecent.en || product.name);
  };

  // Sync kotTicketNo to localStorage
  useEffect(() => {
    localStorage.setItem('rest_kot_ticket_no', String(kotTicketNo));
  }, [kotTicketNo]);

  const selectRestTable = (tableName: string) => {
    // 1. Flush any current edits into memory
    setDrafts(prev => prev.map(d => {
      if (d.id === activeDraftId) {
        return {
          ...d,
          cart,
          customerName,
          customerPhone,
          discountPercent,
          taxPercent,
          paymentMethod,
          billingMode,
          udharDueDate,
          lastActiveAt: Date.now()
        };
      }
      return d;
    }));

    // 2. Discover or spawn Draft representing Table
    const matchingDraft = drafts.find(d => d.name === tableName);
    if (!matchingDraft) {
      const newId = `draft-rest-${Date.now()}`;
      const freshDraft: DraftBill = {
        id: newId,
        name: tableName,
        cart: [],
        customerName: '',
        customerPhone: '',
        discountPercent: 0,
        taxPercent: 0,
        paymentMethod: 'Cash',
        billingMode: 'auto',
        udharDueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        lastActiveAt: Date.now(),
        restTimerStartedAt: Date.now(),
        restServiceStatus: 'ordered'
      };
      
      setDrafts(prev => [...prev, freshDraft]);
      setActiveDraftId(newId);
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setDiscountPercent(0);
      setTaxPercent(0);
      setPaymentMethod('Cash');
      setBillingMode('auto');
      setSelectedHudTable(tableName);
    } else {
      switchToDraft(matchingDraft.id, false);
      setSelectedHudTable(tableName);
    }
  };

  const transferTable = (sourceTableName: string, targetTableName: string) => {
    if (!sourceTableName || !targetTableName || sourceTableName === targetTableName) return;
    
    const sourceDraft = drafts.find(d => d.name === sourceTableName);
    if (!sourceDraft) {
      addToast("Error: Table order not found.", "error");
      return;
    }

    setDrafts(prev => {
      const filtered = prev.filter(d => d.name !== targetTableName);
      return filtered.map(d => {
        if (d.name === sourceTableName) {
          return {
            ...d,
            name: targetTableName,
            id: `draft-rest-${Date.now()}`,
            lastActiveAt: Date.now()
          };
        }
        return d;
      });
    });

    // If source table is active, auto switch active billing space to target
    const activeDraft = drafts.find(d => d.id === activeDraftId);
    if (activeDraft && activeDraft.name === sourceTableName) {
      setTimeout(() => {
        selectRestTable(targetTableName);
        addToast(`Transferred all meals & timers to ${targetTableName}!`, "success");
      }, 60);
    } else {
      addToast(`Table transferred: ${sourceTableName} ➡️ ${targetTableName}`, "success");
    }
    
    setSwapTargetTableId('');
    setSelectedHudTable(targetTableName);
  };

  const dispatchRestaurantKOT = () => {
    if (cart.length === 0) return;
    
    const activeDraft = drafts.find(d => d.id === activeDraftId);
    const tableName = activeDraft ? activeDraft.name : 'Counter Walk-In';
    
    const nextTicketNo = kotTicketNo + 1;
    setKotTicketNo(nextTicketNo);
    
    const ticketStr = `KOT-${String(nextTicketNo).padStart(3, '0')}`;
    const timestampStr = new Date().toLocaleString();
    
    setKotData({
      items: cart.map(c => ({
        ...c,
        cookingInstructions: (c as any).cookingInstructions || ''
      })),
      table: tableName,
      ticketNo: ticketStr,
      timestamp: timestampStr
    });
    setShowKotDetails(true);
    
    try {
      if (state.settings.soundOn !== false) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.15);
        
        setTimeout(() => {
          const osc2 = audioCtx.createOscillator();
          const gain2 = audioCtx.createGain();
          osc2.connect(gain2);
          gain2.connect(audioCtx.destination);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(950, audioCtx.currentTime);
          gain2.gain.setValueAtTime(0.04, audioCtx.currentTime);
          osc2.start();
          osc2.stop(audioCtx.currentTime + 0.3);
        }, 160);
      }
    } catch (e) {
      console.error(e);
    }
    
    // Transition status to cooking in drafts
    setDrafts(prev => prev.map(d => {
      if (d.id === activeDraftId) {
        return {
          ...d,
          restServiceStatus: 'cooking',
          cart
        };
      }
      return d;
    }));
    
    onUpdateState({
      notes: [
        {
          id: `kot-item-${Date.now()}`,
          title: `Kitchen Ticket Dispatched: ${ticketStr} (${tableName})`,
          description: `Dispatched food items: ${cart.map(c => `${c.quantity}x ${c.name}`).join(', ')}.`,
          category: 'Reminder',
          priority: 'Important',
          status: 'Active',
          isPinned: false,
          createdAt: new Date().toISOString(),
          dueDate: new Date().toISOString()
        },
        ...(state.notes || [])
      ]
    }, `KOT ${ticketStr} dispatched`);
  };

  const updateCartQuantity = (id: string, newQty: number) => {
    if (newQty <= 0) {
      setCart(cart.filter(item => item.id !== id));
      return;
    }
    
    setCart(cart.map(item => {
      if (item.id === id) {
        const { price, unit } = getItemPriceAndUnit(item.item, newQty);
        return { 
          ...item, 
          quantity: parseFloat(newQty.toFixed(3)),
          price,
          unit
        };
      }
      return item;
    }));
  };

  // Auto pricing synchronization when mode changes
  useEffect(() => {
    setCart(prev => prev.map(item => {
      const { price, unit } = getItemPriceAndUnit(item.item, item.quantity);
      return {
        ...item,
        price,
        unit
      };
    }));
  }, [billingMode]);

  const handleUnitConversion = (cartItemId: string, targetUnit: string, factor: number) => {
    setCart(prev => prev.map(ci => {
      if (ci.id === cartItemId) {
        const oldUnit = ci.unit;
        const newQty = ci.quantity * factor;
        const newPrice = ci.price / factor;
        addToast(`Converted item from ${oldUnit} to ${targetUnit}!`, 'success');
        return {
          ...ci,
          unit: targetUnit,
          quantity: Number(newQty.toFixed(4)),
          price: Number(newPrice.toFixed(4))
        };
      }
      return ci;
    }));
  };

  const savePricePermanently = (itemId: string, newPrice: number) => {
    const updatedItems = state.items.map(item => {
      if (item.id === itemId) {
        if (billingMode === 'wholesale') {
          return {
            ...item,
            wholesalePrice: newPrice,
            lastUpdated: new Date().toISOString()
          };
        } else {
          return {
            ...item,
            retailPrice: newPrice,
            lastUpdated: new Date().toISOString()
          };
        }
      }
      return item;
    });

    onUpdateState({ items: updatedItems });
    addToast("Item price saved permanently to catalog!", "success");
  };

  const updateCartPrice = (id: string, newPrice: number) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        return { ...item, price: Math.max(0, newPrice) };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const addManualItemToCart = () => {
    if (!manualName.trim()) {
      alert("Please enter a item name.");
      return;
    }
    
    const rateVal = parseFloat(manualPrice) || 0;
    const costVal = parseFloat(manualCost) || 0;
    const tempId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newCartItem: CartItem = {
      id: tempId,
      item: { id: tempId, isManual: true, retailPrice: rateVal, unit: manualUnit },
      name: manualName.trim(),
      quantity: 1,
      price: rateVal,
      cost: costVal,
      unit: manualUnit.trim() || 'Pcs'
    };
    
    setCart([...cart, newCartItem]);
    playFeedbackEvent('product_added', state.settings);
    setManualName('');
    setManualPrice('');
    setManualCost('');
    setManualUnit('Pcs');
    setShowManualModal(false);
  };

  // Calculation variables
  const subtotal = useMemo(() => {
    return cart.reduce((sum, ci) => sum + (ci.price * ci.quantity), 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return (subtotal * discountPercent) / 100;
  }, [subtotal, discountPercent]);

  const taxAmount = useMemo(() => {
    return ((subtotal - discountAmount) * taxPercent) / 100;
  }, [subtotal, discountAmount, taxPercent]);

  const total = useMemo(() => {
    return subtotal - discountAmount + taxAmount;
  }, [subtotal, discountAmount, taxAmount]);

  // Dispatch live updates of final bill total to smart cashier return-balance engine
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('tsm-update-active-bill-total', { detail: total }));
  }, [total]);

  const cashSuggestions = useMemo(() => {
    if (total <= 0) return [];
    const list: number[] = [];
    
    // Exact change
    list.push(total);
    
    // Ceiling if decimal
    if (total % 1 !== 0) {
      list.push(Math.ceil(total));
    }
    
    // Suggested multiples
    const rounded10 = Math.ceil(total / 10) * 10;
    if (rounded10 > total) list.push(rounded10);
    
    const rounded50 = Math.ceil(total / 50) * 50;
    if (rounded50 > total) list.push(rounded50);
    
    const rounded100 = Math.ceil(total / 100) * 100;
    if (rounded100 > total) list.push(rounded100);

    // Common standard banknotes in India
    const rupeeNotes = [10, 20, 50, 100, 200, 500];
    const nextNote = rupeeNotes.find(note => note > total);
    if (nextNote) list.push(nextNote);

    if (total < 500) {
      list.push(500);
    }
    if (total < 100) {
      list.push(100);
    }
    if (total < 200) {
      list.push(200);
    }

    // Filter, format decimal places and sort
    const uniqueSorted = Array.from(new Set(list))
      .filter(val => val >= total)
      .map(val => Number(val.toFixed(2)))
      .sort((a, b) => a - b);

    return uniqueSorted.slice(0, 5);
  }, [total]);

  const togglePriceType = (cartId: string) => {
    setCart(cart.map(ci => {
      if (ci.id === cartId && !ci.item.isManual) {
        const itemObj = ci.item as Item;
        const isCurrentlyWholesale = ci.price === itemObj.wholesalePrice;
        const newPrice = isCurrentlyWholesale ? itemObj.retailPrice : (itemObj.wholesalePrice || itemObj.retailPrice);
        const newUnit = isCurrentlyWholesale ? (itemObj.retailPriceUnit || itemObj.unit) : (itemObj.wholesalePriceUnit || itemObj.unit);
        return {
          ...ci,
          price: newPrice,
          unit: newUnit
        };
      }
      return ci;
    }));
  };

  // Checkout process with auto item conversion & reminder generation
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    
    if (paymentMethod === 'Credit') {
      if (!customerName.trim() || !customerPhone.trim()) {
        alert("Compliance Required: Customer Name and Phone Number are mandatory for Udhar Billing.");
        return;
      }
    }

    const cName = customerName.trim() || 'Walk-in Customer';
    const cPhone = customerPhone.trim() || undefined;

    // Generate Serial Invoice ID starting from 1 (Guaranteed sequential and collision-free)
    const sortedBills = [...(state.bills || [])].sort((a, b) => {
      const aVal = parseInt(a.billNumber) || parseInt(a.billNumber.replace(/\D/g, '')) || 0;
      const bVal = parseInt(b.billNumber) || parseInt(b.billNumber.replace(/\D/g, '')) || 0;
      return aVal - bVal;
    });

    let nextSerial = 1;
    if (sortedBills.length > 0) {
      const highestBill = sortedBills[sortedBills.length - 1];
      const highestNum = parseInt(highestBill.billNumber) || parseInt(highestBill.billNumber.replace(/\D/g, '')) || 0;
      nextSerial = highestNum + 1;
    }

    let billNumber = String(nextSerial);
    let attempts = 0;
    while ((state.bills || []).some(b => b.billNumber === billNumber) && attempts < 1000) {
      nextSerial++;
      billNumber = String(nextSerial);
      attempts++;
    }

    // Step 1: Pre-calculate cart items with auto-IDs for manual lines
    const finalCartItems: TransactionItem[] = cart.map(ci => {
      const dbFinalId = (ci.id.startsWith('custom-') || ci.item.isManual)
        ? `item-custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        : ci.id;
      return {
        itemId: dbFinalId,
        name: ci.name,
        quantity: ci.quantity,
        price: ci.price,
        cost: ci.cost || 0,
        unit: ci.unit
      };
    });

    // Step 2: Build checkout invoice schema
    const newBill: Bill = {
      id: `bill-${Date.now()}`,
      billNumber,
      customerName: cName,
      customerPhone: cPhone,
      items: finalCartItems,
      discount: discountPercent,
      tax: taxPercent,
      subtotal,
      total,
      paymentMethod,
      timestamp: new Date().toISOString(),
      deviceId: state.settings?.deviceId,
      deviceName: state.settings?.deviceName
    };

    setPreviewBillData(newBill);
    setShowPrintPreview(true);
  };

  // Finalizes the invoice ledger, commits stock values, and executes POS spool mechanisms
  const handleConfirmCheckout = async (shouldPrint: boolean) => {
    if (!previewBillData) return;

    // STEP 1: Process converted items & notes
    const convertedItemsList = [...state.items];
    const notesToAppend: Note[] = [];

    // Replay conversion matching constructed items
    cart.forEach((ci, idx) => {
      const targetItem = previewBillData.items[idx];
      if (ci.id.startsWith('custom-') || ci.item.isManual) {
        const dbNewItem: Item = {
          id: targetItem.itemId,
          name: ci.name,
          translations: {
            en: ci.name,
            hi: ci.name,
            mr: '',
            'hi-en': ci.name
          },
          categoryId: 'Miscellaneous',
          quantity: -ci.quantity,
          unit: ci.unit,
          buyingPrice: ci.cost || 0,
          buyingPriceUnit: ci.unit,
          wholesalePrice: ci.price,
          wholesalePriceUnit: ci.unit,
          retailPrice: ci.price,
          retailPriceUnit: ci.unit,
          lastUpdated: new Date().toISOString(),
          priceChangedAt: new Date().toISOString(),
          notes: 'Auto created manual item'
        };

        convertedItemsList.push(dbNewItem);

        notesToAppend.push({
          id: `note-ref-${targetItem.itemId}`,
          title: "Complete remaining product details",
          description: `Add accurate categories, base costs or supplier details for newly added manual item "${ci.name}". Click this card to edit directly.`,
          category: 'Reminder',
          priority: 'Urgent',
          status: 'Active',
          createdAt: new Date().toISOString(),
          dueDate: new Date().toISOString(),
          isPinned: true
        });
      }
    });

    // STEP 2: Stocks deduction
    const finalItemsState = convertedItemsList.map(item => {
      const idxInCart = cart.findIndex(ci => ci.id === item.id);
      if (idxInCart !== -1) {
        return {
          ...item,
          quantity: parseFloat((item.quantity - cart[idxInCart].quantity).toFixed(3))
        };
      }
      return item;
    });

    // STEP 3: Bills tracking
    const nextBills = [previewBillData, ...(state.bills || [])];

    // STEP 4: Ledger compliance for Udhar Mode
    let updatedCustomers = [...(state.udharCustomers || [])];
    let updatedTransactions = [...(state.udharTransactions || [])];

    if (previewBillData.paymentMethod === 'Credit' && previewBillData.customerPhone) {
      let currCust = updatedCustomers.find(cu => cu.phone === previewBillData.customerPhone);
      if (!currCust) {
        currCust = {
          id: `cust-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: previewBillData.customerName,
          phone: previewBillData.customerPhone,
          totalUdhar: 0,
          lastUpdated: new Date().toISOString()
        };
        updatedCustomers.push(currCust);
      }

      const udharTxAmount = previewBillData.total;
      const creditTx = {
        id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        customerId: currCust.id,
        amount: udharTxAmount,
        type: 'given' as const,
        timestamp: new Date().toISOString(),
        dueDate: udharDueDate,
        note: `Automatic bill generation billing reference #${previewBillData.billNumber}`
      };

      updatedTransactions.push(creditTx);

      updatedCustomers = updatedCustomers.map(c => {
        if (c.id === currCust?.id) {
          return {
            ...c,
            totalUdhar: parseFloat((c.totalUdhar + udharTxAmount).toFixed(2)),
            lastUpdated: new Date().toISOString()
          };
        }
        return c;
      });
    }

    // Commit changes into shared App level state
    onUpdateState({
      items: finalItemsState,
      bills: nextBills,
      notes: [...notesToAppend, ...(state.notes || [])],
      udharCustomers: updatedCustomers,
      udharTransactions: updatedTransactions
    });

    // Trigger Billing Complete feedback
    playFeedbackEvent('bill_saved', state.settings);

    // Reset checkout forms
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscountPercent(0);
    setTaxPercent(0);
    setPaymentMethod('Cash');

    const billToPrint = previewBillData;
    setCompletedBill(billToPrint);
    setShowPrintPreview(false);
    setPreviewBillData(null);

    // STEP 5: Spooling print job & animations triggers
    if (shouldPrint) {
      if (printSettings.enableAnimation) {
        setIsAnimatingPrint(true);
        setAnimationStep('sliding');
        
        if (navigator.vibrate) navigator.vibrate([15, 30, 20]);

        // Smooth virtual slide out timing delay
        setTimeout(async () => {
          try {
            const copies = printSettings.duplicateCopies || 1;
            for (let c = 0; c < copies; c++) {
              await printerService.printViaSystem(billToPrint, printSettings);
            }
            playFeedbackEvent('print_success', state.settings);
            setAnimationStep('success');
            setTimeout(() => {
              setIsAnimatingPrint(false);
              setAnimationStep('idle');
            }, 1800);
          } catch (e) {
            setAnimationStep('success');
            setTimeout(() => {
              setIsAnimatingPrint(false);
              setAnimationStep('idle');
            }, 1000);
          }
        }, 1250);
      } else {
        try {
          const copies = printSettings.duplicateCopies || 1;
          for (let c = 0; c < copies; c++) {
            await printerService.printViaSystem(billToPrint, printSettings);
          }
          playFeedbackEvent('print_success', state.settings);
          if (navigator.vibrate) navigator.vibrate(25);
        } catch (e: any) {
          alert(`Printing Spool Failed: ${e.message}`);
        }
      }
    } else {
      if (navigator.vibrate) navigator.vibrate(25);
    }
  };

  // PDF Generation for Individual Invoices
  const downloadBillPdf = (bill: Bill) => {
    try {
      const doc = new jsPDF() as any;
      
      doc.setFontSize(22);
      doc.setTextColor(79, 70, 229);
      doc.setFont("helvetica", "bold");
      doc.text("STORE RECEIPT", 14, 22);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80);
      doc.text(`Receipt Reference: ${bill.billNumber}`, 14, 30);
      doc.text(`Timestamp: ${new Date(bill.timestamp).toLocaleString()}`, 14, 36);
      doc.text(`Method of Payment: ${bill.paymentMethod}`, 14, 42);
      
      if (bill.customerName) {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(33, 37, 41);
        doc.text("GUEST / CLIENT:", 14, 52);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80);
        doc.text(`Name: ${bill.customerName}`, 14, 58);
        if (bill.customerPhone) {
          doc.text(`Mobile: ${bill.customerPhone}`, 14, 64);
        }
      }
      
      const rowsData = bill.items.map((it, idx) => [
        idx + 1,
        it.name,
        `${it.quantity} ${it.unit}`,
        `₹${it.price.toFixed(2)}`,
        `₹${(it.price * it.quantity).toFixed(2)}`
      ]);
      
      autoTable(doc, {
        startY: bill.customerName ? 72 : 52,
        head: [['#', 'Item Name', 'Quantity', 'Rate', 'Line Total']],
        body: rowsData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 }
      });
      
      const currentFinalY = (doc as any).lastAutoTable.finalY + 12;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(33, 37, 41);
      doc.text(`Subtotal : ₹${bill.subtotal.toFixed(2)}`, 130, currentFinalY);
      
      let nextLineY = currentFinalY;
      if (bill.discount > 0) {
        nextLineY += 6;
        doc.text(`Discount (${bill.discount}%) : -₹${((bill.subtotal * bill.discount) / 100).toFixed(2)}`, 130, nextLineY);
      }
      if (bill.tax > 0) {
        nextLineY += 6;
        doc.text(`Tax (${bill.tax}%) : +₹${(((bill.subtotal - (bill.subtotal * bill.discount / 100)) * bill.tax) / 100).toFixed(2)}`, 130, nextLineY);
      }
      
      nextLineY += 10;
      doc.setFontSize(14);
      doc.setTextColor(79, 70, 229);
      doc.text(`GRAND TOTAL: ₹${bill.total.toFixed(2)}`, 130, nextLineY);
      
      doc.save(`Invoice_${bill.billNumber}.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  // PDF Business-Style Backup Summary of Bills
  const generateCleanBackupPdf = (billsToClean: Bill[]) => {
    if (billsToClean.length === 0) return false;
    
    try {
      const doc = new jsPDF() as any;
      
      const storeName = state.settings?.storeName || 'A-1 Retail Store';
      const timestamps = billsToClean.map(b => new Date(b.timestamp).getTime());
      const minTimestamp = Math.min(...timestamps);
      const sessionDate = formatDateForBackup(new Date(minTimestamp).toISOString());
      
      const totalCustomers = billsToClean.length;
      const totalSales = billsToClean.reduce((sum, b) => sum + b.total, 0);
      const totalProfit = billsToClean.reduce((sum, b) => {
        const billProfit = b.items.reduce((acc, it) => acc + ((it.price - (it.cost || 0)) * it.quantity), 0) - (b.subtotal * (b.discount / 100));
        return sum + billProfit;
      }, 0);

      // --- PDF Header Style ---
      doc.setFillColor(31, 41, 55); // Deep slate background for top banner
      doc.rect(0, 0, 210, 48, 'F');

      // Store name & title (Centered, uppercase, elegant)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text(storeName.toUpperCase(), 14, 20);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(209, 213, 219);
      doc.text(`OFFICIAL BILLING SESSION RECORD`, 14, 27);
      doc.text(`SESSION DATE: ${sessionDate}`, 14, 34);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 41);

      // --- KPI metrics dashboard ---
      doc.setFillColor(243, 244, 246); // Light gray background for KPI panel
      doc.roundedRect(14, 54, 182, 28, 3, 3, 'F');

      // KPIs Text
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(75, 85, 99);
      doc.text("TOTAL CUSTOMERS", 20, 63);
      doc.text("TOTAL SALES (INR)", 80, 63);
      doc.text("TOTAL NET PROFIT", 140, 63);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(17, 24, 39);
      doc.text(`${totalCustomers}`, 20, 74);
      doc.text(`₹${totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 80, 74);
      doc.text(`₹${totalProfit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 140, 74);

      // Detail table below
      const rawRows = billsToClean.map((b, ix) => {
        const totalItems = b.items.reduce((sum, item) => sum + item.quantity, 0);
        return [
          ix + 1,
          b.billNumber,
          b.customerName || 'Unknown',
          `${totalItems} items`,
          `₹${b.total.toFixed(2)}`,
          new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        ];
      });

      autoTable(doc, {
        startY: 90,
        head: [['#', 'Invoice Number', 'Customer Name', 'Total Items', 'Bill Amount', 'Time']],
        body: rawRows,
        theme: 'striped',
        headStyles: { 
          fillColor: [31, 41, 55], 
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        styles: { 
          fontSize: 8.5,
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 35 },
          2: { cellWidth: 55 },
          3: { cellWidth: 25 },
          4: { cellWidth: 32 },
          5: { cellWidth: 25 }
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          // Footer
          const pageCount = doc.internal.getNumberOfPages();
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(156, 163, 175);
          doc.text(`Page ${data.pageNumber} of ${pageCount}`, 14, 285);
          doc.text(`Confidential - For Internal Administrative Verification Only`, 120, 285);
        }
      });

      doc.save(`bill-${sessionDate}.pdf`);
      return true;
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      alert("Error generating PDF invoice backup. Please check console logs.");
      return false;
    }
  };

  const downloadAllInvoicesBackup = () => {
    const success = generateCleanBackupPdf(state.bills || []);
    if (success) {
      alert("Professional PDF Invoice Backup successfully completed and downloaded.");
    }
  };

  const handleDeleteAndSavePdf = () => {
    if (olderThan24HoursBills.length === 0) {
      alert("No bills older than 24 hours found to delete.");
      return;
    }
    const success = generateCleanBackupPdf(olderThan24HoursBills);
    if (!success) return;

    onUpdateState({
      bills: (state.bills || []).filter(b => !olderThan24HoursBills.some(ob => ob.id === b.id))
    });

    setShowCleanupDialog(false);
    setHasDismissedCleanup(true);
    addToast("24-hour bill history cleaned successfully. PDF backup saved.", "success");
  };

  const swipeOlderInvoices = () => {
    if (olderThan24HoursBills.length === 0) return;
    showCustomConfirm(
      "Clean Sales History",
      `Are you sure you want to securely delete ${olderThan24HoursBills.length} invoices older than 24 hours?`,
      () => {
        onUpdateState({
          bills: (state.bills || []).filter(b => !olderThan24HoursBills.some(ob => ob.id === b.id))
        });
        addToast("Sales history clean. Only recent bills preserved.", "success");
      },
      true,
      "Delete Invoices",
      "Cancel"
    );
  };

  const deleteBillInvoice = (bill: Bill) => {
    showCustomConfirm(
      "Remove Invoice Permanently",
      `Are you sure you want to permanently delete stored invoice #${bill.billNumber}? This will revert any items back into inventory stocks.`,
      () => {
        // Credit stocks back
        const restoredItems = state.items.map(item => {
          const matchInBill = bill.items.find(bi => bi.itemId === item.id);
          if (matchInBill) {
            return {
              ...item,
              quantity: parseFloat((item.quantity + matchInBill.quantity).toFixed(3))
            };
          }
          return item;
        });

        const nextBills = (state.bills || []).filter(b => b.id !== bill.id);
        
        // Reverse credit uDhars if credit billed
        let updatedCustomers = [...(state.udharCustomers || [])];
        let updatedTransactions = [...(state.udharTransactions || [])];
        
        if (bill.paymentMethod === 'Credit') {
          const associatedTx = updatedTransactions.find(tx => tx.note?.includes(`#${bill.billNumber}`) || tx.note?.includes(bill.billNumber));
          if (associatedTx) {
            updatedTransactions = updatedTransactions.filter(tx => tx.id !== associatedTx.id);
            updatedCustomers = updatedCustomers.map(cust => {
              if (cust.id === associatedTx.customerId) {
                return {
                  ...cust,
                  totalUdhar: Math.max(0, parseFloat((cust.totalUdhar - associatedTx.amount).toFixed(2))),
                  lastUpdated: new Date().toISOString()
                };
              }
              return cust;
            });
          }
        }

        onUpdateState({
          items: restoredItems,
          bills: nextBills,
          udharCustomers: updatedCustomers,
          udharTransactions: updatedTransactions
        });

        setActiveBillDetail(null);
        setIsEditing(false);
        addToast("Invoice successfully removed. Stock allocations reverted.", "success");
      },
      true,
      "Remove Invoice",
      "Keep Invoice"
    );
  };

  // EDIT previous logs states
  const startEditingSavedInvoice = (bill: Bill) => {
    setEditCustomerName(bill.customerName);
    setEditCustomerPhone(bill.customerPhone || '');
    setEditDiscountPercent(bill.discount);
    setEditTaxPercent(bill.tax);
    setEditPaymentMethod(bill.paymentMethod);
    
    const mappedCart: CartItem[] = bill.items.map(it => {
      const isManual = it.itemId.startsWith('custom-');
      const dbObj = !isManual ? state.items.find(si => si.id === it.itemId) : undefined;
      return {
        id: it.itemId,
        item: dbObj ? dbObj : { id: it.itemId, isManual: true },
        name: it.name,
        quantity: it.quantity,
        price: it.price,
        cost: it.cost,
        unit: it.unit
      };
    });
    setEditCart(mappedCart);
    setIsEditing(true);
  };

  const updateEditCartQuantity = (cartId: string, val: number) => {
    if (val <= 0) {
      setEditCart(editCart.filter(item => item.id !== cartId));
      return;
    }
    setEditCart(editCart.map(item => {
      if (item.id === cartId) {
        return { ...item, quantity: parseFloat(val.toFixed(3)) };
      }
      return item;
    }));
  };

  const addManualItemToEditCart = () => {
    if (!editManualName.trim()) {
      alert("Please specify name.");
      return;
    }
    const costV = parseFloat(editManualCost) || 0;
    const rateV = parseFloat(editManualPrice) || 0;
    const qtyV = parseFloat(editManualQuantity) || 1;
    const tempId = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const appendCart: CartItem = {
      id: tempId,
      item: { id: tempId, isManual: true },
      name: editManualName.trim(),
      quantity: qtyV,
      price: rateV,
      cost: costV,
      unit: editManualUnit || 'Pcs'
    };
    
    setEditCart([...editCart, appendCart]);
    setEditManualName('');
    setEditManualPrice('');
    setEditManualCost('');
    setEditManualQuantity('1');
    setEditManualUnit('Pcs');
  };

  const saveEditedBillInvoice = () => {
    if (!activeBillDetail) return;
    if (editCart.length === 0) {
      alert("Invoice list cannot be completely empty.");
      return;
    }
    
    // Re-credit old billing stocks
    let intermediateInventory = [...state.items];
    activeBillDetail.items.forEach(oldItem => {
      if (!oldItem.itemId.startsWith('custom-')) {
        intermediateInventory = intermediateInventory.map(dbItem => {
          if (dbItem.id === oldItem.itemId) {
            return {
              ...dbItem,
              quantity: parseFloat((dbItem.quantity + oldItem.quantity).toFixed(3))
            };
          }
          return dbItem;
        });
      }
    });

    // Validate and deduct new edited quantities
    let finalInventory = [...intermediateInventory];
    let isFine = true;

    for (const newCartItem of editCart) {
      if (!newCartItem.id.startsWith('custom-')) {
        const matchingDb = finalInventory.find(db => db.id === newCartItem.id);
        if (!matchingDb) continue;
        
        finalInventory = finalInventory.map(dbItem => {
          if (dbItem.id === newCartItem.id) {
            return {
              ...dbItem,
              quantity: parseFloat((dbItem.quantity - newCartItem.quantity).toFixed(3))
            };
          }
          return dbItem;
        });
      }
    }

    if (!isFine) return;

    const updatedBillItems: TransactionItem[] = editCart.map(ci => ({
      itemId: ci.id,
      name: ci.name,
      quantity: ci.quantity,
      price: ci.price,
      cost: ci.cost || 0,
      unit: ci.unit
    }));

    const editSub = editCart.reduce((sum, ci) => sum + (ci.price * ci.quantity), 0);
    const editDisc = (editSub * editDiscountPercent) / 100;
    const editTax = ((editSub - editDisc) * editTaxPercent) / 100;
    const editTot = editSub - editDisc + editTax;

    const updatedInvoiceObj: Bill = {
      ...activeBillDetail,
      customerName: editCustomerName.trim() || 'Walk-in Customer',
      customerPhone: editCustomerPhone.trim() || undefined,
      items: updatedBillItems,
      discount: editDiscountPercent,
      tax: editTaxPercent,
      subtotal: editSub,
      total: editTot,
      paymentMethod: editPaymentMethod
    };

    const nextBills = (state.bills || []).map(b => b.id === activeBillDetail.id ? updatedInvoiceObj : b);

    onUpdateState({
      items: finalInventory,
      bills: nextBills
    });

    setActiveBillDetail(updatedInvoiceObj);
    setIsEditing(false);
    alert("Invoice Record updated.");
  };

  return (
    <div className="space-y-4 pb-24 max-w-7xl mx-auto text-[var(--foreground)] relative">
      
      {/* 📁 MULTI-WINDOW POS DRAFT BILLING TABS & SMART REGISTER DECK */}
      <div className="bg-[var(--card)]/80 backdrop-blur-md rounded-2xl border border-[var(--border)] p-4.5 space-y-3.5 shadow-lg relative overflow-hidden group">
        <div className="absolute top-0 right-0 h-32 w-32 bg-[var(--primary)]/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
              <Layers size={13} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--foreground)]/60 leading-none block">Checkout Windows</span>
              <p className="text-[8px] font-bold text-amber-500 uppercase tracking-widest mt-0.5 leading-none">Draft Control Console</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const draft = drafts.find(d => d.id === activeDraftId);
                if (draft) {
                  const transitionToPinned = !draft.isPinned;
                  setDrafts(prev => prev.map(d => d.id === activeDraftId ? { ...d, isPinned: transitionToPinned } : d));
                  addToast(transitionToPinned ? "Register pinned successfully" : "Register unpinned", "info");
                }
              }}
              className="h-6.5 px-2 rounded-lg border border-[var(--border)] text-[8px] font-black uppercase tracking-wider hover:bg-[var(--foreground)]/5 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Pin active register state"
            >
              <Pin size={8.5} className={drafts.find(d => d.id === activeDraftId)?.isPinned ? "text-amber-500 fill-amber-500" : "opacity-40"} />
              Pin Draft
            </button>

            <button 
              onClick={() => {
                const draft = drafts.find(d => d.id === activeDraftId);
                if (draft) {
                  showCustomPrompt(
                    "Rename Register",
                    "Specify a custom name/label for this checkout window:",
                    draft.name,
                    (newTitle) => {
                      if (newTitle && newTitle.trim()) {
                        setDrafts(prev => prev.map(d => d.id === activeDraftId ? { ...d, name: newTitle.trim() } : d));
                        addToast(`Renamed checkout session to "${newTitle.trim()}"`, "info");
                      }
                    },
                    "e.g., Register Alpha, Client #12..."
                  );
                }
              }}
              className="h-6.5 px-2 rounded-lg border border-[var(--border)] text-[8px] font-black uppercase tracking-wider hover:bg-[var(--foreground)]/5 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Edit2 size={8.5} className="opacity-40" />
              Rename
            </button>

            <button 
              onClick={() => {
                const newId = `draft-${Date.now()}`;
                
                setDrafts(prev => {
                  const updatedList = prev.map(d => {
                    if (d.id === activeDraftId) {
                      return {
                        ...d,
                        cart,
                        customerName,
                        customerPhone,
                        discountPercent,
                        taxPercent,
                        paymentMethod,
                        billingMode,
                        udharDueDate,
                        lastActiveAt: Date.now()
                      };
                    }
                    return d;
                  });
                  
                  const activeObj = updatedList.find(d => d.id === activeDraftId);
                  if (activeObj) {
                    const newDraft: DraftBill = {
                      ...activeObj,
                      id: newId,
                      name: `${activeObj.name} (Copy)`,
                      isPinned: false,
                      lastActiveAt: Date.now()
                    };
                    return [...updatedList, newDraft];
                  }
                  return updatedList;
                });
                
                switchToDraft(newId, false);
                addToast("Register duplicated successfully", "success");
              }}
              className="h-6.5 px-2 rounded-lg border border-[var(--border)] text-[8px] font-black uppercase tracking-wider hover:bg-[var(--foreground)]/5 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Duplicate current inventory cart"
            >
              <Copy size={8.5} className="opacity-40" />
              Duplicate
            </button>

            <button 
              onClick={() => {
                const active = drafts.find(d => d.id === activeDraftId);
                if (active) {
                  if (drafts.length <= 1) {
                    addToast("At least one active register is required. Launch another draft counter first.", "warning");
                    return;
                  }
                  // Freeze active states inside snapshot
                  const heldDraftSnapshot: DraftBill = {
                    ...active,
                    cart,
                    customerName,
                    customerPhone,
                    discountPercent,
                    taxPercent,
                    paymentMethod,
                    billingMode,
                    udharDueDate,
                    lastActiveAt: Date.now()
                  };
                  setHoldDrafts(prev => [heldDraftSnapshot, ...prev]);
                  const remainingDrafts = drafts.filter(d => d.id !== activeDraftId);
                  setDrafts(remainingDrafts);
                  switchToDraft(remainingDrafts[0].id, false, remainingDrafts);
                  addToast(`Placed current session "${active.name}" on hold`, "info");
                }
              }}
              className="h-6.5 px-2.5 rounded-lg border border-amber-500/15 bg-amber-500/[0.04] text-amber-500 text-[8px] font-black uppercase tracking-wider hover:bg-amber-500 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Temporarily hold unfinished bill and switch checkouts"
            >
              <PauseCircle size={10.5} />
              Hold Bill
            </button>

            {/* Futuristic Drawer Control Button */}
            <button
              onClick={() => setShowHoldSessionsDrawer(true)}
              className={cn(
                "h-6.5 px-3 rounded-lg text-[8.5px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 border",
                holdDrafts.length > 0
                  ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/10 hover:bg-amber-600 animate-pulse"
                  : "bg-[var(--foreground)]/[0.03] border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--foreground)]/[0.08]"
              )}
            >
              <PauseCircle size={11} className={cn(holdDrafts.length > 0 ? "text-white" : "text-amber-500")} />
              <span>Holds Centre</span>
              <span className="h-4 w-4 rounded-full bg-white/20 text-center items-center justify-center flex font-mono text-[7px] leading-none shrink-0 font-extrabold text-inherit">
                {holdDrafts.length}
              </span>
            </button>
          </div>
        </div>

        {/* Scrollable Tab row with smooth active highlights */}
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 cursor-grab select-none items-center pr-2">
          {drafts.map(tab => {
            const isActive = tab.id === activeDraftId;
            const itemsCount = tab.cart?.reduce((acc, c) => acc + c.quantity, 0) || 0;
            return (
              <div 
                key={tab.id}
                onClick={() => {
                  if (!isActive) switchToDraft(tab.id);
                }}
                className={cn(
                  "px-4 py-2.5 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer relative shrink-0 text-[10.5px] font-extrabold uppercase",
                  isActive 
                    ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-md shadow-[var(--primary)]/10" 
                    : "bg-[var(--foreground)]/[0.02] border-[var(--border)] hover:bg-[var(--foreground)]/[0.05]"
                )}
              >
                {tab.isPinned && <Pin size={8.5} className="text-amber-400 fill-amber-400 shrink-0" />}
                <span className="truncate max-w-[90px] leading-none">{tab.name}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[8.5px] leading-none shrink-0 font-bold font-mono",
                  isActive ? "bg-white/25 text-white" : "bg-[var(--foreground)]/[0.05] text-[var(--foreground)]/50"
                )}>
                  {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                </span>
                
                {drafts.length > 1 && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      showCustomConfirm(
                        "Discard Checkout Tab",
                        `Are you sure you want to discard your draft workspace "${tab.name}"? This action will permanently empty its live items list.`,
                        () => {
                          const remaining = drafts.filter(d => d.id !== tab.id);
                          setDrafts(remaining);
                          if (isActive) {
                            switchToDraft(remaining[0].id, false, remaining);
                          }
                          addToast(`Successfully discarded "${tab.name}"`, "warning");
                        },
                        true, // isDestructive
                        "Discard Tab",
                        "Cancel"
                      );
                    }}
                    className={cn(
                      "h-3.5 w-3.5 items-center justify-center flex rounded-full text-[10px] leading-none transition-colors hover:bg-red-500 hover:text-white shrink-0 font-mono cursor-pointer active:scale-90",
                      isActive ? "text-white/40" : "text-[var(--foreground)]/30"
                    )}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Draft Session Trigger */}
          <button 
            onClick={() => {
              if (drafts.length >= 15) {
                alert("POS draft workspaces threshold reached (Max 15 active counter tabs supported simultaneously).");
                return;
              }
              const newId = `draft-${Date.now()}`;
              let num = 101;
              while (drafts.some(d => d.name === `Bill #${num}`)) {
                num++;
              }
              const freshDraft: DraftBill = {
                id: newId,
                name: `Bill #${num}`,
                cart: [],
                customerName: '',
                customerPhone: '',
                discountPercent: 0,
                taxPercent: 0,
                paymentMethod: 'Cash',
                billingMode: 'auto',
                udharDueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                lastActiveAt: Date.now()
              };
              setDrafts(prev => [...prev, freshDraft]);
              setActiveDraftId(newId);
              setCart([]);
              setCustomerName('');
              setCustomerPhone('');
              setDiscountPercent(0);
              setTaxPercent(0);
              setPaymentMethod('Cash');
              setBillingMode('auto');
            }}
            className="h-8.5 px-3 rounded-xl bg-[var(--foreground)]/[0.03] border border-[var(--border)] hover:bg-[var(--foreground)]/[0.08] text-[var(--foreground)]/60 transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0 text-[10px] font-black uppercase tracking-wider hover:text-[var(--foreground)]"
            title="Open clean cash register checkout draft"
          >
            <Plus size={12} className="shrink-0" />
            Counter
          </button>
        </div>
      </div>

      {/* 🔮 IMMERSIVE HOLD WINDOW SESSIONS Drawer */}
      <AnimatePresence>
        {showHoldSessionsDrawer && (
          <div className="fixed inset-0 z-[999] flex justify-end">
            {/* Modal Glass Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHoldSessionsDrawer(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            
            {/* Sliding Panel */}
            <motion.div 
              initial={{ x: '100%', opacity: 0.95 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.95 }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="relative w-full max-w-md bg-[var(--card)] border-l border-[var(--border)] h-full shadow-2xl flex flex-col focus:outline-none text-[var(--foreground)] z-10"
            >
              {/* Header */}
              <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                    <PauseCircle size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight">Active Sessions & Holds</h3>
                    <p className="text-[8px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">Dual-Register Operator Hub</p>
                  </div>
                </div>
                
                <button 
                  onClick={() => setShowHoldSessionsDrawer(false)}
                  className="h-7 w-7 rounded-lg border border-[var(--border)] bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-all flex items-center justify-center cursor-pointer active:scale-90"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Session search controller bar */}
              <div className="p-4 border-b border-[var(--border)]/70 bg-[var(--foreground)]/[0.01]">
                <motion.div 
                  animate={{ 
                    scale: isDrawerSearchFocused ? 1.012 : 1,
                    borderColor: isDrawerSearchFocused ? "var(--primary)" : "var(--border)"
                  }}
                  whileHover={{ scale: isDrawerSearchFocused ? 1.012 : 1.004 }}
                  transition={{ type: "spring", stiffness: 450, damping: 25 }}
                  className="relative border rounded-xl bg-[var(--card)] overflow-hidden shadow-xs"
                >
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground)]/45" />
                  <input 
                    type="text"
                    value={holdSearchQuery}
                    onChange={(e) => setHoldSearchQuery(e.target.value)}
                    onFocus={() => setIsDrawerSearchFocused(true)}
                    onBlur={() => setIsDrawerSearchFocused(false)}
                    placeholder="Search by customer name, ticket, phone..."
                    className="w-full pl-9 pr-14 py-2.5 bg-transparent text-xs font-bold uppercase focus:outline-none placeholder:opacity-40 text-[var(--foreground)]"
                  />
                  {holdSearchQuery && (
                    <button 
                      onClick={() => setHoldSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase hover:text-red-500 leading-none cursor-pointer"
                    >
                      CLEAR
                    </button>
                  )}
                </motion.div>
              </div>

              {/* Scrollable list content */}
              <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-6">
                
                {/* 1. HELD SESSIONS BIN */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Held Sessions ({holdDrafts.length})
                    </span>
                    <span className="text-[7.5px] font-extrabold text-[var(--foreground)]/40 uppercase">Auto-expiry: 24h</span>
                  </div>

                  <div className="space-y-3">
                    {holdDrafts.filter(hd => {
                      const q = holdSearchQuery.toLowerCase().trim();
                      if (!q) return true;
                      return hd.name.toLowerCase().includes(q) || 
                             (hd.customerName || '').toLowerCase().includes(q) || 
                             (hd.customerPhone || '').includes(q);
                    }).map((hd, index) => {
                      const totalAmount = getDraftTotal(hd);
                      const itemsCount = hd.cart?.reduce((acc, c) => acc + c.quantity, 0) || 0;
                      return (
                        <motion.div 
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          key={hd.id}
                          className="p-3.5 rounded-xl border border-amber-500/15 bg-amber-500/[0.02] hover:bg-amber-500/[0.04] transition-all space-y-3 relative group overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 h-10 w-10 bg-amber-500/5 rounded-bl-full border-b border-l border-amber-500/10 flex items-center justify-center pointer-events-none">
                            <span className="text-[7px] font-black text-amber-500 uppercase tracking-tighter -rotate-45 -translate-y-1 translate-x-1">HELD</span>
                          </div>

                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-xs font-black uppercase text-[var(--foreground)]">{hd.name}</h4>
                                {hd.isPinned && <Pin size={8} className="text-amber-500 fill-amber-500" />}
                              </div>
                              <p className="text-[9px] font-semibold text-[var(--foreground)]/60 mt-0.5">
                                Phone: {hd.customerPhone || 'Walk-in Customer'}
                              </p>
                              <p className="text-[9px] font-black text-[var(--primary)] mt-1">
                                {hd.customerName ? hd.customerName.toUpperCase() : 'WALK-IN CUSTOMER'}
                              </p>
                            </div>
                            
                            <div className="text-right">
                              <span className="text-[9px] font-bold text-[var(--foreground)]/45 uppercase tracking-wider block">Est. Bill Total</span>
                              <span className="text-xs font-bold font-mono text-amber-600 block">₹{formatNumber(totalAmount, precision)}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[8px] font-semibold opacity-50 uppercase border-t border-[var(--border)]/60 pt-2.5">
                            <span className="font-mono">Created: {getRelativeTime(hd.lastActiveAt)}</span>
                            <span>{itemsCount} individual Items</span>
                          </div>

                          <div className="flex items-center justify-end gap-1.5 pt-1">
                            <button 
                              onClick={() => {
                                setHoldDrafts(prev => prev.map(h => h.id === hd.id ? { ...h, isPinned: !h.isPinned } : h));
                              }}
                              className="h-6 px-2 rounded bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[8px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                            >
                              <Pin size={8} className={hd.isPinned ? "text-amber-500 fill-amber-500" : "opacity-30"} />
                              Pin
                            </button>
                            
                            <button
                              onClick={() => {
                                if (onPeek) {
                                  onPeek({
                                    type: 'bill',
                                    payload: {
                                      id: hd.id,
                                      customerName: hd.customerName || 'Walk-in Customer',
                                      customerPhone: hd.customerPhone,
                                      items: hd.cart.map(c => ({
                                        name: c.name,
                                        quantity: c.quantity,
                                        price: c.price,
                                        unit: c.unit
                                      })),
                                      subtotal: totalAmount,
                                      total: totalAmount,
                                      paymentMethod: hd.paymentMethod,
                                      timestamp: new Date(hd.lastActiveAt || Date.now()).toISOString()
                                    }
                                  });
                                }
                              }}
                              className="h-6 px-2.5 rounded bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[8px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                            >
                              <Eye size={8.5} />
                              Peek
                            </button>

                            <button 
                              onClick={() => {
                                setHoldDrafts(prev => prev.filter(h => h.id !== hd.id));
                                setDrafts(prev => [...prev, hd]);
                                setActiveDraftId(hd.id);
                                setCart(hd.cart || []);
                                setCustomerName(hd.customerName || '');
                                setCustomerPhone(hd.customerPhone || '');
                                setDiscountPercent(hd.discountPercent || 0);
                                setTaxPercent(hd.taxPercent || 0);
                                setPaymentMethod(hd.paymentMethod || 'Cash');
                                setBillingMode(hd.billingMode || 'auto');
                                setShowHoldSessionsDrawer(false);
                              }}
                              className="h-6 px-3 rounded bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 text-[8px] font-black uppercase tracking-widest cursor-pointer select-none"
                            >
                              Resume
                            </button>

                            <button 
                              onClick={() => {
                                showCustomConfirm(
                                  "Discard Held Session",
                                  `Are you sure you want to permanently discard the held counter "${hd.name}"? This action cannot be undone.`,
                                  () => {
                                    setHoldDrafts(prev => prev.filter(h => h.id !== hd.id));
                                    addToast(`Successfully discarded held session "${hd.name}"`, "warning");
                                  },
                                  true, // isDestructive
                                  "Discard",
                                  "Keep"
                                );
                              }}
                              className="h-6 w-6 rounded bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 transition-colors flex items-center justify-center cursor-pointer text-xs"
                              title="Discard customer session draft"
                            >
                              ×
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                    {holdDrafts.length === 0 && (
                      <div className="py-6 rounded-xl border border-dashed border-[var(--border)] text-center text-[10px] font-extrabold uppercase opacity-40">
                        No Held customer sessions registered yet
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. ACTIVE REGISTERS BACKSPLASH */}
                <div className="space-y-3.5 border-t border-[var(--border)] pt-5">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--foreground)]/45 block">
                    Active registers ({drafts.length})
                  </span>

                  <div className="space-y-2.5">
                    {drafts.filter(ad => {
                      const q = holdSearchQuery.toLowerCase().trim();
                      if (!q) return true;
                      return ad.name.toLowerCase().includes(q) || 
                             (ad.customerName || '').toLowerCase().includes(q) || 
                             (ad.customerPhone || '').includes(q);
                    }).map(ad => {
                      const isActive = ad.id === activeDraftId;
                      const totalAmount = getDraftTotal(ad);
                      const itemsCount = ad.cart?.reduce((acc, c) => acc + c.quantity, 0) || 0;
                      return (
                        <div 
                          key={ad.id}
                          className={cn(
                            "p-3 rounded-lg border transition-all text-left flex justify-between items-center group",
                            isActive 
                              ? "bg-[var(--primary)]/5 border-[var(--primary)]/35 shadow-md"
                              : "bg-[var(--foreground)]/[0.01] border-[var(--border)] hover:bg-[var(--foreground)]/[0.03]"
                          )}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black uppercase">{ad.name}</span>
                              {isActive && (
                                <span className="text-[7.5px] font-black uppercase px-1.5 py-0.5 rounded-full bg-emerald-500 text-white leading-none">
                                  ACTIVE
                                </span>
                              )}
                              {ad.isPinned && <Pin size={8} className="text-amber-500 fill-amber-500" />}
                            </div>
                            <span className="text-[9px] font-semibold text-[var(--foreground)]/50 block mt-0.5">
                              {ad.customerName ? ad.customerName.toUpperCase() : 'WALK-IN CUSTOMER'}
                            </span>
                            <span className="text-[8px] font-bold text-[var(--foreground)]/40 block mt-1">
                              Modified: {getRelativeTime(ad.lastActiveAt)}
                            </span>
                          </div>

                          <div className="text-right space-y-1.5">
                            <div>
                              <span className="text-[9px] font-mono font-bold block leading-none">₹{formatNumber(totalAmount, precision)}</span>
                              <span className="text-[7.5px] font-mono leading-none font-bold opacity-50 block">{itemsCount} units</span>
                            </div>

                            {!isActive && (
                              <button 
                                onClick={() => {
                                  switchToDraft(ad.id);
                                  setShowHoldSessionsDrawer(false);
                                }}
                                className="px-2 py-0.5 bg-[var(--primary)] text-white hover:bg-[var(--primary)]/95 hover:shadow-xs text-[7.5px] rounded font-black uppercase tracking-wider"
                              >
                                SWITCH
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Action Footer */}
              <div className="p-4.5 border-t border-[var(--border)] bg-[var(--foreground)]/[0.02] space-y-2">
                <button
                  onClick={() => {
                    if (drafts.length >= 15) {
                      alert("POS draft workspace tabs limit reached.");
                      return;
                    }
                    const newId = `draft-${Date.now()}`;
                    let num = 101;
                    while (drafts.some(d => d.name === `Bill #${num}`)) {
                      num++;
                    }
                    const freshDraft: DraftBill = {
                      id: newId,
                      name: `Bill #${num}`,
                      cart: [],
                      customerName: '',
                      customerPhone: '',
                      discountPercent: 0,
                      taxPercent: 0,
                      paymentMethod: 'Cash',
                      billingMode: 'auto',
                      udharDueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                      lastActiveAt: Date.now()
                    };
                    setDrafts(prev => [...prev, freshDraft]);
                    setActiveDraftId(newId);
                    setCart([]);
                    setCustomerName('');
                    setCustomerPhone('');
                    setDiscountPercent(0);
                    setTaxPercent(0);
                    setPaymentMethod('Cash');
                    setBillingMode('auto');
                    setShowHoldSessionsDrawer(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 font-black text-[9px] uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-[var(--primary)]/10"
                >
                  + Launch New Checkout Window
                </button>
                
                <button 
                  onClick={() => setShowHoldSessionsDrawer(false)}
                  className="w-full py-2 rounded-xl bg-[var(--foreground)]/[0.05] hover:bg-[var(--foreground)]/[0.08] text-[var(--foreground)] font-black text-[9px] uppercase tracking-widest transition-all cursor-pointer"
                >
                  Dismiss Drawer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 📋 Bilingual Dynamic Headers */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
            <ShoppingCart size={18} />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-tight uppercase leading-none">
              {getTranslation('posHeading')}
            </h2>
            <p className="text-[8px] font-bold opacity-50 uppercase tracking-widest mt-0.5">
              {getTranslation('posSubheading')}
            </p>
          </div>
        </div>
        
        {/* Toggle Mode Control + Billing Drawer Switch */}
        <div className="flex items-center gap-2">
          {/* Rate pricing Selector */}
          <div className="flex bg-[var(--foreground)]/5 p-0.5 rounded-lg border border-[var(--border)] p-0.5 gap-0.5 text-[8px] font-black uppercase">
            {(['retail', 'wholesale', 'auto'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setBillingMode(mode)}
                className={cn(
                  "px-2.5 py-1 rounded-md transition-all cursor-pointer select-none leading-none",
                  billingMode === mode 
                    ? "bg-[var(--primary)] text-white font-black" 
                    : "text-[var(--foreground)]/50 hover:text-[var(--foreground)]"
                )}
              >
                {mode === 'auto' ? "Auto" : mode}
              </button>
            ))}
          </div>

          <button
            onClick={() => onOpenHistoryDrawer?.()}
            className="px-2.5 py-1 text-[8px] font-black uppercase tracking-wider rounded-lg border border-[var(--border)] bg-amber-500/10 hover:bg-amber-500 hover:text-white transition-all flex items-center gap-1 cursor-pointer select-none"
          >
            <ReceiptText size={10} />
            <span>Reports History ({state.bills?.length || 0})</span>
          </button>

          {/* Draggable Mini Calculator Toggle */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('tsm-open-calculator'))}
            className="px-2.5 py-1 text-[8px] font-black uppercase tracking-wider rounded-lg border border-[var(--border)] bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white transition-all flex items-center gap-1 cursor-pointer select-none"
            title="Launch Draggable Smart Calculator"
          >
            <span>🧮</span>
            <span>Calc Business</span>
          </button>

          {/* Real-time Bill Preview Toggle */}
          <button
            onClick={() => {
              setShowLivePreview(!showLivePreview);
              if (window.innerWidth < 1024) {
                setMobilePreviewOpen(!mobilePreviewOpen);
              }
            }}
            className={cn(
              "px-2.5 py-1 text-[8px] font-black uppercase tracking-wider rounded-lg border transition-all flex items-center gap-1 cursor-pointer select-none",
              showLivePreview
                ? "bg-emerald-500 text-white border-emerald-500 shadow"
                : "border-[var(--border)] bg-emerald-500/5 hover:bg-emerald-500/10"
            )}
            title="Toggle Live Invoice Preview"
          >
            <Eye size={10} />
            <span>Live Preview</span>
          </button>

          {/* Cloud Sync Status Indicator */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--card)]/50 text-[8px] font-black tracking-wider uppercase">
            {state.user && state.settings.autoCloudSync ? (
              isSyncing ? (
                <>
                  <RefreshCw className="animate-spin text-amber-500" size={10} />
                  <span className="text-amber-500">Syncing...</span>
                </>
              ) : (
                <>
                  <Cloud className="text-emerald-500" size={10} />
                  <span className="text-emerald-500">Synced to Firebase</span>
                </>
              )
            ) : (
              <>
                <CloudOff className="text-neutral-500" size={10} />
                <span className="text-neutral-500">Local-Only</span>
              </>
            )}
          </div>

          {/* Silent Printer Connection Indicator */}
          <div 
            title="Printer Health Status Monitor"
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--card)]/50 text-[8px] font-black tracking-wider uppercase select-none"
          >
            <span className={cn(
              "h-1.5 w-1.5 rounded-full inline-block animate-pulse",
              printerStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]' :
              printerStatus === 'connecting' ? 'bg-amber-500' :
              'bg-neutral-400'
            )}></span>
            <span className={cn(
              printerStatus === 'connected' ? 'text-emerald-400' :
              printerStatus === 'connecting' ? 'text-amber-500 animate-pulse' :
              'text-neutral-500'
            )}>
              {printerStatus === 'connected' ? 'Prn: Online' :
               printerStatus === 'connecting' ? 'Prn: Conn...' :
               'Prn: Off'}
            </span>
          </div>
        </div>
      </div>

      {/* 🍽️ ENHANCED RESTAURANT/CAFE FLOOR SEATING & SERVICE WORKFLOW GRAPHIC PLAN */}
      {state.settings.businessMode === 'restaurant' && (
        <div className="bg-[var(--card)]/90 backdrop-blur-md rounded-3xl border border-[var(--border)] p-4 sm:p-5 space-y-4 shadow-xl relative overflow-hidden">
          {/* Header section with toggle option */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl animate-bounce">🍽️</span>
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--foreground)]">Interactive Seating Floor Plan</h3>
                <p className="text-[7.5px] font-extrabold text-amber-500 uppercase tracking-widest leading-none mt-0.5">Real-Time Dining Hub, Service Timers & Table Swapping</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 self-end sm:self-auto">
              {/* Segment Toggle */}
              <div className="flex bg-[var(--background)] p-0.5 rounded-lg border border-[var(--border)] shadow-inner">
                <button
                  type="button"
                  onClick={() => setRestViewMode('map')}
                  className={cn(
                    "px-2 py-1 text-[7.5px] font-black uppercase tracking-wider rounded-md cursor-pointer transition-all",
                    restViewMode === 'map' ? "bg-[var(--primary)] text-white shadow-sm" : "opacity-60 text-[var(--foreground)] hover:opacity-100"
                  )}
                >
                  🗺️ Floor Map
                </button>
                <button
                  type="button"
                  onClick={() => setRestViewMode('grid')}
                  className={cn(
                    "px-2 py-1 text-[7.5px] font-black uppercase tracking-wider rounded-md cursor-pointer transition-all",
                    restViewMode === 'grid' ? "bg-[var(--primary)] text-white shadow-sm" : "opacity-60 text-[var(--foreground)] hover:opacity-100"
                  )}
                >
                  🎛️ Tactical Grid
                </button>
              </div>

              {/* Status metrics display */}
              <div className="flex items-center gap-2.5 text-[7px] font-black uppercase tracking-widest select-none">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full border border-[var(--border)] bg-[var(--background)]" />
                  <span className="opacity-60">Vacant ({REST_TABLES.length - drafts.filter(d => d.cart && d.cart.length > 0).length})</span>
                </div>
                <div className="flex items-center gap-1 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  <span className="text-orange-500 font-extrabold">Cooking ({drafts.filter(d => d.cart && d.cart.length > 0 && d.restServiceStatus === 'cooking').length})</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  <span className="text-indigo-500 font-bold">Eating ({drafts.filter(d => d.cart && d.cart.length > 0 && d.restServiceStatus === 'served').length})</span>
                </div>
              </div>
            </div>
          </div>

          {/* Master Seating Layout: Main view of tables + Detailed Sidebar HUD side-by-side */}
          <div className="grid grid-cols-12 gap-5 items-start">
            {/* Visual Floor / Grid Map section */}
            <div className={cn(
              "col-span-12 transition-all duration-300",
              selectedHudTable ? "lg:col-span-8 xl:col-span-9" : "col-span-12"
            )}>
              {restViewMode === 'grid' ? (
                /* --- TACTILE CONDENSED GRID VIEW --- */
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-7 gap-3">
                  {REST_TABLES.map(table => {
                    const matchingDraft = drafts.find(d => d.name === table.name);
                    const itemsCount = matchingDraft?.cart?.reduce((acc, c) => acc + c.quantity, 0) || 0;
                    const cartTotal = matchingDraft?.cart?.reduce((acc, c) => acc + (c.price * c.quantity), 0) || 0;
                    const isActive = matchingDraft && matchingDraft.id === activeDraftId;
                    const hasItems = itemsCount > 0;
                    const tableStatus = matchingDraft?.restServiceStatus || 'vacant';
                    const activeDuration = matchingDraft?.restTimerStartedAt 
                      ? Math.floor((Date.now() - matchingDraft.restTimerStartedAt) / 1000) 
                      : 0;

                    return (
                      <motion.button
                        key={table.id}
                        layoutId={`table-card-${table.id}`}
                        onClick={() => selectRestTable(table.name)}
                        className={cn(
                          "relative p-3 rounded-2xl border transition-all cursor-pointer text-left flex flex-col justify-between h-[5.2rem] group select-none overflow-hidden hover:shadow-md",
                          isActive
                            ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow-lg shadow-[var(--primary)]/15 scale-[1.01]"
                            : hasItems
                            ? tableStatus === 'cooking'
                              ? "bg-amber-500/[0.04] border-amber-500/30 hover:bg-amber-500/[0.08]"
                              : tableStatus === 'served'
                              ? "bg-emerald-500/[0.04] border-emerald-500/30 hover:bg-emerald-500/[0.08]"
                              : "bg-indigo-500/[0.04] border-indigo-500/20 hover:bg-indigo-500/[0.08]"
                            : "bg-[var(--background)]/[0.4] border-[var(--border)] hover:bg-[var(--foreground)]/[0.02]"
                        )}
                        whileHover={{ y: -3, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="flex justify-between items-start w-full gap-1">
                          <div className="flex items-center gap-1.5">
                            {tableStatus === 'cooking' && (
                              <span className="text-[10px] inline-block shrink-0 animate-spin">🍳</span>
                            )}
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-wide truncate",
                              isActive ? "text-amber-300" : "text-[var(--foreground)]"
                            )}>
                              {table.name}
                            </span>
                          </div>
                          
                          {/* Circle status light */}
                          <span className={cn(
                            "h-2 w-2 rounded-full",
                            isActive ? "bg-white border shadow-sm" :
                            hasItems 
                              ? tableStatus === 'cooking' ? "bg-amber-500"
                              : tableStatus === 'served' ? "bg-emerald-500 animate-pulse"
                              : tableStatus === 'billing' ? "bg-purple-500 animate-pulse"
                              : "bg-orange-400"
                            : "bg-neutral-300"
                          )} />
                        </div>
                        
                        <div className="space-y-0.5 mt-1.5">
                          <div className={cn(
                            "text-[7px] font-bold uppercase truncate",
                            isActive ? "text-white/70" : "opacity-45"
                          )}>
                            {table.seats}
                          </div>
                          
                          {hasItems && activeDuration > 0 && (
                            <div className={cn(
                              "text-[6.5px] font-mono font-black uppercase flex items-center gap-0.5",
                              isActive ? "text-white/80" : "text-amber-600"
                            )}>
                              ⏳ {Math.floor(activeDuration / 60)}m {String(activeDuration % 60).padStart(2, '0')}s
                            </div>
                          )}

                          <div className="flex items-center justify-between w-full mt-1 pt-1 border-t border-dashed border-[var(--border)]/10">
                            {hasItems ? (
                              <>
                                <span className={cn(
                                  "text-[8.5px] font-black font-mono leading-none",
                                  isActive ? "text-white" : "text-indigo-600 font-extrabold"
                                )}>
                                  ₹{formatNumber(cartTotal)}
                                </span>
                                <span className={cn(
                                  "text-[6px] font-black uppercase px-1 rounded-sm leading-none py-0.5",
                                  isActive ? "bg-white/20 text-white" : "bg-neutral-500/10 text-neutral-600"
                                )}>
                                  {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                                </span>
                              </>
                            ) : (
                              <span className={cn(
                                "text-[6.5px] font-black uppercase tracking-widest leading-none",
                                isActive ? "text-white/60" : "opacity-25"
                              )}>
                                Vacant
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                /* --- BLUEPRINTED ROOM FLOOR PLAN MAP VIEW (ULTRA PREMIUM) --- */
                <div className="space-y-6">
                  {/* Category Layout Sections */}
                  {[
                    { 
                      title: '🏡 Main Bistro Dining Hall (Primary)', 
                      tables: REST_TABLES.filter(t => ['table_1', 'table_2', 'table_3', 'table_4', 'table_5'].includes(t.id)),
                      gridClass: "grid grid-cols-2 sm:grid-cols-5 gap-4"
                    },
                    { 
                      title: '🚪 Royal VIP Private Cabins', 
                      tables: REST_TABLES.filter(t => ['table_10', 'table_11'].includes(t.id)),
                      gridClass: "grid grid-cols-2 gap-4"
                    },
                    { 
                      title: '🍕 Cozy Pizza & Bar Area', 
                      tables: REST_TABLES.filter(t => ['table_6', 'table_7', 'table_8', 'table_9'].includes(t.id)),
                      gridClass: "grid grid-cols-2 sm:grid-cols-4 gap-4"
                    },
                    { 
                      title: '🍀 Sunny Outdoor Lawn & Picks', 
                      tables: REST_TABLES.filter(t => ['table_12', 'takeaway_1', 'takeaway_2'].includes(t.id)),
                      gridClass: "grid grid-cols-3 gap-4"
                    }
                  ].map((section, sidx) => (
                    <div key={sidx} className="bg-[var(--background)]/40 p-3 sm:p-4 rounded-2xl border border-[var(--border)]/60 relative">
                      <span className="absolute -top-2.5 left-4 bg-[var(--card)] px-2.5 py-0.5 rounded-full border border-[var(--border)] text-[7.5px] font-black uppercase tracking-wider text-[var(--primary)] leading-none font-sans">
                        {section.title}
                      </span>
                      
                      <div className={cn(section.gridClass, "mt-2 pt-1.5")}>
                        {section.tables.map(table => {
                          const matchingDraft = drafts.find(d => d.name === table.name);
                          const itemsCount = matchingDraft?.cart?.reduce((acc, c) => acc + c.quantity, 0) || 0;
                          const cartTotal = matchingDraft?.cart?.reduce((acc, c) => acc + (c.price * c.quantity), 0) || 0;
                          const isActive = matchingDraft && matchingDraft.id === activeDraftId;
                          const hasItems = itemsCount > 0;
                          const tableStatus = matchingDraft?.restServiceStatus || 'vacant';
                          const activeDuration = matchingDraft?.restTimerStartedAt 
                            ? Math.floor((Date.now() - matchingDraft.restTimerStartedAt) / 1000) 
                            : 0;

                          // Distinct table shapes per category to look like a architectural blueprint
                          const isShortSeater = table.seats.includes('2');
                          const isCabin = table.seats.includes('Cabin');
                          const isTakeaway = table.seats.includes('Express');

                          return (
                            <motion.button
                              type="button"
                              key={table.id}
                              onClick={() => selectRestTable(table.name)}
                              whileHover={{ y: -4, scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              className={cn(
                                "relative transition-all cursor-pointer text-left flex flex-col justify-between h-[5.2rem] group select-none shadow-sm overflow-hidden",
                                isShortSeater 
                                  ? "rounded-full p-4 border text-center items-center justify-center" // round table
                                  : isCabin 
                                  ? "rounded-2xl p-3.5 border border-amber-600/35 bg-amber-500/[0.01]" // cabins
                                  : "rounded-xl p-3 border", // square table
                                isActive
                                  ? "bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark,#e05200)] text-white border-[var(--primary)] opacity-100 shadow-[0_8px_16px_rgba(235,94,40,0.25)] scale-[1.02]"
                                  : hasItems
                                  ? tableStatus === 'cooking' 
                                    ? "bg-amber-500/[0.04] border-amber-500/35"
                                    : tableStatus === 'served'
                                    ? "bg-emerald-500/[0.04] border-emerald-500/35"
                                    : "bg-indigo-500/[0.03] border-indigo-500/25"
                                  : "bg-[var(--card)] border-[var(--border)] hover:bg-[var(--foreground)]/[0.015]"
                              )}
                            >
                              {/* Glowing pulsators for active status */}
                              {hasItems && !isActive && (
                                <span className={cn(
                                  "absolute top-1 right-1 h-1.5 w-1.5 rounded-full inline-block animate-ping",
                                  tableStatus === 'cooking' ? "bg-amber-400" :
                                  tableStatus === 'served' ? "bg-emerald-400" : "bg-indigo-400"
                                )}/>
                              )}

                              <div className="flex flex-col items-start justify-between h-full w-full">
                                <div className="flex items-center justify-between w-full gap-1">
                                  <span className={cn(
                                    "text-[9px] font-extrabold uppercase tracking-widest leading-none shrink-0 truncate max-w-[50px]",
                                    isActive ? "text-amber-300" : "text-[var(--foreground)]"
                                  )}>
                                    {table.name}
                                  </span>
                                  <span className="text-[11px] leading-none opacity-80 shrink-0 select-none">
                                    {isCabin ? '🚪' : isTakeaway ? '🛍️' : isShortSeater ? '◯' : '⬜'}
                                  </span>
                                </div>

                                <div className="w-full mt-1">
                                  <div className={cn(
                                    "text-[6.5px] font-bold uppercase truncate",
                                    isActive ? "text-white/80" : "opacity-45"
                                  )}>
                                    {table.seats}
                                  </div>
                                  
                                  {hasItems && activeDuration > 0 && (
                                    <span className={cn(
                                      "text-[6.5px] font-mono leading-none block font-black mt-0.5",
                                      isActive ? "text-amber-200" : "text-orange-500"
                                    )}>
                                      ⏳ {Math.floor(activeDuration / 60)}m {String(activeDuration % 60).padStart(2, '0')}s
                                    </span>
                                  )}
                                </div>

                                <div className="w-full pt-1.5 border-t border-[var(--border)]/10 flex justify-between items-center leading-none mt-1">
                                  {hasItems ? (
                                    <>
                                      <span className={cn(
                                        "text-[8.5px] font-black font-mono",
                                        isActive ? "text-white" : "text-indigo-600 font-extrabold"
                                      )}>
                                        ₹{formatNumber(cartTotal)}
                                      </span>
                                      <span className={cn(
                                        "text-[5.5px] font-black uppercase px-0.5 rounded bg-[var(--background)]",
                                        isActive ? "text-zinc-900 bg-white/90 font-black" : "opacity-50"
                                      )}>
                                        {itemsCount} item{itemsCount > 1 ? 's' : ''}
                                      </span>
                                    </>
                                  ) : (
                                    <span className={cn(
                                      "text-[5.5px] font-black uppercase tracking-widest leading-none",
                                      isActive ? "text-white/55" : "opacity-30"
                                    )}>
                                      Empty
                                    </span>
                                  )}
                                </div>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* --- DETAILED INTERACTIVE SIDEBAR TABLE HUD --- */}
            <AnimatePresence>
              {selectedHudTable && (() => {
                const hudDraft = drafts.find(d => d.name === selectedHudTable);
                const hudItemsCount = hudDraft?.cart?.reduce((acc, c) => acc + c.quantity, 0) || 0;
                const hudCartTotal = hudDraft?.cart?.reduce((acc, c) => acc + (c.price * c.quantity), 0) || 0;
                const hudStatus = hudDraft?.restServiceStatus || 'vacant';
                const hudTimerStarted = hudDraft?.restTimerStartedAt;
                const elapsedSeconds = hudTimerStarted ? Math.floor((Date.now() - hudTimerStarted) / 1000) : 0;
                
                const otherVacantTables = REST_TABLES.filter(t => t.name !== selectedHudTable);

                return (
                  <motion.div
                    key="seating-hud"
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 50, opacity: 0 }}
                    className="col-span-12 lg:col-span-4 xl:col-span-3 bg-[var(--background)] border border-[var(--border)] rounded-2xl p-4 space-y-4 shadow-lg shrink-0"
                  >
                    {/* HUD Header */}
                    <div className="flex items-start justify-between border-b border-[var(--border)] pb-2">
                      <div>
                        <span className="text-[7px] font-black uppercase tracking-widest text-amber-500">Selected Control</span>
                        <h4 className="text-[13px] font-black uppercase text-[var(--foreground)]">{selectedHudTable}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedHudTable(null)}
                        className="p-1 hover:bg-[var(--foreground)]/[0.05] rounded-lg text-rose-500 cursor-pointer border-none bg-transparent flex items-center"
                        title="Dismiss Panel"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Quick Session Stats */}
                    <div className="space-y-1.5 text-[9px] font-semibold">
                      <div className="flex justify-between items-center bg-[var(--card)]/50 p-2 rounded-lg border border-[var(--border)]/50">
                        <span className="opacity-60 flex items-center gap-1">⏱️ Live Timer:</span>
                        {hudTimerStarted ? (
                          <span className="font-bold text-amber-600 font-mono text-[9.5px]">
                            {Math.floor(elapsedSeconds / 60)}m {String(elapsedSeconds % 60).padStart(2, '0')}s
                          </span>
                        ) : (
                          <span className="text-zinc-400">Not started</span>
                        )}
                      </div>

                      <div className="flex justify-between items-center bg-[var(--card)]/50 p-2 rounded-lg border border-[var(--border)]/50">
                        <span className="opacity-60">💰 Accumulated:</span>
                        <span className="font-extrabold text-indigo-500 font-mono">₹{formatNumber(hudCartTotal)}</span>
                      </div>

                      <div className="flex justify-between items-center bg-[var(--card)]/50 p-2 rounded-lg border border-[var(--border)]/50">
                        <span className="opacity-60">🍕 Dishes ordered:</span>
                        <span className="font-black px-1.5 py-0.5 rounded-md bg-[var(--foreground)]/[0.04] text-[var(--foreground)]">{hudItemsCount} dishes</span>
                      </div>
                    </div>

                    {/* Table Status Pipeline Progression (Interactive) */}
                    {hudDraft && (
                      <div className="space-y-1.5">
                        <span className="text-[7.5px] font-black uppercase tracking-wider text-neutral-400 block pb-1">
                          📋 Dining Service Pipeline Progress
                        </span>
                        
                        <div className="grid grid-cols-4 gap-1">
                          {(['ordered', 'cooking', 'served', 'billing'] as const).map(step => {
                            const isCurrent = hudStatus === step;
                            const colors = 
                              step === 'ordered' ? "bg-emerald-500 text-white" :
                              step === 'cooking' ? "bg-amber-500 text-white animate-pulse" :
                              step === 'served' ? "bg-indigo-500 text-white" :
                              "bg-purple-500 text-white";

                            return (
                              <button
                                key={step}
                                onClick={() => {
                                  setDrafts(prev => prev.map(d => {
                                    if (d.name === selectedHudTable) {
                                      return { ...d, restServiceStatus: step };
                                    }
                                    return d;
                                  }));
                                  addToast(`${selectedHudTable} marked as ${step.toUpperCase()}!`, "info");
                                }}
                                className={cn(
                                  "py-1 rounded-md text-[7px] font-black uppercase tracking-widest text-center cursor-pointer border transition-all truncate hover:scale-[1.03]",
                                  isCurrent ? colors + " border-transparent" : "bg-[var(--card)] text-[var(--foreground)] opacity-55 border-[var(--border)] hover:opacity-100"
                                )}
                              >
                                {step}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Table Swap & Transfer module */}
                    {hudDraft && hudItemsCount > 0 && (
                      <div className="space-y-1 bg-gradient-to-r from-amber-500/[0.03] to-indigo-500/[0.03] border border-dashed border-[var(--border)] p-2.5 rounded-xl">
                        <span className="text-[7.5px] font-black uppercase tracking-wider text-amber-600 block">
                          🔄 Swap Seating / Transfer Table
                        </span>
                        <p className="text-[6.5px] text-zinc-400 leading-none">Move all meals and cooking timer to another table.</p>
                        
                        <div className="flex gap-2 items-center mt-2.5">
                          <select
                            value={swapTargetTableId}
                            onChange={(e) => setSwapTargetTableId(e.target.value)}
                            className="flex-1 bg-[var(--background)] text-[8.5px] font-bold uppercase tracking-wider border border-[var(--border)] p-1 rounded-lg outline-none select-none max-w-[130px]"
                          >
                            <option value="">-- TARGET TABLE --</option>
                            {otherVacantTables.map(t => {
                              const draftHasCart = drafts.find(d => d.name === t.name)?.cart?.length || 0;
                              return (
                                <option key={t.id} value={t.name}>
                                  {t.name} {draftHasCart ? '(Active Order)' : '(Vacant)'}
                                </option>
                              );
                            })}
                          </select>
                          
                          <button
                            type="button"
                            disabled={!swapTargetTableId}
                            onClick={() => transferTable(selectedHudTable, swapTargetTableId)}
                            className="bg-[var(--primary)] text-white hover:opacity-90 text-[7.5px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg border-none shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                          >
                            MOVE
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Direct Shortcut Bills */}
                    <div className="pt-2 border-t border-[var(--border)]/65 space-y-1.5">
                      <button
                        type="button"
                        onClick={() => selectRestTable(selectedHudTable)}
                        className="w-full py-1.5 bg-[var(--foreground)] text-[var(--card)] hover:opacity-80 rounded-lg text-[8px] font-black uppercase tracking-widest cursor-pointer border-none transition-colors"
                      >
                        ✍️ Active Checkout Menu
                      </button>
                      <p className="text-[6px] text-center text-zinc-500 font-extrabold uppercase tracking-wide leading-none select-none">
                        Lock items into active global billing screen below
                      </p>
                    </div>

                  </motion.div>
                );
              })()}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Main Billing Grid */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* LEFT COLUMN: ACTIVE PRODUCTS LIST & QUICK HELPER BUTTONS (7/12) */}
        <div className={cn(
          "col-span-12 space-y-4 transition-all duration-300",
          (showLivePreview && cart.length > 0) ? "lg:col-span-4 xl:col-span-4" : "lg:col-span-7"
        )}>
          
          {/* Smart Typo-Tolerant Search Component with predictive real-time autocomplete */}
          <div className="relative animate-fadeIn">
            <motion.div 
              animate={{ 
                scale: isSearchFocused ? 1.012 : 1,
                borderColor: isSearchFocused ? "var(--primary)" : "var(--border)"
              }}
              whileHover={{ scale: isSearchFocused ? 1.012 : 1.004 }}
              transition={{ type: "spring", stiffness: 450, damping: 25 }}
              className="relative rounded-xl bg-[var(--card)] border pr-2 py-0.5 flex items-center shadow-inner overflow-hidden"
            >
              <Search className="text-[var(--primary)] ml-3 opacity-40 shrink-0" size={16} />
              
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActivePredictionIndex(-1);
                }}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => {
                  setTimeout(() => setIsSearchFocused(false), 240);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActivePredictionIndex(prev => 
                      prev < predictiveBillingItems.length - 1 ? prev + 1 : 0
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActivePredictionIndex(prev => 
                      prev > 0 ? prev - 1 : predictiveBillingItems.length - 1
                    );
                  } else if (e.key === 'Enter') {
                    if (activePredictionIndex >= 0 && activePredictionIndex < predictiveBillingItems.length) {
                      e.preventDefault();
                      const selectedItem = predictiveBillingItems[activePredictionIndex];
                      
                      const inputElement = e.currentTarget;
                      const rect = inputElement.getBoundingClientRect();
                      addToCart(selectedItem, {
                        clientX: rect.left + rect.width / 2,
                        clientY: rect.top + rect.height / 2
                      });
                      
                      setSearchQuery('');
                      setIsSearchFocused(false);
                    }
                  } else if (e.key === 'Escape') {
                    setIsSearchFocused(false);
                    e.currentTarget.blur();
                  }
                }}
                className="w-full pl-2 pr-3 py-1.5 bg-transparent border-none text-xs text-[var(--foreground)] outline-none placeholder:opacity-40 font-semibold"
                placeholder={getTranslation('searchPlaceholder')}
              />
              
              {/* Mic Dictation trigger */}
              <button
                type="button"
                onClick={handleVoiceSearch}
                className={cn(
                  "p-1.5 rounded-lg text-xs flex items-center justify-center shrink-0 transition-all cursor-pointer",
                  isListening 
                    ? "bg-red-500 text-white animate-pulse" 
                    : "bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)]/50"
                )}
                title="Voice Search Voice dictation"
              >
                {isListening ? <MicOff size={12} /> : <Mic size={12} />}
              </button>
            </motion.div>

            {/* Predictive Bill-Ready Suggestions Menu */}
            <AnimatePresence>
              {searchQuery.trim().length > 0 && isSearchFocused && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute left-0 right-0 mt-2 z-[999] overflow-hidden bg-[var(--card)] border shadow-[0_20px_50px_rgba(0,0,0,0.3)] ${
                    state.settings.theme === 'neo_brutalist' 
                      ? 'border-4 border-black rounded-none shadow-[8px_8px_0px_#000]' 
                      : 'border-[var(--border)] rounded-2xl backdrop-blur-md'
                  }`}
                >
                  <div className="p-2.5 border-b border-[var(--border)] bg-[var(--foreground)]/[0.04] flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider opacity-50 flex items-center gap-1.5 font-mono">
                      <Sparkles size={11} className="text-[var(--primary)] animate-pulse" />
                      Predictive Auto-Billing Panel:
                    </span>
                    <span className="text-[9px] font-bold opacity-30">Press Enter ↵ to add to bill</span>
                  </div>

                  <div className="max-h-68 overflow-y-auto no-scrollbar">
                    {predictiveBillingItems.length === 0 ? (
                      <div className="p-4 text-xs opacity-50 text-center font-bold">
                        No products match your typing.
                      </div>
                    ) : (
                      predictiveBillingItems.map((item, idx) => {
                        const trs = item.translations || { en: item.name || '', hi: '', mr: '', 'hi-en': '' };
                        const displayName = trs[currentLang] || trs.en || item.name;
                        const isQtyLow = item.quantity <= (item.minStockLevel || state.settings?.minStockLevel || 10);
                        const isQtyOut = item.quantity <= 0;
                        const itemPrice = billingMode === 'wholesale' ? (item.wholesalePrice || item.retailPrice) : item.retailPrice;

                        return (
                          <div
                            key={item.id}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              addToCart(item, { clientX: e.clientX, clientY: e.clientY });
                              setSearchQuery('');
                              setIsSearchFocused(false);
                            }}
                            onMouseEnter={() => setActivePredictionIndex(idx)}
                            className={`px-4 py-2.5 flex items-center justify-between cursor-pointer border-b border-[var(--border)] last:border-0 transition-all ${
                              activePredictionIndex === idx 
                                ? 'bg-[var(--primary)] text-white' 
                                : 'hover:bg-[var(--foreground)]/[0.03]'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black truncate">{displayName}</span>
                                <span className={`text-[9.5px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider ${
                                  activePredictionIndex === idx
                                    ? 'bg-white/20 text-white'
                                    : 'bg-[var(--foreground)]/[0.05] text-[var(--foreground)]/70'
                                }`}>
                                  ₹{formatNumber(itemPrice, precision)} {item.unit || 'pcs'}
                                </span>
                              </div>
                              <span className={`text-[9px] uppercase tracking-wide block truncate mt-0.5 ${
                                activePredictionIndex === idx ? 'text-white/80' : 'text-[var(--foreground)]/60'
                              }`}>
                                Category: {state.categories?.find(c => c.id === item.categoryId)?.name || 'General'}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isQtyOut 
                                  ? 'bg-rose-500/20 text-rose-500' 
                                  : isQtyLow 
                                    ? 'bg-amber-500/20 text-amber-500 font-extrabold' 
                                    : activePredictionIndex === idx
                                      ? 'bg-white/25 text-white'
                                      : 'bg-emerald-500/15 text-emerald-500'
                              }`}>
                                {isQtyOut ? 'Out' : `Qty: ${item.quantity}`}
                              </span>
                              <div className={`p-1 rounded-lg border ${
                                activePredictionIndex === idx 
                                  ? 'border-white bg-white text-[var(--primary)]' 
                                  : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                              }`}>
                                <Plus size={11} className="stroke-[3]" />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Recent Searches Pills tag list */}
          {recentSearches.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 max-w-full no-scrollbar select-none">
              <span className="text-[8px] font-black uppercase tracking-wider opacity-35 shrink-0">Recent:</span>
              <div className="flex gap-1">
                {recentSearches.map((recSearchValue, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSearchQuery(recSearchValue)}
                    className="px-2 py-0.5 rounded bg-[var(--foreground)]/5 border border-[var(--border)] hover:border-[var(--primary)]/20 hover:bg-[var(--primary)]/5 text-[8px] font-bold text-[var(--foreground)]/70 hover:text-[var(--foreground)] whitespace-nowrap leading-none cursor-pointer"
                  >
                    {recSearchValue}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { localStorage.removeItem('billing_recent_searches'); setRecentSearches([]); }}
                className="text-[7px] font-black text-rose-500 uppercase hover:underline shrink-0 leading-none pl-1"
              >
                Clear
              </button>
            </div>
          )}

          {/* Category Scroller Navigation */}
          <div className="flex gap-1 overflow-x-auto pb-1 select-none no-scrollbar">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "px-3.5 py-1 text-[8px] font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer whitespace-nowrap",
                selectedCategory === null 
                  ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow" 
                  : "bg-[var(--card)] text-[var(--foreground)]/60 border-[var(--border)] hover:text-[var(--foreground)]"
              )}
            >
              {getTranslation('allCategories')}
            </button>
            {state.categories?.map((cat, idx) => (
              <button
                key={`${cat.id || 'cat'}-${idx}`}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "px-3.5 py-1 text-[8px] font-black uppercase tracking-wider rounded-lg border transition-all cursor-pointer whitespace-nowrap",
                  selectedCategory === cat.id 
                    ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow" 
                    : "bg-[var(--card)] text-[var(--foreground)]/60 border-[var(--border)] hover:text-[var(--foreground)]"
                )}
              >
                <span className="mr-1 opacity-70">{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>

          {/* Out Of Stock and Active shelf shelf list */}
          <div className="max-h-[42vh] overflow-y-auto pr-1 no-scrollbar space-y-1.5">
            {filteredItems.length === 0 ? (
              <div className="py-12 border border-[var(--border)] border-dashed rounded-xl text-center text-xs opacity-40">
                No items matching your list. Tap below to write a manual product entry.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredItems.map(item => {
                  const qtyLimitValue = item.quantity;
                  const isLow = qtyLimitValue <= (item.minStockLevel ?? state.settings?.minStockLevel ?? 10);
                  const isOut = qtyLimitValue <= 0;
                  
                  return (
                    <motion.div
                      key={item.id}
                      onClick={(e) => addToCart(item, e)}
                      whileHover={{ 
                        y: -5, 
                        scale: 1.025, 
                        borderColor: "var(--primary)",
                        boxShadow: "0 12px 24px -10px rgba(0, 0, 0, 0.15), 0 0 14px 3px var(--primary)"
                      }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 450, damping: 22 }}
                      className={cn(
                        "p-2 rounded-xl bg-[var(--card)] border cursor-pointer active:scale-95 transition-all text-left flex flex-col justify-between h-[5.2rem] group relative overflow-hidden select-none",
                        isOut 
                          ? "border-red-500/10 bg-red-500/[0.02]" 
                          : isLow 
                            ? "border-amber-500/20 bg-amber-500/[0.01]" 
                            : "border-[var(--border)]"
                      )}
                    >
                      <div>
                        {/* Title */}
                        <h4 className="font-extrabold text-[10px] text-[var(--foreground)] truncate uppercase group-hover:text-[var(--primary)] flex items-center justify-between gap-1">
                          <span className="truncate">{(item.translations && (item.translations[currentLang] || item.translations.en)) || item.name}</span>
                          <span className="text-[7.5px] font-black opacity-50 lowercase shrink-0">({item.unit || 'pcs'})</span>
                        </h4>
                        
                        <span className="text-[7.5px] font-bold text-[var(--foreground)]/45 uppercase tracking-wide block truncate">
                          Category: {state.categories?.find(c => c.id === item.categoryId)?.name || 'General'}
                        </span>
                      </div>

                      {/* Info & warnings on grid */}
                      <div className="flex items-end justify-between w-full mt-1.5 z-20">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-mono font-black text-[var(--foreground)] leading-none">
                            ₹{formatNumber(billingMode === 'wholesale' ? (item.wholesalePrice || item.retailPrice) : item.retailPrice, state.settings?.pricePrecision || 0)}
                          </span>
                          <span className="text-[7.5px] font-black opacity-50 lowercase mt-0.5" style={{ fontSize: '7px' }}>
                            per {billingMode === 'wholesale' ? (item.wholesalePriceUnit || item.unit || 'pcs') : (item.retailPriceUnit || item.unit || 'pcs')}
                          </span>
                        </div>
                        
                        {onPeek && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPeek({ type: 'item', payload: item });
                            }}
                            className="h-5 w-5 rounded-md bg-[var(--foreground)]/5 border border-[var(--border)] hover:bg-[var(--primary)] hover:text-white transition-all flex items-center justify-center text-[var(--foreground)]/55 cursor-pointer"
                            title="Quick View Characteristics"
                          >
                            <Eye size={10} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ADD ITEM NOT IN LIST COMPACT BUTTON */}
          <div className="flex justify-center select-none pt-1">
            <button
              onClick={() => {
                setManualName('');
                setManualPrice('');
                setManualCost('');
                setManualUnit('Pcs');
                setShowManualModal(true);
              }}
              className="px-4 py-2.5 border border-slate-950 dark:border-slate-50 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200 text-[9px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 w-full sm:w-auto shadow-md"
            >
              <PackagePlus size={13} />
              <span>+ {cleanAndValidateText("Add Item Not in List (खुला / अतिरिक्त सामान जोड़ें)", currentLang, state.settings)}</span>
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: CASHIER CART & TOTALS BLOCK (5/12) */}
        <div className={cn(
          "col-span-12 card p-4 bg-[var(--card)] border border-[var(--border)] rounded-2xl flex flex-col justify-between max-h-[85vh] overflow-y-auto shadow-sm no-scrollbar transition-all duration-300",
          (showLivePreview && cart.length > 0) ? "lg:col-span-4 xl:col-span-4" : "lg:col-span-5"
        )}>
          
          <div className="space-y-4">
            {/* Cart Header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[var(--primary)] flex items-center gap-1">
                <ShoppingCart size={12} />
                <span>Ticket Receipt List</span>
              </span>
              {cart.length > 0 && (
                <button
                  onClick={() => { if (confirm("Clear current ticket?")) setCart([]); }}
                  className="text-[8px] font-black text-red-500 uppercase hover:underline shrink-0 leading-none cursor-pointer"
                >
                  Empty
                </button>
              )}
            </div>

            {/* Smart Optional Customer Panel */}
            <div className={cn(
              "p-3 rounded-xl border transition-all space-y-2.5 select-none",
              paymentMethod === 'Credit' 
                ? "bg-rose-500/[0.03] border-rose-500/30 ring-1 ring-rose-500/10 shadow-sm"
                : "bg-[var(--foreground)]/[0.02] border-[var(--border)]"
            )}>
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-black uppercase opacity-45 tracking-widest leading-none block">
                  Customer Credentials
                </span>
                
                {paymentMethod === 'Credit' && (
                  <span className="text-[6.5px] font-black bg-rose-500 text-white px-1 leading-none py-0.5 rounded uppercase tracking-wider animate-pulse shrink-0">
                    UDHAR COMPLIANT CODE
                  </span>
                )}
              </div>

              {/* Toggle Customer fields display indicator if parameters aren't met */}
              {!(forceCustomerOpen || manualCustomerOpen) ? (
                <div className="flex justify-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setManualCustomerOpen(true)}
                    className="py-1.5 px-3 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[8px] font-black uppercase text-[var(--foreground)]/70 rounded-lg border border-[var(--border)] cursor-pointer select-none transition-all"
                  >
                    + Add Customer Info (ग्रहक की जानकारी)
                  </button>
                  <button
                    onClick={() => {
                      setManualCustomerOpen(true);
                      setIsGoogleContactModalOpen(true);
                    }}
                    className="py-1.5 px-3 bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 text-[8px] font-black uppercase text-[var(--primary)] rounded-lg border border-[var(--primary)]/20 cursor-pointer select-none transition-all flex items-center gap-1"
                  >
                    <User size={10} />
                    <span>Import Contacts</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[7px] font-black uppercase tracking-wider text-[var(--foreground)]/40">Customer Details</span>
                    <button
                      type="button"
                      onClick={() => setIsGoogleContactModalOpen(true)}
                      className="text-[7px] font-black uppercase tracking-wider text-[var(--primary)] hover:underline cursor-pointer flex items-center gap-1 bg-[var(--primary)]/5 px-2 py-1 rounded-md"
                    >
                      <User size={8} />
                      Import Google Contact
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-200">
                    <div className="relative col-span-1">
                      <User className="absolute left-2 top-1/2 -translate-y-1/2 opacity-30" size={12} />
                      <input
                        type="text"
                        placeholder="Name / नाम *"
                        className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[10px] uppercase font-bold outline-none font-sans focus:border-[var(--primary)]"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                      />
                    </div>
                    
                    <div className="relative col-span-1">
                      <Phone className="absolute left-2 top-1/2 -translate-y-1/2 opacity-30" size={10} />
                      <input
                        type="text"
                        placeholder="Mobile / फ़ोन *"
                        className="w-full pl-6 pr-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[10px] font-mono outline-none focus:border-[var(--primary)]"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                      />
                    </div>

                    {/* Date selection for udhar crediting */}
                    {paymentMethod === 'Credit' && (
                      <div className="col-span-2 pt-1.5 border-t border-rose-500/10 space-y-1 animate-in slide-in-from-top-2 duration-300">
                        <label className="text-[7px] font-black uppercase tracking-wider text-rose-500 block leading-none">
                          📅 Due Date / चुकाने की तारीख *
                        </label>
                        <input
                          type="date"
                          value={udharDueDate}
                          onChange={(e) => setUdharDueDate(e.target.value)}
                          className="w-full text-[10px] font-mono font-black border border-rose-500/20 rounded-lg px-2.5 py-1.5 bg-[var(--card)] text-[var(--foreground)] cursor-pointer outline-none focus:border-rose-500"
                        />
                      </div>
                    )}

                    <div className="col-span-2 flex justify-end">
                      {(!forceCustomerOpen) && (
                        <button
                          onClick={() => { setManualCustomerOpen(false); setCustomerName(''); setCustomerPhone(''); }}
                          className="text-[7px] font-black text-rose-500 uppercase hover:underline leading-none cursor-pointer"
                        >
                          Hide Panel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Cart list details */}
            <div className="space-y-1.5 max-h-[34vh] overflow-y-auto pr-1 no-scrollbar">
              {cart.length === 0 ? (
                <div className="py-12 px-4 border border-[var(--border)] border-dashed rounded-xl text-center opacity-30 space-y-2">
                  <ShoppingCart className="mx-auto opacity-30" size={28} />
                  <p className="text-[10px] font-medium max-w-xs mx-auto">
                    {getTranslation('emptyCartText')}
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {cart.map(ci => {
                    const itemsDBInSystem = !ci.item.isManual ? state.items.find(st => st.id === ci.id) : undefined;
                    const stockLeftVal = itemsDBInSystem ? itemsDBInSystem.quantity : 999;
                    const isNegativeDeducted = stockLeftVal <= 0;
                    
                    return (
                      <motion.div
                        key={ci.id}
                        layout
                        initial={{ opacity: 0, y: 10, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 30, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 450, damping: 25 }}
                        className="p-2.5 bg-[var(--card)] border border-[var(--border)] rounded-xl flex items-center justify-between gap-2 shadow-inner hover:border-[var(--primary)]/10 transition-colors select-none"
                      >
                        {/* Name description */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-extrabold text-[10px] text-[var(--foreground)] truncate uppercase flex items-center gap-1.5 flex-wrap">
                            <span>{ci.name}</span>
                            <span className="text-[8px] font-black text-[var(--foreground)]/50 lowercase border border-[var(--border)] px-1 rounded-md bg-[var(--foreground)]/[0.03]" title="Current Unit">({ci.unit})</span>
                          </h4>
                          
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {ci.item.isManual ? (
                              <span className="text-[6.5px] font-black uppercase px-1 rounded bg-amber-500/10 text-amber-600 border border-amber-500/15 leading-none py-0.5">
                                Manual Add
                              </span>
                            ) : (
                              <>
                                <button
                                  onClick={() => togglePriceType(ci.id)}
                                  className="text-[6.5px] font-black px-1 py-0.5 rounded leading-none bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/15 hover:bg-[var(--primary)]/20 cursor-pointer"
                                >
                                  Toggle Rates 🔄
                                </button>
                                <button
                                  onClick={() => setConvertingItemId(convertingItemId === ci.id ? null : ci.id)}
                                  className={cn(
                                    "text-[6.5px] font-black px-1 py-0.5 rounded leading-none border transition-colors cursor-pointer",
                                    convertingItemId === ci.id 
                                      ? "bg-amber-500/25 border-amber-500/40 text-[var(--foreground)]" 
                                      : "bg-slate-500/10 border-slate-500/15 hover:bg-slate-500/20 text-slate-500"
                                  )}
                                >
                                  Convert Unit 🔄
                                </button>
                              </>
                            )}
                          </div>

                          {/* Unit Conversion Options Pane */}
                          {convertingItemId === ci.id && (
                            <div className="mt-2 p-1.5 bg-[var(--foreground)]/[0.03] border border-[var(--border)] rounded-xl space-y-1 select-none">
                              <p className="text-[8px] font-bold uppercase opacity-60 px-1">Convert unit from {ci.unit}:</p>
                              <div className="flex items-center gap-1 flex-wrap">
                                {(() => {
                                  const currentUnitLower = ci.unit.toLowerCase();
                                  const options: { label: string; target: string; factor: number; isCustom?: boolean }[] = [];
                                  
                                  if (currentUnitLower === 'kg' || currentUnitLower === 'kilogram' || currentUnitLower === 'kilograms') {
                                    options.push({ label: 'to Grams (g)', target: 'g', factor: 1000 });
                                    options.push({ label: 'to Pounds (lb)', target: 'lb', factor: 2.20462 });
                                  } else if (currentUnitLower === 'g' || currentUnitLower === 'gram' || currentUnitLower === 'grams') {
                                    options.push({ label: 'to Kilograms (kg)', target: 'kg', factor: 0.001 });
                                  } else if (currentUnitLower === 'ltr' || currentUnitLower === 'litre' || currentUnitLower === 'liters' || currentUnitLower === 'liter') {
                                    options.push({ label: 'to Milliliters (ml)', target: 'ml', factor: 1000 });
                                  } else if (currentUnitLower === 'ml' || currentUnitLower === 'milliliter' || currentUnitLower === 'milliliters') {
                                    options.push({ label: 'to Liters (ltr)', target: 'ltr', factor: 0.001 });
                                  } else if (currentUnitLower === 'box' || currentUnitLower === 'pack' || currentUnitLower === 'pk' || currentUnitLower === 'crate') {
                                    options.push({ label: 'to Pcs (Pack of 10)', target: 'pcs', factor: 10 });
                                    options.push({ label: 'to Pcs (Pack of 12)', target: 'pcs', factor: 12 });
                                    options.push({ label: 'Custom multiplier...', target: '', factor: 1, isCustom: true });
                                  } else if (currentUnitLower === 'pcs' || currentUnitLower === 'pc' || currentUnitLower === 'piece' || currentUnitLower === 'pieces') {
                                    options.push({ label: 'to Box (÷10)', target: 'box', factor: 0.1 });
                                    options.push({ label: 'to Dozen (÷12)', target: 'doz', factor: 1 / 12 });
                                    options.push({ label: 'Custom divisor...', target: '', factor: 1, isCustom: true });
                                  } else if (currentUnitLower === 'doz' || currentUnitLower === 'dozen' || currentUnitLower === 'dz') {
                                    options.push({ label: 'to Pcs (×12)', target: 'pcs', factor: 12 });
                                  } else {
                                    options.push({ label: 'Custom Convert...', target: '', factor: 1, isCustom: true });
                                  }
                                  
                                  return (
                                    <>
                                      {options.map((opt, oIdx) => (
                                        <button
                                          key={oIdx}
                                          type="button"
                                          onClick={() => {
                                            if (opt.isCustom) {
                                              showCustomPrompt(
                                                "Custom Unit Conversion",
                                                `Convert ${ci.unit} using custom factor. Multiply quantity and divide rate by what factor? (e.g. enter 10 to turn 1 Box of ₹50 into 10 Pcs of ₹5):`,
                                                "10",
                                                (inputVal) => {
                                                  const val = parseFloat(inputVal);
                                                  if (!isNaN(val) && val > 0) {
                                                    showCustomPrompt(
                                                      "Target Unit Name",
                                                      "Enter the name for the new unit (e.g. pcs, g, box):",
                                                      "pcs",
                                                      (unitName) => {
                                                        if (unitName.trim()) {
                                                          handleUnitConversion(ci.id, unitName.trim(), val);
                                                          setConvertingItemId(null);
                                                        }
                                                      }
                                                    );
                                                  } else {
                                                    addToast("Invalid conversion factor!", "error");
                                                  }
                                                }
                                              );
                                            } else {
                                              handleUnitConversion(ci.id, opt.target, opt.factor);
                                              setConvertingItemId(null);
                                            }
                                          }}
                                          className="text-[6.5px] font-black uppercase px-1.5 py-0.5 rounded bg-[var(--primary)] hover:bg-[var(--primary)]/95 text-white cursor-pointer select-none"
                                        >
                                          {opt.label}
                                        </button>
                                      ))}
                                      <button
                                        type="button"
                                        onClick={() => setConvertingItemId(null)}
                                        className="text-[6.5px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-500 hover:bg-slate-600 text-white cursor-pointer select-none"
                                      >
                                        Cancel ×
                                      </button>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          )}

                          {/* Chef/Cooking Instructions addon */}
                          {state.settings.businessMode === 'restaurant' && (
                            <div className="mt-1">
                              {(ci as any).cookingInstructions ? (
                                <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 text-[7px] font-bold uppercase transition-all">
                                  <span>🍳: {(ci as any).cookingInstructions}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCart(cart.map(item => item.id === ci.id ? { ...item, cookingInstructions: '' } : item));
                                    }}
                                    className="text-rose-500 hover:text-rose-700 font-bold ml-1 active:scale-90 cursor-pointer text-[8px]"
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    showCustomPrompt(
                                      "Cooking instructions",
                                      "Type any custom preparation instructions (e.g. Extra spicy, No onion, Less ice):",
                                      "",
                                      (instructions) => {
                                        if (instructions && instructions.trim()) {
                                          setCart(cart.map(item => item.id === ci.id ? { ...item, cookingInstructions: instructions.trim() } : item));
                                          addToast("Instruction applied!", "info");
                                        }
                                      },
                                      "e.g., Less spicy..."
                                    );
                                  }}
                                  className="text-[6.5px] font-bold text-[var(--primary)] hover:underline cursor-pointer flex items-center gap-0.5"
                                >
                                  <span>✍️ special comments</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Controls and prices */}
                        <div className="flex items-center gap-1.5 shrink-0 select-none">
                          
                          {/* Rate display chip trigger for custom rate update */}
                          <div className="flex flex-col items-center select-none w-14 shrink-0">
                            <button
                              onClick={() => setEditingRateItem({
                                id: ci.id,
                                name: ci.name,
                                currentPrice: ci.price,
                                newPrice: ci.price,
                                isManual: !!ci.item.isManual
                              })}
                              className="h-6 px-1.5 bg-[var(--foreground)]/5 border border-[var(--border)] rounded-md font-mono font-black text-[10px] tracking-tight hover:border-[var(--primary)]/30 hover:bg-[var(--foreground)]/10 transition-all cursor-pointer text-right w-full truncate"
                              title="Click to edit rate"
                            >
                              ₹{formatNumber(ci.price, precision)}
                            </button>
                            <span className="text-[7.5px] font-black opacity-55 lowercase mt-0.5 truncate max-w-full leading-none" style={{ fontSize: '7px' }}>
                              per {ci.unit || 'pcs'}
                            </span>
                          </div>

                          {/* Weight fractions numeric weights KG */}
                          <CartQuantityInput
                            quantity={ci.quantity}
                            onChange={(newQty) => updateCartQuantity(ci.id, newQty)}
                            onDecrement={() => updateCartQuantity(ci.id, ci.quantity - 1)}
                            onIncrement={() => updateCartQuantity(ci.id, ci.quantity + 1)}
                          />

                          {/* Trash */}
                          <button
                            onClick={() => removeFromCart(ci.id)}
                            className="h-6 w-6 text-rose-500 hover:text-rose-700 hover:bg-rose-500/5 flex items-center justify-center rounded-lg cursor-pointer"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>

                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

          </div>

          {/* Checkout Section & Totals */}
          <div className="mt-4 pt-3 border-t border-[var(--border)] space-y-3 shrink-0">
            
            {/* Parameters layout summary */}
            <div className="grid grid-cols-2 gap-2 bg-[var(--foreground)]/5 p-2 rounded-xl border border-[var(--border)] select-none">
              <div>
                <label className="text-[7.5px] font-black uppercase opacity-60 block mb-0.5">{getTranslation('discountLabel')}</label>
                <div className="relative">
                  <Percent className="absolute left-2 top-1/2 -translate-y-1/2 opacity-30" size={10} />
                  <input
                    type="number"
                    min="0" max="100"
                    value={discountPercent || ''}
                    onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="w-full rounded-lg bg-[var(--card)] border border-[var(--border)] px-2 py-1 pl-6 text-[10px] text-[var(--foreground)] font-bold outline-none font-mono focus:border-[var(--primary)] text-right"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-[7.5px] font-black uppercase opacity-60 block mb-0.5">{getTranslation('taxLabel')}</label>
                <div className="relative">
                  <Percent className="absolute left-2 top-1/2 -translate-y-1/2 opacity-30" size={10} />
                  <input
                    type="number"
                    min="0" max="100"
                    value={taxPercent || ''}
                    onChange={(e) => setTaxPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="w-full rounded-lg bg-[var(--card)] border border-[var(--border)] px-2 py-1 pl-6 text-[10px] text-[var(--foreground)] font-bold outline-none font-mono focus:border-[var(--primary)] text-right"
                  />
                </div>
              </div>
            </div>

            {/* Direct Pay modes grids */}
            <div className="space-y-1 select-none">
              <label className="text-[7px] font-black uppercase tracking-wider opacity-60 block">{getTranslation('paymentModeTitle')}</label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { m: 'Cash', l: 'Cash (💵)' },
                  { m: 'UPI', l: 'UPI (📲)' },
                  { m: 'Credit', l: 'Udhar (📝)' }
                ].map(pMode => (
                  <button
                    key={pMode.m}
                    onClick={() => setPaymentMethod(pMode.m as any)}
                    className={cn(
                      "p-1.5 rounded-lg border text-[8px] font-black text-center uppercase tracking-tighter cursor-pointer transition-all",
                      paymentMethod === pMode.m 
                        ? "bg-[var(--primary)] text-white border-[var(--primary)] shadow" 
                        : "bg-[var(--card)] border-[var(--border)] text-[var(--foreground)]/60 hover:text-[var(--foreground)]"
                    )}
                  >
                    {pMode.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Totals pricing ledger */}
            <div className="bg-[var(--foreground)]/5 p-3 rounded-xl border border-[var(--border)] text-[10px] space-y-1.5 font-mono select-none">
              <div className="flex justify-between opacity-65">
                <span>{getTranslation('subtotal')}:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-emerald-500 font-bold">
                  <span>Discount (-) :</span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              {taxPercent > 0 && (
                <div className="flex justify-between text-rose-500 font-bold font-mono">
                  <span>GST Tax (+) :</span>
                  <span>+₹{taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-base text-[var(--foreground)] pt-1.5 border-t border-[var(--border)] select-text">
                <span className="font-sans text-[9px] uppercase tracking-wide font-black opacity-45 self-center">{getTranslation('grandTotal')}</span>
                <span className="text-[var(--primary)] font-mono">₹{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Smart Cash Handling Assistant */}
            {cart.length > 0 && (
              <div className="space-y-2 select-none">
                <button
                  type="button"
                  id="smart-cash-assistant-toggle-btn"
                  onClick={() => setIsCashAssistantOpen(!isCashAssistantOpen)}
                  className={cn(
                    "w-full py-2 px-3 border rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-between shadow-xs",
                    isCashAssistantOpen 
                      ? "bg-[var(--primary)]/[0.08] text-[var(--primary)] border-[var(--primary)]/40 ring-1 ring-[var(--primary)]/20 shadow-xs" 
                      : "bg-[var(--card)] hover:bg-[var(--foreground)]/[0.03] text-[var(--foreground)]/80 border-[var(--border)]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Coins size={14} className={cn(isCashAssistantOpen ? "text-[var(--primary)] animate-bounce" : "opacity-60")} />
                    <span>
                      {state.settings.language === 'hi' 
                        ? 'स्मार्ट नगद सहायक' 
                        : state.settings.language === 'mr' 
                          ? 'स्मार्ट रोख सहाय्यक' 
                          : state.settings.language === 'hi-en' 
                            ? 'Smart Cash Assistant (नगद कैलकुलेटर)' 
                            : 'Smart Cash Assistant'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[7px] font-black">
                    {isCashAssistantOpen ? (
                      <span className="bg-[var(--primary)]/10 text-[var(--primary)] px-2 py-0.5 rounded border border-[var(--primary)]/25 font-black uppercase animate-pulse">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="bg-[var(--foreground)]/5 text-[var(--foreground)]/45 px-2 py-0.5 rounded border border-[var(--border)] font-black uppercase">
                        OPEN
                      </span>
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {isCashAssistantOpen && (
                    <motion.div
                      id="smart-cash-assistant-panel"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border border-[var(--border)] rounded-xl bg-[var(--foreground)]/[0.015] p-3 space-y-3"
                    >
                      {/* Title & Reset */}
                      <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
                        <span className="text-[8px] font-black uppercase opacity-60 tracking-widest flex items-center gap-1">
                          <span>💵 Cash Drawer Desk</span>
                        </span>
                        {cashReceivedStr !== '' && (
                          <button 
                            type="button"
                            onClick={() => setCashReceivedStr('')}
                            className="text-[7.5px] font-black text-rose-500 hover:text-rose-600 hover:underline uppercase tracking-wider cursor-pointer"
                          >
                            Clear Input
                          </button>
                        )}
                      </div>

                      {/* Cash Suggestions / Proposed Denominations */}
                      <div className="space-y-1.5">
                        <span className="text-[7.5px] font-black uppercase tracking-wider opacity-45 block">
                          {state.settings.language === 'hi' 
                            ? 'त्वरित राशि चुनें (Quick Denomination):' 
                            : state.settings.language === 'mr' 
                              ? 'त्वरित मूल्यवर्ग (Quick Denomination):' 
                              : 'Select Quick Denomination:'}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {cashSuggestions.map((denom) => {
                            const isSelected = parseFloat(cashReceivedStr) === denom;
                            const isExactAmount = denom === total;
                            
                            return (
                              <button
                                type="button"
                                key={denom}
                                onClick={() => setCashReceivedStr(denom.toString())}
                                className={cn(
                                  "px-2.5 py-1.5 rounded-lg text-[9px] font-black transition-all cursor-pointer border shadow-xs select-none",
                                  isSelected
                                    ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600 font-black shadow-md scale-95"
                                    : isExactAmount
                                      ? "bg-amber-500/10 hover:bg-amber-500/15 text-amber-600 border-amber-500/20"
                                      : "bg-[var(--card)] border-[var(--border)] text-[var(--foreground)]/80 hover:border-blue-500/40"
                                )}
                              >
                                {isExactAmount ? (
                                  <span className="flex items-center gap-1">
                                    <Check size={9} strokeWidth={3} />
                                    Exact (₹{denom})
                                  </span>
                                ) : (
                                  `₹${denom}`
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Manual input */}
                      <div className="space-y-1">
                        <label className="text-[7.5px] font-black uppercase tracking-wider opacity-45 block">
                          {state.settings.language === 'hi' 
                            ? 'नगद राशि दर्ज करें (Manual Cash Input):' 
                            : state.settings.language === 'mr' 
                              ? 'रोख रक्कम प्रविष्ट करा (Manual Cash Input):' 
                              : 'Enter Manual Card/Cash:'}
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black opacity-40">₹</span>
                          <input
                             type="number"
                             step="any"
                             placeholder={state.settings.language === 'hi' ? "ग्राहक से प्राप्त नगद दर्ज करें..." : "Enter custom customer cash amount..."}
                             value={cashReceivedStr}
                             onChange={(e) => setCashReceivedStr(e.target.value)}
                             className="w-full pl-6 pr-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[11px] font-mono font-black text-[var(--foreground)] focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none shadow-inner"
                          />
                        </div>
                      </div>

                      {/* Dynamic instant return calculation display message */}
                      {cashReceivedStr !== '' && (() => {
                        const receivedAmt = parseFloat(cashReceivedStr);
                        if (isNaN(receivedAmt)) return null;

                        const changeToReturn = receivedAmt - total;
                        const isSufficient = changeToReturn >= 0;

                        return (
                          <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={cn(
                              "p-3 rounded-xl border flex flex-col items-center justify-center text-center space-y-1.5 shadow-sm transition-all duration-300",
                              isSufficient 
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" 
                                : "bg-rose-500/10 border-rose-500/35 text-rose-600 dark:text-rose-400 animate-pulse"
                            )}
                          >
                            {isSufficient ? (
                              <>
                                <span className="text-[8px] font-black uppercase tracking-widest opacity-75">
                                  💵 Cash Back Calculation
                                </span>
                                <span className="text-sm md:text-base font-black tracking-tight leading-none uppercase">
                                  Return ₹{formatNumber(changeToReturn, state.settings?.pricePrecision || 2)} change to customer
                                </span>
                                <span className="text-[7.5px] font-black opacity-60">
                                  Verified change amount • Safe checkout
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-[8px] font-black uppercase tracking-widest opacity-75">
                                  ⚠️ Insufficient Amount
                                </span>
                                <span className="text-[11px] font-extrabold tracking-tight leading-none uppercase">
                                  Remaining Due: ₹{formatNumber(Math.abs(changeToReturn), state.settings?.pricePrecision || 2)}
                                </span>
                                <span className="text-[7px] font-bold opacity-60">
                                  Request more cash balance from customer
                                </span>
                              </>
                            )}
                          </motion.div>
                        );
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Commit Checkout bill */}
            <div className="space-y-2">
              {state.settings.businessMode === 'restaurant' && (
                <button
                  onClick={dispatchRestaurantKOT}
                  disabled={cart.length === 0}
                  className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-35 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-wider cursor-pointer shadow-lg transition-all flex items-center justify-center gap-1.5"
                >
                  🍳 Dispatch KOT to Kitchen (किचन आर्डर)
                </button>
              )}
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-35 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-wider cursor-pointer shadow-lg transition-all"
              >
                💾 Save / Checkout (सुरक्षित करें)
              </button>
            </div>

          </div>

        </div>

        {/* DESKTOP/TABLET SIDE-BY-SIDE LIVE PREVIEW PANEL */}
        {showLivePreview && cart.length > 0 && (
          <div className="hidden lg:block lg:col-span-4 xl:col-span-4 animate-in slide-in-from-right-4 duration-300">
            {(() => {
              const discountAmount = (subtotal * discountPercent) / 100;
              const taxAmount = ((subtotal - discountAmount) * taxPercent) / 100;
              const total = subtotal - discountAmount + taxAmount;
              const isSufficient = (parseFloat(cashReceivedStr || '0') >= total) || paymentMethod !== 'Cash';
              
              const downloadLivePDF = () => {
                const doc = new jsPDF();
                doc.setFont("helvetica", "bold");
                doc.text(state.settings.storeName || "TS PRICE MANAGER", 20, 20);
                doc.setFontSize(10);
                doc.text(`Customer: ${customerName || 'Walk-in Customer'}`, 20, 30);
                doc.text(`Phone: ${customerPhone || 'N/A'}`, 20, 35);
                doc.text(`Payment: ${paymentMethod}`, 20, 40);
                doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 45);
                
                const rows = cart.map((ci, idx) => [
                  idx + 1,
                  ci.name,
                  ci.quantity,
                  `INR ${ci.price}`,
                  `INR ${ci.price * ci.quantity}`
                ]);
                
                autoTable(doc, {
                  startY: 50,
                  head: [['#', 'Item', 'Qty', 'Unit Price', 'Total']],
                  body: rows
                });
                
                const lastY = (doc as any).lastAutoTable?.finalY || 100;
                doc.text(`Subtotal: INR ${subtotal}`, 140, lastY + 10);
                doc.text(`Discount: ${discountPercent}%`, 140, lastY + 15);
                doc.text(`Tax: ${taxPercent}%`, 140, lastY + 20);
                doc.text(`Grand Total: INR ${total}`, 140, lastY + 25);
                
                doc.save(`Invoice_Draft_${Date.now()}.pdf`);
              };

              return (
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex flex-col justify-between h-[85vh] shadow-[0_10px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] overflow-hidden font-sans">
                  {/* Header with Layout Swapping */}
                  <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 select-none">
                    <div className="flex items-center gap-1.5 text-emerald-500 font-extrabold uppercase text-[8px] tracking-wider">
                      <ReceiptText size={12} className="animate-pulse" />
                      <span>Live Invoice Terminal</span>
                    </div>
                    <div className="flex bg-[var(--foreground)]/5 p-0.5 rounded-lg border border-[var(--border)] text-[7px] font-black uppercase gap-1">
                      <button
                        onClick={() => setLivePreviewTheme('thermal')}
                        className={cn(
                          "px-2 py-0.5 rounded transition-all cursor-pointer leading-none",
                          livePreviewTheme === 'thermal' ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]/50"
                        )}
                      >
                        Thermal Roll
                      </button>
                      <button
                        onClick={() => setLivePreviewTheme('laser')}
                        className={cn(
                          "px-2 py-0.5 rounded transition-all cursor-pointer leading-none",
                          livePreviewTheme === 'laser' ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]/50"
                        )}
                      >
                        A4 Laser
                      </button>
                    </div>
                  </div>

                  {/* Invoice Scroll Body */}
                  <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-4">
                    <div className={cn(
                      "transition-all duration-300 p-4 border border-[var(--border)] rounded-xl relative overflow-hidden text-left",
                      livePreviewTheme === 'thermal' 
                        ? "bg-zinc-50 text-zinc-950 dark:bg-zinc-100 dark:text-zinc-955 font-mono text-[9.5px] border-dashed border-zinc-300 shadow-inner"
                        : "bg-white text-zinc-805 font-sans text-xs shadow-md border-zinc-200"
                    )}>
                      {/* Watermark Logo */}
                      {livePreviewTheme === 'thermal' && (
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-200/20 to-transparent pointer-events-none" />
                      )}

                      {/* Store Information */}
                      <div className="text-center space-y-1 pb-3 border-b border-dashed border-zinc-300 select-none">
                        <h3 className={cn(
                          "font-black tracking-tight uppercase leading-none text-zinc-955 mb-1",
                          livePreviewTheme === 'laser' ? "text-sm text-[var(--primary)]" : "text-[11px]"
                        )}>
                          {state.settings.storeName || 'TS Price Manager'}
                        </h3>
                        <p className="opacity-70 text-[7.5px] uppercase tracking-wider font-extrabold text-zinc-600">
                          {state.settings.storeAddress || '101, Business Hub, Terminal C'}
                        </p>
                        <p className="opacity-70 text-[7.5px] font-mono text-zinc-600">
                          Phone: {state.settings.storePhone || '+91 9876543210'}
                        </p>
                      </div>

                      {/* Metadata */}
                      <div className="py-2 border-b border-dashed border-zinc-200 grid grid-cols-2 gap-1 text-[7.5px] font-bold text-zinc-600">
                        <div>
                          <p>BILL#: <span className="text-zinc-950 font-black">#DRAFT-{Date.now().toString().slice(-4)}</span></p>
                          <p>PAYMENT: <span className="text-zinc-950 font-black uppercase text-amber-600">{paymentMethod}</span></p>
                        </div>
                        <div className="text-right">
                          <p>DATE: {new Date().toLocaleDateString()}</p>
                          <p>TIME: {new Date().toLocaleTimeString()}</p>
                        </div>
                      </div>

                      {/* Customer credentials */}
                      {(customerName || customerPhone) && (
                        <div className="py-1.5 bg-zinc-50 border border-zinc-200 p-2 rounded-lg text-[8.5px] text-zinc-700 my-2">
                          <p className="font-extrabold text-[7.5px] uppercase opacity-45 tracking-wider mb-0.5 text-zinc-600">Customer details</p>
                          <p className="font-black text-zinc-950">{customerName || 'Walk-in Customer'}</p>
                          {customerPhone && <p className="font-semibold text-zinc-600">{customerPhone}</p>}
                          {paymentMethod === 'Credit' && (
                            <p className="text-rose-600 font-extrabold uppercase mt-1 text-[7.5px] animate-pulse">📅 DUE DATE: {udharDueDate}</p>
                          )}
                        </div>
                      )}

                      {/* Line items list */}
                      <div className="pt-2">
                        <div className="grid grid-cols-12 font-black uppercase border-b pb-1 mb-1 text-[7.5px] tracking-wide text-zinc-500">
                          <span className="col-span-6">Item Name</span>
                          <span className="col-span-2 text-center">Qty</span>
                          <span className="col-span-2 text-right">Rate</span>
                          <span className="col-span-2 text-right">Total</span>
                        </div>
                        <div className="space-y-1.5 max-h-[22vh] overflow-y-auto no-scrollbar">
                          {cart.map((ci) => (
                            <div
                              key={`std-receipt-${ci.id}`}
                              className="grid grid-cols-12 text-[8.5px] font-sans text-zinc-800 border-b border-dashed border-zinc-100 last:border-0 pb-1"
                            >
                              <span className="col-span-6 font-bold truncate text-zinc-900">{ci.name}</span>
                              <span className="col-span-2 text-center font-mono opacity-80 text-zinc-805">{ci.quantity} {ci.unit}</span>
                              <span className="col-span-2 text-right font-mono text-[8px] text-zinc-805">₹{ci.price}</span>
                              <span className="col-span-2 text-right font-black font-mono text-zinc-950">₹{ci.price * ci.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Summary calculations block */}
                      <div className="pt-2 border-t border-dashed border-zinc-350 space-y-1 mt-1">
                        <div className="flex justify-between items-center text-[8.5px] text-zinc-600 font-bold">
                          <span>Total ({cart.length} items):</span>
                          <span className="font-mono text-zinc-900">Subtotal: ₹{subtotal}</span>
                        </div>
                        {discountPercent > 0 && (
                          <div className="flex justify-between items-center text-[8.5px] font-bold text-emerald-650">
                            <span>Discount Given ({discountPercent}%):</span>
                            <span className="font-mono text-emerald-600">-₹{discountAmount.toFixed(2)}</span>
                          </div>
                        )}
                        {taxPercent > 0 && (
                          <div className="flex justify-between items-center text-[8.5px] font-semibold text-zinc-600">
                            <span>GST ({taxPercent}%):</span>
                            <span className="font-mono text-zinc-900">+₹{taxAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center bg-zinc-950 text-white p-2 rounded-lg mt-1 border border-zinc-800">
                          <span className="text-[7.5px] font-black tracking-widest text-amber-500 uppercase">PAYABLE</span>
                          <span className="text-xs font-black font-mono text-white">₹{formatNumber(total, precision)}</span>
                        </div>
                      </div>

                      {/* Barcode effect */}
                      <div className="pt-3 flex flex-col items-center select-none opacity-40">
                        <div className="flex items-center gap-[1px] h-4">
                          {[1,2,1,3,1,1,2,3,1,2,1,1,2,1,2,1,1,3,1,1].map((w, i) => (
                            <div key={i} className="bg-zinc-800 h-full" style={{ width: `${w}px` }} />
                          ))}
                        </div>
                        <p className="text-[6.5px] font-mono tracking-[0.25em] text-zinc-550 mt-1 uppercase">* TS-PM-DRAFT *</p>
                      </div>
                    </div>

                    {/* Quick Smart Alerts */}
                    <div className="space-y-1.5 text-left">
                      {!isSufficient && (
                        <div className="p-2 rounded-lg bg-orange-500/5 border border-orange-500/20 flex gap-2 items-center text-orange-600 text-[8px] font-semibold leading-tight">
                          <span>⚠️</span>
                          <span>The customer amount given is less than total checkout amount.</span>
                        </div>
                      )}
                      {discountPercent > 20 && (
                        <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/20 flex gap-2 items-center text-rose-600 text-[8px] font-semibold leading-tight">
                          <span>⚠️</span>
                          <span>High discount ({discountPercent}%) may hurt store margins. Verify.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="pt-2 border-t border-[var(--border)] flex gap-2">
                    <button
                      onClick={downloadLivePDF}
                      className="flex-1 py-1.5 text-[8.5px] font-black uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black rounded-lg border border-[var(--border)] flex items-center justify-center gap-1 cursor-pointer select-none"
                    >
                      <Download size={10} />
                      <span>Download PDF</span>
                    </button>
                    <button
                      onClick={handleCheckout}
                      className="flex-1 py-1.5 text-[8.5px] font-black uppercase tracking-wider bg-[var(--primary)] hover:opacity-90 text-white rounded-lg flex items-center justify-center gap-1 cursor-pointer select-none"
                    >
                      <Printer size={10} />
                      <span>Spool Checkout</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

      </div>

      {/* MOBILE EXPANDABLE CAPSLUE SUMMARY FOOTER BAR */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-18 left-4 right-4 z-40 bg-zinc-950/95 text-white p-3 rounded-full flex items-center justify-between border border-zinc-800 shadow-xl backdrop-blur-md">
          <div className="pl-4 text-left">
            <span className="text-[7.5px] font-black uppercase text-amber-500 tracking-wider leading-none">Active Bill</span>
            <p className="text-xs font-black font-mono leading-none mt-1">₹{formatNumber(total, precision)} ({cart.length} items)</p>
          </div>
          <button
            onClick={() => setMobilePreviewOpen(true)}
            className="px-4 py-1.5 bg-[var(--primary)] text-white text-[8px] font-black uppercase rounded-full tracking-widest shadow-md transition-all active:scale-95 flex items-center gap-1 shrink-0 cursor-pointer select-none"
          >
            <Eye size={10} />
            <span>View Draft</span>
          </button>
        </div>
      )}

      {/* MOBILE DRAWER SHEET SLIDE-UP */}
      <AnimatePresence>
        {mobilePreviewOpen && (
          <div className="fixed inset-0 z-[150] flex items-end justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobilePreviewOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-xs"
            />
            {/* Slide-Up container */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative z-10 w-full max-w-lg bg-[var(--card)] rounded-t-[2.5rem] border-t-2 border-[var(--primary)] p-4 max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col justify-between text-left"
            >
              <div className="w-12 h-1 bg-[var(--foreground)]/15 rounded-full mx-auto mb-4 cursor-pointer animate-pulse" onClick={() => setMobilePreviewOpen(false)} />
              
              {(() => {
                const discountAmount = (subtotal * discountPercent) / 100;
                const taxAmount = ((subtotal - discountAmount) * taxPercent) / 100;
                const totalVal = subtotal - discountAmount + taxAmount;
                const isSufficient = (parseFloat(cashReceivedStr || '0') >= totalVal) || paymentMethod !== 'Cash';
                
                const downloadLivePDF = () => {
                  const doc = new jsPDF();
                  doc.setFont("helvetica", "bold");
                  doc.text(state.settings.storeName || "TS PRICE MANAGER", 20, 20);
                  doc.setFontSize(10);
                  doc.text(`Customer: ${customerName || 'Walk-in Customer'}`, 20, 30);
                  doc.text(`Phone: ${customerPhone || 'N/A'}`, 20, 35);
                  doc.text(`Payment: ${paymentMethod}`, 20, 40);
                  doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 45);
                  
                  const rows = cart.map((ci, idx) => [
                    idx + 1,
                    ci.name,
                    ci.quantity,
                    `INR ${ci.price}`,
                    `INR ${ci.price * ci.quantity}`
                  ]);
                  
                  autoTable(doc, {
                    startY: 50,
                    head: [['#', 'Item', 'Qty', 'Unit Price', 'Total']],
                    body: rows
                  });
                  
                  const lastY = (doc as any).lastAutoTable?.finalY || 100;
                  doc.text(`Subtotal: INR ${subtotal}`, 140, lastY + 10);
                  doc.text(`Discount: ${discountPercent}%`, 140, lastY + 15);
                  doc.text(`Tax: ${taxPercent}%`, 140, lastY + 20);
                  doc.text(`Grand Total: INR ${totalVal}`, 140, lastY + 25);
                  
                  doc.save(`Invoice_Draft_${Date.now()}.pdf`);
                };

                return (
                  <div className="space-y-4 font-sans p-2">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--border)] select-none">
                      <span className="text-emerald-500 font-extrabold uppercase text-[9px] tracking-wider">Live Invoice Preview</span>
                      <div className="flex bg-[var(--foreground)]/5 p-0.5 rounded-lg border border-[var(--border)] text-[7px] font-black uppercase gap-1">
                        <button onClick={() => setLivePreviewTheme('thermal')} className={cn("px-2 py-0.5 rounded tracking-wide leading-none", livePreviewTheme === 'thermal' ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]/50")}>Thermal</button>
                        <button onClick={() => setLivePreviewTheme('laser')} className={cn("px-2 py-0.5 rounded tracking-wide leading-none", livePreviewTheme === 'laser' ? "bg-[var(--primary)] text-white" : "text-[var(--foreground)]/50")}>A4 Laser</button>
                      </div>
                    </div>

                    <div className={cn(
                      "transition-all duration-300 p-4 border border-[var(--border)] rounded-2xl relative overflow-hidden text-left",
                      livePreviewTheme === 'thermal' 
                        ? "bg-zinc-50 text-zinc-950 font-mono text-[9.5px] border-dashed border-zinc-300 shadow-inner"
                        : "bg-white text-zinc-800 font-sans text-xs border-zinc-200 shadow-md"
                    )}>
                      <div className="text-center space-y-1 pb-3 border-b border-dashed border-zinc-300 select-none">
                        <h3 className="font-black uppercase leading-none text-zinc-900 text-xs mb-1">{state.settings.storeName || 'TS Price Manager'}</h3>
                        <p className="opacity-70 text-[7px] uppercase tracking-wider font-extrabold text-zinc-500">{state.settings.storeAddress || '101, Business Hub, Terminal C'}</p>
                      </div>

                      <div className="py-2 border-b border-dashed border-zinc-200 grid grid-cols-2 gap-1 text-[7px] font-bold text-zinc-600 border-dashed">
                        <div>
                          <p>BILL#: <span className="text-zinc-950 font-black">#DRAFT-{Date.now().toString().slice(-4)}</span></p>
                          <p>PAYMENT: <span className="text-zinc-950 font-black uppercase text-amber-600">{paymentMethod}</span></p>
                        </div>
                        <div className="text-right">
                          <p>DATE: {new Date().toLocaleDateString()}</p>
                        </div>
                      </div>

                      <div className="pt-2">
                        <div className="grid grid-cols-12 font-black uppercase border-b pb-1 mb-1 text-[7px] tracking-wide text-zinc-500">
                          <span className="col-span-6">Item Name</span>
                          <span className="col-span-2 text-center">Qty</span>
                          <span className="col-span-4 text-right">Total</span>
                        </div>
                        <div className="space-y-1.5 max-h-[18vh] overflow-y-auto no-scrollbar">
                          {cart.map((ci) => (
                            <div key={`thermal-receipt-${ci.id}`} className="grid grid-cols-12 text-[8.5px] font-sans text-zinc-800 border-b border-dashed border-zinc-100 pb-1">
                              <span className="col-span-6 font-bold truncate">{ci.name}</span>
                              <span className="col-span-2 text-center font-mono">{ci.quantity}</span>
                              <span className="col-span-4 text-right font-black font-mono">₹{ci.price * ci.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-dashed border-zinc-300 space-y-1 mt-1">
                        <div className="flex justify-between items-center text-[8px] text-zinc-650 font-bold">
                          <span>Total ({cart.length} items):</span>
                          <span className="font-mono">Subtotal: ₹{subtotal}</span>
                        </div>
                        {discountPercent > 0 && (
                          <div className="flex justify-between items-center text-[8px] font-bold text-emerald-600">
                            <span>Discount Given ({discountPercent}%):</span>
                            <span className="font-mono">-₹{discountAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center bg-zinc-950 text-white p-2 rounded-lg mt-1 border border-zinc-800">
                          <span className="text-[7.5px] font-black text-amber-500">PAYABLE</span>
                          <span className="text-sm font-black font-mono">₹{formatNumber(totalVal, precision)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={downloadLivePDF} className="flex-1 py-1.5 text-[8.5px] font-black uppercase tracking-wider bg-slate-900 border text-white rounded-lg cursor-pointer">Download PDF</button>
                      <button onClick={() => { setMobilePreviewOpen(false); handleCheckout(); }} className="flex-1 py-1.5 text-[8.5px] font-black uppercase tracking-wider bg-[var(--primary)] text-white rounded-lg cursor-pointer">Invoice Finish</button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MANUAL ITEM NOT IN LIST ADDITION POPUP MODAL */}
      <AnimatePresence>
        {showManualModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowManualModal(false)}
              className="fixed inset-0 bg-black/65 backdrop-blur-xs"
            />
            {/* Form */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-10 w-full max-w-sm rounded-2xl bg-[var(--card)] p-4 border border-[var(--border)] shadow-2xl space-y-3"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <h3 className="font-black uppercase text-xs text-[var(--primary)] flex items-center gap-1">
                  <PackagePlus size={14} />
                  <span>Manual Item Not in List</span>
                </h3>
                <button
                  onClick={() => setShowManualModal(false)}
                  className="p-1 text-[10px] uppercase font-bold opacity-50 hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-0.5">
                  <label className="text-[8px] font-black uppercase opacity-60">Product ID / Name *</label>
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder={cleanAndValidateText("e.g. Fresh Mangoes (खुला माल)", currentLang, state.settings)}
                    className="w-full bg-[var(--foreground)]/5 border border-[var(--border)] px-3 py-2 rounded-xl text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)] font-bold uppercase"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-black uppercase opacity-60">{cleanAndValidateText("Price (दाम)", currentLang, state.settings)} *</label>
                    <input
                      type="number"
                      value={manualPrice}
                      onChange={(e) => setManualPrice(e.target.value)}
                      placeholder="₹ Rate"
                      className="w-full bg-[var(--foreground)]/5 border border-[var(--border)] px-3 py-2 rounded-xl text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)] font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-black uppercase opacity-60">Base Cost (लागत)</label>
                    <input
                      type="number"
                      value={manualCost}
                      onChange={(e) => setManualCost(e.target.value)}
                      placeholder="₹ Buy Cost"
                      className="w-full bg-[var(--foreground)]/5 border border-[var(--border)] px-3 py-2 rounded-xl text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)] font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-0.5">
                  <label className="text-[8px] font-black uppercase opacity-60">Unit (इकाई) *</label>
                  <input
                    type="text"
                    value={manualUnit}
                    onChange={(e) => setManualUnit(e.target.value)}
                    placeholder="e.g. Kg, Pcs, Bag"
                    className="w-full bg-[var(--foreground)]/5 border border-[var(--border)] px-3 py-2 rounded-xl text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)] font-bold"
                  />
                </div>

                <button
                  onClick={addManualItemToCart}
                  className="w-full py-2 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  Confirm & Add to Ticket
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INVOICE DETAIL VIEW POPUP (when clicking an item in bill history) */}
      <AnimatePresence>
        {activeBillDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setActiveBillDetail(null); setIsEditing(false); }}
              className="fixed inset-0 bg-black/65 backdrop-blur-xs"
            />
            
            <motion.div
              layout
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              className="relative z-10 w-full max-w-2xl rounded-3xl bg-[var(--background)] p-5 border border-[var(--border)] shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2 flex-wrap gap-2">
                <button
                  onClick={() => { setActiveBillDetail(null); setIsEditing(false); }}
                  className="text-[9px] font-black tracking-widest uppercase opacity-40 hover:opacity-100 cursor-pointer"
                >
                  ← Back to History
                </button>
                <div className="flex items-center gap-1 font-mono text-xs">
                  <span className="opacity-50 text-[9px] uppercase tracking-wider font-sans">INV CODE:</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[var(--primary)] text-white font-bold">
                    {activeBillDetail.billNumber}
                  </span>
                </div>
              </div>

              {isEditing ? (
                /* Edit Bill form */
                <div className="space-y-4 text-left">
                  <div className="p-3 bg-[var(--foreground)]/5 border border-[var(--border)] rounded-xl grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                      <label className="text-[8px] font-black uppercase opacity-60">Customer Name</label>
                      <input 
                        type="text"
                        value={editCustomerName}
                        onChange={(e) => setEditCustomerName(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[var(--card)] border border-[var(--border)] outline-none text-[var(--foreground)] uppercase font-semibold focus:border-[var(--primary)]"
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[8px] font-black uppercase opacity-60">Customer Phone</label>
                      <input 
                        type="text"
                        value={editCustomerPhone}
                        onChange={(e) => setEditCustomerPhone(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[var(--card)] border border-[var(--border)] outline-none text-[var(--foreground)] font-mono focus:border-[var(--primary)]"
                      />
                    </div>
                  </div>

                  {/* Line items modifications */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase tracking-wider opacity-45">Line items in bill</span>
                    <div className="border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)] bg-[var(--card)]">
                      {editCart.map(eci => (
                        <div key={eci.id} className="p-2.5 grid grid-cols-12 gap-2 text-xs items-center">
                          <div className="col-span-5 font-bold uppercase truncate">{eci.name}</div>
                          <div className="col-span-4 flex justify-center">
                            <EditCartQuantityInput
                              quantity={eci.quantity}
                              onChange={(newQty) => updateEditCartQuantity(eci.id, newQty)}
                              onDecrement={() => updateEditCartQuantity(eci.id, eci.quantity - 1)}
                              onIncrement={() => updateEditCartQuantity(eci.id, eci.quantity + 1)}
                            />
                          </div>
                          
                          <div className="col-span-2 text-right">
                            <input 
                              type="number"
                              value={eci.price}
                              onChange={(e) => {
                                const parseP = parseFloat(e.target.value) || 0;
                                setEditCart(editCart.map(c => c.id === eci.id ? { ...c, price: parseP } : c));
                              }}
                              className="w-16 px-1 text-right text-[10px] font-mono font-bold bg-[var(--card)] border border-[var(--border)] rounded"
                            />
                          </div>

                          <div className="col-span-1 text-center">
                            <button
                              onClick={() => setEditCart(editCart.filter(item => item.id !== eci.id))}
                              className="text-rose-500 hover:text-rose-700 font-black cursor-pointer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Add Loose Manual Item In Editor Form */}
                  <div className="p-2.5 bg-amber-500/[0.03] border border-amber-500/20 rounded-xl space-y-2">
                    <span className="text-[8px] font-black uppercase text-amber-500 font-mono tracking-wider block">Add Manual Item to Invoices</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      <input 
                        type="text" 
                        placeholder="Item Description" 
                        value={editManualName}
                        onChange={(e) => setEditManualName(e.target.value)}
                        className="col-span-2 px-2 py-1 text-[10px] bg-[var(--card)] border border-[var(--border)] rounded"
                      />
                      <input 
                        type="number" 
                        placeholder="₹ Price" 
                        value={editManualPrice}
                        onChange={(e) => setEditManualPrice(e.target.value)}
                        className="px-2 py-1 text-[10px] bg-[var(--card)] border border-[var(--border)] rounded font-mono"
                      />
                      <button
                        onClick={addManualItemToEditCart}
                        className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white font-black uppercase text-[8px] rounded cursor-pointer leading-tight"
                      >
                        + Append
                      </button>
                    </div>
                  </div>

                  {/* Summary updates */}
                  <div className="flex justify-between items-center border-t border-[var(--border)] pt-3 flex-wrap gap-2 select-none">
                    <div className="flex bg-[var(--foreground)]/5 rounded-lg border border-[var(--border)] p-0.5 text-[8px] font-black uppercase">
                      {['Cash', 'UPI', 'Credit'].map(mode => (
                        <button
                          key={mode}
                          onClick={() => setEditPaymentMethod(mode as any)}
                          className={cn(
                            "px-2 py-1 rounded transition-all cursor-pointer",
                            editPaymentMethod === mode ? "bg-[var(--primary)] text-white shadow" : "text-[var(--foreground)]/50"
                          )}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-1.5 rounded-lg border border-[var(--border)] text-[9px] font-bold"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={saveEditedBillInvoice}
                        className="px-4 py-1.5 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-lg shadow cursor-pointer flex items-center gap-1"
                      >
                        <Save size={10} /> Save Changes
                      </button>
                    </div>
                  </div>

                </div>
              ) : (
                /* Read Detailed receipt */
                <div className="space-y-4 text-left select-none">
                  
                  {/* Logistics Header */}
                  <div className="p-3 bg-[var(--foreground)]/[0.02] border border-[var(--border)] rounded-2xl grid grid-cols-2 gap-2 text-xs font-sans">
                    <div>
                      <span className="text-[7.5px] font-black uppercase opacity-40">Invoice Client:</span>
                      <p className="font-extrabold text-sm uppercase leading-tight mt-0.5">{activeBillDetail.customerName || 'Walk-In Customer'}</p>
                      {activeBillDetail.customerPhone && (
                        <p className="text-[9px] font-mono text-[var(--primary)] font-bold mt-1 flex items-center gap-1">
                          <Phone size={9} /> {activeBillDetail.customerPhone}
                        </p>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <span className="text-[7.5px] font-black uppercase opacity-40">Invoice Summary:</span>
                      <p className="font-bold opacity-80 text-[10px] mt-0.5 leading-none">{new Date(activeBillDetail.timestamp).toLocaleString()}</p>
                      <p className="text-[9px] font-mono font-black text-amber-500 uppercase mt-2">
                        METHOD: <span className="underline">{activeBillDetail.paymentMethod}</span>
                      </p>
                    </div>
                  </div>

                  {/* List items visual */}
                  <div className="border border-[var(--border)] rounded-2xl overflow-hidden bg-[var(--card)]">
                    <div className="grid grid-cols-4 px-3 py-1.5 bg-[var(--foreground)]/5 text-[8.5px] font-black uppercase opacity-55">
                      <div className="col-span-2">Item Detail</div>
                      <div className="text-center">Quantity</div>
                      <div className="text-right">Line Total</div>
                    </div>
                    <div className="divide-y divide-[var(--border)]">
                      {activeBillDetail.items.map((it, idx) => (
                        <div key={idx} className="grid grid-cols-4 px-3 py-2 text-[11px] items-center">
                          <div className="col-span-2">
                            <span className="font-extrabold uppercase">{it.name}</span>
                            <p className="text-[8px] opacity-45 font-mono mt-0.5">Rate: ₹{it.price} / {it.unit}</p>
                          </div>
                          <div className="text-center font-mono font-bold text-[var(--foreground)]/70">{it.quantity} {it.unit}</div>
                          <div className="text-right font-black text-[var(--primary)] font-mono">₹{(it.price * it.quantity).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Subtotals mapping */}
                  <div className="flex flex-col items-end text-right font-mono text-[10px] space-y-1">
                    <div className="flex justify-between w-52 opacity-65">
                      <span>Subtotal :</span>
                      <span>₹{activeBillDetail.subtotal.toFixed(2)}</span>
                    </div>
                    {activeBillDetail.discount > 0 && (
                      <div className="flex justify-between w-52 text-emerald-500 font-bold">
                        <span>Discount ({activeBillDetail.discount}%) :</span>
                        <span>-₹{((activeBillDetail.subtotal * activeBillDetail.discount) / 100).toFixed(2)}</span>
                      </div>
                    )}
                    {activeBillDetail.tax > 0 && (
                      <div className="flex justify-between w-52 text-rose-500 font-bold">
                        <span>Tax GST ({activeBillDetail.tax}%) :</span>
                        <span>+₹{(((activeBillDetail.subtotal - (activeBillDetail.subtotal * activeBillDetail.discount / 100)) * activeBillDetail.tax) / 100).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between w-52 text-base font-black pt-1.5 mt-1 border-t border-[var(--border)] select-text">
                      <span className="font-sans text-[8.5px] uppercase tracking-wide opacity-45 self-center">Grand Total:</span>
                      <span className="text-[var(--primary)] select-all font-mono">₹{activeBillDetail.total.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Operational actions */}
                  <div className="flex items-center justify-between border-t border-[var(--border)] pt-3 flex-wrap gap-2 leading-none">
                    
                    <button
                      onClick={() => deleteBillInvoice(activeBillDetail)}
                      className="px-3.5 py-1.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-500 hover:bg-rose-500 hover:text-white transition-all text-[9px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer select-none"
                    >
                      <Trash size={10} /> Delete Bill
                    </button>

                    <div className="flex gap-1.5">
                      <button
                        onClick={() => downloadBillPdf(activeBillDetail)}
                        className="px-3 py-1.5 bg-[var(--primary)] text-white text-[9px] font-black uppercase rounded-lg shadow flex items-center gap-1 cursor-pointer select-none"
                      >
                        <Download size={10} /> PDF Download
                      </button>

                      <button
                        onClick={() => startEditingSavedInvoice(activeBillDetail)}
                        className="px-3.5 py-1.5 bg-orange-500 text-white text-[9px] font-black uppercase rounded-lg shadow flex items-center gap-1 cursor-pointer select-none"
                      >
                        <Edit2 size={10} /> Edit / Change
                      </button>
                    </div>

                  </div>

                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 24-HOUR CLEANUP HIGHLIGHTED POPUP DIALOG */}
      <AnimatePresence>
        {showCleanupDialog && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCancelCleanup}
              className="fixed inset-0 bg-black/70 backdrop-blur-xs cursor-pointer"
            />
            
            <motion.div
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              className="bg-[var(--card)] border border-amber-500/30 rounded-2xl p-5 shadow-2xl max-w-sm w-full space-y-4 text-left relative z-55"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 shrink-0">
                  <Clock size={20} className="animate-spin-slow" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-black uppercase tracking-wider text-amber-500">
                    24-hour period completed
                  </h3>
                  <p className="text-[10.5px] leading-relaxed opacity-80">
                    To maintain maximum billing speeds and clear cache, database recommends flushing <strong className="text-amber-500">{olderThan24HoursBills.length} invoices</strong> older than 24 hours.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[var(--foreground)]/5 rounded-xl border border-[var(--border)] text-[9px] font-bold opacity-70 leading-relaxed">
                💡 Clicking <strong>Delete & Save PDF</strong> compiles a business-grade A4 backup of these bills before deleting them securely from Firebase.
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleCancelCleanup}
                  className="flex-1 py-2 px-3 border border-[var(--border)] hover:bg-[var(--foreground)]/5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer text-center"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAndSavePdf}
                  className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer shadow-lg flex items-center justify-center gap-1.5"
                >
                  <Download size={11} />
                  <span>Delete & Save PDF</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* COMPLETED TRANSACTION PRINTER OVERLAY MODAL */}
      <AnimatePresence>
        {completedBill && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 30, opacity: 0 }}
              className="relative w-full max-w-md bg-[var(--background)] border-2 border-[var(--border)] rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[101] text-center space-y-6 overflow-hidden flex flex-col justify-between"
            >
              {/* Pulse checkmark banner */}
              <div className="space-y-2 mt-2">
                <div className="mx-auto h-16 w-16 bg-emerald-500/10 border-2 border-emerald-500 text-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                  <Check size={32} className="stroke-[3.5px]" />
                </div>
                <h3 className="font-extrabold text-lg uppercase tracking-tight text-emerald-400">Invoice Saved Successfully</h3>
                <p className="text-[10px] uppercase font-bold tracking-widest opacity-50 font-mono">Invoice Reference #${completedBill.billNumber}</p>
              </div>

              {/* Data panel */}
              <div className="p-4 bg-[var(--foreground)]/[0.02] border border-[var(--border)] rounded-2xl text-left space-y-3 font-medium">
                <div className="flex justify-between text-xs pb-2 border-b border-dashed border-[var(--border)]">
                  <span className="opacity-60 uppercase font-black text-[9px] tracking-wider">Client Name:</span>
                  <span className="font-black">{completedBill.customerName || 'Walk-In Guest'}</span>
                </div>
                {completedBill.customerPhone && (
                  <div className="flex justify-between text-xs pb-2 border-b border-dashed border-[var(--border)]">
                    <span className="opacity-60 uppercase font-black text-[9px] tracking-wider">Mobile Number:</span>
                    <span className="font-mono">{completedBill.customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs pb-2 border-b border-dashed border-[var(--border)]">
                  <span className="opacity-60 uppercase font-black text-[9px] tracking-wider">Payment Method:</span>
                  <span className="font-black uppercase tracking-wider text-[var(--primary)]">{completedBill.paymentMethod}</span>
                </div>
                
                {/* Grand Total */}
                <div className="flex justify-between items-center pt-2 text-[var(--foreground)]">
                  <span className="font-black uppercase text-[10px] tracking-widest">Grand Total:</span>
                  <span className="text-2xl font-black font-mono text-emerald-500">₹{completedBill.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Action buttons (Tapping print invokes print) */}
              <div className="grid grid-cols-1 gap-2.5">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (navigator.vibrate) navigator.vibrate(15);
                      const savedConfig = localStorage.getItem('price_manager_printer_config');
                      let config = DEFAULT_PRINT_SETTINGS;
                      if (savedConfig) {
                        try {
                          config = { ...DEFAULT_PRINT_SETTINGS, ...JSON.parse(savedConfig) };
                        } catch(e){}
                      }
                      const copies = config.duplicateCopies || 1;
                      for (let c = 0; c < copies; c++) {
                        await printerService.printViaSystem(completedBill, config);
                      }
                    } catch (e: any) {
                      alert(`Spool Error: ${e.message}`);
                    }
                  }}
                  className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 font-extrabold text-white text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 hover:translate-y-[-1px] transition-all cursor-pointer"
                >
                  <Printer size={16} />
                  Print Thermal Receipt / बिल निकालें
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => downloadBillPdf(completedBill)}
                    className="py-2.5 rounded-xl border border-[var(--border)] bg-[var(--foreground)]/[0.02] hover:bg-[var(--foreground)]/[0.05] text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Download size={13} />
                    Download PDF
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const text = `Hi, here is your thermal invoice reference #${completedBill.billNumber} from TS Price Manager. Amount Paid: ₹${completedBill.total.toFixed(2)}. Visit Again!`;
                      const phoneSanitized = completedBill.customerPhone ? completedBill.customerPhone.replace(/[\s\+\-]/g, '') : '';
                      const url = `https://api.whatsapp.com/send?phone=${phoneSanitized}&text=${encodeURIComponent(text)}`;
                      window.open(url, '_blank');
                    }}
                    className="py-2.5 rounded-xl border border-[var(--border)] bg-[var(--foreground)]/[0.02] hover:bg-[var(--foreground)]/[0.05] text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Share2 size={13} className="text-sky-500" />
                    WhatsApp Share
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(25);
                    setCompletedBill(null);
                  }}
                  className="w-full py-3 rounded-xl border border-dashed border-[var(--border)] hover:bg-[var(--foreground)]/5 text-[10.5px] font-black uppercase tracking-widest text-[var(--foreground)] inline-block transition-all mt-2 cursor-pointer"
                >
                  ➕ Close & Start New Bill / अगला बिल
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🔍 LIGHTWEIGHT OPTIONAL PRINT PREVIEW SYSTEM MODAL */}
      <AnimatePresence>
        {showPrintPreview && previewBillData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPrintPreview(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-xs"
            />

            {/* Preview Sheet */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="relative w-full max-w-sm bg-[var(--background)] border border-[var(--border)] rounded-[2rem] p-5 shadow-2xl z-10 flex flex-col justify-between space-y-4 max-h-[90vh]"
            >
              {/* Layout Header */}
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                <div className="flex items-center gap-1.5 font-black">
                  <ReceiptText size={15} className="text-[var(--primary)] shrink-0" />
                  <span className="text-xs font-black uppercase tracking-wider">Checkout Ticket Preview</span>
                </div>
                <button
                  onClick={() => setShowPrintPreview(false)}
                  className="p-1 hover:bg-[var(--foreground)]/5 rounded-lg text-[9.5px] font-black text-rose-500 uppercase cursor-pointer"
                >
                  Cancel ❌
                </button>
              </div>

              {/* Scrollable Receipt Body Roll */}
              <div className="flex-1 overflow-y-auto pr-0.5 space-y-2.5 max-h-[50vh] scrollbar-thin">
                <span className="text-[8.5px] font-black uppercase text-gray-400 block tracking-widest text-center leading-none">
                  Simulated Receipt (रसीद का दृश्य):
                </span>
                
                <div className="border-2 border-[var(--border)] rounded-2xl bg-white shadow-inner overflow-hidden p-0.5 flex flex-col items-center relative">
                  <iframe
                    className="w-full bg-white transition-all duration-300"
                    style={{
                      height: '240px',
                      border: 'none',
                    }}
                    srcDoc={printerService.generateReceiptHtml(previewBillData, printSettings)}
                    title="Live Render Page Frame"
                  />
                  {/* Cutter line */}
                  <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-zinc-100 to-transparent pointer-events-none flex justify-center items-center font-mono text-[7px] text-zinc-400 select-none">
                    <span>✀ - - - - Tear line - - - -</span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions Selector */}
              <div className="space-y-2 border-t border-[var(--border)] pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleConfirmCheckout(true)}
                    className="py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 font-extrabold text-white text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg active:translate-y-[1px] cursor-pointer transition-all"
                  >
                    <Printer size={14} />
                    Confirm & Print ✔
                  </button>

                  <button
                    onClick={() => handleConfirmCheckout(false)}
                    className="py-3 rounded-2xl bg-[var(--primary)] text-white font-extrabold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-lg active:translate-y-[1px] cursor-pointer transition-all"
                  >
                    <Save size={14} />
                    Save Only (नो-प्रिंट)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => downloadBillPdf(previewBillData)}
                    className="py-2.5 rounded-xl border border-[var(--border)] text-[9px] font-black uppercase tracking-wider hover:bg-[var(--foreground)]/5 flex items-center justify-center gap-1 cursor-pointer transition-all"
                  >
                    <Download size={12} />
                    Download PDF
                  </button>

                  <button
                    onClick={() => setShowPrintPreview(false)}
                    className="py-2.5 rounded-xl border border-[var(--border)] text-[9px] font-black uppercase tracking-wider hover:bg-rose-500/10 text-rose-500 flex items-center justify-center gap-1 cursor-pointer transition-all"
                  >
                    Cancel / Edit
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🎰 PREMIUM IMMERSIVE POS SIMULATED PRINT SLOT ANIMATION LAYER */}
      <AnimatePresence>
        {isAnimatingPrint && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "w-full max-w-sm bg-neutral-900 border rounded-[2.5rem] p-6 text-center space-y-6 shadow-2xl relative overflow-hidden transition-all duration-300",
                animationStep === 'success' 
                  ? "shadow-[0_0_50px_rgba(16,185,129,0.25)] border-emerald-500/30" 
                  : "border-neutral-800"
              )}
            >
              <div className="space-y-1">
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block">Hardware Transmitter Active</span>
                <h4 className="text-sm font-black text-white uppercase tracking-tight">Spooling Thermal Invoice</h4>
              </div>

              {/* Virtual POS Device Slot representation */}
              <div className="relative h-44 bg-neutral-950 rounded-2xl border border-neutral-800 p-2 flex flex-col items-center justify-end overflow-hidden shadow-inner">
                {/* Simulated Paper feed mouth */}
                <div className="absolute top-8 left-1/2 -translate-x-1/2 w-48 h-3.5 bg-neutral-900 rounded-full border-b border-neutral-700 z-20 flex items-center justify-center">
                  <div className="w-44 h-1 bg-black rounded-full shadow-[0_1px_2px_rgba(255,255,255,0.1)]"></div>
                </div>

                {/* Sliding Receipt Slip */}
                <motion.div 
                  initial={{ y: 90, opacity: 0.3 }}
                  animate={{ 
                    y: animationStep === 'sliding' ? -15 : -35,
                    opacity: 1
                  }}
                  transition={{ duration: 1.1, ease: 'easeOut' }}
                  className="w-40 bg-white text-black p-3.5 shadow-2xl rounded-t-lg z-10 flex flex-col justify-start text-left space-y-2 border-t border-b border-dashed border-zinc-300 font-mono text-[6px]"
                >
                  <div className="text-center font-black uppercase text-[7px] leading-none mb-1">
                    {printSettings.storeName || 'TS Price Manager'}
                  </div>
                  <div className="flex justify-between border-b pb-1 font-bold">
                    <span>{previewBillData?.billNumber || 'INV-1024'}</span>
                    <span>{new Date().toLocaleTimeString()}</span>
                  </div>
                  <div className="space-y-1 min-h-[50px]">
                    <div className="flex justify-between font-bold">
                      <span>Item</span>
                      <span>Amt</span>
                    </div>
                    {previewBillData?.items?.slice(0, 3).map((it: any, i: number) => (
                      <div key={i} className="flex justify-between opacity-75">
                        <span className="truncate max-w-[70px]">{it.name}</span>
                        <span>₹{it.price * it.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-dashed pt-1 flex justify-between font-extrabold text-[8px] text-zinc-900">
                    <span>Total Paid</span>
                    <span>₹{previewBillData?.total.toFixed(2)}</span>
                  </div>
                </motion.div>
                
                {/* Virtual bottom cutter teeth decoration */}
                <div className="absolute top-[38px] left-1/2 -translate-x-1/2 w-48 text-[8px] text-zinc-600 font-mono tracking-widest z-30 select-none text-center pointer-events-none opacity-40">
                  ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲
                </div>
              </div>

              {/* Status footer with nice progress indicators */}
              <div className="space-y-4 pt-1">
                {animationStep === 'sliding' ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2 text-amber-500 font-bold text-xs uppercase animate-pulse">
                      <RefreshCw className="animate-spin" size={14} />
                      <span>Feeding Paper...</span>
                    </div>
                    <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 1.25, ease: 'linear' }}
                        className="h-full bg-emerald-500"
                      />
                    </div>
                  </div>
                ) : (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="space-y-1.5"
                  >
                    <div className="text-emerald-500 font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-1">
                      <Check size={16} className="text-emerald-500 stroke-[3px]" />
                      <span>Printed Successfully!</span>
                    </div>
                    <p className="text-[10px] text-zinc-400">Collect paper roll receipt from POS cutter mouth</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🔮 CUSTOM PROMPT COMPONENT */}
      <AnimatePresence>
        {customPrompt && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCustomPrompt(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ scale: 0.9, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 15, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="relative w-full max-w-sm bg-[var(--card)] border border-[var(--border)] rounded-[2rem] p-6 shadow-2xl overflow-hidden text-[var(--foreground)]"
            >
              <div className="absolute top-0 left-1/4 h-24 w-40 bg-[var(--primary)]/10 rounded-full blur-2xl pointer-events-none" />

              <div className="space-y-4 relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center font-bold">
                    <Edit2 size={15} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight">{customPrompt.title}</h3>
                    <p className="text-[8px] font-bold text-[var(--primary)] uppercase tracking-widest mt-0.5">Prompt Dialogue</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-[var(--foreground)]/70 uppercase tracking-wide">
                    {customPrompt.message}
                  </p>
                  
                  <input
                    type="text"
                    value={promptInput}
                    placeholder={customPrompt.placeholder || "Enter value..."}
                    autoFocus
                    onChange={(e) => setPromptInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        customPrompt.onConfirm(promptInput);
                        setCustomPrompt(null);
                      } else if (e.key === 'Escape') {
                        setCustomPrompt(null);
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-[var(--foreground)]/[0.03] border border-[var(--border)] rounded-xl text-xs font-semibold focus:outline-none focus:border-[var(--primary)] text-[var(--foreground)] transition-all"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    onClick={() => setCustomPrompt(null)}
                    className="px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider text-[var(--foreground)]/60 hover:bg-[var(--foreground)]/5 transition-all cursor-pointer"
                  >
                    {customPrompt.cancelText || "Cancel"}
                  </button>

                  <button
                    onClick={() => {
                      customPrompt.onConfirm(promptInput);
                      setCustomPrompt(null);
                    }}
                    className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer active:scale-95 shadow-md shadow-[var(--primary)]/20"
                  >
                    {customPrompt.confirmText || "Save Changes"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🔮 CUSTOM CONFIRM COMPONENT */}
      <AnimatePresence>
        {customConfirm && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCustomConfirm(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ scale: 0.9, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 15, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className={cn(
                "relative w-full max-w-sm bg-[var(--card)] border rounded-[2rem] p-6 shadow-2xl overflow-hidden text-[var(--foreground)] transition-all duration-300",
                customConfirm.isDestructive ? "border-red-500/30 font-bold" : "border-[var(--border)]"
              )}
            >
              <div className={cn(
                "absolute top-0 left-1/4 h-24 w-40 rounded-full blur-2xl pointer-events-none",
                customConfirm.isDestructive ? "bg-red-500/10" : "bg-[var(--primary)]/10"
              )} />

              <div className="space-y-4 relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "h-8 w-8 rounded-xl flex items-center justify-center font-bold",
                    customConfirm.isDestructive ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-500"
                  )}>
                    <Trash2 size={15} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-tight">{customConfirm.title}</h3>
                    <p className={cn(
                      "text-[8px] font-bold uppercase tracking-widest mt-0.5",
                      customConfirm.isDestructive ? "text-red-500" : "text-amber-500"
                    )}>
                      {customConfirm.isDestructive ? "Destructive Operation" : "Verification Panel"}
                    </p>
                  </div>
                </div>

                <p className="text-[11px] font-semibold text-[var(--foreground)]/70 uppercase tracking-wide leading-normal">
                  {customConfirm.message}
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    onClick={() => setCustomConfirm(null)}
                    className="px-4 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider text-[var(--foreground)]/60 hover:bg-[var(--foreground)]/5 transition-all cursor-pointer"
                  >
                    {customConfirm.cancelText || "Cancel"}
                  </button>

                  <button
                    onClick={() => {
                      customConfirm.onConfirm();
                      setCustomConfirm(null);
                    }}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer active:scale-95 shadow-md",
                      customConfirm.isDestructive 
                        ? "bg-red-500 text-white hover:bg-red-500/90 shadow-red-500/20" 
                        : "bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 shadow-[var(--primary)]/20"
                    )}
                  >
                    {customConfirm.confirmText || "Confirm"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🔮 CUSTOM TOASTS STACK */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              key={toast.id}
              className={cn(
                "p-3.5 rounded-xl border flex items-center gap-3 shadow-lg pointer-events-auto",
                toast.type === 'success' ? "bg-emerald-500 hover:bg-emerald-600 border-emerald-500/20 text-white text-[11px] font-black uppercase tracking-wide" :
                toast.type === 'error' ? "bg-red-500 hover:bg-red-600 border-red-500/20 text-white text-[11px] font-black uppercase tracking-wide" :
                toast.type === 'warning' ? "bg-amber-500 hover:bg-amber-600 border-amber-500/20 text-white text-[11px] font-black uppercase tracking-wide" :
                "bg-[var(--card)] border-[var(--border)] text-[var(--foreground)] text-[11px] font-bold uppercase tracking-wide"
              )}
            >
              <div className="shrink-0 flex items-center justify-center h-5 w-5 rounded-full bg-white/10 text-white">
                {toast.type === 'success' ? <Check size={12} className="stroke-[3px]" /> :
                 toast.type === 'error' ? <X size={12} className="stroke-[3px]" /> :
                 toast.type === 'warning' ? <Trash2 size={12} /> :
                 <Sparkles size={11} />}
              </div>
              <span className="flex-1 leading-normal">{toast.message}</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setToasts(prev => prev.filter(t => t.id !== toast.id));
                }}
                className="text-[9px] font-bold text-white/40 hover:text-white cursor-pointer"
              >
                DISMISS
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 👨‍🍳 KITCHEN ORDER TICKET (KOT) SIMULATOR DIALOG */}
      <AnimatePresence>
        {showKotDetails && kotData && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Dark glass backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowKotDetails(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />
            
            {/* Thermal Slip Card */}
            <motion.div
              initial={{ scale: 0.93, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.93, y: 30, opacity: 0 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-10 flex flex-col justify-between space-y-4 max-h-[92vh] overflow-hidden text-white"
            >
              {/* Header division icon */}
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-1.5 font-black text-orange-500">
                  <span className="text-lg font-bold">👨‍🍳</span>
                  <span className="text-xs font-black uppercase tracking-widest text-orange-400">Kitchen Order Dispatcher</span>
                </div>
                <button
                  onClick={() => setShowKotDetails(false)}
                  className="px-2.5 py-1 hover:bg-neutral-800 rounded-lg text-[8.5px] font-black text-rose-500 uppercase cursor-pointer"
                >
                  DISMISS
                </button>
              </div>

              {/* simulated KOT thermal receipt */}
              <div className="flex-1 overflow-y-auto pr-0.5 space-y-2 max-h-[52vh] scrollbar-thin">
                <span className="text-[8px] font-black uppercase text-zinc-500 text-center block tracking-widest leading-none mb-2">
                  Kitchen Thermal Printer Output spool
                </span>

                {/* Thermal card container */}
                <div className="bg-white text-zinc-900 font-mono text-[10.5px] p-5 rounded-2xl shadow-inner relative select-none leading-relaxed">
                  {/* Jagged cutter top */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-300 via-transparent to-transparent opacity-80" />

                  <div className="text-center font-black text-[13px] uppercase tracking-tight text-neutral-950 pb-1 border-b border-dashed border-zinc-300">
                    KITCHEN COPY (KOT)
                  </div>

                  <div className="flex justify-between font-black text-[15px] uppercase text-indigo-600 font-sans mt-3">
                    <span>{kotData.table}</span>
                    <span>{kotData.ticketNo}</span>
                  </div>

                  <div className="text-[8px] text-zinc-400 mt-0.5 pb-2.5 border-b border-dashed border-zinc-300 flex justify-between font-bold">
                    <span>STAFF OPERATOR</span>
                    <span>{kotData.timestamp}</span>
                  </div>

                  {/* items table list */}
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-[8px] font-black text-zinc-400 pb-1 border-b border-zinc-200">
                      <span>QTY & ITEM NAME / डिश</span>
                      <span className="text-right">COMMENTS</span>
                    </div>

                    {kotData.items.map((it: any, index: number) => (
                      <div key={index} className="space-y-0.5 pb-1.5 border-b border-dashed border-zinc-100 last:border-none">
                        <div className="flex justify-between font-black text-zinc-950 leading-tight">
                          <span className="text-[12px] font-semibold text-neutral-900 font-mono">
                            {it.quantity}x <span className="font-sans font-extrabold uppercase">{it.name}</span>
                          </span>
                        </div>
                        {it.cookingInstructions ? (
                          <div className="text-[8px] font-black text-orange-600 bg-orange-100 border border-orange-200 px-1.5 py-0.5 rounded inline-block max-w-[240px] leading-tight">
                            👨‍🍳 COMMENT: {it.cookingInstructions}
                          </div>
                        ) : (
                          <div className="text-[7px] text-zinc-400 italic">No notes</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Simulated Tear line at bottom */}
                  <div className="pt-3 border-t border-dashed border-zinc-300 text-center text-[7px] text-zinc-400 select-none font-bold mt-4">
                    ✂- - - Dispatch to Hot Plate chef - - -
                  </div>
                </div>
              </div>

              {/* Bottom operational actions */}
              <div className="pt-2 border-t border-neutral-800 space-y-2">
                <button
                  onClick={() => {
                    setShowKotDetails(false);
                    addToast("KOT queued for local printing!", "success");
                  }}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[10.5px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/10 cursor-pointer active:translate-y-[1px] transition-all"
                >
                  📡 Send to Kot Spooler / प्रिंट करें
                </button>
                <p className="text-[7.5px] text-center text-zinc-500 font-black uppercase tracking-widest leading-none pt-1 select-none">
                  KOT queues directly to kitchen hot table printer
                </p>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Pop-up Rate Edit Modal (Requirement 3) */}
      <AnimatePresence>
        {editingRateItem && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
            {/* Dark glass backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingRateItem(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm bg-[var(--card)] border border-[var(--border)] rounded-[2rem] p-6 shadow-2xl z-10 flex flex-col space-y-4"
            >
              <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                <h4 className="text-xs font-black uppercase tracking-tight text-[var(--foreground)] flex items-center gap-1.5">
                  <span>Modify Rate / मूल्य संशोधन</span>
                </h4>
                <button 
                  onClick={() => setEditingRateItem(null)}
                  className="h-6 w-6 rounded-md bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)]/60 hover:text-[var(--foreground)] flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X size={12} />
                </button>
              </div>

              <div>
                <p className="text-[9px] uppercase font-black opacity-55">Item Name</p>
                <p className="text-xs font-black text-[var(--foreground)] tracking-tight uppercase">{editingRateItem.name}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-1">
                <div>
                  <p className="text-[9px] uppercase font-black opacity-55">Current Rate</p>
                  <p className="text-xs font-mono font-bold text-[var(--foreground)]">₹{formatNumber(editingRateItem.currentPrice, precision)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase font-black opacity-55">New Billing Rate</p>
                  <input 
                    type="number"
                    step="any"
                    autoFocus
                    className="w-full bg-[var(--foreground)]/[0.03] border border-[var(--border)] rounded-lg py-1 px-2 text-xs font-sans font-black text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                    value={editingRateItem.newPrice}
                    onChange={(e) => setEditingRateItem({ ...editingRateItem, newPrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/15 text-[9px] font-semibold text-[var(--foreground)]/80 leading-relaxed uppercase tracking-wider">
                ⚠️ Choose if you want to apply this rate temporarily (for this bill only) or permanently update the item rate in the main store catalog.
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    // Update cart temporarily
                    setCart(prev => prev.map(item => {
                      if (item.id === editingRateItem.id) {
                        return { ...item, price: editingRateItem.newPrice };
                      }
                      return item;
                    }));
                    addToast("Applied rate temporarily for this invoice!", "info");
                    setEditingRateItem(null);
                  }}
                  className="py-2.5 px-3 bg-[var(--foreground)]/5 border border-[var(--border)] rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-[var(--foreground)]/10 text-[var(--foreground)] hover:border-[var(--foreground)]/20 active:scale-95 transition-all cursor-pointer text-center"
                >
                  Temporary / अस्थायी
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Update cart
                    setCart(prev => prev.map(item => {
                      if (item.id === editingRateItem.id) {
                        return { ...item, price: editingRateItem.newPrice };
                      }
                      return item;
                    }));
                    
                    // Update in main database permanently if not manual
                    if (!editingRateItem.isManual) {
                      savePricePermanently(editingRateItem.id, editingRateItem.newPrice);
                    } else {
                      addToast("Applied rate; manual items cannot be saved to catalog permanently.", "warning");
                    }
                    setEditingRateItem(null);
                  }}
                  className="py-2.5 px-3 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white rounded-xl text-[9px] font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer text-center"
                >
                  Permanent / स्थायी
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <GoogleContactPickerModal
        isOpen={isGoogleContactModalOpen}
        onClose={() => setIsGoogleContactModalOpen(false)}
        onSelectContact={(contact) => {
          setCustomerName(contact.name);
          setCustomerPhone(contact.phone);
          setIsGoogleContactModalOpen(false);
          addToast(`Imported ${contact.name} successfully!`, 'success');
        }}
      />

      {/* Floating Sparkle Micro-animation Particles trigger */}
      <div className="fixed inset-0 pointer-events-none z-[99999] overflow-hidden">
        <AnimatePresence>
          {additionAnims.map((anim) => (
            <motion.div
              key={anim.id}
              initial={{ opacity: 1, scale: 0.6, x: anim.x - 60, y: anim.y - 20 }}
              animate={{ 
                opacity: [1, 1, 0], 
                scale: [0.8, 1.25, 1], 
                y: anim.y - 180, 
                x: anim.x - 60 + (Math.sin(anim.y) * 40)
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.95, ease: "easeOut" }}
              onAnimationComplete={() => {
                setAdditionAnims(prev => prev.filter(p => p.id !== anim.id));
              }}
              className="absolute bg-gradient-to-r from-emerald-500 via-teal-500 to-green-500 text-white font-black text-[10px] tracking-wider uppercase px-3.5 py-2 rounded-full shadow-[0_10px_25px_-5px_rgba(16,185,129,0.5)] flex items-center gap-1.5 border border-emerald-400 select-none pointer-events-none"
            >
              <Sparkles size={11} className="text-yellow-300 animate-pulse shrink-0" />
              <span>+1 {anim.name} (₹{anim.price})</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
