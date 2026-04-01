import type { GeneratedCoupon } from '@/types/coupon';

const HISTORY_KEY = 'iddaa_coupon_history';
const MAX_HISTORY = 20;

export interface SavedCoupon extends GeneratedCoupon {
  savedAt: string;
}

export function saveCoupon(coupon: GeneratedCoupon): SavedCoupon[] {
  const history = getHistory();
  const saved: SavedCoupon = { ...coupon, savedAt: new Date().toISOString() };
  const updated = [saved, ...history.filter((c) => c.id !== coupon.id)].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  return updated;
}

export function getHistory(): SavedCoupon[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function deleteFromHistory(id: string): SavedCoupon[] {
  const updated = getHistory().filter((c) => c.id !== id);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  return updated;
}
