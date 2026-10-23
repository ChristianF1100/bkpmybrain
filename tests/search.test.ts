import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchIndex, searchIndex } from '../src/core/search.ts';

const mk = (id: string, title: string, desc: string, text: string, tags: string[], type = 'article') =>
  ({ id, title, desc, type, typeLabel: type === 'note' ? 'Appunto' : 'Articolo', tags, shown: tags, text, ts: Date.parse('2026-01-01') });
const idx = buildSearchIndex([
  mk('a', 'Riparare un drone', 'Un braccio spezzato', 'Saldatura sul pad dell\'ESC, perché è così', ['fpv']),
  mk('b', 'Tuning PID', 'Filtri e D-term', 'Il volo è più stabile', ['fpv', 'firmware']),
  mk('c', '', 'Frammento notturno', 'La neve cade sul rifugio', ['montagna'], 'note'),
]);
const ids = (q: string) => searchIndex(idx, q).map((h) => h.doc.i);

test('cerca in titoli, descrizioni, testo, tag e tipologie', () => {
  assert.deepEqual(ids('riparare'), ['a']);
  assert.deepEqual(ids('spezzato'), ['a']);
  assert.deepEqual(ids('rifugio'), ['c']);
  assert.deepEqual(ids('firmware'), ['b']);
  assert.deepEqual(ids('appunto'), ['c']);
});
test('ignora accenti e maiuscole, supporta prefissi', () => {
  assert.deepEqual(ids('perche'), ['a']);
  assert.deepEqual(ids('SALDAT'), ['a']);
  assert.deepEqual(ids('stabil'), ['b']);
});
test('più parole: devono comparire tutte; altrimenti ripiega su risultati parziali', () => {
  assert.deepEqual(ids('drone braccio'), ['a']);
  assert.ok(ids('drone neve').length >= 1);
  assert.deepEqual(ids('xyzzy'), []);
  assert.deepEqual(ids('   '), []);
});
test('i risultati in titolo/tag precedono quelli nel solo testo', () => {
  assert.equal(ids('fpv')[0] !== undefined, true);
  assert.deepEqual(ids('fpv').sort(), ['a', 'b']);
});
