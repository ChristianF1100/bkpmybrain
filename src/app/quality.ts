/** Rilevamento delle capacità del dispositivo (qualità grafica, WebGL, movimento ridotto). */
import type { NetworkConfig } from '../core/types.ts';

export type Tier = 'high' | 'low';

export const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const isTouchPrimary = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

export function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch { return false; }
}

export function detectTier(): Tier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory ?? 8, cores = nav.hardwareConcurrency ?? 8;
  if (mem <= 2 || cores <= 2) return 'low';
  if (isTouchPrimary() && (mem <= 4 || cores <= 4)) return 'low';
  return 'high';
}

export const tierSettings = (cfg: NetworkConfig['quality'], tier: Tier) => cfg[tier];
