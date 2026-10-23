/** Validazione e normalizzazione dei contenuti (frontmatter → ContentItem). */
import { CONTENT_TYPES, TYPE_ALIASES } from './types.ts';
import type { ContentItem, ContentType, RawContent } from './types.ts';
import { parseFrontmatter, YamlError } from './frontmatter.ts';
import { excerpt, normalizeTag, plainText, slugify } from './text.ts';

export const CONTENT_URL_PREFIX = '/contenuti/';
const ID_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const KNOWN_KEYS = new Set([
  'id', 'slug', 'type', 'title', 'date', 'tags', 'description', 'draft', 'related', 'primary', 'cover', 'demo',
]);

export interface NormalizeOptions { now: number; includeDrafts?: boolean; includeFuture?: boolean }
export interface NormalizeResult {
  item: ContentItem | null;
  errors: string[];
  warnings: string[];
  skipped: null | 'draft' | 'future';
}

export function resolveType(value: unknown): ContentType | null {
  const s = slugify(String(value ?? ''));
  if ((CONTENT_TYPES as readonly string[]).includes(s)) return s as ContentType;
  return TYPE_ALIASES[s] ?? null;
}

/** `2026-10-14` → mezzogiorno UTC (evita slittamenti di fuso); altrimenti ISO completo. */
export function parseDate(value: unknown): string | null {
  const s = String(value ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const ts = Date.parse(`${s}T12:00:00Z`);
    return Number.isFinite(ts) && new Date(ts).toISOString().startsWith(s) ? new Date(ts).toISOString() : null;
  }
  const ts = Date.parse(s);
  return Number.isFinite(ts) && /^\d{4}-/.test(s) ? new Date(ts).toISOString() : null;
}

function asStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((x) => x.trim()).filter(Boolean);
  return [];
}

export function normalizeContent(raw: RawContent, opts: NormalizeOptions): NormalizeResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fail = (): NormalizeResult => ({ item: null, errors, warnings, skipped: null });
  const e = (msg: string) => errors.push(`${raw.file}: ${msg}`);

  let parsed;
  try { parsed = parseFrontmatter(raw.source); }
  catch (err) { e(`frontmatter non valido — ${err instanceof YamlError ? err.message : String(err)}`); return fail(); }
  if (!parsed.hasFrontmatter) { e('manca il frontmatter (blocco --- all\'inizio del file)'); return fail(); }
  const d = parsed.data;

  for (const k of Object.keys(d)) if (!KNOWN_KEYS.has(k)) warnings.push(`${raw.file}: campo sconosciuto "${k}" (ignorato)`);

  const id = d.id === undefined ? '' : String(d.id).trim();
  if (!id) e('manca "id" (identificativo stabile, es. 20261014-riparazione-drone)');
  else if (!ID_RE.test(id)) e(`"id" non valido: "${id}" (minuscole, cifre, "-" e "_"; 2–64 caratteri)`);

  const type = resolveType(d.type);
  if (!type) e(`"type" mancante o non valido (${String(d.type ?? '')}). Valori: ${CONTENT_TYPES.join(', ')}`);

  const date = parseDate(d.date);
  if (!date) e(`"date" mancante o non valida (${String(d.date ?? '')}). Usa AAAA-MM-GG`);

  const tags = [...new Set(asStringList(d.tags).map(normalizeTag).filter(Boolean))];
  if (tags.length === 0) e('serve almeno un tag in "tags"');

  let cover: ContentItem['cover'] = null;
  if (d.cover !== undefined && d.cover !== null) {
    const c = d.cover as Record<string, unknown>;
    if (typeof c !== 'object' || typeof c.src !== 'string') e('"cover" deve avere "src"');
    else if (typeof c.alt !== 'string' || !c.alt.trim()) e('"cover" richiede il testo alternativo "alt"');
    else cover = { src: c.src, alt: c.alt.trim() };
  }

  if (errors.length) return fail();

  const draft = d.draft === true;
  const title = typeof d.title === 'string' && d.title.trim() ? d.title.trim() : null;
  const body = plainText(parsed.body);
  const description = typeof d.description === 'string' && d.description.trim()
    ? d.description.trim()
    : excerpt(body, 200);
  const slug = (typeof d.slug === 'string' && slugify(d.slug)) || (title && slugify(title)) || id;

  const item: ContentItem = {
    id, slug, type: type as ContentType, title, date: date as string, description,
    tags, related: asStringList(d.related), primary: d.primary ? normalizeTag(d.primary) : null,
    cover, demo: d.demo === true, file: raw.file,
    text: plainText([title ?? '', description, parsed.body].join('\n')),
    url: `${CONTENT_URL_PREFIX}${slug}/`,
  };

  let skipped: NormalizeResult['skipped'] = null;
  if (draft && !opts.includeDrafts) skipped = 'draft';
  else if (Date.parse(item.date) > opts.now && !opts.includeFuture) skipped = 'future';
  return { item: skipped ? null : item, errors, warnings, skipped };
}

/** Controlli sull'insieme: id e slug devono essere univoci. */
export function validateSet(items: ContentItem[]): string[] {
  const errors: string[] = [];
  const ids = new Map<string, string>();
  const slugs = new Map<string, string>();
  for (const it of items) {
    const a = ids.get(it.id);
    if (a) errors.push(`id duplicato "${it.id}": ${a} e ${it.file}`);
    else ids.set(it.id, it.file);
    const b = slugs.get(it.slug);
    if (b) errors.push(`slug duplicato "${it.slug}": ${b} e ${it.file} (aggiungi "slug:" a uno dei due)`);
    else slugs.set(it.slug, it.file);
  }
  return errors;
}
