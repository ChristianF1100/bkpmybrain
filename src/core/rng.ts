/** Hash e generatori pseudo-casuali deterministici (nessun Math.random). */
import type { Vec3 } from './types.ts';

/** Hash a 32 bit (FNV-1a + finalizzatore murmur) di una stringa. */
export function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Numero in [0,1) stabile per una chiave. */
export const hashUnit = (key: string): number => hash32(key) / 4294967296;
/** Generatore deterministico associato a una chiave. */
export const rngFor = (key: string): (() => number) => mulberry32(hash32(key));

export function randomUnitVector(rng: () => number): Vec3 {
  const z = rng() * 2 - 1;
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return [r * Math.cos(a), r * Math.sin(a), z];
}
