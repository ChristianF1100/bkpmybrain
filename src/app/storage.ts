/** Accesso sicuro a localStorage/sessionStorage (possono non essere disponibili o bloccati). */
export function readStore(kind: 'local' | 'session', key: string): string | null {
  try { return (kind === 'local' ? localStorage : sessionStorage).getItem(key); } catch { return null; }
}
export function writeStore(kind: 'local' | 'session', key: string, value: string): void {
  try { (kind === 'local' ? localStorage : sessionStorage).setItem(key, value); } catch { /* ignorato */ }
}

export const VIEW_KEY = 'sinapsi:view';
export const INTRO_KEY = 'sinapsi:intro';

export interface SavedView { p: [number, number, number]; t: [number, number, number]; sel: string | null }

export function readSavedView(): SavedView | null {
  const raw = readStore('session', VIEW_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as SavedView;
    const ok = (a: unknown) => Array.isArray(a) && a.length === 3 && a.every((x) => Number.isFinite(x));
    return ok(v.p) && ok(v.t) ? v : null;
  } catch { return null; }
}
