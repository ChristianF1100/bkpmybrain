/** Utilità di testo: slug, tag, estratti, tokenizzazione. */

export const stripAccents = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function slugify(s: string): string {
  return stripAccents(String(s))
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

/** "Stampa 3D" → "stampa-3d". */
export const normalizeTag = (s: unknown): string => slugify(String(s));

/** Converte markdown/MDX in testo semplice (per ricerca ed estratti). */
export function plainText(md: string): string {
  const attrTexts: string[] = [];
  const src = md
    .replace(/^\s*(import|export)\s.+$/gm, ' ')
    .replace(/(?:alt|caption|label|title)=(?:"([^"]*)"|'([^']*)')/g, (_m, a: string, b: string) => {
      attrTexts.push(a ?? b ?? '');
      return ' ';
    });
  return (
    src
      .replace(/```[^\n]*\n?/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^[#>\-*+\s]+(?=\S)/gm, '')
      .replace(/[*_`~|]/g, '')
      .replace(/\{[^}]*\}/g, ' ') + ' ' + attrTexts.join(' ')
  ).replace(/\s+/g, ' ').trim();
}

export function excerpt(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.\-–—]+$/, '') + '…';
}

/** Token di ricerca: minuscole, senza accenti, lunghezza ≥ 2. */
export function tokenize(text: string): string[] {
  return stripAccents(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

export const capitalize = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);
