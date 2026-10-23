/** URL e percorsi indipendenti dal sottopercorso di GitHub Pages. */

/** Antepone `base` a un percorso assoluto del sito; lascia intatti URL esterni, #ancore e data:. */
export function joinBase(base: string, path: string): string {
  if (!path || /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(path)) return path;
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  if (b && (p === b || p.startsWith(`${b}/`))) return p; // già prefissato
  return `${b}${p}` || '/';
}

/** Da usare nel codice Astro/React: usa la `base` configurata in build. */
export const withBase = (path: string): string => joinBase(import.meta.env.BASE_URL ?? '/', path);

/** Percorso di un nodo nella rete: `/#<id-nodo>` (ripristina la selezione al ritorno). */
export const nodeHash = (nodeId: string): string => `#${encodeURIComponent(nodeId)}`;
