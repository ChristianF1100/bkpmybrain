/**
 * Attività neurale: calcolata nel browser da date di pubblicazione + collegamenti statici.
 *
 *  - Ogni contenuto pubblicato è un "impulso" che parte dal suo nodo con ampiezza 1.
 *  - L'impulso si propaga lungo i collegamenti (max `maxHops`): a ogni passaggio l'ampiezza
 *    viene moltiplicata per `strongLinkPass × peso^esponente` (tenendo il percorso migliore).
 *  - L'ampiezza decade con tempo di dimezzamento `halfLifeDays` (decadimento esponenziale).
 *  - Gli impulsi su uno stesso nodo si accumulano con saturazione "OR probabilistico":
 *    attività = 1 − Π(1 − cᵢ). Non supera mai il massimo e un singolo impulso fresco passa intatto.
 *  - La luminosità finale non scende mai sotto `minBrightness`: i nodi non scompaiono mai.
 */
import type { ActivityParams, StructuralParams } from './types.ts';

export const DAY_MS = 86_400_000;
export type Adjacency = { to: number; w: number }[][];

export function buildAdjacency(count: number, edges: { a: number; b: number; w: number }[]): Adjacency {
  const adj: Adjacency = Array.from({ length: count }, () => []);
  for (const e of edges) { adj[e.a].push({ to: e.b, w: e.w }); adj[e.b].push({ to: e.a, w: e.w }); }
  return adj;
}

export const decayFactor = (ageDays: number, halfLifeDays: number): number =>
  Math.pow(0.5, Math.max(0, ageDays) / halfLifeDays);

/** Ampiezza raggiunta da un impulso nato in `source`, per ogni nodo entro `maxHops`. */
export function propagate(adj: Adjacency, source: number, p: ActivityParams): Map<number, number> {
  const best = new Map<number, number>([[source, 1]]);
  let frontier = new Map<number, number>([[source, 1]]);
  for (let hop = 0; hop < p.maxHops && frontier.size; hop++) {
    const next = new Map<number, number>();
    for (const [u, au] of frontier) {
      for (const e of adj[u]) {
        const a = au * p.strongLinkPass * Math.pow(e.w, p.weightExponent);
        if (a < p.minPropagated) continue;
        if (a > (best.get(e.to) ?? 0)) { best.set(e.to, a); next.set(e.to, a); }
      }
    }
    frontier = next;
  }
  return best;
}

export interface ActivityEngine { compute(ts: ArrayLike<number>, now: number): Float32Array }

/** Motore con cache delle propagazioni (dipendono solo dalla struttura, non dal tempo). */
export function createActivityEngine(adj: Adjacency, p: ActivityParams): ActivityEngine {
  const cache = new Map<number, [number, number][]>();
  const spread = (i: number): [number, number][] => {
    let s = cache.get(i);
    if (!s) { s = [...propagate(adj, i, p)]; cache.set(i, s); }
    return s;
  };
  return {
    compute(ts, now) {
      const n = adj.length;
      const rem = new Float64Array(n).fill(1);
      const maxAge = p.halfLifeDays * p.cutoffHalfLives;
      for (let i = 0; i < n; i++) {
        const t = ts[i];
        if (!Number.isFinite(t)) continue;
        const age = Math.max(0, (now - t) / DAY_MS);
        if (age > maxAge) continue;
        const d = decayFactor(age, p.halfLifeDays);
        for (const [node, amp] of spread(i)) rem[node] *= 1 - Math.min(1, amp * d);
      }
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) out[i] = Math.min(p.maxActivity, (1 - rem[i]) * p.maxActivity);
      return out;
    },
  };
}

export function computeActivity(adj: Adjacency, ts: ArrayLike<number>, now: number, p: ActivityParams): Float32Array {
  return createActivityEngine(adj, p).compute(ts, now);
}

/** Attività (0..max) → luminosità visiva (minBrightness..1). */
export const brightness = (activity: number, p: ActivityParams): number =>
  p.minBrightness + (1 - p.minBrightness) * Math.min(1, Math.max(0, activity / p.maxActivity));

/** Forza strutturale 0..1: quanti contenuti e connessioni ha accumulato un nodo (indipendente dal tempo). */
export function structuralStrength(
  kinds: ('topic' | 'content')[], edges: { a: number; b: number; w: number }[], p: StructuralParams,
): number[] {
  const sum = new Array<number>(kinds.length).fill(0);
  for (const e of edges) { sum[e.a] += e.w; sum[e.b] += e.w; }
  return kinds.map((k, i) => Math.round((1 - Math.exp(-sum[i] / (k === 'topic' ? p.topicScale : p.contentScale))) * 1000) / 1000);
}
