export type ThemeType = 
  | 'midnight_blue' 
  | 'neo_brutalist' 
  | 'glass_modern' 
  | 'luxury_gold' 
  | 'emerald_matrix'
  | 'premium_dynamic';

export type LanguageType = 'en' | 'hi' | 'mr' | 'hi-en';

export interface Translations {
  en: string;
  hi: string;
  mr: string;
  'hi-en': string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color?: string;
}

export interface Note {
  id: string;
  title: string;
  description: string;
  category: 'Stock' | 'Payment' | 'Customer' | 'Supplier' | 'Reminder' | 'General';
  priority: 'Urgent' | 'Important' | 'Completed' | 'Info';
  createdAt: string;
  dueDate: string | null;
  status: 'Active' | 'Completed';
  isPinned: boolean;
}

export interface Item {
  id: string;
  name: string;
  translations: Translations;
  categoryId: string;
  quantity: number;
  unit: string;
  buyingPrice: number;
  buyingPriceUnit: string;
  wholesalePrice: number;
  wholesalePriceUnit: string;
  retailPrice: number;
  retailPriceUnit: string;
  lastUpdated: string;
  priceChangedAt?: string;
  lastChangedBy?: string;
  notes?: string;
  aiAdvice?: string;
}

export interface AppSettings {
  theme: ThemeType;
  language: LanguageType;
  isLocked: boolean;
  pin: string | null;
  currency: string;
  autoLockDelay: number; // in seconds
  hideBuyingPriceByDefault: boolean;
  accentColor: 'indigo' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'slate';
  fontSize: 'standard' | 'comfortable' | 'compact';
  pricePrecision: number;
  showStockAlerts: boolean;
  autoCloudSync: boolean;
  hasSeenOnboarding: boolean;
  dismissedNotifications: string[];
  deviceId: string;
  deviceName: string;
}

export interface AppState {
  items: Item[];
  notes: Note[];
  categories: Category[];
  settings: AppSettings;
  user: {
    uid: string;
    email: string | null;
  } | null;
}
