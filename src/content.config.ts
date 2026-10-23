/**
 * Collezione dei contenuti (Markdown/MDX in content/).
 * La validazione completa dei metadati (id, tipo, data, tag, slug univoci, bozze, date future)
 * è fatta da scripts/build-data.ts; qui serve solo l'id per collegare ogni file al suo nodo.
 * I file e le cartelle che iniziano con "_" sono ignorati (bozze personali, template).
 */
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const contenuti = defineCollection({
  loader: glob({ pattern: ['**/[^_]*.{md,mdx}', '!**/_*/**'], base: './content' }),
  schema: z.object({ id: z.union([z.string(), z.number()]).transform(String) }).passthrough(),
});

export const collections = { contenuti };
