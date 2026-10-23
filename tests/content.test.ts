import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeContent, parseDate, resolveType, validateSet } from '../src/core/content.ts';
import { slugify, normalizeTag, plainText } from '../src/core/text.ts';
import { NOW, md } from './helpers.ts';

const norm = (source: string, o = {}) => normalizeContent({ file: 'x.md', source }, { now: NOW, ...o });

test('slug e tag', () => {
  assert.equal(slugify('Perché è così? Città & Montagna!'), 'perche-e-cosi-citta-e-montagna');
  assert.equal(normalizeTag('Stampa 3D'), 'stampa-3d');
});
test('id, slug e titolo opzionale', () => {
  const r = norm(md('mio-id'));
  assert.equal(r.errors.length, 0);
  assert.equal(r.item?.title, null);
  assert.equal(r.item?.slug, 'mio-id');             // senza titolo: slug = id
  assert.equal(norm(md('mio-id', 'title: Un Titolo Bello\n')).item?.slug, 'un-titolo-bello');
  assert.equal(norm(md('mio-id', 'title: Un Titolo\nslug: custom\n')).item?.slug, 'custom');
});
test('campi obbligatori e id non valido', () => {
  assert.match(norm('---\ntype: note\ndate: 2026-01-01\ntags: [a]\n---\nx').errors[0], /manca "id"/);
  assert.match(norm(md('ID Non Valido')).errors[0], /"id" non valido/);
  assert.match(norm('---\nid: abc\ntype: boh\ndate: 2026-01-01\ntags: [a]\n---').errors[0], /"type"/);
  assert.match(norm('---\nid: abc\ntype: note\ndate: ieri\ntags: [a]\n---').errors[0], /"date"/);
  assert.match(norm('---\nid: abc\ntype: note\ndate: 2026-01-01\n---').errors[0], /almeno un tag/);
  assert.match(norm('niente frontmatter').errors[0], /frontmatter/);
});
test('alias italiani dei tipi e date', () => {
  assert.equal(resolveType('Nota'), 'note');
  assert.equal(resolveType('fotografia'), 'photo');
  assert.equal(parseDate('2026-02-30'), null);
  assert.equal(parseDate('2026-10-14'), '2026-10-14T12:00:00.000Z');
});
test('bozze e date future sono escluse dal sito pubblico', () => {
  assert.equal(norm(md('d1', 'draft: true\n')).skipped, 'draft');
  assert.equal(norm(md('d1', 'draft: true\n')).item, null);
  assert.equal(norm(md('d1', 'draft: true\n'), { includeDrafts: true }).item?.id, 'd1');
  const fut = '---\nid: futuro\ntype: note\ndate: 2027-01-01\ntags: [a]\n---\nx';
  assert.equal(norm(fut).skipped, 'future');
  assert.equal(norm(fut, { includeFuture: true }).item?.id, 'futuro');
});
test('la cover richiede il testo alternativo', () => {
  assert.match(norm(md('c1', 'cover: { src: /media/a.jpg }\n')).errors[0], /alt/);
  assert.equal(norm(md('c1', 'cover: { src: /media/a.jpg, alt: Una foto }\n')).item?.cover?.alt, 'Una foto');
});
test('slug e id duplicati vengono segnalati', () => {
  const a = norm(md('a1', 'title: Uguale\n')).item!;
  const b = norm(md('b1', 'title: Uguale\n')).item!;
  assert.match(validateSet([a, b])[0], /slug duplicato/);
  assert.match(validateSet([a, { ...a }])[0], /id duplicato/);
});
test('plainText toglie markup, JSX e import ma conserva alt e didascalie', () => {
  const t = plainText('import X from "y"\n# Titolo\n<Figure src="/a.jpg" alt="Una saldatura" caption="Didascalia"/>\nTesto **forte** [link](http://a)');
  assert.ok(t.includes('Una saldatura') && t.includes('Didascalia') && t.includes('Testo forte link'));
  assert.ok(!t.includes('import') && !t.includes('<'));
});

test('il template content/_templates/esempio-completo.mdx è valido (frontmatter con commenti inclusi)', async () => {
  const { readFileSync } = await import('node:fs');
  const { ROOT } = await import('./helpers.ts');
  const src = readFileSync(`${ROOT}/content/_templates/esempio-completo.mdx`, 'utf8');
  const r = normalizeContent({ file: 'tpl.mdx', source: src }, { now: NOW });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.item?.id, '20260101-esempio-completo');
  assert.deepEqual(r.item?.tags, ['fpv', 'elettronica', 'idea-nuova']);
});
