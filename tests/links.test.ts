import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLinks, rarity } from '../src/core/links.ts';
import { resolveTopics, buildEquivalenceMap } from '../src/core/topics.ts';
import type { ContentItem, TopicDef } from '../src/core/types.ts';
import { normalizeTag } from '../src/core/text.ts';
import { CFG } from './helpers.ts';

const defs: TopicDef[] = [
  { id: 'fpv', label: 'FPV', color: '#5ec8e5', aliases: ['drone', 'quad'] },
  { id: 'elettronica', label: 'Elettronica', color: '#e8b44f', aliases: ['saldatura'] },
  { id: 'montagna', label: 'Montagna', color: '#7fd6a0' },
];
const mk = (id: string, tags: string[], related: string[] = []): ContentItem => ({
  id, slug: id, type: 'article', title: id, date: '2026-01-01T12:00:00.000Z', description: '', tags: tags.map(normalizeTag), related,
  primary: null, cover: null, demo: false, file: `${id}.md`, text: '', url: `/contenuti/${id}/`,
});
const run = (items: ContentItem[], d = defs) => {
  const { topics, byItem } = resolveTopics(d, items, CFG.links, CFG.palette.autoColors);
  const li = items.map((i) => ({ id: i.id, tags: byItem.get(i.id)!.tags, topicIds: byItem.get(i.id)!.topicIds, related: i.related }));
  return { topics, byItem, links: buildLinks(li, topics, CFG.links) };
};

test('alias ed equivalenze portano ai nodi tematici corretti', () => {
  const { byItem } = run([mk('a', ['Drone', 'riparazione', 'saldatura'])]);
  assert.deepEqual(byItem.get('a')!.topicIds, ['fpv', 'elettronica']);        // 'drone' → fpv; 'saldatura' → elettronica
  assert.deepEqual(byItem.get('a')!.tags.sort(), ['elettronica', 'fpv', 'riparazioni'].sort());
  assert.equal(buildEquivalenceMap([['riparazioni', 'riparazione']]).get('riparazione'), 'riparazioni');
});
test('ogni contenuto è collegato ai suoi argomenti, il primo con peso pieno', () => {
  const { links } = run([mk('a', ['fpv', 'elettronica', 'x'])]);
  const tc = links.filter((l) => l.kind === 'topic-content');
  assert.deepEqual(tc.map((l) => [l.a, l.w]), [['t:elettronica', 0.82], ['t:fpv', 1]]);
});
test('più tag condivisi → collegamento più forte; tag rari pesano di più', () => {
  const items = [mk('a', ['x', 'y', 'z']), mk('b', ['x', 'y', 'z']), mk('c', ['x']), mk('d', ['q', 'x'])];
  const { links } = run(items);
  const w = (p: string, q: string) => links.find((l) => l.kind === 'content-content' && l.a === `c:${p}` && l.b === `c:${q}`)?.w ?? 0;
  assert.ok(w('a', 'b') > w('a', 'c'));
  assert.ok(rarity(2) > rarity(10));
});
test('il numero di collegamenti secondari è limitato', () => {
  const items = Array.from({ length: 12 }, (_, i) => mk(`n${String(i).padStart(2, '0')}`, ['x', 'y']));
  const { links } = run(items);
  const deg = new Map<string, number>();
  for (const l of links.filter((k) => k.kind === 'content-content')) {
    deg.set(l.a, (deg.get(l.a) ?? 0) + 1); deg.set(l.b, (deg.get(l.b) ?? 0) + 1);
  }
  assert.ok(Math.max(...deg.values()) <= CFG.links.maxSecondaryLinks);
});
test('collegamenti espliciti `related` (unici, ignorando id inesistenti)', () => {
  const { links } = run([mk('a', ['x'], ['b', 'nope']), mk('b', ['y'], ['a'])]);
  const ex = links.filter((l) => l.kind === 'explicit');
  assert.equal(ex.length, 1);
  assert.deepEqual([ex[0].a, ex[0].b, ex[0].w], ['c:a', 'c:b', 1]);
});
test('un tag usato da ≥3 contenuti diventa automaticamente un argomento', () => {
  const items = [mk('a', ['robotica']), mk('b', ['robotica', 'fpv']), mk('c', ['Robotica'])];
  const { topics, byItem } = run(items);
  const t = topics.find((x) => x.id === 'robotica');
  assert.ok(t?.auto && /^#[0-9a-f]{6}$/i.test(t.color));
  assert.deepEqual(byItem.get('a')!.topicIds, ['robotica']);
  assert.equal(run(items.slice(0, 2)).topics.some((x) => x.id === 'robotica'), false);
});
test('ponti tra argomenti per co-occorrenza e dichiarati', () => {
  const items = [mk('a', ['fpv', 'elettronica']), mk('b', ['fpv', 'elettronica']), mk('c', ['montagna'])];
  const { links } = run(items, defs.map((d) => (d.id === 'montagna' ? { ...d, related: [{ topic: 'fpv', weight: 0.4 }] } : d)));
  const tt = links.filter((l) => l.kind === 'topic-topic');
  assert.ok(tt.some((l) => l.a === 't:elettronica' && l.b === 't:fpv'));
  assert.ok(tt.some((l) => l.a === 't:fpv' && l.b === 't:montagna' && l.w === 0.4));
});
test('generazione deterministica (indipendente dall\'ordine d\'ingresso)', () => {
  const items = [mk('a', ['fpv', 'x']), mk('b', ['fpv', 'x']), mk('c', ['fpv', 'y']), mk('d', ['y', 'x'])];
  assert.deepEqual(run(items).links, run([...items].reverse()).links);
});
