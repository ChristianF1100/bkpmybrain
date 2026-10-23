/**
 * Pipeline di build (pura, testabile): file di contenuto → grafo + indice di ricerca.
 * Nessun accesso al filesystem: lo script `scripts/build-data.ts` si occupa di I/O.
 */
import type { ContentItem, Graph, GraphNode, NetworkConfig, RawContent, Topic, TopicDef, Vec3 } from './types.ts';
import { TYPE_LABELS } from './types.ts';
import { normalizeContent, validateSet } from './content.ts';
import { resolveTopics } from './topics.ts';
import { buildLinks } from './links.ts';
import { computeLayout } from './layout.ts';
import type { Pins } from './layout.ts';
import { structuralStrength } from './activity.ts';
import { buildSearchIndex } from './search.ts';
import type { SearchIndex } from './search.ts';
import { excerpt } from './text.ts';

export type PipelineConfig = Pick<NetworkConfig, 'palette' | 'links' | 'layout' | 'structural'>;

export interface PipelineInput {
  files: RawContent[];
  topics: TopicDef[];
  config: PipelineConfig;
  now: number;
  pins?: Pins;
  includeDrafts?: boolean;
  includeFuture?: boolean;
}
export interface PipelineOutput {
  graph: Graph;
  search: SearchIndex;
  items: ContentItem[];
  errors: string[];
  warnings: string[];
  skipped: { file: string; reason: 'draft' | 'future' }[];
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function validateTopics(defs: TopicDef[]): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const t of defs) {
    if (!t.id || !/^[a-z0-9][a-z0-9-]*$/.test(t.id)) errors.push(`argomento con id non valido: "${t.id}"`);
    if (seen.has(t.id)) errors.push(`argomento duplicato: "${t.id}"`);
    seen.add(t.id);
    if (!t.label) errors.push(`argomento "${t.id}" senza label`);
    if (!/^#[0-9a-fA-F]{6}$/.test(t.color ?? '')) errors.push(`argomento "${t.id}": colore non valido (usa #rrggbb)`);
    if (t.position && (!Array.isArray(t.position) || t.position.length !== 3)) errors.push(`argomento "${t.id}": position deve essere [x, y, z]`);
  }
  for (const t of defs) for (const r of t.related ?? []) if (!seen.has(r.topic)) errors.push(`argomento "${t.id}": related "${r.topic}" non esiste`);
  return errors;
}

export function runPipeline(input: PipelineInput): PipelineOutput {
  const { config: cfg, now } = input;
  const errors: string[] = validateTopics(input.topics);
  const warnings: string[] = [];
  const skipped: PipelineOutput['skipped'] = [];
  const items: ContentItem[] = [];

  for (const f of [...input.files].sort((a, b) => cmp(a.file, b.file))) {
    const r = normalizeContent(f, { now, includeDrafts: input.includeDrafts, includeFuture: input.includeFuture });
    errors.push(...r.errors); warnings.push(...r.warnings);
    if (r.skipped) skipped.push({ file: f.file, reason: r.skipped });
    if (r.item) items.push(r.item);
  }
  errors.push(...validateSet(items));

  const ids = new Set(items.map((i) => i.id));
  for (const it of items) {
    const bad = it.related.filter((r) => !ids.has(r));
    if (bad.length) warnings.push(`${it.file}: related verso contenuti inesistenti o non pubblicati (${bad.join(', ')}): ignorati`);
  }

  const { topics, byItem } = resolveTopics(input.topics, items, cfg.links, cfg.palette.autoColors);
  const linkItems = items.map((it) => ({ id: it.id, tags: byItem.get(it.id)!.tags, topicIds: byItem.get(it.id)!.topicIds, related: it.related }));
  const links = buildLinks(linkItems, topics, cfg.links);
  const layout = computeLayout(topics, items.map((it) => ({ id: it.id, date: it.date, topicIds: byItem.get(it.id)!.topicIds })), cfg.layout, input.pins ?? {});

  const topicById = new Map<string, Topic>(topics.map((t) => [t.id, t]));
  const nodes: GraphNode[] = [];
  const counts = new Map<string, number>();
  for (const it of items) for (const t of byItem.get(it.id)!.topicIds) counts.set(t, (counts.get(t) ?? 0) + 1);

  for (const t of [...topics].sort((a, b) => cmp(a.id, b.id))) {
    const n = counts.get(t.id) ?? 0;
    const node: GraphNode = {
      id: `t:${t.id}`, kind: 'topic', ref: t.id, label: t.label, type: 'topic', date: null,
      pos: layout.get(`t:${t.id}`) as Vec3, color: t.color, topics: [], titled: true,
      desc: t.description ?? (n ? `${n} ${n === 1 ? 'contenuto' : 'contenuti'} in questo argomento.` : 'Nessun contenuto ancora.'),
      url: null, structural: 0,
    };
    if (t.secret) node.secret = true;
    if (t.faint !== undefined) node.faint = t.faint;
    nodes.push(node);
  }
  for (const it of [...items].sort((a, b) => cmp(a.date, b.date) || cmp(a.id, b.id))) {
    const tids = byItem.get(it.id)!.topicIds;
    const main = tids.length ? topicById.get(tids[0]) : undefined;
    nodes.push({
      id: `c:${it.id}`, kind: 'content', ref: it.id,
      label: it.title ?? (it.text ? excerpt(it.text, 64) : TYPE_LABELS[it.type]),
      type: it.type, date: it.date, pos: layout.get(`c:${it.id}`) as Vec3,
      color: main?.color ?? cfg.palette.neutral, topics: tids, titled: it.title !== null,
      desc: it.description, url: it.url, structural: 0,
    });
  }

  const index = new Map(nodes.map((n, i) => [n.id, i]));
  const edges = links.flatMap((l) => {
    const a = index.get(l.a), b = index.get(l.b);
    if (a === undefined || b === undefined) return [];
    return [{ a: Math.min(a, b), b: Math.max(a, b), w: l.w, kind: l.kind }];
  });
  const st = structuralStrength(nodes.map((n) => n.kind), edges, cfg.structural);
  nodes.forEach((n, i) => { n.structural = st[i]; });

  const search = buildSearchIndex(items.map((it) => ({
    id: it.id, title: it.title ?? '', desc: it.description, type: it.type, typeLabel: TYPE_LABELS[it.type],
    tags: [...new Set([...byItem.get(it.id)!.topicIds.map((t) => topicById.get(t)?.label ?? t), ...it.tags])],
    shown: byItem.get(it.id)!.topicIds.map((t) => topicById.get(t)?.label ?? t),
    text: it.text, ts: Date.parse(it.date),
  })));
  // l'indice di ricerca usa l'id del nodo contenuto per consentire la navigazione 3D
  search.docs.forEach((d) => { d.i = `c:${d.i}`; });

  return {
    graph: { version: 1, generated: new Date(now).toISOString(), nodes, edges },
    search, items, errors, warnings, skipped,
  };
}
