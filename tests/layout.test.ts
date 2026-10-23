import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout } from '../src/core/layout.ts';
import { hash32, hashUnit } from '../src/core/rng.ts';
import type { Topic } from '../src/core/types.ts';
import { CFG } from './helpers.ts';

const topics: Topic[] = [
  { id: 'a', label: 'A', color: '#fff', position: [0, 0, 0] },
  { id: 'b', label: 'B', color: '#fff', position: [20, 5, -3] },
  { id: 'auto1', label: 'Auto', color: '#fff', zone: 'branch', auto: true },
];
const items = Array.from({ length: 30 }, (_, i) => ({
  id: `n${String(i).padStart(2, '0')}`, date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
  topicIds: i % 3 === 0 ? ['a', 'b'] : i % 3 === 1 ? ['b'] : ['a', 'auto1'],
}));
const L = (it = items, pins = {}) => computeLayout(topics, it, CFG.layout, pins);
const d = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

test('hash e identificativi: stabili e distribuiti', () => {
  assert.equal(hash32('fpv'), hash32('fpv'));
  assert.notEqual(hash32('fpv'), hash32('fpw'));
  const u = hashUnit('x'); assert.ok(u >= 0 && u < 1);
});
test('layout deterministico: stesso input → stesse coordinate (anche con ordine diverso)', () => {
  const a = L(); const b = L([...items].reverse());
  assert.deepEqual([...a], [...b]);
});
test("aggiungere contenuti recenti non sposta nessun nodo esistente", () => {
  const before = L();
  const more = [...items, { id: 'nuovo1', date: '2026-10-20T12:00:00.000Z', topicIds: ['a'] }, { id: 'nuovo2', date: '2026-10-21T12:00:00.000Z', topicIds: ['b', 'a'] }];
  const after = L(more);
  for (const [k, v] of before) assert.deepEqual(after.get(k), v, k);
  assert.ok(after.has('c:nuovo1') && after.has('c:nuovo2'));
});
test('anche un contenuto con data anteriore sposta al più i nodi successivi nella stessa regione, non tutta la rete', () => {
  const before = L();
  const after = L([...items, { id: 'vecchio', date: '2025-01-01T12:00:00.000Z', topicIds: ['b'] }]);
  const moved = [...before].filter(([k, v]) => d(after.get(k)!, v) > 1e-9).length;
  assert.ok(moved < before.size * 0.6, `spostati ${moved}/${before.size}`);
  for (const t of topics) assert.deepEqual(after.get(`t:${t.id}`), before.get(`t:${t.id}`));  // gli argomenti non si muovono
});
test('le coordinate bloccate (pins) non cambiano mai', () => {
  const pin = { 'c:n00': [1.5, 2.5, 3.5] as [number, number, number] };
  const l = L(items, pin);
  assert.deepEqual(l.get('c:n00'), pin['c:n00']);
  const l2 = L([...items, { id: 'vecchio', date: '2020-01-01T12:00:00.000Z', topicIds: ['a'] }], pin);
  assert.deepEqual(l2.get('c:n00'), pin['c:n00']);
});
test('i nodi non si sovrappongono e restano vicini ai propri argomenti', () => {
  const l = L(); const pts = [...l.entries()];
  let minD = Infinity;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) minD = Math.min(minD, d(pts[i][1], pts[j][1]));
  assert.ok(minD > 1.2, `distanza minima ${minD}`);
  assert.ok(d(l.get('c:n01')!, l.get('t:b')!) < CFG.layout.cloudRadius * 3);
});
test('argomento senza posizione: ancora derivata dall\'id nella fascia della sua zona', () => {
  const r = Math.hypot(...(L().get('t:auto1') as number[])) / CFG.layout.radius;
  assert.ok(r >= 0.6 && r <= 1.0, `r=${r}`);
});
