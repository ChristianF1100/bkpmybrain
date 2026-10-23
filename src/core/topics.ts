/** Risoluzione degli argomenti: alias, equivalenze, argomenti automatici. */
import type { ContentItem, LinkParams, Topic, TopicDef } from './types.ts';
import { capitalize, normalizeTag } from './text.ts';
import { hash32 } from './rng.ts';

export interface ItemTopics { tags: string[]; topicIds: string[] }
export interface ResolvedTopics { topics: Topic[]; byItem: Map<string, ItemTopics> }

export function buildEquivalenceMap(groups: string[][]): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of groups) {
    const norm = g.map(normalizeTag).filter(Boolean);
    for (const t of norm) m.set(t, norm[0]);
  }
  return m;
}

export function buildAliasMap(topics: TopicDef[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of topics) {
    for (const k of [t.id, t.label, ...(t.aliases ?? [])]) {
      const n = normalizeTag(k);
      if (n) m.set(n, t.id);
    }
  }
  return m;
}

/**
 * Per ogni contenuto: tag canonici (equivalenze applicate, alias sostituiti dall'id del topic)
 * e argomenti collegati (quello `primary` per primo). Un tag non definito che compare in almeno
 * `autoTopicMinCount` contenuti diventa automaticamente un nuovo argomento.
 */
export function resolveTopics(defs: TopicDef[], items: ContentItem[], p: LinkParams, autoColors: string[]): ResolvedTopics {
  const equiv = buildEquivalenceMap(p.equivalences);
  const alias = buildAliasMap(defs);
  const topics: Topic[] = defs.map((d) => ({ ...d }));

  const canon = (tag: string, aliasMap: Map<string, string>): string => {
    const direct = aliasMap.get(tag);
    if (direct) return direct;
    const t1 = equiv.get(tag) ?? tag;
    return aliasMap.get(t1) ?? t1;
  };

  const pass = (aliasMap: Map<string, string>) => {
    const byItem = new Map<string, ItemTopics>();
    for (const it of items) {
      const tags = [...new Set(it.tags.map((t) => canon(t, aliasMap)))];
      const ids = new Set(topics.map((t) => t.id));
      let topicIds = tags.filter((t) => ids.has(t));
      const prim = it.primary ? canon(it.primary, aliasMap) : null;
      if (prim && topicIds.includes(prim)) topicIds = [prim, ...topicIds.filter((t) => t !== prim)];
      byItem.set(it.id, { tags, topicIds });
    }
    return byItem;
  };

  let byItem = pass(alias);
  const df = new Map<string, number>();
  const known = new Set(topics.map((t) => t.id));
  for (const { tags } of byItem.values()) for (const t of tags) if (!known.has(t)) df.set(t, (df.get(t) ?? 0) + 1);
  const created = [...df].filter(([, n]) => n >= p.autoTopicMinCount).map(([t]) => t).sort();
  if (created.length) {
    for (const id of created) {
      topics.push({
        id, label: capitalize(id.replace(/-/g, ' ')),
        color: autoColors[hash32(id) % autoColors.length], zone: 'mid', auto: true,
      } as Topic);
      alias.set(id, id);
    }
    byItem = pass(alias);
  }
  return { topics, byItem };
}
