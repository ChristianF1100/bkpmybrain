import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RawContent, TopicDef } from '../src/core/types.ts';
import { listContentFiles } from '../scripts/build-data.ts';
import { NETWORK } from '../config/network.ts';

export const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
export const demoFiles = (): RawContent[] =>
  listContentFiles(join(ROOT, 'content')).map((f) => ({ file: f.slice(ROOT.length + 1), source: readFileSync(f, 'utf8') }));
export const demoTopics = (): TopicDef[] => JSON.parse(readFileSync(join(ROOT, 'config/topics.json'), 'utf8')).topics;
export const CFG = NETWORK;
export const NOW = Date.parse('2026-10-21T12:00:00Z');
export const md = (id: string, extra = '', body = 'Testo.') =>
  `---\nid: ${id}\ntype: article\ndate: 2026-01-01\ntags: [a]\n${extra}---\n${body}\n`;
export { readdirSync };
