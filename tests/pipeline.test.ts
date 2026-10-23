import test from 'node:test';
import assert from 'node:assert/strict';
import { runPipeline } from '../src/core/pipeline.ts';
import { searchIndex } from '../src/core/search.ts';
import { buildAdjacency, brightness, createActivityEngine, DAY_MS } from '../src/core/activity.ts';
import { CFG, NOW, demoFiles, demoTopics, md } from './helpers.ts';

const run = (files = demoFiles(), topics = demoTopics(), now = NOW) => runPipeline({ files, topics, config: CFG, now });
const out = run();

test('i contenuti demo si compilano senza errori né avvisi', () => {
  assert.deepEqual(out.errors, []);
  assert.deepEqual(out.warnings, []);
  assert.ok(out.items.length >= 25);
});
test('copertura della demo richiesta dalla specifica', () => {
  const g = out.graph;
  const types = new Set(out.items.map((i) => i.type));
  for (const t of ['article', 'note', 'fragment', 'project', 'photo', 'video', 'code', 'memory']) assert.ok(types.has(t as never), t);
  assert.ok(out.items.some((i) => i.title === null), 'frammenti senza titolo');
  assert.ok(g.nodes.filter((n) => n.kind === 'content' && n.topics.length > 1).length >= 5, 'contenuti multi-argomento');
  assert.ok(out.items.some((i) => i.type === 'project' && /```/.test(i.text) === false), 'progetti presenti');
});
test('integrità del grafo: indici validi, archi unici, ogni contenuto ha un argomento', () => {
  const g = out.graph;
  const keys = new Set<string>();
  for (const e of g.edges) {
    assert.ok(e.a < e.b && e.b < g.nodes.length && e.w > 0 && e.w <= 1);
    const k = `${e.a}|${e.b}`; assert.ok(!keys.has(k), `arco duplicato ${k}`); keys.add(k);
  }
  for (const n of g.nodes.filter((x) => x.kind === 'content')) assert.ok(n.topics.length >= 1, n.id);
  assert.equal(new Set(g.nodes.map((n) => n.id)).size, g.nodes.length);
});
test('CrestaNord: regione periferica, segreta e dormiente', () => {
  const g = out.graph;
  const cn = g.nodes.find((n) => n.id === 't:crestanord')!;
  assert.ok(cn.secret);
  const dist = (n: { pos: number[] }) => Math.hypot(...n.pos);
  const farthest = Math.max(...g.nodes.filter((n) => n.kind === 'topic').map(dist));
  assert.equal(dist(cn), farthest);
  assert.ok(g.nodes.some((n) => n.id === 'c:crestanord' && n.type === 'memory'));
});
test('la demo mostra davvero la simulazione: FPV acceso, Montagna e CrestaNord dormienti, Stampa 3D giovane', () => {
  const g = out.graph;
  const eng = createActivityEngine(buildAdjacency(g.nodes.length, g.edges), CFG.activity);
  const ts = g.nodes.map((n) => (n.date ? Date.parse(n.date) : NaN));
  const b = (id: string, now = NOW) => { const i = g.nodes.findIndex((n) => n.id === id); return brightness(eng.compute(ts, now)[i], CFG.activity); };
  assert.ok(b('t:fpv') > 0.9, `fpv ${b('t:fpv')}`);
  assert.ok(b('t:montagna') < 0.55 && b('t:montagna') < b('t:fpv') * 0.6, `montagna ${b('t:montagna')}`);
  assert.ok(b('t:crestanord') < 0.15, `crestanord ${b('t:crestanord')}`);
  assert.ok(b('t:stampa-3d') > 0.5, `stampa ${b('t:stampa-3d')}`);
  const stampaN = g.nodes.filter((n) => n.topics.includes('stampa-3d')).length;
  const fpvN = g.nodes.filter((n) => n.topics.includes('fpv')).length;
  assert.ok(stampaN < fpvN);
  // dopo sei mesi senza pubblicare: FPV scende ma resta visibile
  const later = NOW + 180 * DAY_MS;
  assert.ok(b('t:fpv', later) < b('t:fpv') && b('t:fpv', later) >= 0.08);
});
test('la forza strutturale è indipendente dal tempo e premia gli argomenti ricchi', () => {
  const s = (id: string) => out.graph.nodes.find((n) => n.id === id)!.structural;
  assert.ok(s('t:fpv') > s('t:stampa-3d'));
  assert.ok(s('t:montagna') > s('t:pensieri') * 0.5);
});
test('il build è deterministico: due esecuzioni producono lo stesso JSON', () => {
  assert.equal(JSON.stringify(run().graph), JSON.stringify(run().graph));
  assert.equal(JSON.stringify(run(demoFiles().reverse()).graph), JSON.stringify(out.graph));
});
test('aggiungere un file genera nodo, collegamenti e indice di ricerca; i vecchi nodi restano fermi', () => {
  const extra = { file: 'content/nuovo.md', source: md('nuovo-fpv', 'title: Antenna patch per il cinewhoop\n', 'Una nuova antenna.').replace('[a]', '[fpv, antenne]').replace('2026-01-01', '2026-10-20') };
  const next = run([...demoFiles(), extra]);
  assert.deepEqual(next.errors, []);
  const n = next.graph.nodes.find((x) => x.id === 'c:nuovo-fpv')!;
  assert.ok(n && n.topics.includes('fpv'));
  assert.ok(next.graph.edges.some((e) => next.graph.nodes[e.a].id === 't:fpv' && next.graph.nodes[e.b].id === 'c:nuovo-fpv'));
  assert.deepEqual(searchIndex(next.search, 'antenna patch').map((h) => h.doc.i), ['c:nuovo-fpv']);
  const old = new Map(out.graph.nodes.map((x) => [x.id, x.pos]));
  for (const x of next.graph.nodes) if (old.has(x.id)) assert.deepEqual(x.pos, old.get(x.id), x.id);
});
test('bozze e contenuti con data futura non sono pubblicati; eliminare un file lo rimuove', () => {
  const bozza = { file: 'content/b.md', source: md('bozza1', 'draft: true\n') };
  const fut = { file: 'content/f.md', source: md('futuro1').replace('2026-01-01', '2030-01-01') };
  const r = run([...demoFiles(), bozza, fut]);
  assert.equal(r.graph.nodes.some((n) => n.id === 'c:bozza1' || n.id === 'c:futuro1'), false);
  assert.deepEqual(r.skipped.map((s) => s.reason).sort(), ['draft', 'future']);
  assert.equal(run(demoFiles().slice(1)).graph.nodes.length, out.graph.nodes.length - 1);
});
test('rendering in assenza di contenuti: restano gli argomenti, nessun errore', () => {
  const r = run([]);
  assert.deepEqual(r.errors, []);
  assert.equal(r.graph.nodes.every((n) => n.kind === 'topic'), true);
  assert.equal(r.graph.nodes.length, demoTopics().length);
  assert.equal(run([], []).graph.nodes.length, 0);
});
test('gli errori di validazione (id/slug duplicati, front matter rotto) bloccano la build', () => {
  const dup = run([...demoFiles(), { file: 'content/dup.md', source: demoFiles()[0].source }]);
  assert.ok(dup.errors.some((e) => /duplicat/.test(e)));
  assert.ok(run([{ file: 'x.md', source: '---\nid: [\n---' }]).errors.length > 0);
});
