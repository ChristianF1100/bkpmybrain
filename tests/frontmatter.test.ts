import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter, parseYaml, YamlError } from '../src/core/frontmatter.ts';

test('scalari, liste inline e a blocchi', () => {
  const d = parseYaml(`id: abc-1\nn: 12\nok: true\nnulla: null\ntags: [a, "b, c", 'd']\nlista:\n  - uno\n  - due\n# commento\ntitle: "Ciao: mondo" # c`);
  assert.deepEqual(d, { id: 'abc-1', n: 12, ok: true, nulla: null, tags: ['a', 'b, c', 'd'], lista: ['uno', 'due'], title: 'Ciao: mondo' });
});
test('le date restano stringhe', () => {
  assert.equal(parseYaml('date: 2026-10-14').date, '2026-10-14');
});
test('mappe annidate, mappe inline e liste di mappe', () => {
  const d = parseYaml(`cover: { src: /media/a.svg, alt: "x, y" }\nmedia:\n  - src: /a.jpg\n    alt: Una\n  - src: /b.jpg\n    alt: Due\nnest:\n  k: v\n  sub:\n    z: 1`);
  assert.deepEqual(d.cover, { src: '/media/a.svg', alt: 'x, y' });
  assert.deepEqual(d.media, [{ src: '/a.jpg', alt: 'Una' }, { src: '/b.jpg', alt: 'Due' }]);
  assert.deepEqual(d.nest, { k: 'v', sub: { z: 1 } });
});
test('lista allo stesso livello della chiave', () => {
  assert.deepEqual(parseYaml('tags:\n- a\n- b\nx: 1'), { tags: ['a', 'b'], x: 1 });
});
test("l'apostrofo in una stringa non quotata non rompe il parser", () => {
  assert.equal(parseYaml("description: l'albero di Natale").description, "l'albero di Natale");
});
test('costrutti non supportati danno errore chiaro', () => {
  assert.throws(() => parseYaml('a: |\n  testo'), YamlError);
  assert.throws(() => parseYaml('a: &x 1'), YamlError);
  assert.throws(() => parseYaml('\ta: 1'), YamlError);
  assert.throws(() => parseYaml('a: [1, 2'), YamlError);
});
test('parseFrontmatter separa corpo e metadati', () => {
  const p = parseFrontmatter('---\nid: x\n---\n# Titolo\n\nCorpo');
  assert.equal(p.hasFrontmatter, true);
  assert.equal(p.data.id, 'x');
  assert.equal(p.body, '# Titolo\n\nCorpo');
  assert.equal(parseFrontmatter('solo testo').hasFrontmatter, false);
  assert.deepEqual(parseFrontmatter('---\n---\nciao').data, {});
});

test('due punti in un valore non quotato = errore chiaro, come in YAML standard (Astro li rifiuterebbe)', () => {
  assert.throws(() => parseYaml('title: Attrezzatura: cosa porto'), /tra virgolette/);
  assert.throws(() => parseYaml('description: Un sito: un archivio'), YamlError);
  assert.equal(parseYaml('title: "Attrezzatura: cosa porto"').title, 'Attrezzatura: cosa porto');
  assert.equal(parseYaml('url: https://esempio.it/a').url, 'https://esempio.it/a');     // "://" non è ": "
  assert.equal(parseYaml('t: 10:30').t, '10:30');
  assert.throws(() => parseYaml('a: @x'), YamlError);
});
