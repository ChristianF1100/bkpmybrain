/**
 * Crea un nuovo contenuto con id, data e frontmatter già pronti.
 *   npm run new -- article "Titolo dell'articolo" --tags fpv,elettronica
 *   npm run new -- fragment --tags pensieri            (frammento senza titolo)
 * Opzioni: --date AAAA-MM-GG   --draft   --mdx (default per article/project/mixed)
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { ROOT } from './build-data.ts';
import { resolveType } from '../src/core/content.ts';
import { slugify } from '../src/core/text.ts';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['draft', 'mdx'].includes(args[i - 1].slice(2))));
const type = resolveType(positional[0]);
if (!type) {
  console.error('Uso: npm run new -- <tipo> ["Titolo"] [--tags a,b] [--date AAAA-MM-GG] [--draft]\nTipi: article, note, fragment, project, photo, video, code, memory, mixed');
  process.exit(1);
}
const title = positional[1]?.trim() || '';
const date = flag('date') ?? new Date().toISOString().slice(0, 10);
const tags = (flag('tags') ?? 'da-classificare').split(',').map((t) => t.trim()).filter(Boolean);
const compact = date.replace(/-/g, '');
const base = title ? slugify(title) : `${type}-${randomBytes(2).toString('hex')}`;
const id = `${compact}-${base}`.slice(0, 64).replace(/-+$/, '');
const ext = ['article', 'project', 'mixed', 'photo', 'video'].includes(type) || args.includes('--mdx') ? 'mdx' : 'md';
const file = join(ROOT, 'content', date.slice(0, 4), `${id}.${ext}`);
if (existsSync(file)) { console.error(`Esiste già: ${file}`); process.exit(1); }

const fm = [
  '---', `id: ${id}`, `type: ${type}`, ...(title ? [`title: ${JSON.stringify(title)}`] : []),
  `date: ${date}`, `tags: [${tags.join(', ')}]`, ...(title ? ['description: ""'] : []),
  ...(args.includes('--draft') ? ['draft: true'] : []), '---', '',
].join('\n');
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, `${fm}\n${title ? 'Scrivi qui il contenuto.' : 'Scrivi qui il frammento.'}\n`);
console.log(`✔ creato ${file.slice(ROOT.length + 1)}\n  id: ${id}  (non cambiarlo mai: è l'identità stabile del nodo)`);
