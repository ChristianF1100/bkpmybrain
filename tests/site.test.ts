import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBase, resolveSite } from '../config/resolve-site.ts';
import { joinBase } from '../src/lib/url.ts';
import rehypeBasePath from '../src/lib/rehype-base.ts';

test('sito GitHub Pages in sottopercorso, sito utente e dominio personalizzato', () => {
  assert.deepEqual(resolveSite({ GITHUB_REPOSITORY: 'Mario/sinapsi' }, {}), { site: 'https://mario.github.io', base: '/sinapsi' });
  assert.deepEqual(resolveSite({ GITHUB_REPOSITORY: 'mario/mario.github.io' }, {}), { site: 'https://mario.github.io', base: '/' });
  assert.deepEqual(resolveSite({ GITHUB_REPOSITORY: 'mario/sinapsi' }, { customDomain: 'www.esempio.it' }), { site: 'https://www.esempio.it', base: '/' });
  assert.deepEqual(resolveSite({}, {}), { site: 'http://localhost:4321', base: '/' });
  assert.deepEqual(resolveSite({ SINAPSI_SITE: 'https://x.it/', SINAPSI_BASE: 'a/b/' }, {}), { site: 'https://x.it', base: '/a/b' });
  assert.equal(normalizeBase('/'), '/'); assert.equal(normalizeBase('repo'), '/repo');
});
test('joinBase: sottopercorso, radice, URL esterni e percorsi già prefissati', () => {
  assert.equal(joinBase('/sinapsi', '/contenuti/x/'), '/sinapsi/contenuti/x/');
  assert.equal(joinBase('/sinapsi/', '/media/a.jpg'), '/sinapsi/media/a.jpg');
  assert.equal(joinBase('/', '/media/a.jpg'), '/media/a.jpg');
  assert.equal(joinBase('/sinapsi', 'https://x.it/a'), 'https://x.it/a');
  assert.equal(joinBase('/sinapsi', '#nodo'), '#nodo');
  assert.equal(joinBase('/sinapsi', '/sinapsi/media/a.jpg'), '/sinapsi/media/a.jpg');
  assert.equal(joinBase('/', '/'), '/'); assert.equal(joinBase('/sinapsi', '/'), '/sinapsi/');
});
test('plugin rehype prefissa i percorsi assoluti di immagini e link', () => {
  const tree: any = { type: 'root', children: [
    { type: 'element', tagName: 'img', properties: { src: '/media/a.jpg' }, children: [] },
    { type: 'element', tagName: 'a', properties: { href: 'https://x.it' }, children: [{ type: 'element', tagName: 'a', properties: { href: '/contenuti/z/' }, children: [] }] },
  ] };
  rehypeBasePath({ base: '/repo' })(tree);
  assert.equal(tree.children[0].properties.src, '/repo/media/a.jpg');
  assert.equal(tree.children[1].properties.href, 'https://x.it');
  assert.equal(tree.children[1].children[0].properties.href, '/repo/contenuti/z/');
});
