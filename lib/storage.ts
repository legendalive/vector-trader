import { AppSettings, DEFAULT_SETTINGS, Trade } from '@/types/trading';

const SETTINGS_KEY = 'vector_trader_settings_v1';
const TRADES_KEY = 'vector_trader_trades_v1';

// Production: Start with empty trade history (actual data populated via MT5 bridge)
export const INITIAL_TRADES: Trade[] = [];

export const StorageService = {
  getSettings(): AppSettings {
    if (typeof window === 'undefined') {
      return DEFAULT_SETTINGS;
    }
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to read settings from localStorage', e);
    }
    return DEFAULT_SETTINGS;
  },

  saveSettings(settings: AppSettings): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage', e);
    }
  },

  getTrades(): Trade[] {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const stored = localStorage.getItem(TRADES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to read trades from localStorage', e);
    }
    return [];
  },

  saveTrades(trades: Trade[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(TRADES_KEY, JSON.stringify(trades));
    } catch (e) {
      console.error('Failed to save trades to localStorage', e);
    }
  },

  clearTrades(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(TRADES_KEY);
    } catch (e) {
      console.error('Failed to clear trades from localStorage', e);
    }
  },

  resetDefaults(): { settings: AppSettings; trades: Trade[] } {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SETTINGS_KEY);
      localStorage.removeItem(TRADES_KEY);
    }
    return {
      settings: DEFAULT_SETTINGS,
      trades: [],
    };
  },
};
