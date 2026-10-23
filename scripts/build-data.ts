/**
 * Genera i dati della rete a partire da content/ e config/.
 *
 *   npm run data          genera src/generated/{graph,search-index}.json
 *   npm run validate      solo controlli (nessun file scritto, exit 1 se ci sono errori)
 *   npm run lock-layout   congela le coordinate attuali in data/layout.lock.json
 *
 * Opzioni: --check  --lock  --drafts  --future  --now=AAAA-MM-GG
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline } from '../src/core/pipeline.ts';
import type { PipelineOutput } from '../src/core/pipeline.ts';
import type { RawContent, TopicDef, Vec3 } from '../src/core/types.ts';
import { NETWORK } from '../config/network.ts';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function listContentFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('_') || name.startsWith('.')) continue; // _bozze, _template…: ignorati
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listContentFiles(full));
    else if (/\.mdx?$/.test(name)) out.push(full);
  }
  return out;
}

const readJson = <T>(path: string, fallback: T): T => (existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : fallback);

export interface GenerateOptions { check?: boolean; lock?: boolean; drafts?: boolean; future?: boolean; now?: number; quiet?: boolean }

export function generate(opts: GenerateOptions = {}): PipelineOutput {
  const files: RawContent[] = listContentFiles(join(ROOT, 'content')).map((f) => ({
    file: relative(ROOT, f).split(sep).join('/'),
    source: readFileSync(f, 'utf8'),
  }));
  const topics = readJson<{ topics: TopicDef[] }>(join(ROOT, 'config/topics.json'), { topics: [] }).topics;
  const pins = readJson<Record<string, Vec3>>(join(ROOT, 'data/layout.lock.json'), {});
  const out = runPipeline({
    files, topics, config: NETWORK, pins, now: opts.now ?? Date.now(),
    includeDrafts: opts.drafts, includeFuture: opts.future,
  });
  const log = opts.quiet ? () => {} : console.log;
  for (const w of out.warnings) log(`  avviso: ${w}`);
  if (out.errors.length) {
    console.error(`\n✖ ${out.errors.length} errori nei contenuti:`);
    for (const e of out.errors) console.error(`  - ${e}`);
    if (opts.check || !opts.quiet) process.exitCode = 1;
    return out;
  }
  if (!opts.check) {
    const dir = join(ROOT, 'src/generated');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'graph.json'), JSON.stringify(out.graph));
    writeFileSync(join(dir, 'search-index.json'), JSON.stringify(out.search));
    // Dominio personalizzato: public/CNAME viene scritto (o rimosso) in base alla configurazione.
    const site = readJson<{ customDomain?: string }>(join(ROOT, 'config/site.json'), {});
    const cname = join(ROOT, 'public/CNAME');
    const domain = site.customDomain?.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (domain) writeFileSync(cname, `${domain}\n`);
    else if (existsSync(cname)) rmSync(cname);
    if (opts.lock) {
      const lock: Record<string, Vec3> = {};
      for (const n of out.graph.nodes) if (n.kind === 'content') lock[n.id] = n.pos;
      mkdirSync(join(ROOT, 'data'), { recursive: true });
      writeFileSync(join(ROOT, 'data/layout.lock.json'), JSON.stringify(lock, null, 1) + '\n');
      log(`  coordinate bloccate: ${Object.keys(lock).length} nodi → data/layout.lock.json`);
    }
  }
  const nT = out.graph.nodes.filter((n) => n.kind === 'topic').length;
  log(`✔ ${out.items.length} contenuti pubblicati · ${nT} argomenti · ${out.graph.edges.length} collegamenti`
    + (out.skipped.length ? ` · ${out.skipped.length} esclusi (${out.skipped.map((s) => `${s.file}: ${s.reason === 'draft' ? 'bozza' : 'data futura'}`).join('; ')})` : ''));
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const nowArg = args.find((a) => a.startsWith('--now='));
  generate({
    check: args.includes('--check'), lock: args.includes('--lock'),
    drafts: args.includes('--drafts'), future: args.includes('--future'),
    now: nowArg ? Date.parse(nowArg.slice(6)) : undefined,
  });
}
