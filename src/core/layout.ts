/**
 * Posizionamento STABILE dei nodi.
 *
 *  - Gli argomenti hanno un'ancora: dichiarata in config (`position`) oppure derivata dall'id
 *    con hash deterministico dentro la fascia della loro `zone`.
 *  - Ogni contenuto nasce attorno al baricentro (pesato) dei suoi argomenti: la posizione dipende
 *    solo da id, argomenti e dalla data (che fissa l'ordine di inserimento). Aggiungere un contenuto
 *    recente non sposta nessun altro nodo.
 *  - `pins` (data/layout.lock.json, generato con `npm run lock-layout`) congela le coordinate
 *    già assegnate: i nodi bloccati non si muovono mai, nemmeno se cambia altro.
 */
import type { LayoutParams, Topic, Vec3, Zone } from './types.ts';
import { randomUnitVector, rngFor } from './rng.ts';

export interface LayoutItem { id: string; date: string; topicIds: string[] }
export type Pins = Record<string, Vec3>;

interface Placed { p: Vec3; clearance: number }

const dist = (a: Vec3, b: Vec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const round = (v: Vec3, d: number): Vec3 => {
  const k = 10 ** d;
  return [Math.round(v[0] * k) / k, Math.round(v[1] * k) / k, Math.round(v[2] * k) / k];
};
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Valore ≥ 1 se il punto rispetta tutte le distanze minime. */
function clearanceScore(c: Vec3, placed: Placed[]): number {
  let m = Infinity;
  for (const q of placed) m = Math.min(m, dist(c, q.p) / q.clearance);
  return m;
}

export function topicAnchors(topics: Topic[], p: LayoutParams): Map<string, Vec3> {
  const out = new Map<string, Vec3>();
  const placed: Placed[] = [];
  for (const t of topics) if (t.position) { out.set(t.id, t.position); placed.push({ p: t.position, clearance: p.minAnchorDistance }); }
  for (const t of topics.filter((x) => !x.position).sort((a, b) => cmp(a.id, b.id))) {
    const [r0, r1] = p.zoneRanges[(t.zone ?? 'mid') as Zone];
    let best: Vec3 = [0, 0, 0], bestScore = -1;
    for (let k = 0; k < p.attempts; k++) {
      const rng = rngFor(`anchor:${t.id}:${k}`);
      const dir = randomUnitVector(rng);
      const r = (r0 + (r1 - r0) * Math.cbrt(rng())) * p.radius;
      const c: Vec3 = [dir[0] * r, dir[1] * r, dir[2] * r];
      const s = clearanceScore(c, placed);
      if (s >= 1) { best = c; bestScore = s; break; }
      if (s > bestScore) { best = c; bestScore = s; }
    }
    best = round(best, p.decimals);
    out.set(t.id, best);
    placed.push({ p: best, clearance: p.minAnchorDistance });
  }
  return out;
}

/** Restituisce le coordinate di tutti i nodi: chiavi `t:<id>` e `c:<id>`. */
export function computeLayout(topics: Topic[], items: LayoutItem[], p: LayoutParams, pins: Pins = {}): Map<string, Vec3> {
  const out = new Map<string, Vec3>();
  const anchors = topicAnchors(topics, p);
  const placed: Placed[] = [];
  for (const t of topics) {
    const pos = anchors.get(t.id) as Vec3;
    out.set(`t:${t.id}`, pos);
    placed.push({ p: pos, clearance: p.topicClearance });
  }
  const ids = new Set(items.map((i) => `c:${i.id}`));
  for (const [k, v] of Object.entries(pins)) {
    if (ids.has(k)) { out.set(k, v); placed.push({ p: v, clearance: p.minNodeDistance }); }
  }

  const ordered = [...items].sort((a, b) => cmp(a.date, b.date) || cmp(a.id, b.id));
  for (const it of ordered) {
    const key = `c:${it.id}`;
    if (out.has(key)) continue;

    // baricentro pesato degli argomenti (il principale pesa di più)
    let sum: Vec3 = [0, 0, 0], wsum = 0;
    it.topicIds.forEach((tid, i) => {
      const a = anchors.get(tid);
      if (!a) return;
      const w = i === 0 ? 1 : (p.secondaryWeights[i - 1] ?? p.secondaryWeights[p.secondaryWeights.length - 1] ?? 0.2);
      sum = [sum[0] + a[0] * w, sum[1] + a[1] * w, sum[2] + a[2] * w];
      wsum += w;
    });
    let centroid: Vec3;
    if (wsum > 0) centroid = [sum[0] / wsum, sum[1] / wsum, sum[2] / wsum];
    else {
      const d = randomUnitVector(rngFor(`free:${key}`));
      centroid = [d[0] * p.radius * 0.45, d[1] * p.radius * 0.45, d[2] * p.radius * 0.45];
    }
    const cl = Math.hypot(...centroid);
    const axis: Vec3 = cl > 1e-6 ? [centroid[0] / cl, centroid[1] / cl, centroid[2] / cl] : [0, 1, 0];
    const stretch = cl / p.radius > 0.55 ? p.branchStretch : 1;

    let best: Vec3 = centroid, bestScore = -1;
    for (let k = 0; k < p.attempts; k++) {
      const rng = rngFor(`${key}:${k}`);
      const dir = randomUnitVector(rng);
      const grow = 1 + (k / p.attempts) * 0.9;
      const len = p.cloudRadius * grow * (p.cloudMinFraction + (1 - p.cloudMinFraction) * Math.cbrt(rng()));
      let off: Vec3 = [dir[0] * len, dir[1] * len, dir[2] * len];
      const along = off[0] * axis[0] + off[1] * axis[1] + off[2] * axis[2];
      off = [off[0] + axis[0] * along * (stretch - 1), off[1] + axis[1] * along * (stretch - 1), off[2] + axis[2] * along * (stretch - 1)];
      const c: Vec3 = [centroid[0] + off[0], centroid[1] + off[1], centroid[2] + off[2]];
      const s = clearanceScore(c, placed);
      if (s >= 1) { best = c; bestScore = s; break; }
      if (s > bestScore) { best = c; bestScore = s; }
    }
    best = round(best, p.decimals);
    out.set(key, best);
    placed.push({ p: best, clearance: p.minNodeDistance });
  }
  return out;
}
