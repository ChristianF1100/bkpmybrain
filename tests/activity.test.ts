import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, brightness, buildAdjacency, computeActivity, decayFactor, propagate, structuralStrength } from '../src/core/activity.ts';
import { CFG, NOW } from './helpers.ts';

const P = CFG.activity;
const chain = (n: number, w = 1) => buildAdjacency(n, Array.from({ length: n - 1 }, (_, i) => ({ a: i, b: i + 1, w })));
const ago = (d: number) => NOW - d * DAY_MS;

test('parametri iniziali come da specifica', () => {
  assert.equal(P.minBrightness, 0.08); assert.equal(P.halfLifeDays, 30);
  assert.equal(P.strongLinkPass, 0.55); assert.equal(P.maxHops, 3); assert.equal(P.maxActivity, 1);
});
test('tempo di dimezzamento: 30 giorni → 50%, 60 → 25%', () => {
  assert.equal(decayFactor(0, 30), 1);
  assert.ok(Math.abs(decayFactor(30, 30) - 0.5) < 1e-12);
  assert.ok(Math.abs(decayFactor(60, 30) - 0.25) < 1e-12);
  const a = computeActivity(chain(2), [ago(30), NaN], NOW, P);
  assert.ok(Math.abs(a[0] - 0.5) < 1e-6);
});
test('pubblicazione di oggi: nodo al massimo, propagazione 55% / 30% / 17%, poi nulla', () => {
  const a = computeActivity(chain(6), [ago(0), NaN, NaN, NaN, NaN, NaN], NOW, P);
  assert.ok(Math.abs(a[0] - 1) < 1e-6);
  assert.ok(Math.abs(a[1] - 0.55) < 1e-6);
  assert.ok(Math.abs(a[2] - 0.55 ** 2) < 1e-6);
  assert.ok(Math.abs(a[3] - 0.55 ** 3) < 1e-6);
  assert.equal(a[4], 0); assert.equal(a[5], 0);        // massimo tre passaggi
});
test('il peso del collegamento incide sulla propagazione', () => {
  const adj = buildAdjacency(3, [{ a: 0, b: 1, w: 1 }, { a: 0, b: 2, w: 0.4 }]);
  const a = computeActivity(adj, [NOW, NaN, NaN], NOW, P);
  assert.ok(a[1] > a[2]); assert.ok(Math.abs(a[2] - 0.55 * 0.4 ** P.weightExponent) < 1e-6);
});
test('i nodi scollegati restano quasi inattivi', () => {
  const adj = buildAdjacency(3, [{ a: 0, b: 1, w: 1 }]);
  const a = computeActivity(adj, [NOW, NaN, NaN], NOW, P);
  assert.equal(a[2], 0);
  assert.equal(brightness(a[2], P), 0.08);
});
test('accumulo con saturazione: mai oltre il massimo, cresce pubblicando spesso', () => {
  const adj = buildAdjacency(4, [{ a: 0, b: 3, w: 1 }, { a: 1, b: 3, w: 1 }, { a: 2, b: 3, w: 1 }]);
  const one = computeActivity(adj, [NOW, NaN, NaN, NaN], NOW, P)[3];
  const three = computeActivity(adj, [NOW, NOW, NOW, NaN], NOW, P)[3];
  assert.ok(three > one && three <= 1);
  const many = buildAdjacency(51, Array.from({ length: 50 }, (_, i) => ({ a: i, b: 50, w: 1 })));
  const ts = Array.from({ length: 51 }, (_, i) => (i < 50 ? NOW : NaN));
  const hub = computeActivity(many, ts, NOW, P)[50];
  assert.ok(hub <= P.maxActivity && hub > 0.99);
});
test('decadimento nel tempo ma mai invisibile; riattivazione con un nuovo contenuto', () => {
  const adj = chain(3);
  const fresh = computeActivity(adj, [ago(1), NaN, NaN], NOW, P);
  const months = computeActivity(adj, [ago(120), NaN, NaN], NOW, P);
  const years = computeActivity(adj, [ago(1500), NaN, NaN], NOW, P);
  assert.ok(fresh[1] > months[1] && months[1] > years[1]);
  assert.equal(years[0], 0);
  assert.equal(brightness(years[0], P), 0.08);                  // i nodi non scompaiono mai
  const reactivated = computeActivity(adj, [ago(1500), NaN, ago(0)], NOW, P);
  assert.ok(reactivated[1] > 0.5 && reactivated[2] > 0.99);     // il vecchio argomento si riaccende
});
test('propagate non supera maxHops e prende il percorso migliore', () => {
  const m = propagate(chain(6), 0, P);
  assert.deepEqual([...m.keys()].sort(), [0, 1, 2, 3]);
  const tri = buildAdjacency(3, [{ a: 0, b: 1, w: 0.3 }, { a: 1, b: 2, w: 1 }, { a: 0, b: 2, w: 1 }]);
  assert.ok(Math.abs((propagate(tri, 0, P).get(2) as number) - 0.55) < 1e-9);
});
test('forza strutturale: cresce con contenuti e connessioni, indipendente dal tempo', () => {
  const edges = [{ a: 0, b: 1, w: 1 }, { a: 0, b: 2, w: 1 }, { a: 0, b: 3, w: 1 }];
  const s = structuralStrength(['topic', 'content', 'content', 'content', 'topic'], edges, CFG.structural);
  assert.ok(s[0] > s[4] && s[4] === 0 && s.every((v) => v >= 0 && v < 1));
});
test('luminosità: da 8% a 100%', () => {
  assert.equal(brightness(0, P), 0.08); assert.equal(brightness(1, P), 1); assert.equal(brightness(5, P), 1);
});
