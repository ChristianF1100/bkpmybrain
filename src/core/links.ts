/**
 * Generazione automatica dei collegamenti, interamente locale e deterministica.
 *  1. contenuto → argomento (per ogni tag che corrisponde a un argomento)
 *  2. contenuto ↔ contenuto, con forza basata sui tag condivisi (tag rari pesano di più)
 *  3. collegamenti espliciti (`related:`)
 *  4. argomento ↔ argomento (dichiarati + co-occorrenza)
 */
import type { Link, LinkParams, Topic } from './types.ts';

export interface LinkItem { id: string; tags: string[]; topicIds: string[]; related: string[] }

const r3 = (n: number): number => Math.round(n * 1000) / 1000;
const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Rilevanza di un tag: meno contenuti lo condividono, più è significativo. */
export const rarity = (df: number): number => 1 / (1 + Math.log(Math.max(1, df)));

export function buildLinks(items: LinkItem[], topics: Topic[], p: LinkParams): Link[] {
  const out: Link[] = [];
  const topicSet = new Set(topics.map((t) => t.id));
  const itemIds = new Set(items.map((i) => i.id));

  // 1. contenuto → argomento
  for (const it of items) {
    it.topicIds.slice(0, p.maxTopicsPerContent).forEach((tid, i) => {
      out.push({ a: `t:${tid}`, b: `c:${it.id}`, w: r3(Math.max(p.topicLinkFloor, 1 - p.topicLinkDecay * i)), kind: 'topic-content' });
    });
  }

  // 3. espliciti (prima, per escluderli dal calcolo automatico)
  const explicit = new Set<string>();
  for (const it of items) {
    for (const r of it.related) {
      if (r === it.id || !itemIds.has(r)) continue;
      const k = pairKey(it.id, r);
      if (explicit.has(k)) continue;
      explicit.add(k);
      const [a, b] = k.split('|');
      out.push({ a: `c:${a}`, b: `c:${b}`, w: p.explicitWeight, kind: 'explicit' });
    }
  }

  // 2. tag condivisi
  const byTag = new Map<string, string[]>();
  for (const it of items) for (const t of it.tags) {
    const l = byTag.get(t);
    if (l) l.push(it.id); else byTag.set(t, [it.id]);
  }
  const acc = new Map<string, number>();
  for (const [tag, ids] of byTag) {
    if (ids.length < 2 || ids.length > p.maxTagFanout) continue;
    const tw = (topicSet.has(tag) ? p.topicTagWeight : p.minorTagWeight) * rarity(ids.length);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = pairKey(ids[i], ids[j]);
      acc.set(k, (acc.get(k) ?? 0) + tw);
    }
  }
  const cands = [...acc]
    .map(([k, sum]) => ({ k, w: 1 - Math.exp(-sum * p.strengthGain) }))
    .filter((c) => c.w >= p.minStrength && !explicit.has(c.k))
    .sort((x, y) => y.w - x.w || cmp(x.k, y.k));
  const deg = new Map<string, number>();
  for (const c of cands) {
    const [a, b] = c.k.split('|');
    if ((deg.get(a) ?? 0) >= p.maxSecondaryLinks || (deg.get(b) ?? 0) >= p.maxSecondaryLinks) continue;
    deg.set(a, (deg.get(a) ?? 0) + 1);
    deg.set(b, (deg.get(b) ?? 0) + 1);
    out.push({ a: `c:${a}`, b: `c:${b}`, w: r3(c.w), kind: 'content-content' });
  }

  // 4. argomento ↔ argomento
  const tdeg = new Map<string, number>();
  const tkeys = new Set<string>();
  for (const t of topics) for (const rel of t.related ?? []) {
    if (rel.topic === t.id || !topicSet.has(rel.topic)) continue;
    const k = pairKey(t.id, rel.topic);
    if (tkeys.has(k)) continue;
    tkeys.add(k);
    const [a, b] = k.split('|');
    tdeg.set(a, (tdeg.get(a) ?? 0) + 1); tdeg.set(b, (tdeg.get(b) ?? 0) + 1);
    out.push({ a: `t:${a}`, b: `t:${b}`, w: r3(rel.weight ?? 0.8), kind: 'topic-topic' });
  }
  const cooc = new Map<string, number>();
  for (const it of items) {
    const ids = [...new Set(it.topicIds)];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = pairKey(ids[i], ids[j]);
      cooc.set(k, (cooc.get(k) ?? 0) + 1);
    }
  }
  const tc = [...cooc]
    .map(([k, n]) => ({ k, w: 1 - Math.exp(-n * p.topicCoocGain) }))
    .filter((c) => c.w >= p.topicMinStrength && !tkeys.has(c.k))
    .sort((x, y) => y.w - x.w || cmp(x.k, y.k));
  for (const c of tc) {
    const [a, b] = c.k.split('|');
    if ((tdeg.get(a) ?? 0) >= p.maxTopicLinks || (tdeg.get(b) ?? 0) >= p.maxTopicLinks) continue;
    tdeg.set(a, (tdeg.get(a) ?? 0) + 1); tdeg.set(b, (tdeg.get(b) ?? 0) + 1);
    out.push({ a: `t:${a}`, b: `t:${b}`, w: r3(c.w), kind: 'topic-topic' });
  }

  const order = { 'topic-topic': 0, 'topic-content': 1, explicit: 2, 'content-content': 3 } as const;
  return out.sort((x, y) => order[x.kind] - order[y.kind] || cmp(x.a, y.a) || cmp(x.b, y.b));
}
